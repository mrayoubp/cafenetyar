import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  FileText,
  Package,
  Printer,
  ReceiptText,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { LedgerItem } from "@/lib/inventory";
import { faNumber } from "@/lib/format";
import { financeDate, financeTime, shortDocumentId } from "@/lib/finance-view";

export function Money({
  value,
  className = "",
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  return (
    <span
      className={
        "fin-money " +
        (Math.abs(value) >= 10000000000 ? "fin-money-compact " : "") +
        className
      }
    >
      <b dir="ltr">
        {value < 0 ? "−" : signed ? "+" : ""}
        {faNumber(Math.abs(value))}
      </b>
      <small>تومان</small>
    </span>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="fin-empty">
      <span className="fin-empty-mark">{icon || <ReceiptText />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Sparkline({
  values,
  tone = "green",
}: {
  values: number[];
  tone?: "green" | "rose";
}) {
  const max = Math.max(...values, 1),
    min = 0;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 110},${34 - ((v - min) / (max - min)) * 30}`,
    )
    .join(" ");
  return (
    <svg
      className={"fin-sparkline " + tone}
      viewBox="0 0 110 40"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function FinanceConfirm({
  title,
  description,
  label,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  label: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="finance-modal fin-confirm">
        <AlertDialogHeader>
          <span className="fin-confirm-icon">
            <X />
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={onCancel}>
            انصراف
          </AlertDialogCancel>
          <Button
            disabled={busy}
            onClick={onConfirm}
            className="fin-button danger"
          >
            {busy ? "در حال انجام…" : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function EntryPreview({
  item,
  cafe,
  onClose,
  onVoid,
}: {
  item: LedgerItem;
  cafe: string;
  onClose: () => void;
  onVoid?: () => void;
}) {
  const gross = item.amountToman + (item.discountToman || 0);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="finance-modal fin-document-dialog"
        showCloseButton={false}
      >
        <div className="fin-dialog-toolbar fin-no-print">
          <span>
            <FileText size={16} />
            جزئیات سند
          </span>
          <button aria-label="بستن جزئیات" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="finance-invoice">
          <DialogHeader className="fin-invoice-header">
            <div className="fin-invoice-brand">
              <span>
                <ReceiptText />
              </span>
              <div>
                <p>{cafe || "کافی‌نت‌یار"}</p>
                <DialogTitle>
                  {item.direction === "income"
                    ? "رسید فروش و خدمات"
                    : "رسید پرداخت هزینه"}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription>
              شناسهٔ سند: <b dir="ltr">{shortDocumentId(item.id)}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="fin-invoice-meta">
            <span>
              تاریخ ثبت
              <strong>
                {financeDate(item.occurredAt)} · {financeTime(item.occurredAt)}
              </strong>
            </span>
            <span>
              روش پرداخت<strong>{item.method}</strong>
            </span>
            <span>
              ثبت‌کننده<strong>{item.operatorName}</strong>
            </span>
            <span>
              وضعیت
              <strong className={item.isVoided ? "fin-red" : "fin-green"}>
                {item.isVoided ? "ابطال‌شده" : "ثبت‌شده"}
              </strong>
            </span>
          </div>
          <h3 className="fin-invoice-title">{item.title}</h3>
          <div className="fin-table-scroll">
            <table className="fin-invoice-table">
              <thead>
                <tr>
                  <th>شرح کالا / خدمت</th>
                  <th>تعداد</th>
                  <th>قیمت واحد</th>
                  <th>مبلغ کل</th>
                </tr>
              </thead>
              <tbody>
                {item.lines?.length ? (
                  item.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.title}</td>
                      <td>
                        {faNumber(l.quantity)} {l.unit}
                      </td>
                      <td>{faNumber(l.unitPrice)}</td>
                      <td>{faNumber(l.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>{item.title}</td>
                    <td>۱</td>
                    <td>{faNumber(item.amountToman)}</td>
                    <td>{faNumber(item.amountToman)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="fin-invoice-bottom">
            <div>
              <span className="fin-label">یادداشت</span>
              <p>{item.note || "یادداشتی برای این سند ثبت نشده است."}</p>
              <span className="fin-tag neutral">{item.category}</span>
            </div>
            <div className="fin-invoice-total">
              <p>
                جمع اقلام <b>{faNumber(gross)}</b>
              </p>
              <p>
                تخفیف <b>{faNumber(item.discountToman || 0)}</b>
              </p>
              <div>
                <span>مبلغ نهایی</span>
                <Money value={item.amountToman} />
              </div>
            </div>
          </div>
          <p className="fin-invoice-caption">
            <Check size={14} />
            این سند از اطلاعات ثبت‌شده در دفتر کافی‌نت تهیه شده است.
          </p>
        </div>
        <div className="fin-dialog-actions fin-no-print">
          {onVoid && !item.isVoided && (
            <button className="fin-text-danger" onClick={onVoid}>
              ابطال سند
            </button>
          )}
          <button
            className="fin-button secondary"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            چاپ رسید
          </button>
          <button className="fin-button primary" onClick={onClose}>
            بستن جزئیات
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
