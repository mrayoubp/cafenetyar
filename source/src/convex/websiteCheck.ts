"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { normalizeWebsiteUrl } from "./lib/websites";

type CheckResult = {
  ok: boolean;
  status: number | null;
  message: string;
  checkedAt: number;
};

async function checkUrl(rawUrl: string): Promise<CheckResult> {
  let currentUrl: string;
  try {
    currentUrl = normalizeWebsiteUrl(rawUrl, "آدرس سامانه");
  } catch (error) {
    return {
      ok: false,
      status: null,
      message:
        error instanceof Error ? error.message : "آدرس سامانه معتبر نیست.",
      checkedAt: Date.now(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const candidate = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          range: "bytes=0-2048",
          "user-agent":
            "Mozilla/5.0 (compatible; KafinetYar-LinkCheck/1.0; +admin-link-review)",
        },
      });
      if (
        [301, 302, 303, 307, 308].includes(candidate.status) &&
        candidate.headers.get("location")
      ) {
        await candidate.body?.cancel().catch(() => undefined);
        try {
          currentUrl = normalizeWebsiteUrl(
            new URL(candidate.headers.get("location")!, currentUrl).toString(),
          );
        } catch {
          return {
            ok: false,
            status: candidate.status,
            message: "مقصد ریدایرکت، یک دامنه عمومی معتبر نیست.",
            checkedAt: Date.now(),
          };
        }
        continue;
      }
      response = candidate;
      break;
    }
    if (!response) {
      return {
        ok: false,
        status: null,
        message: "تعداد ریدایرکت‌های این نشانی بیش از حد مجاز است.",
        checkedAt: Date.now(),
      };
    }
    await response.body?.cancel().catch(() => undefined);
    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      status: response.status,
      message: ok
        ? `نشانی پاسخ داد (HTTP ${response.status}).`
        : `نشانی پاسخ ناموفق داد (HTTP ${response.status}).`,
      checkedAt: Date.now(),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "بررسی نشانی بیش از حد طول کشید."
          : "اتصال به نشانی سامانه برقرار نشد. ممکن است سایت دسترسی سرور را محدود کرده باشد.",
      checkedAt: Date.now(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Optional admin helper: checks whether the stored URL answers publicly and
 * records the result. Verification remains a human decision.
 */
export const checkWebsite = action({
  args: { websiteId: v.id("websites") },
  handler: async (ctx, args): Promise<CheckResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ok: false,
        status: null,
        message: "برای بررسی لینک باید وارد شوید.",
        checkedAt: Date.now(),
      };
    }
    const snapshot = await ctx.runQuery(internal.tenancy.permissionSnapshot, {
      userId,
    });
    if (
      !snapshot?.isSiteAdmin ||
      snapshot.isBlocked ||
      (!snapshot.isSuperAdmin &&
        !snapshot.adminPermissions.includes(ADMIN_PERMISSIONS.CONTENT_MANAGE))
    ) {
      return {
        ok: false,
        status: null,
        message: "نقش مدیریتی شما اجازه بررسی لینک را ندارد.",
        checkedAt: Date.now(),
      };
    }
    const website = await ctx.runQuery(
      internal.websitesAdmin.websiteForCheck,
      { websiteId: args.websiteId },
    );
    const result = await checkUrl(website.url);
    await ctx.runMutation(internal.websitesAdmin.recordWebsiteCheck, {
      websiteId: args.websiteId,
      status: result.status,
      ok: result.ok,
    });
    return result;
  },
});
