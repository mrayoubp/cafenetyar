import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/backend/api";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateLong } from "@/lib/format";
import { IRAN_PROVINCES } from "@/lib/provinces";
import { useMutation } from "@/backend/client";
import {
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  Store,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export default function CafeSettings() {
  const { context } = useSession();
  const updateCafe = useMutation(api.tenancy.updateCafe);

  const [form, setForm] = useState({
    name: context?.cafe?.name ?? "",
    province: context?.cafe?.province ?? "",
    city: context?.cafe?.city ?? "",
    address: context?.cafe?.address ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await updateCafe({
        name: form.name.trim(),
        province: form.province,
        city: form.city.trim(),
        address: form.address.trim(),
      });
      toast.success("اطلاعات کافی‌نت به‌روزرسانی شد.");
    } catch (caught) {
      setError(
        errorMessage(caught, "ذخیره اطلاعات ممکن نشد. دوباره تلاش کنید."),
      );
    } finally {
      setLoading(false);
    }
  };

  const cafe = context?.cafe;
  const subscription = context?.subscription;

  return (
    <AppShell active="cafe">
      <div className="space-y-5">
        <div className="px-1">
          <h1 className="text-xl font-extrabold tracking-tight">
            تنظیمات کافی‌نت
          </h1>
          <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
            اطلاعات این مجموعه فقط برای اعضای همین کافی‌نت قابل مشاهده و ویرایش
            است.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <form onSubmit={handleSubmit} className="clay rounded-[30px] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="tile-navy grid size-11 place-items-center rounded-[14px]">
                <Store className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold">مشخصات مجموعه</h2>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  این اطلاعات در داشبورد و حساب کارمندان نمایش داده می‌شود.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cafe-name" className="text-[11.5px] font-semibold">
                  نام کافی‌نت
                </Label>
                <Input
                  id="cafe-name"
                  required
                  disabled={loading}
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cafe-province"
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
                      id="cafe-province"
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
                  <Label
                    htmlFor="cafe-city"
                    className="text-[11.5px] font-semibold"
                  >
                    شهر
                  </Label>
                  <Input
                    id="cafe-city"
                    required
                    disabled={loading}
                    value={form.city}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, city: event.target.value }))
                    }
                    className="clay-inset h-11 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="cafe-address"
                  className="text-[11.5px] font-semibold"
                >
                  آدرس کافی‌نت
                </Label>
                <Textarea
                  id="cafe-address"
                  required
                  rows={3}
                  disabled={loading}
                  value={form.address}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[12.5px] shadow-none"
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
                className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105 sm:w-auto sm:px-6"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                ذخیره تغییرات
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <section className="clay rounded-[30px] p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Building2 className="size-4 text-primary" />
                وضعیت مجموعه
              </h2>
              <dl className="mt-4 space-y-3 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">وضعیت دسترسی</dt>
                  <dd>
                    <Badge
                      variant="secondary"
                      className="rounded-full text-[10px]"
                    >
                      {cafe?.status === "suspended" ? "غیرفعال" : "فعال"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-muted-foreground">صاحب کافی‌نت</dt>
                  <dd className="text-end font-semibold">
                    {context?.user.name ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="size-3" />
                    موبایل
                  </dt>
                  <dd dir="ltr" className="font-semibold">
                    {context?.user.phone ?? "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3" />
                    محل
                  </dt>
                  <dd className="text-end font-semibold">
                    {cafe?.province} · {cafe?.city}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="size-3" />
                    تاریخ ثبت
                  </dt>
                  <dd className="font-semibold">
                    {cafe ? faDateLong(cafe.createdAt) : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="clay-inset rounded-[26px] p-5">
              <h2 className="flex items-center gap-2 text-[12.5px] font-extrabold">
                <CreditCard className="size-4 text-primary" />
                اشتراک
              </h2>
              {subscription ? (
                <>
                  <p className="mt-3 text-[12px] font-bold">
                    {subscription.planName}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                    پایان: {faDateLong(subscription.endsAt)}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-3 rounded-full text-[10px]"
                  >
                    {subscription.status === "trial"
                      ? "دوره آزمایشی"
                      : subscription.status === "active"
                        ? "فعال"
                        : subscription.status === "expired"
                          ? "منقضی"
                          : "لغوشده"}
                  </Badge>
                </>
              ) : (
                <p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">
                  اشتراکی برای این مجموعه ثبت نشده است. با مدیر اصلی سایت تماس
                  بگیرید.
                </p>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-muted-foreground">
                <UserRound className="mt-0.5 size-3.5 shrink-0" />
                موجودی و پرداخت آنلاین هنوز فعال نیست؛ وضعیت اشتراک از پنل مدیر
                اصلی مدیریت می‌شود.
              </p>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
