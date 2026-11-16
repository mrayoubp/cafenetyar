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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/hooks/use-session";
import { errorMessage } from "@/lib/auth";
import { faDateTime, faNumber, faRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  Flame,
  FolderTree,
  Inbox,
  Loader2,
  Lock,
  Newspaper,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useDeferredValue,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

type NewsStatus = "draft" | "pending" | "published" | "rejected" | "archived";
type AdminTab = "news" | "categories" | "sources";

type NewsRow = {
  id: Id<"news">;
  title: string;
  summary: string;
  body: string;
  imageUrl: string | null;
  categoryId: Id<"news_categories">;
  categoryName: string;
  categoryTone: string;
  sourceId: Id<"news_sources"> | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceKind: string | null;
  publishedAt: number;
  isUrgent: boolean;
  isPinned: boolean;
  status: NewsStatus;
  isDemo: boolean;
  externalId: string | null;
  createdAt: number;
  updatedAt: number;
};

type CategoryRow = {
  id: Id<"news_categories">;
  slug: string;
  name: string;
  description: string | null;
  tone: string;
  sortOrder: number;
  isActive: boolean;
  newsCount: number;
};

type SourceRow = {
  id: Id<"news_sources">;
  name: string;
  kind: "rss" | "api" | "manual";
  url: string | null;
  defaultCategoryId: Id<"news_categories"> | null;
  isActive: boolean;
  isDemo: boolean;
  lastFetchedAt: number | null;
  lastError: string | null;
  lastItemCount: number | null;
  pendingCount: number;
  publishedCount: number;
};

type ConfirmTarget = {
  kind: "news" | "category" | "source" | "demo";
  id?: string;
  title: string;
};

const STATUS_LABELS: Record<NewsStatus, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  published: "منتشرشده",
  rejected: "ردشده",
  archived: "بایگانی‌شده",
};

const STATUS_CLASSES: Record<NewsStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  archived: "bg-muted text-muted-foreground",
};

const TONES = [
  { value: "navy", label: "سرمه‌ای", className: "tile-navy" },
  { value: "mint", label: "سبزآبی", className: "tile-mint" },
  { value: "peach", label: "هلویی", className: "tile-peach" },
  { value: "lilac", label: "بنفش", className: "tile-lilac" },
] as const;

function toneClass(tone: string) {
  return TONES.find((item) => item.value === tone)?.className ?? "tile-navy";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalInput(ms: number) {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

const EMPTY_NEWS = {
  title: "",
  summary: "",
  body: "",
  imageUrl: "",
  categoryId: "",
  sourceId: "",
  sourceName: "",
  sourceUrl: "",
  publishedAt: toLocalInput(Date.now()),
  isUrgent: false,
  isPinned: false,
  status: "draft" as NewsStatus,
  isDemo: false,
};

export default function AdminNews() {
  const { context } = useSession();
  const isAdmin = context?.isSiteAdmin === true;

  const overview = useQuery(api.newsAdmin.overview, isAdmin ? {} : "skip");
  const categoryList = useQuery(
    api.newsAdmin.categories,
    isAdmin ? {} : "skip",
  );
  const sourceList = useQuery(api.newsAdmin.sources, isAdmin ? {} : "skip");

  const [tab, setTab] = useState<AdminTab>("news");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"all" | NewsStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const newsList = useQuery(
    api.newsAdmin.list,
    isAdmin
      ? {
          search: deferredSearch.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          categoryId:
            categoryFilter === "all"
              ? undefined
              : (categoryFilter as Id<"news_categories">),
        }
      : "skip",
  );

  const createNews = useMutation(api.newsAdmin.createNews);
  const updateNews = useMutation(api.newsAdmin.updateNews);
  const setNewsStatus = useMutation(api.newsAdmin.setNewsStatus);
  const deleteNews = useMutation(api.newsAdmin.deleteNews);
  const seedDemo = useMutation(api.newsAdmin.seedDemo);
  const deleteDemo = useMutation(api.newsAdmin.deleteDemo);
  const createCategory = useMutation(api.newsAdmin.createCategory);
  const updateCategory = useMutation(api.newsAdmin.updateCategory);
  const deleteCategory = useMutation(api.newsAdmin.deleteCategory);
  const createSource = useMutation(api.newsAdmin.createSource);
  const updateSource = useMutation(api.newsAdmin.updateSource);
  const deleteSource = useMutation(api.newsAdmin.deleteSource);
  const fetchSource = useAction(api.newsIngest.fetchSource);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"news"> | null>(null);
  const [newsForm, setNewsForm] = useState(EMPTY_NEWS);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    tone: "navy",
  });
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceRow | null>(null);
  const [sourceForm, setSourceForm] = useState({
    name: "",
    url: "",
    defaultCategoryId: "",
    isActive: true,
  });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const news = (newsList?.items ?? []) as NewsRow[];
  const categories = (categoryList ?? []) as CategoryRow[];
  const sources = (sourceList ?? []) as SourceRow[];
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const now = overview?.generatedAt ?? 0;

  if (context === undefined) {
    return (
      <AdminShell active="news">
        <div className="clay flex min-h-40 items-center justify-center rounded-[28px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const openCreateNews = () => {
    setEditingId(null);
    setNewsForm({
      ...EMPTY_NEWS,
      categoryId: categories[0]?.id ?? "",
      publishedAt: toLocalInput(Date.now()),
    });
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEditNews = (row: NewsRow) => {
    setEditingId(row.id);
    setNewsForm({
      title: row.title,
      summary: row.summary,
      body: row.body,
      imageUrl: row.imageUrl ?? "",
      categoryId: row.categoryId,
      sourceId: row.sourceId ?? "",
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl ?? "",
      publishedAt: toLocalInput(row.publishedAt),
      isUrgent: row.isUrgent,
      isPinned: row.isPinned,
      status: row.status,
      isDemo: row.isDemo,
    });
    setEditorError(null);
    setEditorOpen(true);
  };

  const submitNews = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorError(null);
    if (!newsForm.categoryId) {
      setEditorError("دسته‌بندی خبر را انتخاب کنید.");
      return;
    }
    if (
      newsForm.status === "published" &&
      (!newsForm.sourceName.trim() || !newsForm.sourceUrl.trim())
    ) {
      setEditorError("برای انتشار خبر، نام منبع و لینک منبع اصلی الزامی است.");
      return;
    }
    const publishedAt = fromLocalInput(newsForm.publishedAt);
    if (!publishedAt) {
      setEditorError("تاریخ و ساعت انتشار را وارد کنید.");
      return;
    }
    const args = {
      title: newsForm.title,
      summary: newsForm.summary,
      body: newsForm.body,
      imageUrl: newsForm.imageUrl.trim() || undefined,
      categoryId: newsForm.categoryId as Id<"news_categories">,
      sourceId: newsForm.sourceId
        ? (newsForm.sourceId as Id<"news_sources">)
        : undefined,
      sourceName: newsForm.sourceName,
      sourceUrl: newsForm.sourceUrl.trim() || undefined,
      publishedAt,
      isUrgent: newsForm.isUrgent,
      isPinned: newsForm.isPinned,
      status: newsForm.status,
    };
    setEditorLoading(true);
    try {
      if (editingId) {
        await updateNews({ ...args, newsId: editingId });
        toast.success("خبر به‌روزرسانی شد.");
      } else {
        await createNews(args);
        toast.success("خبر ثبت شد.");
      }
      setEditorOpen(false);
    } catch (caught) {
      setEditorError(errorMessage(caught, "ذخیره خبر ممکن نشد."));
    } finally {
      setEditorLoading(false);
    }
  };

  const quickStatus = async (row: NewsRow) => {
    setBusyId(row.id);
    const next: NewsStatus = row.status === "published" ? "draft" : "published";
    try {
      await setNewsStatus({ newsId: row.id, status: next });
      toast.success(
        next === "published" ? "خبر منتشر شد." : "خبر از انتشار خارج شد.",
      );
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت خبر ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedDemo({});
      if (result.seededDemo > 0) {
        toast.success(
          `${faNumber(result.seededDemo)} داده نمونه با برچسب Demo اضافه شد.`,
        );
      } else {
        toast.info(
          "داده نمونه اضافه نشد چون از قبل خبری در سامانه وجود دارد.",
        );
      }
    } catch (caught) {
      toast.error(errorMessage(caught, "درج داده نمونه ممکن نشد."));
    } finally {
      setSeeding(false);
    }
  };

  const openCategory = (row: CategoryRow | null) => {
    setEditingCategory(row);
    setCategoryForm({
      name: row?.name ?? "",
      description: row?.description ?? "",
      tone: row?.tone ?? "navy",
    });
    setCategoryOpen(true);
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryLoading(true);
    try {
      if (editingCategory) {
        await updateCategory({
          categoryId: editingCategory.id,
          name: categoryForm.name,
          description: categoryForm.description.trim() || undefined,
          tone: categoryForm.tone,
          isActive: editingCategory.isActive,
        });
        toast.success("دسته‌بندی به‌روزرسانی شد.");
      } else {
        await createCategory({
          name: categoryForm.name,
          description: categoryForm.description.trim() || undefined,
          tone: categoryForm.tone,
        });
        toast.success("دسته‌بندی ساخته شد.");
      }
      setCategoryOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught, "ذخیره دسته‌بندی ممکن نشد."));
    } finally {
      setCategoryLoading(false);
    }
  };

  const toggleCategory = async (row: CategoryRow) => {
    setBusyId(row.id);
    try {
      await updateCategory({
        categoryId: row.id,
        name: row.name,
        description: row.description ?? undefined,
        tone: row.tone,
        isActive: !row.isActive,
      });
      toast.success(row.isActive ? "دسته غیرفعال شد." : "دسته فعال شد.");
    } catch (caught) {
      toast.error(errorMessage(caught, "تغییر وضعیت دسته ممکن نشد."));
    } finally {
      setBusyId(null);
    }
  };

  const openSource = (row: SourceRow | null) => {
    setEditingSource(row);
    setSourceForm({
      name: row?.name ?? "",
      url: row?.url ?? "",
      defaultCategoryId: row?.defaultCategoryId ?? categories[0]?.id ?? "",
      isActive: row?.isActive ?? true,
    });
    setSourceOpen(true);
  };

  const submitSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSourceLoading(true);
    try {
      if (editingSource) {
        await updateSource({
          sourceId: editingSource.id,
          name: sourceForm.name,
          url: sourceForm.url,
          defaultCategoryId: sourceForm.defaultCategoryId
            ? (sourceForm.defaultCategoryId as Id<"news_categories">)
            : undefined,
          isActive: sourceForm.isActive,
        });
        toast.success("منبع به‌روزرسانی شد.");
      } else {
        await createSource({
          name: sourceForm.name,
          kind: "rss",
          url: sourceForm.url,
          defaultCategoryId: sourceForm.defaultCategoryId
            ? (sourceForm.defaultCategoryId as Id<"news_categories">)
            : undefined,
        });
        toast.success("منبع RSS ثبت شد.");
      }
      setSourceOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught, "ذخیره منبع ممکن نشد."));
    } finally {
      setSourceLoading(false);
    }
  };

  const handleFetch = async (source: SourceRow) => {
    setFetchingId(source.id);
    try {
      const result = await fetchSource({ sourceId: source.id });
      toast.success(
        `${faNumber(result.imported)} خبر برای تأیید ثبت شد؛ ${faNumber(
          result.skipped,
        )} مورد تکراری یا نامعتبر نادیده گرفته شد.`,
      );
      if (result.imported > 0) {
        setTab("news");
        setStatusFilter("pending");
      }
    } catch (caught) {
      toast.error(errorMessage(caught, "دریافت فید ممکن نشد."));
    } finally {
      setFetchingId(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.kind === "news" && confirmTarget.id) {
        await deleteNews({ newsId: confirmTarget.id as Id<"news"> });
        toast.success("خبر بایگانی شد و از خوراک کاربران خارج شد.");
      } else if (confirmTarget.kind === "category" && confirmTarget.id) {
        await deleteCategory({
          categoryId: confirmTarget.id as Id<"news_categories">,
        });
        toast.success("دسته‌بندی حذف شد.");
      } else if (confirmTarget.kind === "source" && confirmTarget.id) {
        await deleteSource({
          sourceId: confirmTarget.id as Id<"news_sources">,
        });
        toast.success("منبع حذف شد.");
      } else if (confirmTarget.kind === "demo") {
        const result = await deleteDemo({});
        toast.success(
          `${faNumber(result.removed)} داده نمونه حذف شد.`,
        );
      }
      setConfirmTarget(null);
    } catch (caught) {
      toast.error(errorMessage(caught, "حذف مورد ممکن نشد."));
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AdminShell active="news">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              مدیریت اخبار و اطلاعیه‌ها
            </h1>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-6 text-muted-foreground">
              انتشار خبر، تأیید مطالب دریافتی و مدیریت دسته‌ها و منابع RSS.
              خبرهای خودکار تا زمان تأیید شما برای کاربران نمایش داده نمی‌شوند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(overview?.news.demo ?? 0) > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirmTarget({
                    kind: "demo",
                    title: "حذف همه داده‌های نمونه",
                  })
                }
                className="h-9 rounded-xl px-2 text-[10px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                حذف داده‌های نمونه
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={seeding}
              onClick={handleSeed}
              className="clay-sm h-9 rounded-xl border-0 px-3 text-[10.5px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
            >
              {seeding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              درج داده نمونه
            </Button>
            <Button
              type="button"
              onClick={openCreateNews}
              className="clay-primary h-10 rounded-xl border-0 px-4 text-[11px] font-bold hover:brightness-105"
            >
              <Plus className="size-4" />
              خبر جدید
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <AdminStat
            label="منتشرشده"
            value={faNumber(overview?.news.published ?? 0)}
            icon={<CheckCircle2 className="size-4" />}
            tone="mint"
          />
          <AdminStat
            label="در انتظار تأیید"
            value={faNumber(overview?.news.pending ?? 0)}
            icon={<Clock3 className="size-4" />}
            tone="peach"
          />
          <AdminStat
            label="پیش‌نویس"
            value={faNumber(overview?.news.draft ?? 0)}
            icon={<CircleDashed className="size-4" />}
            tone="navy"
          />
          <AdminStat
            label="خبر فوری"
            value={faNumber(overview?.news.urgent ?? 0)}
            icon={<Flame className="size-4" />}
            tone="rose"
          />
          <AdminStat
            label="منبع فعال"
            value={faNumber(overview?.sources.active ?? 0)}
            icon={<Rss className="size-4" />}
            tone="lilac"
          />
        </section>

        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "news", label: "اخبار", icon: Newspaper },
            { key: "categories", label: "دسته‌بندی‌ها", icon: FolderTree },
            { key: "sources", label: "منابع RSS", icon: Rss },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key as AdminTab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10.5px] font-semibold transition-colors",
                  tab === item.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "news" && (
          <section className="space-y-3">
            <div className="clay rounded-[24px] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جستجوی عنوان، خلاصه یا منبع"
                    className="clay-inset h-9 rounded-xl border-0 bg-transparent pe-3 ps-9 text-[11px] shadow-none"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as "all" | NewsStatus)
                  }
                >
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] shadow-none sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                    <SelectItem value="published">منتشرشده</SelectItem>
                    <SelectItem value="pending">در انتظار تأیید</SelectItem>
                    <SelectItem value="draft">پیش‌نویس</SelectItem>
                    <SelectItem value="rejected">ردشده</SelectItem>
                    <SelectItem value="archived">بایگانی‌شده</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="clay-inset h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] shadow-none sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all">همه دسته‌ها</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newsList === undefined ? (
              <AdminLoading />
            ) : news.length === 0 ? (
              <div className="clay flex flex-col items-center rounded-[26px] p-8 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Inbox className="size-5" />
                </span>
                <p className="mt-3 text-sm font-bold">خبری با این فیلترها نیست</p>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  خبر جدید بسازید یا فیلترها را تغییر دهید.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {news.map((row) => {
                  const busy = busyId === row.id;
                  return (
                    <article
                      key={row.id}
                      className="clay flex flex-col gap-3 rounded-[24px] p-4 lg:flex-row lg:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[9px] font-bold",
                              STATUS_CLASSES[row.status],
                            )}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                          <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-medium text-primary">
                            {row.categoryName}
                          </span>
                          {row.isUrgent && (
                            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                              <Flame className="size-2.5" /> فوری
                            </span>
                          )}
                          {row.isPinned && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                              <Pin className="size-2.5" /> مهم
                            </span>
                          )}
                          {row.isDemo && (
                            <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[8.5px] font-bold text-amber-700 dark:text-amber-300">
                              Demo
                            </span>
                          )}
                          {row.sourceKind === "rss" && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[8.5px] text-muted-foreground">
                              RSS
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12.5px] font-extrabold leading-6">
                          {row.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-5 text-muted-foreground">
                          {row.summary}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
                          <span>{row.sourceName}</span>
                          <span>
                            {row.publishedAt
                              ? faDateTime(row.publishedAt)
                              : "زمان انتشار نامشخص"}
                          </span>
                          <span>به‌روزرسانی: {faDateTime(row.updatedAt)}</span>
                          {row.sourceUrl && (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              منبع اصلی
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditNews(row)}
                          className="clay-sm h-8 rounded-lg border-0 px-2.5 text-[10px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                          ویرایش
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => quickStatus(row)}
                          className="h-8 rounded-lg px-2.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : row.status === "published" ? (
                            <Undo2 className="size-3.5" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                          {row.status === "published" ? "خروج از انتشار" : "انتشار"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="بایگانی خبر"
                          onClick={() =>
                            setConfirmTarget({
                              kind: "news",
                              id: row.id,
                              title: row.title,
                            })
                          }
                          className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "categories" && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold">دسته‌بندی‌های خبری</h2>
                <p className="text-[10px] text-muted-foreground">
                  دسته‌های غیرفعال از فیلتر کاربران و انتخاب خبر جدید حذف می‌شوند.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => openCategory(null)}
                className="clay-primary h-9 rounded-xl border-0 px-3 text-[10.5px] font-bold hover:brightness-105"
              >
                <Plus className="size-3.5" />
                دسته جدید
              </Button>
            </div>
            {categoryList === undefined ? (
              <AdminLoading />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {categories.map((category) => (
                  <article
                    key={category.id}
                    className="clay rounded-[22px] p-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 size-3 shrink-0 rounded-full",
                          toneClass(category.tone),
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12px] font-extrabold">
                            {category.name}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                              category.isActive
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {category.isActive ? "فعال" : "غیرفعال"}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {faNumber(category.newsCount)} خبر
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                          {category.description || "بدون توضیح"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === category.id}
                        onClick={() => toggleCategory(category)}
                        className="h-7 rounded-lg px-2 text-[9.5px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        {category.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش دسته"
                          onClick={() => openCategory(category)}
                          className="size-7 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="حذف دسته"
                          onClick={() =>
                            setConfirmTarget({
                              kind: "category",
                              id: category.id,
                              title: category.name,
                            })
                          }
                          className="size-7 rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "sources" && (
          <section className="space-y-3">
            <div className="clay rounded-[24px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="tile-mint grid size-9 shrink-0 place-items-center rounded-[12px]">
                    <Rss className="size-4" />
                  </span>
                  <div>
                    <p className="text-[12px] font-extrabold">
                      دریافت از فید RSS
                    </p>
                    <p className="mt-0.5 max-w-2xl text-[10px] leading-5 text-muted-foreground">
                      دریافت هر منبع با دکمه «دریافت» انجام می‌شود و هر آیتم
                      تازه با وضعیت «در انتظار تأیید» ذخیره می‌شود. تکراری‌ها
                      بر اساس شناسه منبع و GUID/لینک نادیده گرفته می‌شوند. هیچ
                      فید پیش‌فرضی متصل نیست و زمان‌بندی خودکار فعال نشده است.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => openSource(null)}
                  className="clay-primary h-9 rounded-xl border-0 px-3 text-[10.5px] font-bold hover:brightness-105"
                >
                  <Plus className="size-3.5" />
                  افزودن منبع
                </Button>
              </div>
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-500/5 p-2.5 text-[9.5px] leading-5 text-amber-800 dark:text-amber-200">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                فقط نشانی‌های عمومی HTTP/HTTPS پذیرفته می‌شوند. منبع و تاریخ
                انتشار هر آیتم ذخیره می‌شود و انتشار نهایی در اختیار مدیر است.
              </p>
            </div>

            {sourceList === undefined ? (
              <AdminLoading />
            ) : sources.length === 0 ? (
              <div className="clay flex flex-col items-center rounded-[26px] p-8 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Rss className="size-5" />
                </span>
                <p className="mt-3 text-sm font-bold">هنوز منبعی ثبت نشده است</p>
                <p className="mt-1 max-w-sm text-[10.5px] leading-5 text-muted-foreground">
                  برای دریافت خودکار، نشانی RSS یک منبع رسمی را اضافه کنید.
                  تا آن زمان فقط داده‌های نمونه با برچسب Demo نمایش داده
                  می‌شوند.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {sources.map((source) => (
                  <article key={source.id} className="clay rounded-[24px] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12px] font-extrabold">
                            {source.name}
                          </p>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-semibold text-muted-foreground">
                            {source.kind.toUpperCase()}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                              source.isActive
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {source.isActive ? "فعال" : "غیرفعال"}
                          </span>
                        </div>
                        {source.url && (
                          <p
                            dir="ltr"
                            className="mt-1 truncate text-left text-[9px] text-muted-foreground"
                          >
                            {source.url}
                          </p>
                        )}
                        <p className="mt-1 text-[9.5px] text-muted-foreground">
                          دسته پیش‌فرض:{" "}
                          {categoryById.get(
                            source.defaultCategoryId as Id<"news_categories">,
                          )?.name ?? "اولین دسته فعال"}
                          {" · "}
                          {faNumber(source.pendingCount)} در انتظار ·{" "}
                          {faNumber(source.publishedCount)} منتشرشده
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[9px] text-muted-foreground">
                          <span>
                            آخرین دریافت:{" "}
                            {source.lastFetchedAt
                              ? `${faRelativeTime(source.lastFetchedAt, now)} (${faDateTime(
                                  source.lastFetchedAt,
                                )})`
                              : "هنوز انجام نشده"}
                          </span>
                          {source.lastItemCount !== null && (
                            <span>
                              · آخرین نتیجه: {faNumber(source.lastItemCount)}{" "}
                              مورد
                            </span>
                          )}
                        </p>
                        {source.lastError && (
                          <p className="mt-1.5 flex items-start gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[9px] leading-4 text-destructive">
                            <AlertCircle className="mt-0.5 size-3 shrink-0" />
                            {source.lastError}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            fetchingId === source.id ||
                            !source.isActive ||
                            !source.url
                          }
                          onClick={() => handleFetch(source)}
                          className="clay-sm h-8 rounded-lg border-0 px-2.5 text-[10px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
                        >
                          {fetchingId === source.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          دریافت
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === source.id}
                          onClick={async () => {
                            setBusyId(source.id);
                            try {
                              await updateSource({
                                sourceId: source.id,
                                name: source.name,
                                url: source.url ?? undefined,
                                defaultCategoryId:
                                  source.defaultCategoryId ?? undefined,
                                isActive: !source.isActive,
                              });
                              toast.success(
                                source.isActive
                                  ? "منبع غیرفعال شد."
                                  : "منبع فعال شد.",
                              );
                            } catch (caught) {
                              toast.error(
                                errorMessage(
                                  caught,
                                  "تغییر وضعیت منبع ممکن نشد.",
                                ),
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="h-8 rounded-lg px-2.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          {source.isActive ? "غیرفعال" : "فعال"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش منبع"
                          onClick={() => openSource(source)}
                          className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="حذف منبع"
                          onClick={() =>
                            setConfirmTarget({
                              kind: "source",
                              id: source.id,
                              title: source.name,
                            })
                          }
                          className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="clay max-h-[92vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
                <Newspaper className="size-4 text-primary" />
                {editingId ? "ویرایش خبر" : "خبر جدید"}
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-5">
                عنوان، خلاصه، متن کامل و منبع رسمی را دقیق ثبت کنید. خبر
                منتشرشده بلافاصله در خوراک کاربران دیده می‌شود.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitNews} className="space-y-4 p-5">
            {newsForm.isDemo && (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] leading-5 text-amber-800 dark:text-amber-200">
                این رکورد یک داده نمونه است. ویرایش آن همچنان برچسب Demo را
                حفظ می‌کند؛ برای خبر واقعی، یک خبر جدید بسازید.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_15rem]">
              <div className="space-y-1.5">
                <Label htmlFor="admin-news-title" className="text-[11px] font-semibold">
                  عنوان خبر
                </Label>
                <Input
                  id="admin-news-title"
                  required
                  value={newsForm.title}
                  onChange={(event) =>
                    setNewsForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[12px] shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold">دسته‌بندی</Label>
                <Select
                  value={newsForm.categoryId}
                  onValueChange={(value) =>
                    setNewsForm((prev) => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger className="clay-inset h-10 w-full rounded-xl border-0 bg-transparent text-[11px] shadow-none">
                    <SelectValue placeholder="انتخاب دسته" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-news-summary" className="text-[11px] font-semibold">
                خلاصه خبر
              </Label>
              <Textarea
                id="admin-news-summary"
                required
                value={newsForm.summary}
                onChange={(event) =>
                  setNewsForm((prev) => ({
                    ...prev,
                    summary: event.target.value,
                  }))
                }
                className="clay-inset min-h-20 rounded-xl border-0 bg-transparent text-[11.5px] shadow-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-news-body" className="text-[11px] font-semibold">
                متن کامل
              </Label>
              <Textarea
                id="admin-news-body"
                required
                value={newsForm.body}
                onChange={(event) =>
                  setNewsForm((prev) => ({
                    ...prev,
                    body: event.target.value,
                  }))
                }
                className="clay-inset min-h-40 rounded-xl border-0 bg-transparent text-[11.5px] leading-6 shadow-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-news-source" className="text-[11px] font-semibold">
                  نام منبع
                </Label>
                <Input
                  id="admin-news-source"
                  required
                  value={newsForm.sourceName}
                  onChange={(event) =>
                    setNewsForm((prev) => ({
                      ...prev,
                      sourceName: event.target.value,
                    }))
                  }
                  placeholder="مثلاً پایگاه خبری رسمی"
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[11px] shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-news-source-url" className="text-[11px] font-semibold">
                  لینک منبع اصلی
                </Label>
                <Input
                  id="admin-news-source-url"
                  dir="ltr"
                  value={newsForm.sourceUrl}
                  onChange={(event) =>
                    setNewsForm((prev) => ({
                      ...prev,
                      sourceUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[11px] shadow-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-news-image" className="text-[11px] font-semibold">
                  نشانی تصویر شاخص (اختیاری)
                </Label>
                <Input
                  id="admin-news-image"
                  dir="ltr"
                  value={newsForm.imageUrl}
                  onChange={(event) =>
                    setNewsForm((prev) => ({
                      ...prev,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[11px] shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-news-published" className="text-[11px] font-semibold">
                  تاریخ و ساعت انتشار
                </Label>
                <Input
                  id="admin-news-published"
                  type="datetime-local"
                  dir="ltr"
                  required
                  value={newsForm.publishedAt}
                  onChange={(event) =>
                    setNewsForm((prev) => ({
                      ...prev,
                      publishedAt: event.target.value,
                    }))
                  }
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[11px] shadow-none"
                />
                {newsForm.publishedAt && fromLocalInput(newsForm.publishedAt) > 0 && (
                  <p className="text-[9px] text-muted-foreground">
                    {faDateTime(fromLocalInput(newsForm.publishedAt))}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
                <div>
                  <p className="text-[11px] font-semibold">خبر فوری</p>
                  <p className="text-[9.5px] text-muted-foreground">
                    در نوار اطلاعیه‌های فوری نمایش داده می‌شود.
                  </p>
                </div>
                <Switch
                  checked={newsForm.isUrgent}
                  onCheckedChange={(checked) =>
                    setNewsForm((prev) => ({ ...prev, isUrgent: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
                <div>
                  <p className="text-[11px] font-semibold">خبر مهم / سنجاق‌شده</p>
                  <p className="text-[9.5px] text-muted-foreground">
                    بالای خوراک خبری قرار می‌گیرد.
                  </p>
                </div>
                <Switch
                  checked={newsForm.isPinned}
                  onCheckedChange={(checked) =>
                    setNewsForm((prev) => ({ ...prev, isPinned: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">وضعیت انتشار</Label>
              <Select
                value={newsForm.status}
                onValueChange={(value) =>
                  setNewsForm((prev) => ({
                    ...prev,
                    status: value as NewsStatus,
                  }))
                }
              >
                <SelectTrigger className="clay-inset h-10 w-full rounded-xl border-0 bg-transparent text-[11px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="draft">پیش‌نویس</SelectItem>
                  <SelectItem value="pending">در انتظار تأیید</SelectItem>
                  <SelectItem value="published">منتشرشده</SelectItem>
                  <SelectItem value="rejected">ردشده</SelectItem>
                  <SelectItem value="archived">بایگانی‌شده</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editorError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] font-medium leading-5 text-destructive">
                {editorError}
              </p>
            )}

            <Button
              type="submit"
              disabled={editorLoading}
              className="clay-primary h-11 w-full rounded-xl border-0 text-[12px] font-bold hover:brightness-105"
            >
              {editorLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              ذخیره خبر
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="clay w-[min(28rem,calc(100vw-1.5rem))] rounded-[26px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                {editingCategory ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={submitCategory} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="category-name" className="text-[11px] font-semibold">
                نام دسته
              </Label>
              <Input
                id="category-name"
                required
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[11.5px] shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-description" className="text-[11px] font-semibold">
                توضیح (اختیاری)
              </Label>
              <Textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                className="clay-inset min-h-16 rounded-xl border-0 bg-transparent text-[11px] shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">رنگ</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <button
                    key={tone.value}
                    type="button"
                    onClick={() =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        tone: tone.value,
                      }))
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[9.5px] font-semibold",
                      categoryForm.tone === tone.value
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border/60 text-muted-foreground",
                    )}
                  >
                    <span className={cn("size-3 rounded-full", tone.className)} />
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="submit"
              disabled={categoryLoading}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11.5px] font-bold hover:brightness-105"
            >
              {categoryLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              ذخیره دسته
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="clay w-[min(32rem,calc(100vw-1.5rem))] rounded-[26px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                {editingSource ? "ویرایش منبع" : "افزودن منبع RSS"}
              </DialogTitle>
              <DialogDescription className="text-[10.5px] leading-5">
                فقط فید RSS منابع رسمی را وارد کنید. خبرهای دریافتی قبل از
                انتشار نیاز به تأیید شما دارند.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={submitSource} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="source-name" className="text-[11px] font-semibold">
                نام منبع
              </Label>
              <Input
                id="source-name"
                required
                value={sourceForm.name}
                onChange={(event) =>
                  setSourceForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="clay-inset h-10 rounded-xl border-0 bg-transparent text-[11.5px] shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-url" className="text-[11px] font-semibold">
                نشانی فید RSS
              </Label>
              <Input
                id="source-url"
                dir="ltr"
                required
                value={sourceForm.url}
                onChange={(event) =>
                  setSourceForm((prev) => ({
                    ...prev,
                    url: event.target.value,
                  }))
                }
                placeholder="https://example.com/feed.xml"
                className="clay-inset h-10 rounded-xl border-0 bg-transparent text-left text-[11px] shadow-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">
                دسته پیش‌فرض خبرهای دریافتی
              </Label>
              <Select
                value={sourceForm.defaultCategoryId}
                onValueChange={(value) =>
                  setSourceForm((prev) => ({
                    ...prev,
                    defaultCategoryId: value,
                  }))
                }
              >
                <SelectTrigger className="clay-inset h-10 w-full rounded-xl border-0 bg-transparent text-[11px] shadow-none">
                  <SelectValue placeholder="انتخاب دسته" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingSource && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
                <div>
                  <p className="text-[11px] font-semibold">منبع فعال</p>
                  <p className="text-[9.5px] text-muted-foreground">
                    فقط منابع فعال در صفحه اخبار دیده می‌شوند.
                  </p>
                </div>
                <Switch
                  checked={sourceForm.isActive}
                  onCheckedChange={(checked) =>
                    setSourceForm((prev) => ({
                      ...prev,
                      isActive: checked,
                    }))
                  }
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={sourceLoading}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11.5px] font-bold hover:brightness-105"
            >
              {sourceLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              ذخیره منبع
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent className="clay w-[min(28rem,calc(100vw-1.5rem))] rounded-[26px] border-0">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="text-base font-extrabold">
              {confirmTarget?.title}؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-6">
              {confirmTarget?.kind === "demo"
                ? "همه خبرهای نمونه با برچسب Demo حذف می‌شوند. خبرهای واقعی دست‌نخورده می‌مانند."
                : confirmTarget?.kind === "category"
                  ? "این دسته فقط وقتی حذف می‌شود که هیچ خبری به آن وصل نباشد."
                  : confirmTarget?.kind === "source"
                    ? "منبع فقط وقتی حذف می‌شود که هیچ خبری به آن وصل نباشد."
                    : "این خبر به بایگانی منتقل و از خوراک کاربران خارج می‌شود. ذخیره‌ها و سابقه خواندن کاربران حفظ می‌شوند."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-xl">انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={confirmLoading}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {confirmLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : confirmTarget?.kind === "news" ? (
                <Archive className="size-4" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {confirmTarget?.kind === "news" ? "بایگانی" : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function AdminStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "navy" | "mint" | "peach" | "lilac" | "rose";
}) {
  const tones = {
    navy: "tile-navy",
    mint: "tile-mint",
    peach: "tile-peach",
    lilac: "tile-lilac",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  } as const;
  return (
    <div className="clay rounded-[22px] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg",
            tones[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="clay flex items-center justify-center rounded-[26px] p-10">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
