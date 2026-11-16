import { ManagedAccountForm } from "@/components/ManagedAccountForm";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ADMIN_PERMISSIONS } from "@/convex/lib/adminPermissions";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { faDateLong, faNumber } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Role = { id: Id<"admin_roles">; key: string; name: string; isSystem: boolean };
type UserRow = {
  id: Id<"users">;
  name: string;
  phone: string | null;
  email: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  isSuperAdmin: boolean;
  roles: {
    assignmentId: Id<"admin_user_roles">;
    roleId: Id<"admin_roles">;
    key: string;
    name: string;
  }[];
  cafe: {
    id: Id<"internet_cafes">;
    name: string;
    status: "active" | "suspended";
    membership: "owner" | "employee";
    employeeActive: boolean | null;
  } | null;
  lastLoginAt: number | null;
  createdAt: number;
};
type ListData = {
  items: UserRow[];
  total: number;
  counts: {
    total: number;
    owners: number;
    employees: number;
    blocked: number;
    adminTeam: number;
  };
  roles: Role[];
};

const PAGE_SIZE = 12;

export default function AdminUsers() {
  const { context } = useSession();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [blockedFilter, setBlockedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [busy, setBusy] = useState(false);

  const data = useQuery(api.adminUsers.list, {
    search: search.trim() || undefined,
    roleKey: roleFilter === "all" ? undefined : roleFilter,
    onlyBlocked: blockedFilter === "blocked" ? true : undefined,
  }) as ListData | undefined;
  const setBlocked = useMutation(api.adminUsers.setBlocked);
  const assignRole = useMutation(api.adminUsers.assignRole);
  const removeRole = useMutation(api.adminUsers.removeRole);

  const canManage =
    context?.isSuperAdmin ||
    context?.adminPermissions.includes(ADMIN_PERMISSIONS.USERS_MANAGE);
  const canAssignRole = context?.isPlatformOwner ?? false;

  const pages = Math.max(1, Math.ceil((data?.items.length ?? 0) / PAGE_SIZE));
  const rows = useMemo(
    () => (data?.items ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data?.items, page],
  );

  const exportRows = () => {
    if (!data) return;
    downloadCsv(
      "users.csv",
      ["نام", "موبایل", "ایمیل", "کافی‌نت", "نقش کافی‌نت", "نقش مدیریتی", "وضعیت", "آخرین ورود", "تاریخ عضویت"],
      data.items.map((row) => [
        row.name,
        row.phone,
        row.email,
        row.cafe?.name,
        row.cafe?.membership === "owner" ? "صاحب کافی‌نت" : row.cafe ? "کارمند" : "",
        row.roles.map((role) => role.name).join(" / "),
        row.isBlocked ? "مسدود" : "فعال",
        row.lastLoginAt ? faDateLong(row.lastLoginAt) : "",
        faDateLong(row.createdAt),
      ]),
    );
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    setBusy(true);
    try {
      await setBlocked({
        userId: blockTarget.id,
        blocked: !blockTarget.isBlocked,
        reason: blockTarget.isBlocked ? undefined : blockReason.trim() || undefined,
      });
      toast.success(blockTarget.isBlocked ? "حساب رفع مسدودی شد." : "حساب مسدود شد.");
      setBlockTarget(null);
      setBlockReason("");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت حساب ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!roleTarget || !selectedRole) return;
    setBusy(true);
    try {
      await assignRole({
        userId: roleTarget.id,
        roleId: selectedRole as Id<"admin_roles">,
      });
      toast.success("نقش مدیریتی تخصیص داده شد.");
      setRoleTarget(null);
      setSelectedRole("");
    } catch (caught) {
      toast.error(errorMessage(caught, "تخصیص نقش ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: Id<"users">, roleId: Id<"admin_roles">) => {
    setBusy(true);
    try {
      await removeRole({ userId, roleId });
      toast.success("نقش مدیریتی حذف شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "حذف نقش ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell active="users">
      <div className="space-y-4">
        {context?.isPlatformOwner && import.meta.env.VITE_MANAGED_ACCOUNTS === "true" && <ManagedAccountForm roles={data?.roles ?? []} />} 
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">کاربران و کارمندان</h1>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              جستجو در حساب‌های واقعی، مشاهده کافی‌نت وابسته، آخرین ورود و نقش
              مدیریتی. تغییر وضعیت و نقش در گزارش رویدادها ثبت می‌شود.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={exportRows}
            disabled={!data || data.items.length === 0}
            className="clay-sm h-9 rounded-xl border-0 text-[10.5px]"
          >
            <Download className="size-3.5" />
            خروجی CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Count label="کل کاربران" value={data?.counts.total ?? 0} />
          <Count label="صاحبان کافی‌نت" value={data?.counts.owners ?? 0} />
          <Count label="کارمندان" value={data?.counts.employees ?? 0} />
          <Count label="تیم مدیریت" value={data?.counts.adminTeam ?? 0} />
          <Count label="مسدود" value={data?.counts.blocked ?? 0} tone="text-rose-700 dark:text-rose-300" />
        </div>

        <section className="clay rounded-[26px] p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="جستجوی نام، موبایل، کافی‌نت یا نقش"
                className="clay-inset h-9 rounded-xl border-0 bg-transparent ps-9 text-[10.5px] shadow-none"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-44">
                <SelectValue placeholder="نقش مدیریتی" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه نقش‌ها</SelectItem>
                {(data?.roles ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.key}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={blockedFilter}
              onValueChange={(value) => {
                setBlockedFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه حساب‌ها</SelectItem>
                <SelectItem value="blocked">فقط مسدودها</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data === undefined ? (
            <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">کاربری پیدا نشد</p>
              <p className="mt-1 text-[10px] text-muted-foreground">عبارت جستجو یا فیلتر را تغییر دهید.</p>
            </div>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {rows.map((row) => (
                  <article key={row.id} className="clay-inset flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Users className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[11px] font-bold">{row.name}</p>
                          {row.isSuperAdmin && (
                            <Badge variant="secondary" className="rounded-full text-[8px]">مدیر اصلی</Badge>
                          )}
                          {row.roles.map((role) => (
                            <Badge key={role.assignmentId} variant="secondary" className="rounded-full text-[8px]">{role.name}</Badge>
                          ))}
                          {row.isBlocked && (
                            <Badge variant="secondary" className="rounded-full bg-rose-500/10 text-[8px] text-rose-700 dark:text-rose-300">مسدود</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {row.cafe ? `${row.cafe.name} · ${row.cafe.membership === "owner" ? "صاحب کافی‌نت" : "کارمند"}` : "بدون کافی‌نت"}
                          {" · "}
                          {row.lastLoginAt ? `آخرین ورود ${faDateLong(row.lastLoginAt)}` : "ورودی ثبت نشده"}
                        </p>
                        <p dir="ltr" className="mt-0.5 text-[9px] text-muted-foreground">
                          {row.phone ?? row.email ?? "—"}
                        </p>
                        {row.blockedReason && (
                          <p className="mt-1 text-[9px] text-rose-600 dark:text-rose-300">دلیل مسدودی: {row.blockedReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {canAssignRole && (
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRoleTarget(row)} className="h-8 rounded-lg text-[9px]">
                          <UserCog className="size-3.5" /> نقش مدیریتی
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy || row.isSuperAdmin}
                          onClick={() => {
                            setBlockTarget(row);
                            setBlockReason(row.blockedReason ?? "");
                          }}
                          className={row.isBlocked ? "h-8 rounded-lg text-[9px] text-emerald-700 dark:text-emerald-300" : "h-8 rounded-lg text-[9px] text-rose-700 dark:text-rose-300"}
                        >
                          {row.isBlocked ? <ShieldCheck className="size-3.5" /> : <Ban className="size-3.5" />}
                          {row.isBlocked ? "رفع مسدودی" : "مسدودسازی"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">
                  {faNumber(data.items.length)} حساب · صفحه {faNumber(page)} از {faNumber(pages)}
                </p>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="size-8 rounded-lg">
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="size-8 rounded-lg">
                    <ChevronLeft className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={blockTarget !== null} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <DialogContent className="clay max-w-md rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">
              {blockTarget?.isBlocked ? "رفع مسدودی حساب" : "مسدودسازی حساب"}
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              {blockTarget?.isBlocked
                ? "دسترسی این حساب دوباره فعال می‌شود."
                : `دسترسی «${blockTarget?.name}» به پلتفرم و پنل کافی‌نت مسدود می‌شود. این عملیات ثبت رویداد می‌شود.`}
            </DialogDescription>
          </DialogHeader>
          {!blockTarget?.isBlocked && (
            <Textarea
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="دلیل مسدودسازی (اختیاری، برای گزارش داخلی)"
              className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[10.5px]"
            />
          )}
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleBlock} disabled={busy} className="clay-primary h-10 flex-1 rounded-xl border-0 text-[11px] font-bold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              تأیید
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBlockTarget(null)} className="h-10 flex-1 rounded-xl text-[11px]">انصراف</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent className="clay max-w-md rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">نقش‌های مدیریتی {roleTarget?.name}</DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              نقش‌های فعلی را ببینید یا نقش جدید تخصیص دهید. فقط مدیر اصلی می‌تواند این کار را انجام دهد.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-1.5">
            {roleTarget?.roles.length === 0 && (
              <p className="rounded-xl bg-muted/40 p-2.5 text-[10px] text-muted-foreground">این حساب عضو تیم مدیریت نیست.</p>
            )}
            {roleTarget?.roles.map((role) => (
              <div key={role.assignmentId} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[10px]">
                <span>{role.name}</span>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => roleTarget && handleRemove(roleTarget.id, role.roleId)} className="h-7 rounded-lg text-[9px] text-rose-600">
                  حذف
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]">
                <SelectValue placeholder="انتخاب نقش جدید" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(data?.roles ?? []).filter((role) => !roleTarget?.roles.some((current) => current.key === role.key)).map((role) => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAssign} disabled={busy || !selectedRole} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              تخصیص نقش
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="clay rounded-[20px] p-3">
      <p className="text-[9.5px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone ?? ""}`}>{faNumber(value)}</p>
    </div>
  );
}
