import { getAuthSessionId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  MFA_SESSION_TTL_MS,
  platformMfaState,
  recentMfaFailures,
} from "./lib/adminMfa";
import {
  getSession,
  requirePlatformOwner,
  requirePlatformOwnerBase,
  requireSession,
} from "./lib/access";
import { PLATFORM_SETTINGS_KEY, logAudit } from "./lib/platform";
import { generateTotpSecret, totpUri, verifyTotp } from "./lib/totp";
import { fail, maskPhone, normalizePhone } from "./lib/validation";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 100;

async function securityEvent(
  ctx: MutationCtx,
  args: {
    actorId?: Id<"users">;
    identifierMasked?: string;
    action: string;
    outcome: "success" | "failure" | "blocked";
    detail?: string;
  },
) {
  await ctx.db.insert("admin_security_events", {
    ...args,
    createdAt: Date.now(),
  });
}

async function assertMfaAttemptAllowed(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  if ((await recentMfaFailures(ctx, userId)) >= 5) {
    fail(
      "rate_limited",
      "تعداد تلاش‌های نادرست زیاد است. ۱۰ دقیقه دیگر دوباره تلاش کنید.",
    );
  }
}

async function recordMfaFailure(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: string,
) {
  await securityEvent(ctx, {
    actorId: userId,
    action,
    outcome: "failure",
    detail: "کد تأیید دومرحله‌ای نادرست بود.",
  });
}

/**
 * Public, unauthenticated telemetry for a failed password login. It never
 * reveals whether the phone number exists and stores only a masked number.
 * The global rate limit prevents the endpoint from being used to fill the
 * database with junk rows.
 */
export const recordLoginFailure = mutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const since = Date.now() - LOGIN_FAILURE_WINDOW_MS;
    const recent = await ctx.db
      .query("admin_security_events")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .take(LOGIN_FAILURE_LIMIT + 1);
    if (recent.length > LOGIN_FAILURE_LIMIT) return { ok: true };
    const phone = normalizePhone(args.phone);
    const user = phone
      ? await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phone", phone))
          .first()
      : null;
    await securityEvent(ctx, {
      actorId: user?._id,
      identifierMasked: phone ? maskPhone(phone) : "شناسه نامعتبر",
      action: "login_failed",
      outcome: "failure",
      detail: "ورود با رمز عبور ناموفق بود.",
    });
    return { ok: true };
  },
});

/** Safe state used by the 2FA challenge and the owner console. */
export const securityStatus = query({
  args: {},
  handler: async (ctx) => {
    const session = await getSession(ctx);
    if (!session || !session.isPlatformOwner) {
      return {
        isPlatformOwner: false,
        mfaEnabled: false,
        verified: false,
        verificationExpiresAt: null,
        enabledAt: null,
        lastLoginAt: null,
        lastMfaAt: null,
      };
    }
    const state = await platformMfaState(ctx, session.user._id);
    return {
      isPlatformOwner: true,
      mfaEnabled: state.enabled,
      verified: state.verified,
      verificationExpiresAt: state.verificationExpiresAt,
      enabledAt: state.enabledAt,
      lastLoginAt: state.lastLoginAt,
      lastMfaAt: state.lastMfaAt,
    };
  },
});

/** Starts (or restarts) enrollment. The secret is returned only at this point. */
export const beginMfaSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwnerBase(ctx);
    const existing = await ctx.db
      .query("admin_security")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (existing?.mfaEnabled) {
      fail("validation", "احراز هویت دومرحله‌ای از قبل فعال است.");
    }
    const secret = generateTotpSecret();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        totpSecret: secret,
        mfaEnabled: false,
        enabledAt: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("admin_security", {
        userId: session.user._id,
        totpSecret: secret,
        mfaEnabled: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "mfa_setup_started",
      outcome: "success",
    });
    const account = session.user.phone ?? session.user.name ?? "platform-owner";
    return { secret, uri: totpUri(secret, account) };
  },
});

export const confirmMfaSetup = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwnerBase(ctx);
    await assertMfaAttemptAllowed(ctx, session.user._id);
    const security = await ctx.db
      .query("admin_security")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (!security || security.mfaEnabled) {
      fail("validation", "درخواست فعال‌سازی معتبر نیست. دوباره شروع کنید.");
    }
    if (!verifyTotp(security.totpSecret, args.code)) {
      await recordMfaFailure(ctx, session.user._id, "mfa_setup_failed");
      return { ok: false, mfaEnabled: false };
    }
    const now = Date.now();
    await ctx.db.patch(security._id, {
      mfaEnabled: true,
      enabledAt: now,
      lastMfaAt: now,
      updatedAt: now,
    });
    const sessionId = await getAuthSessionId(ctx);
    if (sessionId) {
      const proof = await ctx.db
        .query("admin_mfa_sessions")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .first();
      if (proof) {
        await ctx.db.patch(proof._id, {
          verifiedAt: now,
          expiresAt: now + MFA_SESSION_TTL_MS,
        });
      } else {
        await ctx.db.insert("admin_mfa_sessions", {
          sessionId,
          userId: session.user._id,
          verifiedAt: now,
          expiresAt: now + MFA_SESSION_TTL_MS,
        });
      }
    }
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "mfa_enabled",
      outcome: "success",
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.mfa_enabled",
      entityType: "admin_security",
      entityId: security._id,
      summary: "احراز هویت دومرحله‌ای حساب مالک فعال شد.",
    });
    return { ok: true };
  },
});

export const verifyMfa = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwnerBase(ctx);
    const security = await ctx.db
      .query("admin_security")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (!security?.mfaEnabled) return { ok: true, mfaEnabled: false };
    await assertMfaAttemptAllowed(ctx, session.user._id);
    if (!verifyTotp(security.totpSecret, args.code)) {
      await recordMfaFailure(ctx, session.user._id, "mfa_failed");
      return { ok: false, mfaEnabled: true };
    }
    const sessionId = await getAuthSessionId(ctx);
    if (!sessionId) {
      fail("unauthorized", "نشست ورود معتبر نیست. دوباره وارد شوید.");
    }
    const now = Date.now();
    const proof = await ctx.db
      .query("admin_mfa_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (proof) {
      await ctx.db.patch(proof._id, {
        verifiedAt: now,
        expiresAt: now + MFA_SESSION_TTL_MS,
      });
    } else {
      await ctx.db.insert("admin_mfa_sessions", {
        sessionId,
        userId: session.user._id,
        verifiedAt: now,
        expiresAt: now + MFA_SESSION_TTL_MS,
      });
    }
    await ctx.db.patch(security._id, { lastMfaAt: now, updatedAt: now });
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "mfa_verified",
      outcome: "success",
    });
    return { ok: true, mfaEnabled: true };
  },
});

/** Disabling the second factor also requires a fresh authenticator code. */
export const disableMfa = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwnerBase(ctx);
    const security = await ctx.db
      .query("admin_security")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .first();
    if (!security?.mfaEnabled) return { ok: true };
    await assertMfaAttemptAllowed(ctx, session.user._id);
    if (!verifyTotp(security.totpSecret, args.code)) {
      await recordMfaFailure(ctx, session.user._id, "mfa_disable_failed");
      return { ok: false, message: "کد تأیید نادرست است." };
    }
    await ctx.db.patch(security._id, {
      mfaEnabled: false,
      enabledAt: undefined,
      updatedAt: Date.now(),
    });
    const proofs = await ctx.db
      .query("admin_mfa_sessions")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    for (const proof of proofs) await ctx.db.delete(proof._id);
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "mfa_disabled",
      outcome: "success",
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.mfa_disabled",
      entityType: "admin_security",
      entityId: security._id,
      summary: "احراز هویت دومرحله‌ای حساب مالک غیرفعال شد.",
    });
    return { ok: true };
  },
});

/** All active and expired sessions for the owner account. */
export const sessions = query({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwner(ctx);
    const currentId = await getAuthSessionId(ctx);
    const rows = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", session.user._id))
      .collect();
    const now = Date.now();
    const proofRows = await ctx.db
      .query("admin_mfa_sessions")
      .withIndex("by_user", (q) => q.eq("userId", session.user._id))
      .collect();
    const proofBySession = new Map(
      proofRows.map((row) => [row.sessionId, row] as const),
    );
    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((row) => {
        const proof = proofBySession.get(row._id);
        return {
          id: row._id,
          createdAt: row._creationTime,
          expiresAt: row.expirationTime,
          expired: row.expirationTime <= now,
          current: row._id === currentId,
          mfaVerified: Boolean(proof && proof.expiresAt > now),
          mfaExpiresAt: proof?.expiresAt ?? null,
        };
      });
  },
});

export const revokeSession = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const currentId = await getAuthSessionId(ctx);
    if (currentId === args.sessionId) {
      fail(
        "validation",
        "نشست فعلی از همین صفحه قابل لغو نیست؛ برای آن از دکمه خروج استفاده کنید.",
      );
    }
    const target = await ctx.db.get(args.sessionId);
    if (!target || target.userId !== session.user._id) {
      fail("not_found", "نشست موردنظر پیدا نشد.");
    }
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    const proofs = await ctx.db
      .query("admin_mfa_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const proof of proofs) await ctx.db.delete(proof._id);
    await ctx.db.delete(args.sessionId);
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "session_revoked",
      outcome: "success",
      detail: `نشست ${args.sessionId.slice(0, 10)} لغو شد.`,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "admin.session_revoked",
      entityType: "session",
      entityId: args.sessionId,
      summary: "یک نشست ورود مدیر اصلی لغو شد.",
    });
    return { ok: true };
  },
});

export const activity = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const rows = await ctx.db
      .query("admin_security_events")
      .withIndex("by_created")
      .order("desc")
      .take(80);
    const actorIds = [
      ...new Set(
        rows
          .map((row) => row.actorId)
          .filter((id): id is Id<"users"> => Boolean(id)),
      ),
    ];
    const actors = await Promise.all(
      actorIds.map(async (id) => [id, await ctx.db.get(id)] as const),
    );
    const actorById = new Map(actors);
    return rows.map((row) => {
      const actor = row.actorId ? actorById.get(row.actorId) : null;
      return {
        id: row._id,
        action: row.action,
        outcome: row.outcome,
        detail: row.detail ?? null,
        identifierMasked: row.identifierMasked ?? null,
        actorName: actor?.name ?? actor?.phone ?? null,
        createdAt: row.createdAt,
      };
    });
  },
});

/** Called by the shell before signOut so logouts are in the security trail. */
export const recordAdminLogout = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    if (!session.isSiteAdmin) return { ok: false };
    await securityEvent(ctx, {
      actorId: session.user._id,
      action: "logout",
      outcome: "success",
    });
    return { ok: true };
  },
});

/** Latest platform settings snapshots, including the current row. */
export const settingsHistory = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const settings = await ctx.db
      .query("platform_settings")
      .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
      .first();
    const rows = await ctx.db
      .query("platform_settings_history")
      .withIndex("by_created")
      .order("desc")
      .take(20);
    const actorIds = [...new Set(rows.map((row) => row.actorId))];
    const actors = await Promise.all(
      actorIds.map(async (id) => [id, await ctx.db.get(id)] as const),
    );
    const actorById = new Map(actors);
    return {
      currentUpdatedAt: settings?.updatedAt ?? null,
      rows: rows.map((row) => ({
        id: row._id,
        actorName:
          actorById.get(row.actorId)?.name ??
          actorById.get(row.actorId)?.phone ??
          "مدیر",
        note: row.note ?? null,
        createdAt: row.createdAt,
      })),
    };
  },
});

/** Restores a settings snapshot. The current state is snapshotted first. */
export const restoreSettings = mutation({
  args: { historyId: v.id("platform_settings_history") },
  handler: async (ctx, args) => {
    const session = await requirePlatformOwner(ctx);
    const snapshot = await ctx.db.get(args.historyId);
    if (!snapshot) fail("not_found", "نسخه تنظیمات پیدا نشد.");
    const settings = await ctx.db.get(snapshot.settingsId);
    if (!settings) fail("not_found", "تنظیمات فعلی پیدا نشد.");
    const parsed = JSON.parse(snapshot.snapshot) as Record<string, unknown>;
    const now = Date.now();
    await ctx.db.insert("platform_settings_history", {
      settingsId: settings._id,
      actorId: session.user._id,
      snapshot: JSON.stringify(settings),
      note: "پیش از بازگردانی خودکار",
      createdAt: now,
    });
    const allowed = [
      "platformName",
      "tagline",
      "logoUrl",
      "supportEmail",
      "supportPhone",
      "supportAddress",
      "instagramUrl",
      "telegramUrl",
      "whatsappUrl",
      "websiteUrl",
      "timezone",
      "locale",
      "defaultTheme",
      "registrationEnabled",
      "notificationsEnabled",
      "maintenanceMode",
      "maintenanceMessage",
      "aiEnabled",
      "aiModel",
      "aiCostPerRequestToman",
      "backupSchedule",
      "backupNote",
    ] as const;
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const key of allowed) {
      if (key in parsed) patch[key] = parsed[key];
    }
    // Delivery providers are intentionally not restored as enabled because
    // no email/SMS provider is connected in this deployment.
    patch.emailNotificationsEnabled = false;
    patch.smsNotificationsEnabled = false;
    await ctx.db.patch(settings._id, patch);
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "settings.restored",
      entityType: "platform_settings",
      entityId: settings._id,
      summary: "تنظیمات پلتفرم به یک نسخه قبلی بازگردانده شد.",
      metadata: JSON.stringify({ historyId: args.historyId, ...patch }),
    });
    return { ok: true };
  },
});

/** Owner-facing summary for the console cards. */
export const securitySummary = query({
  args: {},
  handler: async (ctx) => {
    const session = await requirePlatformOwner(ctx);
    const state = await platformMfaState(ctx, session.user._id);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("admin_security_events")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .take(500);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", session.user._id))
      .collect();
    const activeSessions = sessions.filter(
      (row) => row.expirationTime > Date.now(),
    ).length;
    return {
      mfaEnabled: state.enabled,
      mfaVerified: state.verified,
      activeSessions,
      failedLogins24h: events.filter(
        (row) => row.action === "login_failed" && row.outcome === "failure",
      ).length,
      failedMfa24h: events.filter(
        (row) => row.action === "mfa_failed" && row.outcome === "failure",
      ).length,
      recentEvents: events.slice(0, 12).map((row) => ({
        id: row._id,
        action: row.action,
        outcome: row.outcome,
        identifierMasked: row.identifierMasked ?? null,
        createdAt: row.createdAt,
      })),
    };
  },
});
