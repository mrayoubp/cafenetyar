import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_DEFINITIONS,
} from "./adminPermissions";
import { ensureSiteDefaults } from "./siteCms";
import { normalizePhone } from "./validation";

export const PLATFORM_SETTINGS_KEY = "default";

/**
 * The one-time site-admin bootstrap is limited to a phone number controlled by
 * the deployment owner. Without this server-side setting, no account can claim
 * the role even if it is the first registered account.
 */
export function configuredAdminBootstrapPhone(): string | null {
  const raw = process.env.SITE_ADMIN_BOOTSTRAP_PHONE?.trim();
  return raw ? normalizePhone(raw) : null;
}

export async function ensurePlatformDefaults(ctx: MutationCtx) {
  const now = Date.now();
  const settings = await ctx.db
    .query("platform_settings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
    .first();
  if (!settings) {
    await ctx.db.insert("platform_settings", {
      key: PLATFORM_SETTINGS_KEY,
      platformName: "کافی‌نت‌یار",
      tagline: "دستیار هوشمند مدیریت کافی‌نت",
      timezone: "Asia/Tehran",
      locale: "fa-IR",
      defaultTheme: "system",
      registrationEnabled: false,
      notificationsEnabled: true,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
      maintenanceMode: false,
      aiEnabled: true,
      aiModel: "openai/gpt-4o-mini",
      aiCostPerRequestToman: 0,
      backupSchedule: "daily",
      updatedAt: now,
    });
  }

  for (const [index, permission] of ADMIN_PERMISSION_DEFINITIONS.entries()) {
    const existing = await ctx.db
      .query("admin_permissions")
      .withIndex("by_key", (q) => q.eq("key", permission.key))
      .first();
    if (!existing) {
      await ctx.db.insert("admin_permissions", {
        key: permission.key,
        label: permission.label,
        description: permission.description,
        sortOrder: index,
        isActive: true,
      });
    } else if (
      existing.label !== permission.label ||
      existing.description !== permission.description ||
      existing.sortOrder !== index
    ) {
      await ctx.db.patch(existing._id, {
        label: permission.label,
        description: permission.description,
        sortOrder: index,
      });
    }
  }

  for (const definition of ADMIN_ROLE_DEFINITIONS) {
    let role = await ctx.db
      .query("admin_roles")
      .withIndex("by_key", (q) => q.eq("key", definition.key))
      .first();
    if (!role) {
      const roleId = await ctx.db.insert("admin_roles", {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        isSystem: definition.isSystem,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      role = await ctx.db.get(roleId);
    }
    if (!role) continue;
    const existingPermissions = await ctx.db
      .query("admin_role_permissions")
      .withIndex("by_role", (q) => q.eq("roleId", role!._id))
      .collect();
    if (existingPermissions.length === 0) {
      for (const permissionKey of definition.permissions) {
        await ctx.db.insert("admin_role_permissions", {
          roleId: role._id,
          permissionKey,
          createdAt: now,
        });
      }
    }
  }

  await ensureSiteDefaults(ctx);
}

export async function logAudit(
  ctx: MutationCtx,
  args: {
    actorId: Id<"users">;
    action: string;
    entityType: string;
    entityId?: string;
    cafeId?: Id<"internet_cafes">;
    summary: string;
    metadata?: string;
  },
) {
  await ctx.db.patch(args.actorId, { lastActivityAt: Date.now() });
  await ctx.db.insert("audit_logs", {
    actorId: args.actorId,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    cafeId: args.cafeId,
    summary: args.summary,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}
