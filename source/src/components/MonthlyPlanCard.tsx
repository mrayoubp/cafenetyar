import { Button } from "@/components/ui/button";
import { CalendarClock, Send } from "lucide-react";

export const TELEGRAM_PURCHASE_URL =
  "https://t.me/Cafenetyarr?text=" +
  encodeURIComponent("سلام، برای خرید یا تمدید اشتراک یک‌ماهه کافی‌نت‌یار به مبلغ ۵۰۰٬۰۰۰ تومان پیام می‌دهم. لطفاً راهنمایی کنید.");

export function MonthlyPlanCard() {
  return (
    <article className="clay relative mx-auto w-full max-w-xl rounded-[30px] p-6 sm:p-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
        <CalendarClock className="size-4" /> اشتراک یک‌ماهه
      </span>
      <h3 className="mt-5 text-xl font-extrabold">اشتراک کافی‌نت‌یار</h3>
      <div className="my-5 flex flex-wrap items-baseline gap-2">
        <strong className="text-4xl font-black tracking-tight">۵۰۰٬۰۰۰</strong>
        <span className="text-sm text-muted-foreground">تومان / یک ماه</span>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">
        برای خرید یا تمدید اشتراک، در تلگرام با ما در ارتباط باشید. هماهنگی پرداخت و فعال‌سازی از طریق پشتیبانی انجام می‌شود.
      </p>
      <Button asChild className="clay-primary mt-6 h-12 w-full rounded-xl border-0 text-sm font-bold">
        <a href={TELEGRAM_PURCHASE_URL} target="_blank" rel="noopener noreferrer">
          <Send className="size-4" /> خرید و تمدید از طریق تلگرام
        </a>
      </Button>
      <a href="https://t.me/Cafenetyarr" target="_blank" rel="noopener noreferrer" dir="ltr" className="mt-3 block text-center text-sm font-semibold text-primary hover:underline">
        @Cafenetyarr
      </a>
    </article>
  );
}
