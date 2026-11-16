import { isPermissionKey, type PermissionKey } from "../permissions";
import { fail } from "./validation";

/** Validates a permission list coming from a client and removes duplicates. */
export function sanitizePermissions(values: string[]): PermissionKey[] {
  const unique: PermissionKey[] = [];
  for (const value of values) {
    if (!isPermissionKey(value)) {
      fail("validation", "یکی از مجوزهای انتخاب‌شده معتبر نیست.");
    }
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
}

/**
 * Employees with `employees.manage` may only grant permissions they already
 * hold themselves; owners may grant anything. This prevents privilege
 * escalation through the employee editor.
 */
export function assertCanGrant(
  actorPermissions: PermissionKey[],
  nextPermissions: PermissionKey[],
  isOwner: boolean,
) {
  if (isOwner) return;
  const missing = nextPermissions.filter(
    (permission) => !actorPermissions.includes(permission),
  );
  if (missing.length > 0) {
    fail(
      "forbidden",
      "نمی‌توانید مجوزی را به کارمند بدهید که خودتان آن را ندارید.",
    );
  }
}

export function canManageEmployees(
  isOwner: boolean,
  permissions: PermissionKey[],
) {
  return isOwner || permissions.includes("employees.manage");
}
