import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Bot,
  Calculator,
  CheckCircle2,
  CreditCard,
  Globe2,
  LifeBuoy,
  Newspaper,
  ReceiptText,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router";

const QUICKSTART_STEPS = [
  {
    title: "ثبت‌نام صاحب کافی‌نت",
    description:
      "با شماره موبایل و رمز عبور حساب بسازید. کد بازیابی را در محل امن نگه دارید.",
    href: "/auth?mode=signup",
    linkLabel: "ساخت حساب",
    icon: UserPlus,
  },
  {
    title: "ایجاد محیط کاری کافی‌نت",
    description:
      "نام، استان، شهر و نشانی مجموعه را وارد کنید تا فضای مستقل کافی‌نت ساخته شود.",
    href: "/setup",
    linkLabel: "تکمیل محیط",
    icon: Store,
  },
  {
    title: "تنظیم اطلاعات و تماس",
    description:
      "نام مجموعه و اطلاعات پایه را از تنظیمات کافی‌نت بررسی و به‌روز کنید.",
    href: "/dashboard/cafe",
    linkLabel: "تنظیمات کافی‌نت",
    icon: ShieldCheck,
  },
  {
    title: "افزودن کارمندان",
    description:
      "برای هر کارمند حساب جداگانه بسازید و فقط دسترسی‌های لازم برای وظیفه او را فعال کنید.",
    href: "/dashboard/employees",
    linkLabel: "مدیریت کارمندان",
    icon: Users,
  },
  {
    title: "شروع دفتر مالی",
    description:
      "اولین دریافت یا هزینه را ثبت کنید. مبالغ ماندگار ذخیره می‌شوند و با refresh از بین نمی‌روند.",
    href: "/dashboard/accounting",
    linkLabel: "باز کردن حسابداری",
    icon: Calculator,
  },
  {
    title: "دیدن اخبار و اطلاعیه‌ها",
    description:
      "اخبار منتشرشده و اطلاعیه‌های مهم را مطالعه کنید؛ خبرهای زمان‌بندی‌شده پیش از موعد نمایش داده نمی‌شوند.",
    href: "/dashboard/news",
    linkLabel: "اخبار روز",
    icon: Newspaper,
  },
  {
    title: "استفاده از بانک سامانه‌ها",
    description:
      "سامانه‌های رسمی و پرکاربرد را جستجو، ذخیره یا پیشنهاد دهید.",
    href: "/dashboard/sites",
    linkLabel: "بانک سامانه‌ها",
    icon: Globe2,
  },
  {
    title: "کار با دستیار هوشمند",
    description:
      "دستیار برای موضوعات نرخ‌نامه و دانش تأییدشده به شما کمک می‌کند؛ پاسخ بدون منبع را به‌عنوان اطلاعات قطعی نگیرید.",
    href: "/dashboard/agent",
    linkLabel: "گفت‌وگو با دستیار",
    icon: Bot,
  },
  {
    title: "بررسی نرخ خدمات",
    description:
      "نرخ‌های تأییدشده و نرخ اختصاصی کافی‌نت خود را ببینید و مبلغ خدمات را شفاف محاسبه کنید.",
    href: "/dashboard/rates",
    linkLabel: "نرخ‌نامه",
    icon: ReceiptText,
  },
  {
    title: "خرید یا تمدید اشتراک",
    description:
      "پلن مناسب را انتخاب کنید. فعال‌سازی پرداخت فقط پس از تأیید سمت سرور انجام می‌شود.",
    href: "/dashboard/subscription",
    linkLabel: "مدیریت اشتراک",
    icon: CreditCard,
  },
];

const FAQS = [
  {
    question: "برای شروع به چه چیزی نیاز دارم؟",
    answer:
      "با شماره موبایل ثبت‌نام کنید، نام و اطلاعات کافی‌نت را وارد کنید و اولین تراکنش دفتر مالی را ثبت کنید. ممکن است تا آماده‌سازی پلن و فضای کاری، برخی امکانات محدود باشند.",
  },
  {
    question: "اطلاعات کافی‌نت من برای کافی‌نت دیگر قابل مشاهده است؟",
    answer:
      "نه. مالکیت داده از نشست سرور تعیین می‌شود و کوئری‌ها و تغییرات به کافی‌نت همان حساب محدود هستند. تست‌های جداسازی برای کارمند، تیکت، گفت‌وگو و دفتر مالی وجود دارد.",
  },
  {
    question: "آیا تراکنش‌های حسابداری با refresh پاک می‌شوند؟",
    answer:
      "نه. تراکنش‌های نسخه فعلی در دیتابیس ذخیره می‌شوند. ابطال تراکنش رکورد را حذف نمی‌کند و برای حفظ سابقه، آن را از جمع‌ها کنار می‌گذارد.",
  },
  {
    question: "چطور رمز عبورم را بازیابی کنم؟",
    answer:
      "در صفحه ورود از مسیر «فراموشی رمز» و کد بازیابی استفاده کنید. کد بازیابی فقط یک بار نمایش داده می‌شود؛ اگر آن را ندارید از پشتیبانی کمک بگیرید. تعداد تلاش‌های بازیابی محدود است.",
  },
  {
    question: "پرداخت اشتراک چطور تأیید می‌شود؟",
    answer:
      "تأیید پرداخت فقط سمت سرور و پس از بررسی درگاه انجام می‌شود. بازگشت مرورگر به صفحه موفق به‌تنهایی اشتراک را فعال نمی‌کند. اگر مبلغی کسر شد اما سفارش تأیید نشد، دوباره پرداخت نکنید و تیکت بزنید.",
  },
  {
    question: "چرا بعضی امکانات در پلن من غیرفعال است؟",
    answer:
      "دسترسی به ایجنت، نرخ‌نامه و گزارش‌های پیشرفته به پلن فعال وابسته است. محدودیت در سمت سرور اعمال می‌شود؛ با ارتقای پلن اطلاعات قبلی حذف نمی‌شود.",
  },
  {
    question: "اعلان‌ها کجا نمایش داده می‌شوند؟",
    answer:
      "اعلان‌های سراسری و رویدادهای حساب در زنگ بالای داشبورد نمایش داده می‌شوند. اعلان‌های ایمیلی و پیامکی فقط پس از اتصال واقعی سرویس مربوط فعال می‌شوند و وضعیت آن در تنظیمات مشخص است.",
  },
  {
    question: "آیا می‌توانم داده یا حسابم را حذف کنم؟",
    answer:
      "درخواست حذف یا اصلاح داده از پشتیبانی ثبت می‌شود. برای جلوگیری از حذف غیرمجاز، بررسی هویت لازم است و برخی سوابق مالی/امنیتی ممکن است طبق الزامات نگهداری شوند.",
  },
  {
    question: "چه اطلاعاتی را در تیکت نفرستم؟",
    answer:
      "رمز عبور، کد بازیابی، CVV یا شماره کامل کارت را در تیکت یا پیام عمومی نفرستید. برای پیگیری پرداخت فقط شماره سفارش و زمان تراکنش را اعلام کنید.",
  },
];

export default function HelpCenter() {
  const profile = useQuery(api.platformAdmin.publicProfile, {});
  const cmsPage = useQuery(api.siteCms.publicPageBySlug, { slug: "guide" });
  const contactEmail = profile?.supportEmail;
  const contactPhone = profile?.supportPhone;

  return (
    <PublicShell>
      <div className="space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="clay relative overflow-hidden rounded-[34px] p-6 sm:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-12 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative max-w-2xl">
            <Badge variant="secondary" className="rounded-full text-[9.5px]">
              <BookOpen className="size-3" />
              مرکز راهنمای فارسی
            </Badge>
            <h1 className="mt-4 text-2xl font-black leading-9 sm:text-3xl">
              {cmsPage?.title ?? "از اولین ورود تا دفتر مالی روزانه"}
            </h1>
            <p className="mt-3 text-[12px] leading-7 text-muted-foreground">
              {cmsPage?.summary ??
                "راهنمای شروع سریع، پاسخ پرسش‌های متداول و مسیرهای پشتیبانی. اگر پاسخ سؤالتان را پیدا نکردید، از صفحه تماس یا تیکت داخل برنامه استفاده کنید."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                asChild
                className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold"
              >
                <a href="#quickstart">
                  شروع سریع
                  <ArrowLeft className="size-3.5" />
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl text-[11px]"
              >
                <Link to="/contact">تماس با پشتیبانی</Link>
              </Button>
            </div>
          </div>
        </motion.section>

        {cmsPage?.body && (
          <section className="clay rounded-[26px] p-5 text-[11px] leading-7 text-muted-foreground">
            {cmsPage.body.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph.slice(0, 20)} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </section>
        )}

        <section id="quickstart" className="scroll-mt-24 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold text-primary">راهنمای گام‌به‌گام</p>
              <h2 className="mt-1 text-lg font-black">شروع کار در ۱۰ گام</h2>
            </div>
            <span className="text-[9.5px] text-muted-foreground">
              همه مراحل از منوی داشبورد در دسترس‌اند
            </span>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {QUICKSTART_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="clay rounded-[22px] p-3.5 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          گام {index + 1}
                        </span>
                        <h3 className="text-[11.5px] font-extrabold">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                        {step.description}
                      </p>
                      <Link
                        to={step.href}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      >
                        {step.linkLabel}
                        <ArrowLeft className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="clay rounded-[30px] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">پرسش‌های متداول</h2>
              <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                پاسخ‌های کوتاه درباره حساب، داده مالی، اشتراک و امنیت.
              </p>
            </div>
          </div>
          <Accordion type="single" collapsible className="mt-4 w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${index}`}
                className="border-border/50"
              >
                <AccordionTrigger className="py-3 text-start text-[11.5px] font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-[10.5px] leading-6 text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section
          id="contact"
          className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="clay-primary rounded-[30px] p-6 text-white">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-5" />
              <h2 className="text-base font-extrabold">پاسخ را پیدا نکردید؟</h2>
            </div>
            <p className="mt-2 text-[11px] leading-6 text-white/80">
              تیم پشتیبانی درخواست شما را بررسی می‌کند. برای پیگیری سریع‌تر،
              دسته و اولویت درست را انتخاب کنید و اطلاعات حساس را ارسال نکنید.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                asChild
                className="clay-sm h-10 rounded-xl border-0 bg-white/90 text-[11px] font-bold text-primary hover:bg-white"
              >
                <Link to="/dashboard/support">ثبت تیکت پشتیبانی</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl text-[11px] text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/contact">اطلاعات تماس</Link>
              </Button>
            </div>
          </div>
          <div className="clay rounded-[30px] p-5">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">راه‌های ارتباط</h2>
            </div>
            <div className="mt-4 space-y-2 text-[10.5px] leading-5 text-muted-foreground">
              {contactEmail ? (
                <p>
                  ایمیل:{" "}
                  <a
                    href={`mailto:${contactEmail}`}
                    dir="ltr"
                    className="text-primary hover:underline"
                  >
                    {contactEmail}
                  </a>
                </p>
              ) : (
                <p>ایمیل پشتیبانی هنوز توسط مدیر تنظیم نشده است.</p>
              )}
              {contactPhone ? (
                <p>
                  تلفن:{" "}
                  <a
                    href={`tel:${contactPhone.replace(/\s/g, "")}`}
                    dir="ltr"
                    className="text-primary hover:underline"
                  >
                    {contactPhone}
                  </a>
                </p>
              ) : (
                <p>شماره تماس پشتیبانی هنوز تنظیم نشده است.</p>
              )}
              <p>
                پاسخ‌گویی از طریق تیکت داخلی انجام می‌شود و وضعیت درخواست در همان
                صفحه قابل پیگیری است.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
