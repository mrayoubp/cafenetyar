import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronLeft,
  Download,
  Grid2X2,
  Layers3,
  List,
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Warehouse,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { faNumber } from "@/lib/format";
import { financeDate, financeTime } from "@/lib/finance-view";
import { downloadCsv } from "@/lib/csv";
import {
  inputNumber,
  validMoney,
  rialInputToToman,
  toRial,
  stockLevel,
  normalizeSearch,
  type CatalogItem,
  type StockMovement,
} from "@/lib/inventory";
import { EmptyState, FinanceConfirm, Money } from "./FinanceUI";
import { toast } from "sonner";

type Props = {
  catalog: CatalogItem[];
  movements: StockMovement[];
  canWrite: boolean;
  isOwner: boolean;
  view: "catalog" | "stock";
  mutate: (path: string, body: unknown) => Promise<unknown>;
  onSell: (item: CatalogItem) => void;
};
const movementLabels: Record<string, string> = {
  opening: "موجودی اولیه",
  in: "ورود کالا",
  out: "خروج کالا",
  sale: "فروش",
  void: "برگشت ابطال",
};
const stockState = (item: CatalogItem) =>
  item.archived
    ? { label: "بایگانی", tone: "neutral" }
    : item.kind === "service"
      ? { label: "خدمت", tone: "blue" }
      : item.quantity === 0
        ? { label: "ناموجود", tone: "rose" }
        : item.quantity <= item.lowStock
          ? { label: "روبه‌اتمام", tone: "amber" }
          : { label: "موجود", tone: "green" };
export function InventoryPanel({
  catalog,
  movements,
  canWrite,
  isOwner,
  view,
  mutate,
  onSell,
}: Props) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [archived, setArchived] = useState(false),
    [layout, setLayout] = useState<"list" | "grid">("list"),
    [onlyLow, setOnlyLow] = useState(false),
    [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null | undefined>(),
    [stock, setStock] = useState<{
      item: CatalogItem;
      kind: "in" | "out";
    } | null>(null),
    [archiveTarget, setArchiveTarget] = useState<CatalogItem | null>(null),
    [archiveBusy, setArchiveBusy] = useState(false);
  const active = catalog.filter((x) => !x.archived),
    products = active.filter((x) => x.kind === "product"),
    services = active.filter((x) => x.kind === "service"),
    low = products.filter((x) => x.quantity <= x.lowStock),
    empty = products.filter((x) => !x.quantity);
  const stockValue = products.reduce(
    (n, x) => n + BigInt(x.quantity) * BigInt(x.costToman),
    0n,
  );
  const rows = useMemo(
    () =>
      catalog.filter(
        (x) =>
          x.archived === archived &&
          (view !== "stock" || x.kind === "product") &&
          (filter === "all" || view === "stock" || x.kind === filter) &&
          (!onlyLow || view !== "stock" || x.quantity <= x.lowStock) &&
          normalizeSearch(x.title + " " + x.sku).includes(
            normalizeSearch(search),
          ),
      ),
    [catalog, archived, view, filter, onlyLow, search],
  );
  const archive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    try {
      await mutate("/catalog", {
        id: archiveTarget.id,
        archive: !archiveTarget.archived,
      });
      toast.success(
        archiveTarget.archived ? "کالا دوباره فعال شد." : "کالا بایگانی شد.",
      );
      setArchiveTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setArchiveBusy(false);
    }
  };
  const exportList = () =>
    downloadCsv(
      "فهرست-کالا-و-خدمات.csv",
      [
        "نام",
        "نوع",
        "کد",
        "واحد",
        "قیمت فروش (ریال)",
        "بهای خرید (ریال)",
        "موجودی",
        "حد هشدار",
        "وضعیت",
      ],
      rows.map((x) => [
        x.title,
        x.kind === "product" ? "کالا" : "خدمت",
        x.sku,
        x.unit,
        toRial(x.priceToman),
        toRial(x.costToman),
        x.kind === "product" ? x.quantity : null,
        x.kind === "product" ? x.lowStock : null,
        x.archived ? "بایگانی" : "فعال",
      ]),
    );
  const actions = (item: CatalogItem, card = false) => (
    <div className={card ? "fin-product-actions" : "fin-table-actions"}>
      {canWrite &&
        !item.archived &&
        item.kind === "product" &&
        view !== "stock" && (
          <button
            type="button"
            className="fin-button subtle small"
            onClick={() => setStock({ item, kind: "in" })}
          >
            <Plus size={13} />
            افزایش موجودی
          </button>
        )}
      {canWrite &&
        !item.archived &&
        (view === "stock" ? (
          <>
            <button
              className="fin-button subtle small"
              type="button"
              onClick={() => setStock({ item, kind: "in" })}
            >
              <Plus size={13} />
              افزایش موجودی
            </button>
            <button
              className="fin-button secondary small"
              disabled={!item.quantity}
              onClick={() => setStock({ item, kind: "out" })}
            >
              <ArrowUpRight size={13} />
              خروج
            </button>
          </>
        ) : (
          <button
            className="fin-button subtle small"
            disabled={item.kind === "product" && !item.quantity}
            onClick={() => onSell(item)}
          >
            <ShoppingBag size={13} />
            {card ? "ثبت فروش" : "فروش"}
          </button>
        ))}
      {canWrite && (
        <button
          className={card ? "fin-icon-button" : ""}
          aria-label={"ویرایش " + item.title}
          title="ویرایش"
          onClick={() => setEditing(item)}
        >
          <Pencil size={14} />
        </button>
      )}
      {isOwner && (
        <button
          className={card ? "fin-icon-button" : ""}
          aria-label={(item.archived ? "فعال‌سازی " : "بایگانی ") + item.title}
          title={item.archived ? "فعال‌سازی" : "بایگانی"}
          onClick={() => setArchiveTarget(item)}
        >
          {item.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
        </button>
      )}
    </div>
  );
  const cards = (
    <div
      className={
        "fin-product-grid " + (layout === "list" ? "fin-mobile-only" : "")
      }
    >
      {rows.map((item) => {
        const status = stockState(item);
        return (
          <article key={item.id} className="fin-product-card">
            <div className="fin-product-card-top">
              <span
                className={
                  "fin-product-symbol " +
                  (item.kind === "service" ? "service" : "")
                }
              >
                {item.kind === "product" ? (
                  <Package size={21} />
                ) : (
                  <Sparkles size={21} />
                )}
              </span>
              <span className={"fin-tag " + status.tone}>{status.label}</span>
            </div>
            <h3>{item.title}</h3>
            <p className="fin-product-code">
              {item.kind === "product" ? "کالا" : "خدمت"} · هر {item.unit}
              {item.sku ? " · " + item.sku : ""}
            </p>
            <div className="fin-product-card-price">
              <Money value={item.priceToman} />
            </div>
            {item.kind === "product" && (
              <div className="fin-product-card-stock">
                <span>موجودی</span>
                <b>
                  {faNumber(item.quantity)} <small>{item.unit}</small>
                </b>
                <StockBar item={item} />
              </div>
            )}
            {actions(item, true)}
          </article>
        );
      })}
    </div>
  );
  return (
    <div>
      <div className="fin-section-head">
        <div>
          <h2>
            {view === "stock"
              ? "انبار، همیشه تحت نظر."
              : "کالاها و خدمات کسب‌وکارت"}
          </h2>
          <p>
            {view === "stock"
              ? "موجودی، گردش کالا و زمان تأمین دوباره را دنبال کن."
              : "قیمت‌ها و آیتم‌ها را یک‌بار تعریف کن؛ هر بار راحت‌تر بفروش."}
          </p>
        </div>
        <button
          className="fin-button primary"
          disabled={!canWrite}
          onClick={() => setEditing(null)}
        >
          <Plus size={15} />
          تعریف آیتم جدید
        </button>
      </div>
      {view === "stock" ? (
        <div className="fin-inventory-metrics">
          <div>
            <span className="fin-inventory-metric-icon">
              <Boxes size={19} />
            </span>
            <p>
              کالاهای فعال
              <strong>
                {faNumber(products.length)} <small>قلم</small>
              </strong>
            </p>
          </div>
          <div>
            <span className="fin-inventory-metric-icon amber">
              <Layers3 size={19} />
            </span>
            <p>
              نیازمند تأمین
              <strong>
                {faNumber(low.length)} <small>قلم</small>
              </strong>
            </p>
          </div>
          <div>
            <span className="fin-inventory-metric-icon rose">
              <Package size={19} />
            </span>
            <p>
              ناموجود
              <strong>
                {faNumber(empty.length)} <small>قلم</small>
              </strong>
            </p>
          </div>
          <div>
            <span className="fin-inventory-metric-icon blue">
              <Warehouse size={19} />
            </span>
            <p>
              ارزش برآوردی انبار
              <strong className="fin-valuation">
                {new Intl.NumberFormat("fa-IR").format(stockValue * 10n)}{" "}
                <small>ریال</small>
              </strong>
              <small>بر مبنای بهای خریدِ تعریف‌شده</small>
            </p>
          </div>
        </div>
      ) : (
        <div className="fin-catalog-strip">
          <span>
            <i className="green" />
            <b>{faNumber(products.length)}</b>کالای فیزیکی
          </span>
          <span>
            <i className="blue" />
            <b>{faNumber(services.length)}</b>خدمت
          </span>
          <span>
            <Archive size={12} />
            <b>{faNumber(catalog.length - active.length)}</b>آیتم بایگانی
          </span>
          <button onClick={exportList} disabled={!rows.length}>
            <Download size={13} />
            دریافت فهرست
          </button>
        </div>
      )}
      <div className={view === "stock" ? "fin-stock-layout" : ""}>
        <section className="fin-panel fin-products-panel">
          <div className="fin-products-toolbar">
            <div className="fin-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی نام یا کد…"
                aria-label="جست‌وجوی کالا و خدمت"
              />
            </div>
            <div className="fin-products-filter">
              {view === "stock" ? (
                <button
                  className={"fin-filter-pill " + (onlyLow ? "active" : "")}
                  onClick={() => setOnlyLow((x) => !x)}
                >
                  نیازمند تأمین <b>{faNumber(low.length)}</b>
                </button>
              ) : (
                <select
                  className="fin-select"
                  aria-label="نوع آیتم"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">همهٔ آیتم‌ها</option>
                  <option value="product">کالاها</option>
                  <option value="service">خدمات</option>
                </select>
              )}
              <label className="fin-checkbox">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                />
                بایگانی
              </label>
              <div className="fin-view-toggle">
                <button
                  aria-label="نمای فهرست"
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                  className={layout === "list" ? "active" : ""}
                >
                  <List size={15} />
                </button>
                <button
                  aria-label="نمای کارت"
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  className={layout === "grid" ? "active" : ""}
                >
                  <Grid2X2 size={15} />
                </button>
              </div>
            </div>
          </div>
          {!rows.length ? (
            <EmptyState
              icon={<Package />}
              title={
                search || onlyLow || archived
                  ? "موردی با این مشخصات پیدا نشد"
                  : "اولین آیتمت را تعریف کن"
              }
              description={
                search || onlyLow || archived
                  ? "فیلترها را تغییر بده یا عبارت دیگری جست‌وجو کن."
                  : "مثلاً کاغذ A4، خدمت تایپ یا پرینت. نام و قیمت را خودت تعیین می‌کنی."
              }
              action={
                !search && !onlyLow && !archived ? (
                  <button
                    disabled={!canWrite}
                    className="fin-button subtle"
                    onClick={() => setEditing(null)}
                  >
                    <Plus size={14} />
                    تعریف کالا یا خدمت
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              {layout === "list" && (
                <div className="fin-desktop-only fin-table-scroll">
                  <table className="fin-table fin-catalog-table">
                    <thead>
                      <tr>
                        <th>نام کالا / خدمت</th>
                        <th>قیمت فروش</th>
                        <th>
                          {view === "stock" ? "موجودی / حد هشدار" : "موجودی"}
                        </th>
                        <th>وضعیت</th>
                        <th aria-label="عملیات" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => {
                        const status = stockState(item);
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="fin-catalog-name">
                                <span
                                  className={
                                    "fin-product-symbol " +
                                    (item.kind === "service" ? "service" : "")
                                  }
                                >
                                  {item.kind === "product" ? (
                                    <Package size={17} />
                                  ) : (
                                    <Sparkles size={17} />
                                  )}
                                </span>
                                <div>
                                  <strong>{item.title}</strong>
                                  <small>
                                    {item.sku
                                      ? "کد " + item.sku
                                      : item.kind === "service"
                                        ? "خدمت"
                                        : "بدون کد"}{" "}
                                    · هر {item.unit}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <Money value={item.priceToman} />
                            </td>
                            <td>
                              {item.kind === "product" ? (
                                <div className="fin-stock-quantity">
                                  <strong>
                                    {faNumber(item.quantity)}{" "}
                                    <small>{item.unit}</small>
                                  </strong>
                                  <StockBar item={item} />
                                </div>
                              ) : (
                                <span className="fin-muted">—</span>
                              )}
                            </td>
                            <td>
                              <span className={"fin-tag " + status.tone}>
                                {status.label}
                              </span>
                            </td>
                            <td>{actions(item)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {cards}
            </>
          )}
          <div className="fin-table-footer">
            <span>
              {faNumber(rows.length)} آیتم {archived ? "بایگانی‌شده" : "فعال"}
            </span>
            {view === "stock" ? (
              <button
                className="fin-green"
                onClick={exportList}
                disabled={!rows.length}
              >
                دریافت فهرست موجودی
              </button>
            ) : (
              <span>قیمت نهایی موقع فروش قابل تغییر است.</span>
            )}
          </div>
        </section>
        {view === "stock" && (
          <aside className="fin-panel fin-movements">
            <div className="fin-panel-head">
              <div>
                <h2>ردِ حرکت کالاها</h2>
                <p>آخرین ورود، خروج و فروش</p>
              </div>
              <ActivityIcon />
            </div>
            {!movements.length ? (
              <EmptyState
                icon={<Warehouse />}
                title="هنوز گردشی ثبت نشده"
                description="با ورود کالا یا اولین فروش، مسیر موجودی اینجا دیده می‌شود."
              />
            ) : (
              <div className="fin-movement-list">
                {movements.slice(0, expanded ? 100 : 8).map((m) => (
                  <div className="fin-movement" key={m.id}>
                    <span
                      className={
                        "fin-movement-dot " +
                        (m.delta > 0 ? "positive" : "negative")
                      }
                    >
                      {m.delta > 0 ? (
                        <ArrowDownLeft size={13} />
                      ) : (
                        <ArrowUpRight size={13} />
                      )}
                    </span>
                    <div>
                      <h3>{m.title}</h3>
                      <p>
                        {movementLabels[m.kind] || m.kind} · {m.reason}
                      </p>
                      <small>
                        {financeDate(m.createdAt)} · {financeTime(m.createdAt)}
                      </small>
                    </div>
                    <b
                      dir="ltr"
                      className={m.delta > 0 ? "fin-green" : "fin-red"}
                    >
                      {m.delta > 0 ? "+" : "−"}
                      {faNumber(Math.abs(m.delta))}
                      <small>{m.unit}</small>
                    </b>
                  </div>
                ))}
              </div>
            )}
            {movements.length > 8 && (
              <button
                className="fin-movement-expand"
                onClick={() => setExpanded((x) => !x)}
              >
                {expanded ? "نمایش خلاصه" : "مشاهدهٔ همهٔ گردش‌ها"}
                <ChevronLeft size={13} />
              </button>
            )}
            <div className="fin-note">
              گردش انبار به‌تنهایی هزینهٔ خرید ثبت نمی‌کند.
            </div>
          </aside>
        )}
      </div>
      {editing !== undefined && (
        <CatalogEditor
          item={editing}
          onClose={() => setEditing(undefined)}
          mutate={mutate}
        />
      )}
      {stock && (
        <StockEditor
          {...stock}
          onClose={() => setStock(null)}
          mutate={mutate}
        />
      )}
      {archiveTarget && (
        <FinanceConfirm
          title={
            archiveTarget.archived
              ? "این آیتم دوباره فعال شود؟"
              : "این آیتم بایگانی شود؟"
          }
          description={
            "«" +
            archiveTarget.title +
            "» " +
            (archiveTarget.archived
              ? "دوباره در فهرست فروش نمایش داده می‌شود."
              : "از انتخاب‌های فروش کنار می‌رود. سوابق و موجودی آن باقی می‌مانند.")
          }
          label={archiveTarget.archived ? "فعال‌سازی آیتم" : "بایگانی آیتم"}
          busy={archiveBusy}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => void archive()}
        />
      )}
    </div>
  );
}
function StockBar({ item }: { item: CatalogItem }) {
  const level = stockLevel(item.quantity, item.lowStock);
  return (
    <div className="fin-stock-meter">
      <div
        role="meter"
        aria-label={"موجودی " + item.title}
        aria-valuemin={0}
        aria-valuemax={level.max}
        aria-valuenow={item.quantity}
        aria-valuetext={
          faNumber(item.quantity) +
          " " +
          item.unit +
          "؛ حد هشدار " +
          faNumber(item.lowStock)
        }
      >
        <i style={{ width: level.percent + "%" }} />
      </div>
      <small>حد هشدار: {faNumber(item.lowStock)}</small>
    </div>
  );
}
function ActivityIcon() {
  return (
    <span className="fin-heading-icon">
      <Layers3 size={16} />
    </span>
  );
}
function CatalogEditor({
  item,
  onClose,
  mutate,
}: {
  item: CatalogItem | null;
  onClose: () => void;
  mutate: Props["mutate"];
}) {
  const [kind, setKind] = useState<"product" | "service">(
      item?.kind || "product",
    ),
    [title, setTitle] = useState(item?.title || ""),
    [unit, setUnit] = useState(item?.unit || "عدد"),
    [price, setPrice] = useState(item ? String(toRial(item.priceToman)) : ""),
    [cost, setCost] = useState(String(toRial(item?.costToman || 0))),
    [quantity, setQuantity] = useState("0"),
    [low, setLow] = useState(String(item?.lowStock ?? 5)),
    [sku, setSku] = useState(item?.sku || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rid = useRef(crypto.randomUUID());
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const values = [
      rialInputToToman(price),
      rialInputToToman(cost),
      inputNumber(quantity),
      inputNumber(low),
    ];
    if (
      !title.trim() ||
      !price.trim() ||
      !unit.trim() ||
      !values.every((x) => validMoney(x))
    ) {
      setError(
        "نام و واحد را کامل کن؛ قیمت به ریال و مضرب ۱۰ و تعداد عدد صحیح باشد.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/catalog", {
        id: item?.id,
        version: item?.version,
        requestId: rid.current,
        title,
        kind,
        unit,
        sku,
        priceToman: values[0],
        costToman: kind === "product" ? values[1] : 0,
        quantity: kind === "product" ? values[2] : 0,
        lowStock: kind === "product" ? values[3] : 0,
      });
      toast.success("آیتم با موفقیت ذخیره شد.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="finance-modal fin-catalog-dialog">
        <DialogHeader className="fin-dialog-header">
          <div className="fin-dialog-title-row">
            <span className="fin-dialog-icon">
              {kind === "product" ? (
                <Package size={22} />
              ) : (
                <Sparkles size={22} />
              )}
            </span>
            <div>
              <DialogTitle>
                {item ? "ویرایش آیتم" : "یک آیتم تازه تعریف کن"}
              </DialogTitle>
              <DialogDescription>
                اطلاعات پایهٔ کالا یا خدمت برای فروش‌های بعدی
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="fin-editor-form">
          <div className="fin-catalog-editor-layout">
            <div className="fin-editor-fields">
              <div className="fin-kind-picker">
                {(["product", "service"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={kind === k ? "selected" : ""}
                    disabled={!!item}
                    onClick={() => {
                      setKind(k);
                      if (!item) setUnit(k === "service" ? "نوبت" : "عدد");
                    }}
                  >
                    {k === "product" ? (
                      <Package size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    <span>
                      {k === "product" ? "کالای فیزیکی" : "خدمت"}
                      <small>
                        {k === "product" ? "با موجودی انبار" : "بدون موجودی"}
                      </small>
                    </span>
                    {kind === k && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div className="fin-form-section">
                <h3>
                  <span>۱</span>مشخصات اصلی
                </h3>
                <label className="fin-field">
                  نام {kind === "product" ? "کالا" : "خدمت"}
                  <input
                    className="fin-input"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      kind === "product" ? "مثلاً کاغذ A4" : "مثلاً تایپ فارسی"
                    }
                  />
                </label>
                <div className="fin-field-grid">
                  <label className="fin-field">
                    کد اختصاصی <small>اختیاری</small>
                    <input
                      className="fin-input"
                      maxLength={60}
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="مثلاً PR-104"
                    />
                  </label>
                  <label className="fin-field">
                    واحد
                    <input
                      className="fin-input"
                      required
                      list="finance-unit-options"
                      value={unit}
                      maxLength={30}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                    <datalist id="finance-unit-options">
                      {["عدد", "برگ", "بسته", "صفحه", "نوبت", "ساعت"].map(
                        (x) => (
                          <option key={x} value={x} />
                        ),
                      )}
                    </datalist>
                  </label>
                </div>
              </div>
              <div className="fin-form-section">
                <h3>
                  <span>۲</span>قیمت‌گذاری
                </h3>
                <div className="fin-field-grid">
                  <label className="fin-field">
                    قیمت فروش <small>ریال</small>
                    <input
                      required
                      className="fin-input"
                      inputMode="numeric"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="۰"
                    />
                  </label>
                  {kind === "product" && (
                    <label className="fin-field">
                      بهای خرید <small>ریال</small>
                      <input
                        className="fin-input"
                        inputMode="numeric"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                      />
                    </label>
                  )}
                </div>
                <p className="fin-field-hint">
                  این قیمت پایه است؛ هنگام ثبت هر فروش می‌توانی تغییرش بدهی.
                </p>
              </div>
              {kind === "product" && (
                <div className="fin-form-section">
                  <h3>
                    <span>۳</span>تنظیمات موجودی
                  </h3>
                  <div className="fin-field-grid">
                    {!item ? (
                      <label className="fin-field">
                        موجودی اولیه
                        <input
                          className="fin-input"
                          inputMode="numeric"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </label>
                    ) : (
                      <div className="fin-field">
                        موجودی فعلی
                        <strong className="fin-existing-stock">
                          {faNumber(item.quantity)} <small>{unit}</small>
                        </strong>
                      </div>
                    )}
                    <label className="fin-field">
                      حد هشدار موجودی
                      <input
                        className="fin-input"
                        inputMode="numeric"
                        value={low}
                        onChange={(e) => setLow(e.target.value)}
                      />
                    </label>
                  </div>
                  {item && (
                    <p className="fin-field-hint">
                      برای اصلاح موجودی، از ورود یا خروج انبار استفاده کن.
                    </p>
                  )}
                </div>
              )}
              {error && (
                <p className="fin-form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <aside className="fin-item-preview">
              <span className="fin-label">پیش‌نمایش آیتم</span>
              <div
                className={
                  "fin-product-symbol " + (kind === "service" ? "service" : "")
                }
              >
                {kind === "product" ? (
                  <Package size={30} />
                ) : (
                  <Sparkles size={30} />
                )}
              </div>
              <h3>{title || "نام آیتم شما"}</h3>
              <p>
                {kind === "product" ? "کالای فیزیکی" : "خدمت"} · هر{" "}
                {unit || "واحد"}
              </p>
              {price.trim() && validMoney(rialInputToToman(price)) ? (
                <Money value={rialInputToToman(price)} />
              ) : (
                <span className="fin-preview-placeholder">قیمت را وارد کن</span>
              )}
              <div className="fin-item-preview-tip">
                {kind === "product"
                  ? "با هر فروش، موجودی کالا خودکار به‌روز می‌شود."
                  : "این خدمت با تعداد و قیمت دلخواه در فروش قابل انتخاب است."}
              </div>
            </aside>
          </div>
          <div className="fin-dialog-actions">
            <button
              type="button"
              className="fin-button secondary"
              disabled={busy}
              onClick={onClose}
            >
              انصراف
            </button>
            <button className="fin-button primary" disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              ذخیرهٔ {kind === "product" ? "کالا" : "خدمت"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function StockEditor({
  item,
  kind,
  onClose,
  mutate,
}: {
  item: CatalogItem;
  kind: "in" | "out";
  onClose: () => void;
  mutate: Props["mutate"];
}) {
  const [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState(
      kind === "in" ? "افزایش موجودی" : "خروج از انبار",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rid = useRef(crypto.randomUUID());
  const qty = inputNumber(quantity) || 0,
    after = item.quantity + (kind === "in" ? qty : -qty);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (kind === "out" && after < 0) {
      setError("موجودی برای این خروج کافی نیست.");
      return;
    }
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000000000) {
      setError("تعداد و دلیل گردش را کامل وارد کنید.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await mutate("/stock", {
        itemId: item.id,
        kind,
        quantity: qty,
        reason:
          reason.trim() || (kind === "in" ? "افزایش موجودی" : "خروج از انبار"),
        requestId: rid.current,
      });
      toast.success("گردش موجودی ثبت شد.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="finance-modal fin-stock-dialog">
        <DialogHeader className="fin-dialog-header">
          <div className="fin-dialog-title-row">
            <span className="fin-dialog-icon">
              {kind === "in" ? (
                <ArrowDownLeft size={22} />
              ) : (
                <ArrowUpRight size={22} />
              )}
            </span>
            <div>
              <DialogTitle>
                {kind === "in" ? "ورود به انبار" : "خروج از انبار"}
              </DialogTitle>
              <DialogDescription>{item.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={submit}>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="fin-stock-form">
              <div className="fin-stock-preview">
                <span>
                  موجودی فعلی
                  <b>
                    {faNumber(item.quantity)} <small>{item.unit}</small>
                  </b>
                </span>
                <ArrowLeft size={20} />
                <span>
                  پس از ثبت
                  <b className={after < 0 ? "fin-red" : "fin-green"}>
                    {faNumber(after)} <small>{item.unit}</small>
                  </b>
                </span>
              </div>
              <label className="fin-field">
                تعداد {kind === "in" ? "ورودی" : "خروجی"}{" "}
                <small>({item.unit})</small>
                <input
                  className="fin-input fin-quantity-large"
                  required
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  autoFocus
                  placeholder="۰"
                />
              </label>
              <label className="fin-field">
                شرح گردش
                <input
                  className="fin-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  placeholder={
                    kind === "in"
                      ? "مثلاً تأمین کالا از فروشگاه"
                      : "مثلاً مصرف داخلی یا ضایعات"
                  }
                />
              </label>
              <p className="fin-field-hint">
                این عملیات موجودی را تغییر می‌دهد. پرداخت خرید را در «ثبت هزینه»
                وارد کن.
              </p>
              {error && (
                <p className="fin-form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="fin-dialog-actions">
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
                className="fin-button primary"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {busy
                  ? "در حال ثبت…"
                  : kind === "in"
                    ? "ثبت افزایش موجودی"
                    : "ثبت خروج کالا"}
              </button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
