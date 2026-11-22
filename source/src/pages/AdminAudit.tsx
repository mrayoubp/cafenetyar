import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/backend/api";
import { downloadCsv } from "@/lib/csv";
import { faDateLong, faNumber } from "@/lib/format";
import { useQuery } from "@/backend/client";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  LockKeyhole,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

const PAGE_SIZE = 20;

type LogRow = {
  id: string;
  actorName: string;
  actorPhone: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  cafeName: string | null;
  summary: string;
  metadata: string | null;
  createdAt: number;
};

const ACTION_LABELS: Record<string, string> = {
  "admin.login": "ورود مدیر",
  "admin.bootstrapped": "فعال‌سازی مدیر اصلی",
  "admin.role_assigned": "تخصیص نقش",
  "admin.role_removed": "حذف نقش",
  "admin.role_created": "ایجاد نقش",
  "admin.role_updated": "ویرایش نقش",
  "admin.role_deleted": "حذف نقش",
  "user.blocked": "مسدودسازی کاربر",
  "user.unblocked": "رفع مسدودی",
  "settings.updated": "تغییر تنظیمات",
  "notification.created": "ایجاد اعلان",
  "notification.toggled": "تغییر وضعیت اعلان",
  "cafe.status_changed": "تغییر وضعیت کافی‌نت",
  "cafe.sensitive_view": "مشاهده اطلاعات حساس",
  "subscription.changed": "تغییر اشتراک",
  "subscription.extended": "تمدید اشتراک",
  "plans.seeded": "همگام‌سازی پلن‌ها",
  "support.replied": "پاسخ پشتیبانی",
  "support.note_added": "یادداشت پشتیبانی",
  "support.status_changed": "تغییر وضعیت تیکت",
  "support.priority_changed": "تغییر اولویت تیکت",
  "support.category_changed": "تغییر دسته تیکت",
  "support.viewed": "مشاهده مکالمه پشتیبانی",
  "news.created": "ثبت خبر",
  "news.updated": "ویرایش خبر",
  "news.status_changed": "تغییر وضعیت خبر",
  "news.deleted": "حذف خبر",
  "website.created": "افزودن سامانه",
  "website.updated": "ویرایش سامانه",
  "website.status_changed": "وضعیت سامانه",
  "website.deleted": "حذف سامانه",
  "website.suggestion_approved": "تأیید پیشنهاد سامانه",
  "website.suggestion_rejected": "رد پیشنهاد سامانه",
  "knowledge.document_created": "ایجاد سند دانش",
  "knowledge.document_updated": "ویرایش سند دانش",
  "knowledge.document_deleted": "حذف سند دانش",
  "knowledge.status_changed": "وضعیت سند دانش",
  "rate.service_created": "ثبت خدمت نرخ",
  "rate.price_changed": "تغییر نرخ",
  "rate.service_status_changed": "وضعیت خدمت نرخ",
  "rate.service_deleted": "حذف خدمت نرخ",
  "finance.plan_updated": "ویرایش پلن",
  "finance.settings_updated": "تنظیمات مالی",
  "finance.trial_granted": "اعطای دوره آزمایشی",
  "finance.order_canceled_admin": "لغو سفارش",
  "finance.subscription_changed": "تغییر اشتراک",
  "finance.subscription_canceled": "لغو اشتراک",
  "finance.discount_created": "ایجاد تخفیف",
  "finance.discount_updated": "ویرایش تخفیف",
  "finance.discount_toggled": "وضعیت تخفیف",
  "finance.manual_payment": "پرداخت دستی",
};

export default function AdminAudit() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [section, setSection] = useState("");
  const data = useQuery(api.platformAdmin.auditLogs, {
    search: search.trim() || undefined,
  }) as LogRow[] | undefined;

  const actions = useMemo(
    () => [...new Set((data ?? []).map((row) => row.action))].sort(),
    [data],
  );
  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (row) => (action === "all" || row.action === action) && (!section || row.entityType === section) && (!from || row.createdAt >= new Date(from + "T00:00:00+03:30").getTime()) && (!until || row.createdAt <= new Date(until + "T23:59:59.999+03:30").getTime()),
      ),
    [data, action, from, until, section],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportRows = () => {
    if (!data) return;
    downloadCsv(
      "audit-logs.csv",
      ["زمان", "مدیر", "موبایل", "عملیات", "نوع موجودیت", "شناسه", "کافی‌نت", "خلاصه"],
      filtered.map((row) => [
        faDateLong(row.createdAt),
        row.actorName,
        row.actorPhone,
        ACTION_LABELS[row.action] ?? row.action,
        row.entityType,
        row.entityId,
        row.cafeName,
        row.summary,
      ]),
    );
  };

  return (
    <AdminShell active="audit">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">گزارش رویدادهای مدیریتی</h1>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              این گزارش فقط افزودنی است و از رابط کاربری قابل ویرایش یا حذف
              نیست. برای هر رویداد کاربر، زمان، نوع عملیات و رکورد مرتبط ثبت می‌شود.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={exportRows} disabled={!data?.length} className="clay-sm h-9 rounded-xl border-0 text-[10.5px]">
            <Download className="size-3.5" />
            خروجی CSV
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-[10px] leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
          مشاهده اطلاعات حساس کافی‌نت‌ها نیز به‌صورت خودکار در همین گزارش ثبت
          می‌شود. رویدادهای مالی و تغییرات نرخ‌نامه در گزارش‌های تخصصی خودشان
          نیز نگهداری می‌شوند.
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="grid gap-2 text-sm">از تاریخ<Input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}} /></label>
          <label className="grid gap-2 text-sm">تا تاریخ<Input type="date" value={until} onChange={e=>{setUntil(e.target.value);setPage(1);}} /></label>
          <label className="grid gap-2 text-sm">بخش<select className="rounded-xl border border-border bg-background p-2" value={section} onChange={e=>{setSection(e.target.value);setPage(1);}}><option value="">همه بخش‌ها</option>{[...new Set((data??[]).map(r=>r.entityType))].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
        </div>
        <section className="clay rounded-[26px] p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="جستجوی خلاصه، مدیر، کافی‌نت یا نوع رویداد"
                className="clay-inset h-9 rounded-xl border-0 bg-transparent ps-9 text-[10.5px] shadow-none"
              />
            </div>
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] sm:w-56">
                <SelectValue placeholder="نوع عملیات" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">همه عملیات‌ها</SelectItem>
                {actions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ACTION_LABELS[item] ?? item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data === undefined ? (
            <div className="flex justify-center p-10">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold">رویدادی پیدا نشد</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                هنوز عملیات مدیریتی ثبت نشده یا فیلتر هیچ نتیجه‌ای ندارد.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-start text-[10px]">
                  <thead>
                    <tr className="border-b border-border/50 text-[9px] text-muted-foreground">
                      <th className="px-2 py-2 text-start font-semibold">زمان</th>
                      <th className="px-2 py-2 text-start font-semibold">مدیر</th>
                      <th className="px-2 py-2 text-start font-semibold">عملیات</th>
                      <th className="px-2 py-2 text-start font-semibold">خلاصه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/30 last:border-0">
                        <td className="whitespace-nowrap px-2 py-2.5 text-[9px] text-muted-foreground">
                          {faDateLong(row.createdAt)}
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="font-semibold">{row.actorName}</p>
                          <p dir="ltr" className="mt-0.5 text-[8.5px] text-muted-foreground">
                            {row.actorPhone}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant="secondary" className="rounded-full text-[8px]">
                            {ACTION_LABELS[row.action] ?? row.action}
                          </Badge>
                          {row.cafeName && (
                            <p className="mt-1 text-[8.5px] text-muted-foreground">{row.cafeName}</p>
                          )}
                        </td>
                        <td className="px-2 py-2.5 leading-5">{row.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">
                  {faNumber(filtered.length)} رویداد · صفحه {faNumber(page)} از {faNumber(pages)}
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
    </AdminShell>
  );
}
