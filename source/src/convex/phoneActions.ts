"use node";
import { randomInt, randomBytes } from "node:crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { fail } from "./lib/validation";
import { codeHash } from "./lib/phoneCode";
export const send=action({args:{},handler:async ctx=>{
 const key=process.env.KAVENEGAR_API_KEY,template=process.env.KAVENEGAR_VERIFY_TEMPLATE;
 if(!key||!template)fail("not_configured","ارسال پیامک هنوز توسط صاحب سایت راه‌اندازی نشده است.");
 const code=String(randomInt(100000,1000000)),salt=randomBytes(24).toString("hex");
 const item=await ctx.runMutation(internal.phoneVerification.reserve,{hash:codeHash(salt,code),salt});
 try{
   const response=await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(key)}/verify/lookup.json`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({receptor:item.phone,token:code,template}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok||result?.return?.status!==200)throw new Error("delivery_failed");
 }catch{
   await ctx.runMutation(internal.phoneVerification.cancel,{challengeId:item.challengeId,salt});
   fail("delivery_failed","ارسال پیامک موفق نبود؛ یک دقیقه دیگر تلاش کنید.");
 }
 return {sent:true};
}});
export const verify=action({args:{code:v.string()},handler:async(ctx,args):Promise<{ok:boolean}>=>await ctx.runMutation(internal.phoneVerification.verify,args)});
