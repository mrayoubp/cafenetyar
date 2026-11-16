import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Shows a recovery code exactly once. The server only stores a salted hash,
 * so the code cannot be shown again after this dialog is closed.
 */
export function RecoveryCodeDialog({
  code,
  open,
  onOpenChange,
  title = "کد بازیابی حساب",
  description = "این کد فقط یک بار نمایش داده می‌شود. آن را در جای امن ذخیره کنید.",
}: {
  code: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("کد بازیابی کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی خودکار ممکن نشد؛ کد را دستی یادداشت کنید.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="clay w-[min(30rem,calc(100vw-1.5rem))] rounded-[28px] border-0 p-0">
        <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
          <DialogHeader className="text-start">
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <KeyRound className="size-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-5">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 p-5">
          <div className="clay-inset flex items-center justify-between gap-2 rounded-2xl px-3 py-3">
            <span
              dir="ltr"
              className="select-all text-center text-sm font-extrabold tracking-[0.18em] text-primary"
            >
              {code ?? "—"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={copy}
              aria-label="کپی کد بازیابی"
              className="size-9 shrink-0 rounded-xl text-primary hover:bg-primary/10"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-[10.5px] leading-5 text-amber-800 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              بدون این کد، بازیابی رمز عبور ممکن نیست. کد را جدا از رمز عبور و
              در جای امن نگه دارید؛ پس از بستن این پنجره دیگر نمایش داده نمی‌شود.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
          >
            کد را ذخیره کردم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
