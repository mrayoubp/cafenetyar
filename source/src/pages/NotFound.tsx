import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
    >
      <div className="clay relative w-full max-w-md overflow-hidden rounded-[32px] p-7 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-12 size-36 rounded-full bg-primary/10 blur-2xl"
        />
        <div className="flex justify-center">
          <LogoMark size="lg" />
        </div>
        <p className="mt-5 text-3xl font-extrabold tracking-tight text-primary">
          ۴۰۴
        </p>
        <h1 className="mt-2 text-lg font-extrabold">این صفحه پیدا نشد</h1>
        <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
          آدرس واردشده وجود ندارد یا جابه‌جا شده است. از داشبورد شروع کنید تا
          همه بخش‌ها در دسترس باشند.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            asChild
            className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
          >
            <Link to="/dashboard">
              <Compass className="size-4" />
              رفتن به داشبورد
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="h-10 w-full rounded-xl text-[11.5px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Link to="/">
              <ArrowRight className="size-3.5" />
              بازگشت به صفحه اصلی
            </Link>
          </Button>
        </div>
      </div>
    </motion.main>
  );
}
