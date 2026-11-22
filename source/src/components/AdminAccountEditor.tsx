import { useState } from "react";
import { useQuery, useMutation } from "@/backend/client";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { faDateLong } from "@/lib/format";
import { errorMessage } from "@/lib/auth";
import { toast } from "sonner";

export function AdminAccountEditor({userId,onClose}:{userId:Id<"users">;onClose:()=>void}) {
 const data=useQuery(api.managedAccounts.adminDetails,{userId});
 const update=useMutation(api.managedAccounts.updateAdmin);
 const revoke=useMutation(api.managedAccounts.revokeAllSessions);
 const [name,setName]=useState<string|null>(null);
 const [permissions,setPermissions]=useState<string[]|null>(null);
 const [custom,setCustom]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false),[confirmRevoke,setConfirmRevoke]=useState(false);
 const useCustom=custom??(data?.permissionOverride!==null);
 const selected=permissions??data?.permissionOverride??data?.rolePermissions??[];
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>مشخصات و دسترسی حساب</DialogTitle><DialogDescription>شماره موبایلِ هویتی از این فرم قابل تغییر نیست. تغییر مجوزها فوراً روی سرور اعمال می‌شود.</DialogDescription></DialogHeader>
 {!data?<p role="status">در حال دریافت اطلاعات…</p>:<div className="space-y-5">
 <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm"><span>{data.name}</span><span dir="ltr">{data.phone}</span><span>{data.phoneVerified?"موبایل تأیید شده":"موبایل تأیید نشده"}</span><span>نشست‌های فعال: {data.activeSessions}</span><span>آخرین ورود: {data.lastLoginAt?faDateLong(data.lastLoginAt):"ثبت نشده"}</span><span>آخرین فعالیت: {data.lastActivityAt?faDateLong(data.lastActivityAt):"ثبت نشده"}</span><code className="break-all text-xs">{data.id}</code></div>
 {data.isAdmin&&!data.isOwner&&<form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await update({userId,name:name??data.name,permissionOverride:useCustom?selected:null});toast.success("مشخصات و مجوزها ذخیره شد.");onClose();}catch(err){toast.error(errorMessage(err,"ذخیره ممکن نشد."));}finally{setBusy(false);}}}>
 <label className="grid gap-2 text-sm">نام و نام خانوادگی<Input required value={name??data.name} onChange={e=>setName(e.target.value)} /></label>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useCustom} onChange={e=>setCustom(e.target.checked)} />مجوزهای اختصاصی برای این ادمین</label>
 <p className="text-sm text-muted-foreground">{useCustom?"فقط مجوزهای انتخاب‌شده اعمال می‌شوند؛ برداشتن همه گزینه‌ها تمام دسترسی‌های مدیریتی را می‌بندد.":"مجوزها از نقش‌های فعال این حساب گرفته می‌شوند."}</p>
 <div className="grid gap-3 sm:grid-cols-2">{data.catalog.map(p=><label className="flex items-start gap-2 text-sm" key={p.key}><input className="mt-1" type="checkbox" disabled={!useCustom} checked={(useCustom?selected:data.rolePermissions).includes(p.key)} onChange={e=>setPermissions(e.target.checked?[...selected,p.key]:selected.filter(k=>k!==p.key))} /><span>{p.label}</span></label>)}</div>
 <Button type="submit" disabled={busy} className="clay-primary">ذخیره مشخصات و دسترسی</Button></form>}
 {!data.isOwner&&<div className="space-y-3 border-t border-border pt-4">{confirmRevoke?<><p>همه دستگاه‌های این حساب خارج شوند؟ کاربر برای ادامه باید دوباره وارد شود.</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{await revoke({userId});toast.success("همه نشست‌ها لغو شدند.");setConfirmRevoke(false);}catch(err){toast.error(errorMessage(err,"خروج ناموفق بود."));}finally{setBusy(false);}}}>تأیید خروج از همه دستگاه‌ها</Button><Button variant="ghost" onClick={()=>setConfirmRevoke(false)}>انصراف</Button></>:<Button variant="outline" onClick={()=>setConfirmRevoke(true)}>خروج حساب از همه دستگاه‌ها</Button>}</div>}
 <section className="space-y-2"><h2 className="font-bold">آخرین فعالیت‌ها</h2>{!data.activity.length&&<p className="text-sm text-muted-foreground">فعالیتی ثبت نشده است.</p>}{data.activity.map(a=><div key={a.id} className="border-b border-border py-2 text-sm"><p>{a.summary}</p><time className="text-xs text-muted-foreground">{faDateLong(a.createdAt)}</time></div>)}</section>
 </div>}</DialogContent></Dialog>;
}
