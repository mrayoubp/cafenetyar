import { useState } from "react";
import { useAction, useQuery } from "@/backend/client";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { errorMessage } from "@/lib/auth";

export function ManagedAccountForm({roles}:{roles:{id:Id<"admin_roles">;key:string;name:string}[]}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState<"admin"|"customer">("admin");
 const [form,setForm]=useState({name:"",phone:"",password:"",roleId:"",cafeName:"",province:"تهران",city:"",address:""});
 const create=useAction(api.provisionAccounts.create);
 const capability=useQuery(api.managedAccounts.capabilities,{});
 const field=(key:keyof typeof form,label:string,type="text")=><label className="grid gap-2 text-sm" key={key}>{label}<Input required value={form[key]} type={type} autoComplete={type==="password"?"new-password":"off"} onChange={e=>setForm({...form,[key]:e.target.value})} /></label>;
 return <><Button onClick={()=>setOpen(true)} className="clay-primary">ساخت حساب جدید</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>ساخت حساب توسط صاحب سایت</DialogTitle><DialogDescription>دسترسی حساب جدید پس از تأیید مالکیت موبایل فعال می‌شود.</DialogDescription></DialogHeader>
 <form className="grid gap-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await create({...form,kind,roleId:kind==="admin"?form.roleId as Id<"admin_roles">:undefined});toast.success("حساب ساخته شد؛ رمز را از مسیر امن به صاحب حساب بدهید.");setForm({...form,name:"",phone:"",password:""});setOpen(false);}catch(err){toast.error(errorMessage(err,"ساخت حساب ممکن نشد."));}finally{setBusy(false);}}}>
 <label className="grid gap-2 text-sm">نوع حساب<select className="rounded-xl border border-border bg-background p-3" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="admin">ادمین با دسترسی محدود</option><option value="customer">کاربر کافی‌نت</option></select></label>
 {field("name","نام و نام خانوادگی")}{field("phone","شماره موبایل","tel")}{field("password","رمز اولیه امن","password")}
 {kind==="admin"?<label className="grid gap-2 text-sm">نقش مدیریتی<select required className="rounded-xl border border-border bg-background p-3" value={form.roleId} onChange={e=>setForm({...form,roleId:e.target.value})}><option value="">انتخاب نقش</option>{roles.filter(r=>r.key!=="super_admin").map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>:<>{field("cafeName","نام کافی‌نت")}{field("province","استان")}{field("city","شهر")}{field("address","نشانی")}</>}
 {!capability?.smsConfigured&&<p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm">سرویس پیامک هنوز متصل نیست. حساب ایجاد می‌شود، اما تأیید موبایل و دسترسی آن تا اتصال پیامک در انتظار می‌ماند.</p>}
 <Button type="submit" disabled={busy} className="clay-primary">{busy?"در حال ساخت حساب…":"تأیید و ساخت حساب"}</Button></form></DialogContent></Dialog></>;
}
