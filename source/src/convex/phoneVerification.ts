import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import { fail } from "./lib/validation";
import { logAudit } from "./lib/platform";
import { codeHash } from "./lib/phoneCode";
export const status=query({args:{},handler:async ctx=>{
 const id=await getAuthUserId(ctx);const user=id?await ctx.db.get(id):null;
 return {required:Boolean(user?.requiresPhoneVerification&&!user.phoneVerificationTime),configured:Boolean(process.env.KAVENEGAR_API_KEY&&process.env.KAVENEGAR_VERIFY_TEMPLATE)};
}});
export const reserve=internalMutation({args:{hash:v.string(),salt:v.string()},handler:async(ctx,args)=>{
 const id=await getAuthUserId(ctx);const user=id?await ctx.db.get(id):null;
 if(!user?.phone||user.isBlocked)fail("unauthorized","حساب معتبر نیست.");
 if(user.phoneVerificationTime)fail("validation","شماره قبلاً تأیید شده است.");
 const now=Date.now();const old=await ctx.db.query("phone_challenges").withIndex("by_user",q=>q.eq("userId",user._id)).first();
 if(old&&now-old.sentAt<60000)fail("rate_limited","برای ارسال مجدد یک دقیقه صبر کنید.");
 const sameWindow=old&&now-old.windowStartedAt<3600000;
 if(sameWindow&&old.sends>=5)fail("rate_limited","سقف ارسال ساعتی پر شده است؛ بعداً تلاش کنید.");
 const data={userId:user._id,...args,expiresAt:now+300000,attempts:0,sentAt:now,windowStartedAt:sameWindow?old.windowStartedAt:now,sends:sameWindow?old.sends+1:1,consumed:false};
 const challengeId=old?(await ctx.db.patch(old._id,data),old._id):await ctx.db.insert("phone_challenges",data);
 return {phone:user.phone,challengeId};
}});
export const cancel=internalMutation({args:{challengeId:v.id("phone_challenges"),salt:v.string()},handler:async(ctx,args)=>{
 const row=await ctx.db.get(args.challengeId);if(row?.salt===args.salt)await ctx.db.patch(row._id,{consumed:true});
}});
// Return failed attempts instead of throwing: throwing would roll back the attempt counter.
export const verify=internalMutation({args:{code:v.string()},handler:async(ctx,args)=>{
 const id=await getAuthUserId(ctx);const user=id?await ctx.db.get(id):null;
 if(!user||user.isBlocked)fail("unauthorized","حساب معتبر نیست.");
 const row=await ctx.db.query("phone_challenges").withIndex("by_user",q=>q.eq("userId",user._id)).first();
 if(!row||row.consumed||row.expiresAt<Date.now()||row.attempts>=5)return {ok:false};
 const ok=/^\d{6}$/.test(args.code)&&codeHash(row.salt,args.code)===row.hash;
 await ctx.db.patch(row._id,{attempts:row.attempts+1,consumed:ok});
 if(ok)await ctx.db.patch(user._id,{phoneVerificationTime:Date.now()});
 await ctx.db.insert("admin_security_events",{actorId:user._id,action:"phone_verification",outcome:ok?"success":"failure",createdAt:Date.now()});
 if(ok)await logAudit(ctx,{actorId:user._id,action:"account.phone_verified",entityType:"user",entityId:user._id,summary:"مالکیت شماره موبایل با پیامک تأیید شد."});
 return {ok};
}});
