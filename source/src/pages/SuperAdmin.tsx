import { AdminShell } from "@/components/layout/AdminShell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { useSession } from "@/hooks/use-session";
import {
  PASSWORD_RULE,
  errorMessage,
  isValidPassword,
} from "@/lib/auth";
import { faDateTime, faNumber, faToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "@/backend/client";
import {
  Activity,
  ArrowLeft,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  Crown,
  Globe2,
  HeartPulse,
  KeyRound,
  LayoutTemplate,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  Megaphone,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Overview = {
  cafes: { total: number; active: number; suspended: number };
  employees: { total: number; active: number };
  users: number;
  usersTotal: number;
  subscriptions: {
    trial: number;
    active: number;
    expired: number;
    canceled: number;
    pending_payment: number;
    expiringSoon: number;
    monthly: number;
    yearly: number;
  };
  revenue: {
    todayToman: number;
    monthToman: number;
    yearToman: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  };
  ai: { requests: number; runs: number; aiRuns: number; errors: number };
  support: { open: number; inProgress: number; urgent: number };
  recentAudit: {
    id: string;
    actorName: string;
    action: string;
    summary: string;
    createdAt: number;
  }[];
  generatedAt: number;
};

type SecuritySummary = {
  mfaEnabled: boolean;
  mfaVerified: boolean;
  activeSessions: number;
  failedLogins24h: number;
  failedMfa24h: number;
  recentEvents: {
    id: string;
    action: string;
    outcome: "success" | "failure" | "blocked";
    identifierMasked: string | null;
    createdAt: number;
  }[];
};

type SessionRow = {
  id: Id<"authSessions">;
  createdAt: number;
  expiresAt: number;
  expired: boolean;
  current: boolean;
  mfaVerified: boolean;
  mfaExpiresAt: number | null;
};

type ActivityRow = {
  id: string;
  action: string;
  outcome: "success" | "failure" | "blocked";
  detail: string | null;
  identifierMasked: string | null;
  actorName: string | null;
  createdAt: number;
};

type HistoryData = {
  currentUpdatedAt: number | null;
  rows: {
    id: Id<"platform_settings_history">;
    actorName: string;
    note: string | null;
    createdAt: number;
  }[];
};

type ReauthAction =
  | {
      kind: "restore";
      historyId: Id<"platform_settings_history">;
      label: string;
    }
  | { kind: "revoke"; sessionId: Id<"authSessions">; label: string };

const MODULES: {
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
  tone: "navy" | "mint" | "peach" | "lilac";
}[] = [
  {
    title: "اشتراک‌ها و قیمت‌ها",
    description: "پلن‌ها، تمدید، تخفیف و دوره آزمایشی",
    href: "/admin/billing",
    icon: CreditCard,
    tone: "navy",
  },
  {
    title: "کافی‌نت‌ها",
    description: "حساب‌ها، مالکان، وضعیت و اشتراک",
    href: "/admin/cafes",
    icon: Building2,
    tone: "mint",
  },
  {
    title: "کاربران و کارمندان",
    description: "حساب‌ها، نقش‌ها و دسترسی‌ها",
    href: "/admin/users",
    icon: Users,
    tone: "peach",
  },
  {
    title: "نقش‌ها و مجوزها",
    description: "تعریف دسترسی تیم مدیریت",
    href: "/admin/roles",
    icon: UserCog,
    tone: "lilac",
  },
  {
    title: "مالی و پرداخت",
    description: "فاکتور، تراکنش، درگاه و تخفیف",
    href: "/admin/billing",
    icon: Wallet,
    tone: "mint",
  },
  {
    title: "اخبار و اطلاعیه",
    description: "انتشار، دسته‌بندی و زمان‌بندی",
    href: "/admin/news",
    icon: Newspaper,
    tone: "navy",
  },
  {
    title: "بانک سامانه‌ها",
    description: "وب‌سایت‌ها، منابع و پیشنهادها",
    href: "/admin/sites",
    icon: Globe2,
    tone: "peach",
  },
  {
    title: "دانش و نرخ‌نامه",
    description: "هوش مصنوعی، اسناد و نرخ خدمات",
    href: "/admin/agent",
    icon: Bot,
    tone: "lilac",
  },
  {
    title: "پشتیبانی",
    description: "تیکت‌ها، پاسخ و وضعیت رسیدگی",
    href: "/admin/support",
    icon: LifeBuoy,
    tone: "mint",
  },
  {
    title: "مدیریت سایت و ظاهر",
    description: "صفحات، تم، منو و قابلیت‌ها",
    href: "/admin/site",
    icon: LayoutTemplate,
    tone: "mint",
  },
  {
    title: "اعلان‌های پلتفرم",
    description: "پیام عمومی و اعلان کافی‌نت‌ها",
    href: "/admin/notifications",
    icon: Megaphone,
    tone: "navy",
  },
  {
    title: "گزارش فعالیت",
    description: "ردپای کامل عملیات مدیران",
    href: "/admin/audit",
    icon: ClipboardList,
    tone: "peach",
  },
  {
    title: "تنظیمات و سلامت",
    description: "پیکربندی سایت، درگاه و سرویس‌ها",
    href: "/admin/settings",
    icon: Settings2,
    tone: "lilac",
  },
];

const SECURITY_ACTIONS: Record<string, string> = {
  login_success: "ورود موفق",
  login_failed: "ورود ناموفق",
  logout: "خروج",
  mfa_setup_started: "شروع راه‌اندازی ۲FA",
  mfa_enabled: "فعال‌سازی ۲FA",
  mfa_verified: "تأیید ۲FA",
  mfa_failed: "کد ۲FA ناموفق",
  mfa_setup_failed: "راه‌اندازی ۲FA ناموفق",
  mfa_disable_failed: "غیرفعال‌سازی ۲FA ناموفق",
  mfa_disabled: "غیرفعال‌سازی ۲FA",
  session_revoked: "لغو نشست",
};

function securityActionLabel(action: string) {
  return SECURITY_ACTIONS[action] ?? action;
}

function outcomeLabel(outcome: ActivityRow["outcome"]) {
  if (outcome === "success") return "موفق";
  if (outcome === "blocked") return "مسدود";
  return "ناموفق";
}

export default function SuperAdmin() {
  const { context } = useSession();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reauth, setReauth] = useState<ReauthAction | null>(null);
  const [reauthCode, setReauthCode] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const security = useQuery(api.superAdmin.securityStatus, {});
  const ready = security?.mfaEnabled === true && security.verified === true;
  const overview = useQuery(
    api.admin.overview,
    ready ? {} : "skip",
  ) as Overview | undefined;
  const summary = useQuery(
    api.superAdmin.securitySummary,
    ready ? {} : "skip",
  ) as SecuritySummary | undefined;
  const sessions = useQuery(
    api.superAdmin.sessions,
    ready ? {} : "skip",
  ) as SessionRow[] | undefined;
  const activity = useQuery(
    api.superAdmin.activity,
    ready ? {} : "skip",
  ) as ActivityRow[] | undefined;
  const history = useQuery(
    api.superAdmin.settingsHistory,
    ready ? {} : "skip",
  ) as HistoryData | undefined;

  const verifyMfa = useMutation(api.superAdmin.verifyMfa);
  const revokeSession = useMutation(api.superAdmin.revokeSession);
  const restoreSettings = useMutation(api.superAdmin.restoreSettings);
  const changePassword = useAction(api.authActions.changePassword);

  const requestReauth = (action: ReauthAction) => {
    setReauthCode("");
    setReauthError(null);
    setReauth(action);
  };

  const confirmReauth = async (event: FormEvent) => {
    event.preventDefault();
    if (!reauth) return;
    if (!/^\d{6}$/.test(reauthCode.trim())) {
      setReauthError("کد ۶ رقمی برنامه Authenticator را وارد کنید.");
      return;
    }
    setReauthBusy(true);
    setReauthError(null);
    try {
      const verification = await verifyMfa({ code: reauthCode.trim() });
      if (!verification.ok) throw new Error("کد تأیید نادرست است.");
      if (reauth.kind === "restore") {
        await restoreSettings({ historyId: reauth.historyId });
        toast.success("تنظیمات به نسخه انتخاب‌شده بازگردانده شد.");
      } else {
        await revokeSession({ sessionId: reauth.sessionId });
        toast.success("نشست انتخابی لغو شد.");
      }
      setReauth(null);
      setReauthCode("");
    } catch (error) {
      setReauthError(
        errorMessage(error, "انجام این عملیات حساس ممکن نشد."),
      );
    } finally {
      setReauthBusy(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
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
    setPasswordBusy(true);
    try {
      await changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.next,
        confirmPassword: passwords.confirm,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("رمز عبور تغییر کرد؛ سایر دستگاه‌ها از حساب خارج شدند.");
    } catch (error) {
      setPasswordError(
        errorMessage(error, "تغییر رمز عبور ممکن نشد. دوباره تلاش کنید."),
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const activeSessions = sessions?.filter((row) => !row.expired) ?? [];
  const lastActivity = activity?.[0]?.createdAt ?? null;

  if (security === undefined) {
    return (
      <AdminShell active="super">
        <div className="clay flex min-h-56 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!ready) {
    return (
      <AdminShell active="super">
        <div className="clay mx-auto max-w-lg rounded-[30px] p-7 text-center">
          <ShieldX className="mx-auto size-8 text-amber-600" />
          <h1 className="mt-3 text-lg font-extrabold">
            کنسول مالک نیازمند تأیید دومرحله‌ای است
          </h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            برای محافظت از تنظیمات و اطلاعات مالی پلتفرم، ابتدا احراز هویت
            دومرحله‌ای را تکمیل کنید.
          </p>
          <Button asChild className="clay-primary mt-5 h-10 rounded-xl border-0 text-[11px]">
            <Link to="/admin">رفتن به صفحه تأیید امنیتی</Link>
          </Button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="super">
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[32px] bg-[oklch(0.23_0.045_264)] px-5 py-6 text-white shadow-[0_24px_60px_-30px_oklch(0.25_0.08_264/0.8)] sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute -end-20 -top-24 size-72 rounded-full bg-[oklch(0.7_0.12_220)]/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 start-1/3 h-32 w-72 rounded-full bg-[oklch(0.75_0.1_170)]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[9.5px] font-bold tracking-wide text-white/55">
                <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-amber-200">
                  <Crown className="size-3.5" />
                </span>
                کنسول اختصاصی مالک پلتفرم
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                مدیریت کل کافی‌نت‌یار
              </h1>
              <p className="mt-2 max-w-xl text-[11px] leading-6 text-white/60">
                تمام بخش‌های پلتفرم از یک نقطه؛ با کنترل سمت سرور، احراز هویت
                دومرحله‌ای و ثبت کامل فعالیت‌های حساس.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9.5px] font-bold text-white/65">
                  <Crown className="size-3.5" />
                  {context?.user.name ?? "مالک اصلی"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[9.5px] font-bold text-emerald-200">
                  <ShieldCheck className="size-3.5" />
                  ورود دومرحله‌ای تأیید شد
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9.5px] font-bold text-white/65">
                  <Users className="size-3.5" />
                  {faNumber(summary?.activeSessions ?? activeSessions.length)} نشست فعال
                </span>
                {lastActivity && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9.5px] font-bold text-white/65">
                    <Clock3 className="size-3.5" />
                    آخرین فعالیت: {faDateTime(lastActivity)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                className="h-10 rounded-xl border-0 bg-white px-4 text-[11px] font-bold text-[oklch(0.26_0.05_264)] shadow-sm hover:bg-white/90"
              >
                <Link to="/admin">
                  <Settings2 className="size-4" />
                  پنل عملیاتی
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-[11px] font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/admin/audit">
                  <ClipboardList className="size-4" />
                  گزارش کامل
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="کل کافی‌نت‌ها"
            value={faNumber(overview?.cafes.total ?? 0)}
            hint={`${faNumber(overview?.cafes.active ?? 0)} فعال · ${faNumber(overview?.cafes.suspended ?? 0)} غیرفعال`}
            icon={<Building2 className="size-4" />}
            tone="navy"
          />
          <Metric
            label="کاربران و کارمندان"
            value={faNumber(overview?.users ?? 0)}
            hint={`${faNumber(overview?.employees.total ?? 0)} کارمند ثبت‌شده`}
            icon={<Users className="size-4" />}
            tone="mint"
          />
          <Metric
            label="اشتراک فعال"
            value={faNumber(overview?.subscriptions.active ?? 0)}
            hint={`${faNumber(overview?.subscriptions.trial ?? 0)} آزمایشی · ${faNumber(overview?.subscriptions.expired ?? 0)} منقضی`}
            icon={<CreditCard className="size-4" />}
            tone="lilac"
          />
          <Metric
            label="درآمد ماه جاری"
            value={faToman(overview?.revenue.monthToman ?? 0)}
            hint={`${faNumber(overview?.revenue.successfulPayments ?? 0)} پرداخت موفق · ${faNumber(overview?.revenue.failedPayments ?? 0)} ناموفق`}
            icon={<Wallet className="size-4" />}
            tone="peach"
          />
          <Metric
            label="درآمد سال جاری"
            value={faToman(overview?.revenue.yearToman ?? 0)}
            hint={`امروز: ${faToman(overview?.revenue.todayToman ?? 0)}`}
            icon={<Sparkles className="size-4" />}
            tone="navy"
          />
          <Metric
            label="استفاده از دستیار"
            value={faNumber(overview?.ai.requests ?? 0)}
            hint={`${faNumber(overview?.ai.runs ?? 0)} اجرا · ${faNumber(overview?.ai.errors ?? 0)} خطا`}
            icon={<Bot className="size-4" />}
            tone="mint"
          />
          <Metric
            label="تیکت‌های پشتیبانی"
            value={faNumber(
              (overview?.support.open ?? 0) + (overview?.support.inProgress ?? 0),
            )}
            hint={`${faNumber(overview?.support.open ?? 0)} باز · ${faNumber(overview?.support.urgent ?? 0)} فوری`}
            icon={<LifeBuoy className="size-4" />}
            tone="peach"
          />
          <Metric
            label="ورودهای ناموفق ۲۴ ساعت"
            value={faNumber(summary?.failedLogins24h ?? 0)}
            hint={`${faNumber(summary?.failedMfa24h ?? 0)} خطای کد دومرحله‌ای`}
            icon={<ShieldX className="size-4" />}
            tone="lilac"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <SectionHeader
              icon={<LockKeyhole className="size-4" />}
              title="نشست‌های ورود مدیر کل"
              hint="هر نشست را می‌توانید پس از تأیید مجدد هویت لغو کنید."
              action={
                <Badge
                  variant="outline"
                  className="rounded-full border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-300"
                >
                  {faNumber(summary?.activeSessions ?? activeSessions.length)} فعال
                </Badge>
              }
            />
            <div className="mt-4 space-y-2">
              {sessions === undefined ? (
                <InlineLoading />
              ) : sessions.length === 0 ? (
                <EmptyRow text="نشست ورودی برای این حساب ثبت نشده است." />
              ) : (
                sessions.slice(0, 6).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2 rounded-2xl bg-muted/35 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[10.5px] font-bold">
                          {session.current ? "نشست فعلی شما" : "ورود از دستگاه دیگر"}
                        </p>
                        {session.current && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary">
                            همین دستگاه
                          </span>
                        )}
                        {session.expired && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8.5px] text-muted-foreground">
                            منقضی
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        شروع: {faDateTime(session.createdAt)} · پایان:{" "}
                        {faDateTime(session.expiresAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={session.current || session.expired}
                      onClick={() =>
                        requestReauth({
                          kind: "revoke",
                          sessionId: session.id,
                          label: session.current ? "نشست فعلی" : "این نشست",
                        })
                      }
                      className="h-8 shrink-0 rounded-lg px-2.5 text-[9.5px] text-rose-700 hover:bg-rose-500/10 hover:text-rose-800 dark:text-rose-300"
                    >
                      <XCircle className="size-3.5" />
                      لغو نشست
                    </Button>
                  </div>
                ))
              )}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[9px] leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              تأیید دومرحله‌ای به هر نشست متصل است و پس از ۳۰ دقیقه منقضی می‌شود.
            </p>
          </section>

          <section className="clay rounded-[28px] p-4 sm:p-5">
            <SectionHeader
              icon={<KeyRound className="size-4" />}
              title="تغییر امن رمز عبور"
              hint="پس از تغییر، سایر نشست‌های ورود بسته می‌شوند."
            />
            <form onSubmit={submitPassword} className="mt-4 space-y-3">
              <PasswordField
                id="owner-current-password"
                label="رمز عبور فعلی"
                value={passwords.current}
                onChange={(value) =>
                  setPasswords((current) => ({ ...current, current: value }))
                }
                autoComplete="current-password"
              />
              <PasswordField
                id="owner-new-password"
                label="رمز عبور جدید"
                value={passwords.next}
                onChange={(value) =>
                  setPasswords((current) => ({ ...current, next: value }))
                }
                autoComplete="new-password"
                hint={PASSWORD_RULE}
              />
              <PasswordField
                id="owner-confirm-password"
                label="تکرار رمز جدید"
                value={passwords.confirm}
                onChange={(value) =>
                  setPasswords((current) => ({ ...current, confirm: value }))
                }
                autoComplete="new-password"
              />
              {passwordError && (
                <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[10px] leading-5 text-rose-700 dark:text-rose-300">
                  {passwordError}
                </p>
              )}
              <Button
                type="submit"
                disabled={passwordBusy}
                className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold"
              >
                {passwordBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                ذخیره رمز جدید
              </Button>
            </form>
          </section>
        </div>

        <section className="clay rounded-[28px] p-4 sm:p-5">
          <SectionHeader
            icon={<Building2 className="size-4" />}
            title="دسترسی سریع به تمام بخش‌ها"
            hint="همه امکانات مدیریتی از همین‌جا قابل دسترسی است."
            action={
              <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-[9.5px]">
                <Link to="/admin">
                  داشبورد کامل
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
            }
          />
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.title}
                  to={module.href}
                  className="group flex items-start gap-3 rounded-2xl border border-border/40 bg-background/35 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[0.04]"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      module.tone === "navy" && "tile-navy",
                      module.tone === "mint" && "tile-mint",
                      module.tone === "peach" && "tile-peach",
                      module.tone === "lilac" && "tile-lilac",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-bold">
                      {module.title}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-5 text-muted-foreground">
                      {module.description}
                    </span>
                  </span>
                  <ArrowLeft className="ms-auto mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <SectionHeader
              icon={<ClipboardList className="size-4" />}
              title="آخرین فعالیت‌های مدیریتی"
              hint="خلاصه ردپای تغییرات حساس در پلتفرم."
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen((value) => !value)}
                  className="h-8 rounded-lg text-[9.5px]"
                >
                  <RefreshCw className="size-3.5" />
                  {historyOpen ? "بستن تاریخچه" : "تاریخچه تنظیمات"}
                </Button>
              }
            />
            <div className="mt-3 space-y-2">
              {(overview?.recentAudit ?? []).slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 rounded-2xl bg-muted/30 px-3 py-2.5"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="size-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold leading-5">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-[8.5px] text-muted-foreground">
                      {event.actorName} · {faDateTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {overview && overview.recentAudit.length === 0 && (
                <EmptyRow text="هنوز رویداد مدیریتی ثبت نشده است." />
              )}
              {!overview && <InlineLoading />}
            </div>
            {historyOpen && (
              <div className="mt-4 border-t border-border/40 pt-4">
                <p className="text-[10px] font-bold">تاریخچه تنظیمات پلتفرم</p>
                <div className="mt-2 space-y-2">
                  {history === undefined ? (
                    <InlineLoading />
                  ) : history.rows.length === 0 ? (
                    <EmptyRow text="هنوز نسخه‌ای از تنظیمات ذخیره نشده است." />
                  ) : (
                    history.rows.slice(0, 6).map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2"
                      >
                        <div>
                          <p className="text-[9.5px] font-semibold">
                            {row.note ?? "نسخه تنظیمات"}
                          </p>
                          <p className="text-[8.5px] text-muted-foreground">
                            {row.actorName} · {faDateTime(row.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            requestReauth({
                              kind: "restore",
                              historyId: row.id,
                              label: row.note ?? "نسخه تنظیمات",
                            })
                          }
                          className="h-7 rounded-lg px-2 text-[9px]"
                        >
                          <RotateCcw className="size-3" />
                          بازگردانی
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="clay rounded-[28px] p-4 sm:p-5">
            <SectionHeader
              icon={<ShieldCheck className="size-4" />}
              title="رویدادهای امنیتی"
              hint="ورود، خروج و تأییدهای دومرحله‌ای اخیر."
              action={
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-[9px]"
                >
                  {faNumber(summary?.activeSessions ?? 0)} نشست
                </Badge>
              }
            />
            <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pe-1">
              {activity === undefined ? (
                <InlineLoading />
              ) : activity.length === 0 ? (
                <EmptyRow text="رویداد امنیتی ثبت نشده است." />
              ) : (
                activity.slice(0, 12).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 rounded-2xl bg-muted/30 px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg",
                        event.outcome === "success"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {event.outcome === "success" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[10px] font-semibold">
                          {securityActionLabel(event.action)}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                            event.outcome === "success"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {outcomeLabel(event.outcome)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[8.5px] text-muted-foreground">
                        {event.actorName ?? "ناشناس"}
                        {event.identifierMasked
                          ? ` · ${event.identifierMasked}`
                          : ""}{" "}
                        · {faDateTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] leading-5 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <HeartPulse className="size-3.5" />
            وضعیت داده‌ها: اتصال زنده به Convex · آخرین بروزرسانی:{" "}
            {overview ? faDateTime(overview.generatedAt) : "در حال دریافت"}
          </span>
          <Link
            to="/admin/health"
            className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            سلامت و پایش سامانه
            <ArrowLeft className="size-3" />
          </Link>
        </div>
      </div>

      <AlertDialog
        open={reauth !== null}
        onOpenChange={(open) => {
          if (!open && !reauthBusy) {
            setReauth(null);
            setReauthCode("");
            setReauthError(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-[26px]">
          <form onSubmit={confirmReauth} className="space-y-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-extrabold">
                تأیید مجدد هویت
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[11px] leading-6">
                برای {reauth?.kind === "restore" ? "بازگردانی" : "لغو"} «
                {reauth?.label ?? "این مورد"}» کد ۶ رقمی برنامه Authenticator را
                وارد کنید. این تأیید برای جلوگیری از عملیات ناخواسته است.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="reauth-code" className="text-[11px] font-semibold">
                کد دومرحله‌ای
              </Label>
              <Input
                id="reauth-code"
                value={reauthCode}
                onChange={(event) =>
                  setReauthCode(
                    event.target.value.replace(/[^\d]/g, "").slice(0, 6),
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                dir="ltr"
                placeholder="••••••"
                className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.45em]"
              />
            </div>
            {reauthError && (
              <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[10px] leading-5 text-rose-700 dark:text-rose-300">
                {reauthError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                disabled={reauthBusy}
                className="rounded-xl text-[11px]"
              >
                انصراف
              </AlertDialogCancel>
              <Button
                type="submit"
                disabled={reauthBusy || reauthCode.length !== 6}
                className="clay-primary h-9 rounded-xl border-0 text-[11px] font-bold"
              >
                {reauthBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                تأیید و انجام
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: "navy" | "mint" | "peach" | "lilac";
}) {
  return (
    <div className="clay rounded-[23px] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-[11px]",
            tone === "navy" && "tile-navy",
            tone === "mint" && "tile-mint",
            tone === "peach" && "tile-peach",
            tone === "lilac" && "tile-lilac",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-lg font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[8.5px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-[12.5px] font-extrabold">{title}</h2>
          <p className="mt-0.5 text-[9px] leading-5 text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[10px] font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="clay-inset h-10 rounded-xl border-0 shadow-none"
      />
      {hint && (
        <p className="text-[8.5px] leading-4 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function InlineLoading() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-muted/30 px-3 py-6">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-muted/30 px-3 py-4 text-center text-[9.5px] leading-5 text-muted-foreground">
      {text}
    </p>
  );
}
