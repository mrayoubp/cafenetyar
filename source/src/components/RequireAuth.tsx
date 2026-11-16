import { PhoneVerificationGate } from "./PhoneVerificationGate";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/**
 * Wraps a route that requires a signed-in user.
 *
 * Signed-out visitors are told which page needs an account, and signing in
 * returns them to it via `returnTo`. Pass `redirectImmediately` for a route
 * where the bounce really is the better experience.
 */
export function RequireAuth({
  children,
  title = "برای ادامه وارد شوید",
  description = "این بخش فقط برای کاربران واردشده در دسترس است.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Headline on the blocked screen. */
  title?: string;
  /** Says what the visitor gets by signing in. */
  description?: string;
  /** Skip the explanation and go straight to `/auth`. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="clay w-full max-w-md rounded-[32px] p-6 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <LogoMark size="lg" />
              <span className="clay-sm absolute -bottom-2 -end-2 grid size-8 place-items-center rounded-xl text-muted-foreground">
                <Lock className="size-3.5" />
              </span>
            </div>
          </div>

          <h1 className="mt-5 text-lg font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
            {description}
          </p>

          <div className="clay-inset mt-5 rounded-2xl p-3 text-[11px] leading-5 text-muted-foreground">
            پس از ورود، مستقیماً به همین صفحه بازمی‌گردید.
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => navigate(signInHref)}
              className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
            >
              ورود به کافی‌نت‌یار
              <ArrowRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/")}
              className="h-10 w-full rounded-xl text-[11.5px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              بازگشت به صفحه اصلی
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return import.meta.env.VITE_MANAGED_ACCOUNTS === "true" ? <PhoneVerificationGate>{children}</PhoneVerificationGate> : children;
}
