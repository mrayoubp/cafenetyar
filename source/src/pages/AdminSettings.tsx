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
import { ADMIN_PERMISSIONS } from "@/convex/lib/adminPermissions";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber, faToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  Bot,
  CreditCard,
  Globe2,
  Loader2,
  LockKeyhole,
  Megaphone,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type SettingsData = {
  platformName: string;
  tagline: string;
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportAddress: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  whatsappUrl: string | null;
  websiteUrl: string | null;
  timezone: string;
  locale: string;
  defaultTheme: "light" | "dark" | "system";
  registrationEnabled: boolean;
  notificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  aiEnabled: boolean;
  aiModel: string;
  aiCostPerRequestToman: number;
  backupSchedule: string;
  backupNote: string | null;
  trialDays: number | null;
  trialPlanCode: string | null;
  billingSettings: { allowTrialReuse: boolean; gatewayProvider: string } | null;
};

type NotificationRow = {
  id: Id<"platform_notifications">;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "critical";
  isActive: boolean;
  startsAt: number;
  endsAt: number | null;
  createdAt: number;
};

type StringFields<T> = {
  [K in keyof T]: T[K] extends null ? string : Exclude<T[K], null>;
};
type Form = Omit<
  StringFields<SettingsData>,
  | "trialDays"
  | "trialPlanCode"
  | "billingSettings"
  | "aiCostPerRequestToman"
> & { aiCostPerRequestToman: string };

const EMPTY_FORM: Form = {
  platformName: "کافی‌نت‌یار",
  tagline: "دستیار هوشمند مدیریت کافی‌نت",
  logoUrl: "",
  supportEmail: "",
  supportPhone: "",
  supportAddress: "",
  instagramUrl: "",
  telegramUrl: "",
  whatsappUrl: "",
  websiteUrl: "",
  timezone: "Asia/Tehran",
  locale: "fa-IR",
  defaultTheme: "system",
  registrationEnabled: true,
  notificationsEnabled: true,
  emailNotificationsEnabled: false,
  smsNotificationsEnabled: false,
  maintenanceMode: false,
  maintenanceMessage: "",
  aiEnabled: true,
  aiModel: "openai/gpt-4o-mini",
  aiCostPerRequestToman: "0",
  backupSchedule: "daily",
  backupNote: "",
};

function toForm(data: SettingsData): Form {
  return {
    platformName: data.platformName,
    tagline: data.tagline,
    logoUrl: data.logoUrl ?? "",
    supportEmail: data.supportEmail ?? "",
    supportPhone: data.supportPhone ?? "",
    supportAddress: data.supportAddress ?? "",
    instagramUrl: data.instagramUrl ?? "",
    telegramUrl: data.telegramUrl ?? "",
    whatsappUrl: data.whatsappUrl ?? "",
    websiteUrl: data.websiteUrl ?? "",
    timezone: data.timezone,
    locale: data.locale,
    defaultTheme: data.defaultTheme,
    registrationEnabled: data.registrationEnabled,
    notificationsEnabled: data.notificationsEnabled,
    // Delivery providers are not connected yet; keep these channels off.
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
    maintenanceMode: data.maintenanceMode,
    maintenanceMessage: data.maintenanceMessage ?? "",
    aiEnabled: data.aiEnabled,
    aiModel: data.aiModel,
    aiCostPerRequestToman: String(data.aiCostPerRequestToman),
    backupSchedule: data.backupSchedule,
    backupNote: data.backupNote ?? "",
  };
}

function inputToDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : NaN;
}

export default function AdminSettings() {
  const { context } = useSession();
  const canNotifications =
    context?.isSuperAdmin ||
    context?.adminPermissions.includes(ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE);
  const settingsQuery = useQuery(api.platformAdmin.settings, {});
  const notificationsQuery = useQuery(
    api.platformAdmin.notifications,
    canNotifications ? {} : "skip",
  );
  const updateSettings = useMutation(api.platformAdmin.updateSettings);
  const createNotification = useMutation(api.platformAdmin.createNotification);
  const setNotificationActive = useMutation(api.platformAdmin.setNotificationActive);
  const settings = settingsQuery as SettingsData | null | undefined;
  const notifications = (notificationsQuery ?? []) as NotificationRow[];
  const [draft, setDraft] = useState<Partial<Form>>({});
  const [busy, setBusy] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    body: "",
    tone: "info" as NotificationRow["tone"],
    startsAt: "",
    endsAt: "",
  });
  const [notificationBusy, setNotificationBusy] = useState(false);
  const form: Form = {
    ...(settings ? toForm(settings) : EMPTY_FORM),
    ...draft,
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateSettings({
        platformName: form.platformName,
        tagline: form.tagline,
        logoUrl: form.logoUrl || undefined,
        supportEmail: form.supportEmail || undefined,
        supportPhone: form.supportPhone || undefined,
        supportAddress: form.supportAddress || undefined,
        instagramUrl: form.instagramUrl || undefined,
        telegramUrl: form.telegramUrl || undefined,
        whatsappUrl: form.whatsappUrl || undefined,
        websiteUrl: form.websiteUrl || undefined,
        timezone: form.timezone,
        locale: form.locale,
        defaultTheme: form.defaultTheme,
        registrationEnabled: form.registrationEnabled,
        notificationsEnabled: form.notificationsEnabled,
        emailNotificationsEnabled: form.emailNotificationsEnabled,
        smsNotificationsEnabled: form.smsNotificationsEnabled,
        maintenanceMode: form.maintenanceMode,
        maintenanceMessage: form.maintenanceMessage || undefined,
        aiEnabled: form.aiEnabled,
        aiModel: form.aiModel,
        aiCostPerRequestToman: Number(form.aiCostPerRequestToman) || 0,
        backupSchedule: form.backupSchedule,
        backupNote: form.backupNote || undefined,
      });
      toast.success("تنظیمات پلتفرم ذخیره شد.");
      setDraft({});
    } catch (caught) {
      toast.error(errorMessage(caught, "ذخیره تنظیمات ممکن نشد."));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) {
      toast.error("عنوان و متن اعلان را کامل کنید.");
      return;
    }
    const startsAt = notificationForm.startsAt
      ? inputToDate(notificationForm.startsAt)
      : Date.now();
    const endsAt = notificationForm.endsAt
      ? inputToDate(notificationForm.endsAt)
      : undefined;
    if (!Number.isFinite(startsAt) || (endsAt !== undefined && !Number.isFinite(endsAt))) {
      toast.error("تاریخ اعلان معتبر نیست.");
      return;
    }
    setNotificationBusy(true);
    try {
      await createNotification({
        title: notificationForm.title,
        body: notificationForm.body,
        tone: notificationForm.tone,
        startsAt,
        endsAt,
      });
      toast.success("اعلان ساخته شد.");
      setNotificationForm({
        title: "",
        body: "",
        tone: "info",
        startsAt: "",
        endsAt: "",
      });
    } catch (caught) {
      toast.error(errorMessage(caught, "ساخت اعلان ممکن نشد."));
    } finally {
      setNotificationBusy(false);
    }
  };

  if (settings === undefined) {
    return (
      <AdminShell active="settings">
        <div className="clay flex justify-center rounded-[28px] p-10"><Loader2 className="size-5 animate-spin" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="settings">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">تنظیمات پلتفرم</h1>
            <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
              نام، تماس، ثبت‌نام، اعلان‌ها، پیکربندی هوش مصنوعی و یادداشت
              پشتیبان‌گیری. کلیدهای محرمانه در این جدول ذخیره نمی‌شوند.
            </p>
          </div>
          <Button type="button" onClick={handleSave} disabled={busy} className="clay-primary h-9 rounded-xl border-0 text-[10.5px] font-bold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            ذخیره تنظیمات
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <section className="clay rounded-[26px] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Settings2 className="size-4" /></span>
              <h2 className="text-[12px] font-extrabold">هویت و اطلاعات تماس</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="نام سامانه">
                <Input value={form.platformName} onChange={(event) => set("platformName", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
              <Field label="شعار">
                <Input value={form.tagline} onChange={(event) => set("tagline", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
              <Field label="ایمیل پشتیبانی">
                <Input dir="ltr" value={form.supportEmail} onChange={(event) => set("supportEmail", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="تلفن پشتیبانی">
                <Input dir="ltr" value={form.supportPhone} onChange={(event) => set("supportPhone", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="نشانی پشتیبانی" className="sm:col-span-2">
                <Input value={form.supportAddress} onChange={(event) => set("supportAddress", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
              <Field label="لوگو (URL)">
                <Input dir="ltr" value={form.logoUrl} onChange={(event) => set("logoUrl", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="وب‌سایت">
                <Input dir="ltr" value={form.websiteUrl} onChange={(event) => set("websiteUrl", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="اینستاگرام">
                <Input dir="ltr" value={form.instagramUrl} onChange={(event) => set("instagramUrl", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="تلگرام">
                <Input dir="ltr" value={form.telegramUrl} onChange={(event) => set("telegramUrl", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="واتساپ">
                <Input dir="ltr" value={form.whatsappUrl} onChange={(event) => set("whatsappUrl", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
            </div>
          </section>

          <section className="clay rounded-[26px] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Globe2 className="size-4" /></span>
              <h2 className="text-[12px] font-extrabold">زبان، تم و ثبت‌نام</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="منطقه زمانی">
                <Input dir="ltr" value={form.timezone} onChange={(event) => set("timezone", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="زبان">
                <Input dir="ltr" value={form.locale} onChange={(event) => set("locale", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="تم پیش‌فرض">
                <Select value={form.defaultTheme} onValueChange={(value) => set("defaultTheme", value as Form["defaultTheme"])}>
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="system">هماهنگ با سیستم</SelectItem>
                    <SelectItem value="light">روشن</SelectItem>
                    <SelectItem value="dark">تاریک</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4 space-y-2">
              <ToggleRow label="ثبت‌نام کافی‌نت جدید فعال باشد" description="با غیرفعال کردن، درخواست ساخت حساب جدید از سمت سرور رد می‌شود." checked={form.registrationEnabled} onChange={(value) => set("registrationEnabled", value)} />
              <ToggleRow label="اعلان‌های درون‌برنامه" description="نمایش اعلان‌های فعال در پنل کافی‌نت و مدیران." checked={form.notificationsEnabled} onChange={(value) => set("notificationsEnabled", value)} />
              <ToggleRow disabled label="اطلاع‌رسانی ایمیلی" description="سرویس ایمیل متصل نیست؛ ارسال واقعی انجام نمی‌شود." checked={false} onChange={() => undefined} />
              <ToggleRow disabled label="اطلاع‌رسانی پیامکی" description="سرویس پیامک متصل نیست؛ ارسال واقعی انجام نمی‌شود." checked={false} onChange={() => undefined} />
            </div>
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-2.5 text-[9px] leading-5 text-amber-800 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              اعلان ایمیل و پیامک تا اتصال ارائه‌دهنده واقعی غیرفعال است؛ این
              گزینه‌ها صرفاً وضعیت اتصال را نشان می‌دهند و ارسال واقعی ندارند.
            </p>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="clay rounded-[26px] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-4" /></span>
              <h2 className="text-[12px] font-extrabold">هوش مصنوعی و نگهداری</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="مدل ایجنت">
                <Input dir="ltr" value={form.aiModel} onChange={(event) => set("aiModel", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="هزینه تقریبی هر درخواست (تومان)">
                <Input dir="ltr" min={0} type="number" value={form.aiCostPerRequestToman} onChange={(event) => set("aiCostPerRequestToman", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[10.5px]" />
              </Field>
              <Field label="زمان‌بندی پشتیبان‌گیری">
                <Input value={form.backupSchedule} onChange={(event) => set("backupSchedule", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
              <Field label="یادداشت پشتیبان‌گیری">
                <Input value={form.backupNote} onChange={(event) => set("backupNote", event.target.value)} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              <ToggleRow label="ایجنت هوشمند فعال باشد" description="مسیرهای غیرنرخ‌نامه‌ای از سرویس AI استفاده می‌کنند." checked={form.aiEnabled} onChange={(value) => set("aiEnabled", value)} />
              <ToggleRow label="حالت تعمیرات" description="پیام تعمیرات در پنل نمایش داده می‌شود؛ عملیات حساس همچنان از سرور کنترل می‌شوند." checked={form.maintenanceMode} onChange={(value) => set("maintenanceMode", value)} />
            </div>
            {form.maintenanceMode && (
              <Field label="پیام تعمیرات" className="mt-3">
                <Textarea value={form.maintenanceMessage} onChange={(event) => set("maintenanceMessage", event.target.value)} className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[10.5px]" />
              </Field>
            )}
            <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-muted/40 p-2.5 text-[9px] leading-5 text-muted-foreground">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
              کلید API هوش مصنوعی و شناسه پذیرنده درگاه فقط از env سرور خوانده
              می‌شوند و در این صفحه یا دیتابیس ذخیره نمی‌شوند.
            </div>
          </section>

          <section className="clay rounded-[26px] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><CreditCard className="size-4" /></span>
              <h2 className="text-[12px] font-extrabold">دوره آزمایشی و مالی</h2>
            </div>
            <div className="mt-4 space-y-2">
              <InfoRow label="مدت دوره آزمایشی" value={settings?.trialDays ? `${faNumber(settings.trialDays)} روز` : "تعیین نشده"} />
              <InfoRow label="اجازه استفاده مجدد" value={settings?.billingSettings?.allowTrialReuse ? "فعال" : "غیرفعال"} />
              <InfoRow label="درگاه پرداخت" value={settings?.billingSettings?.gatewayProvider ?? "زرین‌پال"} />
              <InfoRow label="هزینه تقریبی AI" value={form.aiCostPerRequestToman ? faToman(Number(form.aiCostPerRequestToman)) : "ثبت نشده"} />
            </div>
            <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
              قیمت پلن‌ها، تخفیف سالانه و سیاست استفاده مجدد از دوره آزمایشی
              در بخش مالی و اشتراک قابل ویرایش است تا از تنظیمات تکراری جلوگیری شود.
            </p>
            <Button asChild variant="ghost" className="mt-2 h-8 rounded-lg px-2 text-[9.5px] text-primary">
              <Link to="/admin/billing">
                <Sparkles className="size-3.5" />
                مدیریت پلن‌ها و دوره آزمایشی
              </Link>
            </Button>
          </section>
        </div>

        {canNotifications && (
        <section className="clay rounded-[26px] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-4" /></span>
              <div>
                <h2 className="text-[12px] font-extrabold">اعلان‌های پلتفرم</h2>
                <p className="text-[9px] text-muted-foreground">فقط اعلان‌های فعال و در بازه زمانی برای کاربران نمایش داده می‌شوند.</p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full text-[8px]">{faNumber(notifications.filter((row) => row.isActive).length)} فعال</Badge>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-2">
              <Field label="عنوان"><Input value={notificationForm.title} onChange={(event) => setNotificationForm({ ...notificationForm, title: event.target.value })} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-[10.5px]" /></Field>
              <Field label="متن"><Textarea value={notificationForm.body} onChange={(event) => setNotificationForm({ ...notificationForm, body: event.target.value })} className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[10.5px]" /></Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="شروع (خالی = فوری)"><Input type="datetime-local" dir="ltr" value={notificationForm.startsAt} onChange={(event) => setNotificationForm({ ...notificationForm, startsAt: event.target.value })} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]" /></Field>
                <Field label="پایان (اختیاری)"><Input type="datetime-local" dir="ltr" value={notificationForm.endsAt} onChange={(event) => setNotificationForm({ ...notificationForm, endsAt: event.target.value })} className="clay-inset h-9 rounded-xl border-0 bg-transparent text-left text-[9.5px]" /></Field>
              </div>
              <Field label="نوع">
                <Select value={notificationForm.tone} onValueChange={(value) => setNotificationForm({ ...notificationForm, tone: value as NotificationRow["tone"] })}>
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="info">اطلاع‌رسانی</SelectItem>
                    <SelectItem value="success">موفقیت</SelectItem>
                    <SelectItem value="warning">هشدار</SelectItem>
                    <SelectItem value="critical">بحرانی</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button type="button" onClick={handleCreateNotification} disabled={notificationBusy} className="clay-primary h-9 w-full rounded-xl border-0 text-[10px] font-bold">
                {notificationBusy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-3.5" />}
                ایجاد اعلان
              </Button>
            </div>

            <div className="space-y-2">
              {notifications.length === 0 ? (
                <p className="rounded-xl bg-muted/40 p-4 text-center text-[10px] text-muted-foreground">اعلانی ثبت نشده است.</p>
              ) : (
                notifications.map((row) => (
                  <div key={row.id} className="rounded-2xl bg-muted/35 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10.5px] font-bold">{row.title}</p>
                        <p className="mt-1 text-[9px] leading-5 text-muted-foreground">{row.body}</p>
                      </div>
                      <Switch checked={row.isActive} onCheckedChange={async (value) => {
                        try {
                          await setNotificationActive({ notificationId: row.id, isActive: value });
                          toast.success("وضعیت اعلان تغییر کرد.");
                        } catch (caught) {
                          toast.error(errorMessage(caught, "تغییر اعلان ممکن نشد."));
                        }
                      }} />
                    </div>
                    <p className="mt-1 text-[8px] text-muted-foreground">
                      {faDateLong(row.startsAt)}{row.endsAt ? ` تا ${faDateLong(row.endsAt)}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={busy} className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            ذخیره همه تنظیمات
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-[9.5px]">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled = false }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5", disabled && "opacity-60")}>
      <div>
        <p className="text-[9.5px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[8.5px] leading-4 text-muted-foreground">{description}</p>
      </div>
      <Switch disabled={disabled} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/35 px-3 py-2 text-[9.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
