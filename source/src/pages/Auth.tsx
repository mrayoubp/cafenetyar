import { Logo, LogoMark } from "@/components/Logo";
import { RecoveryCodeDialog } from "@/components/RecoveryCodeDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { IRAN_PROVINCES } from "@/lib/provinces";
import { useAuth } from "@/hooks/use-auth";
import {
  PASSWORD_RULE,
  accountEmail,
  errorMessage,
  isValidPassword,
  normalizePhone,
  sanitizePhoneInput,
} from "@/lib/auth";
import { useAction, useMutation } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Store,
  UserRoundPlus,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type SignupState = {
  fullName: string;
  phone: string;
  cafeName: string;
  province: string;
  city: string;
  address: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

const EMPTY_SIGNUP: SignupState = {
  fullName: "",
  phone: "",
  cafeName: "",
  province: "",
  city: "",
  address: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="mt-1 text-[10.5px] font-medium leading-5 text-destructive">
      {children}
    </p>
  );
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[11.5px] font-semibold">
        {label}
      </Label>
      {children}
      {hint && (
        <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const registerOwner = useAction(api.authActions.registerOwner);
  const recordAdminLogin = useMutation(api.adminUsers.recordAdminLogin);
  const recordLoginFailure = useMutation(api.superAdmin.recordLoginFailure);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [tab, setTab] = useState<"signIn" | "signUp">(
    import.meta.env.VITE_MANAGED_ACCOUNTS !== "true" && searchParams.get("mode") === "signup" ? "signUp" : "signIn",
  );
  const [login, setLogin] = useState({ phone: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signup, setSignup] = useState<SignupState>(EMPTY_SIGNUP);
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [acceptedOpen, setAcceptedOpen] = useState(false);

  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (justRegistered || showRecovery) return;
    navigate(redirect, { replace: true });
  }, [
    authLoading,
    isAuthenticated,
    justRegistered,
    navigate,
    redirect,
    showRecovery,
  ]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    const phone = normalizePhone(login.phone);
    if (!phone) {
      setLoginError("شماره موبایل را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
      return;
    }
    if (login.password.length === 0) {
      setLoginError("رمز عبور را وارد کنید.");
      return;
    }

    setLoginLoading(true);
    try {
      await signIn("password", {
        email: accountEmail(phone),
        password: login.password,
        flow: "signIn",
      });
      void recordAdminLogin({}).catch(() => undefined);
      navigate(redirect, { replace: true });
    } catch (error) {
      void recordLoginFailure({ phone }).catch(() => undefined);
      setLoginError(
        errorMessage(
          error,
          "شماره موبایل یا رمز عبور درست نیست. دوباره بررسی کنید.",
        ),
      );
      setLoginLoading(false);
    }
  };

  const validateSignup = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const fullName = signup.fullName.trim().replace(/\s+/g, " ");
    const phone = normalizePhone(signup.phone);
    if (fullName.length < 3 || !fullName.includes(" ")) {
      errors.fullName = "نام و نام خانوادگی را کامل وارد کنید.";
    }
    if (!phone) errors.phone = "شماره موبایل معتبر نیست؛ نمونه: ۰۹۱۲۳۴۵۶۷۸۹.";
    if (!isValidPassword(signup.password)) errors.password = PASSWORD_RULE;
    if (signup.confirmPassword !== signup.password) {
      errors.confirmPassword = "تکرار رمز با رمز عبور یکسان نیست.";
    }
    if (signup.cafeName.trim().length < 2) {
      errors.cafeName = "نام کافی‌نت را وارد کنید.";
    }
    if (!signup.province) errors.province = "استان را انتخاب کنید.";
    if (signup.city.trim().length < 2) errors.city = "شهر را وارد کنید.";
    if (signup.address.trim().length < 5) {
      errors.address = "آدرس دقیق کافی‌نت را وارد کنید.";
    }
    if (!signup.acceptedTerms) {
      errors.terms = "پذیرش قوانین برای ساخت حساب الزامی است.";
    }
    return errors;
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignupError(null);
    const errors = validateSignup();
    setSignupErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const phone = normalizePhone(signup.phone)!;
    setSignupLoading(true);
    setJustRegistered(true);

    try {
      const result = await registerOwner({
        fullName: signup.fullName.trim(),
        phone,
        password: signup.password,
        confirmPassword: signup.confirmPassword,
        cafeName: signup.cafeName.trim(),
        province: signup.province,
        city: signup.city.trim(),
        address: signup.address.trim(),
        acceptedTerms: signup.acceptedTerms,
      });
      setRecoveryCode(result.recoveryCode);
      setShowRecovery(true);

      try {
        await signIn("password", {
          email: accountEmail(phone),
          password: signup.password,
          flow: "signIn",
        });
      } catch {
        setLogin({ phone, password: "" });
        setTab("signIn");
        setLoginError(
          "حساب ساخته شد؛ برای ورود، شماره موبایل و رمز عبور خود را وارد کنید.",
        );
      }
      setSignup(EMPTY_SIGNUP);
    } catch (error) {
      setJustRegistered(false);
      setSignupError(
        errorMessage(
          error,
          "ثبت‌نام کامل نشد. اطلاعات را بررسی کنید و دوباره تلاش کنید.",
        ),
      );
    } finally {
      setSignupLoading(false);
    }
  };

  const handleRecoveryClose = () => {
    setShowRecovery(false);
    setJustRegistered(false);
    if (isAuthenticated) {
      navigate(redirect, { replace: true });
    } else {
      setTab("signIn");
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
            to="/"
            className="hidden items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            <ArrowRight className="size-3.5" />
            بازگشت به سایت
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:pt-6">
        <div
          className={`clay w-full rounded-[32px] p-6 sm:p-7 ${
            tab === "signUp" ? "max-w-2xl" : "max-w-md"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <LogoMark size="lg" />
            <h1 className="mt-4 text-xl font-extrabold tracking-tight">
              {tab === "signIn" ? "ورود به کافی‌نت‌یار" : "ساخت حساب کافی‌نت"}
            </h1>
            <p className="mt-2 max-w-md text-[11.5px] leading-6 text-muted-foreground">
              {tab === "signIn"
                ? "با شماره موبایل و رمز عبور خود وارد شوید. حساب شما به کافی‌نت مجموعه‌تان متصل است."
                : "اطلاعات صاحب کافی‌نت را وارد کنید؛ یک فضای کاری اختصاصی و مستقل برای شما ساخته می‌شود."}
            </p>
          </div>

          <div className="clay-inset mt-5 grid grid-cols-2 gap-1 rounded-2xl p-1">
            {(
              [
                { key: "signIn", label: "ورود", icon: Lock },
                ...(import.meta.env.VITE_MANAGED_ACCOUNTS === "true" ? [] : [{ key: "signUp" as const, label: "ثبت‌نام", icon: UserRoundPlus }]),
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setLoginError(null);
                    setSignupError(null);
                  }}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-[11.5px] transition-colors ${
                    isActive
                      ? "bg-card font-bold text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "signIn" ? (
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <Field label="شماره موبایل" htmlFor="login-phone">
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="username"
                    required
                    disabled={loginLoading}
                    value={login.phone}
                    onChange={(event) =>
                      setLogin((prev) => ({
                        ...prev,
                        phone: sanitizePhoneInput(event.target.value),
                      }))
                    }
                    placeholder="09123456789"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] shadow-none"
                  />
                </div>
              </Field>

              <Field label="رمز عبور" htmlFor="login-password">
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={loginLoading}
                    value={login.password}
                    onChange={(event) =>
                      setLogin((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="••••••••"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={
                      showLoginPassword ? "پنهان کردن رمز" : "نمایش رمز عبور"
                    }
                    className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between gap-2">
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  رمز عبور را فراموش کرده‌اید؟
                </Link>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  ورود امن با شماره موبایل
                </span>
              </div>

              {loginError && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                  {loginError}
                </p>
              )}

              <Button
                type="submit"
                disabled={loginLoading}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    در حال ورود…
                  </>
                ) : (
                  <>
                    ورود به حساب
                    <ArrowLeft className="size-4" />
                  </>
                )}
              </Button>

            </form>
          ) : (
            <form onSubmit={handleSignup} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نام و نام خانوادگی" htmlFor="signup-name">
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    required
                    disabled={signupLoading}
                    value={signup.fullName}
                    onChange={(event) =>
                      setSignup((prev) => ({
                        ...prev,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder="مثلاً سارا محمدی"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                  />
                  <FieldError>{signupErrors.fullName}</FieldError>
                </Field>

                <Field label="شماره موبایل" htmlFor="signup-phone">
                  <Input
                    id="signup-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="username"
                    required
                    disabled={signupLoading}
                    value={signup.phone}
                    onChange={(event) =>
                      setSignup((prev) => ({
                        ...prev,
                        phone: sanitizePhoneInput(event.target.value),
                      }))
                    }
                    placeholder="09123456789"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-left text-[12.5px] shadow-none"
                  />
                  <FieldError>{signupErrors.phone}</FieldError>
                </Field>
              </div>

              <Field label="نام کافی‌نت" htmlFor="signup-cafe">
                <div className="relative">
                  <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-cafe"
                    required
                    disabled={signupLoading}
                    value={signup.cafeName}
                    onChange={(event) =>
                      setSignup((prev) => ({
                        ...prev,
                        cafeName: event.target.value,
                      }))
                    }
                    placeholder="مثلاً کافی‌نت آرامش"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-[12.5px] shadow-none"
                  />
                </div>
                <FieldError>{signupErrors.cafeName}</FieldError>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="استان" htmlFor="signup-province">
                  <Select
                    value={signup.province}
                    onValueChange={(value) =>
                      setSignup((prev) => ({ ...prev, province: value }))
                    }
                    disabled={signupLoading}
                  >
                    <SelectTrigger
                      id="signup-province"
                      className="clay-inset h-11 w-full rounded-xl border-0 bg-transparent px-3 text-[12.5px] shadow-none"
                    >
                      <SelectValue placeholder="انتخاب استان" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-2xl">
                      {IRAN_PROVINCES.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{signupErrors.province}</FieldError>
                </Field>

                <Field label="شهر" htmlFor="signup-city">
                  <Input
                    id="signup-city"
                    required
                    disabled={signupLoading}
                    value={signup.city}
                    onChange={(event) =>
                      setSignup((prev) => ({
                        ...prev,
                        city: event.target.value,
                      }))
                    }
                    placeholder="مثلاً کرج"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                  />
                  <FieldError>{signupErrors.city}</FieldError>
                </Field>
              </div>

              <Field label="آدرس کافی‌نت" htmlFor="signup-address">
                <Textarea
                  id="signup-address"
                  required
                  disabled={signupLoading}
                  value={signup.address}
                  onChange={(event) =>
                    setSignup((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  placeholder="خیابان، پلاک و نشانه‌های آدرس"
                  rows={2}
                  className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                />
                <FieldError>{signupErrors.address}</FieldError>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="رمز عبور"
                  htmlFor="signup-password"
                  hint={PASSWORD_RULE}
                >
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={signupLoading}
                      value={signup.password}
                      onChange={(event) =>
                        setSignup((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      placeholder="••••••••"
                      dir="ltr"
                      className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-left text-[12.5px] shadow-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                      aria-label={
                        showSignupPassword ? "پنهان کردن رمز" : "نمایش رمز عبور"
                      }
                      className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-primary"
                    >
                      {showSignupPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <FieldError>{signupErrors.password}</FieldError>
                </Field>

                <Field label="تکرار رمز عبور" htmlFor="signup-confirm">
                  <Input
                    id="signup-confirm"
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    disabled={signupLoading}
                    value={signup.confirmPassword}
                    onChange={(event) =>
                      setSignup((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="••••••••"
                    dir="ltr"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-left text-[12.5px] shadow-none"
                  />
                  <FieldError>{signupErrors.confirmPassword}</FieldError>
                </Field>
              </div>

              <div className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3">
                <Checkbox
                  id="signup-terms"
                  checked={signup.acceptedTerms}
                  onCheckedChange={(checked) =>
                    setSignup((prev) => ({
                      ...prev,
                      acceptedTerms: checked === true,
                    }))
                  }
                  disabled={signupLoading}
                  className="mt-0.5 rounded-[5px]"
                />
                <div className="text-[10.5px] leading-5 text-muted-foreground">
                  <label htmlFor="signup-terms" className="cursor-pointer">
                    قوانین و شرایط استفاده از کافی‌نت‌یار را می‌پذیرم.
                  </label>{" "}
                  <button
                    type="button"
                    onClick={() => setAcceptedOpen(true)}
                    className="font-semibold text-primary hover:underline"
                  >
                    مشاهده قوانین
                  </button>
                  <FieldError>{signupErrors.terms}</FieldError>
                </div>
              </div>

              {signupError && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] font-medium leading-5 text-destructive">
                  {signupError}
                </p>
              )}

              <Button
                type="submit"
                disabled={signupLoading}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
              >
                {signupLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    در حال ساخت فضای کاری…
                  </>
                ) : (
                  <>
                    ساخت حساب و فضای کاری
                    <ArrowLeft className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 rounded-2xl bg-primary/8 p-3 text-[10px] leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p>
                  پس از ثبت‌نام یک «کد بازیابی» یک‌باره به شما نشان داده می‌شود.
                  رمز عبور با الگوریتم امن Scrypt هش می‌شود و داده‌های هر کافی‌نت
                  جدا از سایر مجموعه‌ها نگهداری می‌شود.
                </p>
              </div>
            </form>
          )}

          <div className="clay-inset mt-5 flex items-start gap-2 rounded-2xl p-3">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="text-[10px] leading-5 text-muted-foreground">
              حساب کاربری، کافی‌نت، کارمندان و تراکنش‌های دفتر مالی به‌صورت
              واقعی و با کنترل دسترسی سمت سرور ذخیره می‌شوند.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative pb-6 text-center text-[10px] text-muted-foreground">
        کافی‌نت‌یار · نسخه ۳٫۱ · حساب کاربری، دفتر مالی و مدیریت کافی‌نت
      </footer>

      <RecoveryCodeDialog
        code={recoveryCode}
        open={showRecovery}
        onOpenChange={(open) => {
          if (!open) handleRecoveryClose();
        }}
      />

      <Dialog open={acceptedOpen} onOpenChange={setAcceptedOpen}>
        <DialogContent className="clay w-[min(32rem,calc(100vw-1.5rem))] rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                قوانین و شرایط استفاده
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-5">
                خلاصه تعهدات صاحب کافی‌نت در استفاده از کافی‌نت‌یار
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5 text-[11px] leading-6 text-muted-foreground">
            <p>
              ۱. اطلاعات هویتی و اطلاعات کافی‌نت باید درست و متعلق به خود شما
              باشد. مسئولیت صحت اطلاعات با صاحب حساب است.
            </p>
            <p>
              ۲. حساب کاربری شخصی است؛ رمز عبور را با دیگران به اشتراک نگذارید.
              برای هر کارمند حساب مستقل با سطح دسترسی مشخص بسازید.
            </p>
            <p>
              ۳. داده‌های کارمندان و مشتریان باید با رضایت و مطابق قوانین کشور
              ثبت شود. دسترسی کارمندان فقط با مجوز صاحب کافی‌نت امکان‌پذیر است.
            </p>
            <p>
              ۴. تلاش برای دسترسی به اطلاعات سایر کافی‌نت‌ها، دور زدن کنترل
              دسترسی یا سوءاستفاده از سامانه موجب غیرفعال‌سازی حساب می‌شود.
            </p>
            <p>
              ۵. تراکنش‌های دفتر مالی ماندگار هستند و مسئولیت صحت داده‌های ثبت‌شده
              با صاحب کافی‌نت است. ابطال تراکنش به‌جای حذف، سابقه را حفظ می‌کند.
            </p>
            <p>
              ۶. شرایط اشتراک، تمدید، لغو و بازپرداخت در صفحات حقوقی توضیح داده
              شده است؛ قیمت و وضعیت نهایی هر پلن در صفحه اشتراک نمایش داده
              می‌شود.
            </p>
            <p className="rounded-xl bg-muted/50 p-2.5 text-[10px] leading-5">
              متن کامل را بخوانید:{" "}
              <Link
                to="/legal/terms"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                شرایط استفاده
              </Link>{" "}
              و{" "}
              <Link
                to="/legal/privacy"
                target="_blank"
                className="font-semibold text-primary hover:underline"
              >
                حریم خصوصی
              </Link>
              .
            </p>
          </div>
          <div className="border-t border-border/50 p-4">
            <Button
              type="button"
              onClick={() => {
                setSignup((prev) => ({ ...prev, acceptedTerms: true }));
                setAcceptedOpen(false);
              }}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[12px] font-bold hover:brightness-105"
            >
              می‌پذیرم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Auth {...props} />
    </Suspense>
  );
}
