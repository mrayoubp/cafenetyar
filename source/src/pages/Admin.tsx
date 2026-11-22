import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/backend/api";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from "@/backend/adminPermissions";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber, faToman } from "@/lib/format";
import { useMutation, useQuery } from "@/backend/client";
import {
  Activity,
  Bot,
  Building2,
  CalendarClock,
  CreditCard,
  Loader2,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { toast } from "sonner";

type Overview = {
  cafes: { total: number; active: number; suspended: number };
  employees: { total: number; active: number };
  users: number;
  usersTotal: number;
  subscriptions: {
    trial: number;
    active: number;
    expired: number;
    canceled: number;
    pending_payment: number;
    expiringSoon: number;
    monthly: number;
    yearly: number;
  };
  revenue: {
    todayToman: number;
    monthToman: number;
    yearToman: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  };
  ai: { requests: number; runs: number; aiRuns: number; errors: number };
  news: { published: number; pending: number; total: number };
  support: { open: number; inProgress: number; urgent: number };
  plans: {
    code: string;
    name: string;
    priceToman: number;
    subscribers: number;
    isActive: boolean;
  }[];
  chart: {
    month: string;
    revenueToman: number;
    newCafes: number;
    newUsers: number;
    newSubscriptions: number;
  }[];
  recentAudit: {
    id: string;
    actorName: string;
    action: string;
    summary: string;
    createdAt: number;
  }[];
  generatedAt: number;
};

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    month: "short",
    year: "2-digit",
  }).format(new Date(year, month - 1, 1));
}

export default function Admin() {
  const { context } = useSession();
  const { signOut } = useAuth();
  const isAdmin = context?.isSiteAdmin === true && !context?.isBlocked;
  const canViewDashboard =
    context?.isSuperAdmin === true ||
    (context?.adminPermissions ?? []).includes(
      ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    );
  const adminExists = useQuery(
    api.admin.adminExists,
    context && !context.isBlocked ? {} : "skip",
  );
  const overview = useQuery(
    api.admin.overview,
    isAdmin && canViewDashboard ? {} : "skip",
  ) as Overview | undefined;
  const claimAdmin = useMutation(api.admin.claimSiteAdmin);
  const [claimLoading, setClaimLoading] = useState(false);

  const canBootstrap = context?.platform.canBootstrapAdmin === true;
  const bootstrapConfigured =
    context?.platform.adminBootstrapConfigured === true;

  if (context === undefined) {
    return (
      <AdminShell>
        <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (context?.isBlocked) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-lg">
          <div className="clay rounded-[32px] p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-rose-500/10 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="mt-4 text-lg font-extrabold">حساب مدیریتی شما مسدود است</h1>
            <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
              دسترسی این حساب توسط مدیر اصلی پلتفرم مسدود شده است. برای بررسی
              وضعیت با تیم مدیریت تماس بگیرید.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await signOut();
              }}
              className="mt-5 h-10 w-full rounded-xl text-[11px] text-muted-foreground"
            >
              خروج از حساب
            </Button>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-lg">
          <div className="clay rounded-[32px] p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="mt-4 text-lg font-extrabold">
              این پنل مخصوص تیم مدیریت کافی‌نت‌یار است
            </h1>
            <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
              دسترسی فقط با نقش مدیریتی پلتفرم ممکن است و همه کوئری‌ها سمت سرور
              بررسی می‌شوند. نقش‌ها و مجوزها از پنل مدیر اصلی مدیریت می‌شوند.
            </p>
            {adminExists === undefined ? (
              <div className="mt-5 flex justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : adminExists === false && canBootstrap ? (
              <div className="clay-inset mt-5 space-y-3 rounded-2xl p-4 text-start">
                <p className="text-[11px] leading-6 text-muted-foreground">
                  هنوز مدیری برای پلتفرم انتخاب نشده است. این حساب به شماره
                  مجاز راه‌اندازی متصل است و می‌تواند نقش مدیر اصلی را فقط یک
                  بار فعال کند.
                </p>
                <Button
                  type="button"
                  disabled={claimLoading}
                  onClick={async () => {
                    setClaimLoading(true);
                    try {
                      await claimAdmin({});
                      toast.success("نقش مدیر اصلی فعال شد.");
                    } catch (caught) {
                      toast.error(
                        errorMessage(caught, "فعال‌سازی نقش مدیر ممکن نشد."),
                      );
                    } finally {
                      setClaimLoading(false);
                    }
                  }}
                  className="clay-primary h-10 w-full rounded-xl border-0 text-[11.5px] font-bold hover:brightness-105"
                >
                  {claimLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  فعال‌سازی مدیر اصلی
                </Button>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/60 p-3 text-[10.5px] leading-5 text-muted-foreground">
                {adminExists === false
                  ? bootstrapConfigured
                    ? "این حساب مجاز به فعال‌سازی نقش مدیر اصلی نیست."
                    : "ثبت مدیر اصلی نیازمند تنظیم شماره مجاز راه‌اندازی توسط مسئول سرویس است."
                  : "مدیر اصلی قبلاً انتخاب شده است. برای دریافت دسترسی با او تماس بگیرید."}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-xl text-[11px] text-muted-foreground"
              >
                <Link to={context?.cafe ? "/dashboard" : "/"}>
                  بازگشت به {context?.cafe ? "پنل کافی‌نت" : "صفحه اصلی"}
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await signOut();
                }}
                className="h-9 rounded-xl text-[11px] text-muted-foreground"
              >
                خروج از حساب
              </Button>
            </div>
          </div>
        </div>
      </AdminShell>
    );
  }

  const permissions = context?.adminPermissions ?? [];
  const can = (permission: AdminPermission) =>
    context?.isSuperAdmin || permissions.includes(permission);

  if (!canViewDashboard) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-lg">
          <div className="clay rounded-[32px] p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-primary/10 text-primary">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="mt-4 text-lg font-extrabold">
              دسترسی به داشبورد مدیریت فعال نیست
            </h1>
            <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
              نقش مدیریتی شما مجوز مشاهده داشبورد را ندارد. از منوی کنار،
              بخش‌هایی که برایتان فعال شده‌اند در دسترس هستند.
            </p>
            <Button
              asChild
              className="clay-primary mt-5 h-10 w-full rounded-xl border-0 text-[11px] font-bold"
            >
              <Link to={context.cafe ? "/dashboard" : "/"}>
                بازگشت به {context.cafe ? "پنل کافی‌نت" : "صفحه اصلی"}
              </Link>
            </Button>
          </div>
        </div>
      </AdminShell>
    );
  }
  const chart = (overview?.chart ?? []).map((row) => ({
    ...row,
    label: monthLabel(row.month),
  }));

  return (
    <AdminShell active="platform">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[32px] p-5 sm:p-7">
          <div className="pointer-events-none absolute -end-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge
                variant="secondary"
                className="rounded-full text-[9.5px]"
              >
                <ShieldCheck className="me-1 size-3" />
                {context.isSuperAdmin
                  ? "مدیر اصلی پلتفرم"
                  : "عضو تیم مدیریت"}
              </Badge>
              <h1 className="mt-3 text-2xl font-black tracking-tight">
                همه‌چیز در یک نگاه
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                آمار این صفحه مستقیماً از پایگاه داده محاسبه می‌شود؛ درآمد فقط
                از فاکتورهای پرداخت‌شده و پرداخت‌ها فقط از سفارش‌های نهایی‌شده.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can(ADMIN_PERMISSIONS.CAFES_VIEW) && (
                <Button asChild className="clay-primary h-9 rounded-xl border-0 text-[10.5px] font-bold">
                  <Link to="/admin/cafes">مدیریت کافی‌نت‌ها</Link>
                </Button>
              )}
              {can(ADMIN_PERMISSIONS.SUPPORT_VIEW) && (
                <Button asChild variant="ghost" className="clay-sm h-9 rounded-xl border-0 text-[10.5px]">
                  <Link to="/admin/support">
                    <LifeBuoy className="size-3.5" />
                    صف پشتیبانی
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {overview === undefined ? (
          <div className="clay flex items-center justify-center rounded-[28px] p-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="کافی‌نت‌ها"
                value={faNumber(overview.cafes.total)}
                hint={`${faNumber(overview.cafes.active)} فعال · ${faNumber(overview.cafes.suspended)} غیرفعال`}
                icon={<Building2 className="size-4" />}
                tone="navy"
              />
              <StatCard
                label="کاربران و کارمندان"
                value={faNumber(overview.users)}
                hint={`${faNumber(overview.employees.total)} کارمند (${faNumber(overview.employees.active)} فعال)`}
                icon={<Users className="size-4" />}
                tone="mint"
              />
              <StatCard
                label="اشتراک فعال"
                value={faNumber(overview.subscriptions.active)}
                hint={`${faNumber(overview.subscriptions.trial)} آزمایشی · ${faNumber(overview.subscriptions.expired)} منقضی`}
                icon={<CreditCard className="size-4" />}
                tone="lilac"
              />
              <StatCard
                label="درآمد ماه جاری"
                value={faToman(overview.revenue.monthToman)}
                hint={`${faNumber(overview.revenue.successfulPayments)} پرداخت موفق · ${faNumber(overview.revenue.failedPayments)} ناموفق`}
                icon={<Wallet className="size-4" />}
                tone="amber"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat
                label="درآمد امروز"
                value={faToman(overview.revenue.todayToman)}
              />
              <MiniStat
                label="درآمد سال جاری"
                value={faToman(overview.revenue.yearToman)}
              />
              <MiniStat
                label="درخواست هوش مصنوعی"
                value={faNumber(overview.ai.requests)}
              />
              <MiniStat
                label="اخبار منتشرشده"
                value={faNumber(overview.news.published)}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <section className="clay rounded-[28px] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold">روند درآمد</h2>
                    <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                      بر اساس فاکتورهای پرداخت‌شده، هشت ماه اخیر
                    </p>
                  </div>
                  <TrendingUp className="size-4 text-emerald-600" />
                </div>
                <div className="mt-4 h-64 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart}>
                      <defs>
                        <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.62 0.13 220)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="oklch(0.62 0.13 220)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.08} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, fontSize: 10, direction: "rtl" }}
                        formatter={(value) => [faToman(Number(value)), "درآمد"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenueToman"
                        stroke="oklch(0.55 0.15 230)"
                        fill="url(#adminRevenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="clay rounded-[28px] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold">رشد پلتفرم</h2>
                    <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                      کاربر جدید و کافی‌نت جدید
                    </p>
                  </div>
                  <Activity className="size-4 text-primary" />
                </div>
                <div className="mt-4 h-64 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="4 4" stroke="currentColor" opacity={0.08} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 14, fontSize: 10, direction: "rtl" }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="newUsers" name="کاربر" fill="oklch(0.62 0.1 170)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="newCafes" name="کافی‌نت" fill="oklch(0.6 0.12 280)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="newSubscriptions" name="اشتراک" fill="oklch(0.68 0.12 70)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <section className="clay rounded-[24px] p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">وضعیت اشتراک‌ها</h2>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <KeyValue label="آزمایشی" value={faNumber(overview.subscriptions.trial)} />
                  <KeyValue label="فعال" value={faNumber(overview.subscriptions.active)} />
                  <KeyValue label="منقضی" value={faNumber(overview.subscriptions.expired)} />
                  <KeyValue label="در انتظار پرداخت" value={faNumber(overview.subscriptions.pending_payment)} />
                  <KeyValue label="ماهانه" value={faNumber(overview.subscriptions.monthly)} />
                  <KeyValue label="سالانه" value={faNumber(overview.subscriptions.yearly)} />
                </div>
              </section>

              <section className="clay rounded-[24px] p-4">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">هوش مصنوعی و محتوا</h2>
                </div>
                <div className="mt-3 space-y-2">
                  <KeyValue label="مصرف سهمیه AI" value={faNumber(overview.ai.requests)} />
                  <KeyValue label="اجرای ایجنت" value={faNumber(overview.ai.runs)} />
                  <KeyValue label="خطاهای ایجنت" value={faNumber(overview.ai.errors)} />
                  <KeyValue label="اخبار در انتظار" value={faNumber(overview.news.pending)} />
                </div>
              </section>

              <section className="clay rounded-[24px] p-4">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">پشتیبانی</h2>
                </div>
                <div className="mt-3 space-y-2">
                  <KeyValue label="تیکت باز" value={faNumber(overview.support.open)} />
                  <KeyValue label="در حال بررسی" value={faNumber(overview.support.inProgress)} />
                  <KeyValue label="اولویت فوری" value={faNumber(overview.support.urgent)} />
                  <p className="pt-1 text-[9px] leading-5 text-muted-foreground">
                    پاسخ‌ها و یادداشت‌های داخلی در بخش پشتیبانی قابل پیگیری هستند.
                  </p>
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <section className="clay rounded-[26px] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[12px] font-extrabold">رویدادهای اخیر مدیران</h2>
                  <Link to="/admin/audit" className="text-[9.5px] font-semibold text-primary">
                    مشاهده گزارش کامل
                  </Link>
                </div>
                {overview.recentAudit.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                    هنوز رویداد مدیریتی ثبت نشده است.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-border/40">
                    {overview.recentAudit.map((row) => (
                      <div key={row.id} className="flex items-start gap-2 py-2.5">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-semibold">{row.summary}</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">
                            {row.actorName} · {faDateLong(row.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="clay rounded-[26px] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[12px] font-extrabold">مشترکین هر پلن</h2>
                  <Link to="/admin/billing" className="text-[9.5px] font-semibold text-primary">
                    مدیریت مالی
                  </Link>
                </div>
                <div className="mt-3 space-y-2">
                  {overview.plans.filter((plan) => plan.isActive).map((plan) => (
                    <div key={plan.code} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                      <div>
                        <p className="text-[10.5px] font-bold">{plan.name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {plan.priceToman > 0 ? `${faToman(plan.priceToman)} / ماه` : "قیمت تعیین نشده"}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {faNumber(plan.subscribers)} مشترک
                      </span>
                    </div>
                  ))}
                  {overview.plans.length === 0 && (
                    <p className="rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                      پلنی ثبت نشده است؛ از بخش مالی پلتفرم پلن بسازید.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <p className="flex items-start gap-1.5 px-1 text-[9px] leading-5 text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              آخرین محاسبه: {faDateLong(overview.generatedAt)}. برخی شاخص‌ها مانند
              هزینه دقیق سرویس AI تنها در صورت ثبت نرخ هزینه در تنظیمات قابل
              برآورد است و به‌عنوان عدد قطعی نمایش داده نمی‌شود.
            </p>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: "navy" | "mint" | "lilac" | "amber";
}) {
  const tones = {
    navy: "tile-navy",
    mint: "tile-mint",
    lilac: "tile-lilac",
    amber: "tile-peach",
  } as const;
  return (
    <div className="clay rounded-[24px] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-[11px] ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay-sm rounded-2xl px-3 py-2.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[12px] font-extrabold">{value}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-2.5 py-1.5">
      <span className="text-[9.5px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-bold">{value}</span>
    </div>
  );
}
