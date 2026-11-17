import { MonthlyPlanCard } from "@/components/MonthlyPlanCard";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router";

export default function CmsPage() {
  const { slug = "" } = useParams();
  const page = useQuery(api.siteCms.publicPageBySlug, slug === "plans" ? "skip" : { slug });

  return (
    <PublicShell>
      {slug === "plans" ? (
        <section className="space-y-6"><h1 className="text-center text-2xl font-extrabold">خرید اشتراک کافی‌نت‌یار</h1><MonthlyPlanCard /></section>
      ) : page === undefined ? (
        <div className="clay flex justify-center rounded-[30px] p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : page === null ? (
        <div className="clay rounded-[30px] p-8 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold">این صفحه منتشر نشده است</h1>
          <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
            ممکن است صفحه در حال ویرایش باشد یا نشانی آن تغییر کرده باشد.
          </p>
          <Button asChild className="clay-primary mt-5 h-10 rounded-xl border-0 text-[11px] font-bold">
            <Link to="/">
              بازگشت به صفحه اصلی
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : (
        <article className="mx-auto max-w-3xl space-y-5">
          <header className="clay rounded-[32px] p-6 sm:p-8">
            <Badge variant="secondary" className="rounded-full text-[9.5px]">
              صفحه رسمی کافی‌نت‌یار
            </Badge>
            <h1 className="mt-4 text-2xl font-black leading-[1.6] sm:text-3xl">
              {page.title}
            </h1>
            {page.summary && (
              <p className="mt-3 text-[12px] leading-7 text-muted-foreground">
                {page.summary}
              </p>
            )}
          </header>

          {page.imageUrls.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {page.imageUrls.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt={page.title}
                  loading="lazy"
                  className="clay aspect-video w-full rounded-[24px] object-cover"
                />
              ))}
            </div>
          )}

          <section className="clay rounded-[30px] p-6 sm:p-8">
            <div className="space-y-4 text-[12px] leading-8 text-foreground/85">
              {page.body.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        </article>
      )}
    </PublicShell>
  );
}
