import { useEffect, useState, type ReactNode } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/auth";
export function PhoneVerificationGate({children}:{children:ReactNode}){
 const state=useQuery(api.phoneVerification.status,{});const send=useAction(api.phoneActions.send);const verify=useAction(api.phoneActions.verify);const log=useMutation(api.managedAccounts.recordSession);
 const {signOut}=useAuth();const [code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{if(state&&!state.required)void log().catch(()=>{});},[state?.required,log]);
 if(!state)return <p className="p-10 text-center">در حال بررسی حساب…</p>;
 if(!state.required)return children;
 return <main dir="rtl" className="mx-auto max-w-md space-y-5 px-5 py-16"><h1 className="text-2xl font-bold">تأیید شماره موبایل</h1><p>برای فعال‌شدن دسترسی حساب، کد ارسال‌شده به شماره ثبت‌شده را وارد کنید.</p>
 {!state.configured&&<p role="status" className="rounded-xl bg-amber-500/10 p-4">سرویس پیامک هنوز فعال نشده است. برای فعال‌سازی با صاحب سایت تماس بگیرید.</p>}
 <Button disabled={busy||!state.configured} onClick={async()=>{setBusy(true);try{await send({});setMessage("کد ارسال شد؛ تا ۵ دقیقه معتبر است.");}catch(e){setMessage(errorMessage(e,"ارسال ناموفق بود."));}finally{setBusy(false);}}}>ارسال کد تأیید</Button>
 <form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const result=await verify({code});if(!result.ok)setMessage("کد نادرست یا منقضی است.");}catch(e){setMessage(errorMessage(e,"تأیید ناموفق بود."));}finally{setBusy(false);}}}><label className="grid gap-2">کد شش‌رقمی<Input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" /></label><Button disabled={busy||!state.configured} type="submit" className="clay-primary">تأیید و ادامه</Button></form>
 <p role="status">{message}</p><Button variant="ghost" onClick={()=>void signOut()}>خروج از حساب</Button></main>;
}
