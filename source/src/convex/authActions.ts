"use node";

import {
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertCanGrant, sanitizePermissions } from "./lib/permissions";
import {
  fail,
  internalEmail,
  requirePassword,
  requirePhone,
  requireText,
  validateRegistration,
} from "./lib/validation";
import { PERMISSIONS, type PermissionKey } from "./permissions";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  const bytes = randomBytes(12);
  let raw = "";
  for (const byte of bytes) {
    raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(salt: string, code: string): string {
  return createHash("sha256")
    .update(`${salt}:${normalizeCode(code)}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function newRecoveryRecord(code: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, codeHash: hashRecoveryCode(salt, code) };
}

const MISSING_RESET_MESSAGE =
  "اطلاعات بازیابی درست نیست. شماره موبایل و کد بازیابی را بررسی کنید.";

type AccessSnapshot = {
  userId: Id<"users">;
  name: string | null;
  phone: string | null;
  isOwner: boolean;
  isSiteAdmin: boolean;
  isGuest: boolean;
  membershipActive: boolean;
  cafeId: Id<"internet_cafes"> | null;
  cafeStatus: "active" | "suspended" | null;
  permissions: PermissionKey[];
};

/**
 * Creates the real owner account (Scrypt-hashed password) plus the cafe,
 * trial subscription and the one-time recovery code.
 */
export const registerOwner = action({
  args: {
    fullName: v.string(),
    phone: v.string(),
    password: v.string(),
    confirmPassword: v.string(),
    cafeName: v.string(),
    province: v.string(),
    city: v.string(),
    address: v.string(),
    acceptedTerms: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ recoveryCode: string }> => {
    await ctx.runQuery(internal.managedAccounts.authorizeOwner, {});
    const input = validateRegistration(args);

    const existing = await ctx.runQuery(internal.tenancy.findByPhone, {
      phone: input.phone,
    });
    if (existing.user || existing.employee) {
      fail(
        "conflict",
        "این شماره موبایل قبلاً ثبت شده است. وارد شوید یا رمز عبور را بازیابی کنید.",
      );
    }

    const recoveryCode = generateRecoveryCode();
    const { salt, codeHash } = newRecoveryRecord(recoveryCode);

    let createdUserId: Id<"users">;
    try {
      const created = await createAccount(ctx, {
        provider: "password",
        account: {
          id: internalEmail(input.phone),
          secret: input.password,
        },
        profile: {
          email: internalEmail(input.phone),
          name: input.fullName,
          phone: input.phone,
          requiresPhoneVerification: true,
        },
      });
      if (!created.user) {
        fail("server", "ساخت حساب کاربری کامل نشد. دوباره تلاش کنید.");
      }
      createdUserId = created.user._id;
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      fail(
        "conflict",
        "ساخت حساب ممکن نشد؛ ممکن است این شماره قبلاً ثبت شده باشد.",
      );
    }

    try {
      await ctx.runMutation(internal.tenancy.bootstrapOwner, {
        ownerId: createdUserId,
        name: input.cafeName,
        province: input.province,
        city: input.city,
        address: input.address,
        recoveryHash: codeHash,
        recoverySalt: salt,
        phone: input.phone,
      });
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      fail(
        "server",
        "حساب ساخته شد اما ثبت کافی‌نت کامل نشد. وارد شوید و از صفحه تکمیل حساب ادامه دهید.",
      );
    }

    return { recoveryCode };
  },
});

/** Owner (or a manager with employees.manage) creates a real employee login. */
export const createEmployee = action({
  args: {
    fullName: v.string(),
    phone: v.string(),
    password: v.string(),
    confirmPassword: v.string(),
    roleTitle: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ employeeId: Id<"employees">; recoveryCode: string }> => {
    await ctx.runQuery(internal.managedAccounts.authorizeOwner, {});
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای این کار باید وارد شوید.");

    const snapshot: AccessSnapshot | null = await ctx.runQuery(
      internal.tenancy.permissionSnapshot,
      { userId },
    );
    if (!snapshot || snapshot.isGuest) {
      fail("forbidden", "حساب مهمان نمی‌تواند کارمند اضافه کند.");
    }
    if (!snapshot.cafeId || !snapshot.membershipActive) {
      fail("forbidden", "حساب شما به کافی‌نت فعالی متصل نیست.");
    }
    if (snapshot.cafeStatus !== "active") {
      fail("suspended", "حساب این کافی‌نت غیرفعال است.");
    }
    if (
      !snapshot.isOwner &&
      !snapshot.permissions.includes(PERMISSIONS.EMPLOYEES_MANAGE)
    ) {
      fail("forbidden", "برای افزودن کارمند دسترسی ندارید.");
    }

    const fullName = requireText(args.fullName, "نام کارمند", 2, 60);
    const phone = requirePhone(args.phone);
    const password = requirePassword(args.password);
    if (args.password !== args.confirmPassword) {
      fail("validation", "رمز عبور و تکرار آن یکسان نیستند.");
    }
    const roleTitle = args.roleTitle?.trim()
      ? requireText(args.roleTitle, "عنوان شغلی", 2, 40)
      : undefined;
    const permissions = sanitizePermissions(args.permissions);
    assertCanGrant(
      snapshot.permissions,
      permissions,
      snapshot.isOwner,
    );

    const existing = await ctx.runQuery(internal.tenancy.findByPhone, {
      phone,
    });
    if (existing.user) {
      fail(
        "conflict",
        "این شماره موبایل قبلاً حساب کاربری دارد و نمی‌تواند کارمند جدید شود.",
      );
    }
    if (existing.employee) {
      fail("conflict", "این شماره موبایل قبلاً برای کارمند دیگری ثبت شده است.");
    }

    const recoveryCode = generateRecoveryCode();
    const { salt, codeHash } = newRecoveryRecord(recoveryCode);

    let employeeUserId: Id<"users">;
    try {
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: internalEmail(phone), secret: password },
        profile: { email: internalEmail(phone), name: fullName, phone },
      });
      if (!created.user) {
        fail("server", "ساخت حساب کارمند کامل نشد. دوباره تلاش کنید.");
      }
      employeeUserId = created.user._id;
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      fail("conflict", "ساخت حساب کارمند ممکن نشد؛ شماره را بررسی کنید.");
    }

    try {
      const result: { employeeId: Id<"employees"> } = await ctx.runMutation(
        internal.employees.createRecord,
        {
          actorId: userId,
          cafeId: snapshot.cafeId,
          userId: employeeUserId,
          fullName,
          phone,
          roleTitle,
          permissions,
          recoveryHash: codeHash,
          recoverySalt: salt,
        },
      );
      return { employeeId: result.employeeId, recoveryCode };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      fail(
        "server",
        "حساب ساخته شد اما ثبت کارمند کامل نشد. با پشتیبانی تماس بگیرید.",
      );
    }
  },
});

/** Changes the password of the signed-in account after verifying the old one. */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    confirmPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای این کار باید وارد شوید.");
    const snapshot: AccessSnapshot | null = await ctx.runQuery(
      internal.tenancy.permissionSnapshot,
      { userId },
    );
    if (!snapshot?.phone) {
      fail("forbidden", "این حساب شماره موبایل ثبت‌شده ندارد.");
    }
    if (args.newPassword !== args.confirmPassword) {
      fail("validation", "رمز عبور جدید و تکرار آن یکسان نیستند.");
    }
    const newPassword = requirePassword(args.newPassword, "رمز عبور جدید");
    if (newPassword === args.currentPassword) {
      fail("validation", "رمز عبور جدید باید با رمز فعلی متفاوت باشد.");
    }

    const accountId = internalEmail(snapshot.phone);
    try {
      const result = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: accountId, secret: args.currentPassword },
      });
      if (!result || result.user._id !== userId) {
        fail("invalid", "رمز عبور فعلی درست نیست.");
      }
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      fail("invalid", "رمز عبور فعلی درست نیست.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: accountId, secret: newPassword },
    });

    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      except: sessionId ? [sessionId] : undefined,
    });

    return { ok: true };
  },
});

/**
 * Password reset with the one-time recovery code. The code is verified
 * server-side against a salted hash, all sessions are revoked and a fresh
 * recovery code is issued.
 */
export const resetPasswordWithRecovery = action({
  args: {
    phone: v.string(),
    recoveryCode: v.string(),
    newPassword: v.string(),
    confirmPassword: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ recoveryCode: string }> => {
    const phone = requirePhone(args.phone);
    if (args.newPassword !== args.confirmPassword) {
      fail("validation", "رمز عبور جدید و تکرار آن یکسان نیستند.");
    }
    const newPassword = requirePassword(args.newPassword, "رمز عبور جدید");

    const found = await ctx.runQuery(internal.tenancy.findByPhone, { phone });
    if (!found.user || found.user.isAnonymous) {
      fail("invalid_recovery", MISSING_RESET_MESSAGE);
    }
    const userId = found.user.id;

    const record = await ctx.runMutation(internal.recovery.beginReset, {
      userId,
      phone,
    });
    if (!safeEqualHex(hashRecoveryCode(record.salt, args.recoveryCode), record.codeHash)) {
      fail("invalid_recovery", MISSING_RESET_MESSAGE);
    }

    try {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: internalEmail(phone), secret: newPassword },
      });
    } catch {
      fail(
        "server",
        "تغییر رمز عبور ممکن نشد. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.",
      );
    }

    await invalidateSessions(ctx, { userId });

    const recoveryCode = generateRecoveryCode();
    const { salt, codeHash } = newRecoveryRecord(recoveryCode);
    await ctx.runMutation(internal.recovery.finishReset, {
      userId,
      phone,
      codeHash,
      salt,
    });

    return { recoveryCode };
  },
});

/** Issues a new recovery code for the signed-in user. */
export const regenerateRecoveryCode = action({
  args: {},
  handler: async (ctx): Promise<{ recoveryCode: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای این کار باید وارد شوید.");
    const snapshot: AccessSnapshot | null = await ctx.runQuery(
      internal.tenancy.permissionSnapshot,
      { userId },
    );
    if (!snapshot || snapshot.isGuest) {
      fail("forbidden", "حساب مهمان کد بازیابی ندارد.");
    }
    if (!snapshot.phone) {
      fail("forbidden", "این حساب شماره موبایل ثبت‌شده ندارد.");
    }

    const recoveryCode = generateRecoveryCode();
    const { salt, codeHash } = newRecoveryRecord(recoveryCode);
    await ctx.runMutation(internal.recovery.replaceCode, {
      userId,
      phone: snapshot.phone,
      codeHash,
      salt,
    });
    return { recoveryCode };
  },
});
