import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { ArrowRight, Loader2, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

/**
 * The owner console is deliberately narrower than the general admin area:
 * delegated roles can manage their allowed sections, but never this console.
 */
export function RequirePlatformOwner({ children }: { children: ReactNode }) {
  const { context } = useSession();
  const location = useLocation();

  if (context === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!context) {
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (!context.isPlatformOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="clay w-full max-w-md rounded-[30px] p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-rose-500/10 text-rose-700 dark:text-rose-300">
            <ShieldX className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold">
            این کنسول مخصوص مالک اصلی است
          </h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            نقش‌های مدیریتی واگذارشده به بخش‌های مجاز خود دسترسی دارند، اما
            تنظیمات امنیتی و مالکیت پلتفرم فقط از حساب بنیان‌گذار قابل مدیریت
            است.
          </p>
          <Button asChild className="mt-5 h-10 w-full rounded-xl text-[11px]">
            <Link to="/admin">
              بازگشت به پنل مدیریت
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
