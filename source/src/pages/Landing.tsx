import { MonthlyPlanCard } from "@/components/MonthlyPlanCard";
import { useManagedSettings } from "@/hooks/use-managed-content";
import { Logo, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/backend/api";
import { useQuery } from "@/backend/client";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Calculator,
  Check,
  ChevronLeft,
  Contrast,
  Globe2,
  Layers,
  Languages,
  Newspaper,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const FEATURES = [
  {
    title: "حسابداری هوشمند",
    description:
      "دفتر روزانه ماندگار، ثبت دریافت و هزینه، خلاصه روزانه و روند هفتگی؛ مخصوص هر کافی‌نت.",
    icon: Calculator,
    tone: "tile-navy",
    state: "فعال",
    active: true,
  },
  {
    title: "اخبار روز",
    description:
      "اطلاعیه‌ها، نرخ‌نامه‌ها و تغییرات مهم مرتبط با کافی‌نت‌ها در یک خوراک خبری منظم.",
    icon: Newspaper,
    tone: "tile-peach",
    state: "فعال",
    active: true,
  },
  {
    title: "بانک سامانه‌ها",
    description:
      "دسترسی سریع و دسته‌بندی‌شده به سامانه‌های رسمی و سرویس‌های پرکاربرد کافی‌نت‌ها.",
    icon: Globe2,
    tone: "tile-mint",
    state: "فعال",
    active: true,
  },
  {
    title: "ایجنت هوشمند",
    description:
      "دستیار فارسی بر پایه دانش تأییدشده؛ پاسخ مرحله‌به‌مرحله همراه با منبع و هشدار اطلاعات ناکافی.",
    icon: Bot,
    tone: "tile-lilac",
    state: "فعال",
    active: true,
  },
  {
    title: "نرخ‌نامه و ماشین‌حساب",
    description:
      "نرخ پایه و اختصاصی هر کافی‌نت، تاریخچه تغییرات و محاسبه شفاف هزینه خدمات.",
    icon: ReceiptText,
    tone: "tile-peach",
    state: "فعال",
    active: true,
  },
];

const AUDIENCES = ["کافی‌نت‌دار", "کارمند شیفت", "مدیر مجموعه"];

const FEATURE_ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  newspaper: Newspaper,
  globe: Globe2,
  bot: Bot,
  receipt: ReceiptText,
  sparkles: Sparkles,
  shield: ShieldCheck,
  users: Users,
  wallet: Wallet,
};

const SECTION_ORDER_KEYS = [
  "features",
  "version",
  "benefits",
  "roadmap",
  "plans",
  "cta",
] as const;

const BENEFITS = [
  {
    title: "کاملاً فارسی و راست‌به‌چپ",
    description:
      "رابط کاربری، اعداد و تاریخ‌ها فارسی‌اند تا کار روزمره بدون ترجمه ذهنی جلو برود.",
    icon: Languages,
  },
  {
    title: "روشن و تاریک",
    description:
      "تم روشن برای روز و تم تاریک برای شیفت شب؛ هر دو با سطح‌های نرم و خوانایی بالا.",
    icon: Contrast,
  },
  {
    title: "آماده توسعه",
    description:
      "ساختار برای حساب مستقل کافی‌نت، مدیریت کارمندان، اشتراک و سطوح دسترسی آماده شده است.",
    icon: Layers,
  },
];

const ROADMAP = [
  {
    version: "نسخه ۱",
    title: "حسابداری هوشمند",
    description: "دفتر مالی ماندگار، دریافت و هزینه و گزارش دسته‌بندی واقعی.",
    state: "اکنون",
    active: true,
  },
  {
    version: "نسخه ۲",
    title: "اخبار روز و اطلاعیه‌ها",
    description: "خوراک خبری دسته‌بندی‌شده، ذخیره خبر و مدیریت منابع RSS.",
    state: "اکنون",
    active: true,
  },
  {
    version: "نسخه ۳",
    title: "سامانه‌ها، ایجنت و نرخ‌نامه",
    description: "بانک سامانه‌ها، دستیار هوش مصنوعی با پایگاه دانش و نرخ‌نامه چندسطحی.",
    state: "اکنون",
    active: true,
  },
  {
    version: "نسخه ۳٫۱",
    title: "اشتراک و کارمندان",
    description: "مدل اشتراک، کارمندان و مدیریت دسترسی‌ها؛ همراه با پشتیبانی و راهنما.",
    state: "اکنون",
    active: true,
  },
];

const SAMPLE_ROWS = [
  { title: "شارژ حساب کاربر", amount: 120000, income: true },
  { title: "اجاره میز بازی", amount: 85000, income: true },
  { title: "تسویه اینترنت", amount: 240000, income: false },
];

export default function Landing() {
  const site = useQuery(api.siteCms.publicSite, {});
  const publicNav = useQuery(api.siteCms.publicNavigation, { location: "public" });
  const footerNav = useQuery(api.siteCms.publicNavigation, { location: "footer" });
  const managed = useManagedSettings();
  const home = site?.home;
  const sectionOrder = home?.sectionOrder ?? [...SECTION_ORDER_KEYS];
  const orderFor = (key: (typeof SECTION_ORDER_KEYS)[number]) => {
    const index = sectionOrder.indexOf(key);
    return index < 0 ? SECTION_ORDER_KEYS.length + 1 : index + 1;
  };
  const sectionStyle = (key: (typeof SECTION_ORDER_KEYS)[number]) => ({
    order: orderFor(key),
    display: home?.hiddenSections?.includes(key) ? "none" : undefined,
  });
  const features = home
    ?       home.features.map((feature) => ({
        ...feature,
        state: feature.active ? "فعال" : "غیرفعال",
        Icon: FEATURE_ICONS[feature.icon] ?? Sparkles,
      }))
    : FEATURES.map((feature) => ({ ...feature, Icon: feature.icon }));

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <Logo size="sm" />
          </Link>

          <nav className="mx-auto hidden items-center gap-1 rounded-2xl bg-card/40 p-1 md:flex">
            {(publicNav?.length
              ? publicNav
              : [
                  { id: "features", label: "امکانات", href: "/#features", isExternal: false },
                  { id: "version", label: "نسخه فعلی", href: "/#version", isExternal: false },
                  { id: "roadmap", label: "نقشه راه", href: "/#roadmap", isExternal: false },
                  { id: "plans", label: "اشتراک", href: "/#plans", isExternal: false },
                ]
            ).slice(0, 5).map((item) =>
              item.isExternal || item.href.startsWith("http") ? (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl px-3 py-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  to={item.href}
                  className="rounded-xl px-3 py-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ms-auto flex items-center gap-2 md:ms-0">
            <ThemeToggle />
            <a href="/manage" className="rounded-xl px-3 py-2 text-[11.5px] font-semibold text-primary hover:bg-card">مدیریت سایت</a>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden h-10 rounded-xl px-3 text-[11.5px] font-semibold text-foreground/80 hover:bg-card sm:inline-flex"
            >
              <Link to="/auth">ورود</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="clay-primary h-10 rounded-xl border-0 px-3.5 text-[11.5px] font-bold hover:brightness-105"
            >
              <Link to="/auth">
                دریافت حساب کافی‌نت
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {home?.announcementEnabled && home.announcementText.trim() && (
          <div className="order-first border-b border-primary/15 bg-primary/8 px-4 py-2.5 text-center text-[11px] font-semibold leading-5 text-primary">
            {home.announcementText}
          </div>
        )}
        {/* Hero */}
        <section className="relative" style={{ order: 0 }}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -start-24 top-10 size-72 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-20 top-40 size-64 rounded-full bg-accent/60 blur-3xl"
          />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-20 lg:px-8">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="relative"
            >
              <motion.div variants={rise}>
                <span className="clay-sm inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  {home?.heroEyebrow ?? "نسخه ۳٫۱ · دفتر مالی، ایجنت و پشتیبانی"}
                </span>
              </motion.div>

              <motion.h1
                variants={rise}
                className="mt-5 whitespace-pre-line text-[2rem] font-extrabold leading-[1.45] tracking-tight sm:text-[2.6rem] sm:leading-[1.4]"
              >
                {managed.heroTitle || home?.heroTitle || (
                  <>
                    همه ابزارهای کافی‌نت،
                    <br />
                    در یک{" "}
                    <span className="relative inline-block text-primary">
                      فضای کاری نرم
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 200 12"
                        preserveAspectRatio="none"
                        className="absolute -bottom-1 start-0 h-2.5 w-full text-primary/25"
                      >
                        <path
                          d="M2 8c40-6 90-6 196-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </>
                )}
              </motion.h1>

              <motion.p
                variants={rise}
                className="mt-5 max-w-xl text-[13px] leading-7 text-muted-foreground sm:text-sm sm:leading-8"
              >
                {managed.heroSubtitle || home?.heroSubtitle ||
                  "کافی‌نت‌یار فضای کاری فارسی کافی‌نت‌داران است؛ دفتر مالی ماندگار، اخبار روز، دسترسی سریع به سامانه‌ها و دستیار هوشمند. هر کافی‌نت داده و دسترسی مستقل خودش را دارد."}
              </motion.p>

              <motion.div
                variants={rise}
                className="mt-7 flex flex-wrap items-center gap-3"
              >
                <Button
                  asChild
                  size="lg"
                  className="clay-primary h-12 rounded-2xl border-0 px-5 text-[13px] font-bold hover:brightness-105"
                >
                  {home?.primaryCtaHref?.startsWith("http") ? (
                    <a href={home.primaryCtaHref}>
                      {home.primaryCtaLabel}
                      <ArrowLeft className="size-[18px]" />
                    </a>
                  ) : (
                    <Link to={home?.primaryCtaHref ?? "/auth"}>
                      {home?.primaryCtaLabel ?? "دریافت حساب از مدیر"}
                      <ArrowLeft className="size-[18px]" />
                    </Link>
                  )}
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="clay-sm h-12 rounded-2xl border-0 px-5 text-[13px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
                >
                  <a href={home?.secondaryCtaHref ?? "#features"}>
                    {home?.secondaryCtaLabel ?? "آشنایی با امکانات"}
                  </a>
                </Button>
              </motion.div>

              <motion.div
                variants={rise}
                className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10.5px] text-muted-foreground"
              >
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-primary" />
                  دریافت حساب امن با شماره موبایل
                </span>
                <span className="hidden size-1 rounded-full bg-border sm:block" />
                <span className="flex items-center gap-1">
                  <Users className="size-3.5 text-primary" />
                  مناسب برای کافی‌نت‌دار و کارمند شیفت
                </span>
              </motion.div>
            </motion.div>

            {/* Clay preview */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="relative mx-auto w-full max-w-md"
            >
              <div
                aria-hidden="true"
                className="animate-clay-bob absolute -start-6 -top-7 size-20 rotate-12 rounded-[26px] bg-[var(--tile-mint)]"
              />
              <div
                aria-hidden="true"
                className="animate-clay-drift absolute -bottom-6 -end-5 size-16 rounded-[22px] bg-[var(--tile-peach)]"
              />

              <div className="clay relative rounded-[32px] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <LogoMark size="sm" />
                    <div>
                      <p className="text-[12px] font-extrabold">
                        حسابداری کافی‌نت
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        پیش‌نمایش رابط کاربری
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
                    پیش‌نمایش
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="clay-inset rounded-[18px] p-3">
                    <p className="text-[9.5px] text-muted-foreground">
                      دریافتی نمونه
                    </p>
                    <p className="mt-1 text-[13px] font-extrabold">
                      {faNumber(500000)}
                      <span className="ms-1 text-[9px] font-medium text-muted-foreground">
                        تومان
                      </span>
                    </p>
                  </div>
                  <div className="clay-inset rounded-[18px] p-3">
                    <p className="text-[9.5px] text-muted-foreground">
                      هزینه نمونه
                    </p>
                    <p className="mt-1 text-[13px] font-extrabold">
                      {faNumber(380000)}
                      <span className="ms-1 text-[9px] font-medium text-muted-foreground">
                        تومان
                      </span>
                    </p>
                  </div>
                </div>

                <div className="clay-inset mt-2.5 flex h-[86px] items-end gap-1.5 rounded-[18px] px-3 py-3">
                  {[42, 66, 50, 78, 58, 92, 70].map((height, index) => (
                    <span
                      key={index}
                      className={cn(
                        "w-full rounded-full transition-all",
                        index === 5
                          ? "bg-primary"
                          : "bg-primary/25 dark:bg-primary/30",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  {SAMPLE_ROWS.map((row) => (
                    <div
                      key={row.title}
                      className="flex items-center justify-between gap-2 rounded-[14px] bg-card/60 px-2.5 py-2"
                    >
                      <span className="flex items-center gap-2 text-[10.5px] font-medium">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            row.income ? "bg-emerald-500" : "bg-rose-500",
                          )}
                        />
                        {row.title}
                      </span>
                      <span
                        className={cn(
                          "text-[10.5px] font-bold tabular-nums",
                          row.income
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300",
                        )}
                      >
                        {row.income ? "+" : "−"}
                        {faNumber(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="clay-sm absolute -bottom-4 start-4 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex">
                <span className="tile-mint grid size-7 place-items-center rounded-lg">
                  <Check className="size-3.5" />
                </span>
                <span className="text-[10px] font-semibold">
                  اعداد این کارت فقط پیش‌نمایش است
                </span>
              </div>
            </motion.div>
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">
                ساخته‌شده برای:
              </span>
              {AUDIENCES.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-card/70 px-3 py-1 font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          style={sectionStyle("features")}
        >
          <SectionHead
            eyebrow="امکانات"
            title="یک فضای کاری برای همه کارهای کافی‌نت"
            description="حسابداری، اخبار، بانک سامانه‌ها، ایجنت هوشمند و نرخ‌نامه؛ همه با حساب مستقل کافی‌نت و کنترل دسترسی."
          />

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8 grid gap-4 sm:grid-cols-2"
          >
            {features.map((feature) => {
              const Icon = feature.Icon;
              return (
                <motion.div key={feature.title} variants={rise}>
                  <div
                    className={cn(
                      "clay clay-lift h-full rounded-[30px] p-5 sm:p-6",
                      feature.active && "clay-primary",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">                        <span
                          className={cn(
                            "grid size-12 place-items-center rounded-[18px]",
                            feature.active
                              ? "bg-white/15 text-white"
                              : feature.tone,
                          )}
                        >
                        <Icon className="size-6" strokeWidth={1.8} />
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                          feature.active
                            ? "bg-white/15 text-white"
                            : "bg-muted/80 text-muted-foreground",
                        )}
                      >
                        {feature.state}
                      </span>
                    </div>
                    <h3
                      className={cn(
                        "mt-5 text-lg font-extrabold",
                        feature.active && "text-white",
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-[12.5px] leading-6",
                        feature.active ? "text-white/80" : "text-muted-foreground",
                      )}
                    >
                      {feature.description}
                    </p>
                    <div
                      className={cn(
                        "mt-5 flex items-center gap-1.5 border-t pt-3.5 text-[11px] font-semibold",
                        feature.active
                          ? "border-white/20 text-white"
                          : "border-border/60 text-muted-foreground",
                      )}
                    >
                      {feature.active ? (
                        <>
                          <Link to="/auth" className="hover:underline">
                            همین حالا امتحان کنید
                          </Link>
                          <ChevronLeft className="size-3.5" />
                        </>
                      ) : (
                        "در دست توسعه"
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Version focus */}
        <section
          id="version"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          style={sectionStyle("version")}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="دفتر مالی"
                title="حواس‌مان به حساب‌ها هست"
                description="دریافت‌ها و هزینه‌های کافی‌نت را ماندگار ثبت کنید؛ خلاصه روزانه، روند هفتگی و گزارش دسته‌بندی از داده‌های واقعی همان کافی‌نت ساخته می‌شود."
                align="start"
              />

              <ul className="mt-6 space-y-2.5">
                {[
                  "دفتر تراکنش ماندگار و مخصوص همین کافی‌نت",
                  "خلاصه دریافتی و هزینه و نمودار هفتگی",
                  "ابطال تراکنش با حفظ سابقه حسابرسی",
                  "کنترل مجوز ثبت و مشاهده در سمت سرور",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="tile-mint mt-0.5 grid size-5 shrink-0 place-items-center rounded-md">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="text-[12px] leading-6 text-muted-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="clay-inset mt-6 flex items-start gap-2.5 rounded-[22px] p-3.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-6 text-muted-foreground">
                  اعداد کارت کناری فقط برای پیش‌نمایش طراحی است. پس از ساخت
                  حساب، دفتر مالی با تراکنش‌های واقعی خودتان و به‌صورت ماندگار
                  ایجاد می‌شود.
                </p>
              </div>
            </div>

            <div className="clay rounded-[32px] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="tile-navy grid size-10 place-items-center rounded-[13px]">
                    <Wallet className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-[12px] font-extrabold">دفتر روزانه</p>
                    <p className="text-[10px] text-muted-foreground">
                      نمای پیش‌نمایش
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full text-[9.5px] font-medium"
                >
                  نمونه
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                {SAMPLE_ROWS.map((row) => (
                  <div
                    key={row.title}
                    className="clay-inset flex items-center justify-between gap-2 rounded-[16px] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-lg",
                          row.income ? "tile-mint" : "tile-peach",
                        )}
                      >
                        {row.income ? (
                          <Wallet className="size-3.5" />
                        ) : (
                          <Calculator className="size-3.5" />
                        )}
                      </span>
                      <span className="text-[11px] font-semibold">
                        {row.title}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-bold tabular-nums",
                        row.income
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300",
                      )}
                    >
                      {row.income ? "+" : "−"}
                      {faNumber(row.amount)}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="clay-primary mt-4 h-11 w-full rounded-2xl border-0 text-[12px] font-bold hover:brightness-105"
              >
                <Link to="/auth">دریافت حساب از مدیر</Link>
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                حساب واقعی با شماره موبایل؛ داده هر کافی‌نت مستقل است.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section
          id="benefits"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          style={sectionStyle("benefits")}
        >
          <SectionHead
            eyebrow="تجربه استفاده"
            title="نرم، خوانا و آماده رشد"
            description="ظاهر ماتی و برجسته کافی‌نت‌یار فقط یک انتخاب سلیقه‌ای نیست؛ خوانایی و آرامش بصری برای شیفت‌های طولانی هم در نظر گرفته شده است."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="clay rounded-[26px] p-5">
                  <span className="tile-navy grid size-11 place-items-center rounded-[14px]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-[13px] font-extrabold">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roadmap */}
        <section
          id="roadmap"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          style={sectionStyle("roadmap")}
        >
          <SectionHead
            eyebrow="نقشه راه"
            title="قدم به قدم، بدون وعده اضافه"
            description="فقط چیزی را نشان می‌دهیم که واقعاً در نسخه جاری وجود دارد؛ بقیه موارد با برچسب «در برنامه» مشخص شده‌اند."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((step, index) => (
              <div
                key={step.version}
                className={cn(
                  "relative rounded-[26px] p-5",
                  step.active ? "clay" : "clay-inset",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-xl text-[11px] font-extrabold",
                      step.active
                        ? "tile-navy"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {faNumber(index + 1)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9.5px] font-semibold",
                      step.active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.state}
                  </span>
                </div>
                <p className="mt-4 text-[10px] font-semibold text-muted-foreground">
                  {step.version}
                </p>
                <h3 className="mt-1 text-[13px] font-extrabold">{step.title}</h3>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section
          id="plans"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8"
          style={sectionStyle("plans")}
        >
          <SectionHead
            eyebrow="اشتراک"
            title="اشتراک یک‌ماهه کافی‌نت‌یار"
            description="۵۰۰ هزار تومان برای یک ماه؛ خرید و تمدید با هماهنگی در تلگرام."
          />
          <div className="mt-8">
            <MonthlyPlanCard />
          </div>
        </section>

        {/* Final CTA */}
        <section
          id="cta"
          className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8"
          style={sectionStyle("cta")}
        >
          <div className="clay-primary relative overflow-hidden rounded-[36px] p-7 text-center sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -start-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -end-8 size-44 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] font-semibold text-white">
                <Sparkles className="size-3.5" />
                حساب واقعی، فضای مستقل
              </span>
              <h2 className="mx-auto mt-4 max-w-lg text-xl font-extrabold leading-[1.6] text-white sm:text-2xl">
                کافی‌نت‌تان را منظم‌تر اداره کنید، از همین امروز
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[11.5px] leading-6 text-white/75">
                فضای کاری اختصاصی کافی‌نت خود را بسازید، کارمندان را با سطح
                دسترسی دقیق اضافه کنید، دفتر مالی را ماندگار ثبت کنید و اخبار
                و سامانه‌های کاربردی را در یک جا ببینید.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="clay-sm h-12 rounded-2xl border-0 px-5 text-[12.5px] font-bold text-primary hover:bg-transparent"
                >
                  <Link to="/auth">
                    ساخت حساب کافینت
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-12 rounded-2xl px-5 text-[12px] font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#features">مرور امکانات</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-card/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-sm">
            <Logo size="sm" />
            <p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">
              فضای کاری فارسی کافی‌نت‌داران؛ با دفتر مالی ماندگار، کنترل دسترسی
              مستقل و اطلاعات تأییدشده.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            {(footerNav?.length
              ? footerNav
              : [
                  { id: "help", label: "راهنما", href: "/help", isExternal: false },
                  { id: "contact", label: "تماس", href: "/contact", isExternal: false },
                  { id: "terms", label: "قوانین", href: "/legal/terms", isExternal: false },
                  { id: "privacy", label: "حریم خصوصی", href: "/legal/privacy", isExternal: false },
                ]
            ).slice(0, 8).map((item) =>
              item.isExternal || item.href.startsWith("http") ? (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  {item.label}
                </a>
              ) : (
                <Link key={item.id} to={item.href} className="hover:text-primary">
                  {item.label}
                </Link>
              ),
            )}
            <Link to="/auth" className="hover:text-primary">
              ورود
            </Link>
          </nav>
          <p className="text-[10px] text-muted-foreground/80">
            کافی‌نت‌یار · نسخه ۳٫۱ · دفتر مالی، پشتیبانی و مدیریت پلتفرم
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-start",
      )}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-2 text-xl font-extrabold leading-[1.6] tracking-tight sm:text-2xl">
        {title}
      </h2>
      <p className="mt-2.5 text-[11.5px] leading-6 text-muted-foreground sm:text-[12px] sm:leading-7">
        {description}
      </p>
    </div>
  );
}
