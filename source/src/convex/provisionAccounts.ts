"use node";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireText, requirePhone, requirePassword, internalEmail, validateCafeInput } from "./lib/validation";
import type { Id } from "./_generated/dataModel";

export const create = action({
  args:{name:v.string(),phone:v.string(),password:v.string(),kind:v.union(v.literal("admin"),v.literal("customer")),roleId:v.optional(v.id("admin_roles")),cafeName:v.optional(v.string()),province:v.optional(v.string()),city:v.optional(v.string()),address:v.optional(v.string())},
  handler:async(ctx,args):Promise<{userId:Id<"users">}>=>{
    await ctx.runQuery(internal.managedAccounts.authorizeOwner,{});
    const name=requireText(args.name,"نام و نام خانوادگی",3,100), phone=requirePhone(args.phone), password=requirePassword(args.password);
    if(args.kind==="customer")validateCafeInput({name:args.cafeName??"",province:args.province??"",city:args.city??"",address:args.address??""});
    const invitationId:Id<"account_invitations">=await ctx.runMutation(internal.managedAccounts.reserve,{phone,kind:args.kind,roleId:args.roleId});
    try {
      const {user}=await createAccount(ctx,{provider:"password",account:{id:internalEmail(phone),secret:password},profile:{name,phone,email:internalEmail(phone),isBlocked:true,requiresPhoneVerification:true},shouldLinkViaEmail:false,shouldLinkViaPhone:false});
      return await ctx.runMutation(internal.managedAccounts.finish,{invitationId,userId:user._id,cafeName:args.cafeName,province:args.province,city:args.city,address:args.address});
    } catch(error){
      await ctx.runMutation(internal.managedAccounts.failInvitation,{invitationId});throw error;
    }
  }
});
