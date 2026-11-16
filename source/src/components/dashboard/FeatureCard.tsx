import { notifySoon } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";

type ClayTone = "navy" | "mint" | "peach" | "lilac";

const toneClass: Record<ClayTone, string> = {
  navy: "tile-navy",
  mint: "tile-mint",
  peach: "tile-peach",
  lilac: "tile-lilac",
};

export function FeatureCard({
  title,
  description,
  icon: Icon,
  tone,
  status,
  highlighted = false,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: ClayTone;
  status: string;
  highlighted?: boolean;
  href?: string;
  ctaLabel: string;
}) {
  const content = (
    <div
      className={cn(
        "clay clay-lift relative flex h-full flex-col overflow-hidden rounded-[30px] p-5 sm:p-6",
        highlighted && "clay-primary",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -end-10 -top-12 size-32 rounded-full blur-2xl",
          highlighted ? "bg-white/20" : "bg-primary/10",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-14 place-items-center rounded-[18px] shadow-[inset_0_-2px_4px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.7)]",
            highlighted ? "bg-white/15 text-white" : toneClass[tone],
          )}
        >
          <Icon className="size-6" strokeWidth={1.8} />
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold",
            highlighted
              ? "bg-white/15 text-white"
              : "bg-muted/80 text-muted-foreground",
          )}
        >
          {status}
        </span>
      </div>

      <h3
        className={cn(
          "relative mt-5 text-lg font-extrabold tracking-tight",
          highlighted && "text-white",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "relative mt-2 flex-1 text-[12.5px] leading-6",
          highlighted ? "text-white/80" : "text-muted-foreground",
        )}
      >
        {description}
      </p>

      <div
        className={cn(
          "relative mt-5 flex items-center justify-between border-t pt-3.5 text-[11.5px] font-semibold",
          highlighted
            ? "border-white/20 text-white"
            : "border-border/60 text-primary",
        )}
      >
        <span>{ctaLabel}</span>
        <ChevronLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
      </div>
    </div>
  );

  return (
    <article className="group relative h-full">
      {content}
      {href ? (
        <Link
          to={href}
          aria-label={title}
          className="absolute inset-0 rounded-[30px] outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">{title}</span>
        </Link>
      ) : (
        <button
          type="button"
          aria-label={title}
          onClick={() => notifySoon(title)}
          className="absolute inset-0 rounded-[30px] outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">{title}</span>
        </button>
      )}
    </article>
  );
}
