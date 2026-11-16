import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import type { PermissionKey } from "@/convex/permissions";
import { ArrowRight, Loader2, Lock, ShieldAlert, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

function CenteredCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="clay w-full max-w-md rounded-[32px] p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-primary/10 text-primary">
          {icon}
        </div>
        <h1 className="mt-4 text-lg font-extrabold">{title}</h1>
        <p className="mt-2 text-[11.5px] leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex flex-col gap-2">{children}</div>
      </div>
    </main>
  );
}

/**
 * Client-side routing guard for tenant pages. Every server function repeats
 * these checks; this component only provides the right screen and redirects.
 */
export function RequireCafe({
  children,
  permission,
  ownerOnly = false,
  allowGuest = false,
  allowSuspended = false,
  planFeature,
}: {
  children: ReactNode;
  permission?: PermissionKey;
  ownerOnly?: boolean;
  allowGuest?: boolean;
  /** Account settings stay reachable for suspended cafes. */
  allowSuspended?: boolean;
  /** Subscription entitlement required by this product area. */
  planFeature?: "agent" | "rates" | "advancedReports";
}) {
  const { context, isLoading } = useSession();
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!context) {
    const target = `/auth?returnTo=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={target} replace />;
  }

  if (context.isBlocked) {
    return (
      <CenteredCard
        icon={<UserX className="size-6" />}
        title="حساب شما مسدود شده است"
        description="دسترسی این حساب توسط مدیر اصلی کافی‌نت‌یار مسدود شده است. برای بررسی وضعیت با پشتیبانی تماس بگیرید."
      >
        <Button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/auth", { replace: true });
          }}
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          خروج از حساب
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/">بازگشت به صفحه اصلی</Link>
        </Button>
      </CenteredCard>
    );
  }

  if (
    context.isSiteAdmin &&
    !context.cafe &&
    !context.isGuest &&
    (permission !== undefined || ownerOnly)
  ) {
    return <Navigate to="/admin" replace />;
  }

  if (context.needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (
    !allowSuspended &&
    context.cafe?.status === "suspended"
  ) {
    return (
      <CenteredCard
        icon={<ShieldAlert className="size-6" />}
        title="حساب این کافی‌نت غیرفعال است"
        description="دسترسی این مجموعه توسط مدیر اصلی کافی‌نت‌یار غیرفعال شده است. برای پیگیری با پشتیبانی تماس بگیرید یا وضعیت اشتراک را بررسی کنید."
      >
        <Button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/auth", { replace: true });
          }}
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          خروج از حساب
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/">بازگشت به صفحه اصلی</Link>
        </Button>
      </CenteredCard>
    );
  }

  if (context.membership?.role === "employee" && !context.membership.active) {
    return (
      <CenteredCard
        icon={<UserX className="size-6" />}
        title="حساب کارمند شما غیرفعال است"
        description="دسترسی شما به این کافی‌نت توسط صاحب کافی‌نت غیرفعال شده است. برای فعال‌سازی دوباره با مدیر مجموعه تماس بگیرید."
      >
        <Button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/auth", { replace: true });
          }}
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          خروج از حساب
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/">بازگشت به صفحه اصلی</Link>
        </Button>
      </CenteredCard>
    );
  }

  if (context.isGuest && !allowGuest) {
    return (
      <CenteredCard
        icon={<ShieldAlert className="size-6" />}
        title="این بخش برای صاحبان کافی‌نت است"
        description="شما با حساب مهمان وارد شده‌اید. برای دسترسی به تنظیمات و مدیریت کافی‌نت، یک حساب واقعی بسازید."
      >
        <Button
          asChild
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          <Link to="/auth?mode=signup">
            ساخت حساب کافی‌نت
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/dashboard">بازگشت به داشبورد</Link>
        </Button>
      </CenteredCard>
    );
  }

  const denied =
    (ownerOnly && !context.isOwner) ||
    (permission !== undefined && !context.permissions.includes(permission));

  const planDenied =
    !context.isSiteAdmin &&
    context.cafe !== null &&
    (planFeature === "agent"
      ? !context.canUseAgent
      : planFeature === "rates"
        ? !context.canUseRates
        : planFeature === "advancedReports"
          ? !context.hasAdvancedReports
          : false);

  if (planFeature && planDenied) {
    return (
      <CenteredCard
        icon={<Lock className="size-6" />}
        title="این بخش در پلن فعلی شما فعال نیست"
        description="پلن فعلی به این قابلیت دسترسی ندارد یا سهمیه آن فعال نیست. با ارتقای پلن، بدون حذف اطلاعات قبلی، امکانات بیشتری فعال می‌شود."
      >
        <Button
          asChild
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          <Link to="/dashboard/subscription">مشاهده پلن‌ها و ارتقا</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/dashboard">بازگشت به داشبورد</Link>
        </Button>
      </CenteredCard>
    );
  }

  if (denied) {
    return (
      <CenteredCard
        icon={<Lock className="size-6" />}
        title="دسترسی کافی ندارید"
        description="این بخش برای نقش شما فعال نیست. برای تغییر سطح دسترسی با صاحب کافی‌نت صحبت کنید."
      >
        <Button
          asChild
          className="clay-primary h-11 w-full rounded-xl border-0 text-[12.5px] font-bold hover:brightness-105"
        >
          <Link to="/dashboard">بازگشت به داشبورد</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full rounded-xl text-[11.5px] text-muted-foreground"
        >
          <Link to="/dashboard/account">حساب کاربری من</Link>
        </Button>
      </CenteredCard>
    );
  }

  return <>{children}</>;
}
