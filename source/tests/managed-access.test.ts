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
