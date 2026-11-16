import { Button } from "@/components/ui/button";
import type { AdminPermission } from "@/convex/lib/adminPermissions";
import { useSession } from "@/hooks/use-session";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

/**
 * Routing guard for role-based admin routes. Server functions repeat the same
 * permission check; this only keeps unauthorized screens from mounting.
 */
export function RequireAdmin({
  children,
  permission,
}: {
  children: ReactNode;
  permission: AdminPermission;
}) {
  const { context } = useSession();
  const location = useLocation();

  if (context === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!context || !context.isSiteAdmin) {
    if (!context) {
      return (
        <Navigate
          to={`/auth?returnTo=${encodeURIComponent(location.pathname)}`}
          replace
        />
      );
    }
    return <Navigate to="/admin" replace />;
  }

  if (context.isBlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="clay w-full max-w-md rounded-[30px] p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-rose-500/10 text-rose-700 dark:text-rose-300">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold">حساب مدیریتی مسدود است</h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            دسترسی این حساب توسط مدیر اصلی پلتفرم مسدود شده است.
          </p>
          <Button asChild className="mt-5 h-10 w-full rounded-xl text-[11px]">
            <Link to="/admin">
              بازگشت به صفحه مدیریت
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const allowed =
    context.isSuperAdmin || context.adminPermissions.includes(permission);
  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="clay w-full max-w-md rounded-[30px] p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-primary/10 text-primary">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold">دسترسی کافی ندارید</h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            نقش مدیریتی شما به این بخش دسترسی ندارد. مجوزها توسط مدیر اصلی از
            بخش نقش‌ها کنترل می‌شوند.
          </p>
          <Button asChild className="mt-5 h-10 w-full rounded-xl text-[11px]">
            <Link to="/admin">
              بازگشت به داشبورد مدیریت
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
