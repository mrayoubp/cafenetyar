import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSION_DEFINITIONS,
  type PermissionKey,
} from "@/convex/permissions";
import { cn } from "@/lib/utils";

export function PermissionPicker({
  value,
  onChange,
  disabled = false,
  allowedKeys,
}: {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
  /** Employees can only be granted permissions their manager holds. */
  allowedKeys?: PermissionKey[];
}) {
  const toggle = (key: PermissionKey) => {
    if (value.includes(key)) {
      onChange(value.filter((item) => item !== key));
    } else {
      onChange([...value, key]);
    }
  };

  return (
    <div className="space-y-2">
      {PERMISSION_DEFINITIONS.map((permission) => {
        const blockedByRole =
          allowedKeys !== undefined && !allowedKeys.includes(permission.key);
        const unavailable = !permission.available;
        // Future permissions can still be assigned; the feature is simply not
        // live yet. Only the manager's own permission ceiling blocks a toggle.
        const isDisabled = disabled || blockedByRole;
        return (
          <label
            key={permission.key}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[16px] border border-border/50 bg-card/60 p-3 transition-colors",
              isDisabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-primary/30 hover:bg-primary/[0.04]",
            )}
          >
            <Checkbox
              checked={value.includes(permission.key)}
              onCheckedChange={() => toggle(permission.key)}
              disabled={isDisabled}
              className="mt-0.5 rounded-[5px]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-bold">{permission.label}</span>
                {unavailable && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                    به‌زودی
                  </span>
                )}
                {blockedByRole && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                    خارج از دسترسی شما
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">
                {permission.description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
