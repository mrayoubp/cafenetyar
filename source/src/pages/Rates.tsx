import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { errorMessage } from "@/lib/auth";
import {
  faDateLong,
  faDateTime,
  faNumber,
  faToman,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/backend/client";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  Info,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useDeferredValue,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

type RateSource = {
  id: Id<"price_sources">;
  name: string;
  url: string | null;
  kind: "official" | "market" | "internal";
};

type PriceMode = "fixed" | "markup_percent" | "markup_toman";

type RateItem = {
  id: Id<"services">;
  name: string;
  description: string;
  unit: string;
  isAddon: boolean;
  categoryId: Id<"service_categories">;
  categoryName: string;
  categoryTone: string;
  base: {
    priceToman: number | null;
    priceType: "official" | "suggested" | "custom";
    status: "active" | "needs_review" | "inactive";
    source: RateSource | null;
    validFrom: number | null;
    validUntil: number | null;
  };
  override: {
    priceMode: PriceMode;
    priceToman: number | null;
    markupPercent: number | null;
    markupToman: number | null;
    priceType: "official" | "suggested" | "custom";
    status: "active" | "needs_review" | "inactive";
    source: RateSource | null;
    validFrom: number | null;
    validUntil: number | null;
  } | null;
  effective: {
    priceToman: number;
    priceType: "official" | "suggested" | "custom";
    priceMode: PriceMode;
    markupPercent: number | null;
    markupToman: number | null;
    source: RateSource | null;
    validFrom: number | null;
    validUntil: number | null;
    isCafeOverride: boolean;
    priceTypeLabel: string;
  } | null;
  effectiveStatus: "missing" | "needs_review" | "inactive" | "expired" | "future";
};

type RateCatalog = {
  items: RateItem[];
  categories: {
    id: Id<"service_categories">;
    name: string;
    description: string | null;
    icon: string;
    tone: string;
    count: number;
  }[];
  sources: RateSource[];
  canManage: boolean;
  isOwner: boolean;
  serverNow: number;
};

type HistoryRow = {
  id: string;
  scope: "platform" | "cafe";
  serviceName: string;
  oldPriceToman: number | null;
  newPriceToman: number | null;
  oldPriceType: "official" | "suggested" | "custom" | null;
  newPriceType: "official" | "suggested" | "custom" | null;
  oldPriceMode: PriceMode | null;
  newPriceMode: PriceMode | null;
  oldMarkupPercent: number | null;
  newMarkupPercent: number | null;
  oldMarkupToman: number | null;
  newMarkupToman: number | null;
  oldStatus: string | null;
  newStatus: string | null;
  sourceName: string | null;
  note: string | null;
  changedByName: string;
  changedAt: number;
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  official: "رسمی",
  suggested: "پیشنهادی",
  custom: "اختصاصی کافی‌نت",
};

const STATUS_TEXT: Record<string, string> = {
  missing: "نرخی ثبت نشده است",
  needs_review: "نیازمند بررسی و به‌روزرسانی",
  inactive: "غیرفعال",
  expired: "اعتبار نرخ پایان یافته",
  future: "اعتبار نرخ هنوز شروع نشده",
};

const TONE_CLASS: Record<string, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

function parseAmount(value: string) {
  const normalized = value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
  const number = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string) {
  if (!value) return undefined;
  const ms = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export default function Rates() {
  const [tab, setTab] = useState<"directory" | "calculator">("directory");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryId, setCategoryId] = useState("all");
  const catalogQuery = useQuery(api.rates.catalog, {
    search: deferredSearch || undefined,
    categoryId:
      categoryId === "all"
        ? undefined
        : (categoryId as Id<"service_categories">),
  });
  const catalog = catalogQuery as RateCatalog | undefined;
  const items = catalog?.items ?? [];
  const categories = catalog?.categories ?? [];
  const sources = catalog?.sources ?? [];

  const setMyPrice = useMutation(api.rates.setMyPrice);
  const clearMyPrice = useMutation(api.rates.clearMyPrice);
  const submitSuggestion = useMutation(api.rates.submitRateSuggestion);

  const [selectedId, setSelectedId] = useState<Id<"services"> | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const historyQuery = useQuery(
    api.rates.myHistory,
    selectedId ? { serviceId: selectedId } : "skip",
  );
  const history = (historyQuery ?? []) as HistoryRow[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [intent, setIntent] = useState<"set" | "suggest">("set");
  const [form, setForm] = useState({
    mode: "fixed" as PriceMode,
    price: "",
    markupPercent: "",
    markupToman: "",
    priceType: "custom",
    sourceId: "none",
    validFrom: "",
    validUntil: "",
    note: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openPriceDialog = (item: RateItem, nextIntent: "set" | "suggest") => {
    const override = item.override;
    const mode = nextIntent === "set" ? (override?.priceMode ?? "fixed") : "fixed";
    setSelectedId(item.id);
    setIntent(nextIntent);
    setForm({
      mode,
      price:
        mode === "fixed"
          ? override?.priceToman !== null && override?.priceToman !== undefined
            ? String(override.priceToman)
            : item.effective?.priceToman !== undefined
              ? String(item.effective.priceToman)
              : ""
          : "",
      markupPercent:
        override?.markupPercent !== null && override?.markupPercent !== undefined
          ? String(override.markupPercent)
          : "",
      markupToman:
        override?.markupToman !== null && override?.markupToman !== undefined
          ? String(override.markupToman)
          : "",
      priceType:
        nextIntent === "suggest"
          ? "suggested"
          : mode !== "fixed"
            ? "custom"
            : item.effective?.priceType === "suggested"
              ? "suggested"
              : "custom",
      sourceId: item.effective?.source?.id ?? "none",
      validFrom: toDateInput(
        item.override?.validFrom ?? item.base.validFrom,
      ),
      validUntil: toDateInput(
        item.override?.validUntil ?? item.base.validUntil,
      ),
      note: "",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submitPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const price = parseAmount(form.price);
    const markupPercent = parseAmount(form.markupPercent);
    const markupToman = parseAmount(form.markupToman);
    if (intent === "set" && form.mode === "fixed" && price <= 0) {
      setFormError("مبلغ معتبر و بزرگ‌تر از صفر وارد کنید.");
      return;
    }
    if (
      intent === "set" &&
      form.mode === "markup_percent" &&
      (markupPercent <= 0 || markupPercent > 1000)
    ) {
      setFormError("درصد سود باید بین ۰ تا ۱۰۰۰ باشد.");
      return;
    }
    if (intent === "set" && form.mode === "markup_toman" && markupToman <= 0) {
      setFormError("مبلغ افزایش باید بزرگ‌تر از صفر باشد.");
      return;
    }
    if (intent === "suggest" && price <= 0) {
      setFormError("مبلغ معتبر و بزرگ‌تر از صفر وارد کنید.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (intent === "set") {
        await setMyPrice({
          serviceId: selected.id,
          priceMode: form.mode,
          priceToman: form.mode === "fixed" ? price : undefined,
          markupPercent:
            form.mode === "markup_percent" ? markupPercent : undefined,
          markupToman: form.mode === "markup_toman" ? markupToman : undefined,
          priceType:
            form.mode === "fixed"
              ? (form.priceType as "suggested" | "custom")
              : "custom",
          sourceId:
            form.sourceId === "none"
              ? undefined
              : (form.sourceId as Id<"price_sources">),
          validFrom: fromDateInput(form.validFrom),
          validUntil: fromDateInput(form.validUntil),
        });
        toast.success("نرخ اختصاصی کافی‌نت ذخیره شد.");
      } else {
        await submitSuggestion({
          serviceId: selected.id,
          proposedPriceToman: price,
          proposedPriceType: form.priceType as "official" | "suggested",
          sourceId:
            form.sourceId === "none"
              ? undefined
              : (form.sourceId as Id<"price_sources">),
          note: form.note || undefined,
        });
        toast.success("نرخ پیشنهادی برای بررسی مدیر اصلی ثبت شد.");
      }
      setDialogOpen(false);
    } catch (error) {
      setFormError(errorMessage(error, "ثبت نرخ ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const clearOverride = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await clearMyPrice({ serviceId: selected.id });
      toast.success("نرخ اختصاصی حذف شد و نرخ پایه اعمال می‌شود.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, "حذف نرخ ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const pricedCount = items.filter((item) => item.effective).length;
  const customCount = items.filter(
    (item) => item.effective?.isCafeOverride,
  ).length;
  const reviewCount = items.filter((item) => !item.effective).length;

  return (
    <AppShell active="rates">
      <div className="space-y-4">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-accent/40 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] text-muted-foreground">
                <ReceiptText className="size-3.5" />
                نرخ‌نامه چندسطحی کافی‌نت
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
                نرخ خدمات و ماشین‌حساب
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                نرخ پایه پلتفرم و نرخ اختصاصی همین کافی‌نت را ببینید، مبلغ
                خدمات را شفاف محاسبه کنید و در صورت داشتن مجوز، نرخ خودتان را
                ثبت کنید.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {faNumber(pricedCount)} نرخ معتبر
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {faNumber(customCount)} اختصاصی
              </Badge>
              {reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3" />
                  {faNumber(reviewCount)} نیازمند بررسی
                </span>
              )}
            </div>
          </div>
          <div className="relative mt-5 inline-flex rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setTab("directory")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10.5px] font-semibold transition-colors",
                tab === "directory"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ReceiptText className="size-3.5" />
              نرخ‌نامه
            </button>
            <button
              type="button"
              onClick={() => setTab("calculator")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10.5px] font-semibold transition-colors",
                tab === "calculator"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Calculator className="size-3.5" />
              ماشین‌حساب
            </button>
          </div>
        </section>

        <div className="clay-inset flex items-start gap-2 rounded-2xl p-3 text-[10px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p>
            نرخ‌های «رسمی» و «پیشنهادی» با رنگ و برچسب جدا نمایش داده می‌شوند.
            اگر نرخ معتبری وجود نداشته باشد، هیچ مبلغی به‌عنوان نرخ رسمی نشان
            داده نمی‌شود.
          </p>
        </div>

        {tab === "directory" ? (
          <div className="space-y-3">
            <section className="clay rounded-[24px] p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جستجوی خدمت یا واحد محاسبه…"
                    className="h-10 ps-9"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setCategoryId("all")}
                    className={cn(
                      "shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold",
                      categoryId === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    همه
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      className={cn(
                        "shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold",
                        categoryId === category.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {!catalog ? (
              <div className="clay h-56 animate-pulse rounded-[28px]" />
            ) : items.length === 0 ? (
              <div className="clay flex min-h-56 flex-col items-center justify-center rounded-[28px] p-8 text-center">
                <span className="tile-peach grid size-12 place-items-center rounded-[16px]">
                  <ReceiptText className="size-5" />
                </span>
                <p className="mt-3 text-sm font-extrabold">خدمتی پیدا نشد</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  فیلتر یا عبارت جستجو را تغییر دهید.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {items.map((item) => (
                  <RateCard
                    key={item.id}
                    item={item}
                    canManage={catalog.canManage}
                    onSet={() => openPriceDialog(item, "set")}
                    onSuggest={() => openPriceDialog(item, "suggest")}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <CalculatorPanel
            items={items}
            canManage={catalog?.canManage ?? false}
          />
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {intent === "set" ? "ثبت نرخ اختصاصی" : "پیشنهاد نرخ به مدیر"}
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              {selected?.name} · واحد محاسبه: {selected?.unit}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPrice} className="space-y-3">
            {intent === "set" && (
              <div className="space-y-1.5">
                <Label>روش محاسبه نرخ اختصاصی</Label>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
                  {[
                    ["fixed", "مبلغ ثابت"],
                    ["markup_percent", "درصد سود"],
                    ["markup_toman", "مبلغ اضافه"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          mode: value as PriceMode,
                          priceType: value === "fixed" ? "custom" : "custom",
                        })
                      }
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[9.5px] font-semibold transition-colors",
                        form.mode === value
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rate-price">
                  {form.mode === "markup_percent"
                    ? "درصد سود روی نرخ پایه"
                    : form.mode === "markup_toman"
                      ? "مبلغ افزایش (تومان)"
                      : "مبلغ هر واحد (تومان)"}
                </Label>
                {form.mode === "fixed" ? (
                  <Input
                    id="rate-price"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                    placeholder="مثلاً ۲۰۰۰۰"
                    inputMode="numeric"
                    dir="ltr"
                    className="text-left"
                    required
                  />
                ) : (
                  <Input
                    id="rate-price"
                    value={
                      form.mode === "markup_percent"
                        ? form.markupPercent
                        : form.markupToman
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ...(form.mode === "markup_percent"
                          ? { markupPercent: event.target.value }
                          : { markupToman: event.target.value }),
                      })
                    }
                    placeholder={form.mode === "markup_percent" ? "مثلاً ۲۰" : "مثلاً ۵۰۰۰"}
                    inputMode="numeric"
                    dir="ltr"
                    className="text-left"
                    required
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>نوع نرخ</Label>
                {form.mode === "fixed" || intent === "suggest" ? (
                  <Select
                    value={form.priceType}
                    onValueChange={(value) =>
                      setForm({ ...form, priceType: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {intent === "set" ? (
                        <>
                          <SelectItem value="custom">اختصاصی کافی‌نت</SelectItem>
                          <SelectItem value="suggested">پیشنهادی</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="suggested">پیشنهادی</SelectItem>
                          <SelectItem value="official">رسمی</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="clay-inset flex h-9 items-center rounded-xl px-3 text-[10.5px] font-semibold text-primary">
                    اختصاصی کافی‌نت · محاسبه‌شده از نرخ پایه
                  </div>
                )}
              </div>
            </div>
            {intent === "set" && form.mode !== "fixed" && (
              <p className="rounded-xl bg-muted/50 px-3 py-2 text-[9px] leading-5 text-muted-foreground">
                نرخ پایه ثبت‌شده:{" "}
                {selected?.base.priceToman !== null &&
                selected?.base.priceToman !== undefined
                  ? faToman(selected.base.priceToman)
                  : "نرخ پایه معتبری برای محاسبه وجود ندارد"}
                {" · "}
                {form.mode === "markup_percent"
                  ? "درصد سود روی همین نرخ اعمال می‌شود."
                  : "مبلغ واردشده به همین نرخ اضافه می‌شود."}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>منبع قیمت</Label>
              <Select
                value={form.sourceId}
                onValueChange={(value) =>
                  setForm({ ...form, sourceId: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون منبع ثبت‌شده</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.sourceId === "none" && (
                <p className="text-[9px] leading-4 text-amber-700 dark:text-amber-300">
                  برای نرخ رسمی یا پیشنهادی، ثبت منبع توصیه می‌شود.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rate-from">شروع اعتبار</Label>
                <Input
                  id="rate-from"
                  type="date"
                  value={form.validFrom}
                  onChange={(event) =>
                    setForm({ ...form, validFrom: event.target.value })
                  }
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate-until">پایان اعتبار (اختیاری)</Label>
                <Input
                  id="rate-until"
                  type="date"
                  value={form.validUntil}
                  onChange={(event) =>
                    setForm({ ...form, validUntil: event.target.value })
                  }
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
            {intent === "suggest" && (
              <div className="space-y-1.5">
                <Label htmlFor="rate-note">توضیح برای مدیر</Label>
                <Textarea
                  id="rate-note"
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                  rows={2}
                  maxLength={500}
                  placeholder="منبع یا توضیحی که به بررسی کمک می‌کند…"
                />
              </div>
            )}
            {formError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] leading-5 text-destructive">
                {formError}
              </p>
            )}
            <Button
              type="submit"
              disabled={saving}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : intent === "set" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {intent === "set" ? "ذخیره نرخ اختصاصی" : "ثبت پیشنهاد"}
            </Button>
            {intent === "set" && selected?.override && (
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={clearOverride}
                className="h-9 w-full rounded-xl text-[10.5px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                حذف نرخ اختصاصی و بازگشت به نرخ پایه
              </Button>
            )}
          </form>

          {intent === "set" && (
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center gap-1.5">
                <History className="size-3.5 text-muted-foreground" />
                <p className="text-[10.5px] font-bold">تاریخچه تغییرات</p>
              </div>
              {history.length === 0 ? (
                <p className="mt-2 rounded-xl bg-muted/40 p-3 text-[9.5px] text-muted-foreground">
                  هنوز تغییری برای این خدمت ثبت نشده است.
                </p>
              ) : (
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                  {history.slice(0, 8).map((row) => (
                    <div key={row.id} className="rounded-xl bg-muted/40 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9.5px] font-semibold">
                          {row.scope === "platform" ? "نرخ پایه" : "نرخ کافی‌نت"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {row.oldPriceToman !== null
                            ? faToman(row.oldPriceToman)
                            : "—"}{" "}
                          ←{" "}
                          {row.newPriceToman !== null
                            ? faToman(row.newPriceToman)
                            : "حذف"}
                        </span>
                        {row.sourceName && (
                          <span className="text-[8.5px] text-muted-foreground">
                            منبع: {row.sourceName}
                          </span>
                        )}
                        <span className="ms-auto text-[8.5px] text-muted-foreground">
                          {faDateTime(row.changedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[8.5px] text-muted-foreground">
                        {row.changedByName}
                        {row.note ? ` · ${row.note}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function RateCard({
  item,
  canManage,
  onSet,
  onSuggest,
}: {
  item: RateItem;
  canManage: boolean;
  onSet: () => void;
  onSuggest: () => void;
}) {
  return (
    <article className="clay flex flex-col rounded-[24px] p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            TONE_CLASS[item.categoryTone] ?? "tile-navy",
            "grid size-10 shrink-0 place-items-center rounded-[13px]",
          )}
        >
          <ReceiptText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-[12.5px] font-extrabold">{item.name}</h2>
            <Badge variant="secondary" className="rounded-full text-[8.5px]">
              {item.categoryName}
            </Badge>
            {item.isAddon && (
              <Badge variant="outline" className="rounded-full text-[8.5px]">
                جانبی
              </Badge>
            )}
            {item.effective?.isCafeOverride && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary">
                اختصاصی
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-muted-foreground">
            {item.description}
          </p>
        </div>
        <div className="shrink-0 text-end">
          {item.effective ? (
            <>
              <p className="text-[13px] font-extrabold">
                {faToman(item.effective.priceToman)}
              </p>
              <p className="text-[8.5px] text-muted-foreground">
                هر {item.unit}
              </p>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[8.5px] font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3" />
              {STATUS_TEXT[item.effectiveStatus]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.effective && (
          <Badge
            variant={item.effective.priceType === "official" ? "default" : "secondary"}
            className="rounded-full text-[8.5px]"
          >
            {PRICE_TYPE_LABELS[item.effective.priceType]}
          </Badge>
        )}
        {item.effective?.priceMode === "markup_percent" && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-primary">
            {faNumber(item.effective.markupPercent ?? 0)}٪ سود
          </span>
        )}
        {item.effective?.priceMode === "markup_toman" && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-primary">
            + {faToman(item.effective.markupToman ?? 0)}
          </span>
        )}
        {item.base.priceToman !== null && (
          <span className="text-[8.5px] text-muted-foreground">
            نرخ پایه ثبت‌شده: {faToman(item.base.priceToman)}
            {item.base.status !== "active" ? " · نیازمند بررسی" : ""}
          </span>
        )}
        {item.effective?.validUntil && (
          <span className="inline-flex items-center gap-1 text-[8.5px] text-muted-foreground">
            <Clock3 className="size-2.5" />
            تا {faDateLong(item.effective.validUntil)}
          </span>
        )}
        {item.effective?.source && (
          <a
            href={item.effective.source.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[8.5px] text-primary hover:underline"
          >
            {item.effective.source.name}
            {item.effective.source.url && (
              <ExternalLink className="size-2.5" />
            )}
          </a>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={onSet}
            className="h-8 rounded-lg text-[10px]"
          >
            <Pencil className="size-3" />
            {item.override ? "ویرایش نرخ" : "ثبت نرخ"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSuggest}
          className="h-8 rounded-lg text-[10px]"
        >
          <Send className="size-3" />
          پیشنهاد به مدیر
        </Button>
        {!item.effective && (
          <span className="ms-auto text-[8.5px] text-muted-foreground">
            مبلغ ساختگی نمایش داده نمی‌شود
          </span>
        )}
      </div>
    </article>
  );
}

function CalculatorPanel({
  items,
  canManage,
}: {
  items: RateItem[];
  canManage: boolean;
}) {
  const [serviceId, setServiceId] = useState("none");
  const [quantity, setQuantity] = useState("1");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [discount, setDiscount] = useState("");
  const [extra, setExtra] = useState("");

  const service = items.find((item) => item.id === serviceId) ?? null;
  const addons = items.filter(
    (item) => item.isAddon && item.effective,
  );
  const qty = Math.max(1, Math.round(parseAmount(quantity) || 1));
  const base = service?.effective
    ? service.effective.priceToman * qty
    : 0;
  const addonTotal = addons
    .filter((item) => addonIds.includes(item.id))
    .reduce((sum, item) => sum + (item.effective?.priceToman ?? 0), 0);
  const discountValue = Math.min(parseAmount(discount), base + addonTotal);
  const extraValue = parseAmount(extra);
  const total = Math.max(0, base + addonTotal - discountValue + extraValue);

  const toggleAddon = (id: string, checked: boolean) => {
    setAddonIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="clay rounded-[28px] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="tile-navy grid size-10 place-items-center rounded-[13px]">
            <Calculator className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold">ماشین‌حساب خدمات</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              محاسبه شفاف بر پایه نرخ معتبر و خدمات جانبی فعال
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>خدمت اصلی</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="یک خدمت انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">انتخاب خدمت…</SelectItem>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.effective ? `· ${faToman(item.effective.priceToman)}` : "· بدون نرخ معتبر"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-qty">تعداد / مقدار</Label>
            <Input
              id="calc-qty"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
            />
            <p className="text-[9px] text-muted-foreground">
              واحد: {service?.unit ?? "—"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>نرخ واحد</Label>
            <div className="clay-inset flex h-9 items-center rounded-xl px-3 text-[11px] font-bold">
              {service?.effective
                ? faToman(service.effective.priceToman)
                : "نرخ معتبر ندارد"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <Plus className="size-3.5 text-primary" />
            <Label>خدمات جانبی</Label>
          </div>
          {addons.length === 0 ? (
            <p className="mt-2 rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground">
              خدمت جانبی با نرخ معتبر ثبت نشده است.
            </p>
          ) : (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {addons.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-[10.5px]"
                >
                  <Checkbox
                    checked={addonIds.includes(item.id)}
                    onCheckedChange={(checked) =>
                      toggleAddon(item.id, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    {faToman(item.effective?.priceToman ?? 0)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="calc-discount">تخفیف (تومان)</Label>
            <Input
              id="calc-discount"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              placeholder="۰"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-extra">هزینه اضافی (تومان)</Label>
            <Input
              id="calc-extra"
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              placeholder="۰"
            />
          </div>
        </div>

        {service && !service.effective && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] leading-5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              برای «{service.name}» نرخ معتبر و فعال وجود ندارد. تا زمان
              ثبت/تأیید نرخ، مبلغ نهایی قابل محاسبه نیست.
            </p>
          </div>
        )}
      </section>

      <aside className="clay rounded-[28px] p-4 sm:p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[12px] font-extrabold">صورت‌حساب</h2>
          <Badge variant="secondary" className="rounded-full text-[9px]">
            شفاف
          </Badge>
        </div>
        {!service ? (
          <p className="mt-3 rounded-xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
            برای شروع، یک خدمت از نرخ‌نامه انتخاب کنید.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between gap-2 text-[10.5px]">
              <span className="text-muted-foreground">خدمت</span>
              <span className="text-end font-semibold">{service.name}</span>
            </div>
            <div className="flex justify-between gap-2 text-[10.5px]">
              <span className="text-muted-foreground">
                {faNumber(qty)} {service.unit} × {faToman(service.effective?.priceToman ?? 0)}
              </span>
              <span className="font-semibold">{faToman(base)}</span>
            </div>
            {addonTotal > 0 && (
              <div className="flex justify-between gap-2 text-[10.5px]">
                <span className="text-muted-foreground">خدمات جانبی</span>
                <span className="font-semibold">{faToman(addonTotal)}</span>
              </div>
            )}
            {discountValue > 0 && (
              <div className="flex justify-between gap-2 text-[10.5px] text-emerald-700 dark:text-emerald-300">
                <span>تخفیف</span>
                <span>− {faToman(discountValue)}</span>
              </div>
            )}
            {extraValue > 0 && (
              <div className="flex justify-between gap-2 text-[10.5px] text-amber-700 dark:text-amber-300">
                <span>هزینه اضافی</span>
                <span>+ {faToman(extraValue)}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-border/60 pt-2 text-[12px] font-extrabold">
              <span>مبلغ نهایی</span>
              <span>{service.effective ? faToman(total) : "—"}</span>
            </div>
            {service.effective && (
              <p className="text-[8.5px] leading-4 text-muted-foreground">
                نوع نرخ: {PRICE_TYPE_LABELS[service.effective.priceType]}
                {service.effective.source
                  ? ` · منبع: ${service.effective.source.name}`
                  : ""}
                {service.effective.validUntil
                  ? ` · اعتبار تا ${faDateLong(service.effective.validUntil)}`
                  : ""}
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex items-start gap-1.5 rounded-xl bg-muted/40 p-2.5 text-[9px] leading-4 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3 shrink-0" />
          محاسبه فقط بر اساس نرخ ثبت‌شده انجام می‌شود؛ تخفیف و هزینه اضافی
          توسط شما وارد شده است.
        </div>
        {!canManage && (
          <p className="mt-2 text-[9px] leading-4 text-muted-foreground">
            برای تغییر نرخ اختصاصی، از صاحب کافی‌نت درخواست دسترسی کنید.
          </p>
        )}
      </aside>
    </div>
  );
}
