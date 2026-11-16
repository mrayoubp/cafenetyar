import { getAuthSessionId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./validation";

export const MFA_SESSION_TTL_MS = 30 * 60 * 1000;

type DbCtx = QueryCtx | MutationCtx;

export type PlatformMfaState = {
  enabled: boolean;
  enabledAt: number | null;
  lastLoginAt: number | null;
  lastMfaAt: number | null;
  sessionId: Id<"authSessions"> | null;
  verified: boolean;
  verificationExpiresAt: number | null;
};

export async function platformMfaState(
  ctx: DbCtx,
  userId: Id<"users">,
): Promise<PlatformMfaState> {
  const security = await ctx.db
    .query("admin_security")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const sessionId = await getAuthSessionId(ctx);
  let verified = false;
  let verificationExpiresAt: number | null = null;
  if (sessionId) {
    const proof = await ctx.db
      .query("admin_mfa_sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (proof && proof.userId === userId && proof.expiresAt > Date.now()) {
      verified = true;
      verificationExpiresAt = proof.expiresAt;
    }
  }
  return {
    enabled: security?.mfaEnabled === true,
    enabledAt: security?.enabledAt ?? null,
    lastLoginAt: security?.lastLoginAt ?? null,
    lastMfaAt: security?.lastMfaAt ?? null,
    sessionId: sessionId ?? null,
    verified,
    verificationExpiresAt,
  };
}

/**
 * All admin APIs call this after resolving the session. Only the platform
 * owner is challenged; delegated team roles keep their existing permission
 * model. A successful proof is scoped to one login session and expires.
 */
export async function assertPlatformOwnerMfa(
  ctx: DbCtx,
  session: { user: Doc<"users">; isPlatformOwner: boolean },
): Promise<void> {
  if (!session.isPlatformOwner) return;
  const state = await platformMfaState(ctx, session.user._id);
  if (!state.enabled) fail("mfa_required", "ابتدا ورود دومرحله‌ای مالک را فعال کنید.");
  if (!state.sessionId) {
    fail("unauthorized", "نشست ورود معتبر نیست. دوباره وارد شوید.");
  }
  if (!state.verified) {
    fail(
      "mfa_required",
      "برای ادامه، کد تأیید دومرحله‌ای حساب مالک را وارد کنید.",
    );
  }
}

export async function recentMfaFailures(
  ctx: DbCtx,
  userId: Id<"users">,
): Promise<number> {
  const since = Date.now() - 10 * 60 * 1000;
  const rows = await ctx.db
    .query("admin_security_events")
    .withIndex("by_actor_created", (q) =>
      q.eq("actorId", userId).gte("createdAt", since),
    )
    .collect();
  return rows.filter(
    (row) => ["mfa_failed", "mfa_setup_failed", "mfa_disable_failed"].includes(row.action) && row.outcome === "failure",
  ).length;
}
