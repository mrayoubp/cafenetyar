import { getAuthUserId, getAuthSessionId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  isPermissionKey,
  type PermissionKey,
} from "../permissions";
import { ROLES } from "../schema";
import {
  ALL_ADMIN_PERMISSIONS,
  isAdminPermission,
  type AdminPermission,
} from "./adminPermissions";
import { assertPlatformOwnerMfa, platformMfaState } from "./adminMfa";
import { fail } from "./validation";

type DbCtx = QueryCtx | MutationCtx;

export type SessionContext = {
  user: Doc<"users">;
  isSiteAdmin: boolean;
  isSuperAdmin: boolean;
  /** True only for the single bootstrap account with users.role === "admin". */
  isPlatformOwner: boolean;
  isBlocked: boolean;
  adminRoles: string[];
  adminPermissions: AdminPermission[];
  isGuest: boolean;
  cafe: Doc<"internet_cafes"> | null;
  employee: Doc<"employees"> | null;
  isOwner: boolean;
  membershipActive: boolean;
  permissions: PermissionKey[];
  needsSetup: boolean;
};

const GUEST_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.ACCOUNTING_VIEW,
];

/**
 * Resolves the signed-in user and the tenant they belong to. The tenant is
 * always derived from the session, never from client-supplied IDs.
 */
export async function getSession(ctx: DbCtx): Promise<SessionContext | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await getSessionForUser(ctx, userId);
}

/** Same resolution as {@link getSession}, for actions that already know the user. */
export async function getSessionForUser(
  ctx: DbCtx,
  userId: Doc<"users">["_id"],
): Promise<SessionContext | null> {
  const user = await ctx.db.get(userId);
  if (user === null) return null;

  const isBlocked = user.isBlocked === true;
  const adminAssignments = await ctx.db
    .query("admin_user_roles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const assignedRoles = [];
  for (const assignment of adminAssignments) {
    const role = await ctx.db.get(assignment.roleId);
    if (role?.isActive) assignedRoles.push(role);
  }
  const isPlatformOwner = user.role === ROLES.ADMIN && !isBlocked;
  const isSuperAdmin =
    isPlatformOwner;
  const isSiteAdmin = isSuperAdmin || assignedRoles.length > 0;
  let adminPermissions: AdminPermission[] = isSuperAdmin
    ? [...ALL_ADMIN_PERMISSIONS]
    : [];
  if (!isSuperAdmin && assignedRoles.length > 0) {
    const collected = new Set<string>();
    for (const role of assignedRoles) {
      const permissions = await ctx.db
        .query("admin_role_permissions")
        .withIndex("by_role", (q) => q.eq("roleId", role._id))
        .collect();
      for (const permission of permissions) {
        if (isAdminPermission(permission.permissionKey)) {
          collected.add(permission.permissionKey);
        }
      }
    }
    adminPermissions = [...collected] as AdminPermission[];
  }
  const isGuest = user.isAnonymous === true;

  if (isGuest) {
    return {
      user,
      isSiteAdmin: false,
      isSuperAdmin: false,
      isPlatformOwner: false,
      isBlocked,
      adminRoles: [],
      adminPermissions: [],
      isGuest: true,
      cafe: null,
      employee: null,
      isOwner: false,
      membershipActive: false,
      permissions: GUEST_PERMISSIONS,
      needsSetup: false,
    };
  }

  const owned = await ctx.db
    .query("internet_cafes")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .first();

  if (owned) {
    return {
      user,
      isSiteAdmin,
      isSuperAdmin,
      isPlatformOwner,
      isBlocked,
      adminRoles: assignedRoles.map((role) => role.key),
      adminPermissions,
      isGuest: false,
      cafe: owned,
      employee: null,
      isOwner: true,
      membershipActive: true,
      permissions: ALL_PERMISSIONS,
      needsSetup: false,
    };
  }

  const employee = await ctx.db
    .query("employees")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (employee) {
    const cafe = await ctx.db.get(employee.cafeId);
    return {
      user,
      isSiteAdmin,
      isSuperAdmin,
      isPlatformOwner,
      isBlocked,
      adminRoles: assignedRoles.map((role) => role.key),
      adminPermissions,
      isGuest: false,
      cafe,
      employee,
      isOwner: false,
      membershipActive: employee.active,
      permissions: employee.active
        ? employee.permissions.filter(isPermissionKey)
        : [],
      needsSetup: false,
    };
  }

  return {
    user,
    isSiteAdmin,
    isSuperAdmin,
    isPlatformOwner,
    isBlocked,
    adminRoles: assignedRoles.map((role) => role.key),
    adminPermissions,
    isGuest: false,
    cafe: null,
    employee: null,
    isOwner: false,
    membershipActive: false,
    permissions: [],
    needsSetup: !isSiteAdmin,
  };
}

export async function requireSession(ctx: DbCtx): Promise<SessionContext> {
  const session = await getSession(ctx);
  if (!session) {
    fail("unauthenticated", "برای ادامه باید وارد حساب کاربری شوید.");
  }
  if (session.user.sessionsRevokedAt) {
    const id = await getAuthSessionId(ctx);
    if (!id || !await ctx.db.get(id)) fail("unauthenticated", "این نشست لغو شده است؛ دوباره وارد شوید.");
  }
  if (session.isBlocked) {
    fail(
      "forbidden",
      "این حساب توسط مدیر پلتفرم مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.",
    );
  }
  if (session.user.requiresPhoneVerification && !session.user.phoneVerificationTime) {
    fail("phone_verification_required", "ابتدا شماره موبایل حساب را تأیید کنید.");
  }
  return session;
}

/** Ensures the caller belongs to a cafe and holds the given permission. */
export async function requirePermission(
  ctx: DbCtx,
  permission: PermissionKey,
): Promise<SessionContext & { cafe: Doc<"internet_cafes"> }> {
  const session = await requireSession(ctx);
  if (!session.cafe || !session.membershipActive) {
    fail("forbidden", "حساب شما به هیچ کافی‌نتی متصل نیست.");
  }
  if (!session.permissions.includes(permission)) {
    fail("forbidden", "برای این بخش دسترسی ندارید.");
  }
  return session as SessionContext & { cafe: Doc<"internet_cafes"> };
}

/** Only the owner of the cafe may change cafe settings and subscriptions view. */
export async function requireOwner(
  ctx: DbCtx,
): Promise<SessionContext & { cafe: Doc<"internet_cafes"> }> {
  const session = await requireSession(ctx);
  if (!session.isOwner || !session.cafe) {
    fail("forbidden", "این بخش فقط برای صاحب کافی‌نت در دسترس است.");
  }
  return session as SessionContext & { cafe: Doc<"internet_cafes"> };
}

export async function requireSiteAdmin(
  ctx: DbCtx,
): Promise<SessionContext> {
  const session = await requireSession(ctx);
  if (!session.isPlatformOwner) {
    fail("forbidden", "این عملیات فقط برای مدیر اصلی کافی‌نت‌یار مجاز است.");
  }
  return await requirePlatformOwner(ctx);
}

/** Resolves the single platform owner without requiring a current 2FA proof. */
export async function requirePlatformOwnerBase(
  ctx: DbCtx,
): Promise<SessionContext> {
  const session = await requireSession(ctx);
  if (!session.isPlatformOwner) {
    fail("forbidden", "این بخش فقط برای حساب مالک اصلی کافی‌نت‌یار در دسترس است.");
  }
  return session;
}

/**
 * Owner-only access for sensitive platform controls. The owner console is
 * never available before authenticator enrollment, and every request still
 * needs a fresh proof for the current login session.
 */
export async function requirePlatformOwner(
  ctx: DbCtx,
): Promise<SessionContext> {
  const session = await requirePlatformOwnerBase(ctx);
  const state = await platformMfaState(ctx, session.user._id);
  if (!state.enabled) {
    fail(
      "mfa_required",
      "برای استفاده از کنسول مالک، ابتدا احراز هویت دومرحله‌ای را فعال کنید.",
    );
  }
  await assertPlatformOwnerMfa(ctx, session);
  return session;
}

/** Role-aware check used by every admin surface. Super admins bypass the map. */
export async function requireAdminPermission(
  ctx: DbCtx,
  permission: AdminPermission,
): Promise<SessionContext> {
  const session = await requireSession(ctx);
  if (!session.isSiteAdmin) {
    fail("forbidden", "این بخش فقط برای تیم مدیریت پلتفرم در دسترس است.");
  }
  if (session.isSuperAdmin) {
    await assertPlatformOwnerMfa(ctx, session);
    return session;
  }
  if (!session.adminPermissions.includes(permission)) {
    fail("forbidden", "نقش مدیریتی شما به این بخش دسترسی ندارد.");
  }
  return session;
}

export function assertCafeActive(cafe: Doc<"internet_cafes">) {
  if (cafe.status !== "active") {
    fail(
      "suspended",
      "حساب این کافی‌نت توسط مدیر اصلی غیرفعال شده است. برای پیگیری با پشتیبانی تماس بگیرید.",
    );
  }
}
