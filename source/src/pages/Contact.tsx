import { useManagedSettings } from "@/hooks/use-managed-content";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock3,
  Globe2,
  Instagram,
  LifeBuoy,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";

export default function Contact() {
  const managed = useManagedSettings();
  const profile = useQuery(api.platformAdmin.publicProfile, {});
  const cmsPage = useQuery(api.siteCms.publicPageBySlug, { slug: "contact" });
  const hasConfiguredContact =
    Boolean(profile?.supportEmail) ||
    Boolean(profile?.supportPhone) ||
    Boolean(profile?.supportAddress) ||
    Boolean(profile?.telegramUrl) ||
    Boolean(profile?.whatsappUrl) ||
    Boolean(profile?.instagramUrl);

  return (
    <PublicShell>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-3xl space-y-5"
      >
        <section className="clay relative overflow-hidden rounded-[34px] p-6 text-center sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-14 -top-16 size-52 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative">
            <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-primary/10 text-primary">
              <LifeBuoy className="size-7" />
            </span>
            <Badge variant="secondary" className="mt-4 rounded-full text-[9.5px]">
              پشتیبانی {profile?.platformName ?? "کافی‌نت‌یار"}
            </Badge>
            <h1 className="mt-3 text-2xl font-black">
              {cmsPage?.title ?? "با ما در تماس باشید"}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-[11.5px] leading-7 text-muted-foreground">
              {cmsPage?.summary ??
                "برای مشکلات حساب، پرداخت، داده یا امنیت از مسیرهای زیر کمک بگیرید. تیکت داخلی بهترین مسیر پیگیری است، چون وضعیت و پاسخ‌ها در حساب شما ثبت می‌شود."}
            </p>
          </div>
        </section>

        {managed.contact && <section className="clay whitespace-pre-line rounded-[28px] p-5 text-sm leading-8">{managed.contact}</section>}

        {cmsPage?.body && (
          <section className="clay rounded-[28px] p-5 text-[11px] leading-7 text-muted-foreground sm:p-6">
            {cmsPage.body.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph.slice(0, 20)} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="clay rounded-[26px] p-5">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">ایمیل</h2>
            </div>
            {profile?.supportEmail ? (
              <a
                href={`mailto:${profile.supportEmail}`}
                dir="ltr"
                className="mt-3 block break-all text-[11.5px] font-semibold text-primary hover:underline"
              >
                {profile.supportEmail}
              </a>
            ) : (
              <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">
                ایمیل پشتیبانی هنوز از پنل مدیریت تنظیم نشده است. از تیکت داخلی
                استفاده کنید.
              </p>
            )}
          </div>

          <div className="clay rounded-[26px] p-5">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">تلفن</h2>
            </div>
            {profile?.supportPhone ? (
              <a
                href={`tel:${profile.supportPhone.replace(/\s/g, "")}`}
                dir="ltr"
                className="mt-3 block text-[11.5px] font-semibold text-primary hover:underline"
              >
                {profile.supportPhone}
              </a>
            ) : (
              <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">
                شماره تماس پشتیبانی هنوز تنظیم نشده است.
              </p>
            )}
          </div>

          <div className="clay rounded-[26px] p-5 sm:col-span-2">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">نشانی</h2>
            </div>
            <p className="mt-2 text-[10.5px] leading-6 text-muted-foreground">
              {profile?.supportAddress ??
                "نشانی پشتیبانی هنوز توسط مدیر سامانه ثبت نشده است."}
            </p>
          </div>
        </div>

        <section className="clay rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">تیکت داخلی</h2>
            </div>
            <Badge variant="secondary" className="rounded-full text-[9px]">
              پیگیری داخل حساب
            </Badge>
          </div>
          <p className="mt-2 text-[10.5px] leading-6 text-muted-foreground">
            پس از ورود، از بخش پشتیبانی تیکت بسازید، دسته و اولویت را انتخاب کنید
            و پاسخ‌ها را در همان صفحه ببینید. برای اطلاعات حساس مثل رمز، کد
            بازیابی یا شماره کامل کارت ارسال نکنید.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold"
            >
              <Link to="/dashboard/support">
                ثبت تیکت
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-10 rounded-xl text-[11px]">
              <Link to="/auth?returnTo=%2Fdashboard%2Fsupport">
                ورود به حساب
              </Link>
            </Button>
          </div>
        </section>

        {(profile?.telegramUrl ||
          profile?.whatsappUrl ||
          profile?.instagramUrl ||
          profile?.websiteUrl) && (
          <section className="clay rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">شبکه‌های اجتماعی</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.telegramUrl && (
                <a
                  href={profile.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  <Send className="size-3.5" />
                  تلگرام
                </a>
              )}
              {profile.whatsappUrl && (
                <a
                  href={profile.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  <MessageCircle className="size-3.5" />
                  واتساپ
                </a>
              )}
              {profile.instagramUrl && (
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  <Instagram className="size-3.5" />
                  اینستاگرام
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  <Globe2 className="size-3.5" />
                  وب‌سایت
                </a>
              )}
            </div>
          </section>
        )}

        {!hasConfiguredContact && (
          <div className="clay-inset flex items-start gap-2 rounded-2xl p-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-[10px] leading-5 text-muted-foreground">
              اطلاعات تماس عمومی هنوز کامل تنظیم نشده است. مدیر سامانه می‌تواند
              آن را از «پنل مدیریت → تنظیمات پلتفرم» وارد کند. تا آن زمان تیکت
              داخلی در دسترس است.
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-[9.5px] text-muted-foreground">
          <Clock3 className="size-3.5" />
          زمان پاسخ‌گویی به حجم درخواست‌ها و نوع تیکت وابسته است.
        </div>
      </motion.div>
    </PublicShell>
  );
}
