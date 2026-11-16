import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminPermission, requireSession } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { logAudit } from "./lib/platform";
import { assertCmsFeature } from "./lib/siteFeatures";
import { createUserNotification } from "./notifications";
import { fail, requireText } from "./lib/validation";

const CATEGORIES = ["account", "billing", "technical", "content", "other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const STATUSES = ["open", "in_progress", "closed"] as const;

const ticketCategory = v.union(
  ...CATEGORIES.map((value) => v.literal(value)),
);
const ticketPriority = v.union(
  ...PRIORITIES.map((value) => v.literal(value)),
);
const ticketStatus = v.union(...STATUSES.map((value) => v.literal(value)));

function ticketNumber() {
  return `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;
}

export const myTickets = query({
  args: {},
  handler: async (ctx) => {
    const session = await requireSession(ctx);
    if (session.isGuest) return [];
    if (session.cafe) {
      await assertCmsFeature(
        ctx,
        session.cafe._id,
        "support",
        session.isOwner ? "owner" : "employee",
      );
    }
    const rows = await ctx.db
      .query("support_tickets")
      .withIndex("by_user_updated", (q) => q.eq("userId", session.user._id))
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      id: row._id,
      number: row.number,
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      closedAt: row.closedAt ?? null,
    }));
  },
});

export const myTicket = query({
  args: { ticketId: v.id("support_tickets") },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.userId !== session.user._id) {
      fail("not_found", "تیکت پیدا نشد.");
    }
    const messages = await ctx.db
      .query("support_messages")
      .withIndex("by_ticket_created", (q) =>
        q.eq("ticketId", args.ticketId),
      )
      .order("asc")
      .collect();
    return {
      id: ticket._id,
      number: ticket.number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      lastMessageAt: ticket.lastMessageAt,
      createdAt: ticket.createdAt,
      messages: messages
        .filter((message) => !message.isInternal)
        .map((message) => ({
          id: message._id,
          body: message.body,
          isAdmin: message.authorId !== ticket.userId,
          createdAt: message.createdAt,
        })),
    };
  },
});

export const createTicket = mutation({
  args: {
    subject: v.string(),
    body: v.string(),
    category: ticketCategory,
    priority: ticketPriority,
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    if (session.isGuest) {
      fail("forbidden", "حساب مهمان نمی‌تواند تیکت پشتیبانی ثبت کند.");
    }
    if (session.cafe) {
      await assertCmsFeature(
        ctx,
        session.cafe._id,
        "support",
        session.isOwner ? "owner" : "employee",
      );
    }
    const subject = requireText(args.subject, "موضوع تیکت", 4, 160);
    const body = requireText(args.body, "متن تیکت", 10, 5000);
    if (args.priority === "urgent") {
      fail("validation", "اولویت فوری فقط توسط تیم پشتیبانی تعیین می‌شود.");
    }
    const now = Date.now();
    const number = ticketNumber();
    const ticketId = await ctx.db.insert("support_tickets", {
      number,
      userId: session.user._id,
      cafeId: session.cafe?._id,
      subject,
      category: args.category,
      priority: args.priority,
      status: "open",
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("support_messages", {
      ticketId,
      authorId: session.user._id,
      body,
      isInternal: false,
      createdAt: now,
    });
    return { ticketId, number };
  },
});

export const replyMyTicket = mutation({
  args: { ticketId: v.id("support_tickets"), body: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.userId !== session.user._id) {
      fail("not_found", "تیکت پیدا نشد.");
    }
    if (ticket.status === "closed") {
      fail("conflict", "این تیکت بسته شده است؛ برای پیگیری تیکت جدید بسازید.");
    }
    const body = requireText(args.body, "متن پاسخ", 2, 5000);
    const now = Date.now();
    await ctx.db.insert("support_messages", {
      ticketId: ticket._id,
      authorId: session.user._id,
      body,
      isInternal: false,
      createdAt: now,
    });
    await ctx.db.patch(ticket._id, {
      status: "open",
      lastMessageAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const closeMyTicket = mutation({
  args: { ticketId: v.id("support_tickets") },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.userId !== session.user._id) {
      fail("not_found", "تیکت پیدا نشد.");
    }
    if (ticket.status === "closed") return { ok: true };
    const now = Date.now();
    await ctx.db.patch(ticket._id, {
      status: "closed",
      closedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const adminList = query({
  args: {
    status: v.optional(ticketStatus),
    priority: v.optional(ticketPriority),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.SUPPORT_VIEW);
    const rows = await ctx.db
      .query("support_tickets")
      .withIndex("by_updated")
      .order("desc")
      .take(400);
    const users = await ctx.db.query("users").collect();
    const cafes = await ctx.db.query("internet_cafes").collect();
    const userById = new Map(users.map((user) => [user._id, user]));
    const cafeById = new Map(cafes.map((cafe) => [cafe._id, cafe]));
    const search = args.search?.trim().toLocaleLowerCase("fa") ?? "";
    const items = rows
      .filter((row) => {
        if (args.status && row.status !== args.status) return false;
        if (args.priority && row.priority !== args.priority) return false;
        if (!search) return true;
        const user = userById.get(row.userId);
        return `${row.number} ${row.subject} ${user?.name ?? ""} ${
          user?.phone ?? ""
        } ${row.cafeId ? cafeById.get(row.cafeId)?.name ?? "" : ""}`
          .toLocaleLowerCase("fa")
          .includes(search);
      })
      .map((row) => {
        const user = userById.get(row.userId);
        return {
          id: row._id,
          number: row.number,
          subject: row.subject,
          category: row.category,
          priority: row.priority,
          status: row.status,
          userName: user?.name ?? "کاربر حذف‌شده",
          userPhone: user?.phone ?? null,
          cafeName: row.cafeId ? cafeById.get(row.cafeId)?.name ?? null : null,
          assignedTo: row.assignedTo ?? null,
          lastMessageAt: row.lastMessageAt,
          createdAt: row.createdAt,
        };
      });
    return {
      items,
      counts: {
        total: rows.length,
        open: rows.filter((row) => row.status === "open").length,
        inProgress: rows.filter((row) => row.status === "in_progress").length,
        closed: rows.filter((row) => row.status === "closed").length,
        urgent: rows.filter(
          (row) => row.priority === "urgent" && row.status !== "closed",
        ).length,
      },
    };
  },
});

export const adminDetail = query({
  args: { ticketId: v.id("support_tickets") },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, ADMIN_PERMISSIONS.SUPPORT_VIEW);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    const user = await ctx.db.get(ticket.userId);
    const cafe = ticket.cafeId ? await ctx.db.get(ticket.cafeId) : null;
    const assigned = ticket.assignedTo
      ? await ctx.db.get(ticket.assignedTo)
      : null;
    const messages = await ctx.db
      .query("support_messages")
      .withIndex("by_ticket_created", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();
    return {
      id: ticket._id,
      number: ticket.number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      lastMessageAt: ticket.lastMessageAt,
      assignedTo: assigned?.name ?? null,
      user: {
        id: ticket.userId,
        name: user?.name ?? "کاربر حذف‌شده",
        phone: user?.phone ?? null,
      },
      cafe: cafe ? { id: cafe._id, name: cafe.name } : null,
      messages: messages.map((message) => ({
        id: message._id,
        body: message.body,
        isInternal: message.isInternal,
        isAdmin: message.authorId !== ticket.userId,
        createdAt: message.createdAt,
      })),
    };
  },
});

export const adminLogAccess = mutation({
  args: { ticketId: v.id("support_tickets") },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SUPPORT_VIEW,
    );
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "support.viewed",
      entityType: "support_ticket",
      entityId: ticket._id,
      cafeId: ticket.cafeId,
      summary: `مکالمه تیکت ${ticket.number} توسط تیم پشتیبانی مشاهده شد.`,
    });
    return { ok: true };
  },
});

export const adminReply = mutation({
  args: {
    ticketId: v.id("support_tickets"),
    body: v.string(),
    isInternal: v.boolean(),
    setStatus: v.optional(ticketStatus),
  },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    );
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    if (ticket.status === "closed" && !args.setStatus) {
      fail("conflict", "تیکت بسته است؛ ابتدا وضعیت را تغییر دهید.");
    }
    const body = requireText(args.body, "متن پاسخ", 2, 5000);
    const now = Date.now();
    await ctx.db.insert("support_messages", {
      ticketId: ticket._id,
      authorId: session.user._id,
      body,
      isInternal: args.isInternal,
      createdAt: now,
    });
    await ctx.db.patch(ticket._id, {
      status: args.setStatus ?? (ticket.status === "open" ? "in_progress" : ticket.status),
      priority: ticket.priority,
      assignedTo: ticket.assignedTo ?? session.user._id,
      lastMessageAt: now,
      updatedAt: now,
    });
    if (!args.isInternal) {
      await createUserNotification(ctx, {
        userId: ticket.userId,
        cafeId: ticket.cafeId,
        kind: "support",
        title: `پاسخ جدید به تیکت ${ticket.number}`,
        body: "تیم پشتیبانی به تیکت شما پاسخ داده است. برای مشاهده متن کامل وارد بخش پشتیبانی شوید.",
        href: "/dashboard/support",
      });
    }
    await logAudit(ctx, {
      actorId: session.user._id,
      action: args.isInternal ? "support.note_added" : "support.replied",
      entityType: "support_ticket",
      entityId: ticket._id,
      cafeId: ticket.cafeId,
      summary: `${args.isInternal ? "یادداشت داخلی" : "پاسخ"} برای تیکت ${ticket.number} ثبت شد.`,
    });
    return { ok: true };
  },
});

export const adminSetStatus = mutation({
  args: { ticketId: v.id("support_tickets"), status: ticketStatus },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    );
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    const now = Date.now();
    await ctx.db.patch(ticket._id, {
      status: args.status,
      closedAt: args.status === "closed" ? now : undefined,
      updatedAt: now,
      assignedTo: ticket.assignedTo ?? session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "support.status_changed",
      entityType: "support_ticket",
      entityId: ticket._id,
      cafeId: ticket.cafeId,
      summary: `وضعیت تیکت ${ticket.number} به ${args.status} تغییر کرد.`,
    });
    return { ok: true };
  },
});

export const adminSetCategory = mutation({
  args: { ticketId: v.id("support_tickets"), category: ticketCategory },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    );
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    await ctx.db.patch(ticket._id, {
      category: args.category,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "support.category_changed",
      entityType: "support_ticket",
      entityId: ticket._id,
      cafeId: ticket.cafeId,
      summary: `دسته تیکت ${ticket.number} به ${args.category} تغییر کرد.`,
    });
    return { ok: true };
  },
});

export const adminSetPriority = mutation({
  args: { ticketId: v.id("support_tickets"), priority: ticketPriority },
  handler: async (ctx, args) => {
    const session = await requireAdminPermission(
      ctx,
      ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    );
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) fail("not_found", "تیکت پیدا نشد.");
    await ctx.db.patch(ticket._id, {
      priority: args.priority,
      updatedAt: Date.now(),
      assignedTo: ticket.assignedTo ?? session.user._id,
    });
    await logAudit(ctx, {
      actorId: session.user._id,
      action: "support.priority_changed",
      entityType: "support_ticket",
      entityId: ticket._id,
      cafeId: ticket.cafeId,
      summary: `اولویت تیکت ${ticket.number} به ${args.priority} تغییر کرد.`,
    });
    return { ok: true };
  },
});
