import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ensurePlatformDefaults, configuredAdminBootstrapPhone, logAudit } from "./lib/platform";
import { fail } from "./lib/validation";

/** Run via the authenticated Convex deployment CLI; never exposed as a public API. */
export const apply = internalMutation({args:{},handler:async ctx=>{
 await ensurePlatformDefaults(ctx);
 const settings=await ctx.db.query("platform_settings").withIndex("by_key",q=>q.eq("key","default")).first();
 if(settings)await ctx.db.patch(settings._id,{registrationEnabled:false,updatedAt:Date.now()});
 return {registrationEnabled:false};
}});
/** Explicit initial claim only. Existing ownership is never transferred by migration. */
export const claimVerifiedOwner = internalMutation({args:{userId:v.id("users")},handler:async(ctx,args)=>{
 const user=await ctx.db.get(args.userId);const phone=configuredAdminBootstrapPhone();
 if(!user||!phone||user.phone!==phone||!user.phoneVerificationTime||user.isBlocked)fail("forbidden","حساب و شماره تأییدشده با تنظیمات مالک مطابقت ندارد.");
 const owner=await ctx.db.query("users").withIndex("by_role",q=>q.eq("role","admin")).first();
 if(owner){if(owner._id===user._id)return {ok:true};fail("conflict","مالک موجود قابل جایگزینی از این مسیر نیست.");}
 await ctx.db.patch(user._id,{role:"admin"});
 await logAudit(ctx,{actorId:user._id,action:"admin.bootstrapped",entityType:"user",entityId:user._id,summary:"فعال‌سازی اولیه مالک از مسیر مدیریتی سرور"});
 return {ok:true};
}});
