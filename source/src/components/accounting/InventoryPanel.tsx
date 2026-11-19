import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Package,
  Plus,
  Search,
  Pencil,
  Archive,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Boxes,
  Sparkles,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { faNumber, faToman, faDateTime } from "@/lib/format";
import {
  inputNumber,
  validMoney,
  normalizeSearch,
  type CatalogItem,
  type StockMovement,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
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
const field = "h-11 rounded-xl border-border/60 bg-background/60 text-sm";
const movementLabels: Record<string, string> = {
  opening: "موجودی اولیه",
  in: "ورود به انبار",
  out: "خروج از انبار",
  sale: "فروش",
  void: "برگشت ابطال",
};
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
    [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null | undefined>(),
    [stock, setStock] = useState<{
      item: CatalogItem;
      kind: "in" | "out";
    } | null>(null);
  const products = catalog.filter((x) => x.kind === "product" && !x.archived),
    low = products.filter((x) => x.quantity <= x.lowStock);
  const rows = useMemo(
    () =>
      catalog.filter(
        (x) =>
          x.archived === archived &&
          (view !== "stock" || x.kind === "product") &&
          (filter === "all" || x.kind === filter) &&
          normalizeSearch([x.title, x.sku].join(" ")).includes(
            normalizeSearch(search),
          ),
      ),
    [catalog, archived, view, filter, search],
  );
  const archive = async (item: CatalogItem) => {
    if (
      !confirm(
        item.archived
          ? "این کالا دوباره فعال شود؟"
          : "این کالا بایگانی شود؟ سوابق فروش و موجودی آن حفظ می‌شود.",
      )
    )
      return;
    try {
      await mutate("/catalog", { id: item.id, archive: !item.archived });
      toast.success("وضعیت کالا ذخیره شد.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-5">
      {view === "stock" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "کالاهای انبار",
              value: products.length,
              icon: Boxes,
              tone: "bg-primary/10 text-primary",
            },
            {
              label: "مجموع موجودی",
              value: products.reduce((n, x) => n + x.quantity, 0),
              icon: Package,
              tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            },
            {
              label: "نیازمند تأمین",
              value: low.length,
              icon: AlertTriangle,
              tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            },
          ].map((x) => (
            <div
              key={x.label}
              className="clay flex items-center gap-3 rounded-3xl p-5"
            >
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-2xl",
                  x.tone,
                )}
              >
                <x.icon className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{x.label}</p>
                <p className="mt-1 text-2xl font-extrabold">
                  {faNumber(x.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <section className="clay rounded-[28px] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">
              {view === "stock"
                ? "انبار و موجودی کالا"
                : "کالاها و خدمت‌های من"}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {view === "stock"
                ? "ورود و خروج کالا را ثبت کنید؛ فروش، موجودی را خودکار کم می‌کند."
                : "نام، واحد و قیمت دلخواه تعریف کنید و موقع ثبت کار انتخاب کنید."}
            </p>
          </div>
          <Button
            disabled={!canWrite}
            onClick={() => setEditing(null)}
            className="clay-primary h-10 rounded-xl border-0 text-xs"
          >
            <Plus className="size-4" />
            تعریف کالا یا خدمت
          </Button>
        </div>
        <div className="my-5 flex flex-wrap items-center gap-3">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-2xl bg-muted/50 px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              aria-label="جست‌وجوی کالا"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="نام یا کد کالا را جست‌وجو کنید…"
              className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          {view === "catalog" && (
            <select
              aria-label="نوع کالا"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-11 rounded-xl border border-border/60 bg-background px-3 text-xs"
            >
              <option value="all">همه موارد</option>
              <option value="product">کالا</option>
              <option value="service">خدمت</option>
            </select>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="size-4 accent-primary"
            />
            بایگانی‌ها
          </label>
        </div>
        {!rows.length ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-muted/20 px-5 py-12 text-center">
            <Package className="size-10 text-primary/50" />
            <h3 className="mt-4 text-sm font-bold">
              {search
                ? "موردی با این مشخصات پیدا نشد"
                : "اولین کالا یا خدمت را تعریف کنید"}
            </h3>
            <p className="mt-2 max-w-md text-xs leading-6 text-muted-foreground">
              مثلاً کاغذ A4 با موجودی انبار، یا خدمت تایپ و پرینت با قیمت هر
              صفحه.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-border/60 bg-background/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-2xl",
                      item.kind === "product"
                        ? "bg-primary/10 text-primary"
                        : "bg-violet-500/10 text-violet-600 dark:text-violet-300",
                    )}
                  >
                    {item.kind === "product" ? (
                      <Package className="size-5" />
                    ) : (
                      <Sparkles className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold break-words">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.kind === "product" ? "کالا" : "خدمت"} · هر{" "}
                      {item.unit}
                      {item.sku ? " · کد " + item.sku : ""}
                    </p>
                  </div>
                  {canWrite && (
                    <button
                      aria-label={"ویرایش " + item.title}
                      onClick={() => setEditing(item)}
                      className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="size-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-extrabold">
                    {faToman(item.priceToman)}
                  </p>
                  {item.kind === "product" && (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        item.quantity <= item.lowStock
                          ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                          : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                      )}
                    >
                      موجودی: {faNumber(item.quantity)} {item.unit}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3">
                  {canWrite && !item.archived && (
                    <>
                      {view === "stock" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs"
                            onClick={() => setStock({ item, kind: "in" })}
                          >
                            <Plus className="size-3.5" />
                            ورود کالا
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs"
                            onClick={() => setStock({ item, kind: "out" })}
                            disabled={item.quantity === 0}
                          >
                            <ArrowUpRight className="size-3.5" />
                            خروج کالا
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs"
                          onClick={() => onSell(item)}
                          disabled={
                            item.kind === "product" && item.quantity === 0
                          }
                        >
                          <ShoppingCart className="size-3.5" />
                          ثبت کار / فروش
                        </Button>
                      )}
                    </>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => void archive(item)}
                      className="ms-auto inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    >
                      {item.archived ? (
                        <RotateCcw className="size-3.5" />
                      ) : (
                        <Archive className="size-3.5" />
                      )}
                      {item.archived ? "فعال‌سازی" : "بایگانی"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {view === "stock" && (
        <section className="clay rounded-[28px] p-5">
          <h2 className="text-sm font-extrabold">گردش‌های اخیر انبار</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            ۱۰۰ گردش آخر · ورود، خروج، فروش و برگشت ابطال
          </p>
          <div className="mt-4 divide-y divide-border/50">
            {movements.length ? (
              movements.map((m) => (
                <div key={m.id} className="flex items-start gap-3 py-3">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      m.delta > 0
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {m.delta > 0 ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {m.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {movementLabels[m.kind] || m.kind}
                      </span>
                    </p>
                    <p className="mt-1 break-words text-[11px] text-muted-foreground">
                      {m.reason}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {faDateTime(m.createdAt)}
                    </p>
                  </div>
                  <strong dir="ltr" className="whitespace-nowrap text-sm">
                    {m.delta > 0 ? "+" : "−"}
                    {faNumber(Math.abs(m.delta))}{" "}
                    <span className="text-[10px] font-normal">{m.unit}</span>
                  </strong>
                </div>
              ))
            ) : (
              <p className="py-7 text-center text-xs text-muted-foreground">
                گردشی ثبت نشده است.
              </p>
            )}
          </div>
        </section>
      )}
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
    </div>
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rid = useRef(crypto.randomUUID());
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      num = (name: string) => inputNumber(String(f.get(name) || "0"));
    const price = num("priceToman"),
      cost = num("costToman"),
      quantity = num("quantity"),
      low = num("lowStock");
    if (![price, cost, quantity, low].every((x) => validMoney(x))) {
      setError("قیمت و تعداد را به‌صورت عدد صحیح و معتبر وارد کنید.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/catalog", {
        id: item?.id,
        version: item?.version,
        requestId: rid.current,
        title: f.get("title"),
        kind,
        unit: f.get("unit"),
        sku: f.get("sku"),
        priceToman: price,
        costToman: cost,
        quantity,
        lowStock: low,
      });
      toast.success(item ? "کالا به‌روز شد." : "کالا یا خدمت تعریف شد.");
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
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[28px] sm:max-w-lg [&>[data-slot=dialog-close]]:left-4 [&>[data-slot=dialog-close]]:right-auto">
        <DialogHeader className="pe-8 text-start sm:text-start">
          <DialogTitle>
            {item ? "ویرایش کالا یا خدمت" : "تعریف کالا یا خدمت"}
          </DialogTitle>
          <DialogDescription>
            قیمت پایه را ثبت کنید؛ هنگام ثبت کار هم می‌توانید قیمت دلخواه
            بگذارید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["product", "service"] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!item}
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold",
                  kind === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {k === "product" ? (
                  <Package className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {k === "product" ? "کالای انبار" : "خدمت"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-title">
              نام {kind === "product" ? "کالا" : "خدمت"}
            </Label>
            <Input
              id="product-title"
              name="title"
              required
              maxLength={120}
              defaultValue={item?.title}
              placeholder={
                kind === "product" ? "مثلاً کاغذ A4" : "مثلاً تایپ فارسی"
              }
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-price">قیمت فروش (تومان)</Label>
              <Input
                id="product-price"
                name="priceToman"
                required
                inputMode="numeric"
                defaultValue={item?.priceToman}
                placeholder="مثلاً ۱۵۰۰۰"
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-unit">واحد</Label>
              <Input
                id="product-unit"
                name="unit"
                required
                maxLength={30}
                defaultValue={
                  item?.unit || (kind === "product" ? "عدد" : "نوبت")
                }
                placeholder="عدد، صفحه، ساعت…"
                className={field}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sku">کد (اختیاری)</Label>
              <Input
                id="product-sku"
                name="sku"
                maxLength={60}
                defaultValue={item?.sku}
                className={field}
              />
            </div>
            {kind === "product" && (
              <div className="space-y-2">
                <Label htmlFor="product-cost">بهای خرید هر واحد (تومان)</Label>
                <Input
                  id="product-cost"
                  name="costToman"
                  inputMode="numeric"
                  defaultValue={item?.costToman ?? 0}
                  className={field}
                />
              </div>
            )}
          </div>
          {kind === "product" && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-3">
              {!item && (
                <div className="space-y-2">
                  <Label htmlFor="product-quantity">موجودی اولیه</Label>
                  <Input
                    id="product-quantity"
                    name="quantity"
                    inputMode="numeric"
                    defaultValue="0"
                    className={field}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="product-low">هشدار موجودی در تعداد</Label>
                <Input
                  id="product-low"
                  name="lowStock"
                  inputMode="numeric"
                  defaultValue={item?.lowStock ?? 5}
                  className={field}
                />
              </div>
              {item && (
                <p className="text-xs leading-6 text-muted-foreground">
                  موجودی فعلی: {faNumber(item.quantity)} {item.unit}. برای
                  تغییر، از ورود یا خروج انبار استفاده کنید.
                </p>
              )}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="clay-primary h-11 w-full rounded-xl border-0"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            ذخیره {kind === "product" ? "کالا" : "خدمت"}
          </Button>
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rid = useRef(crypto.randomUUID());
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      quantity = inputNumber(String(f.get("quantity")));
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      (kind === "out" && quantity > item.quantity)
    ) {
      setError("تعداد واردشده با موجودی کالا سازگار نیست.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await mutate("/stock", {
        itemId: item.id,
        kind,
        quantity,
        reason: f.get("reason"),
        requestId: rid.current,
      });
      toast.success("گردش انبار ثبت شد.");
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
      <DialogContent className="rounded-[28px] sm:max-w-md [&>[data-slot=dialog-close]]:left-4 [&>[data-slot=dialog-close]]:right-auto">
        <DialogHeader className="pe-8 text-start sm:text-start">
          <DialogTitle>
            {kind === "in" ? "ورود کالا به انبار" : "خروج کالا از انبار"}
          </DialogTitle>
          <DialogDescription>
            {item.title} · موجودی: {faNumber(item.quantity)} {item.unit}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="movement-quantity">تعداد ({item.unit})</Label>
            <Input
              id="movement-quantity"
              name="quantity"
              required
              inputMode="numeric"
              className={field}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="movement-reason">شرح یا دلیل</Label>
            <Input
              id="movement-reason"
              name="reason"
              required
              maxLength={300}
              placeholder={
                kind === "in"
                  ? "مثلاً خرید و تحویل از تأمین‌کننده"
                  : "مثلاً مصرف داخلی یا ضایعات"
              }
              className={field}
            />
          </div>
          <p className="rounded-2xl bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
            این فرم گردش موجودی را ثبت می‌کند. پرداخت خرید را در بخش «ثبت هزینه»
            وارد کنید.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            className="clay-primary h-11 w-full rounded-xl border-0"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}ثبت{" "}
            {kind === "in" ? "ورود" : "خروج"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
