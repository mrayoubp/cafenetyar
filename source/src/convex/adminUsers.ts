import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  requireAdminPermission,
  requireSession,
  requireSiteAdmin,
  requirePlatformOwner,
} from "./lib/access";
import {
  ADMIN_PERMISSIONS,
  SUPER_ADMIN_ROLE_KEY,
  isAdminPermission,
} from "./lib/adminPermissions";
import { logAudit } from "./lib/platform";
import { fail, requireText } from "./lib/validation";

type Ctx = QueryCtx;

async function adminRoleKeysFor(ctx: Ctx, userId: Id<"users">) {
  const assignments = await ctx.db
    .query("admin_user_roles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const rows = [];
  for (const assignment of assignments) {
    const role = await ctx.db.get(assignment.roleId);
    if (role) rows.push({ assignmentId: assignment._id, ...role });
  }
  return rows;
}

async function lastSessionAt(ctx: Ctx, userId: Id<"users">) {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  return session?._creationTime ?? null;
}

async function superAdminCount(ctx: Ctx) {
  const roles = await ctx.db.query("admin_roles").collect();
  const superRole = roles.find((role) => role.key === SUPER_ADMIN_ROLE_KEY);
  const users = await ctx.db.query("users").collect();
  const baseAdmins = users.filter(
    (user) => user.role === "admin" && !user.isBlocked,
  ).length;
  if (!superRole) return baseAdmins;
  const assignments = await ctx.db.query("admin_user_roles").collect();
  const blockedIds = new Set(
    users.filter((user) => user.isBlocked).map((user) => user._id),
  );
  const baseAdminIds = new Set(
    users.filter((user) => user.role === "admin").map((user) => user._id),
  );
  const assignedSuperAdmins = assignments.filter(
    (row) =>
      row.roleId === superRole._id &&
      !blockedIds.has(row.userId) &&
      !baseAdminIds.has(row.userId),
  ).length;
  return baseAdmins + assignedSuperAdmins;
}

export const list = query({
  args: {
    search: v.optional(v.string()),
    roleKey: v.optional(v.string()),
    onlyBlocked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.USERS_VIEW);
    const users = await ctx.db.query("users").take(2000);
    const cafes = await ctx.db.query("internet_cafes").collect();
    const employees = await ctx.db.query("employees").collect();
    const cafesById = new Map(cafes.map((cafe) => [cafe._id, cafe]));
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";
    const allRoles = await ctx.db.query("admin_roles").collect();
    const roleById = new Map(allRoles.map((role) => [role._id, role]));

    const rows = [];
    for (const user of users) {
      const ownedCafe = cafes.find((cafe) => cafe.ownerId === user._id) ?? null;
      const employee = employees.find((row) => row.userId === user._id) ?? null;
      const cafe = ownedCafe ?? (employee ? cafesById.get(employee.cafeId) : null);
      const assignments = await ctx.db
        .query("admin_user_roles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const roles = assignments
        .map((assignment) => roleById.get(assignment.roleId))
        .filter((role): role is Doc<"admin_roles"> => Boolean(role));
      const roleKeys = roles.map((role) => role.key);
      if (args.roleKey && !roleKeys.includes(args.roleKey)) continue;
      if (args.onlyBlocked && !user.isBlocked) continue;
      if (user.isAnonymous) continue;
      if (search) {
        const haystack = [
          user.name ?? "",
          user.phone ?? "",
          user.email ?? "",
          cafe?.name ?? "",
          employee?.fullName ?? "",
          roles.map((role) => role.name).join(" "),
        ]
          .join(" ")
          .toLocaleLowerCase("fa");
        if (!haystack.includes(search)) continue;
      }
      rows.push({
        id: user._id,
        name: user.name ?? "بدون نام",
        phone: user.phone ?? null,
        email: user.email ?? null,
        isGuest: Boolean(user.isAnonymous),
        isBlocked: Boolean(user.isBlocked),
        blockedReason: user.blockedReason ?? null,
        blockedAt: user.blockedAt ?? null,
        isSuperAdmin:
          user.role === "admin" || roleKeys.includes(SUPER_ADMIN_ROLE_KEY),
        roles: roles.map((role) => ({
          assignmentId: assignments.find(
            (assignment) => assignment.roleId === role._id,
          )!._id,
          roleId: role._id,
          key: role.key,
          name: role.name,
        })),
        cafe: cafe
          ? {
              id: cafe._id,
              name: cafe.name,
              status: cafe.status,
              membership: ownedCafe ? ("owner" as const) : ("employee" as const),
              employeeActive: employee?.active ?? null,
            }
          : null,
        lastLoginAt: await lastSessionAt(ctx, user._id),
        createdAt: user._creationTime,
        phoneVerified: Boolean(user.phoneVerificationTime),
        lastActivityAt: user.lastActivityAt ?? null,
        isPlatformOwner: user.role === "admin",
      });
    }

    const all = rolesAll(allRoles);
    return {
      items: rows.sort((a, b) => b.createdAt - a.createdAt),
      total: rows.length,
      counts: {
        total: rows.length,
        owners: rows.filter((row) => row.cafe?.membership === "owner").length,
        employees: rows.filter((row) => row.cafe?.membership === "employee")
          .length,
        blocked: rows.filter((row) => row.isBlocked).length,
        adminTeam: rows.filter((row) => row.roles.length > 0).length,
      },
      roles: all,
    };
  },
});

function rolesAll(roles: Doc<"admin_roles">[]) {
  return roles
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, "fa"))
    .map((role) => ({
      id: role._id,
      key: role.key,
      name: role.name,
      isSystem: role.isSystem,
      isActive: role.isActive,
    }));
}

export const setBlocked = mutation({
  args: {
    userId: v.id("users"),
    blocked: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.USERS_MANAGE,
    );
    if (args.userId === session.user._id) {
      fail("validation", "امکان مسدودسازی حساب خودتان وجود ندارد.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) fail("not_found", "کاربر پیدا نشد.");
    if (user.role === "admin") {
      fail("forbidden", "حساب مدیر اصلی پایه قابل مسدودسازی نیست.");
    }
    {
      const roleKeys = (await adminRoleKeysFor(ctx, user._id)).map(
        (role) => role.key,
      );
      if (roleKeys.length > 0 && !session.isPlatformOwner) {
        fail("forbidden", "مسدودسازی اعضای تیم مدیریت فقط توسط مدیر اصلی مجاز است.");
      }
      if (roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
        const count = await superAdminCount(ctx);
        if (count <= 1) {
          fail("forbidden", "آخرین مدیر اصلی پلتفرم قابل مسدودسازی نیست.");
        }
      }
    }
    if ((await adminRoleKeysFor(ctx, user._id)).length > 0) await requirePlatformOwner(ctx);
    const reason = args.reason?.trim()
      ? requireText(args.reason, "دلیل مسدودسازی", 3, 500)
      : undefined;
    await ctx.db.patch(args.userId, {
      isBlocked: args.blocked,
      blockedAt: args.blocked ? Date.now() : undefined,
      blockedReason: args.blocked ? reason : undefined,
      blockedBy: args.blocked ? session.user._id : undefined,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: args.blocked ? "user.blocked" : "user.unblocked",
      entityType: "user",
      entityId: args.userId,
      summary: `${args.blocked ? "مسدودسازی" : "رفع مسدودی"} حساب ${user.name ?? user.phone ?? args.userId}`,
      metadata: reason ? JSON.stringify({ reason }) : undefined,
    });
    return { ok: true };
  },
});

export const assignRole = mutation({
  args: { userId: v.id("users"), roleId: v.id("admin_roles") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    if (session.user.isBlocked) fail("forbidden", "حساب شما مسدود است.");
    const user = await ctx.db.get(args.userId);
    const role = await ctx.db.get(args.roleId);
    if (!user) fail("not_found", "کاربر پیدا نشد.");
    if (!role || !role.isActive) fail("validation", "نقش مدیریتی فعال نیست.");
    if (role.key === SUPER_ADMIN_ROLE_KEY) fail("forbidden", "نقش مالک قابل واگذاری نیست؛ مجوزهای ادمین را جداگانه انتخاب کنید.");
    if (user.role === "admin") {
      fail("validation", "مدیر اصلی پایه از قبل دسترسی کامل دارد.");
    }
    const existing = await ctx.db
      .query("admin_user_roles")
      .withIndex("by_user_role", (q) =>
        q.eq("userId", args.userId).eq("roleId", args.roleId),
      )
      .first();
    if (existing) return { ok: true, alreadyAssigned: true };
    await ctx.db.insert("admin_user_roles", {
      userId: args.userId,
      roleId: args.roleId,
      assignedBy: session.user._id,
      assignedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.role_assigned",
      entityType: "user",
      entityId: args.userId,
      summary: `نقش «${role.name}» به ${user.name ?? user.phone ?? args.userId} داده شد.`,
      metadata: JSON.stringify({ roleKey: role.key }),
    });
    return { ok: true };
  },
});

export const removeRole = mutation({
  args: { userId: v.id("users"), roleId: v.id("admin_roles") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    const role = await ctx.db.get(args.roleId);
    if (!user || !role) fail("not_found", "کاربر یا نقش پیدا نشد.");
    if (user.role === "admin") fail("forbidden", "دسترسی مالک اصلی قابل تغییر نیست.");
    if (
      role.key === SUPER_ADMIN_ROLE_KEY &&
      (await superAdminCount(ctx)) <= 1
    ) {
      fail("forbidden", "آخرین مدیر اصلی پلتفرم قابل حذف نیست.");
    }
    const assignment = await ctx.db
      .query("admin_user_roles")
      .withIndex("by_user_role", (q) =>
        q.eq("userId", args.userId).eq("roleId", args.roleId),
      )
      .first();
    if (!assignment) return { ok: true };
    await ctx.db.delete(assignment._id);
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.role_removed",
      entityType: "user",
      entityId: args.userId,
      summary: `نقش «${role.name}» از ${user.name ?? user.phone ?? args.userId} گرفته شد.`,
      metadata: JSON.stringify({ roleKey: role.key }),
    });
    return { ok: true };
  },
});

export const roles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.ROLES_MANAGE);
    const roles = await ctx.db.query("admin_roles").collect();
    const permissions = await ctx.db.query("admin_role_permissions").collect();
    const users = await ctx.db.query("users").collect();
    const assignments = await ctx.db.query("admin_user_roles").collect();
    return roles
      .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, "fa"))
      .map((role) => ({
        id: role._id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissionKeys: permissions
          .filter((row) => row.roleId === role._id)
          .map((row) => row.permissionKey),
        memberCount: assignments.filter((row) => row.roleId === role._id)
          .length,
        activeMemberCount: assignments.filter((row) => {
          if (row.roleId !== role._id) return false;
          return users.some((user) => user._id === row.userId && !user.isBlocked);
        }).length,
      }));
  },
});

export const permissionCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.ROLES_MANAGE);
    return await ctx.db
      .query("admin_permissions")
      .withIndex("by_sort_order")
      .collect();
  },
});

export const saveRole = mutation({
  args: {
    roleId: v.optional(v.id("admin_roles")),
    name: v.string(),
    description: v.string(),
    permissionKeys: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const name = requireText(args.name, "نام نقش", 2, 80);
    const description = requireText(args.description, "توضیح نقش", 3, 240);
    const unique = [...new Set(args.permissionKeys)];
    if (unique.length === 0) {
      fail("validation", "حداقل یک مجوز برای نقش انتخاب کنید.");
    }
    for (const key of unique) {
      if (!isAdminPermission(key)) {
        fail("validation", "مجوز انتخاب‌شده معتبر نیست.");
      }
    }
    const now = Date.now();
    let roleId: Id<"admin_roles">;
    if (args.roleId) {
      const existing = await ctx.db.get(args.roleId);
      if (!existing) fail("not_found", "نقش پیدا نشد.");
      if (existing.key === SUPER_ADMIN_ROLE_KEY) fail("forbidden", "نقش مالک اصلی قابل ویرایش نیست.");
      await ctx.db.patch(args.roleId, {
        name,
        description,
        isActive: args.isActive,
        updatedAt: now,
      });
      roleId = args.roleId;
    } else {
      const slug = `custom_${Date.now().toString(36)}`;
      roleId = await ctx.db.insert("admin_roles", {
        key: slug,
        name,
        description,
        isSystem: false,
        isActive: args.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }
    const old = await ctx.db
      .query("admin_role_permissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    for (const permissionKey of unique) {
      await ctx.db.insert("admin_role_permissions", {
        roleId,
        permissionKey,
        createdAt: now,
      });
    }
    await logAudit(ctx, {
      actorId: session.user._id,
      action: args.roleId ? "admin.role_updated" : "admin.role_created",
      entityType: "admin_role",
      entityId: roleId,
      summary: `${args.roleId ? "ویرایش" : "ایجاد"} نقش «${name}» با ${unique.length} مجوز`,
      metadata: JSON.stringify({ permissionKeys: unique }),
    });
    return { roleId };
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("admin_roles") },
  handler: async (ctx, args) => {
    const session = await requireSiteAdmin(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) fail("not_found", "نقش پیدا نشد.");
    if (role.isSystem || role.key === SUPER_ADMIN_ROLE_KEY) {
      fail("forbidden", "نقش‌های سیستمی قابل حذف نیستند.");
    }
    const assignments = await ctx.db
      .query("admin_user_roles")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    for (const row of assignments) await ctx.db.delete(row._id);
    const permissions = await ctx.db
      .query("admin_role_permissions")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    for (const row of permissions) await ctx.db.delete(row._id);
    await ctx.db.delete(args.roleId);
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.role_deleted",
      entityType: "admin_role",
      entityId: args.roleId,
      summary: `نقش «${role.name}» حذف شد.`,
    });
    return { ok: true };
  },
});

/** Called by the login screen after a successful admin sign-in. */
export const recordAdminLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    if (!session.isSiteAdmin) return { ok: false };
    const now = Date.now();
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.login",
      entityType: "session",
      summary: `${session.user.name ?? session.user.phone ?? "مدیر"} وارد پنل مدیریت شد.`,
      metadata: JSON.stringify({ roles: session.adminRoles }),
    });
    await ctx.db.insert("admin_security_events", {
      actorId: session.user._id,
      action: "login_success",
      outcome: "success",
      createdAt: now,
    });
    const security = await ctx.db
      .query("admin_security")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (security) {
      await ctx.db.patch(security._id, { lastLoginAt: now, updatedAt: now });
    }
    return { ok: true };
  },
});
