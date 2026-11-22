import { AdminShell } from "@/components/layout/AdminShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { faDateLong, faDateTime, faNumber, faToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "@/backend/client";
import {
  BadgeDollarSign,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  Gift,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TicketPercent,
  TriangleAlert,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

type Tab =
  | "plans"
  | "subscribers"
  | "payments"
  | "discounts"
  | "reports"
  | "events"
  | "settings";

type Entitlements = {
  maxEmployees: number;
  aiRequestsPerMonth: number;
  agent: boolean;
  rates: boolean;
  accounting: "limited" | "full";
  advancedReports: boolean;
  advancedManagement: boolean;
  prioritySupport: boolean;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationDays: number;
  monthlyPriceToman: number;
  yearlyPriceToman: number;
  yearlyDiscountPercent: number;
  features: string[];
  entitlements: Entitlements;
  isTrial: boolean;
  isActive: boolean;
  sortOrder: number;
  subscribers?: number;
};

type SubscriberRow = {
  cafeId: Id<"internet_cafes">;
  cafeName: string;
  city: string;
  province: string;
  cafeStatus: "active" | "suspended";
  ownerName: string;
  ownerPhone: string | null;
  employeeCount: number;
  planCode: string | null;
  planName: string | null;
  status: string;
  startsAt: number | null;
  endsAt: number | null;
  billingCycle: "monthly" | "yearly" | null;
  lastPaymentAt: number | null;
  renewalAt: number | null;
  daysLeft: number;
  trialUsed: boolean;
  aiUsed: number;
  aiLimit: number | null;
};

type PaymentRow = {
  orderId: Id<"payment_orders">;
  orderNumber: string;
  cafeName: string;
  cafeId: Id<"internet_cafes">;
  planCode: string;
  billingCycle: "monthly" | "yearly";
  subtotalToman: number;
  discountToman: number;
  totalToman: number;
  discountCode: string | null;
  status: "pending" | "paid" | "failed" | "canceled";
  gateway: string | null;
  authority: string | null;
  referenceId: string | null;
  failureReason: string | null;
  invoiceNumber: string | null;
  invoiceStatus: "paid" | "void" | null;
  transactionStatus: string | null;
  transactionKind: string | null;
  paidAt: number | null;
  createdAt: number;
};

type DiscountRow = {
  id: Id<"discount_codes">;
  code: string;
  title: string;
  discountType: "percent" | "fixed";
  value: number;
  startsAt: number;
  endsAt: number;
  maxUses: number;
  maxUsesPerCafe: number;
  applicablePlans: string[];
  isActive: boolean;
  usedCount: number;
  discountTotalToman: number;
  createdAt: number;
};

type EventRow = {
  id: string;
  type: string;
  description: string;
  cafeName: string | null;
  actorName: string;
  metadata: string | null;
  createdAt: number;
};

type ReportData = {
  totalRevenueToman: number;
  totalInvoices: number;
  monthly: { key: string; revenue: number; invoices: number }[];
  yearly: { key: string; revenue: number; invoices: number }[];
  subscribersByPlan: { code: string; name: string; count: number }[];
};

type SettingsData = {
  allowTrialReuse: boolean;
  gatewayProvider: string;
  trial: PlanRow | null;
  gatewayConfigured: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  trial: "آزمایشی",
  active: "فعال",
  expired: "منقضی",
  canceled: "لغوشده",
  pending_payment: "در انتظار پرداخت",
  pending: "در انتظار",
  paid: "پرداخت‌شده",
  failed: "ناموفق",
};

const EVENT_LABELS: Record<string, string> = {
  order_created: "ایجاد سفارش",
  order_canceled: "لغو سفارش",
  order_canceled_admin: "لغو سفارش توسط مدیر",
  payment_succeeded: "پرداخت موفق",
  payment_failed: "پرداخت ناموفق",
  manual_payment: "پرداخت دستی",
  gateway_redirect: "انتقال به درگاه",
  plan_updated: "ویرایش پلن",
  trial_granted: "اعطای دوره آزمایشی",
  subscription_changed: "تغییر اشتراک",
  subscription_canceled: "لغو اشتراک",
  discount_created: "ایجاد تخفیف",
  discount_updated: "ویرایش تخفیف",
  discount_toggled: "وضعیت تخفیف",
  settings_updated: "تنظیمات مالی",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeInput(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function fromDateTimeInput(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status: string) {
  if (status === "active" || status === "paid" || status === "trial")
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "failed" || status === "expired" || status === "canceled")
    return "bg-destructive/10 text-destructive";
  return "bg-amber-500/10 text-amber-800 dark:text-amber-200";
}

function emptyPlanForm(plan?: PlanRow) {
  return {
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    monthly: String(plan?.monthlyPriceToman ?? 0),
    yearly: String(plan?.yearlyPriceToman ?? 0),
    yearlyDiscount: String(plan?.yearlyDiscountPercent ?? 0),
    durationDays: String(plan?.durationDays ?? 30),
    features: (plan?.features ?? []).join("\n"),
    isActive: plan?.isActive ?? true,
    maxEmployees: String(plan?.entitlements.maxEmployees ?? 2),
    aiRequests: String(plan?.entitlements.aiRequestsPerMonth ?? 0),
    agent: plan?.entitlements.agent ?? false,
    rates: plan?.entitlements.rates ?? false,
    accounting: plan?.entitlements.accounting ?? ("limited" as const),
    advancedReports: plan?.entitlements.advancedReports ?? false,
    advancedManagement: plan?.entitlements.advancedManagement ?? false,
    prioritySupport: plan?.entitlements.prioritySupport ?? false,
  };
}

type PlanForm = ReturnType<typeof emptyPlanForm>;

function emptyDiscountForm() {
  const now = Date.now();
  return {
    id: null as Id<"discount_codes"> | null,
    code: "",
    title: "",
    discountType: "percent" as "percent" | "fixed",
    value: "10",
    startsAt: toDateTimeInput(now),
    endsAt: toDateTimeInput(now + 30 * 24 * 60 * 60 * 1000),
    maxUses: "0",
    maxUsesPerCafe: "0",
    applicablePlans: [] as string[],
    isActive: true,
  };
}

type DiscountForm = ReturnType<typeof emptyDiscountForm>;

export default function AdminBilling() {
  const { context } = useSession();
  const isAdmin = context?.isSiteAdmin === true;
  const [tab, setTab] = useState<Tab>("plans");
  const [search, setSearch] = useState("");
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm());
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [discountForm, setDiscountForm] =
    useState<DiscountForm>(emptyDiscountForm());
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<PaymentRow | null>(null);
  const [manualReference, setManualReference] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SubscriberRow | null>(null);
  const [settingsOverride, setSettingsOverride] =
    useState<SettingsData | null>(null);
  const seeded = useRef(false);

  const overview = useQuery(
    api.billingAdmin.overview,
    isAdmin ? {} : "skip",
  );
  const plansQuery = useQuery(
    api.billingAdmin.plans,
    isAdmin ? {} : "skip",
  );
  const plans = (plansQuery ?? []) as PlanRow[];
  const subscribersQuery = useQuery(
    api.billingAdmin.subscribers,
    isAdmin && tab === "subscribers"
      ? { search: search.trim() || undefined }
      : "skip",
  );
  const subscribers = (subscribersQuery ?? []) as SubscriberRow[];
  const paymentsQuery = useQuery(
    api.billingAdmin.payments,
    isAdmin && tab === "payments"
      ? { search: search.trim() || undefined }
      : "skip",
  );
  const payments = (paymentsQuery ?? []) as PaymentRow[];
  const discountsQuery = useQuery(
    api.billingAdmin.discounts,
    isAdmin && tab === "discounts" ? {} : "skip",
  );
  const discounts = (discountsQuery ?? []) as DiscountRow[];
  const reportsQuery = useQuery(
    api.billingAdmin.reports,
    isAdmin && tab === "reports" ? {} : "skip",
  );
  const reports = reportsQuery as ReportData | undefined;
  const eventsQuery = useQuery(
    api.billingAdmin.events,
    isAdmin && tab === "events" ? {} : "skip",
  );
  const events = (eventsQuery ?? []) as EventRow[];
  const settingsQuery = useQuery(
    api.billingAdmin.settings,
    isAdmin ? {} : "skip",
  );
  const settings = settingsQuery as SettingsData | undefined;
  const settingsDraft = settingsOverride ?? settings ?? null;

  const exportSubscribers = () => {
    downloadCsv(
      "subscribers.csv",
      ["کافی‌نت", "شهر", "استان", "مالک", "موبایل", "کارکنان", "پلن", "وضعیت", "شروع", "پایان", "دوره", "روز باقی‌مانده", "مصرف AI"],
      subscribers.map((row) => [
        row.cafeName,
        row.city,
        row.province,
        row.ownerName,
        row.ownerPhone,
        row.employeeCount,
        row.planName,
        STATUS_LABELS[row.status] ?? row.status,
        row.startsAt ? faDateLong(row.startsAt) : "",
        row.endsAt ? faDateLong(row.endsAt) : "",
        row.billingCycle === "yearly" ? "سالانه" : row.billingCycle === "monthly" ? "ماهانه" : "",
        row.daysLeft,
        row.aiLimit === null ? "" : `${row.aiUsed}/${row.aiLimit}`,
      ]),
    );
  };

  const exportPayments = () => {
    downloadCsv(
      "payments.csv",
      ["شماره سفارش", "کافی‌نت", "پلن", "دوره", "مبلغ کل", "تخفیف", "کد تخفیف", "وضعیت", "درگاه", "کد پیگیری", "شماره فاکتور", "تاریخ پرداخت", "تاریخ ایجاد"],
      payments.map((row) => [
        row.orderNumber,
        row.cafeName,
        row.planCode,
        row.billingCycle === "yearly" ? "سالانه" : "ماهانه",
        row.totalToman,
        row.discountToman,
        row.discountCode,
        STATUS_LABELS[row.status] ?? row.status,
        row.gateway,
        row.referenceId,
        row.invoiceNumber,
        row.paidAt ? faDateLong(row.paidAt) : "",
        faDateLong(row.createdAt),
      ]),
    );
  };

  const exportReports = () => {
    if (!reports) return;
    downloadCsv(
      "revenue-report.csv",
      ["بخش", "دوره", "درآمد (تومان)", "تعداد فاکتور"],
      [
        ...reports.monthly.map((row) => ["ماهانه", row.key, row.revenue, row.invoices]),
        ...reports.yearly.map((row) => ["سالانه", row.key, row.revenue, row.invoices]),
      ],
    );
  };

  const ensurePlans = useMutation(api.admin.ensurePlans);
  const updatePlan = useMutation(api.billingAdmin.updatePlan);
  const updateSettings = useMutation(api.billingAdmin.updateSettings);
  const grantTrial = useMutation(api.billingAdmin.grantTrial);
  const changeSubscription = useMutation(
    api.billingAdmin.changeSubscription,
  );
  const cancelSubscription = useMutation(
    api.billingAdmin.cancelSubscription,
  );
  const cancelOrder = useMutation(api.billingAdmin.cancelOrder);
  const upsertDiscount = useMutation(api.billingAdmin.upsertDiscount);
  const setDiscountActive = useMutation(
    api.billingAdmin.setDiscountActive,
  );
  const settleManual = useAction(api.billingAdmin.recordManualPayment);

  useEffect(() => {
    if (!isAdmin || seeded.current || plansQuery === undefined) return;
    if (plans.length > 0) return;
    seeded.current = true;
    void ensurePlans({})
      .then(() => toast.success("پلن‌های پیش‌فرض مالی ایجاد شدند."))
      .catch((error) =>
        toast.error(errorMessage(error, "ایجاد پلن‌های پیش‌فرض ممکن نشد.")),
      );
  }, [ensurePlans, isAdmin, plans.length, plansQuery]);

  if (context === undefined) {
    return (
      <AdminShell active="billing">
        <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const openPlan = (plan: PlanRow) => {
    setEditingPlan(plan);
    setPlanForm(emptyPlanForm(plan));
    setPlanDialogOpen(true);
  };

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPlan) return;
    try {
      await updatePlan({
        code: editingPlan.code,
        name: planForm.name,
        description: planForm.description || undefined,
        monthlyPriceToman: Number(planForm.monthly) || 0,
        yearlyPriceToman: Number(planForm.yearly) || 0,
        yearlyDiscountPercent: Number(planForm.yearlyDiscount) || 0,
        durationDays: Number(planForm.durationDays) || 30,
        features: planForm.features
          .split("\n")
          .map((feature) => feature.trim())
          .filter(Boolean),
        entitlements: {
          maxEmployees: Number(planForm.maxEmployees),
          aiRequestsPerMonth: Number(planForm.aiRequests),
          agent: planForm.agent,
          rates: planForm.rates,
          accounting: planForm.accounting,
          advancedReports: planForm.advancedReports,
          advancedManagement: planForm.advancedManagement,
          prioritySupport: planForm.prioritySupport,
        },
        isActive: planForm.isActive,
      });
      setPlanDialogOpen(false);
      toast.success("پلن و امکانات آن به‌روزرسانی شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ذخیره پلن ممکن نشد."));
    }
  };

  const openDiscount = (discount?: DiscountRow) => {
    if (discount) {
      setDiscountForm({
        id: discount.id,
        code: discount.code,
        title: discount.title,
        discountType: discount.discountType,
        value: String(discount.value),
        startsAt: toDateTimeInput(discount.startsAt),
        endsAt: toDateTimeInput(discount.endsAt),
        maxUses: String(discount.maxUses),
        maxUsesPerCafe: String(discount.maxUsesPerCafe),
        applicablePlans: discount.applicablePlans,
        isActive: discount.isActive,
      });
    } else {
      setDiscountForm(emptyDiscountForm());
    }
    setDiscountDialogOpen(true);
  };

  const saveDiscount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await upsertDiscount({
        discountId: discountForm.id ?? undefined,
        code: discountForm.code,
        title: discountForm.title,
        discountType: discountForm.discountType,
        value: Number(discountForm.value) || 0,
        startsAt: fromDateTimeInput(discountForm.startsAt),
        endsAt: fromDateTimeInput(discountForm.endsAt),
        maxUses: Number(discountForm.maxUses) || 0,
        maxUsesPerCafe: Number(discountForm.maxUsesPerCafe) || 0,
        applicablePlans: discountForm.applicablePlans,
        isActive: discountForm.isActive,
      });
      setDiscountDialogOpen(false);
      toast.success("کد تخفیف ذخیره شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ذخیره کد تخفیف ممکن نشد."));
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    try {
      await updateSettings({
        allowTrialReuse: settingsDraft.allowTrialReuse,
        gatewayProvider: settingsDraft.gatewayProvider,
      });
      toast.success("تنظیمات مالی ذخیره شد.");
    } catch (error) {
      toast.error(errorMessage(error, "ذخیره تنظیمات ممکن نشد."));
    }
  };

  const settle = async () => {
    if (!manualTarget) return;
    setManualBusy(true);
    try {
      await settleManual({
        orderId: manualTarget.orderId,
        referenceId: manualReference,
        note: manualNote || undefined,
      });
      toast.success("پرداخت دستی ثبت و اشتراک فعال شد.");
      setManualTarget(null);
      setManualReference("");
      setManualNote("");
    } catch (error) {
      toast.error(errorMessage(error, "ثبت پرداخت دستی ممکن نشد."));
    } finally {
      setManualBusy(false);
    }
  };

  const runSubscriberAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(errorMessage(error, "عملیات انجام نشد."));
    }
  };

  return (
    <AdminShell active="billing">
      <div className="space-y-4">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
                <WalletCards className="size-3.5" />
                مالی و اشتراک‌ها
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
                مدیریت اشتراک، پلن و پرداخت
              </h1>
              <p className="mt-2 max-w-2xl text-[11px] leading-6 text-muted-foreground">
                قیمت‌ها و سهمیه‌ها اینجا تعیین می‌شوند؛ مبلغ نهایی و اعتبار تخفیف
                همیشه سمت سرور محاسبه می‌شود. اطلاعات محرمانه درگاه در متغیرهای
                امن سرور نگهداری می‌شود.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full text-[9px]">
                <ShieldCheck className="me-1 size-3" />
                ثبت رویدادها فعال
              </Badge>
              {overview && (
                <Badge variant="outline" className="rounded-full text-[9px]">
                  {faNumber(overview.subscribers)} مشترک فعال
                </Badge>
              )}
            </div>
          </div>
        </section>

        <nav className="clay flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {(
            [
              ["plans", "پلن‌ها", CreditCard],
              ["subscribers", "مشترکین", Users],
              ["payments", "پرداخت‌ها", Banknote],
              ["discounts", "کدهای تخفیف", TicketPercent],
              ["reports", "گزارش درآمد", BadgeDollarSign],
              ["events", "رویدادها", FileText],
              ["settings", "تنظیمات", Settings2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSearch("");
                setTab(key);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "plans" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-sm font-extrabold">پلن‌های اشتراک</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  قیمت ماهانه و سالانه را جدا تعیین کنید. مبلغ صفر یعنی فروش آن
                  دوره هنوز فعال نیست.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  seeded.current = true;
                  void ensurePlans({})
                    .then(() => toast.success("کاتالوگ پلن‌ها بررسی شد."))
                    .catch((error) =>
                      toast.error(errorMessage(error, "به‌روزرسانی پلن‌ها ممکن نشد.")),
                    );
                }}
                className="h-8 rounded-xl text-[9.5px]"
              >
                <RefreshCw className="size-3" />
                بررسی پیش‌فرض‌ها
              </Button>
            </div>
            {plansQuery === undefined ? (
              <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {plans.map((plan) => (
                  <article key={plan.code} className="clay flex flex-col rounded-[28px] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold">{plan.name}</h3>
                          {plan.isTrial && (
                            <Badge variant="outline" className="rounded-full text-[8px]">
                              آزمایشی
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[9px] leading-5 text-muted-foreground">
                          {plan.description ?? "—"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openPlan(plan)}
                        className="size-7 shrink-0 rounded-lg"
                        aria-label={`ویرایش ${plan.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                    <div className="mt-3 space-y-1 text-[9px]">
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">ماهانه</span>
                        <span className="font-bold">
                          {plan.monthlyPriceToman > 0
                            ? faToman(plan.monthlyPriceToman)
                            : "تعیین‌نشده"}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">سالانه</span>
                        <span className="font-bold">
                          {plan.yearlyPriceToman > 0
                            ? faToman(plan.yearlyPriceToman)
                            : "تعیین‌نشده"}
                        </span>
                      </p>
                      <p className="flex justify-between gap-2">
                        <span className="text-muted-foreground">تخفیف سالانه</span>
                        <span className="font-bold">{faNumber(plan.yearlyDiscountPercent)}٪</span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[8px]">
                        {plan.entitlements.maxEmployees === -1
                          ? "کارمند نامحدود"
                          : `${faNumber(plan.entitlements.maxEmployees)} کارمند`}
                      </span>
                      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[8px]">
                        {plan.entitlements.aiRequestsPerMonth > 0
                          ? `${faNumber(plan.entitlements.aiRequestsPerMonth)} AI`
                          : "بدون AI"}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                      <span className="text-[8.5px] text-muted-foreground">
                        {overview?.plans.find((row) => row.code === plan.code)?.subscribers ?? 0} مشترک
                      </span>
                      <Badge
                        className={cn(
                          "rounded-full text-[8px]",
                          plan.isActive ? statusTone("active") : statusTone("canceled"),
                        )}
                      >
                        {plan.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "subscribers" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">مشترکین کافی‌نت</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  وضعیت، دوره، روز باقی‌مانده و مصرف هوش مصنوعی هر کافی‌نت.
                </p>
              </div>
              <div className="flex w-full max-w-md gap-2">
                <Button type="button" variant="outline" size="sm" onClick={exportSubscribers} disabled={subscribers.length === 0} className="h-9 shrink-0 rounded-xl text-[9px]">
                  <Download className="size-3.5" /> CSV
                </Button>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جست‌وجوی نام، شهر یا موبایل…"
                    className="h-9 rounded-xl ps-9 text-[10px]"
                  />
                </div>
              </div>
            </div>
            {subscribersQuery === undefined ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : subscribers.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                کافی‌نتی با این مشخصات پیدا نشد.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {subscribers.map((row) => (
                  <div key={row.cafeId} className="rounded-2xl border border-border/50 bg-card/60 p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[11px] font-extrabold">{row.cafeName}</p>
                          <Badge className={cn("rounded-full text-[8px]", statusTone(row.status))}>
                            {STATUS_LABELS[row.status] ?? row.status}
                          </Badge>
                          {row.cafeStatus === "suspended" && (
                            <Badge variant="outline" className="rounded-full text-[8px]">
                              کافی‌نت معلق
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {row.ownerName} · {row.ownerPhone ?? "بدون موبایل"} · {row.city}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {row.planName ?? "بدون پلن"}
                          {row.endsAt ? ` · پایان ${faDateLong(row.endsAt)}` : ""}
                          {row.daysLeft > 0 ? ` · ${faNumber(row.daysLeft)} روز` : ""}
                          {row.billingCycle ? ` · ${row.billingCycle === "yearly" ? "سالانه" : "ماهانه"}` : ""}
                        </p>
                        <p className="mt-1 text-[8.5px] text-muted-foreground">
                          {faNumber(row.employeeCount)} کارمند
                          {row.aiLimit !== null
                            ? ` · AI: ${faNumber(row.aiUsed)}/${row.aiLimit > 0 ? faNumber(row.aiLimit) : "نامحدود"}`
                            : ""}
                          {row.trialUsed ? " · آزمایشی استفاده شده" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void runSubscriberAction(
                              () =>
                                grantTrial({
                                  cafeId: row.cafeId,
                                  days: settings?.trial?.durationDays ?? 14,
                                }),
                              "دوره آزمایشی اعطا شد.",
                            )
                          }
                          className="h-7 rounded-lg px-2 text-[8.5px]"
                        >
                          <Gift className="size-3" />
                          آزمایشی
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void runSubscriberAction(
                              () =>
                                changeSubscription({
                                  cafeId: row.cafeId,
                                  planCode: row.planCode ?? "basic",
                                  status: "active",
                                  days: 30,
                                  billingCycle: row.billingCycle ?? "monthly",
                                }),
                              "اشتراک ۳۰ روز تمدید شد.",
                            )
                          }
                          className="h-7 rounded-lg px-2 text-[8.5px]"
                        >
                          <CalendarClock className="size-3" />
                          تمدید ۳۰ روزه
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelTarget(row)}
                          className="h-7 rounded-lg px-2 text-[8.5px] text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="size-3" />
                          لغو
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "payments" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">تراکنش‌ها و سفارش‌ها</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  سفارش‌های درگاه، پرداخت‌های دستی و فاکتورهای ثبت‌شده.
                </p>
              </div>
              <div className="flex w-full max-w-md gap-2">
                <Button type="button" variant="outline" size="sm" onClick={exportPayments} disabled={payments.length === 0} className="h-9 shrink-0 rounded-xl text-[9px]">
                  <Download className="size-3.5" /> CSV
                </Button>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="شماره سفارش، کافی‌نت یا پیگیری…"
                    className="h-9 rounded-xl ps-9 text-[10px]"
                  />
                </div>
              </div>
            </div>
            {paymentsQuery === undefined ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                تراکنشی با این مشخصات پیدا نشد.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {payments.map((row) => (
                  <div key={row.orderId} className="rounded-2xl border border-border/50 bg-card/60 p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-mono text-[9px] font-bold" dir="ltr">{row.orderNumber}</p>
                          <Badge className={cn("rounded-full text-[8px]", statusTone(row.status))}>
                            {STATUS_LABELS[row.status] ?? row.status}
                          </Badge>
                          {row.invoiceNumber && (
                            <Badge variant="outline" className="rounded-full text-[8px]">
                              فاکتور {row.invoiceNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          {row.cafeName} · {row.planCode} · {row.billingCycle === "yearly" ? "سالانه" : "ماهانه"} · {faDateLong(row.createdAt)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold">
                          {faToman(row.totalToman)}
                          {row.discountToman > 0 ? ` (تخفیف ${faToman(row.discountToman)})` : ""}
                        </p>
                        <p className="mt-1 text-[8.5px] text-muted-foreground">
                          {row.gateway ? `درگاه: ${row.gateway}` : "بدون درگاه"}
                          {row.referenceId ? ` · پیگیری ${row.referenceId}` : ""}
                          {row.transactionStatus ? ` · تراکنش ${row.transactionStatus}` : ""}
                          {row.failureReason ? ` · ${row.failureReason}` : ""}
                        </p>
                      </div>
                      {row.status === "pending" && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setManualTarget(row);
                              setManualReference(row.referenceId ?? "");
                              setManualNote("");
                            }}
                            className="h-7 rounded-lg px-2 text-[8.5px]"
                          >
                            <CircleDollarSign className="size-3" />
                            ثبت پرداخت دستی
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void runSubscriberAction(
                                () => cancelOrder({ orderId: row.orderId }),
                                "سفارش لغو شد.",
                              )
                            }
                            className="h-7 rounded-lg px-2 text-[8.5px] text-destructive hover:bg-destructive/10"
                          >
                            لغو
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "discounts" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">کدهای تخفیف</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  اعتبار، سقف استفاده و پلن‌های مشمول در سمت سرور کنترل می‌شوند.
                </p>
              </div>
              <Button type="button" onClick={() => openDiscount()} className="h-8 rounded-xl text-[9.5px]">
                <Plus className="size-3.5" />
                کد تخفیف جدید
              </Button>
            </div>
            {discountsQuery === undefined ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : discounts.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                هنوز کد تخفیفی ساخته نشده است.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {discounts.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-border/50 bg-card/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] font-extrabold" dir="ltr">{row.code}</p>
                      <Badge className={cn("rounded-full text-[8px]", statusTone(row.isActive ? "active" : "canceled"))}>
                        {row.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">{row.title}</span>
                      <span className="ms-auto text-[9px] font-bold">
                        {row.discountType === "percent" ? `${faNumber(row.value)}٪` : faToman(row.value)}
                      </span>
                    </div>
                    <p className="mt-1 text-[8.5px] text-muted-foreground">
                      {faDateLong(row.startsAt)} تا {faDateLong(row.endsAt)}
                      {` · ${faNumber(row.usedCount)} استفاده`}
                      {row.maxUses > 0 ? ` از ${faNumber(row.maxUses)}` : " · نامحدود"}
                      {row.applicablePlans.length > 0
                        ? ` · پلن‌ها: ${row.applicablePlans.join("، ")}`
                        : " · همه پلن‌ها"}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => openDiscount(row)} className="h-7 rounded-lg px-2 text-[8.5px]">
                        <Pencil className="size-3" />
                        ویرایش
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void runSubscriberAction(
                            () =>
                              setDiscountActive({
                                discountId: row.id,
                                isActive: !row.isActive,
                              }),
                            row.isActive ? "کد غیرفعال شد." : "کد فعال شد.",
                          )
                        }
                        className="h-7 rounded-lg px-2 text-[8.5px]"
                      >
                        {row.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={exportReports} disabled={!reports} className="h-9 rounded-xl text-[9px]">
                <Download className="size-3.5" /> خروجی CSV گزارش درآمد
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="clay rounded-[24px] p-4">
                <p className="text-[9px] text-muted-foreground">درآمد کل</p>
                <p className="mt-1 text-lg font-extrabold text-primary">
                  {reports ? faToman(reports.totalRevenueToman) : "…"}
                </p>
              </div>
              <div className="clay rounded-[24px] p-4">
                <p className="text-[9px] text-muted-foreground">فاکتورهای پرداخت‌شده</p>
                <p className="mt-1 text-lg font-extrabold">
                  {reports ? faNumber(reports.totalInvoices) : "…"}
                </p>
              </div>
              <div className="clay rounded-[24px] p-4">
                <p className="text-[9px] text-muted-foreground">مشترکین فعال</p>
                <p className="mt-1 text-lg font-extrabold">
                  {reports ? faNumber(reports.subscribersByPlan.reduce((sum, row) => sum + row.count, 0)) : "…"}
                </p>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="clay rounded-[24px] p-4">
                <h3 className="text-sm font-extrabold">درآمد ماهانه</h3>
                <div className="mt-3 space-y-1.5">
                  {(reports?.monthly ?? []).map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[9px]">
                      <span className="font-mono" dir="ltr">{row.key}</span>
                      <span className="font-semibold">{faToman(row.revenue)}</span>
                      <span className="text-muted-foreground">{faNumber(row.invoices)} فاکتور</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="clay rounded-[24px] p-4">
                <h3 className="text-sm font-extrabold">تعداد مشترک هر پلن</h3>
                <div className="mt-3 space-y-1.5">
                  {(reports?.subscribersByPlan ?? []).map((row) => (
                    <div key={row.code} className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-[9px]">
                      <span>{row.name}</span>
                      <span className="font-bold">{faNumber(row.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="clay rounded-[24px] p-4">
              <h3 className="text-sm font-extrabold">درآمد سالانه</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {(reports?.yearly ?? []).map((row) => (
                  <div key={row.key} className="rounded-xl bg-muted/40 px-3 py-2 text-[9px]">
                    <span className="font-mono" dir="ltr">{row.key}</span>
                    <span className="ms-2 font-bold">{faToman(row.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "events" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <h2 className="text-sm font-extrabold">رویدادهای مالی</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              همه عملیات مدیر، سفارش‌ها و نتیجه پرداخت‌ها با کاربر و زمان ثبت می‌شوند.
            </p>
            <div className="mt-3 space-y-1.5">
              {events.map((row) => (
                <div key={row.id} className="rounded-xl bg-muted/40 px-2.5 py-2 text-[9px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-full text-[8px]">
                      {EVENT_LABELS[row.type] ?? row.type}
                    </Badge>
                    <span className="font-semibold">{row.description}</span>
                    <span className="ms-auto text-muted-foreground">
                      {faDateTime(row.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[8px] text-muted-foreground">
                    {row.actorName}
                    {row.cafeName ? ` · ${row.cafeName}` : ""}
                  </p>
                </div>
              ))}
              {events.length === 0 && (
                <p className="rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                  هنوز رویدادی ثبت نشده است.
                </p>
              )}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              <h2 className="text-sm font-extrabold">تنظیمات مالی و دوره آزمایشی</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <div>
                  <p className="text-[10px] font-bold">اجازه استفاده مجدد از دوره آزمایشی</p>
                  <p className="mt-0.5 text-[8.5px] text-muted-foreground">
                    فقط برای اعطای دستی مدیر؛ ثبت‌نام جدید همیشه یک دوره آزمایشی دارد.
                  </p>
                </div>
                <Switch
                  checked={settingsDraft?.allowTrialReuse ?? false}
                  onCheckedChange={(checked) => {
                    if (!settingsDraft) return;
                    setSettingsOverride({
                      ...settingsDraft,
                      allowTrialReuse: checked,
                    });
                  }}
                />
              </div>
              <div className="rounded-xl bg-muted/40 p-3 text-[9px] leading-5">
                <p className="font-bold">تنظیمات دوره آزمایشی</p>
                <p className="mt-1 text-muted-foreground">
                  مدت، سهمیه هوش مصنوعی، سقف کارمند و امکانات از پلن «دوره آزمایشی»
                  در تب پلن‌ها قابل تغییر است.
                </p>
                {settings?.trial && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full text-[8px]">
                      {faNumber(settings.trial.durationDays)} روز
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[8px]">
                      {faNumber(settings.trial.entitlements.aiRequestsPerMonth)} AI
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[8px]">
                      {settings.trial.entitlements.maxEmployees === -1
                        ? "کارمند نامحدود"
                        : `${faNumber(settings.trial.entitlements.maxEmployees)} کارمند`}
                    </Badge>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPlan(settings?.trial ?? null);
                    setPlanForm(
                      settings?.trial
                        ? emptyPlanForm(settings.trial)
                        : emptyPlanForm(),
                    );
                    setPlanDialogOpen(true);
                  }}
                  className="mt-2 h-7 rounded-lg px-2 text-[8.5px]"
                >
                  <Pencil className="size-3" />
                  ویرایش پلن آزمایشی
                </Button>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[9px] leading-5 text-amber-800 dark:text-amber-200">
                <p className="flex items-center gap-1.5 font-bold">
                  <TriangleAlert className="size-3.5" />
                  وضعیت درگاه پرداخت
                </p>
                <p className="mt-1">
                  اطلاعات پذیرنده در دیتابیس ذخیره نمی‌شود. برای فعال‌سازی زرین‌پال،
                  متغیرهای امن `ZARINPAL_MERCHANT_ID` و `SITE_URL` را در تنظیمات
                  سرور (Keys) قرار دهید. تا آن زمان سفارش‌ها pending می‌مانند و
                  پرداخت واقعی فعال نیست.
                </p>
                <p className="mt-1 text-[8px]">
                  درگاه انتخاب‌شده: {settingsDraft?.gatewayProvider ?? "zarinpal"}
                </p>
              </div>
              <Button type="button" onClick={() => void saveSettings()} className="h-9 rounded-xl text-[10px]">
                ذخیره تنظیمات
              </Button>
            </div>
          </section>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              ویرایش {editingPlan?.name ?? "پلن"}
            </DialogTitle>
            <DialogDescription className="text-[10px] leading-5">
              قیمت‌ها فقط از این فرم در دیتابیس ذخیره می‌شوند و در پرداخت از سمت
              سرور خوانده می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-[10px]">نام پلن</Label>
                <Input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required className="h-9 text-[10px]" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[9px]">
                  <Switch checked={planForm.isActive} onCheckedChange={(checked) => setPlanForm({ ...planForm, isActive: checked })} />
                  فعال برای خرید
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">توضیح کوتاه</Label>
              <Textarea value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} rows={2} className="text-[10px]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-[10px]">مدت دوره (روز)</Label>
                <Input type="number" min={1} max={3650} value={planForm.durationDays} onChange={(event) => setPlanForm({ ...planForm, durationDays: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">قیمت ماهانه (تومان)</Label>
                <Input type="number" min={0} value={planForm.monthly} onChange={(event) => setPlanForm({ ...planForm, monthly: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">قیمت سالانه (تومان)</Label>
                <Input type="number" min={0} value={planForm.yearly} onChange={(event) => setPlanForm({ ...planForm, yearly: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">تخفیف سالانه (٪)</Label>
                <Input type="number" min={0} max={100} value={planForm.yearlyDiscount} onChange={(event) => setPlanForm({ ...planForm, yearlyDiscount: event.target.value })} className="h-9 text-[10px]" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[10px]">حداکثر کارمند (‑۱ نامحدود)</Label>
                <Input type="number" min={-1} value={planForm.maxEmployees} onChange={(event) => setPlanForm({ ...planForm, maxEmployees: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">سهمیه AI ماهانه</Label>
                <Input type="number" min={0} value={planForm.aiRequests} onChange={(event) => setPlanForm({ ...planForm, aiRequests: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">حسابداری</Label>
                <Select value={planForm.accounting} onValueChange={(value) => setPlanForm({ ...planForm, accounting: value as "limited" | "full" })}>
                  <SelectTrigger className="h-9 w-full text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limited">محدود</SelectItem>
                    <SelectItem value="full">کامل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 rounded-xl bg-muted/40 p-3 text-[9px]">
              {[
                ["agent", "ایجنت هوشمند", planForm.agent],
                ["rates", "نرخ‌نامه", planForm.rates],
                ["advancedReports", "گزارش پیشرفته", planForm.advancedReports],
                ["advancedManagement", "مدیریت پیشرفته", planForm.advancedManagement],
                ["prioritySupport", "اولویت پشتیبانی", planForm.prioritySupport],
              ].map(([key, label, checked]) => (
                <label key={String(key)} className="flex items-center gap-1.5">
                  <Switch
                    checked={Boolean(checked)}
                    onCheckedChange={(next) =>
                      setPlanForm({ ...planForm, [String(key)]: next } as PlanForm)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">ویژگی‌های نمایشی (هر خط یک ویژگی)</Label>
              <Textarea value={planForm.features} onChange={(event) => setPlanForm({ ...planForm, features: event.target.value })} rows={6} className="text-[10px]" />
            </div>
            <Button type="submit" className="h-10 w-full rounded-xl text-[10.5px]">
              ذخیره پلن
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {discountForm.id ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}
            </DialogTitle>
            <DialogDescription className="text-[10px] leading-5">
              اعتبار و محدودیت‌ها هنگام ایجاد سفارش و تأیید پرداخت دوباره سمت سرور
              بررسی می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveDiscount} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px]">کد</Label>
                <Input value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} required dir="ltr" className="h-9 text-left text-[10px]" placeholder="YALDA1405" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">عنوان</Label>
                <Input value={discountForm.title} onChange={(event) => setDiscountForm({ ...discountForm, title: event.target.value })} required className="h-9 text-[10px]" placeholder="تخفیف شب یلدا" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[10px]">نوع</Label>
                <Select value={discountForm.discountType} onValueChange={(value) => setDiscountForm({ ...discountForm, discountType: value as "percent" | "fixed" })}>
                  <SelectTrigger className="h-9 w-full text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">درصدی</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">مقدار</Label>
                <Input type="number" min={0} value={discountForm.value} onChange={(event) => setDiscountForm({ ...discountForm, value: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">فعال</Label>
                <div className="flex h-9 items-center rounded-lg bg-muted/40 px-3">
                  <Switch checked={discountForm.isActive} onCheckedChange={(checked) => setDiscountForm({ ...discountForm, isActive: checked })} />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px]">شروع</Label>
                <Input type="datetime-local" value={discountForm.startsAt} onChange={(event) => setDiscountForm({ ...discountForm, startsAt: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">پایان</Label>
                <Input type="datetime-local" value={discountForm.endsAt} onChange={(event) => setDiscountForm({ ...discountForm, endsAt: event.target.value })} className="h-9 text-[10px]" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px]">سقف کل استفاده (۰ نامحدود)</Label>
                <Input type="number" min={0} value={discountForm.maxUses} onChange={(event) => setDiscountForm({ ...discountForm, maxUses: event.target.value })} className="h-9 text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">سقف استفاده هر کافی‌نت (۰ نامحدود)</Label>
                <Input type="number" min={0} value={discountForm.maxUsesPerCafe} onChange={(event) => setDiscountForm({ ...discountForm, maxUsesPerCafe: event.target.value })} className="h-9 text-[10px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">پلن‌های مشمول (خالی = همه پلن‌ها)</Label>
              <div className="flex flex-wrap gap-2">
                {plans
                  .filter((plan) => !plan.isTrial)
                  .map((plan) => {
                    const selected = discountForm.applicablePlans.includes(plan.code);
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() =>
                          setDiscountForm({
                            ...discountForm,
                            applicablePlans: selected
                              ? discountForm.applicablePlans.filter((code) => code !== plan.code)
                              : [...discountForm.applicablePlans, plan.code],
                          })
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[9px]",
                          selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {plan.name}
                      </button>
                    );
                  })}
              </div>
            </div>
            <Button type="submit" className="h-10 w-full rounded-xl text-[10.5px]">
              ذخیره کد تخفیف
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manualTarget !== null} onOpenChange={(open) => !open && setManualTarget(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">ثبت پرداخت دستی</DialogTitle>
            <DialogDescription className="text-[10px] leading-5 text-amber-700 dark:text-amber-300">
              فقط پس از دریافت واقعی وجه خارج از درگاه. این عملیات اشتراک را فعال
              می‌کند و در رویدادها ثبت می‌شود.
            </DialogDescription>
          </DialogHeader>
          {manualTarget && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/40 p-2.5 text-[9px]">
                <p className="font-mono" dir="ltr">{manualTarget.orderNumber}</p>
                <p className="mt-1">{manualTarget.cafeName} · {faToman(manualTarget.totalToman)}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">شماره پیگیری بانکی</Label>
                <Input value={manualReference} onChange={(event) => setManualReference(event.target.value)} dir="ltr" className="h-9 text-left text-[10px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">یادداشت (اختیاری)</Label>
                <Textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} rows={2} className="text-[10px]" />
              </div>
              <Button type="button" onClick={() => void settle()} disabled={manualBusy || manualReference.trim().length < 3} className="h-9 w-full rounded-xl text-[10px]">
                {manualBusy ? <Loader2 className="size-4 animate-spin" /> : "تأیید و فعال‌سازی اشتراک"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>لغو اشتراک؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              اشتراک «{cancelTarget?.cafeName}» فوراً لغو می‌شود. اطلاعات قبلی حذف
              نمی‌شوند و امکان فعال‌سازی دوباره وجود دارد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!cancelTarget) return;
                void runSubscriberAction(
                  () => cancelSubscription({ cafeId: cancelTarget.cafeId }),
                  "اشتراک لغو شد.",
                );
                setCancelTarget(null);
              }}
            >
              لغو اشتراک
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
