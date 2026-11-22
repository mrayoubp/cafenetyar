import { Logo, LogoMark } from "@/components/Logo";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/backend/api";
import { PERMISSIONS, type PermissionKey } from "@/backend/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { faDateLong } from "@/lib/format";
import { useMutation, useQuery } from "@/backend/client";
import { notifySoon } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  Bot,
  Calculator,
  ChevronLeft,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Newspaper,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

export type SectionKey =
  | "overview"
  | "accounting"
  | "news"
  | "sites"
  | "agent"
  | "rates"
  | "cafe"
  | "employees"
  | "subscription"
  | "support"
  | "account";

type NavItem = {
  key: string;
  label: string;
  href?: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
  ownerOnly?: boolean;
  badge?: string;
};

const WORKSPACE_NAV: NavItem[] = [
  {
    key: "overview",
    label: "نمای کلی",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    key: "accounting",
    label: "حسابداری هوشمند",
    href: "/dashboard/accounting",
    icon: Calculator,
    permission: PERMISSIONS.ACCOUNTING_VIEW,
  },
  {
    key: "news",
    label: "اخبار روز",
    href: "/dashboard/news",
    icon: Newspaper,
    permission: PERMISSIONS.NEWS_VIEW,
  },
  {
    key: "sites",
    label: "سایت‌های کاربردی",
    href: "/dashboard/sites",
    icon: Globe2,
    permission: PERMISSIONS.SITES_VIEW,
  },
  {
    key: "agent",
    label: "ایجنت هوشمند",
    href: "/dashboard/agent",
    icon: Bot,
    permission: PERMISSIONS.AGENT_USE,
  },
  {
    key: "rates",
    label: "نرخ‌نامه و ماشین‌حساب",
    href: "/dashboard/rates",
    icon: ReceiptText,
    permission: PERMISSIONS.RATES_VIEW,
  },
];

const MANAGEMENT_NAV: NavItem[] = [
  {
    key: "cafe",
    label: "تنظیمات کافی‌نت",
    href: "/dashboard/cafe",
    icon: Store,
    ownerOnly: true,
  },
  {
    key: "employees",
    label: "کارمندان و دسترسی",
    href: "/dashboard/employees",
    icon: Users,
    permission: PERMISSIONS.EMPLOYEES_MANAGE,
  },
  {
    key: "subscription",
    label: "اشتراک کافی‌نت",
    href: "/dashboard/subscription",
    icon: CreditCard,
    ownerOnly: true,
  },
  {
    key: "support",
    label: "پشتیبانی",
    href: "/dashboard/support",
    icon: LifeBuoy,
  },
  {
    key: "account",
    label: "حساب کاربری",
    href: "/dashboard/account",
    icon: UserRound,
  },
];

const SECTION_TITLES: Record<SectionKey, { title: string; eyebrow: string }> = {
  overview: { title: "نمای کلی", eyebrow: "پنل مدیریت کافی‌نت" },
  accounting: {
    title: "حسابداری و انبار",
    eyebrow: "دفتر مالی · کالا و خدمات",
  },
  news: { title: "اخبار روز", eyebrow: "مرکز خبر کافی‌نت" },
  sites: { title: "سایت‌های کاربردی", eyebrow: "بانک سامانه‌های پرکاربرد" },
  agent: { title: "ایجنت هوشمند", eyebrow: "دستیار تخصصی کافی‌نت" },
  rates: { title: "نرخ‌نامه و ماشین‌حساب", eyebrow: "نرخ شفاف خدمات" },
  cafe: { title: "تنظیمات کافی‌نت", eyebrow: "اطلاعات مجموعه" },
  employees: { title: "کارمندان و دسترسی", eyebrow: "مدیریت تیم" },
  subscription: { title: "اشتراک کافی‌نت", eyebrow: "وضعیت اشتراک" },
  support: { title: "پشتیبانی", eyebrow: "ارتباط با تیم کافی‌نت‌یار" },
  account: { title: "حساب کاربری", eyebrow: "امنیت و مشخصات" },
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: "دوره آزمایشی",
  active: "فعال",
  expired: "منقضی",
  canceled: "لغوشده",
  pending_payment: "در انتظار پرداخت",
};

export function AppShell({
  active,
  children,
}: {
  active: SectionKey;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { context } = useSession();

  return (
    <div
      className={cn("min-h-screen", active === "accounting" && "finance-shell")}
    >
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[17.5rem] flex-col border-e border-border/50 bg-sidebar/65 px-5 py-6 backdrop-blur-2xl lg:flex">
        <SidebarBody active={active} />
      </aside>

      <div className="lg:ps-[17.5rem]">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <div
            className={cn(
              "mx-auto flex w-full items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8",
              active === "accounting" ? "max-w-[1480px]" : "max-w-6xl",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="باز کردن منو"
              onClick={() => setMobileOpen(true)}
              className="clay-sm size-11 rounded-2xl text-foreground/70 hover:text-primary lg:hidden"
            >
              <Menu className="size-5" />
            </Button>

            <Link
              to="/dashboard"
              className="lg:hidden"
              aria-label="کافی‌نت‌یار"
            >
              <LogoMark size="sm" className="sm:hidden" />
              <Logo size="sm" showTagline={false} className="hidden sm:flex" />
            </Link>

            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] font-medium text-muted-foreground">
                {SECTION_TITLES[active].eyebrow}
              </p>
              <p className="truncate text-sm font-bold text-foreground">
                {SECTION_TITLES[active].title}
              </p>
            </div>

            <div className="me-auto" />

            <NotificationsMenu />
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:px-8",
            active === "accounting" ? "max-w-[1480px]" : "max-w-6xl",
          )}
        >
          {context?.platform.maintenanceMode && (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3 text-[11px] leading-5 text-foreground/80">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                {context.platform.maintenanceMessage ??
                  "سامانه در حال به‌روزرسانی است؛ برخی بخش‌ها ممکن است موقتاً محدود باشند."}
              </p>
            </div>
          )}
          {context?.cafe?.status === "suspended" && (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-800 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                حساب این کافی‌نت توسط مدیر اصلی سایت غیرفعال شده است. مشاهده
                اطلاعات ممکن است، اما تغییرات و افزودن کارمند مسدود است.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>

      <OnboardingDialog />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className={cn(
            "w-[19rem] border-none bg-sidebar p-0 sm:max-w-[19rem]",
            active === "accounting" && "finance-shell fin-mobile-shell",
          )}
        >
          <SheetTitle className="sr-only">منوی کافی‌نت‌یار</SheetTitle>
          <SheetDescription className="sr-only">
            دسترسی به بخش‌های پنل کافی‌نت‌یار
          </SheetDescription>
          <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-14">
            <SidebarBody
              active={active}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarBody({
  active,
  onNavigate,
}: {
  active: SectionKey;
  onNavigate?: () => void;
}) {
  const { context } = useSession();
  const permissions = context?.permissions ?? [];
  const isOwner = context?.isOwner ?? false;
  const isGuest = context?.isGuest ?? false;
  const isSiteAdmin = context?.isSiteAdmin ?? false;

  const workspaceItems = WORKSPACE_NAV.filter((item) => {
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  });

  const managementItems = MANAGEMENT_NAV.filter((item) => {
    if (isGuest) return false;
    if (item.ownerOnly && !isOwner) return false;
    if (item.permission && !permissions.includes(item.permission)) return false;
    return true;
  });

  const subscription = context?.subscription;

  return (
    <>
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="mb-6 inline-flex w-fit rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Logo />
      </Link>

      <div className="clay-inset rounded-[26px] p-2">
        <p className="px-3 pb-2 pt-2 text-[11px] font-semibold text-muted-foreground">
          فضای کاری
        </p>
        <nav className="flex flex-col gap-1.5">
          {workspaceItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;

            if (!item.href) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate?.();
                    notifySoon(item.label);
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="flex-1 text-start">{item.label}</span>
                  <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.badge ?? "به‌زودی"}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "clay-sm font-bold text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 text-start">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronLeft className="size-4 shrink-0" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {managementItems.length > 0 && (
        <div className="clay-inset mt-3 rounded-[26px] p-2">
          <p className="px-3 pb-2 pt-2 text-[11px] font-semibold text-muted-foreground">
            مدیریت کافی‌نت
          </p>
          <nav className="flex flex-col gap-1.5">
            {managementItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  to={item.href!}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "clay-sm font-bold text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="flex-1 text-start">{item.label}</span>
                  {isActive && <ChevronLeft className="size-4 shrink-0" />}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {(isSiteAdmin || import.meta.env.VITE_SITE_ADMIN === "true") && (
        <Link
          to="/manage"
          onClick={onNavigate}
          className="clay-sm mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12px] font-bold text-primary"
        >
          <ShieldCheck className="size-4" />
          پنل مدیر اصلی سایت
          <ChevronLeft className="ms-auto size-3.5" />
        </Link>
      )}

      <div className="mt-auto space-y-4 pt-6">
        <div className="clay rounded-[26px] p-4">
          <div className="flex items-center gap-2">
            <span className="tile-navy grid size-8 place-items-center rounded-[10px]">
              <Sparkles className="size-4" />
            </span>
            <p className="text-sm font-bold">اشتراک کافی‌نت</p>
          </div>

          {subscription ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-medium"
                >
                  {SUBSCRIPTION_LABELS[subscription.status] ??
                    subscription.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {subscription.planName}
                </span>
              </div>
              <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">
                {subscription.status === "expired"
                  ? "اشتراک منقضی شده است."
                  : `تا ${faDateLong(subscription.endsAt)}`}
              </p>
              {isOwner && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 w-full justify-between rounded-xl px-2 text-xs text-primary hover:bg-primary/10"
                >
                  <Link to="/dashboard/subscription" onClick={onNavigate}>
                    مشاهده اشتراک
                    <ChevronLeft className="size-3.5" />
                  </Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <Badge
                variant="secondary"
                className="mt-3 rounded-full text-[10px] font-medium"
              >
                بدون اشتراک
              </Badge>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                برای مشاهده جزئیات، پنل مدیر اصلی را بررسی کنید.
              </p>
            </>
          )}
        </div>
        <p className="px-2 text-[10px] leading-4 text-muted-foreground/80">
          کافی‌نت‌یار · نسخه ۳٫۱ · دفتر مالی، پشتیبانی و مدیریت پلتفرم
        </p>
      </div>
    </>
  );
}

type NotificationFeedItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  tone: "info" | "success" | "warning" | "critical";
  href: string | null;
  isRead: boolean;
  source: "platform" | "account";
};

function NotificationsMenu() {
  const { context } = useSession();
  const targeted = useQuery(api.notifications.myNotifications, {});
  const markAllRead = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();
  const platformNotifications = context?.notifications ?? [];
  const targetedItems = targeted?.items ?? [];
  const feed: NotificationFeedItem[] = [
    ...platformNotifications.map((item) => ({
      id: `platform-${item.id}`,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      tone: item.tone,
      href: null,
      isRead: false,
      source: "platform" as const,
    })),
    ...targetedItems.map((item) => ({
      id: `account-${item.id}`,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      tone: "info" as const,
      href: item.href,
      isRead: item.isRead,
      source: "account" as const,
    })),
  ].sort((first, second) => second.createdAt - first.createdAt);
  const unread = platformNotifications.length + (targeted?.unread ?? 0);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && (targeted?.unread ?? 0) > 0) {
          void markAllRead({}).catch(() => undefined);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="اعلان‌ها"
          className="clay-sm clay-lift relative grid size-11 shrink-0 place-items-center rounded-2xl text-foreground/70 hover:text-primary"
        >
          <Bell className="size-[19px]" />
          {unread > 0 && (
            <span className="absolute end-3 top-2.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(23rem,calc(100vw-1.5rem))] rounded-[24px] border-border/60 bg-popover p-2 shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-2 py-2">
          <span className="text-sm font-bold">اعلان‌ها و رویدادها</span>
          <Badge
            variant="secondary"
            className="rounded-full text-[10px] font-medium"
          >
            {feed.length.toLocaleString("fa-IR")} مورد
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[22rem] overflow-y-auto">
          {feed.length === 0 ? (
            <DropdownMenuItem
              disabled
              className="justify-center rounded-2xl py-4 text-[11px] text-muted-foreground"
            >
              اعلان فعالی وجود ندارد.
            </DropdownMenuItem>
          ) : (
            feed.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => {
                  if (item.href) navigate(item.href);
                }}
                className={cn(
                  "items-start gap-3 rounded-2xl px-2 py-2.5",
                  item.href && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    item.tone === "critical" || item.tone === "warning"
                      ? "bg-amber-500"
                      : item.tone === "success"
                        ? "bg-emerald-500"
                        : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold leading-5">
                      {item.title}
                    </p>
                    {item.source === "account" && !item.isRead && (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-5 text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground/80">
                    {faDateLong(item.createdAt)}
                    {item.href && <span>· برای مشاهده کلیک کنید</span>}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { context } = useSession();
  const navigate = useNavigate();

  const displayName =
    context?.user.name?.trim() ||
    user?.name?.trim() ||
    (context?.isGuest || user?.isAnonymous ? "کاربر مهمان" : "همکار کافی‌نت");
  const initial = displayName.trim().charAt(0) || "ک";
  const roleLabel = context?.isSiteAdmin
    ? "مدیر اصلی سایت"
    : context?.isGuest
      ? "نشست مهمان"
      : context?.isOwner
        ? "صاحب کافی‌نت"
        : context?.membership?.role === "employee"
          ? "کارمند کافی‌نت"
          : "بدون نقش فعال";
  const canSeeEmployees =
    context?.permissions.includes(PERMISSIONS.EMPLOYEES_MANAGE) ?? false;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="حساب کاربری"
          className="clay-sm clay-lift flex items-center gap-2 rounded-2xl p-1.5 pe-2.5"
        >
          <Avatar className="size-8 rounded-[10px]">
            {user?.image && <AvatarImage src={user.image} alt={displayName} />}
            <AvatarFallback className="rounded-[10px] bg-primary/10 text-xs font-bold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-semibold sm:block">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-[22px] border-border/60 bg-popover p-2 shadow-xl"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <p className="text-sm font-bold">{displayName}</p>
          <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
            {roleLabel}
            {context?.user.phone ? (
              <span dir="ltr" className="ms-1 inline-block">
                · {context.user.phone}
              </span>
            ) : null}
          </p>
          {context?.cafe && (
            <p className="mt-0.5 truncate text-[10px] font-normal text-muted-foreground">
              {context.cafe.name} · {context.cafe.city}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl py-2">
          <Link to="/dashboard/account">
            <UserRound className="size-4" />
            حساب کاربری و امنیت
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl py-2">
          <Link to="/help">
            <BookOpen className="size-4" />
            راهنمای شروع و پرسش‌ها
          </Link>
        </DropdownMenuItem>
        {canSeeEmployees && (
          <DropdownMenuItem asChild className="rounded-xl py-2">
            <Link to="/dashboard/employees">
              <Wallet className="size-4" />
              کارمندان و دسترسی
            </Link>
          </DropdownMenuItem>
        )}
        {context?.isSiteAdmin && (
          <DropdownMenuItem asChild className="rounded-xl py-2">
            <Link to="/admin">
              <ShieldCheck className="size-4" />
              پنل مدیر اصلی سایت
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={handleSignOut}
          className="rounded-xl py-2"
        >
          <LogOut className="size-4" />
          خروج از حساب
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
