import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertCafeActive,
  requireOwner,
  requirePermission,
} from "./lib/access";
import { logAudit } from "./lib/platform";
import { assertCmsFeature } from "./lib/siteFeatures";
import { fail, requireText } from "./lib/validation";
import {
  ACCOUNTING_CATEGORIES,
  ACCOUNTING_PAYMENT_METHODS,
  type AccountingDirection,
} from "../lib/accounting";
import { PERMISSIONS } from "./permissions";

const DAY = 24 * 60 * 60 * 1000;
const IRAN_OFFSET = 3.5 * 60 * 60 * 1000;
const MAX_AMOUNT_TOMAN = 1_000_000_000;
const RECENT_LIMIT = 1_000;

function directionLabel(direction: AccountingDirection) {
  return direction === "income" ? "درآمد" : "هزینه";
}

function startOfIranDay(timestamp: number) {
  const local = timestamp + IRAN_OFFSET;
  return Math.floor(local / DAY) * DAY - IRAN_OFFSET;
}

function rowFor(row: Doc<"accounting_transactions">) {
  return {
    id: row._id,
    title: row.title,
    direction: row.direction,
    category: row.category,
    method: row.method,
    amountToman: row.amountToman,
    note: row.note ?? null,
    occurredAt: row.occurredAt,
    operatorName: row.operatorName,
    isVoided: row.voidedAt !== undefined,
    createdAt: row.createdAt,
  };
}

function optionalNote(value: string | undefined) {
  const note = value?.trim() ?? "";
  if (!note) return undefined;
  if (note.length > 500) {
    fail("validation", "یادداشت نباید بیشتر از ۵۰۰ نویسه باشد.");
  }
  return note;
}

function validateOccurredAt(value: number | undefined) {
  const occurredAt = value ?? Date.now();
  if (!Number.isFinite(occurredAt)) {
    fail("validation", "تاریخ تراکنش معتبر نیست.");
  }
  const now = Date.now();
  if (occurredAt > now + 5 * 60 * 1000) {
    fail("validation", "تاریخ تراکنش نمی‌تواند در آینده باشد.");
  }
  if (occurredAt < now - 5 * 365 * DAY) {
    fail("validation", "تاریخ تراکنش بیش از پنج سال گذشته است.");
  }
  return occurredAt;
}

/**
 * Returns the newest ledger rows for the signed-in cafe only. The tenant is
 * always derived from the session; no client-supplied cafe id is accepted.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const session = await requirePermission(ctx, PERMISSIONS.ACCOUNTING_VIEW);
    assertCafeActive(session.cafe);
    await assertCmsFeature(
      ctx,
      session.cafe._id,
      "accounting",
      session.isOwner ? "owner" : "employee",
    );
    const rows = await ctx.db
      .query("accounting_transactions")
      .withIndex("by_cafe_occurred", (q) => q.eq("cafeId", session.cafe._id))
      .order("desc")
      .take(RECENT_LIMIT);
    const active = rows.filter((row) => row.voidedAt === undefined);
    const now = Date.now();
    const todayStart = startOfIranDay(now);
    const weekStart = startOfIranDay(now - 6 * DAY);
    let incomeToman = 0;
    let expenseToman = 0;
    let todayIncomeToman = 0;
    let todayExpenseToman = 0;
    let weekIncomeToman = 0;
    let weekExpenseToman = 0;
    for (const row of active) {
      if (row.direction === "income") {
        incomeToman += row.amountToman;
        if (row.occurredAt >= todayStart) todayIncomeToman += row.amountToman;
        if (row.occurredAt >= weekStart) weekIncomeToman += row.amountToman;
      } else {
        expenseToman += row.amountToman;
        if (row.occurredAt >= todayStart) todayExpenseToman += row.amountToman;
        if (row.occurredAt >= weekStart) weekExpenseToman += row.amountToman;
      }
    }
    return {
      items: rows.map(rowFor),
      summary: {
        incomeToman,
        expenseToman,
        balanceToman: incomeToman - expenseToman,
        todayIncomeToman,
        todayExpenseToman,
        weekIncomeToman,
        weekExpenseToman,
        count: active.length,
        voidedCount: rows.length - active.length,
        limitedTo: RECENT_LIMIT,
      },
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    direction: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    method: v.string(),
    amountToman: v.number(),
    note: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requirePermission(
      ctx,
      PERMISSIONS.TRANSACTIONS_WRITE,
    );
    assertCafeActive(session.cafe);
    await assertCmsFeature(
      ctx,
      session.cafe._id,
      "accounting",
      session.isOwner ? "owner" : "employee",
    );
    const title = requireText(args.title, "عنوان تراکنش", 3, 120);
    if (!(ACCOUNTING_CATEGORIES as readonly string[]).includes(args.category)) {
      fail("validation", "دسته تراکنش معتبر نیست.");
    }
    if (
      !(ACCOUNTING_PAYMENT_METHODS as readonly string[]).includes(args.method)
    ) {
      fail("validation", "روش پرداخت معتبر نیست.");
    }
    const amount = Math.round(args.amountToman);
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > MAX_AMOUNT_TOMAN
    ) {
      fail("validation", "مبلغ تراکنش باید بین ۱ و ۱٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.");
    }
    const occurredAt = validateOccurredAt(args.occurredAt);
    const note = optionalNote(args.note);
    const now = Date.now();
    const operatorName =
      session.user.name?.trim() ||
      (session.isOwner ? "صاحب کافی‌نت" : "همکار کافی‌نت");
    const transactionId = await ctx.db.insert("accounting_transactions", {
      cafeId: session.cafe._id,
      title,
      direction: args.direction,
      category: args.category,
      method: args.method,
      amountToman: amount,
      note,
      occurredAt,
      operatorName,
      createdBy: session.user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "accounting.transaction_created",
      entityType: "accounting_transaction",
      entityId: transactionId,
      cafeId: session.cafe._id,
      summary: `${directionLabel(args.direction)} ${title} ثبت شد.`,
      metadata: JSON.stringify({ amountToman: amount, category: args.category }),
    });
    return { transactionId };
  },
});

/**
 * Financial rows are never hard-deleted. Only the cafe owner may void a row,
 * and the original amount/title remain available to the audit trail.
 */
export const voidTransaction = mutation({
  args: { transactionId: v.id("accounting_transactions") },
  handler: async (ctx, args) => {
    const session = await requireOwner(ctx);
    assertCafeActive(session.cafe);
    await assertCmsFeature(ctx, session.cafe._id, "accounting", "owner");
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction || transaction.cafeId !== session.cafe._id) {
      fail("not_found", "تراکنش پیدا نشد.");
    }
    if (transaction.voidedAt !== undefined) {
      return { ok: true };
    }
    const now = Date.now();
    await ctx.db.patch(transaction._id, {
      voidedAt: now,
      voidedBy: session.user._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "accounting.transaction_voided",
      entityType: "accounting_transaction",
      entityId: transaction._id,
      cafeId: session.cafe._id,
      summary: `تراکنش «${transaction.title}» ابطال شد.`,
      metadata: JSON.stringify({ amountToman: transaction.amountToman }),
    });
    return { ok: true };
  },
});
