import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery } from "@/backend/client";
import { useSyncExternalStore } from "react";
import { api } from "@/backend/api";

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const site = useQuery(api.siteCms.publicSite, {});
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";
  if (site && !site.theme.darkModeEnabled) return null;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "تغییر به تم روشن" : "تغییر به تم تاریک"}
      title={isDark ? "تم روشن" : "تم تاریک"}
      className={`clay-sm clay-lift grid size-11 shrink-0 place-items-center rounded-2xl text-foreground/70 hover:text-primary ${className ?? ""}`}
    >
      {isDark ? (
        <Sun className="size-[19px]" />
      ) : (
        <Moon className="size-[19px]" />
      )}
    </button>
  );
}
