import { Logo, LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
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
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/auth";
import { IRAN_PROVINCES } from "@/lib/provinces";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  LogOut,
  ShieldAlert,
  Store,
  UserRoundX,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

export default function Setup() {
  const { context } = useSession();
  const { signOut } = useAuth();
  const createCafe = useMutation(api.tenancy.createMyCafe);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    province: "",
    city: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (context === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (context === null) return <Navigate to="/auth" replace />;
  if (context.isSiteAdmin) return <Navigate to="/admin" replace />;
  if (context.cafe) return <Navigate to="/dashboard" replace />;

  const handleGuestLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) {
      setError("نام کافی‌نت را وارد کنید.");
      return;
    }
    if (!form.province) {
      setError("استان را انتخاب کنید.");
      return;
    }
    if (form.city.trim().length < 2) {
      setError("شهر را وارد کنید.");
      return;
    }
    if (form.address.trim().length < 5) {
      setError("آدرس دقیق کافی‌نت را وارد کنید.");
      return;
    }

    setLoading(true);
    try {
      await createCafe({
        name: form.name.trim(),
        province: form.province,
        city: form.city.trim(),
        address: form.address.trim(),
      });
      toast.success("فضای کاری کافی‌نت ساخته شد.");
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(
        errorMessage(caught, "ساخت فضای کاری ممکن نشد. دوباره تلاش کنید."),
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
      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link to="/" aria-label="کافی‌نت‌یار">
          <Logo size="sm" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:pt-6">
        <div className="clay w-full max-w-xl rounded-[32px] p-6 sm:p-7">
          <div className="flex flex-col items-center text-center">
            <LogoMark size="lg" />
            <h1 className="mt-4 text-xl font-extrabold tracking-tight">
              تکمیل فضای کاری کافی‌نت
            </h1>
            <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
              حساب شما ساخته شده است؛ فقط اطلاعات کافی‌نت را کامل کنید تا داشبورد
              فعال شود.
            </p>
          </div>

          {context.isGuest ? (
            <div className="mt-6 space-y-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <UserRoundX className="size-6" />
              </div>
              <p className="text-[11.5px] leading-6 text-muted-foreground">
                حساب مهمان نمی‌تواند کافی‌نت ثبت کند. برای ساخت فضای کاری، یک
                حساب واقعی با شماره موبایل بسازید.
              </p>
              <Button
                type="button"
                onClick={handleGuestLogout}
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
              >
                <LogOut className="size-4" />
                خروج از حساب مهمان
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-name" className="text-[11.5px] font-semibold">
                  نام کافی‌نت
                </Label>
                <div className="relative">
                  <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="setup-name"
                    required
                    disabled={loading}
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="مثلاً کافی‌نت آرامش"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent pl-10 pr-3 text-[12.5px] shadow-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="setup-province"
                    className="text-[11.5px] font-semibold"
                  >
                    استان
                  </Label>
                  <Select
                    value={form.province}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, province: value }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger
                      id="setup-province"
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
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-city" className="text-[11.5px] font-semibold">
                    شهر
                  </Label>
                  <Input
                    id="setup-city"
                    required
                    disabled={loading}
                    value={form.city}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    placeholder="مثلاً کرج"
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="setup-address"
                  className="text-[11.5px] font-semibold"
                >
                  آدرس کافی‌نت
                </Label>
                <Textarea
                  id="setup-address"
                  required
                  disabled={loading}
                  rows={2}
                  value={form.address}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  placeholder="خیابان، پلاک و نشانه‌های آدرس"
                  className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
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
                    در حال ساخت…
                  </>
                ) : (
                  <>
                    ساخت فضای کاری
                    <ArrowLeft className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p>
                  یک دوره آزمایشی ۱۴ روزه به‌صورت خودکار برای مجموعه ثبت می‌شود.
                  کارمندان و دسترسی‌ها را بعد از ورود به داشبورد مدیریت کنید.
                </p>
              </div>

              <Link
                to="/"
                className="flex items-center justify-center gap-1 text-[10.5px] text-muted-foreground hover:text-primary"
              >
                <ArrowRight className="size-3.5" />
                بازگشت به صفحه اصلی
              </Link>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
