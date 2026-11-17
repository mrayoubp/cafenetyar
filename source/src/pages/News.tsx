import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { faNumber, faRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/hooks/use-managed-content";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  Clock3,
  ExternalLink,
  Flame,
  Inbox,
  Loader2,
  Newspaper,
  Pin,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

type FeedItem = {
  id: Id<"news">;
  title: string;
  summary: string;
  imageUrl: string | null;
  category: { id: Id<"news_categories">; name: string; slug: string; tone: string };
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: number;
  isUrgent: boolean;
  isPinned: boolean;
  isDemo: boolean;
  saved: boolean;
  read: boolean;
};

const TONE_CLASS: Record<string, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

function toneClass(tone: string) {
  return TONE_CLASS[tone] ?? "tile-navy";
}

function shareArticle(item: FeedItem) {
  const url = `${window.location.origin}/dashboard/news/${item.id}`;
  const payload = {
    title: item.title,
    text: item.summary,
    url,
  };
  if (typeof navigator.share === "function") {
    return navigator.share(payload).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      return navigator.clipboard.writeText(url).then(() => {
        toast.success("لینک خبر کپی شد.");
      });
    });
  }
  return navigator.clipboard.writeText(url).then(() => {
    toast.success("لینک خبر کپی شد.");
  });
}

function NewsCard({
  item,
  now,
  busy,
  onSave,
  onShare,
}: {
  item: FeedItem;
  now: number;
  busy: boolean;
  onSave: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}) {
  return (
    <article className="clay clay-lift group relative overflow-hidden rounded-[28px]">
      <div className="flex flex-col sm:flex-row">
        <Link
          to={`/dashboard/news/${item.id}`}
          className="group/image relative block h-44 shrink-0 overflow-hidden sm:h-auto sm:w-52"
          aria-label={item.title}
        >
          {item.imageUrl ? (
            <>
              <div
                className={cn(
                  "absolute inset-0",
                  toneClass(item.category.tone),
                )}
              />
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="relative size-full object-cover transition-transform duration-500 group-hover/image:scale-105"
              />
            </>
          ) : (
            <div
              className={cn(
                "relative flex size-full flex-col justify-between p-4",
                toneClass(item.category.tone),
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold opacity-70">
                <Newspaper className="size-3.5" />
                {item.category.name}
              </span>
              <span className="text-[13px] font-extrabold leading-6 opacity-80">
                {item.title}
              </span>
              <span className="text-[9px] font-medium opacity-60">
                تصویر شاخص ثبت نشده است
              </span>
            </div>
          )}
          {!item.read && (
            <span className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[9px] font-bold text-primary-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-primary-foreground" />
              خوانده‌نشده
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[9.5px] font-bold text-primary">
              {item.category.name}
            </span>
            {item.isUrgent && (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[9.5px] font-bold text-rose-700 dark:text-rose-300">
                <Flame className="size-3" />
                فوری
              </span>
            )}
            {item.isPinned && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">
                <Pin className="size-3" />
                مهم
              </span>
            )}
            {item.isDemo && (
              <span className="rounded-full border border-amber-500/30 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                Demo
              </span>
            )}
          </div>

          <Link
            to={`/dashboard/news/${item.id}`}
            className="mt-2.5 text-[15px] font-extrabold leading-7 tracking-tight transition-colors hover:text-primary"
          >
            {item.title}
          </Link>
          <p className="mt-1.5 line-clamp-2 flex-1 text-[11.5px] leading-6 text-muted-foreground">
            {item.summary}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {faRelativeTime(item.publishedAt, now)}
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span className="size-1 rounded-full bg-border" />
              <span className="max-w-40 truncate">{item.sourceName}</span>
            </span>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                منبع اصلی
                <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
            <Link
              to={`/dashboard/news/${item.id}`}
              className="flex items-center gap-1 text-[10.5px] font-bold text-primary"
            >
              مطالعه کامل
              <ArrowLeft className="size-3.5" />
            </Link>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={item.saved ? "حذف از ذخیره‌ها" : "ذخیره خبر"}
                disabled={busy}
                onClick={() => onSave(item)}
                className={cn(
                  "size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  item.saved && "text-primary",
                )}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : item.saved ? (
                  <BookmarkCheck className="size-3.5" />
                ) : (
                  <Bookmark className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="اشتراک‌گذاری خبر"
                onClick={() => onShare(item)}
                className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <Share2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function News() {
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category") ?? "";
  const [categoryId, setCategoryId] = useState<string>(
    /^[a-z0-9]{20,40}$/i.test(requestedCategory) ? requestedCategory : "all",
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState<string[]>([]);

  const feed = useQuery(api.news.feed, {
    categoryId:
      categoryId === "all"
        ? undefined
        : (categoryId as Id<"news_categories">),
    search: deferredSearch.trim() || undefined,
    sort,
    savedOnly: savedOnly || undefined,
    unreadOnly: unreadOnly || undefined,
    preferredOnly: preferredOnly || undefined,
  });
  const toggleSaved = useMutation(api.news.toggleSaved);
  const setPreferences = useMutation(api.news.setPreferences);

  const now = feed?.serverNow ?? 0;

  const handleSave = async (item: FeedItem) => {
    setBusyId(item.id);
    try {
      const result = await toggleSaved({ newsId: item.id });
      toast.success(
        result.saved ? "خبر در ذخیره‌های شما ثبت شد." : "خبر از ذخیره‌ها حذف شد.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ذخیره خبر ممکن نشد.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleShare = (item: FeedItem) => {
    void shareArticle(item).catch(() => {
      toast.error("اشتراک‌گذاری ممکن نشد.");
    });
  };

  const openPreferences = () => {
    setPrefsDraft(feed?.preferences.categoryIds ?? []);
    setPrefsOpen(true);
  };

  const savePreferences = async () => {
    try {
      await setPreferences({
        categoryIds: prefsDraft as Id<"news_categories">[],
      });
      toast.success("دسته‌بندی‌های مورد علاقه ذخیره شد.");
      setPrefsOpen(false);
      if (prefsDraft.length === 0) setPreferredOnly(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "ذخیره علاقه‌مندی‌ها ممکن نشد.",
      );
    }
  };

  const resetFilters = () => {
    setCategoryId("all");
    setSearch("");
    setSort("newest");
    setSavedOnly(false);
    setUnreadOnly(false);
    setPreferredOnly(false);
  };

  return (
    <AppShell active="news">
      <div className="space-y-5">
        <section className="clay relative overflow-hidden rounded-[32px] p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10.5px] font-bold text-primary">
                  <Newspaper className="size-3.5" />
                  مرکز خبر کافی‌نت
                </span>
                {feed?.hasDemo && (
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[9.5px] font-medium"
                  >
                    شامل داده نمونه Demo
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[2rem]">
                اخبار روز، یک‌جا و مرتب
              </h1>
              <p className="mt-2 max-w-xl text-[12px] leading-7 text-muted-foreground">
                اطلاعیه‌های رسمی، تغییرات سامانه‌ها، آزمون‌ها، استخدام و خدمات
                بانکی؛ همراه با منبع اصلی، ذخیره‌سازی و نشان خوانده‌نشده.
              </p>
            </div>
            <Button
              type="button"
              onClick={openPreferences}
              className="clay-sm h-10 shrink-0 rounded-xl border-0 px-3 text-[11px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
            >
              <Settings2 className="size-4" />
              دسته‌های مورد علاقه
            </Button>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="خبر منتشرشده" value={faNumber(feed?.totalCount ?? 0)} />
            <Metric label="خوانده‌نشده" value={faNumber(feed?.unreadCount ?? 0)} />
            <Metric label="ذخیره‌شده" value={faNumber(feed?.savedCount ?? 0)} />
            <Metric
              label="منبع متصل"
              value={faNumber(feed?.sources.length ?? 0)}
            />
          </div>
        </section>

        {feed?.urgent && feed.urgent.length > 0 && (
          <section className="clay overflow-hidden rounded-[28px] border border-rose-500/20 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                <Flame className="size-4" />
              </span>
              <div>
                <h2 className="text-[12.5px] font-extrabold">
                  اطلاعیه‌های مهم و فوری
                </h2>
                <p className="text-[9.5px] text-muted-foreground">
                  موارد ضروری که بهتر است همین حالا ببینید
                </p>
              </div>
            </div>
            <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
              {feed.urgent.map((item) => (
                <Link
                  key={item.id}
                  to={`/dashboard/news/${item.id}`}
                  className="clay-inset min-w-[15rem] max-w-[20rem] snap-start rounded-[18px] p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-600 dark:text-rose-300">
                    <Flame className="size-3" />
                    فوری
                    {item.isDemo && <span className="opacity-70">· Demo</span>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11.5px] font-bold leading-5">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {faRelativeTime(item.publishedAt, now)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="clay rounded-[28px] p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="جستجو در عنوان، متن، منبع..."
                  className="clay-inset h-10 rounded-xl border-0 bg-transparent pe-3 ps-9 text-[11.5px] shadow-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={sort}
                  onValueChange={(value) =>
                    setSort(value as "newest" | "oldest")
                  }
                >
                  <SelectTrigger className="clay-inset h-10 w-[8.5rem] rounded-xl border-0 bg-transparent text-[10.5px] shadow-none">
                    <SlidersHorizontal className="size-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="newest">جدیدترین</SelectItem>
                    <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
                  </SelectContent>
                </Select>
                {(search ||
                  categoryId !== "all" ||
                  savedOnly ||
                  unreadOnly ||
                  preferredOnly) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-10 rounded-xl px-2 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  >
                    <RefreshCw className="size-3.5" />
                    پاک‌کردن
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={categoryId === "all"}
                onClick={() => setCategoryId("all")}
              >
                همه اخبار
              </FilterChip>
              {feed?.categories.map((category) => (
                <FilterChip
                  key={category.id}
                  active={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                  <span className="ms-1 opacity-60">
                    {faNumber(category.newsCount)}
                  </span>
                </FilterChip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
              <FilterChip
                active={savedOnly}
                onClick={() => setSavedOnly((value) => !value)}
              >
                <Bookmark className="size-3" />
                ذخیره‌شده‌های من
              </FilterChip>
              <FilterChip
                active={unreadOnly}
                onClick={() => setUnreadOnly((value) => !value)}
              >
                <span className="size-1.5 rounded-full bg-current" />
                فقط خوانده‌نشده‌ها
              </FilterChip>
              <FilterChip
                active={preferredOnly}
                disabled={!feed?.preferences.categoryIds.length}
                onClick={() => setPreferredOnly((value) => !value)}
              >
                <Sparkles className="size-3" />
                علاقه‌مندی‌های من
              </FilterChip>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[1fr_19rem]">
          <div className="min-w-0 space-y-3">
            {feed === undefined ? (
              <div className="clay flex min-h-64 items-center justify-center rounded-[28px]">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : feed.items.length === 0 ? (
              <div className="clay flex min-h-64 flex-col items-center justify-center rounded-[28px] p-8 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Inbox className="size-5" />
                </span>
                <p className="mt-3 text-sm font-extrabold">خبری با این فیلترها پیدا نشد</p>
                <p className="mt-1 max-w-sm text-[11px] leading-6 text-muted-foreground">
                  فیلترها را پاک کنید یا عبارت جستجو را تغییر دهید. اگر هنوز
                  خبری منتشر نشده، مدیر اصلی باید از پنل مدیریت اخبار مطلب
                  اضافه کند.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  className="mt-3 h-9 rounded-xl text-[11px] font-semibold text-primary hover:bg-primary/10"
                >
                  نمایش همه اخبار
                </Button>
              </div>
            ) : (
              <>
                {feed.hasDemo && (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-[10px] leading-5 text-amber-800 dark:text-amber-200">
                    <span className="mt-0.5 rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[8px] font-bold">
                      Demo
                    </span>
                    کارت‌های دارای نشان Demo داده نمایشی‌اند و خبر واقعی نیستند.
                    برای انتشار خبر واقعی، مدیر اصلی باید متن و منبع رسمی را
                    ثبت کند.
                  </div>
                )}
                {feed.items.map((item) => (
                  <NewsCard
                    key={item.id}
                    item={item}
                    now={now}
                    busy={busyId === item.id}
                    onSave={handleSave}
                    onShare={handleShare}
                  />
                ))}
              </>
            )}
          </div>

          <aside className="space-y-3">
            <section className="clay rounded-[26px] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="tile-lilac grid size-8 place-items-center rounded-[10px]">
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-[12px] font-extrabold">علاقه‌مندی‌های من</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="ویرایش علاقه‌مندی‌ها"
                  onClick={openPreferences}
                  className="size-7 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <Settings2 className="size-3.5" />
                </Button>
              </div>
              {feed?.preferences.categoryIds.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {feed.preferences.categoryIds.map((id) => {
                    const category = feed.categories.find((item) => item.id === id);
                    if (!category) return null;
                    return (
                      <span
                        key={id}
                        className="rounded-full bg-primary/8 px-2.5 py-1 text-[9.5px] font-medium text-primary"
                      >
                        {category.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[10.5px] leading-5 text-muted-foreground">
                  دسته‌های کاری‌تان را انتخاب کنید تا خبرها را راحت‌تر پیدا
                  کنید.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={openPreferences}
                className="mt-2 h-8 w-full justify-between rounded-xl px-2 text-[10.5px] font-semibold text-primary hover:bg-primary/10"
              >
                انتخاب دسته‌های مورد علاقه
                <ArrowLeft className="size-3.5" />
              </Button>
            </section>

            <section className="clay rounded-[26px] p-4">
              <div className="flex items-center gap-2">
                <span className="tile-mint grid size-8 place-items-center rounded-[10px]">
                  <Inbox className="size-4" />
                </span>
                <p className="text-[12px] font-extrabold">منابع متصل</p>
              </div>
              {feed?.sources.length ? (
                <ul className="mt-3 space-y-2">
                  {feed.sources.map((source) => (
                    <li
                      key={source.id}
                      className="rounded-xl bg-card/60 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10.5px] font-semibold">
                          {source.name}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 dark:text-emerald-300">
                          {source.kind.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {source.lastFetchedAt
                          ? `آخرین دریافت: ${faRelativeTime(
                              source.lastFetchedAt,
                              now,
                            )}`
                          : "هنوز دریافتی ثبت نشده"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 rounded-xl bg-amber-500/5 p-2.5 text-[9.5px] leading-5 text-amber-800 dark:text-amber-200">
                  هنوز منبع رسمی و فعالی متصل نیست. محتوای Demo برای نمایش رابط
                  استفاده می‌شود و خبر واقعی محسوب نمی‌شود.
                </div>
              )}
              <p className="mt-2 flex items-start gap-1 text-[9px] leading-4 text-muted-foreground">
                <Check className="mt-0.5 size-3 shrink-0" />
                دریافت خودکار فقط پس از تأیید مدیر منتشر می‌شود.
              </p>
            </section>

            <section className="clay-inset rounded-[24px] p-3.5">
              <p className="text-[10.5px] font-bold">ذخیره‌شده‌ها</p>
              <p className="mt-1 text-[9.5px] leading-5 text-muted-foreground">
                {feed?.savedCount
                  ? `${faNumber(feed.savedCount)} خبر در فهرست شخصی شما ذخیره شده است.`
                  : "هنوز خبری ذخیره نکرده‌اید. با نشانک کنار هر کارت، آن را برای بعد نگه دارید."}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSavedOnly(true);
                  setUnreadOnly(false);
                }}
                className="mt-2 h-8 w-full justify-between rounded-xl px-2 text-[10.5px] font-semibold text-primary hover:bg-primary/10"
              >
                مشاهده ذخیره‌شده‌ها
                <ArrowLeft className="size-3.5" />
              </Button>
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="clay w-[min(30rem,calc(100vw-1.5rem))] rounded-[28px] border-0 p-0">
          <div className="border-b border-border/50 px-5 py-4 pe-5 ps-12">
            <DialogHeader className="text-start">
              <DialogTitle className="text-base font-extrabold">
                دسته‌بندی‌های مورد علاقه
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-5">
                این انتخاب فقط تجربه خبری حساب شما را شخصی‌تر می‌کند.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-2 p-5">
            {feed?.categories.map((category) => {
              const checked = prefsDraft.includes(category.id);
              return (
                <label
                  key={category.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors",
                    checked
                      ? "border-primary/25 bg-primary/5"
                      : "border-border/50 bg-card/50 hover:border-primary/20",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setPrefsDraft((current) =>
                        current.includes(category.id)
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id],
                      )
                    }
                    className="rounded-[5px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-[11.5px] font-bold">
                      {category.name}
                    </span>
                    <span className="ms-2 text-[9px] text-muted-foreground">
                      {faNumber(category.newsCount)} خبر
                    </span>
                  </span>
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      toneClass(category.tone),
                    )}
                  />
                </label>
              );
            })}
            <Button
              type="button"
              onClick={savePreferences}
              className="clay-primary mt-2 h-10 w-full rounded-xl border-0 text-[11.5px] font-bold hover:brightness-105"
            >
              <Check className="size-4" />
              ذخیره علاقه‌مندی‌ها
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay-inset rounded-2xl px-3 py-2">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-extrabold">{value}</p>
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}
