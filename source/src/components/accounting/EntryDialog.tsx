import { useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  Check,
  ChevronsUpDown,
  Coins,
  CreditCard,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_PAYMENT_METHODS,
  type AccountingDirection,
} from "@/lib/accounting";
import {
  inputNumber,
  validRial,
  toRial,
  normalizeSearch,
  type CatalogItem,
  type CreateEntry,
} from "@/lib/inventory";
import { faNumber } from "@/lib/format";
import { financeDate } from "@/lib/finance-view";
import { Money } from "./FinanceUI";

type DraftLine = {
  key: string;
  itemId: string;
  title: string;
  quantity: string;
  price: string;
};
const draft = (item?: CatalogItem): DraftLine => ({
  key: crypto.randomUUID(),
  itemId: item?.id || "",
  title: item?.title || "",
  quantity: "1",
  price: item ? String(toRial(item.priceToman)) : "",
});
function ItemPicker({
  items,
  value,
  onChange,
  index,
}: {
  items: CatalogItem[];
  value: string;
  onChange: (id: string) => void;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const current = items.find((x) => x.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="fin-item-picker"
          role="combobox"
          aria-expanded={open}
          aria-label={"انتخاب کالا یا خدمت ردیف " + index}
        >
          <span
            className={
              "fin-line-item-symbol " +
              (current?.kind === "service" ? "service" : "")
            }
          >
            {current?.kind === "service" ? (
              <Sparkles size={15} />
            ) : (
              <Package size={15} />
            )}
          </span>
          <span>
            {current?.title || "انتخاب کالا / خدمت"}
            <small>
              {current ? "هر " + current.unit : "یا یک ردیف دلخواه ثبت کن"}
            </small>
          </span>
          <ChevronsUpDown size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="finance-modal fin-item-popover" align="start">
        <Command
          filter={(v, q) =>
            normalizeSearch(v).includes(normalizeSearch(q)) ? 1 : 0
          }
        >
          <CommandInput placeholder="نام یا کد آیتم را بنویس…" />
          <CommandList>
            <CommandEmpty>آیتمی پیدا نشد.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="ردیف دلخواه کار سفارشی بدون تعریف"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Plus size={15} />
                <span>
                  ردیف دلخواه<small>نام و قیمت را خودت بنویس</small>
                </span>
              </CommandItem>
              {items.map((x) => (
                <CommandItem
                  key={x.id}
                  value={x.title + " " + x.sku + " " + x.id}
                  disabled={
                    x.kind === "product" && x.quantity === 0 && x.id !== value
                  }
                  onSelect={() => {
                    onChange(x.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={
                      "fin-line-item-symbol " +
                      (x.kind === "service" ? "service" : "")
                    }
                  >
                    {x.kind === "service" ? (
                      <Sparkles size={14} />
                    ) : (
                      <Package size={14} />
                    )}
                  </span>
                  <span>
                    {x.title}
                    <small>
                      {x.kind === "product"
                        ? "موجودی " + faNumber(x.quantity) + " " + x.unit
                        : "خدمت"}{" "}
                      · {faNumber(toRial(x.priceToman))} ریال
                    </small>
                  </span>
                  {value === x.id && <Check size={14} />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
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
    ),
    [title, setTitle] = useState(
      initialItem ? "فروش " + initialItem.title : "",
    ),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState<string>(
      initialDirection === "expense" ? "سایر" : ACCOUNTING_CATEGORIES[0],
    ),
    [method, setMethod] = useState<string>(ACCOUNTING_PAYMENT_METHODS[0]),
    [note, setNote] = useState(""),
    [discount, setDiscount] = useState(""),
    [showDiscount, setShowDiscount] = useState(false),
    [lines, setLines] = useState<DraftLine[]>(() => [draft(initialItem)]),
    [error, setError] = useState("");
  const request = useRef(crypto.randomUUID()),
    usingItems = direction === "income" && mode === "items",
    gross = lines.reduce(
      (n, l) =>
        n + (inputNumber(l.quantity) || 0) * (inputNumber(l.price) || 0),
      0,
    ),
    discountValue = inputNumber(discount) || 0,
    total = usingItems ? gross - discountValue : inputNumber(amount) || 0;
  const changeLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((rows) =>
      rows.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };
  const choose = (key: string, id: string) => {
    const item = active.find((x) => x.id === id);
    changeLine(key, {
      itemId: id,
      title: item?.title || "",
      price: item ? String(toRial(item.priceToman)) : "",
    });
  };
  const changeDirection = (v: AccountingDirection) => {
    setDirection(v);
    if (v === "expense" && category === ACCOUNTING_CATEGORIES[0])
      setCategory("سایر");
    else if (v === "income" && category === "سایر")
      setCategory(ACCOUNTING_CATEGORIES[0]);
    setError("");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    const entryTitle =
      title.trim() ||
      (usingItems && lines.length === 1 ? "فروش " + lines[0].title : "");
    if (entryTitle.length < 3) {
      setError("یک عنوان روشن برای این سند بنویس.");
      return;
    }
    if (!validRial(total, 10)) {
      setError("مبلغ نهایی باید بین ۱۰ و ۱۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال و مضرب ۱۰ باشد.");
      return;
    }
    if (usingItems) {
      if (!lines.length) {
        setError("حداقل یک کالا، خدمت یا ردیف دلخواه اضافه کن.");
        return;
      }
      if (
        (discount.trim() && !validRial(inputNumber(discount))) ||
        !validRial(discountValue) ||
        discountValue >= gross
      ) {
        setError("تخفیف باید مضرب ۱۰ ریال و کمتر از جمع اقلام باشد.");
        return;
      }
      for (const l of lines) {
        const q = inputNumber(l.quantity),
          p = inputNumber(l.price);
        if (
          !l.title.trim() ||
          !l.price.trim() ||
          !Number.isSafeInteger(q) ||
          q < 1 ||
          q > 10000000 ||
          !validRial(p)
        ) {
          setError("نام و تعداد را کامل و قیمت را به ریال و مضرب ۱۰ وارد کن.");
          return;
        }
      }
    }
    const saved = await onSubmit({
      requestId: request.current,
      title: entryTitle,
      direction,
      category,
      method,
      amountToman: total / 10,
      note: note.trim() || undefined,
      discountToman: usingItems ? discountValue / 10 : 0,
      lines: usingItems
        ? lines.map((l) => ({
            itemId: l.itemId || undefined,
            title: l.title.trim(),
            quantity: inputNumber(l.quantity),
            unitPrice: inputNumber(l.price) / 10,
          }))
        : [],
    });
    if (!saved)
      setError("سند ذخیره نشد. پیام خطا را بررسی کن و دوباره تلاش کن.");
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        className="finance-modal fin-entry-dialog"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="fin-dialog-header">
          <div className="fin-dialog-title-row">
            <span
              className={
                "fin-dialog-icon " + (direction === "expense" ? "expense" : "")
              }
            >
              {direction === "expense" ? (
                <Wallet size={22} />
              ) : (
                <ReceiptText size={22} />
              )}
            </span>
            <div>
              <DialogTitle>
                {direction === "expense"
                  ? "یک هزینهٔ تازه ثبت کن"
                  : "ثبت فروش و خدمات"}
              </DialogTitle>
              <DialogDescription>
                {direction === "expense"
                  ? "پرداخت‌های کسب‌وکار را روشن و قابل پیگیری نگه دار."
                  : "اقلام را انتخاب کن، قیمت را تنظیم کن و سند را ثبت کن."}
              </DialogDescription>
            </div>
          </div>
          <span className="fin-tag neutral fin-draft-tag">پیش‌نویس</span>
        </DialogHeader>
        <form onSubmit={submit} className="fin-entry-form">
          <div className="fin-entry-layout">
            <fieldset disabled={busy} className="fin-entry-editor">
              <div className="fin-entry-types">
                <button
                  type="button"
                  className={direction === "income" ? "active income" : ""}
                  onClick={() => changeDirection("income")}
                >
                  <ArrowDownLeft size={17} />
                  <span>
                    درآمد و فروش<small>کار یا دریافت مشتری</small>
                  </span>
                  {direction === "income" && <Check size={14} />}
                </button>
                <button
                  type="button"
                  className={direction === "expense" ? "active expense" : ""}
                  onClick={() => changeDirection("expense")}
                >
                  <ArrowUpRight size={17} />
                  <span>
                    ثبت هزینه<small>خرید، قبض و پرداخت‌ها</small>
                  </span>
                  {direction === "expense" && <Check size={14} />}
                </button>
              </div>
              <label className="fin-field">
                {direction === "expense"
                  ? "بابت چه چیزی پرداخت کردی؟"
                  : "عنوان سند یا نام کار"}
                <input
                  className="fin-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder={
                    direction === "expense"
                      ? "مثلاً خرید کاغذ یا پرداخت اینترنت"
                      : "مثلاً خدمات چاپ سفارش آقای رضایی"
                  }
                />
              </label>
              {direction === "income" && (
                <div className="fin-entry-mode">
                  <span>شیوهٔ ثبت</span>
                  <div className="fin-segmented">
                    {(
                      [
                        { key: "items", label: "کالا و خدمت" },
                        { key: "manual", label: "مبلغ دلخواه" },
                      ] as const
                    ).map((x) => (
                      <button
                        key={x.key}
                        type="button"
                        className={mode === x.key ? "active" : ""}
                        onClick={() => {
                          setMode(x.key);
                        }}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {usingItems ? (
                <div className="fin-lines-editor">
                  <div className="fin-lines-title">
                    <h3>
                      <Package size={15} />
                      اقلام این فروش
                    </h3>
                    <span>{faNumber(lines.length)} ردیف</span>
                  </div>
                  <div className="fin-line-headings">
                    <span>شرح کالا / خدمت</span>
                    <span>تعداد</span>
                    <span>قیمت واحد</span>
                    <span>جمع</span>
                    <span />
                  </div>
                  {lines.map((l, i) => {
                    const product = active.find((x) => x.id === l.itemId),
                      lineTotal =
                        (inputNumber(l.quantity) || 0) *
                        (inputNumber(l.price) || 0);
                    return (
                      <div className="fin-invoice-line" key={l.key}>
                        <div className="fin-line-product">
                          <ItemPicker
                            items={active}
                            value={l.itemId}
                            index={i + 1}
                            onChange={(id) => choose(l.key, id)}
                          />
                          {!l.itemId && (
                            <input
                              className="fin-input fin-custom-line"
                              aria-label={"نام ردیف " + (i + 1)}
                              maxLength={120}
                              value={l.title}
                              onChange={(e) =>
                                changeLine(l.key, { title: e.target.value })
                              }
                              placeholder="نام کالای دلخواه یا کار سفارشی"
                            />
                          )}
                          {product?.kind === "product" && (
                            <small
                              className={
                                product.quantity <= product.lowStock
                                  ? "fin-stock-warning"
                                  : ""
                              }
                            >
                              موجودی: {faNumber(product.quantity)}{" "}
                              {product.unit}
                            </small>
                          )}
                        </div>
                        <div className="fin-line-qty">
                          <button
                            type="button"
                            aria-label={"کاهش تعداد ردیف " + (i + 1)}
                            onClick={() =>
                              changeLine(l.key, {
                                quantity: String(
                                  Math.max(
                                    1,
                                    (inputNumber(l.quantity) || 1) - 1,
                                  ),
                                ),
                              })
                            }
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            aria-label={"تعداد ردیف " + (i + 1)}
                            inputMode="numeric"
                            value={l.quantity}
                            onChange={(e) =>
                              changeLine(l.key, { quantity: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            aria-label={"افزایش تعداد ردیف " + (i + 1)}
                            onClick={() =>
                              changeLine(l.key, {
                                quantity: String(
                                  Math.max(
                                    1,
                                    Math.min(
                                      10000000,
                                      (inputNumber(l.quantity) || 0) + 1,
                                    ),
                                  ),
                                ),
                              })
                            }
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <div className="fin-line-price">
                          <input
                            aria-label={"قیمت واحد ردیف " + (i + 1)}
                            inputMode="numeric"
                            value={l.price}
                            onChange={(e) =>
                              changeLine(l.key, { price: e.target.value })
                            }
                            placeholder="۰"
                          />
                          <small>ریال</small>
                        </div>
                        <div className="fin-line-total">
                          <span>جمع ردیف</span>
                          <b>
                            {Number.isFinite(lineTotal)
                              ? faNumber(lineTotal)
                              : "—"}
                          </b>
                        </div>
                        <button
                          type="button"
                          className="fin-delete-line"
                          aria-label={"حذف ردیف " + (i + 1)}
                          disabled={lines.length === 1}
                          onClick={() => {
                            setLines((rows) =>
                              rows.filter((x) => x.key !== l.key),
                            );
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="fin-add-line"
                    disabled={lines.length >= 40}
                    onClick={() => {
                      setLines((rows) => [...rows, draft()]);
                    }}
                  >
                    <Plus size={15} />
                    افزودن یک ردیف دیگر
                  </button>
                  <div className="fin-discount-row">
                    {!showDiscount ? (
                      <button
                        type="button"
                        onClick={() => setShowDiscount(true)}
                      >
                        <BadgePercent size={15} />
                        افزودن تخفیف
                      </button>
                    ) : (
                      <>
                        <label htmlFor="finance-discount">
                          <BadgePercent size={15} />
                          تخفیف کل
                        </label>
                        <div className="fin-discount-input">
                          <input
                            id="finance-discount"
                            inputMode="numeric"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            placeholder="۰"
                          />
                          <small>ریال</small>
                        </div>
                        <button
                          type="button"
                          aria-label="حذف تخفیف"
                          onClick={() => {
                            setShowDiscount(false);
                            setDiscount("");
                          }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={
                    "fin-amount-editor " +
                    (direction === "expense" ? "expense" : "")
                  }
                >
                  <label htmlFor="finance-entry-amount">
                    مبلغ {direction === "expense" ? "پرداخت" : "دریافت"}
                  </label>
                  <div>
                    <input
                      id="finance-entry-amount"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="۰"
                    />
                    <span>ریال</span>
                  </div>
                  <p>
                    {validRial(total, 10)
                      ? faNumber(total) + " ریال"
                      : "مبلغ را به ریال وارد کن"}
                  </p>
                </div>
              )}
              <div className="fin-entry-section">
                <h3>
                  <FileText size={15} />
                  اطلاعات پرداخت
                </h3>
                <div className="fin-field-grid">
                  <label className="fin-field">
                    دسته‌بندی
                    <select
                      className="fin-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {ACCOUNTING_CATEGORIES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label className="fin-field">
                    روش پرداخت
                    <select
                      className="fin-input"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {ACCOUNTING_PAYMENT_METHODS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {direction === "expense" && (
                  <div className="fin-category-shortcuts">
                    {["تجهیزات", "قبوض", "اجاره", "حقوق و دستمزد"].map((x) => (
                      <button
                        key={x}
                        type="button"
                        className={category === x ? "active" : ""}
                        onClick={() => {
                          setCategory(x);
                        }}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                )}
                <label className="fin-field">
                  یادداشت <small>نام مشتری، شماره رسید یا توضیح بیشتر</small>
                  <textarea
                    className="fin-input fin-textarea"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    placeholder="جزئیات این سند را اینجا بنویس…"
                  />
                </label>
              </div>
            </fieldset>
            <aside className="fin-bill-preview">
              <div className="fin-bill-paper">
                <div className="fin-bill-heading">
                  <span>
                    <ReceiptText size={24} />
                  </span>
                  <h3>
                    {direction === "income"
                      ? "پیش‌نمایش فروش"
                      : "پیش‌نمایش هزینه"}
                  </h3>
                  <p>{financeDate(Date.now())}</p>
                </div>
                <div className="fin-bill-title">{title || "عنوان سند شما"}</div>
                <div className="fin-bill-lines">
                  {usingItems ? (
                    lines.map((l, i) => (
                      <div key={l.key}>
                        <span>
                          {l.title || "ردیف " + faNumber(i + 1)}
                          <small>
                            {faNumber(inputNumber(l.quantity) || 0)} ×{" "}
                            {faNumber(inputNumber(l.price) || 0)}
                          </small>
                        </span>
                        <b>
                          {faNumber(
                            (inputNumber(l.quantity) || 0) *
                              (inputNumber(l.price) || 0),
                          )}
                        </b>
                      </div>
                    ))
                  ) : (
                    <div>
                      <span>{category}</span>
                      <b>{faNumber(total)}</b>
                    </div>
                  )}
                </div>
                <div className="fin-bill-calculations">
                  <p>
                    جمع مبلغ <b>{faNumber(usingItems ? gross : total)}</b>
                  </p>
                  {usingItems && discountValue > 0 && (
                    <p>
                      تخفیف{" "}
                      <b className="fin-red">−{faNumber(discountValue)}</b>
                    </p>
                  )}
                </div>
                <div className="fin-bill-final">
                  <span>مبلغ نهایی</span>
                  <Money value={Number.isFinite(total) ? total / 10 : 0} />
                </div>
                <div className="fin-bill-payment">
                  {method === "نقدی" ? (
                    <Coins size={15} />
                  ) : method === "کارت به کارت" ? (
                    <CreditCard size={15} />
                  ) : (
                    <Wallet size={15} />
                  )}
                  <span>{method}</span>
                  <span className="fin-tag neutral">
                    {direction === "income" ? "دریافتی" : "پرداختی"}
                  </span>
                </div>
              </div>
              <p className="fin-bill-note">
                {usingItems
                  ? "با ثبت سند، موجودی اقلام کالایی همین فروش کم می‌شود."
                  : "بعد از ثبت، سند در دفتر مالی قابل مشاهده و چاپ است."}
              </p>
            </aside>
          </div>
          <footer className="fin-entry-footer">
            {error && (
              <p role="alert" className="fin-form-error">
                {error}
              </p>
            )}
            <div className="fin-entry-footer-row">
              <div className="fin-entry-footer-total">
                <span>مبلغ قابل ثبت</span>
                <Money value={Number.isFinite(total) ? total / 10 : 0} />
              </div>
              <div className="fin-entry-footer-actions">
                <button
                  type="button"
                  disabled={busy}
                  className="fin-button secondary"
                  onClick={onClose}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className={
                    "fin-button " +
                    (direction === "expense" ? "danger" : "primary")
                  }
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}{" "}
                  {busy
                    ? "در حال ذخیره…"
                    : direction === "expense"
                      ? "ثبت نهایی هزینه"
                      : "ثبت نهایی فروش"}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
