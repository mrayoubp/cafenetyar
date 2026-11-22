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
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { ADMIN_PERMISSIONS } from "@/backend/adminPermissions";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { faDateLong, faNumber, faToman } from "@/lib/format";
import { useMutation, useQuery } from "@/backend/client";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Gift,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type PlanOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isTrial: boolean;
};

type CafeRow = {
  id: Id<"internet_cafes">;
  name: string;
  province: string;
  city: string;
  address: string;
  status: "active" | "suspended";
  createdAt: number;
  lastActivityAt: number;
  ownerName: string;
  ownerPhone: string | null;
  employeeCount: number;
  activeEmployeeCount: number;
  subscription: {
    planCode: string;
    planName: string;
    status: "trial" | "active" | "expired" | "canceled" | "pending_payment";
    endsAt: number;
    billingCycle: string | null;
  } | null;
};

const LABELS: Record<string, string> = {
  trial: "آزمایشی",
  active: "فعال",
  expired: "منقضی",
  canceled: "لغوشده",
  pending_payment: "در انتظار پرداخت",
};

const PAGE_SIZE = 10;

export default function AdminCafes() {
  const { context } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [subStatus, setSubStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<Id<"internet_cafes"> | null>(null);
  const [confirmCafe, setConfirmCafe] = useState<CafeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [planCode, setPlanCode] = useState("");
  const [subDays, setSubDays] = useState("30");
  const [subCycle, setSubCycle] = useState<"monthly" | "yearly">("monthly");

  const canManage = context?.isSuperAdmin ||
    context?.adminPermissions.includes(ADMIN_PERMISSIONS.CAFES_MANAGE);
  const canFinance = context?.isSuperAdmin ||
    context?.adminPermissions.includes(ADMIN_PERMISSIONS.FINANCE_MANAGE);
  const plansQuery = useQuery(
    api.billingAdmin.plans,
    canFinance ? {} : "skip",
  );
  const plans = (plansQuery ?? []) as PlanOption[];

  const rowsQuery = useQuery(api.admin.listCafes, {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    subscriptionStatus:
      subStatus === "all"
        ? undefined
        : (subStatus as "trial" | "active" | "expired" | "canceled" | "pending_payment"),
  });
  const rows = useMemo(() => (rowsQuery ?? []) as CafeRow[], [rowsQuery]);
  const detail = useQuery(
    api.admin.cafeDetails,
    detailId ? { cafeId: detailId } : "skip",
  );
  const recordAccess = useMutation(api.admin.recordCafeAccess);
  const setCafeStatus = useMutation(api.admin.setCafeStatus);
  const extendSubscription = useMutation(api.admin.extendSubscription);
  const grantTrial = useMutation(api.billingAdmin.grantTrial);
  const changeSubscription = useMutation(api.billingAdmin.changeSubscription);

  useEffect(() => {
    if (detailId) void recordAccess({ cafeId: detailId });
  }, [detailId, recordAccess]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const serverNow = context?.serverNow ?? 0;
  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      suspended: rows.filter((row) => row.status === "suspended").length,
      expiring: rows.filter(
        (row) =>
          row.subscription &&
          row.subscription.endsAt > serverNow &&
          row.subscription.endsAt <= serverNow + 7 * 86400000,
      ).length,
    }),
    [rows, serverNow],
  );

  const exportRows = () => {
    downloadCsv(
      "cafes.csv",
      ["شناسه", "نام", "استان", "شهر", "وضعیت", "مالک", "موبایل", "کارمندان", "پلن", "وضعیت اشتراک", "پایان اشتراک", "تاریخ ثبت"],
      rows.map((row) => [
        row.id,
        row.name,
        row.province,
        row.city,
        row.status === "active" ? "فعال" : "غیرفعال",
        row.ownerName,
        row.ownerPhone,
        row.employeeCount,
        row.subscription?.planName,
        row.subscription ? LABELS[row.subscription.status] : "بدون اشتراک",
        row.subscription ? faDateLong(row.subscription.endsAt) : "",
        faDateLong(row.createdAt),
      ]),
    );
  };

  const handleStatus = async () => {
    if (!confirmCafe) return;
    setBusy(true);
    try {
      await setCafeStatus({
        cafeId: confirmCafe.id,
        status: confirmCafe.status === "active" ? "suspended" : "active",
      });
      toast.success(
        confirmCafe.status === "active"
          ? "کافی‌نت غیرفعال شد."
          : "کافی‌نت فعال شد.",
      );
      setConfirmCafe(null);
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleTrial = async (cafeId: Id<"internet_cafes">) => {
    setBusy(true);
    try {
      await grantTrial({ cafeId, days: 14, allowReuse: true });
      toast.success("دوره آزمایشی ۱۴ روزه اعطا شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "اعطای دوره آزمایشی ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const openSubscription = () => {
    const activePlans = plans.filter((plan) => plan.isActive && !plan.isTrial);
    setPlanCode(detail?.subscription?.planCode ?? activePlans[0]?.code ?? "");
    setSubDays("30");
    setSubCycle("monthly");
    setSubOpen(true);
  };

  const handleChangeSubscription = async () => {
    if (!detail || !planCode) return;
    const days = Number(subDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast.error("مدت اشتراک معتبر نیست.");
      return;
    }
    setBusy(true);
    try {
      await changeSubscription({
        cafeId: detail.id,
        planCode,
        status: "active",
        days,
        billingCycle: subCycle,
      });
      toast.success("اشتراک کافی‌نت تغییر کرد.");
      setSubOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر اشتراک ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleExtend = async (cafeId: Id<"internet_cafes">) => {
    setBusy(true);
    try {
      await extendSubscription({ cafeId, days: 30 });
      toast.success("اشتراک ۳۰ روز تمدید شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تمدید اشتراک ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell active="cafes">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">مدیریت کافی‌نت‌ها</h1>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              فهرست کامل مشترکین، وضعیت حساب و دسترسی به اطلاعات پشتیبانی.
              مشاهده اطلاعات حساس در گزارش رویدادها ثبت می‌شود.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={exportRows}
            disabled={rows.length === 0}
            className="clay-sm h-9 rounded-xl border-0 text-[10.5px]"
          >
            <Download className="size-3.5" />
            خروجی CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Count label="کل کافی‌نت‌ها" value={counts.total} />
          <Count label="فعال" value={counts.active} tone="text-emerald-700 dark:text-emerald-300" />
          <Count label="غیرفعال" value={counts.suspended} tone="text-amber-700 dark:text-amber-300" />
          <Count label="نزدیک انقضا" value={counts.expiring} tone="text-rose-700 dark:text-rose-300" />
        </div>

        <section className="clay rounded-[26px] p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="جستجو بر اساس نام، شناسه، مالک، شهر یا وضعیت"
                className="clay-inset h-9 rounded-xl border-0 bg-transparent ps-9 text-[10.5px] shadow-none"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as typeof status);
                setPage(1);
              }}
            >
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-36">
                <SelectValue placeholder="وضعیت حساب" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="suspended">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={subStatus}
              onValueChange={(value) => {
                setSubStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] lg:w-40">
                <SelectValue placeholder="وضعیت اشتراک" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه اشتراک‌ها</SelectItem>
                {Object.entries(LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rowsQuery === undefined ? (
            <div className="flex justify-center p-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Store className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">کافی‌نتی پیدا نشد</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                فیلترها یا عبارت جستجو را تغییر دهید.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full text-start text-[10.5px]">
                  <thead>
                    <tr className="border-b border-border/50 text-[9px] text-muted-foreground">
                      <th className="px-2 py-2 text-start font-semibold">کافی‌نت</th>
                      <th className="px-2 py-2 text-start font-semibold">مالک</th>
                      <th className="px-2 py-2 text-start font-semibold">کارمندان</th>
                      <th className="px-2 py-2 text-start font-semibold">اشتراک</th>
                      <th className="px-2 py-2 text-start font-semibold">آخرین فعالیت</th>
                      <th className="px-2 py-2 text-end font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map((row) => (
                      <tr key={row.id} className="border-b border-border/30 last:border-0">
                        <td className="px-2 py-2.5">
                          <p className="font-bold">{row.name}</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">
                            {row.city}، {row.province} · ثبت {faDateLong(row.createdAt)}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p>{row.ownerName}</p>
                          <p dir="ltr" className="mt-0.5 text-[9px] text-muted-foreground">{row.ownerPhone}</p>
                        </td>
                        <td className="px-2 py-2.5">{faNumber(row.activeEmployeeCount)} / {faNumber(row.employeeCount)}</td>
                        <td className="px-2 py-2.5">
                          {row.subscription ? (
                            <div>
                              <p className="font-semibold">{row.subscription.planName}</p>
                              <Badge variant="secondary" className="mt-1 rounded-full text-[8.5px]">
                                {LABELS[row.subscription.status]}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">بدون اشتراک</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-[9px] text-muted-foreground">{faDateLong(row.lastActivityAt)}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="مشاهده جزئیات"
                              onClick={() => setDetailId(row.id)}
                              className="size-8 rounded-lg text-muted-foreground hover:text-primary"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            {canManage && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="تغییر وضعیت"
                                onClick={() => setConfirmCafe(row)}
                                className="size-8 rounded-lg text-muted-foreground hover:text-amber-600"
                              >
                                {row.status === "active" ? <ShieldAlert className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 space-y-2 md:hidden">
                {current.map((row) => (
                  <article key={row.id} className="clay-inset rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold">{row.name}</p>
                        <p className="mt-0.5 text-[9px] text-muted-foreground">{row.city}، {row.province} · {row.ownerName}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[8.5px]">
                        {row.status === "active" ? "فعال" : "غیرفعال"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{row.subscription ? `${row.subscription.planName} · ${LABELS[row.subscription.status]}` : "بدون اشتراک"}</span>
                      <span>{faNumber(row.activeEmployeeCount)} کارمند</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDetailId(row.id)} className="h-8 flex-1 rounded-lg text-[9px]">
                        جزئیات
                      </Button>
                      {canManage && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmCafe(row)} className="h-8 flex-1 rounded-lg text-[9px]">
                          {row.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">
                  {faNumber(rows.length)} کافی‌نت · صفحه {faNumber(page)} از {faNumber(pages)}
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

      <Dialog open={confirmCafe !== null} onOpenChange={(open) => !open && setConfirmCafe(null)}>
        <DialogContent className="clay max-w-md rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">
              {confirmCafe?.status === "active" ? "غیرفعال‌سازی" : "فعال‌سازی"} کافی‌نت
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              آیا از تغییر وضعیت «{confirmCafe?.name}» مطمئن هستید؟ این عملیات در گزارش رویدادها ثبت می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleStatus} disabled={busy} className="clay-primary h-10 flex-1 rounded-xl border-0 text-[11px] font-bold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              تأیید
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmCafe(null)} className="h-10 flex-1 rounded-xl text-[11px]">
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="clay max-h-[88vh] w-[min(48rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 p-5">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                {detail ? detail.name : "جزئیات کافی‌نت"}
              </DialogTitle>
              <DialogDescription className="text-[10.5px]">
                نمای پشتیبانی؛ هر بار مشاهده این صفحه در گزارش رویدادها ثبت می‌شود.
              </DialogDescription>
            </DialogHeader>
          </div>
          {!detail ? (
            <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label="مالک" value={`${detail.owner.name}${detail.owner.phone ? ` · ${detail.owner.phone}` : ""}`} />
                <Info label="وضعیت حساب" value={detail.status === "active" ? "فعال" : "غیرفعال"} />
                <Info label="نشانی" value={`${detail.city}، ${detail.province} · ${detail.address}`} />
                <Info label="تاریخ ثبت" value={faDateLong(detail.createdAt)} />
                <Info label="پلن" value={detail.subscription?.planName ?? "بدون اشتراک"} />
                <Info label="پایان اشتراک" value={detail.subscription ? faDateLong(detail.subscription.endsAt) : "—"} />
              </div>

              <div>
                <p className="mb-2 text-[10.5px] font-bold">کارمندان ({faNumber(detail.employees.length)})</p>
                {detail.employees.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground">کارمندی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.employees.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2 text-[10px]">
                        <span>{employee.name} <span className="text-muted-foreground">· {employee.roleTitle ?? "کارمند"}</span></span>
                        <Badge variant="secondary" className="rounded-full text-[8px]">{employee.active ? "فعال" : "غیرفعال"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[10.5px] font-bold">گزارش فعالیت اخیر</p>
                {detail.activity.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground">فعالیتی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.activity.slice(0, 10).map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-1.5 text-[9.5px]">
                        <span>{item.summary}</span>
                        <span className="shrink-0 text-muted-foreground">{faDateLong(item.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[10.5px] font-bold">آخرین فاکتورها</p>
                {detail.invoices.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground">فاکتوری ثبت نشده است.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.invoices.slice(0, 4).map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-1.5 text-[9.5px]">
                        <span dir="ltr">{invoice.number}</span>
                        <span>{faToman(invoice.totalToman)}</span>
                        <span className="text-muted-foreground">{faDateLong(invoice.issuedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {canFinance && (
                  <>
                    <Button type="button" size="sm" disabled={busy} onClick={() => handleExtend(detail.id)} className="clay-primary h-9 rounded-xl border-0 text-[10px]">
                      <CalendarClock className="size-3.5" /> تمدید ۳۰ روز
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => handleTrial(detail.id)} className="h-9 rounded-xl border border-border/60 text-[10px]">
                      <Gift className="size-3.5" /> دوره آزمایشی
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={openSubscription} className="h-9 rounded-xl border border-border/60 text-[10px]">
                      <RefreshCw className="size-3.5" /> تغییر اشتراک
                    </Button>
                  </>
                )}
                <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl text-[10px]">
                  <Link to="/admin/billing">مدیریت مالی و آزمایشی</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl text-[10px]">
                  <Link to="/admin/support">ثبت/بررسی تیکت پشتیبانی</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="clay max-w-md rounded-[28px] border-0">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-extrabold">تغییر اشتراک {detail?.name}</DialogTitle>
            <DialogDescription className="text-[10.5px] leading-5">
              پلن، مدت و دوره پرداخت را تعیین کنید. این عملیات مالی در گزارش
              رویدادها ثبت می‌شود و روی نرخ‌های اختصاصی کافی‌نت اثری ندارد.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold">پلن</p>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue placeholder="انتخاب پلن" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {plans.filter((plan) => plan.isActive && !plan.isTrial).map((plan) => (
                    <SelectItem key={plan.code} value={plan.code}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold">مدت (روز)</p>
                <Input dir="ltr" type="number" min={1} max={3650} value={subDays} onChange={(event) => setSubDays(event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold">دوره</p>
                <Select value={subCycle} onValueChange={(value) => setSubCycle(value as "monthly" | "yearly")}>
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="monthly">ماهانه</SelectItem>
                    <SelectItem value="yearly">سالانه</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleChangeSubscription} disabled={busy || !planCode} className="clay-primary h-10 flex-1 rounded-xl border-0 text-[11px] font-bold">
                {busy && <Loader2 className="size-4 animate-spin" />}
                اعمال اشتراک
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSubOpen(false)} className="h-10 flex-1 rounded-xl text-[11px]">انصراف</Button>
            </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/35 px-3 py-2">
      <p className="text-[8.5px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-5">{value}</p>
    </div>
  );
}
