import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faNumber } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RoleRow = {
  id: Id<"admin_roles">;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissionKeys: string[];
  memberCount: number;
  activeMemberCount: number;
};
type PermissionRow = {
  _id: string;
  key: string;
  label: string;
  description: string;
};

type Form = {
  roleId: Id<"admin_roles"> | null;
  name: string;
  description: string;
  permissionKeys: string[];
  isActive: boolean;
};

const EMPTY_FORM: Form = {
  roleId: null,
  name: "",
  description: "",
  permissionKeys: [],
  isActive: true,
};

export default function AdminRoles() {
  const { context } = useSession();
  const rolesQuery = useQuery(api.adminUsers.roles, {});
  const permissionsQuery = useQuery(api.adminUsers.permissionCatalog, {});
  const saveRole = useMutation(api.adminUsers.saveRole);
  const deleteRole = useMutation(api.adminUsers.deleteRole);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);

  const roles = (rolesQuery ?? []) as RoleRow[];
  const permissions = (permissionsQuery ?? []) as PermissionRow[];
  const isSuper = context?.isSuperAdmin === true;

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setForm({
      roleId: role.id,
      name: role.name,
      description: role.description,
      permissionKeys: role.permissionKeys,
      isActive: role.isActive,
    });
    setOpen(true);
  };

  const togglePermission = (key: string) => {
    setForm((previous) => ({
      ...previous,
      permissionKeys: previous.permissionKeys.includes(key)
        ? previous.permissionKeys.filter((item) => item !== key)
        : [...previous.permissionKeys, key],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("نام و توضیح نقش را کامل کنید.");
      return;
    }
    if (form.permissionKeys.length === 0) {
      toast.error("حداقل یک مجوز انتخاب کنید.");
      return;
    }
    setBusy(true);
    try {
      await saveRole({
        roleId: form.roleId ?? undefined,
        name: form.name,
        description: form.description,
        permissionKeys: form.permissionKeys,
        isActive: form.isActive,
      });
      toast.success(form.roleId ? "نقش به‌روزرسانی شد." : "نقش جدید ساخته شد.");
      setOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught, "ذخیره نقش ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteRole({ roleId: deleteTarget.id });
      toast.success("نقش حذف شد.");
      setDeleteTarget(null);
    } catch (caught) {
      toast.error(errorMessage(caught, "حذف نقش ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell active="roles">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">نقش‌ها و دسترسی‌ها</h1>
            <p className="mt-1 max-w-2xl text-[10.5px] leading-5 text-muted-foreground">
              هر نقش فقط به بخش‌های مجاز دسترسی دارد. تغییر مجوزها فوراً روی
              درخواست‌های سمت سرور اعمال می‌شود و در گزارش رویدادها ثبت می‌گردد.
            </p>
          </div>
          {isSuper && (
            <Button type="button" onClick={openCreate} className="clay-primary h-9 rounded-xl border-0 text-[10.5px] font-bold">
              <Plus className="size-4" />
              نقش جدید
            </Button>
          )}
        </div>

        {!isSuper && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10.5px] leading-5 text-amber-800 dark:text-amber-200">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            ویرایش نقش‌ها فقط برای مدیر اصلی پلتفرم فعال است. می‌توانید نقش‌های
            موجود و تعداد اعضای هر نقش را ببینید.
          </div>
        )}

        {rolesQuery === undefined ? (
          <div className="clay flex justify-center rounded-[28px] p-10"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <article key={role.id} className="clay flex flex-col rounded-[24px] p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    {role.isSystem ? <ShieldCheck className="size-4" /> : <UserCog className="size-4" />}
                  </span>
                  <div className="flex gap-1">
                    {role.isSystem && (
                      <Badge variant="secondary" className="rounded-full text-[8px]">سیستمی</Badge>
                    )}
                    {!role.isActive && (
                      <Badge variant="secondary" className="rounded-full text-[8px]">غیرفعال</Badge>
                    )}
                  </div>
                </div>
                <h2 className="mt-3 text-[13px] font-extrabold">{role.name}</h2>
                <p className="mt-1 min-h-10 text-[10px] leading-5 text-muted-foreground">{role.description}</p>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/35 px-3 py-2 text-[9.5px]">
                  <span>{faNumber(role.memberCount)} عضو</span>
                  <span className="text-muted-foreground">{faNumber(role.activeMemberCount)} فعال</span>
                </div>
                <p className="mt-2 text-[9px] text-muted-foreground">
                  {faNumber(role.permissionKeys.length)} مجوز فعال
                </p>
                {isSuper && (
                  <div className="mt-3 flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(role)} className="h-8 flex-1 rounded-lg text-[9px]">
                      <Pencil className="size-3.5" /> ویرایش
                    </Button>
                    {!role.isSystem && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(role)} className="h-8 rounded-lg text-[9px] text-rose-600 dark:text-rose-300">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="clay max-h-[88vh] w-[min(44rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">
              {form.roleId ? "ویرایش نقش" : "ساخت نقش مدیریتی"}
            </DialogTitle>
            <DialogDescription className="text-[10.5px] leading-5">
              مجوزها را انتخاب کنید؛ دسترسی‌ها در همان درخواست بعدی اعمال می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[10px]">نام نقش</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">وضعیت</Label>
              <SelectActive value={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-[10px]">توضیح نقش</Label>
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[10.5px]" />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">مجوزها</Label>
              <span className="text-[9px] text-muted-foreground">{faNumber(form.permissionKeys.length)} انتخاب‌شده</span>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {permissions.map((permission) => (
                <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-xl bg-muted/35 p-2.5">
                  <Checkbox
                    checked={form.permissionKeys.includes(permission.key)}
                    onCheckedChange={() => togglePermission(permission.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[9.5px] font-semibold">{permission.label}</span>
                    <span className="mt-0.5 block text-[8.5px] leading-4 text-muted-foreground">{permission.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleSave} disabled={busy} className="clay-primary h-10 flex-1 rounded-xl border-0 text-[11px] font-bold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              ذخیره نقش
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10 flex-1 rounded-xl text-[11px]">انصراف</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(value) => !value && setDeleteTarget(null)}>
        <DialogContent className="clay max-w-md rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">حذف نقش</DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              نقش «{deleteTarget?.name}» و تخصیص‌های آن حذف می‌شود. کاربران حذف
              نمی‌شوند. این عملیات در گزارش رویدادها ثبت می‌گردد.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleDelete} disabled={busy} className="h-10 flex-1 rounded-xl bg-destructive text-[11px] font-bold text-white">
              {busy && <Loader2 className="size-4 animate-spin" />}
              حذف نقش
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} className="h-10 flex-1 rounded-xl text-[11px]">انصراف</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function SelectActive({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex h-9 items-center gap-3 rounded-xl bg-muted/35 px-3 text-[10px]">
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={value} onChange={() => onChange(true)} />
        فعال
      </label>
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={!value} onChange={() => onChange(false)} />
        غیرفعال
      </label>
    </div>
  );
}
