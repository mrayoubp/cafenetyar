import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/backend/api";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from "@/backend/adminPermissions";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useMutation } from "@/backend/client";
import {
  ArrowLeft,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  Crown,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

export type AdminSection =
  | "super"
  | "platform"
  | "cafes"
  | "users"
  | "roles"
  | "news"
  | "sites"
  | "agent"
  | "billing"
  | "support"
  | "notifications"
  | "audit"
  | "health"
  | "settings"
  | "site";

type AdminNavItem = {
  key: AdminSection;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: AdminPermission;
  ownerOnly?: boolean;
  group: "overview" | "management" | "system";
};

const NAV_ITEMS: AdminNavItem[] = [
  {
    key: "super",
    label: "کنسول مالک",
    href: "/super-admin",
    icon: Crown,
    ownerOnly: true,
    group: "overview",
  },
  {
    key: "platform",
    label: "داشبورد",
    href: "/admin",
    icon: LayoutDashboard,
    permission: ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    group: "overview",
  },
  {
    key: "cafes",
    label: "کافی‌نت‌ها",
    href: "/admin/cafes",
    icon: Building2,
    permission: ADMIN_PERMISSIONS.CAFES_VIEW,
    group: "management",
  },
  {
    key: "users",
    label: "کاربران",
    href: "/admin/users",
    icon: Users,
    permission: ADMIN_PERMISSIONS.USERS_VIEW,
    group: "management",
  },
  {
    key: "support",
    label: "پشتیبانی",
    href: "/admin/support",
    icon: LifeBuoy,
    permission: ADMIN_PERMISSIONS.SUPPORT_VIEW,
    group: "management",
  },
  {
    key: "billing",
    label: "مالی و اشتراک",
    href: "/admin/billing",
    icon: CreditCard,
    permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
    group: "management",
  },
  {
    key: "news",
    label: "اخبار و اطلاعیه",
    href: "/admin/news",
    icon: Newspaper,
    permission: ADMIN_PERMISSIONS.CONTENT_MANAGE,
    group: "management",
  },
  {
    key: "sites",
    label: "بانک سامانه‌ها",
    href: "/admin/sites",
    icon: Globe2,
    permission: ADMIN_PERMISSIONS.CONTENT_MANAGE,
    group: "management",
  },
  {
    key: "agent",
    label: "دانش و نرخ‌ها",
    href: "/admin/agent",
    icon: Bot,
    permission: ADMIN_PERMISSIONS.AI_MANAGE,
    group: "management",
  },
  {
    key: "roles",
    label: "نقش‌ها و دسترسی",
    href: "/admin/roles",
    icon: UserCog,
    permission: ADMIN_PERMISSIONS.ROLES_MANAGE,
    group: "system",
  },
  {
    key: "notifications",
    label: "اعلان‌های پلتفرم",
    href: "/admin/notifications",
    icon: Megaphone,
    permission: ADMIN_PERMISSIONS.NOTIFICATIONS_MANAGE,
    group: "management",
  },
  {
    key: "audit",
    label: "گزارش رویدادها",
    href: "/admin/audit",
    icon: ClipboardList,
    permission: ADMIN_PERMISSIONS.AUDIT_VIEW,
    group: "system",
  },
  {
    key: "health",
    label: "سلامت و پایش",
    href: "/admin/health",
    icon: HeartPulse,
    permission: ADMIN_PERMISSIONS.SETTINGS_MANAGE,
    group: "system",
  },
  {
    key: "site",
    label: "مدیریت سایت و ظاهر",
    href: "/admin/site",
    icon: LayoutTemplate,
    ownerOnly: true,
    group: "management",
  },
  {
    key: "settings",
    label: "تنظیمات پلتفرم",
    href: "/admin/settings",
    icon: Settings2,
    permission: ADMIN_PERMISSIONS.SETTINGS_MANAGE,
    group: "system",
  },
];

const GROUP_LABELS: Record<AdminNavItem["group"], string> = {
  overview: "نمای کلی",
  management: "مدیریت عملیاتی",
  system: "امنیت و سامانه",
};

const SECTION_TITLES: Record<AdminSection, string> = {
  super: "مدیریت کل کافی‌نت‌یار",
  platform: "داشبورد مدیریت",
  cafes: "کافی‌نت‌ها",
  users: "کاربران و کارمندان",
  roles: "نقش‌ها و دسترسی‌ها",
  news: "اخبار و اطلاعیه‌ها",
  sites: "بانک سامانه‌ها",
  agent: "دانش، نرخ‌ها و هوش مصنوعی",
  billing: "مالی و اشتراک",
  support: "پشتیبانی",
  notifications: "اعلان‌های پلتفرم",
  audit: "گزارش رویدادها",
  health: "سلامت و پایش سامانه",
  settings: "تنظیمات پلتفرم",
  site: "مدیریت سایت و ظاهر",
};

/** Central admin shell: permission-aware, collapsible and responsive. */
export function AdminShell({
  children,
  active = "platform",
}: {
  children: React.ReactNode;
  active?: AdminSection;
}) {
  const { context } = useSession();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const ensureDefaults = useMutation(api.platformAdmin.ensureDefaults);
  const recordAdminLogout = useMutation(api.superAdmin.recordAdminLogout);

  useEffect(() => {
    if (!context?.isSiteAdmin) return;
    void ensureDefaults({}).catch(() => {
      // The server remains authoritative; seed failures should not blank the UI.
    });
  }, [context?.isSiteAdmin, ensureDefaults]);

  if (context && !context.isSiteAdmin && active !== "platform") {
    return <Navigate to="/admin" replace />;
  }

  const isSuperAdmin = context?.isSuperAdmin ?? false;
  const permissions = context?.adminPermissions ?? [];
  const normalizedQuery = navQuery.trim().toLocaleLowerCase("fa");
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !context?.isPlatformOwner) return false;
    if (
      !isSuperAdmin &&
      item.permission &&
      !permissions.includes(item.permission)
    ) {
      return false;
    }
    if (!normalizedQuery) return true;
    return [item.label, item.href, GROUP_LABELS[item.group]].some((value) =>
      value.toLocaleLowerCase("fa").includes(normalizedQuery),
    );
  });
  const groups: AdminNavItem["group"][] = ["overview", "management", "system"];

  const nav = (onNavigate?: () => void, compact = false) => (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => {
        const items = visibleItems.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            {!compact && (
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wider text-white/35">
                {GROUP_LABELS[group]}
              </p>
            )}
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const selected = active === item.key;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    onClick={onNavigate}
                    title={compact ? item.label : undefined}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-colors",
                      selected
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/60 hover:bg-white/10 hover:text-white",
                      compact && "justify-center px-0",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!compact && <span>{item.label}</span>}
                    {!compact && selected && (
                      <ArrowLeft className="ms-auto size-3.5 text-white/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (compact: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <Link
        to="/admin"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 px-2 pb-6",
          compact && "justify-center px-0",
        )}
      >
        <LogoMark size="sm" />
        {!compact && (
          <div>
            <p className="text-sm font-extrabold leading-5">کافی‌نت‌یار</p>
            <p className="text-[9px] text-white/45">مرکز مدیریت پلتفرم</p>
          </div>
        )}
      </Link>
      <div className="flex-1 overflow-y-auto px-2">
        {!compact && (
          <div className="relative mb-4 px-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <Input
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder="جستجوی بخش‌ها…"
              aria-label="جستجوی سریع بخش‌های مدیریتی"
              className="h-9 rounded-xl border border-white/10 bg-white/5 pe-3 ps-8 text-[10.5px] text-white placeholder:text-white/35 focus-visible:border-white/25 focus-visible:ring-white/10"
            />
          </div>
        )}
        {visibleItems.length === 0 ? (
          <p className="px-3 py-4 text-center text-[10px] leading-5 text-white/45">
            بخشی با این نام پیدا نشد.
          </p>
        ) : (
          nav(onNavigate, compact)
        )}
      </div>
      <div className={cn("mt-4 px-2", compact && "px-0")}>
        {!compact && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-300" />
              <p className="truncate text-[10.5px] font-bold">
                {context?.user.name ?? "مدیر پلتفرم"}
              </p>
            </div>
            <p className="mt-1 text-[9px] text-white/45">
              {isSuperAdmin
                ? "دسترسی کامل مدیر اصلی"
                : `${permissions.length.toLocaleString("fa-IR")} مجوز فعال`}
            </p>
          </div>
        )}
        <div className={cn("flex items-center gap-1", compact && "flex-col")}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="جمع کردن منو"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden size-9 rounded-xl text-white/60 hover:bg-white/10 hover:text-white lg:flex"
          >
            {compact ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="حساب کاربری"
            className="size-9 rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Link to="/dashboard/account">
              <Users className="size-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="خروج"
            onClick={async () => {
              await recordAdminLogout({}).catch(() => undefined);
              await signOut();
              navigate("/");
            }}
            className="size-9 rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,oklch(0.96_0.02_250),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_0%,oklch(0.28_0.04_260),transparent_40%)]">
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 hidden border-e border-white/10 bg-[oklch(0.23_0.045_264)] py-5 text-white transition-[width] duration-300 lg:block",
          collapsed ? "w-[4.5rem] px-2" : "w-[15.5rem] px-4",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "lg:ps-[4.5rem]" : "lg:ps-[15.5rem]",
        )}
      >
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/75 backdrop-blur-xl">
          <div className="flex w-full items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="باز کردن منو"
              onClick={() => setMobileOpen(true)}
              className="size-9 rounded-xl text-muted-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[9.5px] font-medium text-muted-foreground">
                پنل مدیر اصلی کافی‌نت‌یار
              </p>
              <p className="truncate text-sm font-extrabold">
                {SECTION_TITLES[active]}
              </p>
            </div>
            <div className="me-auto" />
            <ThemeToggle />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden h-9 rounded-xl text-[10.5px] text-muted-foreground sm:flex"
            >
              <Link to={context?.cafe ? "/dashboard" : "/"}>
                {context?.cafe ? "پنل کافی‌نت" : "صفحه اصلی"}
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="w-[18rem] border-none bg-[oklch(0.23_0.045_264)] p-0 text-white sm:max-w-[18rem]"
        >
          <SheetTitle className="sr-only">منوی مدیریت پلتفرم</SheetTitle>
          <SheetDescription className="sr-only">
            بخش‌های مجاز پنل مدیریت
          </SheetDescription>
          <div className="h-full overflow-y-auto px-4 py-5">
            {sidebar(false, () => setMobileOpen(false))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
