import { Logo, LogoMark } from "@/components/Logo";
import { RecoveryCodeDialog } from "@/components/RecoveryCodeDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/backend/api";
import { useAction } from "@/backend/client";
import {
  PASSWORD_RULE,
  errorMessage,
  isValidPassword,
  normalizePhone,
  sanitizePhoneInput,
} from "@/lib/auth";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

export default function ForgotPassword() {
  const resetPassword = useAction(api.authActions.resetPasswordWithRecovery);
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("شماره موبایل معتبر نیست؛ نمونه: ۰۹۱۲۳۴۵۶۷۸۹.");
      return;
    }
    if (code.trim().length < 8) {
      setError("کد بازیابی را کامل وارد کنید (نمونه: ABCD-EFGH-JKLM).");
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(PASSWORD_RULE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("رمز عبور جدید و تکرار آن یکسان نیستند.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword({
        phone: normalized,
        recoveryCode: code.trim(),
        newPassword,
        confirmPassword,
      });
      setRecoveryCode(result.recoveryCode);
      setDone(true);
      setShowRecovery(true);
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          "بازنشانی رمز عبور ممکن نشد. اطلاعات را بررسی کنید.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -start-20 top-10 size-72 rounded-full bg-primary/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -end-16 size-80 rounded-full bg-accent/50 blur-3xl"
      />

      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/" aria-label="بازگشت به صفحه اصلی">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            <ArrowRight className="size-3.5" />
            بازگشت به ورود
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:pt-6">
        <div className="clay w-full max-w-md rounded-[32px] p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <LogoMark size="lg" />
            <h1 className="mt-4 text-xl font-extrabold tracking-tight">
              بازیابی رمز عبور
            </h1>
            <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
              با شماره موبایل، کد بازیابی یک‌باره و رمز عبور جدید، دسترسی حساب
              را بازنشانی کنید.
            </p>
          </div>

          {done ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col items-center rounded-2xl bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-300" />
                <p className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  رمز عبور با موفقیت تغییر کرد
                </p>
                <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                  همه نشست‌های قبلی این حساب بسته شدند. یک کد بازیابی جدید هم
                  صادر شد؛ آن را ذخیره کنید.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate("/auth")}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
              >
                ورود با رمز جدید
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-phone" className="text-[11.5px] font-semibold">
                  شماره موبایل
                </Label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reset-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="username"
                    required
                    disabled={loading}
                    value={phone}
                    onChange={(event) =>
                      setPhone(sanitizePhoneInput(event.target.value))
                    }
                    placeholder="09123456789"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] shadow-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-code" className="text-[11.5px] font-semibold">
                  کد بازیابی
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reset-code"
                    required
                    disabled={loading}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="ABCD-EFGH-JKLM"
                    dir="ltr"
                    autoCapitalize="characters"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] tracking-[0.12em] shadow-none"
                  />
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  کد بازیابی هنگام ساخت حساب یا آخرین بازنشانی رمز نمایش داده
                  شده است.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reset-password"
                  className="text-[11.5px] font-semibold"
                >
                  رمز عبور جدید
                </Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                    className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  {PASSWORD_RULE}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reset-confirm"
                  className="text-[11.5px] font-semibold"
                >
                  تکرار رمز عبور جدید
                </Label>
                <Input
                  id="reset-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="clay-inset h-11 rounded-xl border-0 bg-transparent text-left text-[12.5px] shadow-none"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    در حال بازنشانی…
                  </>
                ) : (
                  <>
                    تغییر رمز عبور
                    <ArrowRight className="size-4 rotate-180" />
                  </>
                )}
              </Button>

              <Link
                to="/auth"
                className="block text-center text-[11px] font-semibold text-primary hover:underline"
              >
                بازگشت به صفحه ورود
              </Link>
            </form>
          )}

          <div className="clay-inset mt-5 flex items-start gap-2 rounded-2xl p-3">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="text-[10px] leading-5 text-muted-foreground">
              بدون کد بازیابی، بازنشانی رمز از طریق این صفحه ممکن نیست. کد
              بازیابی فقط به‌صورت هش‌شده در سرور نگهداری می‌شود و قابل بازیابی
              نیست.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative pb-6 text-center text-[10px] text-muted-foreground">
        کافی‌نت‌یار · نسخه ۳٫۱
      </footer>

      <RecoveryCodeDialog
        code={recoveryCode}
        open={showRecovery}
        onOpenChange={setShowRecovery}
        title="کد بازیابی جدید"
        description="رمز شما تغییر کرد. کد جدید را ذخیره کنید؛ کد قبلی دیگر معتبر نیست."
      />
    </div>
  );
}
