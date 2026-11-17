import { MonthlyPlanCard, TELEGRAM_PURCHASE_URL } from "@/components/MonthlyPlanCard";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber, faToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Info,
  Loader2,
  TimerReset,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

type Cycle = "monthly" | "yearly";

const STATUS_LABELS: Record<string, string> = {
  trial: "دوره آزمایشی",
  active: "فعال",
  expired: "منقضی",
  canceled: "لغوشده",
  pending_payment: "در انتظار پرداخت",
};

const ORDER_LABELS: Record<string, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  failed: "ناموفق",
  canceled: "لغوشده",
};

type Plan = {
  code: string;
  name: string;
  description: string | null;
  durationDays: number;
  priceToman: number;
  monthlyPriceToman: number;
  yearlyPriceToman: number;
  yearlyDiscountPercent: number;
  features: string[];
  entitlements: {
    maxEmployees: number;
    aiRequestsPerMonth: number;
    agent: boolean;
    rates: boolean;
    accounting: "limited" | "full";
    advancedReports: boolean;
    advancedManagement: boolean;
    prioritySupport: boolean;
  } | null;
  isActive: boolean;
};

type Invoice = {
  id: string;
  number: string;
  planName: string;
  billingCycle: Cycle;
  subtotalToman: number;
  discountToman: number;
  totalToman: number;
  status: "paid" | "void";
  issuedAt: number;
  paidAt: number | null;
};

type Order = {
  id: string;
  orderNumber: string;
  planCode: string;
  billingCycle: Cycle;
  subtotalToman: number;
  discountToman: number;
  totalToman: number;
  discountCode: string | null;
  status: "pending" | "paid" | "failed" | "canceled";
  authority: string | null;
  referenceId: string | null;
  failureReason: string | null;
  paidAt: number | null;
  createdAt: number;
};

type BillingData = {
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    status: string;
    startsAt: number;
    endsAt: number;
    billingCycle: Cycle;
    lastPaymentAt: number | null;
    renewalAt: number;
  } | null;
  plan: {
    code: string;
    name: string;
    description: string | null;
    features: string[];
    entitlements: Plan["entitlements"];
    monthlyPriceToman: number;
    yearlyPriceToman: number;
    yearlyDiscountPercent: number;
    isTrial: boolean;
    durationDays: number;
  } | null;
  status: string;
  isActive: boolean;
  daysLeft: number;
  entitlements: NonNullable<Plan["entitlements"]>;
  usage: {
    periodKey: string;
    aiUsed: number;
    aiLimit: number;
    aiRemaining: number;
  };
  canUseAgent: boolean;
  canUseRates: boolean;
  hasAdvancedReports: boolean;
  hasAdvancedManagement: boolean;
  trialUsed: boolean;
  invoices: Invoice[];
  orders: Order[];
};

function usagePercent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default function Subscription() {
  const { context } = useSession();
  const billing = useQuery(api.billing.mySubscription, {}) as
    | BillingData
    | undefined;
  const cancelOrder = useMutation(api.billing.cancelOrder);
  const confirmPayment = useAction(api.billing.confirmPayment);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callbackStarted = useRef(false);

  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "error";
    title: string;
    message: string;
    orderNumber?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(
    () =>
      searchParams.get("payment") === "callback" &&
      Boolean(searchParams.get("order")),
  );

  useEffect(() => {
    if (callbackStarted.current) return;
    if (searchParams.get("payment") !== "callback") return;
    const orderId = searchParams.get("order");
    if (!orderId) return;
    callbackStarted.current = true;
    const authority =
      searchParams.get("Authority") ?? searchParams.get("authority") ?? undefined;
    const gatewayStatus =
      searchParams.get("Status") ?? searchParams.get("status") ?? undefined;
    void confirmPayment({
      orderId: orderId as Id<"payment_orders">,
      authority,
      gatewayStatus,
    })
      .then((result) => {
        if (result.status === "paid") {
          setNotice({
            tone: "success",
            title: "پرداخت تأیید شد",
            message: `اشتراک شما فعال شد. شماره فاکتور: ${result.invoiceNumber ?? "در حال ثبت"}`,
          });
        } else if (result.status === "failed") {
          setNotice({
            tone: "error",
            title: "پرداخت تأیید نشد",
            message: result.message ?? "پرداخت ناموفق یا لغو شد.",
          });
        } else if (result.status === "not_configured") {
          setNotice({
            tone: "warning",
            title: "درگاه تنظیم نشده است",
            message:
              "هیچ پرداختی تأیید نشد. سفارش برای پیگیری نگه داشته شده است.",
          });
        } else {
          setNotice({
            tone: "error",
            title: "تأیید پرداخت نیازمند بررسی است",
            message:
              result.message ??
              "ارتباط با درگاه برقرار نشد. اگر مبلغی کسر شده، دوباره پرداخت نکنید و با پشتیبانی تماس بگیرید.",
          });
        }
      })
      .catch((error) => {
        setNotice({
          tone: "error",
          title: "بررسی پرداخت انجام نشد",
          message: errorMessage(error, "خطا در بررسی نتیجه پرداخت."),
        });
      })
      .finally(() => {
        setVerifying(false);
        navigate("/dashboard/subscription", { replace: true });
      });
  }, [confirmPayment, navigate, searchParams]);

  const currentPlan = billing?.plan;
  const remainingDays = billing?.daysLeft ?? 0;
  const quota = billing?.usage;
  const quotaPercent = quota ? usagePercent(quota.aiUsed, quota.aiLimit) : 0;
  const expiresSoon =
    Boolean(billing?.subscription) &&
    remainingDays > 0 &&
    remainingDays <= 7 &&
    billing?.status !== "canceled";

  const handleCancelOrder = async (order: Order) => {
    try {
      await cancelOrder({ orderId: order.id as Id<"payment_orders"> });
      toast.success("سفارش لغو شد.");
    } catch (error) {
      toast.error(errorMessage(error, "لغو سفارش ممکن نشد."));
    }
  };

  return (
    <AppShell active="subscription">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
                <CreditCard className="size-3.5" />
                اشتراک من
              </span>
              <h1 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">
                اشتراک یک‌ماهه کافی‌نت‌یار
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                خرید و تمدید اشتراک یک‌ماهه با قیمت ۵۰۰ هزار تومان، از طریق پشتیبانی تلگرام انجام می‌شود.
              </p>
            </div>

          </div>
        </section>

        <MonthlyPlanCard />

        {notice && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-2xl border p-3 text-[10.5px] leading-5",
              notice.tone === "success" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              notice.tone === "warning" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
              notice.tone === "error" &&
                "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {notice.tone === "success" ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : notice.tone === "warning" ? (
              <Info className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{notice.title}</p>
              <p className="mt-0.5">{notice.message}</p>
              {notice.orderNumber && (
                <p className="mt-1 font-mono text-[9px]" dir="ltr">
                  {notice.orderNumber}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="بستن پیام"
              onClick={() => setNotice(null)}
              className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {verifying && (
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-[10.5px] text-primary">
            <Loader2 className="size-4 animate-spin" />
            در حال استعلام نتیجه پرداخت از درگاه و فعال‌سازی اشتراک…
          </div>
        )}

        {billing === undefined ? (
          <div className="clay flex min-h-52 items-center justify-center rounded-[28px]">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="clay relative overflow-hidden rounded-[28px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="tile-navy grid size-12 shrink-0 place-items-center rounded-[16px]">
                      <CreditCard className="size-5" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold">
                          {billing.subscription?.planName ?? "بدون اشتراک"}
                        </h2>
                        {billing.subscription && (
                          <Badge variant="secondary" className="rounded-full text-[9.5px]">
                            {STATUS_LABELS[billing.status] ?? billing.status}
                          </Badge>
                        )}
                        {billing.plan?.isTrial && (
                          <Badge variant="outline" className="rounded-full text-[9px]">
                            آزمایشی
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">
                        {billing.subscription
                          ? `از ${faDateLong(billing.subscription.startsAt)} تا ${faDateLong(billing.subscription.endsAt)}`
                          : "هنوز اشتراکی برای این کافی‌نت ثبت نشده است."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-primary/10 px-4 py-2 text-center">
                    <p className="text-xl font-extrabold text-primary">
                      {billing.subscription ? faNumber(remainingDays) : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">روز باقی‌مانده</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="clay-inset rounded-xl p-3">
                    <p className="text-[9px] text-muted-foreground">دوره پرداخت</p>
                    <p className="mt-1 text-[11px] font-bold">
                      {billing.subscription?.billingCycle === "yearly"
                        ? "سالانه"
                        : "ماهانه"}
                    </p>
                  </div>
                  <div className="clay-inset rounded-xl p-3">
                    <p className="text-[9px] text-muted-foreground">آخرین پرداخت</p>
                    <p className="mt-1 text-[11px] font-bold">
                      {billing.subscription?.lastPaymentAt
                        ? faDateLong(billing.subscription.lastPaymentAt)
                        : "ثبت نشده"}
                    </p>
                  </div>
                </div>

                {expiresSoon && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[9.5px] leading-5 text-amber-800 dark:text-amber-200">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    اشتراک شما در {faNumber(remainingDays)} روز آینده به پایان
                    می‌رسد. برای جلوگیری از قطع دسترسی، تمدید را همین حالا انجام
                    دهید.
                  </div>
                )}
              </div>

              <div className="clay rounded-[28px] p-5">
                <div className="flex items-center gap-2">
                  <TimerReset className="size-4 text-primary" />
                  <h2 className="text-sm font-extrabold">مصرف سهمیه هوش مصنوعی</h2>
                </div>
                {billing.canUseAgent ? (
                  <>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        {quota?.aiLimit && quota.aiLimit > 0
                          ? `${faNumber(quota.aiUsed)} از ${faNumber(quota.aiLimit)} درخواست این ماه`
                          : "سهمیه نامحدود"}
                      </p>
                      <p className="text-sm font-extrabold text-primary">
                        {quota?.aiLimit && quota.aiLimit > 0
                          ? `${faNumber(quota.aiRemaining)} باقی‌مانده`
                          : "∞"}
                      </p>
                    </div>
                    {quota && quota.aiLimit > 0 && (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            quotaPercent >= 90
                              ? "bg-destructive"
                              : quotaPercent >= 70
                                ? "bg-amber-500"
                                : "bg-primary",
                          )}
                          style={{ width: `${quotaPercent}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-[9px] leading-5 text-muted-foreground">
                      سهمیه در ابتدای هر ماه میلادی بازنشانی می‌شود. تمدید یا
                      ارتقای پلن اطلاعات قبلی را حذف نمی‌کند.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
                    ایجنت هوشمند در اشتراک فعلی شما فعال نیست. برای بررسی دسترسی‌ها با پشتیبانی تلگرام تماس بگیرید.
                  </p>
                )}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="clay rounded-[28px] p-5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <h2 className="text-sm font-extrabold">سوابق پرداخت و فاکتورها</h2>
                </div>
                {billing.invoices.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                    هنوز فاکتور پرداخت‌شده‌ای ثبت نشده است.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-right text-[9.5px]">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">شماره</th>
                          <th className="pb-2 font-medium">پلن</th>
                          <th className="pb-2 font-medium">مبلغ</th>
                          <th className="pb-2 font-medium">تاریخ</th>
                          <th className="pb-2 font-medium">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-t border-border/40">
                            <td className="py-2 font-mono text-[8.5px]" dir="ltr">{invoice.number}</td>
                            <td className="py-2">{invoice.planName}</td>
                            <td className="py-2 font-semibold">{faToman(invoice.totalToman)}</td>
                            <td className="py-2 text-muted-foreground">{faDateLong(invoice.paidAt ?? invoice.issuedAt)}</td>
                            <td className="py-2">
                              <Badge variant="secondary" className="rounded-full text-[8px]">
                                {invoice.status === "paid" ? "پرداخت‌شده" : "باطل"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="clay rounded-[28px] p-5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  <h2 className="text-sm font-extrabold">سفارش‌های در انتظار</h2>
                </div>
                {billing.orders.filter((order) => order.status === "pending").length === 0 ? (
                  <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[10px] text-muted-foreground">
                    سفارش در انتظاری وجود ندارد. برای خرید یا تمدید از دکمهٔ تلگرام بالا استفاده کنید.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {billing.orders
                      .filter((order) => order.status === "pending")
                      .map((order) => (
                        <div key={order.id} className="rounded-xl bg-muted/40 p-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[8.5px]" dir="ltr">{order.orderNumber}</span>
                            <Badge variant="outline" className="rounded-full text-[8px]">
                              {ORDER_LABELS[order.status]}
                            </Badge>
                            <span className="ms-auto text-[9px] font-semibold">{faToman(order.totalToman)}</span>
                          </div>
                          <p className="mt-1 text-[8.5px] text-muted-foreground">
                            {order.billingCycle === "yearly" ? "سالانه" : "ماهانه"}
                            {order.discountCode ? ` · کد ${order.discountCode}` : ""}
                            {` · ${faDateLong(order.createdAt)}`}
                          </p>
                          <div className="mt-2 flex gap-1.5">
                            <Button asChild size="sm" className="h-7 rounded-lg px-2 text-[8.5px]">
                              <a href={TELEGRAM_PURCHASE_URL} target="_blank" rel="noopener noreferrer">پیگیری در تلگرام</a>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleCancelOrder(order)}
                              className="h-7 rounded-lg px-2 text-[8.5px] text-destructive hover:bg-destructive/10"
                            >
                              لغو سفارش
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </section>

            {currentPlan && (
              <div className="clay-inset flex items-start gap-2 rounded-[24px] p-4 text-[10px] leading-5 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  اشتراک ثبت‌شدهٔ فعلی: {currentPlan.name}. برای خرید یا تمدید اشتراک یک‌ماهه با قیمت ۵۰۰ هزار تومان، از دکمهٔ تلگرام استفاده کنید.
                  {context?.cafe ? ` کافی‌نت: ${context.cafe.name}` : ""}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
