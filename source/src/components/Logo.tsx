import { useManagedSettings } from "@/hooks/use-managed-content";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";

export function LogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const originalProfile = useQuery(api.platformAdmin.publicProfile, {});
  const managed = useManagedSettings();
  const profile = { platformName: managed.title || originalProfile?.platformName || "کافی‌نت‌یار", tagline: managed.tagline || originalProfile?.tagline, logoUrl: managed.logo || originalProfile?.logoUrl };
  const dimensions =
    size === "sm"
      ? "size-9 rounded-[12px]"
      : size === "lg"
        ? "size-14 rounded-[20px]"
        : "size-11 rounded-[16px]";

  return (
    <span
      className={cn(
        "clay-primary relative grid shrink-0 place-items-center",
        dimensions,
        className,
      )}
    >
      <span className="absolute inset-x-2 top-1 h-2 rounded-full bg-white/20 blur-[3px]" />
      {profile?.logoUrl ? (
        <img
          src={profile.logoUrl}
          alt={profile.platformName}
          className="size-full rounded-[inherit] object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[62%]"
          aria-hidden="true"
        >
          <rect x="2.8" y="4" width="18.4" height="12.4" rx="3.4" />
          <path d="M8.6 20.2h6.8M12 16.4v3.8" />
          <path d="m8.9 10.2 2 2 4.3-4.2" />
        </svg>
      )}
    </span>
  );
}

export function Logo({
  size = "md",
  showTagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  const originalProfile = useQuery(api.platformAdmin.publicProfile, {});
  const managed = useManagedSettings();
  const profile = { platformName: managed.title || originalProfile?.platformName || "کافی‌نت‌یار", tagline: managed.tagline || originalProfile?.tagline, logoUrl: managed.logo || originalProfile?.logoUrl };
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-extrabold tracking-tight text-foreground",
            size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg",
          )}
        >
          {profile?.platformName ?? "کافی‌نت‌یار"}
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {profile?.tagline ?? "دستیار مدیریت کافی‌نت"}
          </span>
        )}
      </span>
    </span>
  );
}
