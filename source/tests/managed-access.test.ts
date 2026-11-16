import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import { codeHash } from "../src/convex/lib/phoneCode";
const modules=Object.fromEntries(Object.entries(import.meta.glob('../src/convex/**/*.ts')).map(([p,l])=>[p.replace('../src/convex/',''),l]));
test('ordinary users cannot reserve administrative accounts',async()=>{
 const t=convexTest(schema,modules);const id=await t.run(ctx=>ctx.db.insert('users',{name:'کاربر',phone:'09120000111'}));
 await expect(t.withIdentity({subject:id}).mutation(internal.managedAccounts.reserve,{phone:'09120000112',kind:'admin'})).rejects.toThrow();
});
test('owner APIs require MFA enrollment on server',async()=>{
 const t=convexTest(schema,modules);const id=await t.run(ctx=>ctx.db.insert('users',{name:'مالک',phone:'09120000111',role:'admin'}));
 await expect(t.withIdentity({subject:id}).query(api.admin.overview,{})).rejects.toThrow(/دومرحله/);
});
test('OTP attempts persist, lock after five failures, and cannot be replayed',async()=>{
 const t=convexTest(schema,modules);const id=await t.run(ctx=>ctx.db.insert('users',{name:'کاربر',phone:'09120000111',requiresPhoneVerification:true}));
 const c=t.withIdentity({subject:id});
 const row=await c.mutation(internal.phoneVerification.reserve,{hash:codeHash('test-salt','123456'),salt:'test-salt'});
 for(let i=0;i<5;i++)expect(await c.mutation(internal.phoneVerification.verify,{code:'000000'})).toEqual({ok:false});
 expect(await c.mutation(internal.phoneVerification.verify,{code:'123456'})).toEqual({ok:false});
 await t.run(ctx=>ctx.db.patch(row.challengeId,{attempts:0}));
 expect(await c.mutation(internal.phoneVerification.verify,{code:'123456'})).toEqual({ok:true});
 expect(await c.mutation(internal.phoneVerification.verify,{code:'123456'})).toEqual({ok:false});
});

async function ownerFixture() {
 const t=convexTest(schema,modules);const now=Date.now();
 const result=await t.run(async ctx=>{
  const owner=await ctx.db.insert('users',{name:'مالک اصلی',phone:'09120000331',role:'admin'});
  const user=await ctx.db.insert('users',{name:'مدیر پشتیبانی',phone:'09120000332'});
  const role=await ctx.db.insert('admin_roles',{key:'support',name:'پشتیبانی',description:'پشتیبانی',isSystem:false,isActive:true,createdAt:now,updatedAt:now});
  await ctx.db.insert('admin_user_roles',{userId:user,roleId:role,assignedBy:owner,assignedAt:now});
  await ctx.db.insert('admin_role_permissions',{roleId:role,permissionKey:'support.view',createdAt:now});
  const sid=await ctx.db.insert('authSessions',{userId:owner,expirationTime:now+3600000});
  await ctx.db.insert('admin_security',{userId:owner,totpSecret:'JBSWY3DPEHPK3PXP',mfaEnabled:true,createdAt:now,updatedAt:now});
  await ctx.db.insert('admin_mfa_sessions',{userId:owner,sessionId:sid,verifiedAt:now,expiresAt:now+1800000});
  return {owner,user,sid};
 });
 return {t,...result,client:t.withIdentity({subject:`${result.owner}|${result.sid}`})};
}
test('owner changes an individual permission set; denies propagate to server and audit snapshots',async()=>{
 const {t,user,client}=await ownerFixture();
 const admin=t.withIdentity({subject:user});
 await expect(admin.query(api.support.adminList,{})).resolves.toBeDefined();
 await client.mutation(api.managedAccounts.updateAdmin,{userId:user,name:'نام جدید مدیر',permissionOverride:[]});
 await expect(admin.query(api.support.adminList,{})).rejects.toThrow();
 const details=await client.query(api.managedAccounts.adminDetails,{userId:user});
 expect(details.name).toBe('نام جدید مدیر');expect(details.permissionOverride).toEqual([]);
 const logs=await t.run(ctx=>ctx.db.query('audit_logs').collect());
 expect(JSON.parse(logs.find(l=>l.action==='admin.profile_updated')!.metadata!).after.permissionOverride).toEqual([]);
 await client.mutation(api.managedAccounts.updateAdmin,{userId:user,name:'نام جدید مدیر',permissionOverride:null});
 await expect(admin.query(api.support.adminList,{})).resolves.toBeDefined();
});
test('delegated admin cannot alter itself or the owner even with all mapped permissions',async()=>{
 const {t,owner,user,client}=await ownerFixture();
 const details=await client.query(api.managedAccounts.adminDetails,{userId:user});
 await client.mutation(api.managedAccounts.updateAdmin,{userId:user,name:'مدیر کامل',permissionOverride:details.catalog.map(p=>p.key)});
 const admin=t.withIdentity({subject:user});
 await expect(admin.mutation(api.managedAccounts.updateAdmin,{userId:user,name:'تغییر غیرمجاز',permissionOverride:[]})).rejects.toThrow();
 await expect(admin.mutation(api.adminUsers.setBlocked,{userId:owner,blocked:true})).rejects.toThrow();
 await expect(client.mutation(api.managedAccounts.updateAdmin,{userId:owner,name:'مالک تغییر یافته',permissionOverride:[]})).rejects.toThrow();
});
test('revocation removes refresh tokens and rejects the old session immediately',async()=>{
 const {t,user,client}=await ownerFixture();
 const sid=await t.run(async ctx=>{
  const id=await ctx.db.insert('authSessions',{userId:user,expirationTime:Date.now()+3600000});
  await ctx.db.insert('authRefreshTokens',{sessionId:id,expirationTime:Date.now()+3600000});return id;
 });
 const admin=t.withIdentity({subject:`${user}|${sid}`});
 await expect(admin.query(api.support.adminList,{})).resolves.toBeDefined();
 expect(await client.mutation(api.managedAccounts.revokeAllSessions,{userId:user})).toEqual({count:1});
 await expect(admin.query(api.support.adminList,{})).rejects.toThrow();
 expect(await t.run(ctx=>ctx.db.query('authRefreshTokens').collect())).toEqual([]);
});

test('failed MFA disable attempts persist without disabling protection', async () => {
 const {t,client}=await ownerFixture();
 const result=await client.mutation(api.superAdmin.disableMfa,{code:'invalid'});
 expect(result.ok).toBe(false);
 const security=await t.run(ctx=>ctx.db.query('admin_security').first());
 expect(security?.mfaEnabled).toBe(true);
 const events=await t.run(ctx=>ctx.db.query('admin_security_events').collect());
 expect(events.some(e=>e.action==='mfa_disable_failed')).toBe(true);
});
