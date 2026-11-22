import { AdminShell } from "@/components/layout/AdminShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateTime, faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "@/backend/client";
import {
  Archive,
  Banknote,
  Briefcase,
  Car,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flag,
  Globe2,
  GraduationCap,
  Home,
  Landmark,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  useDeferredValue,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

type AdminTab = "websites" | "categories" | "suggestions" | "reports";
type Verification = "verified" | "needs_review";
type WebsiteRow = {
  id: Id<"websites">;
  name: string;
  description: string;
  url: string;
  logoUrl: string | null;
  categoryId: Id<"website_categories">;
  categoryName: string;
  categoryTone: string;
  sourceName: string;
  sourceUrl: string | null;
  verificationStatus: Verification;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  visitCount: number;
  lastCheckedAt: number | null;
  lastCheckStatus: "ok" | "error" | "unchecked";
  createdAt: number;
  updatedAt: number;
  reportCount: number;
  favoriteCount: number;
};
type CategoryRow = {
  id: Id<"website_categories">;
  name: string;
  description: string | null;
  icon: string;
  tone: string;
  sortOrder: number;
  isActive: boolean;
  websiteCount: number;
  activeCount: number;
};
type SuggestionRow = {
  id: Id<"website_suggestions">;
  name: string;
  description: string;
  url: string;
  categoryId: Id<"website_categories">;
  categoryName: string;
  sourceName: string;
  sourceUrl: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdByName: string;
  createdAt: number;
  reviewedAt: number | null;
};
type ReportRow = {
  id: Id<"website_reports">;
  websiteName: string;
  websiteUrl: string | null;
  reason: string;
  note: string | null;
  status: "open" | "resolved";
  createdByName: string;
  createdAt: number;
  resolvedAt: number | null;
};

const ICONS: { value: string; label: string; icon: typeof Globe2 }[] = [
  { value: "landmark", label: "ساختمان دولتی", icon: Landmark },
  { value: "scale", label: "عدالت", icon: Scale },
  { value: "banknote", label: "بانک", icon: Banknote },
  { value: "clipboard", label: "آزمون", icon: ClipboardList },
  { value: "graduation", label: "دانشگاه", icon: GraduationCap },
  { value: "briefcase", label: "استخدام", icon: Briefcase },
  { value: "car", label: "خودرو", icon: Car },
  { value: "shield", label: "بیمه", icon: Shield },
  { value: "receipt", label: "مالیات", icon: ReceiptText },
  { value: "wifi", label: "مخابرات", icon: Wifi },
  { value: "home", label: "مسکن", icon: Home },
  { value: "grid", label: "سایر", icon: LayoutGrid },
];

const TONES = [
  { value: "navy", label: "سرمه‌ای", className: "tile-navy" },
  { value: "mint", label: "سبزآبی", className: "tile-mint" },
  { value: "peach", label: "هلویی", className: "tile-peach" },
  { value: "lilac", label: "بنفش", className: "tile-lilac" },
];

const EMPTY_WEBSITE = {
  name: "",
  description: "",
  url: "",
  logoUrl: "",
  categoryId: "",
  sourceName: "",
  sourceUrl: "",
  verificationStatus: "verified" as Verification,
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
};

function categoryIcon(icon: string) {
  return ICONS.find((item) => item.value === icon)?.icon ?? Globe2;
}

function ReportReason({ reason }: { reason: string }) {
  const labels: Record<string, string> = {
    not_working: "سامانه باز نمی‌شود",
    wrong_address: "آدرس اشتباه",
    unsafe: "محتوای ناامن",
    other: "مورد دیگر",
  };
  return <>{labels[reason] ?? reason}</>;
}

export default function AdminSites() {
  const { context, isLoading } = useSession();
  const isAdmin = context?.isSiteAdmin === true;
  const overview = useQuery(api.websitesAdmin.overview, isAdmin ? {} : "skip");
  const categoriesQuery = useQuery(
    api.websitesAdmin.categories,
    isAdmin ? {} : "skip",
  );
  const categories = (categoriesQuery ?? []) as CategoryRow[];

  const [tab, setTab] = useState<AdminTab>("websites");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suggestionFilter, setSuggestionFilter] = useState("pending");
  const [reportFilter, setReportFilter] = useState("open");

  const sitesQuery = useQuery(
    api.websitesAdmin.listWebsites,
    isAdmin && tab === "websites"
      ? {
          search: deferredSearch || undefined,
          categoryId:
            categoryFilter === "all"
              ? undefined
              : (categoryFilter as Id<"website_categories">),
          status: statusFilter as
            | "all"
            | "active"
            | "inactive"
            | "needs_review",
        }
      : "skip",
  );
  const suggestionsQuery = useQuery(
    api.websitesAdmin.suggestions,
    isAdmin && tab === "suggestions"
      ? suggestionFilter === "all"
        ? {}
        : {
            status: suggestionFilter as
              | "pending"
              | "approved"
              | "rejected",
          }
      : "skip",
  );
  const reportsQuery = useQuery(
    api.websitesAdmin.reports,
    isAdmin && tab === "reports"
      ? reportFilter === "all"
        ? {}
        : { status: reportFilter as "open" | "resolved" }
      : "skip",
  );

  const createWebsite = useMutation(api.websitesAdmin.createWebsite);
  const updateWebsite = useMutation(api.websitesAdmin.updateWebsite);
  const setWebsiteActive = useMutation(api.websitesAdmin.setWebsiteActive);
  const deleteWebsite = useMutation(api.websitesAdmin.deleteWebsite);
  const seedCatalog = useMutation(api.websitesAdmin.seedCatalog);
  const createCategory = useMutation(api.websitesAdmin.createCategory);
  const updateCategory = useMutation(api.websitesAdmin.updateCategory);
  const deleteCategory = useMutation(api.websitesAdmin.deleteCategory);
  const approveSuggestion = useMutation(api.websitesAdmin.approveSuggestion);
  const rejectSuggestion = useMutation(api.websitesAdmin.rejectSuggestion);
  const resolveReport = useMutation(api.websitesAdmin.resolveReport);
  const checkWebsite = useAction(api.websiteCheck.checkWebsite);

  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<WebsiteRow | null>(null);
  const [websiteForm, setWebsiteForm] = useState(EMPTY_WEBSITE);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmSite, setConfirmSite] = useState<WebsiteRow | null>(null);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "grid",
    tone: "navy",
    isActive: true,
  });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [confirmCategory, setConfirmCategory] = useState<CategoryRow | null>(
    null,
  );

  if (isLoading) {
    return (
      <AdminShell active="sites">
        <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) return <Navigate to="/admin" replace />;

  const openCreateSite = () => {
    setEditingSite(null);
    setWebsiteForm({
      ...EMPTY_WEBSITE,
      categoryId: categories[0]?.id ?? "",
      sortOrder: overview?.websites.total ?? 0,
    });
    setWebsiteError(null);
    setWebsiteOpen(true);
  };

  const openEditSite = (site: WebsiteRow) => {
    setEditingSite(site);
    setWebsiteForm({
      name: site.name,
      description: site.description,
      url: site.url,
      logoUrl: site.logoUrl ?? "",
      categoryId: site.categoryId,
      sourceName: site.sourceName,
      sourceUrl: site.sourceUrl ?? "",
      verificationStatus: site.verificationStatus,
      isActive: site.isActive,
      isFeatured: site.isFeatured,
      sortOrder: site.sortOrder,
    });
    setWebsiteError(null);
    setWebsiteOpen(true);
  };

  const submitWebsite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!websiteForm.categoryId) {
      setWebsiteError("دسته‌بندی را انتخاب کنید.");
      return;
    }
    setSavingWebsite(true);
    setWebsiteError(null);
    try {
      const payload = {
        name: websiteForm.name,
        description: websiteForm.description,
        url: websiteForm.url,
        logoUrl: websiteForm.logoUrl || undefined,
        categoryId: websiteForm.categoryId as Id<"website_categories">,
        sourceName: websiteForm.sourceName,
        sourceUrl: websiteForm.sourceUrl || undefined,
        verificationStatus: websiteForm.verificationStatus,
        isActive: websiteForm.isActive,
        isFeatured: websiteForm.isFeatured,
        sortOrder: websiteForm.sortOrder,
      };
      if (editingSite) {
        await updateWebsite({ ...payload, websiteId: editingSite.id });
      } else {
        await createWebsite(payload);
      }
      setWebsiteOpen(false);
      toast.success(
        editingSite ? "سامانه به‌روزرسانی شد." : "سامانه جدید ثبت شد.",
      );
    } catch (error) {
      setWebsiteError(errorMessage(error, "ذخیره سامانه ممکن نشد."));
    } finally {
      setSavingWebsite(false);
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      icon: "grid",
      tone: "navy",
      isActive: true,
    });
    setCategoryError(null);
    setCategoryOpen(true);
  };

  const openEditCategory = (category: CategoryRow) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      icon: category.icon,
      tone: category.tone,
      isActive: category.isActive,
    });
    setCategoryError(null);
    setCategoryOpen(true);
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryError(null);
    try {
      if (editingCategory) {
        await updateCategory({
          categoryId: editingCategory.id,
          name: categoryForm.name,
          description: categoryForm.description || undefined,
          icon: categoryForm.icon,
          tone: categoryForm.tone,
          isActive: categoryForm.isActive,
        });
      } else {
        await createCategory({
          name: categoryForm.name,
          description: categoryForm.description || undefined,
          icon: categoryForm.icon,
          tone: categoryForm.tone,
        });
      }
      setCategoryOpen(false);
      toast.success("دسته‌بندی ذخیره شد.");
    } catch (error) {
      setCategoryError(errorMessage(error, "ذخیره دسته‌بندی ممکن نشد."));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSeed = async () => {
    setBusyId("seed");
    try {
      const result = await seedCatalog();
      toast.success(
        `${faNumber(result.categoriesCreated)} دسته و ${faNumber(
          result.websitesCreated,
        )} سامانه اضافه شد.`,
      );
    } catch (error) {
      toast.error(errorMessage(error, "درج فهرست رسمی ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const handleCheck = async (site: WebsiteRow) => {
    setBusyId(site.id);
    try {
      const result = await checkWebsite({ websiteId: site.id });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(errorMessage(error, "بررسی لینک ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const handleApproval = async (id: Id<"website_suggestions">, approve: boolean) => {
    setBusyId(id);
    try {
      if (approve) await approveSuggestion({ suggestionId: id });
      else await rejectSuggestion({ suggestionId: id });
      toast.success(approve ? "پیشنهاد تأیید و منتشر شد." : "پیشنهاد رد شد.");
    } catch (error) {
      toast.error(errorMessage(error, "بررسی پیشنهاد ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: AdminTab; label: string; count?: number }[] = [
    { key: "websites", label: "سامانه‌ها", count: overview?.websites.total },
    { key: "categories", label: "دسته‌بندی‌ها", count: overview?.categories.total },
    { key: "suggestions", label: "پیشنهادها", count: overview?.suggestions },
    { key: "reports", label: "گزارش خرابی", count: overview?.reports },
  ];

  return (
    <AdminShell active="sites">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[30px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] text-muted-foreground">
                <Globe2 className="size-3.5" />
                بانک جامع سامانه‌های کاربردی
              </span>
              <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
                مدیریت سایت‌ها و سامانه‌ها
              </h1>
              <p className="mt-2 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
                ثبت، تأیید منبع، دسته‌بندی و انتشار سامانه‌های رسمی؛ بررسی
                پیشنهاد کاربران و رسیدگی به گزارش‌های خرابی.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSeed}
                disabled={busyId === "seed"}
                className="h-10 rounded-xl text-[11px] font-semibold"
              >
                {busyId === "seed" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                درج فهرست رسمی
              </Button>
              <Button
                type="button"
                onClick={openCreateSite}
                className="clay-primary h-10 rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
              >
                <Plus className="size-4" />
                سامانه جدید
              </Button>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <Stat label="کل سامانه‌ها" value={overview?.websites.total ?? 0} />
            <Stat label="فعال" value={overview?.websites.active ?? 0} />
            <Stat
              label="نیازمند بررسی"
              value={overview?.websites.needsReview ?? 0}
            />
            <Stat label="پیشنهاد باز" value={overview?.suggestions ?? 0} />
            <Stat label="گزارش باز" value={overview?.reports ?? 0} />
          </div>
        </section>

        <div className="flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors",
                tab === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span className="rounded-full bg-black/10 px-1.5 text-[9px]">
                  {faNumber(item.count)}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "websites" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="جستجوی نام، آدرس یا منبع…"
                  className="h-10 ps-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه دسته‌ها</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                  <SelectItem value="needs_review">نیازمند بررسی</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 space-y-2">
              {(sitesQuery?.items ?? []).map((site) => (
                <div
                  key={site.id}
                  className="clay-inset rounded-[20px] p-3.5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <span className="tile-navy grid size-10 shrink-0 place-items-center rounded-xl">
                        <Globe2 className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12.5px] font-extrabold">{site.name}</p>
                          <Badge variant="secondary" className="rounded-full text-[9px]">
                            {site.categoryName}
                          </Badge>
                          {site.isFeatured && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-bold text-primary">
                              پیشنهادی
                            </span>
                          )}
                          {site.verificationStatus === "needs_review" ? (
                            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-700 dark:text-amber-300">
                              نیازمند بررسی
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-700 dark:text-emerald-300">
                              تأییدشده
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                          {site.description}
                        </p>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-primary hover:underline"
                          dir="ltr"
                        >
                          {site.url}
                          <ExternalLink className="size-2.5" />
                        </a>
                        <p className="mt-1 text-[9px] text-muted-foreground/80">
                          منبع: {site.sourceName} · {faNumber(site.visitCount)} بازدید ·{" "}
                          {site.reportCount > 0
                            ? `${faNumber(site.reportCount)} گزارش باز`
                            : "بدون گزارش"}
                          {site.lastCheckedAt
                            ? ` · آخرین بررسی ${faDateTime(site.lastCheckedAt)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Badge
                        variant={site.isActive ? "default" : "secondary"}
                        className="rounded-full text-[9px]"
                      >
                        {site.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="بررسی لینک"
                        disabled={busyId === site.id}
                        onClick={() => handleCheck(site)}
                        className="size-8 rounded-lg"
                      >
                        {busyId === site.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="ویرایش"
                        onClick={() => openEditSite(site)}
                        className="size-8 rounded-lg"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={site.isActive ? "غیرفعال کردن" : "فعال کردن"}
                        onClick={async () => {
                          setBusyId(site.id);
                          try {
                            await setWebsiteActive({
                              websiteId: site.id,
                              isActive: !site.isActive,
                            });
                            toast.success("وضعیت انتشار تغییر کرد.");
                          } catch (error) {
                            toast.error(
                              errorMessage(error, "تغییر وضعیت ممکن نشد."),
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="size-8 rounded-lg"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="بایگانی"
                        onClick={() => setConfirmSite(site)}
                        className="size-8 rounded-lg text-muted-foreground"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {sitesQuery && sitesQuery.items.length === 0 && (
                <Empty text="سامانه‌ای با این فیلتر پیدا نشد." />
              )}
            </div>
          </section>
        )}

        {tab === "categories" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">دسته‌بندی سامانه‌ها</h2>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  دسته‌های فعال در صفحه کاربران نمایش داده می‌شوند.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openCreateCategory} className="rounded-xl">
                <Plus className="size-3.5" />
                دسته جدید
              </Button>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {categories.map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <div key={category.id} className="clay-inset rounded-[20px] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="tile-mint grid size-9 shrink-0 place-items-center rounded-xl">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-extrabold">{category.name}</p>
                          {!category.isActive && (
                            <Badge variant="secondary" className="text-[8.5px]">
                              غیرفعال
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                          {category.description ?? "بدون توضیح"}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground/80">
                          {faNumber(category.websiteCount)} سامانه ·{" "}
                          {faNumber(category.activeCount)} فعال
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEditCategory(category)} className="h-8 rounded-lg text-[10px]">
                        <Pencil className="size-3" />
                        ویرایش
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmCategory(category)} className="h-8 rounded-lg text-[10px] text-destructive">
                        <Trash2 className="size-3" />
                        حذف
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "suggestions" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">پیشنهاد کاربران</h2>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  هر پیشنهاد پس از تأیید شما به بانک سامانه‌ها اضافه می‌شود.
                </p>
              </div>
              <Select value={suggestionFilter} onValueChange={setSuggestionFilter}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">در انتظار بررسی</SelectItem>
                  <SelectItem value="approved">تأییدشده</SelectItem>
                  <SelectItem value="rejected">ردشده</SelectItem>
                  <SelectItem value="all">همه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 space-y-2.5">
              {((suggestionsQuery ?? []) as SuggestionRow[]).map((item) => (
                <div key={item.id} className="clay-inset rounded-[20px] p-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[12px] font-extrabold">{item.name}</p>
                        <Badge variant="secondary" className="rounded-full text-[9px]">
                          {item.categoryName}
                        </Badge>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[8.5px] font-bold",
                          item.status === "pending" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          item.status === "approved" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                          item.status === "rejected" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                        )}>
                          {item.status === "pending" ? "در انتظار" : item.status === "approved" ? "تأییدشده" : "ردشده"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10.5px] text-muted-foreground">{item.description}</p>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-primary hover:underline" dir="ltr">
                        {item.url}
                        <ExternalLink className="size-2.5" />
                      </a>
                      <p className="mt-1 text-[9px] text-muted-foreground/80">
                        پیشنهاد {item.createdByName} · منبع: {item.sourceName}
                      </p>
                    </div>
                    {item.status === "pending" && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button type="button" size="sm" disabled={busyId === item.id} onClick={() => handleApproval(item.id, true)} className="h-8 rounded-lg text-[10px]">
                          <CheckCircle2 className="size-3" />
                          تأیید
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={busyId === item.id} onClick={() => handleApproval(item.id, false)} className="h-8 rounded-lg text-[10px] text-destructive">
                          <XCircle className="size-3" />
                          رد
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {suggestionsQuery && suggestionsQuery.length === 0 && (
                <Empty text="پیشنهادی در این وضعیت وجود ندارد." />
              )}
            </div>
          </section>
        )}

        {tab === "reports" && (
          <section className="clay rounded-[28px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">گزارش‌های خرابی لینک</h2>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  گزارش کاربران را بررسی و پس از اصلاح، بسته کنید.
                </p>
              </div>
              <Select value={reportFilter} onValueChange={setReportFilter}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">باز</SelectItem>
                  <SelectItem value="resolved">رسیدگی‌شده</SelectItem>
                  <SelectItem value="all">همه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 space-y-2">
              {((reportsQuery ?? []) as ReportRow[]).map((report) => (
                <div key={report.id} className="clay-inset flex flex-col gap-2 rounded-[18px] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Flag className="size-3.5 text-destructive" />
                      <p className="text-[11.5px] font-bold">{report.websiteName}</p>
                      <Badge variant="secondary" className="text-[8.5px]">
                        <ReportReason reason={report.reason} />
                      </Badge>
                    </div>
                    {report.note && <p className="mt-1 text-[10px] text-muted-foreground">{report.note}</p>}
                    <p className="mt-1 text-[9px] text-muted-foreground/80">
                      {report.createdByName} · {faDateTime(report.createdAt)}
                      {report.resolvedAt ? ` · بسته‌شده ${faDateTime(report.resolvedAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={report.status === "open" ? "default" : "outline"}
                    onClick={async () => {
                      setBusyId(report.id);
                      try {
                        await resolveReport({ reportId: report.id });
                        toast.success("وضعیت گزارش تغییر کرد.");
                      } catch (error) {
                        toast.error(errorMessage(error, "تغییر وضعیت ممکن نشد."));
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    disabled={busyId === report.id}
                    className="h-8 shrink-0 rounded-lg text-[10px]"
                  >
                    {report.status === "open" ? "بستن گزارش" : "بازکردن"}
                  </Button>
                </div>
              ))}
              {reportsQuery && reportsQuery.length === 0 && (
                <Empty text="گزارشی در این وضعیت وجود ندارد." />
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={websiteOpen} onOpenChange={setWebsiteOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {editingSite ? "ویرایش سامانه" : "ثبت سامانه جدید"}
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              آدرس باید عمومی و متعلق به منبع رسمی باشد. سامانه تأییدنشده قابل انتشار نیست.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitWebsite} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام سامانه">
                <Input value={websiteForm.name} onChange={(e) => setWebsiteForm({ ...websiteForm, name: e.target.value })} required minLength={3} maxLength={120} />
              </Field>
              <Field label="دسته‌بندی">
                <Select value={websiteForm.categoryId} onValueChange={(value) => setWebsiteForm({ ...websiteForm, categoryId: value })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="آدرس سامانه">
              <Input value={websiteForm.url} onChange={(e) => setWebsiteForm({ ...websiteForm, url: e.target.value })} placeholder="https://…" dir="ltr" className="text-left" required />
            </Field>
            <Field label="آدرس لوگو (اختیاری)">
              <Input value={websiteForm.logoUrl} onChange={(e) => setWebsiteForm({ ...websiteForm, logoUrl: e.target.value })} placeholder="https://…/logo.png" dir="ltr" className="text-left" />
            </Field>
            <Field label="توضیح کوتاه">
              <Textarea value={websiteForm.description} onChange={(e) => setWebsiteForm({ ...websiteForm, description: e.target.value })} rows={2} required minLength={10} maxLength={300} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام منبع رسمی">
                <Input value={websiteForm.sourceName} onChange={(e) => setWebsiteForm({ ...websiteForm, sourceName: e.target.value })} required minLength={2} maxLength={140} />
              </Field>
              <Field label="لینک منبع (اختیاری)">
                <Input value={websiteForm.sourceUrl} onChange={(e) => setWebsiteForm({ ...websiteForm, sourceUrl: e.target.value })} dir="ltr" className="text-left" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="وضعیت تأیید">
                <Select value={websiteForm.verificationStatus} onValueChange={(value) => setWebsiteForm({ ...websiteForm, verificationStatus: value as Verification })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">تأییدشده</SelectItem>
                    <SelectItem value="needs_review">نیازمند بررسی</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ترتیب نمایش">
                <Input type="number" min={0} value={websiteForm.sortOrder} onChange={(e) => setWebsiteForm({ ...websiteForm, sortOrder: Number(e.target.value) || 0 })} dir="ltr" className="text-left" />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[11px] font-semibold">
                انتشار برای کاربران
                <Switch checked={websiteForm.isActive} onCheckedChange={(checked) => setWebsiteForm({ ...websiteForm, isActive: checked })} />
              </label>
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[11px] font-semibold">
                نمایش در پیشنهادی‌ها
                <Switch checked={websiteForm.isFeatured} onCheckedChange={(checked) => setWebsiteForm({ ...websiteForm, isFeatured: checked })} />
              </label>
            </div>
            {websiteError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] leading-5 text-destructive">{websiteError}</p>}
            <Button type="submit" disabled={savingWebsite} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">
              {savingWebsite ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {editingSite ? "ذخیره تغییرات" : "ثبت سامانه"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">{editingCategory ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCategory} className="space-y-3">
            <Field label="نام دسته">
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required minLength={2} maxLength={80} />
            </Field>
            <Field label="توضیح (اختیاری)">
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} maxLength={200} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="آیکون">
                <Select value={categoryForm.icon} onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="رنگ">
                <Select value={categoryForm.tone} onValueChange={(value) => setCategoryForm({ ...categoryForm, tone: value })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {editingCategory && (
              <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-[11px] font-semibold">
                دسته فعال باشد
                <Switch checked={categoryForm.isActive} onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isActive: checked })} />
              </label>
            )}
            {categoryError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] text-destructive">{categoryError}</p>}
            <Button type="submit" disabled={savingCategory} className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105">
              {savingCategory ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              ذخیره دسته‌بندی
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSite !== null} onOpenChange={(open) => !open && setConfirmSite(null)}>
        <AlertDialogContent className="rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>بایگانی سامانه؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              «{confirmSite?.name}» از فهرست عمومی خارج می‌شود، اما علاقه‌مندی‌ها، بازدیدها و گزارش‌های مرتبط حفظ می‌شوند. امکان فعال‌سازی دوباره وجود دارد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmSite) return;
                try {
                  await deleteWebsite({ websiteId: confirmSite.id });
                  toast.success("سامانه بایگانی و غیرفعال شد.");
                  setConfirmSite(null);
                } catch (error) {
                  toast.error(errorMessage(error, "بایگانی سامانه ممکن نشد."));
                }
              }}
            >
              <Archive className="size-4" />
              بایگانی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCategory !== null} onOpenChange={(open) => !open && setConfirmCategory(null)}>
        <AlertDialogContent className="rounded-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دسته‌بندی؟</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              دسته «{confirmCategory?.name}» فقط وقتی حذف می‌شود که سامانه یا پیشنهاد وابسته نداشته باشد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmCategory) return;
                try {
                  await deleteCategory({ categoryId: confirmCategory.id });
                  toast.success("دسته‌بندی حذف شد.");
                  setConfirmCategory(null);
                } catch (error) {
                  toast.error(errorMessage(error, "حذف دسته‌بندی ممکن نشد."));
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="clay-inset rounded-2xl p-3">
      <p className="text-lg font-extrabold leading-6">{faNumber(value)}</p>
      <p className="text-[9.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-6 text-center text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}
