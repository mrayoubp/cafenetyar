import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { fail } from "./lib/validation";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Loads the active recovery record and records an attempt. The plaintext code
 * never reaches the database; only its salted hash does.
 */
export const beginReset = internalMutation({
  args: { userId: v.id("users"), phone: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("recovery_codes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const record = records
      .filter((item) => item.usedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!record) {
      fail(
        "invalid_recovery",
        "اطلاعات بازیابی درست نیست. شماره موبایل و کد بازیابی را بررسی کنید.",
      );
    }
    if (record.phone !== args.phone) {
      fail(
        "invalid_recovery",
        "اطلاعات بازیابی درست نیست. شماره موبایل و کد بازیابی را بررسی کنید.",
      );
    }

    const now = Date.now();
    const windowExpired =
      record.lastAttemptAt !== undefined &&
      now - record.lastAttemptAt > WINDOW_MS;
    const attempts = windowExpired ? 0 : record.attempts;

    if (attempts >= MAX_ATTEMPTS) {
      fail(
        "rate_limited",
        "تلاش‌های ناموفق زیاد بوده است. ۱۵ دقیقه دیگر دوباره امتحان کنید.",
      );
    }

    await ctx.db.patch(record._id, {
      attempts: attempts + 1,
      lastAttemptAt: now,
    });

    return { codeHash: record.codeHash, salt: record.salt };
  },
});

/** Marks old codes as used and stores the newly generated one. */
export const finishReset = internalMutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    codeHash: v.string(),
    salt: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("recovery_codes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    for (const record of records) {
      if (!record.usedAt) {
        await ctx.db.patch(record._id, { usedAt: now });
      }
    }
    await ctx.db.insert("recovery_codes", {
      userId: args.userId,
      phone: args.phone,
      codeHash: args.codeHash,
      salt: args.salt,
      attempts: 0,
      createdAt: now,
    });
  },
});

/** Replaces the recovery code for an already signed-in account. */
export const replaceCode = internalMutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    codeHash: v.string(),
    salt: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("recovery_codes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    for (const record of records) {
      if (!record.usedAt) {
        await ctx.db.patch(record._id, { usedAt: now });
      }
    }
    await ctx.db.insert("recovery_codes", {
      userId: args.userId,
      phone: args.phone,
      codeHash: args.codeHash,
      salt: args.salt,
      attempts: 0,
      createdAt: now,
    });
  },
});
