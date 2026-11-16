"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { fail } from "./lib/validation";
import { assertPublicFeedUrl, parseFeed } from "./lib/rss";

/**
 * Fetches an admin-configured RSS feed and stores every item as `pending`.
 * Nothing reaches readers until the site administrator reviews and publishes
 * it, and duplicates are ignored by source + guid/link.
 */
export const fetchSource = action({
  args: { sourceId: v.id("news_sources") },
  handler: async (
    ctx,
    args,
  ): Promise<{ imported: number; skipped: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("unauthenticated", "برای این کار باید وارد شوید.");
    const snapshot = await ctx.runQuery(
      internal.tenancy.permissionSnapshot,
      { userId },
    );
    if (
      !snapshot?.isSiteAdmin ||
      snapshot.isBlocked ||
      (!snapshot.isSuperAdmin &&
        !snapshot.adminPermissions.includes(ADMIN_PERMISSIONS.CONTENT_MANAGE))
    ) {
      fail("forbidden", "نقش مدیریتی شما اجازه دریافت خبر را ندارد.");
    }

    const source = await ctx.runQuery(internal.newsAdmin.sourceForIngest, {
      sourceId: args.sourceId,
    });
    if (source.kind !== "rss") {
      fail(
        "validation",
        "در این نسخه فقط دریافت RSS پیاده‌سازی شده است؛ نوع منبع را RSS انتخاب کنید.",
      );
    }

    let feedUrl: string;
    try {
      feedUrl = assertPublicFeedUrl(source.url);
    } catch (error) {
      fail(
        "validation",
        error instanceof Error ? error.message : "نشانی فید معتبر نیست.",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      let response: Response | null = null;
      let currentUrl = feedUrl;
      // Follow a small number of redirects manually so a public feed cannot
      // redirect the server into a private/internal address.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            "user-agent":
              "KafinetYar-Newsroom/1.0 (+admin-approved RSS reader)",
          },
        });
        if (
          [301, 302, 303, 307, 308].includes(candidate.status) &&
          candidate.headers.get("location")
        ) {
          try {
            currentUrl = assertPublicFeedUrl(
              new URL(candidate.headers.get("location")!, currentUrl).toString(),
            );
          } catch (error) {
            fail(
              "validation",
              error instanceof Error
                ? error.message
                : "نشانی مقصد فید معتبر نیست.",
            );
          }
          continue;
        }
        response = candidate;
        break;
      }
      if (!response) {
        throw new Error("تعداد ریدایرکت‌های منبع بیش از حد مجاز است.");
      }
      if (!response.ok) {
        throw new Error(`پاسخ ناموفق منبع: HTTP ${response.status}`);
      }
      const length = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > 2_000_000) {
        throw new Error("حجم پاسخ منبع بیش از حد مجاز است.");
      }
      const text = (await response.text()).slice(0, 2_000_000);
      const items = parseFeed(text);
      if (items.length === 0) {
        fail(
          "validation",
          "در پاسخ این فید هیچ آیتم قابل خواندنی پیدا نشد. نشانی RSS را بررسی کنید.",
        );
      }
      const result: { imported: number; skipped: number } =
        await ctx.runMutation(internal.newsAdmin.importItems, {
          sourceId: args.sourceId as Id<"news_sources">,
          actorId: userId,
          items,
        });
      return result;
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "دریافت فید بیش از حد طول کشید."
          : error instanceof Error
            ? error.message
            : "دریافت فید ممکن نشد.";
      await ctx.runMutation(internal.newsAdmin.recordFetchError, {
        sourceId: args.sourceId,
        message,
      });
      fail("server", message);
    } finally {
      clearTimeout(timer);
    }
  },
});
