import { AdminShell } from "@/components/layout/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/backend/api";
import { faDateTime, faNumber, faToman } from "@/lib/format";
import { useQuery } from "@/backend/client";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  HeartPulse,
  LifeBuoy,
  Loader2,
  ServerCog,
  Settings2,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { Link } from "react-router";

type Health = {
  generatedAt: number;
  database: { reachable: boolean; cafesCapped: boolean };
  cafes: { total: number; active: number; suspended: number };
  support: { open: number; inProgress: number; urgent: number };
  billing: {
    pendingOrders: number;
    failedOrders: number;
    expiringWithinSevenDays: number;
  };
  agent: {
    runs24h: number;
    errors24h: number;
    fallbacks24h: number;
    requestsThisMonth: number;
    estimatedCostThisMonthToman: number;
  };
  backup: { schedule: string; note: string | null };
  integrations: {
    paymentConfigured: boolean;
    aiConfigured: boolean;
    emailToggle: boolean;
    smsToggle: boolean;
  };
  recentAudit: {
    id: string;
    action: string;
    summary: string;
    createdAt: number;
  }[];
  sectionsCappedAt: number;
};

export default function AdminHealth() {
  const health = useQuery(api.platformAdmin.systemHealth, {}) as
    | Health
    | undefined;

  return (
    <AdminShell active="health">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <HeartPulse className="size-4" />
              </span>
              <h1 className="text-xl font-black">سلامت و پایش سامانه</h1>
            </div>
            <p className="mt-2 max-w-2xl text-[10.5px] leading-5 text-muted-foreground">
              نمای عملیاتی از دیتابیس، صف پشتیبانی، پرداخت‌ها، مصرف ایجنت و
              آخرین رخدادهای حساس. این صفحه جایگزین لاگ‌های کامل Convex یا سرویس
              هشدار خارجی نیست.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="h-9 rounded-xl text-[10px]">
              <Link to="/admin/settings">
                <Settings2 className="size-3.5" />
                تنظیمات
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-9 rounded-xl text-[10px]">
              <Link to="/admin/audit">
                <ShieldCheck className="size-3.5" />
                گزارش فعالیت
              </Link>
            </Button>
          </div>
        </div>

        {health === undefined ? (
          <div className="clay flex justify-center rounded-[28px] p-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "وضعیت دیتابیس",
                  value: health.database.reachable ? "در دسترس" : "خطا",
                  hint: `آخرین بررسی: ${faDateTime(health.generatedAt)}`,
                  icon: Database,
                  tone: "tile-mint",
                },
                {
                  label: "کافی‌نت‌های فعال",
                  value: faNumber(health.cafes.active),
                  hint: `${faNumber(health.cafes.suspended)} معلق از ${faNumber(health.cafes.total)}`,
                  icon: Store,
                  tone: "tile-navy",
                },
                {
                  label: "تیکت‌های باز",
                  value: faNumber(health.support.open + health.support.inProgress),
                  hint: `${faNumber(health.support.urgent)} مورد اولویت بالا`,
                  icon: LifeBuoy,
                  tone: "tile-peach",
                },
                {
                  label: "سفارش‌های در انتظار",
                  value: faNumber(health.billing.pendingOrders),
                  hint: `${faNumber(health.billing.failedOrders)} سفارش ناموفق`,
                  icon: CreditCard,
                  tone: "tile-lilac",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="clay rounded-[24px] p-4">
                    <span
                      className={`grid size-9 place-items-center rounded-xl ${card.tone}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <p className="mt-3 text-[10px] text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1 text-lg font-extrabold">{card.value}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {card.hint}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="clay rounded-[26px] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">مصرف ایجنت هوشمند</h2>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Metric
                    label="اجرای ۲۴ ساعت"
                    value={faNumber(health.agent.runs24h)}
                  />
                  <Metric
                    label="خطای ۲۴ ساعت"
                    value={faNumber(health.agent.errors24h)}
                    danger={health.agent.errors24h > 0}
                  />
                  <Metric
                    label="پاسخ جایگزین"
                    value={faNumber(health.agent.fallbacks24h)}
                  />
                  <Metric
                    label="درخواست این ماه"
                    value={faNumber(health.agent.requestsThisMonth)}
                  />
                </div>
                <div className="mt-3 rounded-xl bg-muted/35 p-3">
                  <p className="text-[9px] text-muted-foreground">
                    هزینه تخمینی این ماه بر اساس تنظیمات پلتفرم
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-primary">
                    {faToman(health.agent.estimatedCostThisMonthToman)}
                  </p>
                  <p className="mt-1 text-[8.5px] leading-4 text-muted-foreground">
                    این عدد تخمین مدیریتی است و جایگزین صورتحساب ارائه‌دهنده
                    هوش مصنوعی نیست.
                  </p>
                </div>
              </section>

              <section className="clay rounded-[26px] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ServerCog className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">
                    پیکربندی و هشدارها
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  <StatusRow
                    label="درگاه پرداخت"
                    configured={health.integrations.paymentConfigured}
                    configuredText="کلید سمت سرور موجود است"
                    missingText="کلید مرچنت تنظیم نشده؛ پرداخت واقعی غیرفعال است"
                  />
                  <StatusRow
                    label="درگاه هوش مصنوعی"
                    configured={health.integrations.aiConfigured}
                    configuredText="کلید سمت سرور موجود است"
                    missingText="کلید AI تنظیم نشده؛ پاسخ واقعی ایجنت محدود است"
                  />
                  <StatusRow
                    label="اطلاع‌رسانی ایمیلی"
                    configured={false}
                    configuredText=""
                    missingText="سرویس ایمیل متصل نیست؛ ارسال واقعی نداریم"
                  />
                  <StatusRow
                    label="اطلاع‌رسانی پیامکی"
                    configured={false}
                    configuredText=""
                    missingText="سرویس پیامک متصل نیست؛ ارسال واقعی نداریم"
                  />
                  <div className="rounded-xl bg-amber-500/10 p-3">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-amber-600" />
                      <p className="text-[9.5px] font-semibold">هشدار خودکار خارجی</p>
                    </div>
                    <p className="mt-1 text-[8.5px] leading-4 text-muted-foreground">
                      پایش و alerting خارجی در این نسخه پیکربندی نشده است. برای
                      Production باید سرویس پایش متصل و مالک پاسخ‌گو تعیین شود.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="clay rounded-[26px] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">پشتیبان‌گیری</h2>
                </div>
                <div className="mt-3 space-y-2">
                  <Metric label="زمان‌بندی ثبت‌شده" value={health.backup.schedule} />
                  <Metric
                    label="اشتراک‌های نزدیک انقضا"
                    value={faNumber(health.billing.expiringWithinSevenDays)}
                  />
                </div>
                <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
                  {health.backup.note ??
                    "اجزای پشتیبان‌گیری خودکار خارج از Convex اجرا می‌شوند. وضعیت واقعی آخرین اجرا باید در GitHub Actions یا سرویس پایش بررسی شود."}
                </p>
              </section>

              <section className="clay rounded-[26px] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <h2 className="text-[12px] font-extrabold">آخرین رخدادها</h2>
                </div>
                {health.recentAudit.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-muted/35 p-4 text-center text-[10px] text-muted-foreground">
                    رخدادی ثبت نشده است.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {health.recentAudit.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-xl bg-muted/30 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold">{row.summary}</p>
                        <p className="mt-0.5 font-mono text-[8px] text-muted-foreground" dir="ltr">
                          {row.action} · {faDateTime(row.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <p className="flex items-start gap-1.5 rounded-2xl bg-muted/35 p-3 text-[9px] leading-5 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              شمارنده‌ها حداکثر {faNumber(health.sectionsCappedAt)} رکورد اخیر را
              بررسی می‌کنند. برای رصد دقیق خطاهای تابع، latency و مصرف منابع،
              داشبورد Convex و سرویس پایش خارجی مرجع هستند.
            </p>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2">
      <span className="text-[9.5px] text-muted-foreground">{label}</span>
      <span
        className={`text-[11px] font-extrabold ${danger ? "text-rose-600 dark:text-rose-300" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusRow({
  label,
  configured,
  configuredText,
  missingText,
}: {
  label: string;
  configured: boolean;
  configuredText: string;
  missingText: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/35 p-2.5">
      {configured ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
      ) : (
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[9.5px] font-semibold">{label}</p>
          <Badge
            variant="secondary"
            className="rounded-full px-1.5 py-0 text-[7.5px]"
          >
            {configured ? "تنظیم‌شده" : "ناقص"}
          </Badge>
        </div>
        <p className="mt-0.5 text-[8.5px] leading-4 text-muted-foreground">
          {configured ? configuredText : missingText}
        </p>
      </div>
    </div>
  );
}
