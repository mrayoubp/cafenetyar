import { useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_PAYMENT_METHODS,
  type AccountingDirection,
} from "@/lib/accounting";
import { faNumber, faToman } from "@/lib/format";
import {
  inputNumber,
  validMoney,
  type CatalogItem,
  type CreateEntry,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

type DraftLine = {
  key: string;
  itemId: string;
  title: string;
  quantity: string;
  price: string;
};
const line = (item?: CatalogItem): DraftLine => ({
  key: crypto.randomUUID(),
  itemId: item?.id || "",
  title: item?.title || "",
  quantity: "1",
  price: item ? String(item.priceToman) : "",
});
const inputClass = "h-11 rounded-xl border-border/60 bg-background/70 text-sm";
export function EntryDialog({
  catalog,
  initialItem,
  direction: initialDirection,
  busy,
  onClose,
  onSubmit,
}: {
  catalog: CatalogItem[];
  initialItem?: CatalogItem;
  direction: AccountingDirection;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: CreateEntry) => Promise<boolean>;
}) {
  const active = catalog.filter((x) => !x.archived);
  const [direction, setDirection] =
      useState<AccountingDirection>(initialDirection),
    [mode, setMode] = useState<"manual" | "items">(
      initialItem || active.length ? "items" : "manual",
    );
  const [title, setTitle] = useState(
      initialItem ? "فروش " + initialItem.title : "",
    ),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState<string>(
      initialDirection === "expense" ? "سایر" : ACCOUNTING_CATEGORIES[0],
    );
  const [method, setMethod] = useState<string>(ACCOUNTING_PAYMENT_METHODS[0]),
    [note, setNote] = useState(""),
    [discount, setDiscount] = useState(""),
    [lines, setLines] = useState<DraftLine[]>([line(initialItem)]),
    [error, setError] = useState("");
  const request = useRef(crypto.randomUUID());
  const usingItems = direction === "income" && mode === "items";
  const gross = lines.reduce(
      (n, l) =>
        n + (inputNumber(l.quantity) || 0) * (inputNumber(l.price) || 0),
      0,
    ),
    discountValue = inputNumber(discount) || 0;
  const total = usingItems ? gross - discountValue : inputNumber(amount) || 0;
  const changeLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((rows) =>
      rows.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  const choose = (key: string, id: string) => {
    const item = active.find((x) => x.id === id);
    changeLine(key, {
      itemId: id,
      title: item?.title || "",
      price: item ? String(item.priceToman) : "",
    });
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    const entryTitle =
      title.trim() ||
      (usingItems && lines.length === 1 ? "فروش " + lines[0].title : "");
    if (entryTitle.length < 3) {
      setError("عنوان کار یا هزینه را وارد کنید.");
      return;
    }
    if (!validMoney(total, 1)) {
      setError("مبلغ نهایی باید بین ۱ و ۱٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.");
      return;
    }
    if (usingItems) {
      if (!lines.length) {
        setError("حداقل یک ردیف کالا یا خدمت اضافه کنید.");
        return;
      }
      if (
        (discount.trim() && !validMoney(inputNumber(discount))) ||
        !validMoney(discountValue) ||
        discountValue >= gross
      ) {
        setError("تخفیف باید کمتر از جمع اقلام باشد.");
        return;
      }
      for (const l of lines) {
        const qty = inputNumber(l.quantity),
          price = inputNumber(l.price);
        if (
          !l.title.trim() ||
          !l.price.trim() ||
          !Number.isSafeInteger(qty) ||
          qty < 1 ||
          qty > 10000000 ||
          !validMoney(price)
        ) {
          setError("نام، تعداد و قیمت همهٔ ردیف‌ها را کامل کنید.");
          return;
        }
      }
    }
    await onSubmit({
      requestId: request.current,
      title: entryTitle,
      direction,
      category,
      method,
      amountToman: total,
      note: note.trim() || undefined,
      discountToman: usingItems ? discountValue : 0,
      lines: usingItems
        ? lines.map((l) => ({
            itemId: l.itemId || undefined,
            title: l.title.trim(),
            quantity: inputNumber(l.quantity),
            unitPrice: inputNumber(l.price),
          }))
        : [],
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="clay flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-[30px] border-0 p-0 sm:max-w-2xl [&>[data-slot=dialog-close]]:left-4 [&>[data-slot=dialog-close]]:right-auto"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-border/50 px-5 py-5 pe-12 text-start sm:px-6 sm:pe-12 sm:text-start">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-2xl",
                direction === "expense"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "bg-primary/10 text-primary",
              )}
            >
              {direction === "expense" ? (
                <Wallet className="size-5" />
              ) : (
                <ReceiptText className="size-5" />
              )}
            </span>
            {direction === "expense" ? "ثبت هزینهٔ کافی‌نت" : "ثبت کار و فروش"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-6">
            {direction === "expense"
              ? "پرداخت‌ها را با عنوان، دسته و روش پرداخت ثبت کنید."
              : "کالا و خدمت انتخاب کنید یا مبلغ و ردیف دلخواه خودتان را بنویسید."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
          onChange={() => {
            request.current = crypto.randomUUID();
          }}
        >
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "income", label: "درآمد / فروش", icon: ArrowDownLeft },
                  { key: "expense", label: "ثبت هزینه", icon: ArrowUpRight },
                ] as const
              ).map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => {
                    setDirection(x.key);
                    request.current = crypto.randomUUID();
                    setError("");
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors",
                    direction === x.key
                      ? x.key === "income"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  <x.icon className="size-4" />
                  {x.label}
                  {direction === x.key && (
                    <Check className="ms-auto size-3.5" />
                  )}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-title" className="text-xs">
                {direction === "expense"
                  ? "بابت چه چیزی پرداخت کردید؟"
                  : "عنوان کار یا فروش"}
              </Label>
              <Input
                id="entry-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={
                  direction === "expense"
                    ? "مثلاً خرید کاغذ، قبض اینترنت یا اجاره"
                    : "مثلاً خدمات چاپ سفارش آقای رضایی"
                }
                className={inputClass}
              />
            </div>
            {direction === "income" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  شیوهٔ ثبت:
                </span>
                {(
                  [
                    { key: "items", label: "کالا و خدمت" },
                    { key: "manual", label: "مبلغ دلخواه" },
                  ] as const
                ).map((x) => (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => {
                      setMode(x.key);
                      request.current = crypto.randomUUID();
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      mode === x.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/70 text-muted-foreground",
                    )}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            )}
            {usingItems ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Package className="size-4 text-primary" />
                    اقلام کار
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    قیمت هر ردیف قابل تغییر است
                  </span>
                </div>
                {lines.map((l, index) => {
                  const product = active.find((x) => x.id === l.itemId);
                  return (
                    <div
                      key={l.key}
                      className="rounded-[22px] border border-border/60 bg-background/40 p-3 sm:p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {faNumber(index + 1)}
                        </span>
                        <div className="relative min-w-0 flex-1">
                          <select
                            aria-label={
                              "انتخاب کالا یا خدمت ردیف " + (index + 1)
                            }
                            value={l.itemId}
                            onChange={(e) => choose(l.key, e.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border border-border/60 bg-background pe-8 ps-3 text-xs"
                          >
                            <option value="">
                              ردیف دلخواه (بدون تعریف قبلی)
                            </option>
                            {active.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} ·{" "}
                                {item.kind === "product"
                                  ? faNumber(item.quantity) + " " + item.unit
                                  : "خدمت"}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute end-2 top-3 size-4 text-muted-foreground" />
                        </div>
                        <button
                          type="button"
                          aria-label={"حذف ردیف " + (index + 1)}
                          disabled={lines.length === 1}
                          onClick={() => {
                            setLines((rows) =>
                              rows.filter((x) => x.key !== l.key),
                            );
                            request.current = crypto.randomUUID();
                          }}
                          className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {!l.itemId && (
                        <Input
                          aria-label={"نام ردیف " + (index + 1)}
                          value={l.title}
                          onChange={(e) =>
                            changeLine(l.key, { title: e.target.value })
                          }
                          placeholder="نام کالا یا کار دلخواه؛ مثلاً ثبت‌نام اینترنتی"
                          maxLength={120}
                          className={cn(inputClass, "mt-3")}
                        />
                      )}
                      <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={"qty-" + l.key}
                            className="text-[11px]"
                          >
                            تعداد {product ? "(" + product.unit + ")" : ""}
                          </Label>
                          <Input
                            id={"qty-" + l.key}
                            inputMode="numeric"
                            value={l.quantity}
                            onChange={(e) =>
                              changeLine(l.key, { quantity: e.target.value })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={"price-" + l.key}
                            className="text-[11px]"
                          >
                            قیمت واحد (تومان)
                          </Label>
                          <Input
                            id={"price-" + l.key}
                            inputMode="numeric"
                            value={l.price}
                            onChange={(e) =>
                              changeLine(l.key, { price: e.target.value })
                            }
                            placeholder="قیمت دلخواه"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground">
                          {product?.kind === "product"
                            ? "موجودی: " +
                              faNumber(product.quantity) +
                              " " +
                              product.unit
                            : "این ردیف موجودی انبار را تغییر نمی‌دهد."}
                        </span>
                        <strong>
                          {faToman(
                            (inputNumber(l.quantity) || 0) *
                              (inputNumber(l.price) || 0),
                          )}
                        </strong>
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  disabled={lines.length >= 40}
                  onClick={() => {
                    setLines((rows) => [...rows, line()]);
                    request.current = crypto.randomUUID();
                  }}
                  className="h-10 w-full rounded-xl border-dashed text-xs"
                >
                  <Plus className="size-4" />
                  افزودن کالا یا خدمت دیگر
                </Button>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="entry-discount" className="text-xs">
                    تخفیف کل (تومان)
                  </Label>
                  <Input
                    id="entry-discount"
                    inputMode="numeric"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="۰"
                    className={cn(inputClass, "w-40")}
                  />
                </div>
              </section>
            ) : (
              <div
                className={cn(
                  "rounded-[24px] border p-4 sm:p-5",
                  direction === "expense"
                    ? "border-rose-500/15 bg-rose-500/[0.04]"
                    : "border-primary/15 bg-primary/[0.04]",
                )}
              >
                <Label htmlFor="entry-amount" className="text-xs">
                  مبلغ {direction === "expense" ? "هزینه" : "درآمد"} (تومان)
                </Label>
                <Input
                  id="entry-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="۰"
                  className="mt-2 h-16 border-0 bg-transparent px-0 text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"
                />
                <p className="text-center text-xs text-muted-foreground">
                  {validMoney(total, 1)
                    ? faToman(total)
                    : "مبلغ را به تومان وارد کنید"}
                </p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entry-category" className="text-xs">
                  دسته‌بندی
                </Label>
                <select
                  id="entry-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(inputClass, "w-full px-3")}
                >
                  {ACCOUNTING_CATEGORIES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-method" className="text-xs">
                  روش پرداخت
                </Label>
                <select
                  id="entry-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={cn(inputClass, "w-full px-3")}
                >
                  {ACCOUNTING_PAYMENT_METHODS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {direction === "expense" && (
              <div className="flex flex-wrap gap-2">
                {["تجهیزات", "قبوض", "اجاره", "حقوق و دستمزد"].map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => {
                      setCategory(x);
                      request.current = crypto.randomUUID();
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px]",
                      category === x
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "border-border/60 text-muted-foreground",
                    )}
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="entry-note" className="text-xs">
                توضیح یا نام مشتری (اختیاری)
              </Label>
              <Textarea
                id="entry-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="جزئیات کار، شماره رسید یا توضیح پرداخت…"
                className="min-h-20 resize-y rounded-2xl bg-background/50 text-sm"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-destructive/10 p-3 text-xs leading-6 text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <footer className="shrink-0 space-y-3 border-t border-border/60 bg-background/70 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {usingItems ? "مبلغ نهایی پس از تخفیف" : "مبلغ قابل ثبت"}
              </span>
              <strong
                className={cn(
                  "text-lg font-extrabold",
                  direction === "expense"
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-primary",
                )}
              >
                {faToman(Number.isFinite(total) ? total : 0)}
              </strong>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onClose}
                className="h-11 rounded-xl text-xs"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className={cn(
                  "h-11 flex-1 rounded-xl border-0 text-sm font-bold",
                  direction === "expense"
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "clay-primary hover:brightness-105",
                )}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {busy
                  ? "در حال ذخیره…"
                  : direction === "expense"
                    ? "ثبت هزینه در دفتر"
                    : "ثبت کار و درآمد"}
              </Button>
            </div>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
