import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { faDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/hooks/use-managed-content";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  Flame,
  Loader2,
  Newspaper,
  Pin,
  Share2,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

const TONE_CLASS: Record<string, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

function toneClass(tone: string) {
  return TONE_CLASS[tone] ?? "tile-navy";
}

export default function NewsDetail() {
  const { newsId } = useParams<{ newsId: string }>();
  const article = useQuery(api.news.get, {
    newsId: newsId ?? "",
  });
  const markRead = useMutation(api.news.markRead);
  const toggleSaved = useMutation(api.news.toggleSaved);
  const [saving, setSaving] = useState(false);
  const articleId = article?.id;

  useEffect(() => {
    if (!articleId) return;
    void markRead({ newsId: articleId }).catch(() => {
      // A removed article should not break the page.
    });
  }, [articleId, markRead]);

  const handleShare = async () => {
    if (!article) return;
    const url = `${window.location.origin}/dashboard/news/${article.id}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("لینک خبر کپی شد.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("اشتراک‌گذاری ممکن نشد.");
    }
  };

  const handleSave = async () => {
    if (!article) return;
    setSaving(true);
    try {
      const result = await toggleSaved({ newsId: article.id });
      toast.success(
        result.saved ? "خبر ذخیره شد." : "خبر از ذخیره‌ها حذف شد.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ذخیره خبر ممکن نشد.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell active="news">
      <div className="mb-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-9 rounded-xl px-2 text-[10.5px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <Link to="/dashboard/news">
            <ArrowRight className="size-3.5" />
            بازگشت به اخبار روز
          </Link>
        </Button>
      </div>

      {article === undefined ? (
        <div className="clay flex min-h-72 items-center justify-center rounded-[30px]">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : article === null ? (
        <div className="clay flex min-h-72 flex-col items-center justify-center rounded-[30px] p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Newspaper className="size-5" />
          </span>
          <p className="mt-3 text-sm font-extrabold">این خبر در دسترس نیست</p>
          <p className="mt-1 max-w-sm text-[11px] leading-6 text-muted-foreground">
            ممکن است حذف شده باشد یا هنوز منتشر نشده باشد.
          </p>
          <Button
            asChild
            className="clay-primary mt-4 h-10 rounded-xl border-0 px-4 text-[11px] font-bold hover:brightness-105"
          >
            <Link to="/dashboard/news">مشاهده همه اخبار</Link>
          </Button>
        </div>
      ) : (
        <article className="clay overflow-hidden rounded-[32px]">
          {article.imageUrl ? (
            <div className="relative h-56 overflow-hidden sm:h-72">
              <img
                src={article.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div className="absolute bottom-4 start-4 flex flex-wrap gap-1.5">
                {article.isUrgent && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[9.5px] font-bold text-white">
                    <Flame className="size-3" />
                    فوری
                  </span>
                )}
                {article.isDemo && (
                  <span className="rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[9.5px] font-bold text-white">
                    Demo
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "relative flex min-h-36 flex-col justify-between p-5",
                toneClass(article.category.tone),
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold opacity-70">
                <Newspaper className="size-3.5" />
                {article.category.name}
              </span>
              <div className="mt-8 flex flex-wrap gap-1.5">
                {article.isUrgent && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[9.5px] font-bold text-white">
                    <Flame className="size-3" />
                    فوری
                  </span>
                )}
                {article.isDemo && (
                  <span className="rounded-full border border-black/20 bg-white/50 px-2.5 py-1 text-[9.5px] font-bold">
                    Demo
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to={`/dashboard/news?category=${article.category.id}`}
                className="rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/15"
              >
                {article.category.name}
              </Link>
              {article.isPinned && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">
                  <Pin className="size-3" />
                  خبر مهم
                </span>
              )}
            </div>

            <h1 className="mt-3 text-xl font-extrabold leading-[1.7] tracking-tight sm:text-2xl">
              {article.title}
            </h1>
            <p className="mt-3 text-[12.5px] leading-7 text-muted-foreground">
              {article.summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/50 py-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {faDateTime(article.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Newspaper className="size-3.5" />
                {article.sourceName}
              </span>
              <span className="flex items-center gap-1.5">
                <UserRound className="size-3.5" />
                تحریریه کافی‌نت‌یار
              </span>
              {article.isDemo && (
                <Badge
                  variant="secondary"
                  className="rounded-full text-[9px] font-medium"
                >
                  محتوای نمایشی
                </Badge>
              )}
            </div>

            {article.isDemo && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3 text-[10.5px] leading-6 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                این مطلب یک داده نمونه (Demo) برای نمایش رابط است و خبر واقعی
                محسوب نمی‌شود. برای اطلاعات واقعی به منبع رسمی مراجعه کنید.
              </div>
            )}

            <div className="mt-5 space-y-4">
              {article.body
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-[12.5px] leading-8 text-foreground/90"
                  >
                    {paragraph}
                  </p>
                ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  variant="ghost"
                  className={cn(
                    "clay-sm h-10 rounded-xl border-0 px-3 text-[11px] font-semibold hover:bg-transparent hover:text-primary",
                    article.saved ? "text-primary" : "text-foreground/80",
                  )}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : article.saved ? (
                    <BookmarkCheck className="size-4" />
                  ) : (
                    <Bookmark className="size-4" />
                  )}
                  {article.saved ? "ذخیره شده" : "ذخیره خبر"}
                </Button>
                <Button
                  type="button"
                  onClick={handleShare}
                  variant="ghost"
                  className="clay-sm h-10 rounded-xl border-0 px-3 text-[11px] font-semibold text-foreground/80 hover:bg-transparent hover:text-primary"
                >
                  <Share2 className="size-4" />
                  اشتراک‌گذاری
                </Button>
              </div>
              {article.sourceUrl ? (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-primary hover:underline"
                >
                  مشاهده منبع اصلی
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  لینک منبع اصلی ثبت نشده است.
                </span>
              )}
            </div>
          </div>
        </article>
      )}
    </AppShell>
  );
}
