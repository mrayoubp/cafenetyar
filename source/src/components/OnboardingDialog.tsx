import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  CheckCircle2,
  CreditCard,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const STEPS = [
  {
    title: "محیط کافی‌نت را کامل کنید",
    description: "اطلاعات مجموعه و تماس را بررسی کنید تا فضای کاری آماده شود.",
    href: "/dashboard/cafe",
    link: "تنظیمات کافی‌نت",
    icon: CheckCircle2,
  },
  {
    title: "کارمندان را اضافه کنید",
    description: "برای هر کارمند حساب مستقل و دسترسی محدود بسازید.",
    href: "/dashboard/employees",
    link: "مدیریت کارمندان",
    icon: Users,
  },
  {
    title: "اولین تراکنش را ثبت کنید",
    description: "دریافت یا هزینه را وارد کنید؛ رکوردها ماندگار ذخیره می‌شوند.",
    href: "/dashboard/accounting",
    link: "دفتر مالی",
    icon: Calculator,
  },
  {
    title: "اشتراک و راهنمای کامل",
    description: "وضعیت پلن را ببینید و راهنمای گام‌به‌گام را مطالعه کنید.",
    href: "/dashboard/subscription",
    link: "اشتراک",
    icon: CreditCard,
  },
];

function onboardingWasDismissed(key: string) {
  try {
    return window.localStorage.getItem(key) === "done";
  } catch {
    return false;
  }
}

export function OnboardingDialog() {
  const { context } = useSession();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const storageKey =
    context && !context.isGuest && context.user.id
      ? `kafinetyar:onboarding:v1:${context.user.id}`
      : null;
  const open =
    storageKey !== null &&
    dismissedKey !== storageKey &&
    !onboardingWasDismissed(storageKey);

  const dismiss = () => {
    setDismissedKey(storageKey);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, "done");
    } catch {
      // Storage may be unavailable in private mode; the dialog can still close.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="clay max-h-[90vh] w-[min(36rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[30px] border-0 p-0">
        <div className="border-b border-border/50 bg-primary/[0.04] p-5 pe-10">
          <DialogHeader className="text-start">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-extrabold">
                  خوش آمدید به کافی‌نت‌یار
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[10.5px]">
                  یک شروع سریع برای اینکه فضای کاری‌تان را آماده کنید.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-2 p-4 sm:p-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-background text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-extrabold">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-[9.5px] leading-5 text-muted-foreground">
                    {step.description}
                  </p>
                  <Link
                    to={step.href}
                    onClick={dismiss}
                    className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold text-primary hover:underline"
                  >
                    {step.link}
                    <ArrowLeft className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            asChild
            variant="ghost"
            className="h-9 rounded-xl text-[10.5px] text-muted-foreground"
          >
            <Link to="/help" onClick={dismiss}>
              <BookOpen className="size-3.5" />
              راهنمای کامل
            </Link>
          </Button>
          <Button
            type="button"
            onClick={dismiss}
            className="clay-primary h-9 rounded-xl border-0 text-[10.5px] font-bold"
          >
            متوجه شدم، شروع می‌کنم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
