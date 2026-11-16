import { AdminShell } from "@/components/layout/AdminShell";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  BellRing,
  CalendarClock,
  Loader2,
  Megaphone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type NotificationRow = {
  id: Id<"platform_notifications">;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "critical";
  isActive: boolean;
  startsAt: number;
  endsAt: number | null;
  audience: "all" | "plan" | "cafe";
  planCode: string | null;
  cafeId: Id<"internet_cafes"> | null;
  kind: "broadcast" | "welcome" | "expiry_warning";
  createdAt: number;
};

const TONE_LABELS: Record<NotificationRow["tone"], string> = {
  info: "اطلاع‌رسانی",
  success: "موفقیت",
  warning: "هشدار",
  critical: "بحرانی",
};

const TONE_STYLES: Record<NotificationRow["tone"], string> = {
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  critical: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const EMPTY_FORM = {
  title: "",
  body: "",
  tone: "info" as NotificationRow["tone"],
  startsAt: "",
  endsAt: "",
  audience: "all" as NotificationRow["audience"],
  planCode: "basic",
  cafeId: "",
  kind: "broadcast" as NotificationRow["kind"],
};

function inputToDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : NaN;
}

export default function AdminNotifications() {
  const { context } = useSession();
  const notificationsQuery = useQuery(api.platformAdmin.notifications, {});
  const cafesQuery = useQuery(api.platformAdmin.notificationCafes, {});
  const createNotification = useMutation(api.platformAdmin.createNotification);
  const setNotificationActive = useMutation(
    api.platformAdmin.setNotificationActive,
  );
  const rows = (notificationsQuery ?? []) as NotificationRow[];
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const now = context?.serverNow ?? 0;

  const activeCount = rows.filter(
    (item) =>
      item.isActive &&
      item.startsAt <= now &&
      (item.endsAt === null || item.endsAt > now),
  ).length;
  const scheduledCount = rows.filter(
    (item) => item.isActive && item.startsAt > now,
  ).length;

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("عنوان و متن اعلان را کامل کنید.");
      return;
    }
    const startsAt = form.startsAt ? inputToDate(form.startsAt) : Date.now();
    const endsAt = form.endsAt ? inputToDate(form.endsAt) : undefined;
    if (
      !Number.isFinite(startsAt) ||
      (endsAt !== undefined && !Number.isFinite(endsAt))
    ) {
      toast.error("تاریخ شروع یا پایان معتبر نیست.");
      return;
    }
    setBusy(true);
    try {
      await createNotification({
        title: form.title,
        body: form.body,
        tone: form.tone,
        startsAt,
        endsAt,
        audience: form.audience,
        planCode: form.audience === "plan" ? form.planCode : undefined,
        cafeId:
          form.audience === "cafe"
            ? (form.cafeId as Id<"internet_cafes">)
            : undefined,
        kind: form.kind,
      });
      toast.success("اعلان پلتفرم ساخته شد.");
      setForm(EMPTY_FORM);
    } catch (caught) {
      toast.error(errorMessage(caught, "ساخت اعلان ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (item: NotificationRow, isActive: boolean) => {
    setBusy(true);
    try {
      await setNotificationActive({ notificationId: item.id, isActive });
      toast.success(isActive ? "اعلان فعال شد." : "اعلان غیرفعال شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت اعلان ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell active="notifications">
      <div className="space-y-4">
        <header className="clay relative overflow-hidden rounded-[30px] p-5">
          <div className="pointer-events-none absolute -left-10 -top-12 size-44 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Megaphone className="size-4" />
                <span className="text-[9.5px] font-bold">ارتباط با کاربران</span>
              </div>
              <h1 className="mt-2 text-2xl font-black">اعلان‌های پلتفرم</h1>
              <p className="mt-1 max-w-xl text-[11px] leading-6 text-muted-foreground">
                اعلان‌های فعال و زمان‌بندی‌شده در نوار بالای داشبورد همه
                کافی‌نت‌ها نمایش داده می‌شوند. هر ساخت و تغییر وضعیت در گزارش
                رویدادها ثبت می‌شود.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="clay-inset rounded-2xl px-4 py-2.5">
                <p className="text-[9px] text-muted-foreground">در حال نمایش</p>
                <p className="mt-0.5 text-lg font-black">{faNumber(activeCount)}</p>
              </div>
              <div className="clay-inset rounded-2xl px-4 py-2.5">
                <p className="text-[9px] text-muted-foreground">زمان‌بندی آینده</p>
                <p className="mt-0.5 text-lg font-black">{faNumber(scheduledCount)}</p>
              </div>
              <div className="clay-inset rounded-2xl px-4 py-2.5">
                <p className="text-[9px] text-muted-foreground">کل اعلان‌ها</p>
                <p className="mt-0.5 text-lg font-black">{faNumber(rows.length)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <section className="clay h-fit rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold">اعلان جدید</h2>
                <p className="text-[9px] text-muted-foreground">
                  خالی‌گذاشتن زمان شروع یعنی انتشار فوری
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3.5">
              <div>
                <Label className="text-[10px]">عنوان</Label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, title: event.target.value }))
                  }
                  placeholder="مثلاً به‌روزرسانی نرخ‌نامه"
                  className="mt-1.5 h-10 rounded-xl text-[11px]"
                  maxLength={120}
                />
              </div>
              <div>
                <Label className="text-[10px]">متن اعلان</Label>
                <Textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, body: event.target.value }))
                  }
                  placeholder="توضیح کوتاه و روشن برای مدیران کافی‌نت‌ها"
                  className="mt-1.5 min-h-24 rounded-xl text-[11px]"
                  maxLength={1000}
                />
              </div>
              <div>
                <Label className="text-[10px]">نوع پیام</Label>
                <Select
                  value={form.tone}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tone: value as NotificationRow["tone"],
                    }))
                  }
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-xl text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(TONE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">مخاطب</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        audience: value as NotificationRow["audience"],
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">همه کافی‌نت‌ها</SelectItem>
                      <SelectItem value="plan">یک پلن مشخص</SelectItem>
                      <SelectItem value="cafe">یک کافی‌نت مشخص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">نوع زمان‌بندی</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        kind: value as NotificationRow["kind"],
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="broadcast">پیام عمومی</SelectItem>
                      <SelectItem value="welcome">خوشامدگویی</SelectItem>
                      <SelectItem value="expiry_warning">هشدار انقضا</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.audience === "plan" && (
                <div>
                  <Label className="text-[10px]">پلن هدف</Label>
                  <Select
                    value={form.planCode}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, planCode: value }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="basic">پایه</SelectItem>
                      <SelectItem value="pro">حرفه‌ای</SelectItem>
                      <SelectItem value="premium">ویژه</SelectItem>
                      <SelectItem value="trial">آزمایشی</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.audience === "cafe" && (
                <div>
                  <Label className="text-[10px]">کافی‌نت هدف</Label>
                  <Select
                    value={form.cafeId}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, cafeId: value }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl text-[10px]">
                      <SelectValue placeholder="انتخاب کافی‌نت" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 rounded-xl">
                      {(cafesQuery ?? []).map((cafe) => (
                        <SelectItem key={cafe.id} value={cafe.id}>
                          {cafe.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">شروع نمایش</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        startsAt: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 rounded-xl text-[10px]"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">پایان نمایش</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        endsAt: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-10 rounded-xl text-[10px]"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-[9px] leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                اعلان فقط به بخش داخلی پلتفرم ارسال می‌شود و به ایمیل یا پیامک
                متصل نیست.
              </div>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="h-10 w-full rounded-xl text-[11px] font-bold"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                ثبت اعلان
              </Button>
            </div>
          </section>

          <section className="clay rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">فهرست اعلان‌ها</h2>
                <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                  آخرین ۱۰۰ اعلان ثبت‌شده
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full text-[9px]">
                {faNumber(rows.length)} اعلان
              </Badge>
            </div>

            {notificationsQuery === undefined ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border/70 py-14 text-center">
                <CalendarClock className="size-7 text-muted-foreground/50" />
                <p className="mt-2 text-[11px] font-bold">اعلانی ثبت نشده است</p>
                <p className="mt-1 text-[9.5px] text-muted-foreground">
                  اولین پیام پلتفرم را از فرم کنار بسازید.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {rows.map((item) => {
                  const isLive =
                    item.isActive &&
                    item.startsAt <= now &&
                    (item.endsAt === null || item.endsAt > now);
                  const isScheduled =
                    item.isActive && item.startsAt > now;
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-border/60 bg-card/60 p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11.5px] font-extrabold">
                              {item.title}
                            </span>
                            <Badge
                              className={`rounded-full text-[8px] ${TONE_STYLES[item.tone]}`}
                              variant="secondary"
                            >
                              {TONE_LABELS[item.tone]}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="rounded-full text-[8px]"
                            >
                              {isLive
                                ? "در حال نمایش"
                                : isScheduled
                                  ? "زمان‌بندی‌شده"
                                  : item.isActive
                                    ? "منقضی"
                                    : "غیرفعال"}
                            </Badge>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-[10.5px] leading-6 text-muted-foreground">
                            {item.body}
                          </p>
                          <p className="mt-1 text-[8px] text-muted-foreground/80">
                            مخاطب: {item.audience === "all"
                              ? "همه"
                              : item.audience === "plan"
                                ? `پلن ${item.planCode ?? ""}`
                                : `کافی‌نت ${item.cafeId ?? ""}`}
                            {item.kind === "welcome"
                              ? " · خوشامدگویی"
                              : item.kind === "expiry_warning"
                                ? " · هشدار انقضا"
                                : ""}
                          </p>
                          <p className="mt-1.5 text-[8.5px] text-muted-foreground/80">
                            شروع: {faDateLong(item.startsAt)}
                            {item.endsAt
                              ? ` · پایان: ${faDateLong(item.endsAt)}`
                              : " · بدون تاریخ پایان"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">
                            {item.isActive ? "فعال" : "خاموش"}
                          </span>
                          <Switch
                            checked={item.isActive}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                              void handleToggle(item, checked)
                            }
                            aria-label={`تغییر وضعیت ${item.title}`}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
