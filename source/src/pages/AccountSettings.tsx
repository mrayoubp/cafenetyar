import { AppShell } from "@/components/layout/AppShell";
import { RecoveryCodeDialog } from "@/components/RecoveryCodeDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import {
  PASSWORD_RULE,
  errorMessage,
  isValidPassword,
} from "@/lib/auth";
import { faDateLong } from "@/lib/format";
import { useAction, useMutation } from "convex/react";
import {
  Check,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function AccountSettings() {
  const { context } = useSession();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const revokeAllSessions = useMutation(api.managedAccounts.revokeAllSessions);
  const [revoking, setRevoking] = useState(false);
  const updateName = useMutation(api.tenancy.updateProfileName);
  const changePassword = useAction(api.authActions.changePassword);
  const regenerateRecovery = useAction(
    api.authActions.regenerateRecoveryCode,
  );

  const [name, setName] = useState(context?.user.name ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const memberSince = context?.cafe?.createdAt;

  const handleName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 3) {
      toast.error("نام و نام خانوادگی را کامل وارد کنید.");
      return;
    }
    setNameLoading(true);
    try {
      await updateName({ name: name.trim() });
      toast.success("نام حساب به‌روزرسانی شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "ذخیره نام ممکن نشد."));
    } finally {
      setNameLoading(false);
    }
  };

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    if (!passwords.current) {
      setPasswordError("رمز عبور فعلی را وارد کنید.");
      return;
    }
    if (!isValidPassword(passwords.next)) {
      setPasswordError(PASSWORD_RULE);
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError("رمز جدید و تکرار آن یکسان نیستند.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.next,
        confirmPassword: passwords.confirm,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("رمز عبور تغییر کرد؛ سایر دستگاه‌ها خارج شدند.");
    } catch (caught) {
      setPasswordError(
        errorMessage(caught, "تغییر رمز عبور ممکن نشد. دوباره تلاش کنید."),
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRecoveryLoading(true);
    try {
      const result = await regenerateRecovery();
      setRecoveryCode(result.recoveryCode);
      setShowRecovery(true);
      toast.success("کد بازیابی جدید صادر شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "صدور کد بازیابی ممکن نشد."));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!window.confirm("از تمام دستگاه‌ها، از جمله همین دستگاه، خارج شوید؟")) return;
    setRevoking(true);
    try {
      await revokeAllSessions({});
      await signOut();
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "خروج از دستگاه‌ها ممکن نشد."));
    } finally {
      setRevoking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <AppShell active="account">
      <div className="space-y-5">
        <div className="px-1">
          <h1 className="text-xl font-extrabold tracking-tight">
            حساب کاربری و امنیت
          </h1>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
            مشخصات حساب، رمز عبور و کد بازیابی خود را مدیریت کنید. شماره موبایل
            شناسه ورود شماست و از این صفحه قابل تغییر نیست.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <section className="clay rounded-[30px] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="tile-navy grid size-11 place-items-center rounded-[14px]">
                  <UserRound className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold">مشخصات حساب</h2>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    نام نمایشی در پنل و برای همکاران
                  </p>
                </div>
              </div>

              <form onSubmit={handleName} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="account-name" className="text-[11.5px] font-semibold">
                    نام و نام خانوادگی
                  </Label>
                  <Input
                    id="account-name"
                    required
                    disabled={nameLoading}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px] font-semibold">
                      شماره موبایل
                    </Label>
                    <div className="clay-inset flex h-11 items-center gap-2 rounded-xl px-3">
                      <Phone className="size-3.5 text-muted-foreground" />
                      <span dir="ltr" className="text-[12px] font-semibold">
                        {context?.user.phone ?? "—"}
                      </span>
                    </div>
                    <p className="text-[9.5px] text-muted-foreground">
                      برای تغییر شماره با پشتیبانی تماس بگیرید.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px] font-semibold">نقش</Label>
                    <div className="clay-inset flex h-11 items-center gap-2 rounded-xl px-3">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span className="text-[12px] font-semibold">
                        {context?.isSiteAdmin
                          ? "مدیر اصلی سایت"
                          : context?.isOwner
                            ? "صاحب کافی‌نت"
                            : context?.membership?.title || "کارمند"}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={nameLoading}
                  className="clay-primary h-10 rounded-xl border-0 px-5 text-[11.5px] font-bold hover:brightness-105"
                >
                  {nameLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  ذخیره مشخصات
                </Button>
              </form>
            </section>

            <section className="clay rounded-[30px] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="tile-mint grid size-11 place-items-center rounded-[14px]">
                  <Lock className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold">تغییر رمز عبور</h2>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    رمز فعلی برای تأیید هویت لازم است
                  </p>
                </div>
              </div>

              <form onSubmit={handlePassword} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-[11.5px] font-semibold">
                    رمز عبور فعلی
                  </Label>
                  <Input
                    id="current-password"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={passwordLoading}
                    value={passwords.current}
                    onChange={(event) =>
                      setPasswords((prev) => ({
                        ...prev,
                        current: event.target.value,
                      }))
                    }
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-left text-[12.5px] shadow-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-[11.5px] font-semibold">
                      رمز عبور جدید
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        disabled={passwordLoading}
                        value={passwords.next}
                        onChange={(event) =>
                          setPasswords((prev) => ({
                            ...prev,
                            next: event.target.value,
                          }))
                        }
                        dir="ltr"
                        className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-9 pr-3 text-left text-[12.5px] shadow-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => !prev)}
                        aria-label="نمایش یا پنهان کردن رمز"
                        className="absolute left-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-primary"
                      >
                        {showPasswords ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-[11.5px] font-semibold">
                      تکرار رمز جدید
                    </Label>
                    <Input
                      id="confirm-password"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={passwordLoading}
                      value={passwords.confirm}
                      onChange={(event) =>
                        setPasswords((prev) => ({
                          ...prev,
                          confirm: event.target.value,
                        }))
                      }
                      dir="ltr"
                      className="clay-inset h-11 rounded-xl border-0 bg-transparent text-left text-[12.5px] shadow-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  {PASSWORD_RULE}
                </p>

                {passwordError && (
                  <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                    {passwordError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="clay-primary h-10 rounded-xl border-0 px-5 text-[11.5px] font-bold hover:brightness-105"
                >
                  {passwordLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  تغییر رمز عبور
                </Button>
              </form>
            </section>
          </div>

          <div className="space-y-4">
            <section className="clay rounded-[30px] p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Store className="size-4 text-primary" />
                فضای کاری شما
              </h2>
              <dl className="mt-4 space-y-3 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted-foreground">کافی‌نت</dt>
                  <dd className="text-end font-semibold">
                    {context?.cafe?.name ?? "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3" />
                    محل
                  </dt>
                  <dd className="text-end font-semibold">
                    {context?.cafe
                      ? `${context.cafe.province} · ${context.cafe.city}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <CreditCard className="size-3" />
                    اشتراک
                  </dt>
                  <dd className="text-end font-semibold">
                    {context?.subscription?.planName ?? "بدون اشتراک"}
                  </dd>
                </div>
                {memberSince && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">عضویت مجموعه</dt>
                    <dd className="font-semibold">{faDateLong(memberSince)}</dd>
                  </div>
                )}
              </dl>
              {context?.isOwner && (
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full justify-between rounded-xl px-2 text-[10.5px] font-semibold text-primary hover:bg-primary/10"
                  >
                    <Link to="/dashboard/cafe">تنظیمات کافی‌نت</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full justify-between rounded-xl px-2 text-[10.5px] font-semibold text-primary hover:bg-primary/10"
                  >
                    <Link to="/dashboard/employees">مدیریت کارمندان</Link>
                  </Button>
                </div>
              )}
            </section>

            <section className="clay-inset rounded-[26px] p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <KeyRound className="size-4 text-primary" />
                کد بازیابی
              </h2>
              <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">
                برای بازنشانی رمز در صورت فراموشی، به کد بازیابی نیاز دارید. با
                ساخت کد جدید، کد قبلی باطل می‌شود.
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleRegenerate}
                disabled={recoveryLoading}
                className="clay-sm mt-3 h-9 w-full rounded-xl border-0 text-[10.5px] font-bold text-primary hover:bg-primary/10"
              >
                {recoveryLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                ساخت کد بازیابی جدید
              </Button>
            </section>

            {import.meta.env.VITE_MANAGED_ACCOUNTS === "true" && (
              <section className="clay-inset rounded-[26px] p-5">
                <h2 className="text-sm font-extrabold">دستگاه‌های متصل</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">با خروج همگانی، ورود دوباره در همهٔ دستگاه‌ها لازم می‌شود.</p>
                <Button variant="outline" className="mt-3 w-full" disabled={revoking} onClick={handleSignOutEverywhere}>
                  {revoking ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                  خروج از همهٔ دستگاه‌ها
                </Button>
              </section>
            )}
            <section className="clay-inset rounded-[26px] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  حساب فعال
                </Badge>
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {context?.user.phone ? "ورود با موبایل" : "حساب مهمان"}
                </Badge>
              </div>
              <p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">
                نشست فعلی شما با توکن امن سمت سرور محافظت می‌شود. با تغییر رمز،
                سایر دستگاه‌ها خارج می‌شوند.
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                className="mt-3 h-9 w-full rounded-xl text-[10.5px] font-semibold text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-3.5" />
                خروج از حساب
              </Button>
            </section>
          </div>
        </div>
      </div>

      <RecoveryCodeDialog
        code={recoveryCode}
        open={showRecovery}
        onOpenChange={setShowRecovery}
        title="کد بازیابی جدید"
        description="کد قبلی باطل شد. کد جدید را در جای امن ذخیره کنید."
      />
    </AppShell>
  );
}
