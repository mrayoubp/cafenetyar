import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { api } from "@/convex/_generated/api";
import { PERMISSIONS } from "@/convex/permissions";
import { faRelativeTime, faToday } from "@/lib/format";
import { useMutation, useQuery } from "@/hooks/use-managed-content";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import {
  Bot,
  CalendarDays,
  Calculator,
  ChevronLeft,
  Globe2,
  Info,
  Newspaper,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

type DashboardFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "navy" | "mint" | "peach" | "lilac";
  status: string;
  href?: string;
  ctaLabel: string;
  highlighted?: boolean;
  permission?: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
};

const FEATURES: DashboardFeature[] = [
  {
    title: "حسابداری هوشمند",
    description:
      "دسترسی به سیستم حسابداری اختصاصی هر کافی‌نت؛ ثبت دریافت و هزینه، مشاهده گزارش روز و پیگیری تراکنش‌ها.",
    icon: Calculator,
    tone: "navy",
    status: "فعال",
    href: "/dashboard/accounting",
    ctaLabel: "ورود به حسابداری",
    highlighted: true,
    permission: PERMISSIONS.ACCOUNTING_VIEW,
  },
  {
    title: "اخبار روز",
    description:
      "نمایش اخبار، اطلاعیه‌ها و تغییرات مهم مرتبط با فعالیت کافی‌نت‌ها در یک خوراک خبری منظم.",
    icon: Newspaper,
    tone: "peach",
    status: "فعال",
    href: "/dashboard/news",
    ctaLabel: "مشاهده اخبار",
    permission: PERMISSIONS.NEWS_VIEW,
  },
  {
    title: "سایت‌های کاربردی",
    description:
      "بانک سامانه‌های رسمی و پرکاربرد با جستجو، دسته‌بندی، علاقه‌مندی و بازدیدهای اخیر.",
    icon: Globe2,
    tone: "mint",
    status: "فعال",
    href: "/dashboard/sites",
    ctaLabel: "ورود به بانک سامانه‌ها",
    permission: PERMISSIONS.SITES_VIEW,
  },
  {
    title: "ایجنت هوشمند",
    description:
      "دستیار تخصصی برای پاسخ به پرسش‌های کافی‌نت‌داران بر پایه دانش تأییدشده و منابع رسمی.",
    icon: Bot,
    tone: "lilac",
    status: "فعال",
    href: "/dashboard/agent",
    ctaLabel: "گفت‌وگو با ایجنت",
    permission: PERMISSIONS.AGENT_USE,
  },
  {
    title: "نرخ‌نامه و ماشین‌حساب",
    description:
      "نرخ پایه و اختصاصی خدمات، تاریخچه تغییرات و محاسبه شفاف هزینه تایپ، پرینت و خدمات کافی‌نت.",
    icon: ReceiptText,
    tone: "peach",
    status: "فعال",
    href: "/dashboard/rates",
    ctaLabel: "مشاهده نرخ‌نامه",
    permission: PERMISSIONS.RATES_VIEW,
  },
  {
    title: "کارمندان و دسترسی",
    description:
      "مدیریت نقش کارمندان، واگذاری مجوزها و کنترل دسترسی به بخش‌های مختلف کافی‌نت.",
    icon: ShieldCheck,
    tone: "navy",
    status: "فعال",
    href: "/dashboard/employees",
    ctaLabel: "مدیریت کارمندان",
    permission: PERMISSIONS.EMPLOYEES_MANAGE,
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { context } = useSession();
  const displayName = context?.user.name?.trim()
    ? context.user.name.trim()
    : user?.isAnonymous
      ? null
      : user?.name?.trim() || null;
  const canAccount =
    context?.permissions.includes(PERMISSIONS.ACCOUNTING_VIEW) ?? true;
  const canNews =
    context?.permissions.includes(PERMISSIONS.NEWS_VIEW) ?? false;
  const canSites =
    context?.permissions.includes(PERMISSIONS.SITES_VIEW) ?? false;
  const canAgent =
    context?.permissions.includes(PERMISSIONS.AGENT_USE) ?? false;
  const newsQuery = useQuery(api.news.highlights, canNews ? {} : "skip");
  const sitesQuery = useQuery(
    api.websites.highlights,
    canSites ? {} : "skip",
  );
  const recordVisit = useMutation(api.websites.recordVisit);
  const newsItems = newsQuery?.items ?? [];
  const quickSites = sitesQuery?.items ?? [];
  const now = context?.serverNow ?? 0;
  const features = FEATURES.map((feature) => {
    const allowed =
      !feature.permission || (context?.permissions.includes(feature.permission) ?? false);
    return {
      ...feature,
      href: allowed ? feature.href : undefined,
      status: allowed ? feature.status : "نیازمند دسترسی",
      ctaLabel: allowed ? feature.ctaLabel : "درخواست دسترسی از مدیر",
    };
  });

  return (
    <AppShell active="overview">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Welcome */}
        <motion.section
          variants={rise}
          className="clay relative overflow-hidden rounded-[32px] p-6 sm:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -start-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 end-10 size-64 rounded-full bg-accent/50 blur-3xl"
          />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {faToday()}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  نسخه ۳٫۱ · دفتر مالی، اخبار، سامانه‌ها و ایجنت
                </span>
                {context?.cafe && (
                  <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    <Store className="size-3.5" />
                    {context.cafe.name}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-2xl font-extrabold leading-[1.5] tracking-tight sm:text-[2rem]">
                سلام،{" "}
                <span className="text-primary">
                  {displayName ?? "همکار گرامی"}
                </span>{" "}
                👋
              </h1>
              <p className="mt-3 max-w-xl text-[13px] leading-7 text-muted-foreground">
                {context?.isGuest
                  ? "شما در حالت مهمان هستید؛ فقط نمای محدود پلتفرم در دسترس است و به داده‌های هیچ کافی‌نتی دسترسی ندارید."
                  : context?.cafe
                    ? `به ${context.cafe.name} خوش آمدید؛ حساب شما با دسترسی ${
                        context.isOwner ? "صاحب کافی‌نت" : "کارمند"
                      } فعال است. دفتر مالی، اخبار، بانک سامانه‌ها، ایجنت هوشمند و نرخ‌نامه در دسترس‌اند.`
                    : "به کافی‌نت‌یار خوش آمدید؛ فضای یکپارچه‌ای برای مدیریت کافی‌نت. حساب شما آماده است و بخش‌های بعدی به‌تدریج فعال می‌شوند."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canAccount ? (
                  <Button
                    asChild
                    size="lg"
                    className="clay-primary h-12 rounded-2xl border-0 px-5 text-sm font-bold hover:brightness-105"
                  >
                    <Link to="/dashboard/accounting">
                      <Calculator className="size-[18px]" />
                      ورود به حسابداری هوشمند
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled
                    size="lg"
                    className="clay-sm h-12 rounded-2xl border-0 px-5 text-sm font-semibold text-muted-foreground"
                  >
                    <ShieldCheck className="size-[18px]" />
                    حسابداری برای نقش شما فعال نیست
                  </Button>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="clay-sm h-12 rounded-2xl border-0 px-5 text-sm font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
                >
                  <Link to="/help">
                    <Info className="size-[18px]" />
                    راهنمای شروع
                  </Link>
                </Button>
              </div>
            </div>

            <div className="clay-inset w-full rounded-[26px] p-4 lg:w-72">
              <div className="flex items-center justify-between">                <p className="text-xs font-bold">وضعیت نسخه</p>
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-medium"
                >
                  فعال
                </Badge>
              </div>
              <ul className="mt-3 space-y-2.5">
                {[
                  { label: "حسابداری هوشمند", state: "فعال", active: true },
                  {
                    label: "اخبار روز",
                    state: canNews ? "فعال" : "محدود",
                    active: canNews,
                  },
                  {
                    label: "سامانه‌ها و نرخ‌نامه",
                    state: canSites ? "فعال" : "محدود",
                    active: canSites,
                  },
                  {
                    label: "ایجنت هوشمند",
                    state: canAgent ? "فعال" : "محدود",
                    active: canAgent,
                  },
                ].map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-2 rounded-xl bg-card/50 px-2.5 py-2"
                  >
                    <span className="text-[11px] font-medium text-foreground/85">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {row.active && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                      {row.state}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                داده‌ها مخصوص همین کافی‌نت و کنترل‌شده در سمت سرور
              </p>
            </div>
          </div>
        </motion.section>

        {/* Four main features */}
        <motion.section variants={rise} className="space-y-3">
          <SectionHeading
            title="بخش‌های اصلی کافی‌نت‌یار"
            description="دفتر مالی، اخبار، بانک سامانه‌ها، ایجنت و نرخ‌نامه در یک فضای کاری یکپارچه."
            canLink={canAccount}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </motion.section>

        {/* Announcements + quick access */}
        <motion.div
          variants={rise}
          className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <section className="clay rounded-[30px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="tile-peach grid size-11 place-items-center rounded-[14px]">
                  <Newspaper className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold">اطلاعیه‌ها و اخبار</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {newsItems.length
                      ? "آخرین مطالب منتشرشده در مرکز خبر"
                      : "هنوز خبری منتشر نشده است"}
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full text-[10px] font-medium"
              >
                {newsQuery?.hasDemo
                  ? "Demo"
                  : newsItems.length
                    ? "منتشرشده"
                    : "خالی"}
              </Badge>
            </div>

            <ul className="mt-5 space-y-2.5">
              {newsItems.length > 0
                ? newsItems.map((item) => (
                    <li key={item.id} className="clay-inset rounded-[20px] p-3.5">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            item.category.tone === "navy" && "bg-primary",
                            item.category.tone === "mint" && "bg-emerald-400",
                            item.category.tone === "peach" && "bg-amber-400",
                            item.category.tone === "lilac" && "bg-violet-400",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/dashboard/news/${item.id}`}
                              className="text-[12.5px] font-bold hover:text-primary"
                            >
                              {item.title}
                            </Link>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                              {item.category.name}
                            </span>
                            {item.isUrgent && (
                              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                                فوری
                              </span>
                            )}
                            {item.isDemo && (
                              <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[8.5px] font-bold text-amber-700 dark:text-amber-300">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                            {item.summary}
                          </p>
                          <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                            {faRelativeTime(item.publishedAt, now)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))
                : (
                    <li className="clay-inset flex flex-col items-center rounded-[20px] p-6 text-center">
                      <Newspaper className="size-6 text-muted-foreground" />
                      <p className="mt-2 text-[11.5px] font-bold">
                        هنوز خبری منتشر نشده است
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                        خبرهای رسمی پس از انتشار توسط مدیر در همین بخش نمایش داده
                        می‌شوند. خبر ساختگی جایگزین نمی‌شود.
                      </p>
                    </li>
                  )}
            </ul>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-3 h-9 w-full justify-between rounded-xl px-2 text-[11.5px] font-semibold text-primary hover:bg-primary/10"
            >
              <Link to="/dashboard/news">
                مشاهده همه اخبار
                <ChevronLeft className="size-3.5" />
              </Link>
            </Button>
          </section>

          <section className="clay rounded-[30px] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="tile-mint grid size-11 place-items-center rounded-[14px]">
                <Globe2 className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold">دسترسی سریع</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  سامانه‌های پرکاربرد کافی‌نت
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {quickSites.map((site, index) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    recordVisit({ websiteId: site.id }).catch(() => undefined);
                  }}
                  className="clay-sm clay-lift group flex flex-col items-start gap-2 rounded-[20px] p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-[11px]",
                      ["tile-navy", "tile-mint", "tile-peach", "tile-lilac"][
                        index % 4
                      ],
                    )}
                  >
                    <Globe2 className="size-4" />
                  </span>
                  <span className="line-clamp-1 text-[11.5px] font-bold leading-4">
                    {site.name}
                  </span>
                  <span className="line-clamp-2 text-[10px] text-muted-foreground">
                    {site.description}
                  </span>
                </a>
              ))}
            </div>

            {quickSites.length === 0 && (
              <p className="mt-4 rounded-2xl bg-muted/60 p-3 text-[10px] leading-5 text-muted-foreground">
                سامانه‌ای برای نمایش سریع پیدا نشد. بانک سامانه‌ها را باز کنید و
                از فهرست کامل استفاده کنید.
              </p>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-3 h-9 w-full justify-between rounded-xl px-2 text-[11.5px] font-semibold text-primary hover:bg-primary/10"
            >
              <Link to="/dashboard/sites">
                مشاهده همه سامانه‌ها
                <ChevronLeft className="size-3.5" />
              </Link>
            </Button>
          </section>
        </motion.div>

        {/* Hanabino readiness */}
        <motion.section
          variants={rise}
          className="clay-inset flex flex-col gap-3 rounded-[26px] p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <span className="tile-navy grid size-11 shrink-0 place-items-center rounded-[14px]">
            <Calculator className="size-5" />
          </span>
          <p className="text-[11.5px] leading-6 text-muted-foreground">
            <strong className="font-bold text-foreground">
              دفتر مالی ماندگار:
            </strong>{" "}
            دریافت‌ها و هزینه‌ها در دیتابیس ذخیره می‌شوند و پس از refresh یا
            ورود دوباره باقی می‌مانند. ابطال تراکنش سابقه را حذف نمی‌کند و هر
            کافی‌نت فقط دفتر خودش را می‌بیند.
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-xl px-2 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            <Link to="/dashboard/accounting">
              باز کردن دفتر
              <ChevronLeft className="size-3.5" />
            </Link>
          </Button>
        </motion.section>
      </motion.div>
    </AppShell>
  );
}

function SectionHeading({
  title,
  description,
  canLink = true,
}: {
  title: string;
  description: string;
  canLink?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-1">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {canLink && (
        <Link
          to="/dashboard/accounting"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          رفتن به حسابداری
        </Link>
      )}
    </div>
  );
}
