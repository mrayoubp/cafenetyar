import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { getSessionForUser } from "./lib/access";
import { ADMIN_PERMISSIONS } from "./lib/adminPermissions";
import { fail } from "./lib/validation";

/** Action-safe admin check; actions cannot read the database directly. */
export const assertAdmin = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await getSessionForUser(ctx, args.userId);
    if (
      !session?.isSiteAdmin ||
      session.isBlocked ||
      (!session.isSuperAdmin &&
        !session.adminPermissions.includes(ADMIN_PERMISSIONS.FINANCE_MANAGE))
    ) {
      fail("forbidden", "نقش مدیریتی شما به عملیات مالی دسترسی ندارد.");
    }
    return true;
  },
});
