import { Link } from "react-router";
import { Logo } from "@/components/Logo";
export default function Setup() {
  return (
    <main dir="rtl" className="min-h-screen grid place-items-center p-6">
      <section className="clay max-w-lg rounded-3xl p-7 space-y-5">
        <Logo size="sm" />
        <h1 className="text-xl font-bold">تنظیم ورود مستقل و فضای کاری</h1>
        <p className="text-sm leading-8 text-muted-foreground">
          مالک باید در پنل مدیریت، بخش «انتقال و پشتیبان‌گیری»، نام کاربری و رمز
          مستقل را تنظیم کند. اگر دادهٔ مالی قبلی در این سایت وجود دارد، همان
          فضای کاری را انتخاب کند تا سوابق نمایش داده شوند.
        </p>
        <a
          className="inline-flex rounded-xl bg-primary text-primary-foreground px-5 py-3 font-bold"
          href="/manage"
        >
          رفتن به مدیریت
        </a>
        <Link className="block text-sm text-muted-foreground" to="/">
          بازگشت به سایت
        </Link>
      </section>
    </main>
  );
}
