import { Logo, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { accountEmail, errorMessage, toLatinDigits } from "@/lib/auth";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

export default function AuthPage({
  redirectAfterAuth = "/dashboard",
}: {
  redirectAfterAuth?: string;
}) {
  const { isLoading, isAuthenticated, signIn, accessError } = useAuth(),
    navigate = useNavigate();
  const [params] = useSearchParams();
  const target = params.get("returnTo");
  const redirect =
    target?.startsWith("/") &&
    !target.startsWith("//") &&
    !target.includes("\\")
      ? target
      : redirectAfterAuth;
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(redirect, { replace: true });
  }, [isLoading, isAuthenticated, navigate, redirect]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn("password", {
        identifier: toLatinDigits(identifier).trim(),
        password,
      });
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "شماره یا نام کاربری و رمز عبور درست نیست."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link to="/">
          <Logo size="sm" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="clay w-full max-w-md rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark size="lg" />
            <h1 className="mt-5 text-2xl font-extrabold">
              ورود به کافی‌نت‌یار
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              با شماره موبایل یا نام کاربری اختصاصی و رمز دریافتی از مدیر وارد
              شو.
            </p>
          </div>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-identifier">
                شماره موبایل یا نام کاربری
              </Label>
              <Input
                id="login-identifier"
                name="username"
                dir="ltr"
                autoComplete="username"
                required
                maxLength={40}
                disabled={busy}
                value={identifier}
                onChange={(e) => setIdentifier(toLatinDigits(e.target.value))}
                placeholder="09123456789 / username"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">رمز عبور</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  dir="ltr"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl pl-12"
                />
                <button
                  type="button"
                  className="absolute left-3 top-3 p-1"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "پنهان‌کردن رمز" : "نمایش رمز"}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {(error || accessError) && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm leading-6 text-destructive"
              >
                {error || accessError}
              </p>
            )}
            <Button
              disabled={busy || isLoading}
              className="h-12 w-full rounded-xl text-base font-bold"
            >
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LockKeyhole size={18} />
              )}
              ورود به حساب
            </Button>
            <Link
              to="/forgot-password"
              className="block text-center text-sm text-muted-foreground"
            >
              بازیابی رمز با کد بازیابی
            </Link>
          </form>
          <div className="mt-6 flex gap-3 rounded-xl bg-primary/8 p-4">
            <ShieldCheck className="mt-1 shrink-0 text-primary" size={19} />
            <p className="text-sm leading-7 text-muted-foreground">
              ثبت‌نام عمومی بسته است. برای دریافت حساب یا رفع مشکل ورود با{" "}
              <a
                className="font-bold text-primary"
                href="https://t.me/Cafenetyarr"
                target="_blank"
                rel="noopener noreferrer"
              >
                مدیر در تلگرام
              </a>{" "}
              تماس بگیر.
            </p>
          </div>
          <Link
            to="/"
            className="mt-5 block text-center text-sm text-muted-foreground"
          >
            بازگشت به سایت
          </Link>
        </div>
      </main>
    </div>
  );
}
