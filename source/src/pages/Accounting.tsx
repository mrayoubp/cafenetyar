import { normalizeSearch } from "@/lib/inventory";
import { EntryDialog } from "@/components/accounting/EntryDialog";
import { InventoryPanel } from "@/components/accounting/InventoryPanel";
import { useAccounting } from "@/hooks/use-accounting";
import type { CatalogItem, CreateEntry, LedgerItem } from "@/lib/inventory";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERMISSIONS } from "@/convex/permissions";
import { useSession } from "@/hooks/use-session";
import {
  ACCOUNTING_DIRECTION_LABELS,
  type AccountingDirection,
} from "@/lib/accounting";
import { errorMessage } from "@/lib/auth";
import { faDateTime, faNumber, faToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Info,
  ListOrdered,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
  Package,
  Boxes,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { toast } from "sonner";

type DirectionFilter = "all" | AccountingDirection;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function createWeekSeries(items: LedgerItem[]) {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setDate(start.getDate() - (6 - index));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    let income = 0;
    let expense = 0;
    for (const item of items) {
      if (item.isVoided) continue;
      if (
        item.occurredAt < start.getTime() ||
        item.occurredAt >= end.getTime()
      ) {
        continue;
      }
      if (item.direction === "income") income += item.amountToman;
      else expense += item.amountToman;
    }
    return {
      day: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        weekday: "short",
      }).format(start),
      income,
      expense,
    };
  });
}

export default function Accounting() {
  const { context } = useSession();
  const accounting = useAccounting(!!context?.cafe && !context.isGuest);
  const ledger = accounting.data;
  const [dialog, setDialog] = useState<{
    direction: AccountingDirection;
    item?: CatalogItem;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [busy, setBusy] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const canWrite =
    (context?.permissions.includes(PERMISSIONS.TRANSACTIONS_WRITE) ?? false) &&
    !!ledger?.canWrite;
  const canViewReports =
    (context?.permissions.includes(PERMISSIONS.REPORTS_VIEW) ?? false) &&
    context?.hasAdvancedReports === true;

  const items = useMemo(() => ledger?.items ?? [], [ledger]);
  const summary = ledger?.summary;

  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    return items.filter((item) => {
      const matchesDirection =
        direction === "all" || item.direction === direction;
      const matchesQuery =
        normalized.length === 0 ||
        [
          item.title,
          item.category,
          item.method,
          item.operatorName,
          item.note ?? "",
          ...(item.lines || []).map((x) => x.title),
        ].some((value) => normalizeSearch(value).includes(normalized));
      return matchesDirection && matchesQuery;
    });
  }, [items, direction, query]);

  const weekSeries = useMemo(() => createWeekSeries(items), [items]);

  const categoryRows = useMemo(() => {
    const result = new Map<string, { income: number; expense: number }>();
    for (const item of items) {
      if (item.isVoided) continue;
      const current = result.get(item.category) ?? { income: 0, expense: 0 };
      if (item.direction === "income") current.income += item.amountToman;
      else current.expense += item.amountToman;
      result.set(item.category, current);
    }
    return [...result.entries()]
      .map(([category, totals]) => ({
        category,
        ...totals,
        total: totals.income + totals.expense,
      }))
      .sort((first, second) => second.total - first.total);
  }, [items]);

  const handleCreate = async (payload: CreateEntry) => {
    setBusy(true);
    try {
      await accounting.mutate("/entries", payload);
      setDialog(null);
      toast.success(
        payload.direction === "expense"
          ? "هزینه ثبت شد."
          : "کار و درآمد ثبت شد.",
        {
          description: payload.lines?.length
            ? "اقلام و موجودی انبار به‌روز شدند."
            : "تراکنش در دفتر مالی ذخیره شد.",
        },
      );
      return true;
    } catch (caught) {
      toast.error(errorMessage(caught, "ثبت تراکنش ممکن نشد."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async (item: LedgerItem) => {
    if (
      !window.confirm(
        `تراکنش «${item.title}» ابطال شود؟ رکورد برای حسابرسی باقی می‌ماند.`,
      )
    ) {
      return;
    }
    setVoidingId(item.id);
    try {
      await accounting.mutate("/void", { transactionId: item.id });
      toast.success("تراکنش ابطال شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "ابطال تراکنش ممکن نشد."));
    } finally {
      setVoidingId(null);
    }
  };

  const stats = summary
    ? [
        {
          label: "دریافتی امروز",
          value: faToman(summary.todayIncomeToman),
          hint: "بر اساس تراکنش‌های امروز",
          icon: ArrowUpRight,
          tone: "tile-mint",
        },
        {
          label: "هزینه امروز",
          value: faToman(summary.todayExpenseToman),
          hint: "اینترنت، بوفه و سایر هزینه‌ها",
          icon: ArrowDownRight,
          tone: "tile-peach",
        },
        {
          label: "خالص دفتر",
          value: faToman(Math.abs(summary.balanceToman)),
          hint:
            summary.balanceToman < 0
              ? "مانده هزینه بیش از درآمد"
              : "درآمد منهای هزینه",
          icon: Wallet,
          tone: "tile-navy",
        },
        {
          label: "تراکنش‌های فعال",
          value: faNumber(summary.count),
          hint:
            summary.voidedCount > 0
              ? `${faNumber(summary.voidedCount)} ردیف ابطال‌شده`
              : "رکوردهای قابل استفاده",
          icon: ListOrdered,
          tone: "tile-lilac",
        },
      ]
    : [];

  const loading =
    context === undefined || (context?.cafe != null && ledger === undefined);

  return (
    <AppShell active="accounting">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowRight className="size-3.5" />
              بازگشت به نمای کلی
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                حسابداری کافی‌نت
              </h1>
              <Badge
                variant="secondary"
                className="rounded-full bg-emerald-500/12 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
              >
                دفتر واقعی
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-muted-foreground">
              دریافت‌ها و هزینه‌های همین کافی‌نت را ثبت کنید. اطلاعات به‌صورت
              ماندگار ذخیره می‌شود و کافی‌نت‌های دیگر به آن دسترسی ندارند.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
            <Button
              type="button"
              onClick={() => setDialog({ direction: "income" })}
              disabled={!canWrite}
              title={
                canWrite
                  ? undefined
                  : "برای ثبت تراکنش به نقش شما مجوز داده نشده است."
              }
              className="clay-primary h-11 rounded-2xl border-0 px-4 text-[12.5px] font-bold hover:brightness-105 disabled:opacity-50"
            >
              <Plus className="size-4" />
              ثبت کار / فروش
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ direction: "expense" })}
              disabled={!canWrite}
              className="mt-1 h-10 rounded-2xl border-rose-500/20 px-4 text-xs font-bold text-rose-700 hover:bg-rose-500/5 dark:text-rose-300"
            >
              <ArrowDownRight className="size-4" />
              ثبت هزینه
            </Button>
            {!canWrite && (
              <span className="text-[9.5px] text-muted-foreground">
                ثبت تراکنش برای نقش شما مجاز نیست.
              </span>
            )}
          </div>
        </header>

        {accounting.error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
          >
            <p className="text-xs leading-6 text-destructive">
              {accounting.error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void accounting.refresh()}
              className="rounded-xl text-xs"
            >
              تلاش دوباره
            </Button>
          </div>
        )}
        {loading && !accounting.error ? (
          <div className="clay flex justify-center rounded-[28px] p-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !summary ? (
          <div className="clay rounded-[28px] p-8 text-center">
            <p className="text-sm font-bold">دفتر مالی در دسترس نیست</p>
            <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
              برای استفاده از حسابداری باید به یک کافی‌نت فعال متصل باشید.
            </p>
          </div>
        ) : (
          <>
            <div className="clay-inset flex items-start gap-3 rounded-[22px] p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Info className="size-4" />
              </span>
              <p className="text-[11px] leading-6 text-muted-foreground">
                مبالغ به تومان و به‌صورت عدد صحیح ذخیره می‌شوند. هر کافی‌نت فقط
                تراکنش‌های خودش را می‌بیند و ابطال تراکنش نیز در گزارش فعالیت
                ثبت می‌شود.
              </p>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="clay rounded-[26px] p-4">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-[13px]",
                        stat.tone,
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-lg font-extrabold tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      {stat.hint}
                    </p>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="clay rounded-[28px] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold">روند هفت روز</h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      دریافت و هزینه روزانه از تراکنش‌های ثبت‌شده
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[var(--chart-1)]" />
                      دریافتی
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[var(--chart-3)]" />
                      هزینه
                    </span>
                  </div>
                </div>
                <div className="mt-4 h-[230px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={weekSeries}
                      margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="incomeFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0.42}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 7"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tick={{
                          fill: "var(--muted-foreground)",
                          fontSize: 10,
                          fontFamily: "Vazirmatn",
                        }}
                      />
                      <Tooltip
                        cursor={{ stroke: "var(--border)" }}
                        formatter={(value) => faToman(Number(value))}
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          fontFamily: "Vazirmatn",
                          fontSize: 11,
                          direction: "rtl",
                          boxShadow: "0 12px 30px oklch(0 0 0 / 12%)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        fill="url(#incomeFill)"
                        activeDot={{ r: 5, strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="clay rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold">خلاصه دفتر</h2>
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px]"
                  >
                    ماندگار
                  </Badge>
                </div>
                <ul className="mt-4 space-y-2">
                  {[
                    {
                      label: "مجموع دریافتی",
                      value: summary.incomeToman,
                      tone: "text-emerald-600 dark:text-emerald-300",
                    },
                    {
                      label: "مجموع هزینه",
                      value: summary.expenseToman,
                      tone: "text-rose-600 dark:text-rose-300",
                    },
                    {
                      label: "خالص",
                      value: Math.abs(summary.balanceToman),
                      tone:
                        summary.balanceToman >= 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300",
                    },
                    {
                      label: "دریافتی هفته",
                      value: summary.weekIncomeToman,
                      tone: "text-foreground",
                    },
                  ].map((row) => (
                    <li
                      key={row.label}
                      className="clay-inset flex items-center justify-between gap-2 rounded-[18px] px-3 py-2.5"
                    >
                      <span className="text-[11px] text-muted-foreground">
                        {row.label}
                      </span>
                      <span
                        className={cn(
                          "text-[11.5px] font-bold tabular-nums",
                          row.tone,
                        )}
                      >
                        {row.label === "خالص" && summary.balanceToman < 0
                          ? "−"
                          : ""}
                        {faNumber(row.value)}
                        <span className="ms-1 text-[9px] font-medium text-muted-foreground">
                          تومان
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
                  خلاصه از حداکثر {faNumber(summary.limitedTo)} تراکنش اخیر
                  محاسبه می‌شود.
                </p>
              </div>
            </section>

            <Tabs defaultValue="transactions" className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="clay-inset h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1.5 sm:w-fit">
                  <TabsTrigger
                    value="transactions"
                    className="h-8 flex-none rounded-xl px-3 text-[11.5px] data-[state=active]:clay-sm data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent"
                  >
                    <ReceiptText className="size-3.5" />
                    دفتر تراکنش‌ها
                  </TabsTrigger>
                  <TabsTrigger
                    value="catalog"
                    className="h-8 flex-none rounded-xl px-3 text-[11.5px] data-[state=active]:clay-sm"
                  >
                    <Package className="size-3.5" />
                    کالا و خدمت
                  </TabsTrigger>
                  <TabsTrigger
                    value="stock"
                    className="h-8 flex-none rounded-xl px-3 text-[11.5px] data-[state=active]:clay-sm"
                  >
                    <Boxes className="size-3.5" />
                    انبار
                  </TabsTrigger>
                  {canViewReports && (
                    <TabsTrigger
                      value="reports"
                      className="h-8 flex-none rounded-xl px-3 text-[11.5px] data-[state=active]:clay-sm data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent"
                    >
                      <ListOrdered className="size-3.5" />
                      گزارش‌های مالی
                    </TabsTrigger>
                  )}
                </TabsList>
                <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  آخرین {faNumber(summary.limitedTo)} رکورد · مخصوص همین کافی‌نت
                </span>
              </div>

              {(["catalog", "stock"] as const).map((view) => (
                <TabsContent key={view} value={view}>
                  <InventoryPanel
                    view={view}
                    catalog={ledger?.catalog || []}
                    movements={ledger?.movements || []}
                    canWrite={canWrite}
                    isOwner={!!ledger?.isOwner}
                    mutate={accounting.mutate}
                    onSell={(item) => setDialog({ direction: "income", item })}
                  />
                </TabsContent>
              ))}
              <TabsContent value="transactions">
                <section className="clay rounded-[28px] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-extrabold">دفتر تراکنش‌ها</h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {faNumber(filtered.length)} رکورد در این نمای فیلترشده
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="clay-inset flex h-9 items-center gap-2 rounded-xl px-3">
                        <Search className="size-3.5 shrink-0 text-muted-foreground" />
                        <Input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="جستجو در عنوان، دسته یا ثبت‌کننده"
                          className="h-8 w-full border-0 bg-transparent p-0 text-[11px] shadow-none focus-visible:ring-0 sm:w-52"
                        />
                      </div>
                      <div className="clay-inset flex items-center gap-1 rounded-xl p-1">
                        {(
                          [
                            { key: "all", label: "همه" },
                            { key: "income", label: "درآمد" },
                            { key: "expense", label: "هزینه" },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setDirection(option.key)}
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors",
                              direction === option.key
                                ? "clay-sm text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-[20px] border border-border/50">
                    <Table className="min-w-[780px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-border/50 hover:bg-transparent">
                          {[
                            "عنوان",
                            "دسته",
                            "روش",
                            "زمان",
                            "ثبت‌کننده",
                            "مبلغ",
                            "نوع",
                            "عملیات",
                          ].map((head) => (
                            <TableHead
                              key={head}
                              className="text-start text-[10px] font-semibold text-muted-foreground"
                            >
                              {head}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((item) => (
                          <TableRow
                            key={item.id}
                            className={cn(
                              "border-border/40 hover:bg-primary/[0.035]",
                              item.isVoided && "opacity-55",
                            )}
                          >
                            <TableCell className="max-w-[240px] text-[11.5px] font-semibold">
                              <p className="break-words">{item.title}</p>
                              {item.note && (
                                <p className="mt-1 line-clamp-2 text-[10px] font-normal text-muted-foreground">
                                  {item.note}
                                </p>
                              )}
                              {!!item.lines?.length && (
                                <details className="mt-1 text-[10px] font-normal">
                                  <summary className="cursor-pointer text-primary">
                                    {faNumber(item.lines.length)} قلم · جزئیات
                                  </summary>
                                  <ul className="mt-2 space-y-1">
                                    {item.lines.map((line, i) => (
                                      <li key={i}>
                                        {line.title} · {faNumber(line.quantity)}{" "}
                                        {line.unit} × {faToman(line.unitPrice)}
                                      </li>
                                    ))}
                                  </ul>
                                  {!!item.discountToman && (
                                    <p className="mt-1 text-muted-foreground">
                                      تخفیف: {faToman(item.discountToman)}
                                    </p>
                                  )}
                                </details>
                              )}
                            </TableCell>
                            <TableCell className="text-[10.5px] text-muted-foreground">
                              {item.category}
                            </TableCell>
                            <TableCell className="text-[10.5px] text-muted-foreground">
                              {item.method}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                              {faDateTime(item.occurredAt)}
                            </TableCell>
                            <TableCell className="text-[10.5px] text-muted-foreground">
                              {item.operatorName}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-[11.5px] font-bold tabular-nums",
                                item.direction === "income"
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300",
                              )}
                            >
                              {item.direction === "income" ? "+" : "−"}
                              {faNumber(item.amountToman)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold",
                                  item.isVoided
                                    ? "bg-muted text-muted-foreground"
                                    : item.direction === "income"
                                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                      : "bg-rose-500/12 text-rose-700 dark:text-rose-300",
                                )}
                              >
                                {item.isVoided
                                  ? "ابطال‌شده"
                                  : ACCOUNTING_DIRECTION_LABELS[item.direction]}
                              </span>
                            </TableCell>
                            <TableCell>
                              {!item.isVoided && context?.isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => void handleVoid(item)}
                                  disabled={voidingId === item.id}
                                  aria-label="ابطال تراکنش"
                                  title="ابطال تراکنش"
                                  className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                                >
                                  {voidingId === item.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[9px] text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {filtered.length === 0 && (
                      <div className="flex flex-col items-center gap-2 bg-card/60 px-4 py-10 text-center">
                        <span className="clay-sm grid size-11 place-items-center rounded-2xl text-muted-foreground">
                          <ReceiptText className="size-5" />
                        </span>
                        <p className="text-xs font-semibold">
                          {items.length === 0
                            ? "هنوز تراکنشی ثبت نشده است"
                            : "تراکنشی با این فیلتر پیدا نشد"}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">
                          {items.length === 0
                            ? "با دکمه‌های «ثبت کار / فروش» یا «ثبت هزینه» شروع کنید."
                            : "عبارت جستجو یا فیلتر نوع را تغییر دهید."}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Calculator className="size-3.5 shrink-0" />
                    ابطال، رکورد را حذف نمی‌کند؛ فقط از جمع‌ها کنار می‌گذارد تا
                    سابقه مالی حفظ شود.
                  </p>
                </section>
              </TabsContent>

              {canViewReports && (
                <TabsContent value="reports">
                  <section className="clay rounded-[28px] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-extrabold">
                          گزارش دسته‌بندی
                        </h2>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          جمع واقعی تراکنش‌های فعال بر اساس دسته
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[9px]"
                      >
                        محاسبه از دفتر
                      </Badge>
                    </div>

                    {categoryRows.length === 0 ? (
                      <p className="mt-5 rounded-2xl bg-muted/35 p-5 text-center text-[11px] text-muted-foreground">
                        برای مشاهده گزارش، ابتدا چند تراکنش ثبت کنید.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {categoryRows.map((row) => {
                          const max = Math.max(
                            ...categoryRows.map((item) => item.total),
                            1,
                          );
                          return (
                            <div
                              key={row.category}
                              className="rounded-2xl bg-muted/30 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold">
                                  {row.category}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {faToman(row.total)}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.max(
                                      3,
                                      Math.round((row.total / max) * 100),
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div className="mt-1.5 flex gap-3 text-[9px] text-muted-foreground">
                                <span>درآمد: {faToman(row.income)}</span>
                                <span>هزینه: {faToman(row.expense)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>

      {dialog && (
        <EntryDialog
          catalog={ledger?.catalog || []}
          direction={dialog.direction}
          initialItem={dialog.item}
          onClose={() => setDialog(null)}
          busy={busy}
          onSubmit={handleCreate}
        />
      )}
    </AppShell>
  );
}
