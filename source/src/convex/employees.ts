import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  assertCafeActive,
  getSessionForUser,
  requirePermission,
  requireSession,
} from "./lib/access";
import {
  assertCanGrant,
  canManageEmployees,
  sanitizePermissions,
} from "./lib/permissions";
import { assertEmployeeQuota } from "./lib/billing";
import { fail, normalizePhone, requireText } from "./lib/validation";
import { PERMISSIONS } from "./permissions";
import { ROLES } from "./schema";

function publicEmployee(employee: Doc<"employees">, viewerId: string) {
  return {
    id: employee._id,
    fullName: employee.fullName,
    phone: employee.phone,
    roleTitle: employee.roleTitle ?? null,
    permissions: employee.permissions,
    active: employee.active,
    hasAccount: employee.userId !== undefined,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
    isSelf: employee.userId === viewerId,
  };
}

/** Everyone in the cafe with `employees.manage` can see the staff list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const session = await requirePermission(ctx, PERMISSIONS.EMPLOYEES_MANAGE);
    assertCafeActive(session.cafe);
    const employees = await ctx.db
      .query("employees")
      .withIndex("by_cafe", (q) => q.eq("cafeId", session.cafe._id))
      .collect();
    return {
      employees: employees
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((employee) => publicEmployee(employee, session.user._id)),
      isOwner: session.isOwner,
    };
  },
});

/** Loads a target employee and enforces tenant + self-escalation rules. */
async function loadTarget(
  ctx: Parameters<typeof requireSession>[0],
  employeeId: Doc<"employees">["_id"],
) {
  const session = await requireSession(ctx);
  if (!session.cafe || !session.membershipActive) {
    fail("forbidden", "حساب شما به کافی‌نت فعالی متصل نیست.");
  }
  const canManage = canManageEmployees(session.isOwner, session.permissions);
  if (!canManage) {
    fail("forbidden", "برای مدیریت کارمندان دسترسی ندارید.");
  }
  const target = await ctx.db.get(employeeId);
  if (!target || target.cafeId !== session.cafe._id) {
    fail("not_found", "کارمند مورد نظر پیدا نشد.");
  }
  if (target.userId === session.user._id) {
    fail("forbidden", "نمی‌توانید دسترسی‌های حساب خودتان را تغییر دهید.");
  }
  if (target.userId) {
    const targetUser = await ctx.db.get(target.userId);
    if (targetUser?.role === ROLES.ADMIN) {
      fail("forbidden", "حساب مدیر اصلی پلتفرم قابل ویرایش نیست.");
    }
  }
  return { session, target };
}

export const update = mutation({
  args: {
    employeeId: v.id("employees"),
    fullName: v.string(),
    roleTitle: v.optional(v.string()),
    permissions: v.array(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { session, target } = await loadTarget(ctx, args.employeeId);
    assertCafeActive(session.cafe!);
    if (args.active && !target.active) {
      await assertEmployeeQuota(ctx, session.cafe!._id);
    }

    const fullName = requireText(args.fullName, "نام کارمند", 2, 60);
    const roleTitle = args.roleTitle?.trim()
      ? requireText(args.roleTitle, "عنوان شغلی", 2, 40)
      : undefined;
    const permissions = sanitizePermissions(args.permissions);
    assertCanGrant(session.permissions, permissions, session.isOwner);

    await ctx.db.patch(target._id, {
      fullName,
      roleTitle,
      permissions,
      active: args.active,
      updatedAt: Date.now(),
    });
    if (target.userId) {
      await ctx.db.patch(target.userId, { name: fullName });
    }
    return { ok: true };
  },
});

export const setActive = mutation({
  args: { employeeId: v.id("employees"), active: v.boolean() },
  handler: async (ctx, args) => {
    const { session, target } = await loadTarget(ctx, args.employeeId);
    assertCafeActive(session.cafe!);
    if (args.active && !target.active) {
      await assertEmployeeQuota(ctx, session.cafe!._id);
    }
    await ctx.db.patch(target._id, {
      active: args.active,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Removes the staff member immediately. Their auth account is kept, but with
 * no employee record it grants no access to any cafe.
 */
export const remove = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const { session, target } = await loadTarget(ctx, args.employeeId);
    assertCafeActive(session.cafe!);
    await ctx.db.delete(target._id);
    return { ok: true };
  },
});

/**
 * Called by the `createEmployee` server action after the auth account was
 * created. Re-checks authorization so a compromised action cannot insert
 * cross-tenant rows.
 */
export const createRecord = internalMutation({
  args: {
    actorId: v.id("users"),
    cafeId: v.id("internet_cafes"),
    userId: v.id("users"),
    fullName: v.string(),
    phone: v.string(),
    roleTitle: v.optional(v.string()),
    permissions: v.array(v.string()),
    recoveryHash: v.string(),
    recoverySalt: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getSessionForUser(ctx, args.actorId);
    if (!actor || !actor.cafe || !actor.membershipActive) {
      fail("forbidden", "حساب شما به کافی‌نت فعالی متصل نیست.");
    }
    if (actor.cafe._id !== args.cafeId) {
      fail("forbidden", "امکان افزودن کارمند برای کافی‌نت دیگر وجود ندارد.");
    }
    if (!canManageEmployees(actor.isOwner, actor.permissions)) {
      fail("forbidden", "برای مدیریت کارمندان دسترسی ندارید.");
    }
    assertCafeActive(actor.cafe);

    const permissions = sanitizePermissions(args.permissions);
    assertCanGrant(actor.permissions, permissions, actor.isOwner);

    await assertEmployeeQuota(ctx, args.cafeId);
    const phone = normalizePhone(args.phone);
    if (!phone) fail("validation", "شماره موبایل کارمند معتبر نیست.");
    const fullName = requireText(args.fullName, "نام کارمند", 2, 60);

    const duplicatePhone = await ctx.db
      .query("employees")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (duplicatePhone) {
      fail("conflict", "این شماره موبایل قبلاً برای کارمند دیگری ثبت شده است.");
    }
    const duplicateUser = await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (duplicateUser) {
      fail("conflict", "این حساب قبلاً به یک کارمند متصل شده است.");
    }

    const now = Date.now();
    const employeeId = await ctx.db.insert("employees", {
      cafeId: args.cafeId,
      userId: args.userId,
      fullName,
      phone,
      roleTitle: args.roleTitle?.trim() || undefined,
      permissions,
      active: true,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("recovery_codes", {
      userId: args.userId,
      phone,
      codeHash: args.recoveryHash,
      salt: args.recoverySalt,
      attempts: 0,
      createdAt: now,
    });
    return { employeeId };
  },
});
