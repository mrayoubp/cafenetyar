import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getSession, requireSession } from "./lib/access";
import { fail } from "./lib/validation";

const DAY = 24 * 60 * 60 * 1000;

/** Internal helper used by support, billing and scheduled jobs. */
export async function createUserNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    cafeId?: Id<"internet_cafes">;
    kind: "support" | "billing" | "news" | "rates" | "account" | "system";
    title: string;
    body: string;
    href?: string;
    createdAt?: number;
  },
) {
  await ctx.db.insert("user_notifications", {
    userId: args.userId,
    cafeId: args.cafeId,
    kind: args.kind,
    title: args.title.slice(0, 160),
    body: args.body.slice(0, 1000),
    href: args.href,
    isRead: false,
    createdAt: args.createdAt ?? Date.now(),
  });
}

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const session = await getSession(ctx);
    if (!session) return { items: [], unread: 0 };
    const rows = await ctx.db
      .query("user_notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", session.user._id))
      .order("desc")
      .take(30);
    return {
      items: rows.map((row) => ({
        id: row._id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        href: row.href ?? null,
        isRead: row.isRead,
        createdAt: row.createdAt,
      })),
      unread: rows.filter((row) => !row.isRead).length,
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("user_notifications") },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== session.user._id) {
      fail("not_found", "اعلان پیدا نشد.");
    }
    if (!row.isRead) await ctx.db.patch(row._id, { isRead: true });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    const rows = await ctx.db
      .query("user_notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", session.user._id).eq("isRead", false),
      )
      .take(100);
    for (const row of rows) {
      await ctx.db.patch(row._id, { isRead: true });
    }
    return { updated: rows.length };
  },
});

/**
 * Daily in-app reminder for subscriptions ending within seven days. It does
 * not send email/SMS and never changes billing state; it only creates a
 * notification after checking that a similar reminder was not already sent.
 */
export const generateRenewalReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const until = now + 7 * DAY;
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_ends_at", (q) =>
        q.gte("endsAt", now - DAY).lt("endsAt", until),
      )
      .take(250);
    let created = 0;
    for (const subscription of subscriptions) {
      if (subscription.status !== "active" && subscription.status !== "trial") {
        continue;
      }
      const cafe = await ctx.db.get(subscription.cafeId);
      if (!cafe || cafe.status === "suspended") continue;
      const recent = await ctx.db
        .query("user_notifications")
        .withIndex("by_user_created", (q) => q.eq("userId", cafe.ownerId))
        .order("desc")
        .take(80);
      const duplicate = recent.some(
        (item) =>
          item.kind === "billing" &&
          item.cafeId === cafe._id &&
          item.createdAt > now - 7 * DAY,
      );
      if (duplicate) continue;
      const days = Math.ceil((subscription.endsAt - now) / DAY);
      const expired = subscription.endsAt <= now;
      await createUserNotification(ctx, {
        userId: cafe.ownerId,
        cafeId: cafe._id,
        kind: "billing",
        title: expired ? "اشتراک کافی‌نت پایان یافته است" : "زمان تمدید اشتراک نزدیک است",
        body: expired
          ? "دوره فعلی اشتراک به پایان رسیده است. برای ادامه دسترسی به امکانات پلن، وضعیت اشتراک را بررسی کنید."
          : `تا ${Math.max(1, days)} روز دیگر دوره اشتراک تمام می‌شود. برای جلوگیری از محدودیت، تمدید را بررسی کنید.`,
        href: "/dashboard/subscription",
        createdAt: now,
      });
      created += 1;
    }
    return { created };
  },
});
