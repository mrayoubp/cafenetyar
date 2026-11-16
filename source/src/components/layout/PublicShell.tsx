import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, LifeBuoy, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const LEGAL_LINKS = [
  { to: "/legal/terms", label: "شرایط استفاده" },
  { to: "/legal/privacy", label: "حریم خصوصی" },
  { to: "/legal/subscription", label: "سیاست اشتراک" },
  { to: "/legal/refund", label: "لغو و بازپرداخت" },
  { to: "/legal/security", label: "امنیت حساب" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const publicNav = useQuery(api.siteCms.publicNavigation, { location: "public" });
  const footerNav = useQuery(api.siteCms.publicNavigation, { location: "footer" });
  const headerItems = publicNav?.length
    ? publicNav
    : [
        { id: "help", label: "راهنما", href: "/help", isExternal: false },
        { id: "terms", label: "قوانین", href: "/legal/terms", isExternal: false },
        { id: "contact", label: "تماس", href: "/contact", isExternal: false },
      ];
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -start-28 -top-28 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -end-24 size-80 rounded-full bg-primary/10 opacity-70 blur-3xl"
      />

      <header className="relative z-10 border-b border-border/40 bg-background/65 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" aria-label="کافی‌نت‌یار">
            <Logo size="sm" showTagline={false} />
          </Link>
          <nav className="me-auto flex flex-wrap items-center gap-1 text-[10.5px] text-muted-foreground">
            {headerItems.slice(0, 4).map((item) => {
              const Icon =
                item.href.includes("help")
                  ? BookOpen
                  : item.href.includes("legal")
                    ? Scale
                    : LifeBuoy;
              return item.isExternal || item.href.startsWith("http") ? (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/60 hover:text-foreground sm:inline-flex"
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  to={item.href}
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <Button
            asChild
            className="clay-primary h-9 rounded-xl border-0 px-3 text-[11px] font-bold"
          >
            <Link to="/auth">
              ورود
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>

      <footer className="relative z-10 border-t border-border/40 bg-card/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-sm">
              <Logo size="sm" />
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                فضای کاری فارسی برای مدیریت روزمره کافی‌نت؛ با کنترل دسترسی
                مستقل، دفتر مالی ماندگار و اطلاعات تأییدشده.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10.5px] text-muted-foreground sm:grid-cols-3">
              {(footerNav?.length ? footerNav : LEGAL_LINKS.map((item, index) => ({
                id: `legal-${index}`,
                label: item.label,
                href: item.to,
                isExternal: false,
              }))).map((item) =>
                item.href.startsWith("http") ? (
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
                ورود به حساب
              </Link>
            </nav>
          </div>
          <p className="border-t border-border/40 pt-4 text-[9.5px] leading-5 text-muted-foreground/80">
            محتوای صفحات حقوقی این نسخه پیش‌نویس است و پیش از بهره‌برداری تجاری
            باید با قوانین محل فعالیت و محل نگهداری داده تطبیق داده شود.
          </p>
        </div>
      </footer>
    </div>
  );
}
