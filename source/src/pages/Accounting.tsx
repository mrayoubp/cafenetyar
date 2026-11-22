import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { EntryDialog } from "@/components/accounting/EntryDialog";
import { InventoryPanel } from "@/components/accounting/InventoryPanel";
import {
  EmptyState,
  EntryPreview,
  FinanceConfirm,
  Money,
  Sparkline,
} from "@/components/accounting/FinanceUI";
import { useAccounting } from "@/hooks/use-accounting";
import { useSession } from "@/hooks/use-session";
import { PERMISSIONS } from "@/backend/permissions";
import { faNumber } from "@/lib/format";
import { errorMessage } from "@/lib/auth";
import {
  normalizeSearch,
  toRial,
  type CatalogItem,
  type CreateEntry,
  type LedgerItem,
} from "@/lib/inventory";
import {
  financeDate,
  financeSeries,
  financeTime,
  financeTotals,
  inPeriod,
  periods,
  shortDocumentId,
  type FinancePeriod,
} from "@/lib/finance-view";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import "@/components/accounting/finance.css";

type View = "overview" | "ledger" | "catalog" | "stock" | "reports";
type EntryFilter = "all" | "income" | "expense";
const seriesCaption = (period: FinancePeriod) =>
  period === "today"
    ? "گردش امروز، در بازه‌های دو ساعته"
    : period === "month"
      ? "روند روزانه در ۳۰ روز اخیر"
      : period === "all"
        ? "روند روزانه در ۱۴ روز اخیر"
        : "روند روزانه در ۷ روز اخیر";

export default function Accounting() {
  const { context } = useSession(),
    accounting = useAccounting(!!context?.cafe && !context.isGuest),
    data = accounting.data;
  const [view, setView] = useState<View>("overview"),
    [period, setPeriod] = useState<FinancePeriod>("all"),
    [query, setQuery] = useState(""),
    [direction, setDirection] = useState<EntryFilter>("all"),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(15);
  const [dialog, setDialog] = useState<{
      direction: "income" | "expense";
      item?: CatalogItem;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<LedgerItem | null>(null),
    [voidTarget, setVoidTarget] = useState<LedgerItem | null>(null),
    [voiding, setVoiding] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const canWrite =
      !!data?.canWrite &&
      !!context?.permissions.includes(PERMISSIONS.TRANSACTIONS_WRITE),
    isOwner = !!data?.isOwner;
  const canReports =
    !!context?.permissions.includes(PERMISSIONS.REPORTS_VIEW) &&
    context?.hasAdvancedReports === true;
  const items = data?.items || [],
    catalog = data?.catalog || [],
    products = catalog.filter((x) => x.kind === "product" && !x.archived),
    low = products.filter((x) => x.quantity <= x.lowStock);
  const now = Date.now(),
    ranged = useMemo(
      () => items.filter((x) => inPeriod(x, period)),
      [data, period],
    ),
    totals = useMemo(() => financeTotals(ranged), [ranged]),
    series = useMemo(() => financeSeries(items, period), [data, period]);
  const filtered = useMemo(
    () =>
      ranged.filter(
        (x) =>
          (direction === "all" || x.direction === direction) &&
          (category === "all" || x.category === category) &&
          normalizeSearch(
            [
              x.title,
              x.note || "",
              x.operatorName,
              x.category,
              ...(x.lines || []).map((l) => l.title),
            ].join(" "),
          ).includes(normalizeSearch(query)),
      ),
    [ranged, direction, category, query],
  );
  const categories = Array.from(new Set(items.map((x) => x.category))),
    categoryRows = useMemo(() => {
      const map = new Map<string, { income: number; expense: number }>();
      for (const x of ranged.filter((x) => !x.isVoided)) {
        const row = map.get(x.category) || { income: 0, expense: 0 };
        row[x.direction] += x.amountToman;
        map.set(x.category, row);
      }
      return [...map]
        .map(([name, t]) => ({ name, ...t, total: t.income + t.expense }))
        .sort((a, b) => b.total - a.total);
    }, [ranged]);
  const tabs: {
    key: View;
    label: string;
    icon: typeof Wallet;
    count?: number;
  }[] = [
    { key: "overview", label: "نمای کلی", icon: LayoutDashboard },
    { key: "ledger", label: "دفتر مالی", icon: ReceiptText },
    {
      key: "catalog",
      label: "کالا و خدمت",
      icon: Package,
      count: catalog.filter((x) => !x.archived).length,
    },
    {
      key: "stock",
      label: "انبار",
      icon: Boxes,
      ...(low.length ? { count: low.length } : {}),
    },
    ...(canReports
      ? [{ key: "reports" as const, label: "گزارش‌ها", icon: Activity }]
      : []),
  ];
  const create = async (body: CreateEntry) => {
    setBusy(true);
    try {
      await accounting.mutate("/entries", body);
      setDialog(null);
      toast.success(
        body.direction === "expense"
          ? "هزینه در دفتر ثبت شد."
          : "فروش و موجودی ثبت شدند.",
      );
      return true;
    } catch (e) {
      toast.error(errorMessage(e, "ذخیرهٔ سند انجام نشد."));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const voidEntry = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await accounting.mutate("/void", { transactionId: voidTarget.id });
      setVoidTarget(null);
      setPreview(null);
      toast.success("سند ابطال شد و اثر مالی و موجودی آن اصلاح شد.");
    } catch (e) {
      toast.error(errorMessage(e, "ابطال سند انجام نشد."));
    } finally {
      setVoiding(false);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    await accounting.refresh();
    setRefreshing(false);
  };
  const exportRows = () => {
    const exported = view === "reports" ? ranged : filtered;
    downloadCsv(
      "دفتر-مالی-" +
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tehran",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now) +
        ".csv",
      [
        "شناسه سند",
        "عنوان",
        "نوع",
        "دسته",
        "روش پرداخت",
        "مبلغ (ریال)",
        "تخفیف",
        "تاریخ",
        "ساعت",
        "ثبت‌کننده",
        "وضعیت",
        "اقلام",
        "توضیحات",
      ],
      exported.map((x) => [
        x.id,
        x.title,
        x.direction === "income" ? "درآمد" : "هزینه",
        x.category,
        x.method,
        toRial(x.amountToman),
        x.discountToman || 0,
        financeDate(x.occurredAt),
        financeTime(x.occurredAt),
        x.operatorName,
        x.isVoided ? "ابطال‌شده" : "فعال",
        (x.lines || []).map((l) => l.title + " × " + l.quantity).join(" / "),
        x.note,
      ]),
    );
    toast.success("خروجی دفتر آماده شد.");
  };
  const resetFilters = () => {
    setQuery("");
    setDirection("all");
    setCategory("all");
    setPage(1);
  };
  const renderTable = (rows: LedgerItem[], compact = false) => (
    <div className="fin-table-scroll">
      <table className="fin-table">
        <thead>
          <tr>
            <th>شرح تراکنش</th>
            <th>مبلغ</th>
            {!compact && <th>دسته‌بندی</th>}
            <th>تاریخ</th>
            <th>وضعیت</th>
            <th aria-label="عملیات" />
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className={x.isVoided ? "voided" : ""}>
              <td>
                <button
                  className={"fin-entry-label " + x.direction}
                  onClick={() => setPreview(x)}
                >
                  <span>
                    {x.direction === "income" ? (
                      <ArrowDownLeft size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{x.title}</strong>
                    <small>
                      {x.lines?.length
                        ? faNumber(x.lines.length) + " قلم · "
                        : ""}
                      {x.method} · {x.operatorName}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <Money
                  value={
                    x.direction === "expense" ? -x.amountToman : x.amountToman
                  }
                  className={x.direction === "income" ? "fin-green" : "fin-red"}
                  signed={x.direction === "income"}
                />
              </td>
              {!compact && (
                <td>
                  <span className="fin-tag neutral">{x.category}</span>
                </td>
              )}
              <td className="fin-date-cell">
                {financeDate(x.occurredAt)}
                <small>{financeTime(x.occurredAt)}</small>
              </td>
              <td>
                <span
                  className={
                    "fin-tag " +
                    (x.isVoided
                      ? "neutral"
                      : x.direction === "income"
                        ? "green"
                        : "rose")
                  }
                >
                  {x.isVoided
                    ? "ابطال‌شده"
                    : x.direction === "income"
                      ? "دریافتی"
                      : "پرداختی"}
                </span>
              </td>
              <td>
                <div className="fin-table-actions">
                  <button
                    aria-label={"مشاهده سند " + x.title}
                    title="جزئیات و چاپ سند"
                    onClick={() => setPreview(x)}
                  >
                    <Eye size={15} />
                  </button>
                  {isOwner && !x.isVoided && (
                    <button
                      className="danger"
                      aria-label={"ابطال " + x.title}
                      onClick={() => setVoidTarget(x)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const chart = (
    <section className="fin-panel">
      <div className="fin-panel-head">
        <div>
          <h2>تصویر روشنِ دخل‌وخرج</h2>
          <p>{seriesCaption(period)}</p>
        </div>
        <div className="fin-chart-legend">
          <span>
            <i />
            درآمد
          </span>
          <span>
            <i />
            هزینه
          </span>
        </div>
      </div>
      <div className="fin-chart" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
          >
            <defs>
              <linearGradient id="fin-income-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6fb395" stopOpacity={0.26} />
                <stop offset="100%" stopColor="#6fb395" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fin-expense-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#cf8c90" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#cf8c90" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--fin-border)"
              vertical={false}
              strokeDasharray="3 6"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={25}
              tick={{
                fill: "var(--fin-muted)",
                fontSize: 10,
                fontFamily: "Vazirmatn",
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              tick={{
                fill: "var(--fin-muted)",
                fontSize: 9,
                fontFamily: "Vazirmatn",
              }}
              tickFormatter={(v) =>
                new Intl.NumberFormat("fa-IR", { notation: "compact" }).format(
                  toRial(Number(v)),
                )
              }
            />
            <Tooltip
              formatter={(v, name) => [
                faNumber(toRial(Number(v))) + " ریال",
                name,
              ]}
              contentStyle={{
                background: "var(--fin-paper)",
                border: "1px solid var(--fin-border)",
                borderRadius: 12,
                fontFamily: "Vazirmatn",
                direction: "rtl",
                fontSize: 11,
                color: "var(--fin-ink)",
              }}
              labelStyle={{ color: "var(--fin-muted)", marginBottom: 6 }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="درآمد"
              stroke="#4b987c"
              strokeWidth={2.3}
              fill="url(#fin-income-fill)"
              activeDot={{ r: 4, strokeWidth: 3, stroke: "var(--fin-paper)" }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="هزینه"
              stroke="#c78e91"
              strokeWidth={1.8}
              strokeDasharray="4 4"
              fill="url(#fin-expense-fill)"
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="fin-chart-footer">
        <span>مبالغ به ریال · تراکنش‌های فعال</span>
        <span>
          {totals.count
            ? faNumber(totals.count) + " سند در بازهٔ انتخابی"
            : "با ثبت اولین سند، روند مالی شکل می‌گیرد."}
        </span>
      </div>
    </section>
  );
  const categoryPanel = (
    <section className="fin-panel">
      <div className="fin-panel-head">
        <div>
          <h2>سهم هر دسته از دفتر</h2>
          <p>مجموع درآمد و هزینه، بر اساس دسته‌بندی</p>
        </div>
        <SlidersHorizontal size={16} className="fin-muted" />
      </div>
      {categoryRows.length ? (
        <div className="fin-category-list">
          {categoryRows.slice(0, view === "reports" ? 20 : 5).map((r, i) => (
            <div className="fin-category-row" key={r.name}>
              <div>
                <span>{r.name}</span>
                <strong>
                  {faNumber(toRial(r.total))} <small>ریال</small>
                </strong>
              </div>
              <div className="fin-category-bar">
                <i
                  style={{
                    width:
                      (r.total /
                        Math.max(...categoryRows.map((x) => x.total), 1)) *
                        100 +
                      "%",
                    opacity: 1 - i * 0.08,
                  }}
                />
              </div>
              <small>
                درآمد {faNumber(toRial(r.income))} · هزینه{" "}
                {faNumber(toRial(r.expense))}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز دسته‌ای سهم ندارد"
          description="بعد از ثبت درآمد و هزینه، سهم هر دسته را اینجا می‌بینید."
        />
      )}
      <div className="fin-note">
        <CircleHelp size={13} />
        <span>اسناد ابطال‌شده در این محاسبه وارد نمی‌شوند.</span>
      </div>
    </section>
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    safePage = Math.min(page, pages),
    pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFlow = totals.income + totals.expense > 0,
    incomeShare = hasFlow
      ? totals.income / (totals.income + totals.expense)
      : 0;
  return (
    <AppShell active="accounting">
      <div className="finance-workspace">
        <div className="fin-topbar">
          <div className="fin-breadcrumb">
            <Link to="/dashboard">
              <LayoutDashboard size={14} />
              فضای کاری
            </Link>
            <ChevronLeft size={13} />
            <strong>حسابداری و انبار</strong>
          </div>
          <div className="fin-topbar-tools">
            <span className="fin-topbar-date">{financeDate(now)}</span>
            <span className="fin-divider" />
            <span>
              {accounting.updatedAt
                ? "به‌روزرسانی " + financeTime(accounting.updatedAt)
                : "دفتر اختصاصی کافی‌نت"}
            </span>
            <button
              className="fin-icon-button"
              aria-label="به‌روزرسانی دفتر"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
        <section className="fin-hero">
          <div>
            <p className="fin-eyebrow">
              <span className="fin-live-dot" />
              {context?.cafe?.name || "کافی‌نت‌یار"} · مرکز مالی
            </p>
            <h1>حساب‌وکتاب، روشن و مرتب.</h1>
            <p className="fin-hero-intro">
              از اولین دریافت تا آخرین کالای انبار؛ تصویر کسب‌وکارت را دقیق‌تر
              ببین و کار بعدی را راحت‌تر ثبت کن.
            </p>
            <div className="fin-hero-actions">
              <button
                className="fin-button lime"
                disabled={!canWrite}
                onClick={() => setDialog({ direction: "income" })}
              >
                <Plus size={16} />
                ثبت فروش و خدمات
              </button>
              <button
                className="fin-button ghost-light"
                disabled={!canWrite}
                onClick={() => setDialog({ direction: "expense" })}
              >
                <ArrowUpRight size={16} />
                ثبت هزینه
              </button>
            </div>
          </div>
          <div className="fin-hero-balance">
            <p className="fin-balance-label">
              خالص عملکرد دفتر
              <span>{periods.find((x) => x.key === period)?.label}</span>
            </p>
            {data ? (
              <Money value={totals.balance} />
            ) : (
              <span className="fin-money">
                <b>—</b>
                <small>ریال</small>
              </span>
            )}
            <p className="fin-balance-caption">
              درآمد ثبت‌شده منهای هزینه‌های ثبت‌شده
            </p>
            <div className="fin-flow-track" aria-hidden="true">
              <i style={{ width: incomeShare * 100 + "%" }} />
              <i
                style={{ width: (hasFlow ? 1 - incomeShare : 0) * 100 + "%" }}
              />
            </div>
            <div className="fin-flow-key">
              <span>
                <i />
                دریافتی {data ? faNumber(totals.income) : "—"}
              </span>
              <span>
                <i />
                پرداختی {data ? faNumber(totals.expense) : "—"}
              </span>
            </div>
          </div>
        </section>
        <div className="fin-navigation">
          <nav className="fin-nav-tabs" aria-label="بخش‌های حسابداری">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={view === t.key ? "active" : ""}
                aria-current={view === t.key ? "page" : undefined}
                onClick={() => setView(t.key)}
              >
                <t.icon size={15} />
                {t.label}
                {typeof t.count === "number" && (
                  <span>{faNumber(t.count)}</span>
                )}
              </button>
            ))}
          </nav>
          <label className="fin-period">
            <CalendarDays size={14} />
            <select
              aria-label="بازهٔ گزارش"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as FinancePeriod);
                setPage(1);
              }}
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {accounting.error && (
          <div className="fin-alert">
            <span>{accounting.error}</span>
            <button
              className="fin-button secondary small"
              onClick={() => void refresh()}
            >
              تلاش دوباره
            </button>
          </div>
        )}
        {!data ? (
          accounting.error ? (
            <EmptyState
              icon={<Wallet />}
              title="دفتر مالی در دسترس نیست"
              description="ورود و دسترسی حساب کافی‌نت را بررسی و دوباره تلاش کنید."
            />
          ) : (
            <div className="fin-state">
              <Loader2 size={21} className="animate-spin" />
              در حال دریافت دفتر مالی…
            </div>
          )
        ) : (
          <div key={view} className="fin-view">
            {(view === "overview" || view === "reports") && (
              <>
                <div className="fin-stat-grid">
                  <article className="fin-stat">
                    <div className="fin-stat-top">
                      <span>جمع دریافتی‌ها</span>
                      <span className="fin-stat-icon">
                        <ArrowDownLeft size={17} />
                      </span>
                    </div>
                    <div className="fin-stat-value">
                      <Money value={totals.income} />
                    </div>
                    <div className="fin-stat-bottom">
                      <span>{faNumber(totals.sales)} فروش ثبت‌شده</span>
                      <Sparkline values={series.map((x) => x.income)} />
                    </div>
                  </article>
                  <article className="fin-stat rose">
                    <div className="fin-stat-top">
                      <span>جمع هزینه‌ها</span>
                      <span className="fin-stat-icon">
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                    <div className="fin-stat-value">
                      <Money value={totals.expense} />
                    </div>
                    <div className="fin-stat-bottom">
                      <span>پرداخت‌های بازهٔ انتخابی</span>
                      <Sparkline
                        values={series.map((x) => x.expense)}
                        tone="rose"
                      />
                    </div>
                  </article>
                  <article className="fin-stat blue">
                    <div className="fin-stat-top">
                      <span>میانگین هر فروش</span>
                      <span className="fin-stat-icon">
                        <ReceiptText size={17} />
                      </span>
                    </div>
                    <div className="fin-stat-value">
                      <Money value={totals.average} />
                    </div>
                    <div className="fin-stat-bottom">
                      <span>مجموع دریافتی ÷ تعداد فروش</span>
                    </div>
                  </article>
                  <article className="fin-stat amber">
                    <div className="fin-stat-top">
                      <span>نیازمند تأمین</span>
                      <span className="fin-stat-icon">
                        <Boxes size={17} />
                      </span>
                    </div>
                    <div className="fin-stat-value">
                      {faNumber(low.length)}
                      <small className="fin-label">کالا</small>
                    </div>
                    <div className="fin-stat-bottom">
                      <span>از {faNumber(products.length)} کالای فعال</span>
                      <button onClick={() => setView("stock")}>
                        بررسی انبار
                        <ArrowLeft size={12} />
                      </button>
                    </div>
                  </article>
                </div>
                <div className="fin-overview-grid">
                  {chart}
                  {categoryPanel}
                </div>
              </>
            )}
            {view === "overview" && (
              <section className="fin-panel">
                <div className="fin-panel-head" style={{ paddingBottom: 20 }}>
                  <div className="fin-panel-heading">
                    <span className="fin-heading-icon">
                      <ReceiptText size={17} />
                    </span>
                    <div>
                      <h2>آخرین اتفاق‌های دفتر</h2>
                      <p>شش تراکنش آخر در بازهٔ انتخاب‌شده</p>
                    </div>
                  </div>
                  <button
                    className="fin-button secondary small"
                    onClick={() => setView("ledger")}
                  >
                    دفتر کامل
                    <ArrowLeft size={13} />
                  </button>
                </div>
                {ranged.length ? (
                  renderTable(ranged.slice(0, 6), true)
                ) : (
                  <EmptyState
                    title="دفترت آمادهٔ اولین ثبت است"
                    description="یک فروش، یک خدمت یا یک هزینه ثبت کن تا گزارش‌ها از داده‌های خودت ساخته شوند."
                    action={
                      <button
                        className="fin-button subtle"
                        disabled={!canWrite}
                        onClick={() => setDialog({ direction: "income" })}
                      >
                        <Plus size={15} />
                        ثبت اولین کار
                      </button>
                    }
                  />
                )}
              </section>
            )}
            {view === "ledger" && (
              <>
                <div className="fin-section-head">
                  <div>
                    <h2>دفتر مالی</h2>
                    <p>اسناد، جزئیات اقلام و پرداخت‌ها را با دقت مرور کن.</p>
                  </div>
                  <button
                    className="fin-button secondary"
                    disabled={!filtered.length}
                    onClick={exportRows}
                  >
                    <Download size={15} />
                    خروجی اکسل
                  </button>
                </div>
                <section className="fin-panel">
                  <div className="fin-ledger-tools">
                    <div className="fin-search">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                        placeholder="عنوان، کالا یا ثبت‌کننده…"
                        aria-label="جست‌وجوی دفتر"
                      />
                    </div>
                    <div className="fin-filter-group">
                      <div className="fin-segmented">
                        {(
                          [
                            { key: "all", label: "همه" },
                            { key: "income", label: "دریافتی" },
                            { key: "expense", label: "هزینه" },
                          ] as const
                        ).map((x) => (
                          <button
                            key={x.key}
                            className={direction === x.key ? "active" : ""}
                            onClick={() => {
                              setDirection(x.key);
                              setPage(1);
                            }}
                          >
                            {x.label}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label="دستهٔ تراکنش"
                        className="fin-select"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="all">همهٔ دسته‌ها</option>
                        {categories.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {filtered.length ? (
                    renderTable(pageRows)
                  ) : (
                    <EmptyState
                      icon={<Search />}
                      title="تراکنشی با این فیلترها نیست"
                      description="بازهٔ زمانی یا عبارت جست‌وجو را تغییر بده."
                      action={
                        <button
                          className="fin-button secondary small"
                          onClick={resetFilters}
                        >
                          پاک‌کردن فیلترها
                        </button>
                      }
                    />
                  )}
                  <div className="fin-table-footer">
                    <span>
                      {filtered.length
                        ? faNumber((safePage - 1) * pageSize + 1) +
                          " تا " +
                          faNumber(
                            Math.min(safePage * pageSize, filtered.length),
                          ) +
                          " از "
                        : ""}
                      {faNumber(filtered.length)} سند
                    </span>
                    <div className="fin-pagination">
                      <select
                        className="fin-select"
                        aria-label="تعداد اسناد هر صفحه"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                      >
                        {[15, 30, 50].map((n) => (
                          <option key={n} value={n}>
                            {faNumber(n)} ردیف
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="صفحهٔ قبل"
                        disabled={safePage === 1}
                        onClick={() => setPage(safePage - 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                      <b>
                        {faNumber(safePage)} / {faNumber(pages)}
                      </b>
                      <button
                        aria-label="صفحهٔ بعد"
                        disabled={safePage === pages}
                        onClick={() => setPage(safePage + 1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
            {(view === "stock" || view === "catalog") && (
              <InventoryPanel
                view={view}
                catalog={catalog}
                movements={data.movements}
                canWrite={canWrite}
                isOwner={isOwner}
                mutate={accounting.mutate}
                onSell={(item) => setDialog({ direction: "income", item })}
              />
            )}
            {view === "reports" && (
              <div className="fin-panel">
                <div className="fin-panel-head" style={{ paddingBottom: 20 }}>
                  <div>
                    <h2>خلاصهٔ بازهٔ انتخاب‌شده</h2>
                    <p>جمع‌بندی قابل مرور از اسناد فعال</p>
                  </div>
                  <button
                    className="fin-button secondary small"
                    disabled={!ranged.length}
                    onClick={exportRows}
                  >
                    <Download size={14} />
                    دریافت فایل
                  </button>
                </div>
                <div className="fin-report-summary">
                  <div>
                    <span>خالص عملکرد</span>
                    <Money value={totals.balance} />
                  </div>
                  <div>
                    <span>تعداد اسناد فعال</span>
                    <b>{faNumber(totals.count)}</b>
                  </div>
                  <div>
                    <span>اسناد ابطال‌شده</span>
                    <b>{faNumber(totals.voided)}</b>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="fin-page-note">
          <ShieldCheck size={13} />
          دفتر اختصاصی {context?.cafe?.name || "کافی‌نت شما"} · نمایش آخرین{" "}
          {faNumber(data?.summary.limitedTo || 1000)} سند · مبالغ به ریال
        </p>
        {dialog && (
          <EntryDialog
            catalog={catalog}
            initialItem={dialog.item}
            direction={dialog.direction}
            busy={busy}
            onClose={() => setDialog(null)}
            onSubmit={create}
          />
        )}
        {preview && (
          <EntryPreview
            item={preview}
            cafe={context?.cafe?.name || ""}
            onClose={() => setPreview(null)}
            onVoid={
              isOwner && !preview.isVoided
                ? () => {
                    setVoidTarget(preview);
                    setPreview(null);
                  }
                : undefined
            }
          />
        )}
        {voidTarget && (
          <FinanceConfirm
            title="این سند ابطال شود؟"
            description={
              "اثر مالی «" +
              voidTarget.title +
              "» خنثی و موجودی کالای فروخته‌شده برگردانده می‌شود. اصل سند در دفتر باقی می‌ماند."
            }
            label="ابطال سند"
            busy={voiding}
            onCancel={() => setVoidTarget(null)}
            onConfirm={() => void voidEntry()}
          />
        )}
      </div>
    </AppShell>
  );
}
