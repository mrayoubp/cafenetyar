import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { errorMessage, maskPhone } from "@/lib/auth";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Outlet } from "react-router";

type SetupData = { secret: string; uri: string };

/**
 * A server-backed 2FA gate around every admin surface. The backend repeats
 * the same check on each owner query/mutation, so hiding this component is
 * not enough to bypass it. An owner without an authenticator is required to
 * enroll before the console is rendered.
 */
export function AdminMfaGate() {
  const { context } = useSession();
  const { signOut } = useAuth();
  const status = useQuery(
    api.superAdmin.securityStatus,
    context?.isSiteAdmin ? {} : "skip",
  );
  const verifyMfa = useMutation(api.superAdmin.verifyMfa);
  const beginMfaSetup = useMutation(api.superAdmin.beginMfaSetup);
  const confirmMfaSetup = useMutation(api.superAdmin.confirmMfaSetup);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const ownerNeedsSetup =
    Boolean(context?.isPlatformOwner) &&
    status?.isPlatformOwner === true &&
    !status.mfaEnabled;
  const ownerNeedsChallenge =
    Boolean(context?.isPlatformOwner) &&
    status?.isPlatformOwner === true &&
    status.mfaEnabled &&
    (!status.verified ||
      (status.verificationExpiresAt !== null &&
        status.verificationExpiresAt <= now));

  useEffect(() => {
    if (!ownerNeedsChallenge) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [ownerNeedsChallenge]);

  if (!context || !context.isPlatformOwner) {
    return <Outlet />;
  }

  if (status === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!status.isPlatformOwner) {
    return <Outlet />;
  }

  const submitVerify = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("کد ۶ رقمی برنامه Authenticator را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyMfa({ code: code.trim() });
      if (!result.ok) throw new Error("کد تأیید نادرست یا منقضی است.");
      setCode("");
      setNow(Date.now());
    } catch (submitError) {
      setError(
        errorMessage(submitError, "تأیید کد انجام نشد. دوباره تلاش کنید."),
      );
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await beginMfaSetup({});
      setSetup(result);
    } catch (setupError) {
      setError(
        errorMessage(setupError, "شروع راه‌اندازی دومرحله‌ای ممکن نشد."),
      );
    } finally {
      setLoading(false);
    }
  };

  const submitSetup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("کد ۶ رقمی برنامه Authenticator را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      const result = await confirmMfaSetup({ code: code.trim() });
      if (!result.ok) throw new Error("کد تأیید نادرست است.");
      setCode("");
      setSetup(null);
      setNow(Date.now());
    } catch (setupError) {
      setError(errorMessage(setupError, "فعال‌سازی دومرحله‌ای ممکن نشد."));
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("کپی خودکار ممکن نشد؛ کلید را دستی انتخاب و کپی کنید.");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_0%,oklch(0.94_0.03_250),transparent_45%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_20%_0%,oklch(0.28_0.04_260),transparent_45%)]">
      <div className="absolute -end-24 top-10 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="clay relative w-full max-w-md rounded-[32px] p-7">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="text-[10px] font-bold text-muted-foreground">
              مدیریت کل کافی‌نت‌یار
            </p>
            <p className="text-lg font-extrabold tracking-tight">
              {ownerNeedsSetup ? "فعال‌سازی دومرحله‌ای" : "تأیید دومرحله‌ای"}
            </p>
          </div>
        </div>

        {ownerNeedsSetup ? (
          <>
            <div className="clay-inset mt-6 rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="size-4" />
                </span>
                <p className="text-[11px] leading-6 text-muted-foreground">
                  ورود به کنسول مالک بدون احراز هویت دومرحله‌ای مجاز نیست. برای
                  ادامه، یک برنامه Authenticator نصب کنید و حساب{" "}
                  <span className="font-bold text-foreground">
                    {maskPhone(context.user.phone)}
                  </span>{" "}
                  را متصل کنید.
                </p>
              </div>
            </div>

            {!setup ? (
              <div className="mt-5 space-y-3">
                {error && <ErrorMessage>{error}</ErrorMessage>}
                <Button
                  type="button"
                  onClick={startSetup}
                  disabled={loading}
                  className="clay-primary h-11 w-full rounded-xl border-0 text-[12px] font-bold"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  شروع راه‌اندازی امن
                </Button>
                <p className="text-center text-[9.5px] leading-5 text-muted-foreground">
                  کلید اتصال فقط یک بار نمایش داده می‌شود و در دیتابیس به‌صورت
                  محرمانه نگهداری می‌شود.
                </p>
              </div>
            ) : (
              <form onSubmit={submitSetup} className="mt-5 space-y-4">
                <div className="clay-inset space-y-2 rounded-2xl p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold">
                    <Smartphone className="size-3.5" />
                    کلید دستی برنامه Authenticator
                  </p>
                  <div className="flex items-center gap-2">
                    <code
                      dir="ltr"
                      className="min-w-0 flex-1 select-all break-all rounded-lg bg-background/60 px-2 py-2 text-center font-mono text-[11px] tracking-wider"
                    >
                      {setup.secret}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={copySecret}
                      className="size-8 shrink-0 rounded-lg"
                      aria-label="کپی کلید دومرحله‌ای"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                  <a
                    href={setup.uri}
                    className="block truncate text-[9.5px] text-primary underline-offset-4 hover:underline"
                    dir="ltr"
                  >
                    افزودن خودکار به برنامه Authenticator
                  </a>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mfa-setup-code" className="text-[11px] font-bold">
                    کد ۶ رقمی نمایش‌داده‌شده
                  </label>
                  <Input
                    id="mfa-setup-code"
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value.replace(/[^\d]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    dir="ltr"
                    placeholder="••••••"
                    className="clay-inset h-12 rounded-xl border-0 text-center font-mono text-xl tracking-[0.45em]"
                  />
                </div>

                {error && <ErrorMessage>{error}</ErrorMessage>}

                <Button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="clay-primary h-11 w-full rounded-xl border-0 text-[12px] font-bold"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  فعال‌سازی و ورود به کنسول
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="clay-inset mt-6 rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-4" />
                </span>
                <p className="text-[11px] leading-6 text-muted-foreground">
                  این نشست هنوز تأیید دومرحله‌ای ندارد. کد ۶ رقمی برنامه
                  Authenticator حساب{" "}
                  <span className="font-bold text-foreground">
                    {maskPhone(context.user.phone)}
                  </span>{" "}
                  را وارد کنید.
                </p>
              </div>
            </div>

            <form onSubmit={submitVerify} className="mt-5 space-y-3">
              <label htmlFor="mfa-code" className="text-[11px] font-bold">
                کد تأیید
              </label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                dir="ltr"
                placeholder="••••••"
                className="clay-inset h-12 rounded-xl border-0 text-center font-mono text-xl tracking-[0.45em]"
              />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12px] font-bold"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                تأیید و ورود به پنل
              </Button>
            </form>
          </>
        )}

        <button
          type="button"
          onClick={async () => {
            await signOut();
            window.location.assign("/");
          }}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          خروج از این حساب
        </button>

        {ownerNeedsChallenge && (
          <p className="mt-4 text-center text-[9.5px] leading-5 text-muted-foreground">
            تأیید قبلی منقضی شده است؛ برای امنیت بیشتر، هر ۳۰ دقیقه دوباره کد
            لازم است.
          </p>
        )}
      </div>
    </main>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[10.5px] leading-5 text-rose-700 dark:text-rose-300">
      {children}
    </p>
  );
}
