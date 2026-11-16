import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePlatformOwner, requireSession, getSession } from "./lib/access";
import { ensurePlatformDefaults, logAudit } from "./lib/platform";
import { requirePhone, fail, validateCafeInput } from "./lib/validation";
import { SUPER_ADMIN_ROLE_KEY } from "./lib/adminPermissions";
import { createWorkspace } from "./tenancy";
import { getAuthSessionId } from "@convex-dev/auth/server";

export const authorizeOwner = internalQuery({ args: {}, handler: async ctx => {
  const session = await requirePlatformOwner(ctx);
  return { userId: session.user._id };
}});
export const reserve = internalMutation({
  args: { phone: v.string(), kind: v.union(v.literal("admin"), v.literal("customer")), roleId: v.optional(v.id("admin_roles")) },
  handler: async (ctx, args) => {
    const owner = await requirePlatformOwner(ctx);
    const phone = requirePhone(args.phone);
    if (await ctx.db.query("users").withIndex("by_phone", q => q.eq("phone", phone)).first()) fail("conflict", "این شماره قبلاً ثبت شده است.");
    const old = await ctx.db.query("account_invitations").withIndex("by_phone", q => q.eq("phone", phone)).first();
    if (old && old.status !== "failed") fail("conflict", "درخواست ساخت حساب برای این شماره وجود دارد.");
    if (args.kind === "admin") {
      const role = args.roleId ? await ctx.db.get(args.roleId) : null;
      if (!role?.isActive || role.key === SUPER_ADMIN_ROLE_KEY) fail("validation", "یک نقش محدود و فعال انتخاب کنید.");
    }
    await ensurePlatformDefaults(ctx);
    return await ctx.db.insert("account_invitations", { ...args, phone, actorId: owner.user._id, status: "pending", createdAt: Date.now() });
  },
});
export const finish = internalMutation({
  args: { invitationId: v.id("account_invitations"), userId: v.id("users"), cafeName: v.optional(v.string()), province: v.optional(v.string()), city: v.optional(v.string()), address: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requirePlatformOwner(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    const user = await ctx.db.get(args.userId);
    if (!invitation || invitation.status !== "pending" || invitation.actorId !== owner.user._id || !user || user.phone !== invitation.phone) fail("forbidden", "درخواست معتبر نیست.");
    if (invitation.kind === "admin") {
      const role = invitation.roleId ? await ctx.db.get(invitation.roleId) : null;
      if (!role?.isActive || role.key === SUPER_ADMIN_ROLE_KEY) fail("forbidden", "نقش انتخابی دیگر معتبر نیست.");
      await ctx.db.insert("admin_user_roles", { userId: user._id, roleId: role._id, assignedBy: owner.user._id, assignedAt: Date.now() });
    } else {
      const input = validateCafeInput({name: args.cafeName ?? "", province: args.province ?? "", city: args.city ?? "", address: args.address ?? ""});
      await createWorkspace(ctx, {ownerId: user._id, ...input});
    }
    await ctx.db.patch(user._id, { isBlocked: false, requiresPhoneVerification: true });
    await ctx.db.patch(invitation._id, {status: "complete", userId: user._id});
    await logAudit(ctx, {actorId: owner.user._id, action: "account.provisioned", entityType: "user", entityId: user._id, summary: `ساخت حساب ${invitation.kind === "admin" ? "ادمین" : "کافی‌نت"} برای ${user.name}`, metadata: JSON.stringify({kind: invitation.kind, roleId: invitation.roleId, phoneVerified: false})});
    return {userId: user._id};
  },
});
export const failInvitation = internalMutation({args: {invitationId: v.id("account_invitations")}, handler: async (ctx, args) => {
  const item = await ctx.db.get(args.invitationId);
  if (item?.status === "pending") {
    await ctx.db.patch(item._id, {status: "failed"});
    await logAudit(ctx, {actorId: item.actorId, action: "account.provision_failed", entityType: "user", summary: "ساخت حساب کامل نشد؛ حساب ناقص فعال نشده است."});
  }
}});
export const capabilities = query({args:{}, handler: async ctx => {
  await requirePlatformOwner(ctx);
  return {smsConfigured: Boolean(process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_VERIFY_TEMPLATE), publicRegistration: false};
}});
export const revokeAllSessions = mutation({args:{userId:v.optional(v.id("users"))}, handler:async(ctx,args)=>{
  const session=await requireSession(ctx);
  const target=args.userId??session.user._id;
  if(target!==session.user._id) await requirePlatformOwner(ctx);
  const user=await ctx.db.get(target);
  if(!user)fail("not_found","حساب پیدا نشد.");
  if(user.role==="admin" && target!==session.user._id)fail("forbidden","نشست مالک قابل تغییر نیست.");
  await ctx.db.patch(target,{sessionsRevokedAt:Date.now()});
  const sessions=await ctx.db.query("authSessions").withIndex("userId",q=>q.eq("userId",target)).collect();
  for(const row of sessions){
    for(const token of await ctx.db.query("authRefreshTokens").withIndex("sessionId",q=>q.eq("sessionId",row._id)).collect())await ctx.db.delete(token._id);
    for(const proof of await ctx.db.query("admin_mfa_sessions").withIndex("by_session",q=>q.eq("sessionId",row._id)).collect())await ctx.db.delete(proof._id);
    await ctx.db.delete(row._id);
  }
  await logAudit(ctx,{actorId:session.user._id,action:"account.sessions_revoked",entityType:"user",entityId:target,summary:"خروج از همه دستگاه‌ها"});
  return {count:sessions.length};
}});
export const recordSession = mutation({args:{},handler:async ctx=>{
  const session=await getSession(ctx); const id=await getAuthSessionId(ctx);
  if(!session || !id || session.isBlocked || (session.user.requiresPhoneVerification && !session.user.phoneVerificationTime))return;
  const row=await ctx.db.get(id);if(!row)return;
  const recent=await ctx.db.query("audit_logs").withIndex("by_actor_created",q=>q.eq("actorId",session.user._id).gte("createdAt",row._creationTime)).collect();
  if(recent.some(x=>x.action==="account.login"&&x.entityId===id))return;
  await logAudit(ctx,{actorId:session.user._id,action:"account.login",entityType:"session",entityId:id,summary:"ورود به حساب با نشست معتبر",metadata:JSON.stringify({phoneVerified:Boolean(session.user.phoneVerificationTime)})});
}});
