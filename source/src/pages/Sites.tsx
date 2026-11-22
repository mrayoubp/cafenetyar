import { AppShell } from "@/components/layout/AppShell";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/backend/api";
import type { Id } from "@/backend/ids";
import { errorMessage } from "@/lib/auth";
import { faDateLong, faNumber, faRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/hooks/use-managed-content";
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Car,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  Flag,
  Globe2,
  GraduationCap,
  Home,
  Landmark,
  LayoutGrid,
  Loader2,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import {
  useDeferredValue,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Category = {
  id: Id<"website_categories">;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  tone: string;
  count: number;
};

type Site = {
  id: Id<"websites">;
  name: string;
  description: string;
  url: string;
  logoUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verificationStatus: "verified" | "needs_review";
  lastCheckedAt: number | null;
  lastCheckStatus: "ok" | "error" | "unchecked";
  visitCount: number;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  updatedAt: number;
  createdAt: number;
  isFavorite: boolean;
  favoriteOrder: number | null;
  lastVisitedAt: number | null;
  category: {
    id: Id<"website_categories">;
    name: string;
    icon: string;
    tone: string;
  };
};

type Catalog = {
  items: Site[];
  categories: Category[];
  mySuggestions: {
    id: Id<"website_suggestions">;
    name: string;
    url: string;
    description: string;
    status: "pending" | "approved" | "rejected";
    adminNote: string | null;
    createdAt: number;
  }[];
  stats: {
    total: number;
    favorites: number;
    recent: number;
    featured: number;
    needsReview: number;
  };
  serverNow: number;
};

type Mode = "all" | "featured" | "favorites" | "recent" | "new";
type SortMode = "recommended" | "popular" | "newest" | "alpha";

const CATEGORY_ICONS: Record<string, typeof Globe2> = {
  landmark: Landmark,
  scale: Scale,
  banknote: Banknote,
  clipboard: ClipboardList,
  graduation: GraduationCap,
  briefcase: Briefcase,
  car: Car,
  shield: Shield,
  receipt: ReceiptText,
  wifi: Wifi,
  home: Home,
  grid: LayoutGrid,
};

const TONE_CLASS: Record<string, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

const MODES: { key: Mode; label: string; icon: typeof Globe2 }[] = [
  { key: "all", label: "همه سامانه‌ها", icon: LayoutGrid },
  { key: "featured", label: "پیشنهادی", icon: Sparkles },
  { key: "favorites", label: "علاقه‌مندی من", icon: Bookmark },
  { key: "recent", label: "اخیراً بازشده", icon: Clock3 },
  { key: "new", label: "تازه‌ها", icon: Plus },
];

const SUGGESTION_LABELS: Record<string, string> = {
  pending: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
};

const REPORT_REASONS = [
  { value: "not_working", label: "سامانه باز نمی‌شود" },
  { value: "wrong_address", label: "آدرس اشتباه است" },
  { value: "unsafe", label: "محتوای ناامن یا مشکوک" },
  { value: "other", label: "مورد دیگر" },
] as const;

const EMPTY_SUGGESTION = {
  name: "",
  description: "",
  url: "",
  categoryId: "",
  sourceName: "",
  sourceUrl: "",
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

function toneClass(tone: string) {
  return TONE_CLASS[tone] ?? "tile-navy";
}

function domainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SiteLogo({ site, size = "md" }: { site: Site; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY_ICONS[site.category.icon] ?? Globe2;
  const box = size === "sm" ? "size-9 rounded-[11px]" : "size-12 rounded-[15px]";
  if (site.logoUrl && !failed) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden bg-card",
          box,
        )}
      >
        <img
          src={site.logoUrl}
          alt={site.name}
          loading="lazy"
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className={cn("grid shrink-0 place-items-center", toneClass(site.category.tone), box)}>
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

function SiteCard({
  site,
  now,
  busy,
  onFavorite,
  onCopy,
  onReport,
  onVisit,
}: {
  site: Site;
  now: number;
  busy: boolean;
  onFavorite: (site: Site) => void;
  onCopy: (site: Site) => void;
  onReport: (site: Site) => void;
  onVisit: (site: Site) => void;
}) {
  return (
    <article className="clay clay-lift flex flex-col rounded-[26px] p-4">
      <div className="flex items-start gap-3">
        <SiteLogo site={site} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {site.category.name}
            </span>
            {site.isFeatured && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                پیشنهادی
              </span>
            )}
            {site.verificationStatus === "needs_review" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                نیازمند بررسی
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate text-[13.5px] font-extrabold">
            {site.name}
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">
            {domainLabel(site.url)}
          </p>
        </div>
        <button
          type="button"
          aria-label={
            site.isFavorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
          }
          disabled={busy}
          onClick={() => onFavorite(site)}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl transition-colors",
            site.isFavorite
              ? "bg-primary/10 text-primary"
              : "bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : site.isFavorite ? (
            <BookmarkCheck className="size-4" />
          ) : (
            <Bookmark className="size-4" />
          )}
        </button>
      </div>

      <p className="mt-3 line-clamp-2 min-h-9 text-[11px] leading-5 text-muted-foreground">
        {site.description}
      </p>

      <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-muted/45 px-2.5 py-1.5">
        <Globe2 className="size-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" dir="ltr">
          {site.url}
        </span>
        {site.verificationStatus === "verified" && (
          <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 truncate text-[9.5px] text-muted-foreground/85">
        <span className="truncate">منبع رسمی: {site.sourceName}</span>
        {site.sourceUrl && (
          <a
            href={site.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="مشاهده منبع رسمی"
            className="shrink-0 text-primary hover:underline"
          >
            <ExternalLink className="size-2.5" />
          </a>
        )}
      </p>

      <div className="mt-auto flex items-center gap-1.5 pt-3">
        <Button asChild className="clay-primary h-9 flex-1 rounded-xl border-0 px-3 text-[10.5px] font-bold hover:brightness-105">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onVisit(site)}
          >
            ورود به سامانه
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
        <button
          type="button"
          aria-label="کپی لینک"
          onClick={() => onCopy(site)}
          className="grid size-9 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:text-primary"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="گزارش لینک خراب"
          onClick={() => onReport(site)}
          className="grid size-9 place-items-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Flag className="size-3.5" />
        </button>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground/70">
        آخرین به‌روزرسانی: {faDateLong(site.updatedAt)} ·{" "}
        {faNumber(site.visitCount)} بازدید
        {site.lastVisitedAt
          ? ` · آخرین بازدید شما ${faRelativeTime(site.lastVisitedAt, now)}`
          : ""}
      </p>
    </article>
  );
}

function SpotlightCard({
  site,
  onVisit,
}: {
  site: Site;
  onVisit: (site: Site) => void;
}) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onVisit(site)}
      className="clay-sm clay-lift group flex flex-col rounded-[22px] p-4"
    >
      <div className="flex items-center gap-2.5">
        <SiteLogo site={site} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-extrabold">{site.name}</p>
          <p className="mt-0.5 truncate text-[9px] text-muted-foreground" dir="ltr">
            {domainLabel(site.url)}
          </p>
        </div>
        <ChevronLeft className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
      </div>
      <p className="mt-2.5 line-clamp-2 text-[10px] leading-5 text-muted-foreground">
        {site.description}
      </p>
    </a>
  );
}

export default function Sites() {
  const catalogQuery = useQuery(api.websites.catalog, {});
  const catalog = catalogQuery as Catalog | undefined;
  const toggleFavorite = useMutation(api.websites.toggleFavorite);
  const moveFavorite = useMutation(api.websites.moveFavorite);
  const recordVisit = useMutation(api.websites.recordVisit);
  const submitSuggestion = useMutation(api.websites.submitSuggestion);
  const reportBroken = useMutation(api.websites.reportBroken);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [mode, setMode] = useState<Mode>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState(EMPTY_SUGGESTION);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [reportTarget, setReportTarget] = useState<Site | null>(null);
  const [reportReason, setReportReason] = useState<
    "not_working" | "wrong_address" | "unsafe" | "other"
  >("not_working");
  const [reportNote, setReportNote] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const items = catalog?.items ?? [];
  const categories = catalog?.categories ?? [];
  const now = catalog?.serverNow ?? 0;
  const searchValue = normalizeSearch(deferredSearch);

  const favorites = [...items]
    .filter((site) => site.isFavorite)
    .sort(
      (a, b) =>
        (a.favoriteOrder ?? 0) - (b.favoriteOrder ?? 0) ||
        a.name.localeCompare(b.name, "fa"),
    );
  const recent = [...items]
    .filter((site) => site.lastVisitedAt !== null)
    .sort((a, b) => (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0));
  const featured = items.filter((site) => site.isFeatured);

  const filtered = items
    .filter((site) => {
      if (categoryId !== "all" && site.category.id !== categoryId) {
        return false;
      }
      if (mode === "featured" && !site.isFeatured) return false;
      if (mode === "favorites" && !site.isFavorite) return false;
      if (mode === "recent" && site.lastVisitedAt === null) return false;
      if (mode === "new" && site.createdAt < now - 60 * 24 * 60 * 60 * 1000) {
        return false;
      }
      if (searchValue) {
        const haystack = normalizeSearch(
          `${site.name} ${site.description} ${site.category.name} ${site.url} ${site.sourceName}`,
        );
        if (!haystack.includes(searchValue)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (mode === "favorites") {
        return (a.favoriteOrder ?? 0) - (b.favoriteOrder ?? 0);
      }
      if (mode === "recent") {
        return (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0);
      }
      if (sortMode === "popular") {
        return b.visitCount - a.visitCount || a.sortOrder - b.sortOrder;
      }
      if (sortMode === "newest") {
        return b.createdAt - a.createdAt || a.sortOrder - b.sortOrder;
      }
      if (sortMode === "alpha") {
        return a.name.localeCompare(b.name, "fa");
      }
      return (
        Number(b.isFeatured) - Number(a.isFeatured) ||
        a.sortOrder - b.sortOrder
      );
    });

  const activeCategory = categories.find((item) => item.id === categoryId);

  const handleFavorite = async (site: Site) => {
    setBusyFavorite(site.id);
    try {
      const result = await toggleFavorite({ websiteId: site.id });
      toast.success(
        result.isFavorite
          ? "به علاقه‌مندی‌ها اضافه شد."
          : "از علاقه‌مندی‌ها حذف شد.",
      );
    } catch (error) {
      toast.error(errorMessage(error, "تغییر علاقه‌مندی ممکن نشد."));
    } finally {
      setBusyFavorite(null);
    }
  };

  const handleMove = async (site: Site, direction: "up" | "down") => {
    setMovingId(site.id);
    try {
      const result = await moveFavorite({
        websiteId: site.id,
        direction,
      });
      if (!result.moved) return;
    } catch (error) {
      toast.error(errorMessage(error, "تغییر ترتیب ممکن نشد."));
    } finally {
      setMovingId(null);
    }
  };

  const handleCopy = async (site: Site) => {
    try {
      await navigator.clipboard.writeText(site.url);
      toast.success("لینک سامانه کپی شد.");
    } catch {
      toast.error("مرورگر اجازه کپی کردن لینک را نداد.");
    }
  };

  const handleVisit = (site: Site) => {
    recordVisit({ websiteId: site.id }).catch(() => undefined);
  };

  const openSuggestion = () => {
    const firstCategory = categories[0]?.id ?? "";
    setSuggestionForm({ ...EMPTY_SUGGESTION, categoryId: firstCategory });
    setSuggestionError(null);
    setSuggestionOpen(true);
  };

  const handleSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!suggestionForm.categoryId) {
      setSuggestionError("دسته‌بندی را انتخاب کنید.");
      return;
    }
    setSuggestionLoading(true);
    setSuggestionError(null);
    try {
      await submitSuggestion({
        name: suggestionForm.name,
        description: suggestionForm.description,
        url: suggestionForm.url,
        categoryId: suggestionForm.categoryId as Id<"website_categories">,
        sourceName: suggestionForm.sourceName,
        sourceUrl: suggestionForm.sourceUrl || undefined,
      });
      setSuggestionOpen(false);
      setSuggestionForm(EMPTY_SUGGESTION);
      toast.success("پیشنهاد شما ثبت شد و پس از بررسی مدیر اضافه می‌شود.");
    } catch (error) {
      setSuggestionError(errorMessage(error, "ثبت پیشنهاد ممکن نشد."));
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reportTarget) return;
    setReportLoading(true);
    try {
      await reportBroken({
        websiteId: reportTarget.id,
        reason: reportReason,
        note: reportNote.trim() || undefined,
      });
      setReportTarget(null);
      setReportNote("");
      setReportReason("not_working");
      toast.success("گزارش شما ثبت شد؛ مدیر اصلی بررسی می‌کند.");
    } catch (error) {
      toast.error(errorMessage(error, "ثبت گزارش ممکن نشد."));
    } finally {
      setReportLoading(false);
    }
  };

  if (catalog === undefined) {
    return (
      <AppShell active="sites">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="clay-sm h-48 animate-pulse rounded-[26px]"
            />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="sites">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[32px] p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -start-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 end-4 size-64 rounded-full bg-accent/40 blur-3xl"
          />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="clay-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-medium text-muted-foreground">
                <Globe2 className="size-3.5" />
                بانک سامانه‌های پرکاربرد
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="size-3.5" />
                منبع رسمی
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold leading-[1.5] tracking-tight sm:text-[2rem]">
              هر سامانه، یک کلیک دورتر
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-7 text-muted-foreground">
              سامانه‌های دولتی، بانکی، آموزشی و خدماتی را در یک بانک واحد
              جستجو کنید؛ علاقه‌مندی‌های خود را بچینید و آخرین سامانه‌هایی را
              که باز کرده‌اید سریع پیدا کنید.
            </p>

            <div className="relative mt-5 max-w-2xl">
              <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="نام سامانه، خدمت یا آدرس را جستجو کنید…"
                className="clay-inset h-12 rounded-2xl border-0 bg-card/60 pe-11 ps-11 text-[12px] shadow-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
              {search && (
                <button
                  type="button"
                  aria-label="پاک کردن جستجو"
                  onClick={() => setSearch("")}
                  className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <HeroStat label="سامانه فعال" value={catalog.stats.total} icon={<Globe2 className="size-3.5" />} />
              <HeroStat label="دسته‌بندی" value={categories.length} icon={<LayoutGrid className="size-3.5" />} />
              <HeroStat label="علاقه‌مندی شما" value={catalog.stats.favorites} icon={<Bookmark className="size-3.5" />} />
              <HeroStat label="بازدید اخیر" value={catalog.stats.recent} icon={<Clock3 className="size-3.5" />} />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-1.5">
          {MODES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMode(item.key);
                  if (item.key === "all") setCategoryId("all");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10.5px] font-semibold transition-colors",
                  mode === item.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
                {item.key === "favorites" && favorites.length > 0 && (
                  <span className="rounded-full bg-black/10 px-1.5 text-[9px]">
                    {faNumber(favorites.length)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "all" && !search && featured.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-sm font-extrabold">پیشنهادهای کافی‌نت‌یار</h2>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  سامانه‌هایی که بیشترین کاربرد را برای کافی‌نت‌ها دارند.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full text-[9px]">
                {faNumber(featured.length)} سامانه
              </Badge>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.slice(0, 4).map((site) => (
                <SpotlightCard key={site.id} site={site} onVisit={handleVisit} />
              ))}
            </div>
          </section>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <section className="clay rounded-[24px] p-3">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={categoryId === "all"}
                  onClick={() => setCategoryId("all")}
                  icon={<LayoutGrid className="size-3.5" />}
                  label="همه"
                  count={items.length}
                />
                {categories.map((category) => {
                  const Icon = CATEGORY_ICONS[category.icon] ?? Globe2;
                  return (
                    <FilterChip
                      key={category.id}
                      active={categoryId === category.id}
                      onClick={() => {
                        setCategoryId(category.id);
                        setMode("all");
                      }}
                      icon={<Icon className="size-3.5" />}
                      label={category.name}
                      count={category.count}
                    />
                  );
                })}
              </div>
            </section>

            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <h2 className="text-base font-extrabold tracking-tight">
                  {mode === "favorites"
                    ? "علاقه‌مندی‌های من"
                    : mode === "recent"
                      ? "اخیراً بازشده"
                      : mode === "featured"
                        ? "سامانه‌های پیشنهادی"
                        : mode === "new"
                          ? "سامانه‌های تازه"
                          : activeCategory
                            ? activeCategory.name
                            : "همه سامانه‌ها"}
                </h2>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  {faNumber(filtered.length)} سامانه
                  {searchValue ? ` برای «${deferredSearch.trim()}»` : ""}
                </p>
              </div>
              <Select
                value={sortMode}
                onValueChange={(value) => setSortMode(value as SortMode)}
              >
                <SelectTrigger className="h-9 w-36 rounded-xl border-border/60 bg-card/60 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">پیشنهادی</SelectItem>
                  <SelectItem value="popular">پربازدید</SelectItem>
                  <SelectItem value="newest">تازه‌ترین</SelectItem>
                  <SelectItem value="alpha">الفبا</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((site) => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    now={now}
                    busy={busyFavorite === site.id}
                    onFavorite={handleFavorite}
                    onCopy={handleCopy}
                    onReport={setReportTarget}
                    onVisit={handleVisit}
                  />
                ))}
              </div>
            ) : (
              <div className="clay flex min-h-56 flex-col items-center justify-center rounded-[28px] p-8 text-center">
                <span className="tile-mint grid size-12 place-items-center rounded-[16px]">
                  <Search className="size-5" />
                </span>
                <p className="mt-3 text-sm font-extrabold">سامانه‌ای پیدا نشد</p>
                <p className="mt-1 max-w-sm text-[11px] leading-6 text-muted-foreground">
                  جستجو یا فیلترها را تغییر دهید. اگر سامانه مفیدی می‌شناسید،
                  آن را برای بررسی پیشنهاد کنید.
                </p>
                <Button
                  type="button"
                  onClick={openSuggestion}
                  className="clay-primary mt-4 h-9 rounded-xl border-0 px-3 text-[10.5px] font-bold hover:brightness-105"
                >
                  <Plus className="size-3.5" />
                  پیشنهاد سامانه جدید
                </Button>
              </div>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <section className="clay rounded-[26px] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="tile-navy grid size-8 place-items-center rounded-[10px]">
                    <BookmarkCheck className="size-4" />
                  </span>
                  <h2 className="text-[12px] font-extrabold">علاقه‌مندی‌ها</h2>
                </div>
                <Badge variant="secondary" className="rounded-full text-[9px]">
                  {faNumber(favorites.length)}
                </Badge>
              </div>
              {favorites.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
                  با زدن نشانک روی هر کارت، سامانه را برای دسترسی سریع اینجا
                  ذخیره کنید.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {favorites.map((site, index) => {
                    const Icon = CATEGORY_ICONS[site.category.icon] ?? Globe2;
                    return (
                      <li
                        key={site.id}
                        className="flex items-center gap-1.5 rounded-xl bg-muted/40 p-1.5"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground">
                          <Icon className="size-3" />
                        </span>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleVisit(site)}
                          className="min-w-0 flex-1 truncate text-[10.5px] font-semibold hover:text-primary"
                        >
                          {site.name}
                        </a>
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            aria-label="بالا"
                            disabled={index === 0 || movingId === site.id}
                            onClick={() => handleMove(site, "up")}
                            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-primary disabled:opacity-30"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="پایین"
                            disabled={
                              index === favorites.length - 1 ||
                              movingId === site.id
                            }
                            onClick={() => handleMove(site, "down")}
                            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-primary disabled:opacity-30"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="حذف از علاقه‌مندی‌ها"
                            onClick={() => handleFavorite(site)}
                            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {favorites.length > 0 && (
                <p className="mt-2 text-[9px] leading-4 text-muted-foreground/80">
                  ترتیب را با فلش‌های بالا و پایین تغییر دهید.
                </p>
              )}
            </section>

            <section className="clay rounded-[26px] p-4">
              <div className="flex items-center gap-2">
                <span className="tile-mint grid size-8 place-items-center rounded-[10px]">
                  <Clock3 className="size-4" />
                </span>
                <h2 className="text-[12px] font-extrabold">بازدیدهای اخیر</h2>
              </div>
              {recent.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-muted/50 p-3 text-[10px] leading-5 text-muted-foreground">
                  سامانه‌ای را باز کنید تا تاریخچه کوتاه آن اینجا نمایش داده
                  شود.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {recent.slice(0, 5).map((site) => (
                    <li key={site.id}>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleVisit(site)}
                        className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-muted/50"
                      >
                        <Globe2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">
                          {site.name}
                        </span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          {faRelativeTime(site.lastVisitedAt ?? 0, now)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {recent.length > 5 && (
                <button
                  type="button"
                  onClick={() => setMode("recent")}
                  className="mt-2 text-[10px] font-semibold text-primary hover:underline"
                >
                  مشاهده همه بازدیدهای اخیر
                </button>
              )}
            </section>

            <section className="clay-inset rounded-[26px] p-4">
              <div className="flex items-center gap-2">
                <span className="tile-peach grid size-8 place-items-center rounded-[10px]">
                  <Send className="size-4" />
                </span>
                <h2 className="text-[12px] font-extrabold">سامانه‌ای کم است؟</h2>
              </div>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                آدرس رسمی سامانه را پیشنهاد دهید؛ بعد از بررسی مدیر به بانک
                اضافه می‌شود.
              </p>
              <Button
                type="button"
                onClick={openSuggestion}
                className="clay-sm mt-3 h-9 w-full rounded-xl border-0 bg-transparent text-[10.5px] font-bold text-primary hover:bg-primary/10"
              >
                <Plus className="size-3.5" />
                پیشنهاد سامانه جدید
              </Button>
            </section>

            {catalog.mySuggestions.length > 0 && (
              <section className="clay rounded-[26px] p-4">
                <h2 className="text-[12px] font-extrabold">پیشنهادهای من</h2>
                <ul className="mt-2.5 space-y-1.5">
                  {catalog.mySuggestions.slice(0, 4).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl bg-muted/40 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">
                          {item.name}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold",
                            item.status === "pending" &&
                              "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            item.status === "approved" &&
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            item.status === "rejected" &&
                              "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {SUGGESTION_LABELS[item.status]}
                        </span>
                      </div>
                      {item.adminNote && (
                        <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
                          یادداشت مدیر: {item.adminNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="px-2 text-[9px] leading-4 text-muted-foreground/80">
              آدرس‌ها فقط از دامنه‌های رسمی ثبت می‌شوند. اگر سامانه‌ای نیازمند
              بررسی باشد، برچسب آن نمایش داده می‌شود.
            </p>
          </aside>
        </div>

        <div className="clay-inset flex flex-col gap-2 rounded-[24px] p-4 text-[10px] leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            اطلاعات بانک سامانه‌ها توسط مدیر اصلی به‌روزرسانی می‌شود؛ منبع هر
            سامانه در کارت آن ذکر شده است.
          </p>
          <Link
            to="/dashboard/news"
            className="shrink-0 font-semibold text-primary hover:underline"
          >
            اخبار تغییرات سامانه‌ها
          </Link>
        </div>
      </div>

      <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              پیشنهاد سامانه جدید
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              فقط آدرس رسمی سامانه را وارد کنید. پیشنهاد پس از بررسی مدیر در
              بانک منتشر می‌شود.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSuggestion} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="suggest-name">نام سامانه</Label>
              <Input
                id="suggest-name"
                value={suggestionForm.name}
                onChange={(event) =>
                  setSuggestionForm((form) => ({
                    ...form,
                    name: event.target.value,
                  }))
                }
                placeholder="مثلاً سامانه ثبت‌نام آزمون"
                required
                minLength={3}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-url">آدرس رسمی</Label>
              <Input
                id="suggest-url"
                value={suggestionForm.url}
                onChange={(event) =>
                  setSuggestionForm((form) => ({
                    ...form,
                    url: event.target.value,
                  }))
                }
                placeholder="https://example.ir"
                dir="ltr"
                className="text-left"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>دسته‌بندی</Label>
                <Select
                  value={suggestionForm.categoryId}
                  onValueChange={(value) =>
                    setSuggestionForm((form) => ({
                      ...form,
                      categoryId: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب دسته" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suggest-source">نهاد یا منبع رسمی</Label>
                <Input
                  id="suggest-source"
                  value={suggestionForm.sourceName}
                  onChange={(event) =>
                    setSuggestionForm((form) => ({
                      ...form,
                      sourceName: event.target.value,
                    }))
                  }
                  placeholder="نام سازمان متولی"
                  required
                  minLength={2}
                  maxLength={140}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-source-url">لینک منبع (اختیاری)</Label>
              <Input
                id="suggest-source-url"
                value={suggestionForm.sourceUrl}
                onChange={(event) =>
                  setSuggestionForm((form) => ({
                    ...form,
                    sourceUrl: event.target.value,
                  }))
                }
                placeholder="https://…"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-description">توضیح کوتاه</Label>
              <Textarea
                id="suggest-description"
                value={suggestionForm.description}
                onChange={(event) =>
                  setSuggestionForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
                placeholder="این سامانه چه کاری انجام می‌دهد؟"
                rows={3}
                required
                minLength={10}
                maxLength={300}
              />
            </div>
            {suggestionError && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[10.5px] leading-5 text-destructive">
                {suggestionError}
              </p>
            )}
            <Button
              type="submit"
              disabled={suggestionLoading}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
            >
              {suggestionLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              ثبت پیشنهاد برای بررسی
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reportTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReportTarget(null);
            setReportNote("");
          }
        }}
      >
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              گزارش مشکل لینک
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-6">
              گزارش شما برای بررسی به مدیر اصلی کافی‌نت‌یار ارسال می‌شود.
            </DialogDescription>
          </DialogHeader>
          {reportTarget && (
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-[10.5px] font-semibold" dir="ltr">
              {reportTarget.name} · {domainLabel(reportTarget.url)}
            </div>
          )}
          <form onSubmit={handleReport} className="space-y-3">
            <div className="space-y-1.5">
              <Label>نوع مشکل</Label>
              <Select
                value={reportReason}
                onValueChange={(value) =>
                  setReportReason(
                    value as
                      | "not_working"
                      | "wrong_address"
                      | "unsafe"
                      | "other",
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-note">توضیح (اختیاری)</Label>
              <Textarea
                id="report-note"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="اگر پیام خطایی دیدید، کوتاه توضیح دهید."
                rows={3}
                maxLength={500}
              />
            </div>
            <Button
              type="submit"
              disabled={reportLoading}
              className="clay-primary h-10 w-full rounded-xl border-0 text-[11px] font-bold hover:brightness-105"
            >
              {reportLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Flag className="size-4" />
              )}
              ارسال گزارش
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function HeroStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="clay-inset flex items-center gap-2 rounded-2xl p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-card/70 text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="text-base font-extrabold leading-5">{faNumber(value)}</p>
        <p className="text-[9px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[8.5px]",
          active ? "bg-white/15" : "bg-card/70",
        )}
      >
        {faNumber(count)}
      </span>
    </button>
  );
}
