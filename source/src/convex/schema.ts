import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const cafeStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
);
export type CafeStatus = Infer<typeof cafeStatusValidator>;

export const subscriptionStatusValidator = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("canceled"),
  v.literal("pending_payment"),
);
export type SubscriptionStatus = Infer<typeof subscriptionStatusValidator>;

export const billingCycleValidator = v.union(
  v.literal("monthly"),
  v.literal("yearly"),
);
export type BillingCycle = Infer<typeof billingCycleValidator>;

export const planEntitlementsValidator = v.object({
  maxEmployees: v.number(),
  aiRequestsPerMonth: v.number(),
  agent: v.boolean(),
  rates: v.boolean(),
  accounting: v.union(v.literal("limited"), v.literal("full")),
  advancedReports: v.boolean(),
  advancedManagement: v.boolean(),
  prioritySupport: v.boolean(),
});
export type PlanEntitlements = Infer<typeof planEntitlementsValidator>;

export const paymentOrderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("canceled"),
);
export type PaymentOrderStatus = Infer<typeof paymentOrderStatusValidator>;

export const paymentTransactionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled"),
);
export type PaymentTransactionStatus = Infer<
  typeof paymentTransactionStatusValidator
>;

export const discountTypeValidator = v.union(
  v.literal("percent"),
  v.literal("fixed"),
);
export type DiscountType = Infer<typeof discountTypeValidator>;

export const invoiceStatusValidator = v.union(
  v.literal("paid"),
  v.literal("void"),
);
export type InvoiceStatus = Infer<typeof invoiceStatusValidator>;

export const newsStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending"),
  v.literal("published"),
  v.literal("rejected"),
  v.literal("archived"),
);
export type NewsStatus = Infer<typeof newsStatusValidator>;

export const newsSourceKindValidator = v.union(
  v.literal("rss"),
  v.literal("api"),
  v.literal("manual"),
);
export type NewsSourceKind = Infer<typeof newsSourceKindValidator>;

export const websiteVerificationValidator = v.union(
  v.literal("verified"),
  v.literal("needs_review"),
);
export type WebsiteVerification = Infer<typeof websiteVerificationValidator>;

export const websiteCheckStatusValidator = v.union(
  v.literal("ok"),
  v.literal("error"),
  v.literal("unchecked"),
);
export type WebsiteCheckStatus = Infer<typeof websiteCheckStatusValidator>;

export const websiteSuggestionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
export type WebsiteSuggestionStatus = Infer<
  typeof websiteSuggestionStatusValidator
>;

export const websiteReportStatusValidator = v.union(
  v.literal("open"),
  v.literal("resolved"),
);
export type WebsiteReportStatus = Infer<typeof websiteReportStatusValidator>;

export const websiteReportReasonValidator = v.union(
  v.literal("not_working"),
  v.literal("wrong_address"),
  v.literal("unsafe"),
  v.literal("other"),
);
export type WebsiteReportReason = Infer<typeof websiteReportReasonValidator>;

export const servicePriceTypeValidator = v.union(
  v.literal("official"),
  v.literal("suggested"),
  v.literal("custom"),
);
export type ServicePriceType = Infer<typeof servicePriceTypeValidator>;

export const servicePriceStatusValidator = v.union(
  v.literal("active"),
  v.literal("needs_review"),
  v.literal("inactive"),
);
export type ServicePriceStatus = Infer<typeof servicePriceStatusValidator>;

export const servicePriceModeValidator = v.union(
  v.literal("fixed"),
  v.literal("markup_percent"),
  v.literal("markup_toman"),
);
export type ServicePriceMode = Infer<typeof servicePriceModeValidator>;

export const priceSourceKindValidator = v.union(
  v.literal("official"),
  v.literal("market"),
  v.literal("internal"),
);
export type PriceSourceKind = Infer<typeof priceSourceKindValidator>;

export const rateSuggestionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
export type RateSuggestionStatus = Infer<
  typeof rateSuggestionStatusValidator
>;

export const knowledgeStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("archived"),
);
export type KnowledgeStatus = Infer<typeof knowledgeStatusValidator>;

export const agentFeedbackRatingValidator = v.union(
  v.literal("helpful"),
  v.literal("not_helpful"),
);
export type AgentFeedbackRating = Infer<
  typeof agentFeedbackRatingValidator
>;

export const agentSourceValidator = v.object({
  title: v.string(),
  url: v.optional(v.string()),
  documentId: v.optional(v.id("knowledge_documents")),
  serviceId: v.optional(v.id("services")),
  updatedAt: v.optional(v.number()),
  kind: v.union(
    v.literal("knowledge"),
    v.literal("price"),
    v.literal("official"),
  ),
});
export type AgentSource = Infer<typeof agentSourceValidator>;

export const agentAddonValidator = v.object({
  serviceId: v.id("services"),
  serviceName: v.string(),
  quantity: v.number(),
  unit: v.string(),
  unitPriceToman: v.number(),
  lineTotalToman: v.number(),
});

export const agentCalculationValidator = v.object({
  serviceId: v.id("services"),
  serviceName: v.string(),
  quantity: v.number(),
  unit: v.string(),
  unitPriceToman: v.number(),
  lineTotalToman: v.number(),
  totalToman: v.number(),
  priceType: servicePriceTypeValidator,
  addons: v.optional(v.array(agentAddonValidator)),
  sourceName: v.optional(v.string()),
  validUntil: v.optional(v.number()),
});
export type AgentCalculation = Infer<typeof agentCalculationValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      phone: v.optional(v.string()), // normalized mobile number used to sign in
      requiresPhoneVerification: v.optional(v.boolean()),
      phoneVerificationTime: v.optional(v.number()),
      lastActivityAt: v.optional(v.number()),
      sessionsRevokedAt: v.optional(v.number()),
      adminPermissionOverride: v.optional(v.array(v.string())),
      lastLoginAt: v.optional(v.number()),
      termsAcceptedAt: v.optional(v.number()), // when the owner accepted the terms
      isBlocked: v.optional(v.boolean()),
      blockedAt: v.optional(v.number()),
      blockedReason: v.optional(v.string()),
      blockedBy: v.optional(v.id("users")),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_phone", ["phone"])
      .index("by_role", ["role"]),

    account_invitations: defineTable({
      phone: v.string(), actorId: v.id("users"), kind: v.union(v.literal("admin"), v.literal("customer")),
      roleId: v.optional(v.id("admin_roles")), createdAt: v.number(), userId: v.optional(v.id("users")),
      status: v.union(v.literal("pending"), v.literal("complete"), v.literal("failed")),
    }).index("by_phone", ["phone"]),
    phone_challenges: defineTable({
      userId: v.id("users"), hash: v.string(), salt: v.string(), expiresAt: v.number(),
      attempts: v.number(), sentAt: v.number(), windowStartedAt: v.number(), sends: v.number(),
      consumed: v.boolean(),
    }).index("by_user", ["userId"]),
    /** One row per internet cafe. The owner is the tenant administrator. */
    internet_cafes: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      province: v.string(),
      city: v.string(),
      address: v.string(),
      status: cafeStatusValidator,
      trialUsedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_status", ["status"]),

    /**
     * Staff members of a cafe. Owners are implicit (internet_cafes.ownerId)
     * and never stored here, so owner permissions cannot be edited away.
     */
    employees: defineTable({
      cafeId: v.id("internet_cafes"),
      userId: v.optional(v.id("users")),
      fullName: v.string(),
      phone: v.string(),
      roleTitle: v.optional(v.string()),
      permissions: v.array(v.string()),
      active: v.boolean(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe", ["cafeId"])
      .index("by_cafe_active", ["cafeId", "active"])
      .index("by_user", ["userId"])
      .index("by_phone", ["phone"]),

    /** Catalog of assignable permissions, seeded by the server. */
    permissions: defineTable({
      key: v.string(),
      label: v.string(),
      description: v.string(),
      available: v.boolean(),
      sortOrder: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_sort_order", ["sortOrder"]),

    subscriptions: defineTable({
      cafeId: v.id("internet_cafes"),
      planCode: v.string(),
      status: subscriptionStatusValidator,
      startsAt: v.number(),
      endsAt: v.number(),
      billingCycle: v.optional(billingCycleValidator),
      lastPaymentAt: v.optional(v.number()),
      renewalAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    })
      .index("by_cafe", ["cafeId"])
      .index("by_status", ["status"])
      .index("by_ends_at", ["endsAt"]),

    subscription_plans: defineTable({
      code: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      durationDays: v.number(),
      priceToman: v.number(),
      monthlyPriceToman: v.optional(v.number()),
      yearlyPriceToman: v.optional(v.number()),
      yearlyDiscountPercent: v.optional(v.number()),
      features: v.array(v.string()),
      entitlements: v.optional(planEntitlementsValidator),
      isTrial: v.optional(v.boolean()),
      isActive: v.boolean(),
      sortOrder: v.number(),
      updatedAt: v.optional(v.number()),
      updatedBy: v.optional(v.id("users")),
    })
      .index("by_code", ["code"])
      .index("by_sort_order", ["sortOrder"]),

    /**
     * Cafe-owned financial ledger. Amounts are integer Toman and every row is
     * scoped to one cafe. Voided rows are retained for an auditable history.
     */
    accounting_transactions: defineTable({
      cafeId: v.id("internet_cafes"),
      title: v.string(),
      direction: v.union(v.literal("income"), v.literal("expense")),
      category: v.string(),
      method: v.string(),
      amountToman: v.number(),
      note: v.optional(v.string()),
      occurredAt: v.number(),
      operatorName: v.string(),
      createdBy: v.id("users"),
      voidedAt: v.optional(v.number()),
      voidedBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe_occurred", ["cafeId", "occurredAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"]),

    /** Monthly AI consumption is tracked separately from the subscription row. */
    subscription_usage: defineTable({
      cafeId: v.id("internet_cafes"),
      periodKey: v.string(),
      aiRequests: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe_period", ["cafeId", "periodKey"])
      .index("by_period", ["periodKey"]),

    /** An order is the only source of truth for the amount sent to a gateway. */
    payment_orders: defineTable({
      cafeId: v.id("internet_cafes"),
      orderNumber: v.string(),
      planCode: v.string(),
      billingCycle: billingCycleValidator,
      subtotalToman: v.number(),
      discountToman: v.number(),
      totalToman: v.number(),
      discountCodeId: v.optional(v.id("discount_codes")),
      discountCode: v.optional(v.string()),
      status: paymentOrderStatusValidator,
      gateway: v.optional(v.string()),
      authority: v.optional(v.string()),
      referenceId: v.optional(v.string()),
      failureReason: v.optional(v.string()),
      paidAt: v.optional(v.number()),
      canceledAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_status_created", ["status", "createdAt"])
      .index("by_authority", ["authority"])
      .index("by_number", ["orderNumber"]),

    payment_transactions: defineTable({
      orderId: v.id("payment_orders"),
      cafeId: v.id("internet_cafes"),
      provider: v.string(),
      kind: v.union(v.literal("gateway"), v.literal("manual")),
      status: paymentTransactionStatusValidator,
      amountToman: v.number(),
      authority: v.optional(v.string()),
      referenceId: v.optional(v.string()),
      message: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_order_created", ["orderId", "createdAt"])
      .index("by_authority", ["authority"])
      .index("by_reference", ["referenceId"])
      .index("by_cafe_created", ["cafeId", "createdAt"]),

    discount_codes: defineTable({
      code: v.string(),
      title: v.string(),
      discountType: discountTypeValidator,
      value: v.number(),
      startsAt: v.number(),
      endsAt: v.number(),
      maxUses: v.number(),
      maxUsesPerCafe: v.number(),
      applicablePlans: v.array(v.string()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_created", ["createdAt"]),

    discount_redemptions: defineTable({
      codeId: v.id("discount_codes"),
      cafeId: v.id("internet_cafes"),
      orderId: v.id("payment_orders"),
      discountToman: v.number(),
      createdAt: v.number(),
    })
      .index("by_code_cafe", ["codeId", "cafeId"])
      .index("by_code_created", ["codeId", "createdAt"])
      .index("by_order", ["orderId"]),

    invoices: defineTable({
      cafeId: v.id("internet_cafes"),
      orderId: v.id("payment_orders"),
      number: v.string(),
      planCode: v.string(),
      planName: v.string(),
      billingCycle: billingCycleValidator,
      subtotalToman: v.number(),
      discountToman: v.number(),
      totalToman: v.number(),
      status: invoiceStatusValidator,
      issuedAt: v.number(),
      paidAt: v.optional(v.number()),
    })
      .index("by_cafe_issued", ["cafeId", "issuedAt"])
      .index("by_order", ["orderId"])
      .index("by_number", ["number"]),

    /** Append-only audit trail for every admin billing action. */
    billing_events: defineTable({
      cafeId: v.optional(v.id("internet_cafes")),
      actorId: v.id("users"),
      type: v.string(),
      description: v.string(),
      metadata: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"]),

    /** Non-secret billing policy. Gateway credentials live in server env only. */
    billing_settings: defineTable({
      key: v.string(),
      allowTrialReuse: v.boolean(),
      gatewayProvider: v.string(),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_key", ["key"]),

    /** Central, non-secret configuration of the whole platform. */
    platform_settings: defineTable({
      key: v.string(),
      platformName: v.string(),
      tagline: v.string(),
      logoUrl: v.optional(v.string()),
      supportEmail: v.optional(v.string()),
      supportPhone: v.optional(v.string()),
      supportAddress: v.optional(v.string()),
      instagramUrl: v.optional(v.string()),
      telegramUrl: v.optional(v.string()),
      whatsappUrl: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      timezone: v.string(),
      locale: v.string(),
      defaultTheme: v.union(
        v.literal("light"),
        v.literal("dark"),
        v.literal("system"),
      ),
      registrationEnabled: v.boolean(),
      notificationsEnabled: v.boolean(),
      emailNotificationsEnabled: v.boolean(),
      smsNotificationsEnabled: v.boolean(),
      maintenanceMode: v.boolean(),
      maintenanceMessage: v.optional(v.string()),
      aiEnabled: v.boolean(),
      aiModel: v.string(),
      aiCostPerRequestToman: v.number(),
      backupSchedule: v.string(),
      backupNote: v.optional(v.string()),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_key", ["key"]),

    /** Admin-team permission catalogue, separate from cafe permissions. */
    admin_permissions: defineTable({
      key: v.string(),
      label: v.string(),
      description: v.string(),
      sortOrder: v.number(),
      isActive: v.boolean(),
    })
      .index("by_key", ["key"])
      .index("by_sort_order", ["sortOrder"]),

    admin_roles: defineTable({
      key: v.string(),
      name: v.string(),
      description: v.string(),
      isSystem: v.boolean(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_created", ["createdAt"]),

    admin_role_permissions: defineTable({
      roleId: v.id("admin_roles"),
      permissionKey: v.string(),
      createdAt: v.number(),
    })
      .index("by_role", ["roleId"])
      .index("by_role_permission", ["roleId", "permissionKey"])
      .index("by_permission", ["permissionKey"]),

    admin_user_roles: defineTable({
      userId: v.id("users"),
      roleId: v.id("admin_roles"),
      assignedBy: v.id("users"),
      assignedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_role", ["roleId"])
      .index("by_user_role", ["userId", "roleId"]),

    /**
     * Owner-only second factor. The TOTP secret is never returned by any
     * client query; it is only shown once while the owner is enrolling.
     */
    admin_security: defineTable({
      userId: v.id("users"),
      totpSecret: v.string(),
      mfaEnabled: v.boolean(),
      enabledAt: v.optional(v.number()),
      lastLoginAt: v.optional(v.number()),
      lastMfaAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /** A short-lived proof that the current login session passed 2FA. */
    admin_mfa_sessions: defineTable({
      sessionId: v.id("authSessions"),
      userId: v.id("users"),
      verifiedAt: v.number(),
      expiresAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_user", ["userId"]),

    /**
     * Security trail for logins, failed 2FA attempts and session revocation.
     * Login failures never store the full phone number.
     */
    admin_security_events: defineTable({
      actorId: v.optional(v.id("users")),
      identifierMasked: v.optional(v.string()),
      action: v.string(),
      outcome: v.union(
        v.literal("success"),
        v.literal("failure"),
        v.literal("blocked"),
      ),
      detail: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_actor_created", ["actorId", "createdAt"]),

    /** Snapshots of platform settings, used for history and rollback. */
    platform_settings_history: defineTable({
      settingsId: v.id("platform_settings"),
      actorId: v.id("users"),
      snapshot: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    /** Append-only central audit log for sensitive admin actions. */
    audit_logs: defineTable({
      actorId: v.id("users"),
      action: v.string(),
      entityType: v.string(),
      entityId: v.optional(v.string()),
      cafeId: v.optional(v.id("internet_cafes")),
      summary: v.string(),
      metadata: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_actor_created", ["actorId", "createdAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_entity_created", ["entityType", "createdAt"]),

    /** Support conversations are private to their author and the admin team. */
    support_tickets: defineTable({
      number: v.string(),
      userId: v.id("users"),
      cafeId: v.optional(v.id("internet_cafes")),
      subject: v.string(),
      category: v.union(
        v.literal("account"),
        v.literal("billing"),
        v.literal("technical"),
        v.literal("content"),
        v.literal("other"),
      ),
      priority: v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("urgent"),
      ),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("closed"),
      ),
      assignedTo: v.optional(v.id("users")),
      lastMessageAt: v.number(),
      closedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_updated", ["updatedAt"])
      .index("by_user_updated", ["userId", "updatedAt"])
      .index("by_status_updated", ["status", "updatedAt"])
      .index("by_assigned", ["assignedTo", "updatedAt"]),

    support_messages: defineTable({
      ticketId: v.id("support_tickets"),
      authorId: v.id("users"),
      body: v.string(),
      isInternal: v.boolean(),
      createdAt: v.number(),
    }).index("by_ticket_created", ["ticketId", "createdAt"]),

    /** Targeted in-app events for a single account. */
    user_notifications: defineTable({
      userId: v.id("users"),
      cafeId: v.optional(v.id("internet_cafes")),
      kind: v.union(
        v.literal("support"),
        v.literal("billing"),
        v.literal("news"),
        v.literal("rates"),
        v.literal("account"),
        v.literal("system"),
      ),
      title: v.string(),
      body: v.string(),
      href: v.optional(v.string()),
      isRead: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_user_read", ["userId", "isRead"])
      .index("by_cafe_created", ["cafeId", "createdAt"]),

    /** In-app announcements shown to signed-in cafes and admins. */
    platform_notifications: defineTable({
      title: v.string(),
      body: v.string(),
      tone: v.union(
        v.literal("info"),
        v.literal("success"),
        v.literal("warning"),
        v.literal("critical"),
      ),
      isActive: v.boolean(),
      startsAt: v.number(),
      endsAt: v.optional(v.number()),
      /** Existing rows are treated as global broadcasts. */
      audience: v.optional(
        v.union(v.literal("all"), v.literal("plan"), v.literal("cafe")),
      ),
      planCode: v.optional(v.string()),
      cafeId: v.optional(v.id("internet_cafes")),
      kind: v.optional(
        v.union(
          v.literal("broadcast"),
          v.literal("welcome"),
          v.literal("expiry_warning"),
        ),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_active_created", ["isActive", "createdAt"])
      .index("by_created", ["createdAt"]),

    /**
     * Editable public pages managed by the platform owner. Published fields
     * are what visitors read; draft fields are only returned to the owner.
     */
    site_pages: defineTable({
      slug: v.string(),
      title: v.string(),
      summary: v.string(),
      body: v.string(),
      imageUrls: v.array(v.string()),
      sortOrder: v.number(),
      status: v.union(
        v.literal("published"),
        v.literal("hidden"),
      ),
      draftTitle: v.string(),
      draftSummary: v.string(),
      draftBody: v.string(),
      draftImageUrls: v.array(v.string()),
      draftSortOrder: v.number(),
      draftStatus: v.union(
        v.literal("published"),
        v.literal("hidden"),
      ),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
      publishedAt: v.optional(v.number()),
    })
      .index("by_slug", ["slug"])
      .index("by_sort_order", ["sortOrder"]),

    /**
     * Singleton draft/published snapshots for theme and landing content.
     * Snapshots are validated before being written and are never trusted as
     * arbitrary HTML; the public bundle only reads structured fields.
     */
    site_settings: defineTable({
      key: v.string(),
      draft: v.string(),
      published: v.string(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
      publishedAt: v.optional(v.number()),
    }).index("by_key", ["key"]),

    /** Ordered public, dashboard and footer navigation entries. */
    navigation_items: defineTable({
      label: v.string(),
      href: v.string(),
      location: v.union(
        v.literal("public"),
        v.literal("dashboard"),
        v.literal("footer"),
      ),
      sortOrder: v.number(),
      isActive: v.boolean(),
      isExternal: v.boolean(),
      requiredPlanCode: v.optional(v.string()),
      requiredPermission: v.optional(v.string()),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })
      .index("by_location_sort", ["location", "sortOrder"])
      .index("by_created", ["updatedAt"]),

    /** Server-authoritative feature switches with plan and role policy. */
    feature_flags: defineTable({
      key: v.string(),
      label: v.string(),
      description: v.string(),
      isEnabled: v.boolean(),
      allowedPlans: v.array(v.string()),
      allowedRoles: v.array(v.string()),
      dailyLimit: v.number(),
      monthlyLimit: v.number(),
      sortOrder: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })
      .index("by_key", ["key"])
      .index("by_sort_order", ["sortOrder"]),

    /** Per-plan overrides for a feature flag. */
    feature_plan_limits: defineTable({
      featureKey: v.string(),
      planCode: v.string(),
      isAllowed: v.boolean(),
      dailyLimit: v.number(),
      monthlyLimit: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    }).index("by_feature_plan", ["featureKey", "planCode"]),

    /** Every publish/restore creates an immutable snapshot for rollback. */
    content_versions: defineTable({
      entityType: v.union(
        v.literal("site_settings"),
        v.literal("site_page"),
        v.literal("navigation"),
        v.literal("feature"),
      ),
      entityKey: v.string(),
      label: v.string(),
      snapshot: v.string(),
      actorId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_entity_created", ["entityType", "entityKey", "createdAt"])
      .index("by_created", ["createdAt"]),

    /** Global news taxonomy, manageable only by the site administrator. */
    news_categories: defineTable({
      slug: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      tone: v.string(),
      sortOrder: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sort_order", ["sortOrder"]),

    /** Official feeds and manual sources used by the newsroom. */
    news_sources: defineTable({
      name: v.string(),
      kind: newsSourceKindValidator,
      url: v.optional(v.string()),
      defaultCategoryId: v.optional(v.id("news_categories")),
      isActive: v.boolean(),
      isDemo: v.optional(v.boolean()),
      lastFetchedAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      lastItemCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_created", ["createdAt"]),

    /** One row per news item or announcement. */
    news: defineTable({
      title: v.string(),
      summary: v.string(),
      body: v.string(),
      imageUrl: v.optional(v.string()),
      categoryId: v.id("news_categories"),
      sourceId: v.optional(v.id("news_sources")),
      sourceName: v.string(),
      sourceUrl: v.optional(v.string()),
      publishedAt: v.number(),
      isUrgent: v.boolean(),
      isPinned: v.boolean(),
      status: newsStatusValidator,
      isDemo: v.boolean(),
      externalId: v.optional(v.string()),
      importedAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
    })
      .index("by_status_published", ["status", "publishedAt"])
      .index("by_status", ["status"])
      .index("by_category", ["categoryId"])
      .index("by_source", ["sourceId"])
      .index("by_source_external", ["sourceId", "externalId"])
      .index("by_urgent", ["isUrgent"])
      .index("by_created", ["createdAt"]),

    /** Per-user saved articles. Never visible to other accounts. */
    saved_news: defineTable({
      userId: v.id("users"),
      newsId: v.id("news"),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_news", ["userId", "newsId"])
      .index("by_news", ["newsId"]),

    /** Read receipts power the unread indicator per account. */
    news_reads: defineTable({
      userId: v.id("users"),
      newsId: v.id("news"),
      readAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_news", ["userId", "newsId"])
      .index("by_news", ["newsId"]),

    /** Categories a user wants to see first. */
    news_preferences: defineTable({
      userId: v.id("users"),
      categoryIds: v.array(v.id("news_categories")),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /** Global taxonomy for the useful-systems directory. */
    website_categories: defineTable({
      slug: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      icon: v.string(),
      tone: v.string(),
      sortOrder: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sort_order", ["sortOrder"]),

    /** Official and verified public systems. Shared by every cafe. */
    websites: defineTable({
      name: v.string(),
      description: v.string(),
      url: v.string(),
      logoUrl: v.optional(v.string()),
      categoryId: v.id("website_categories"),
      sourceName: v.string(),
      sourceUrl: v.optional(v.string()),
      verificationStatus: websiteVerificationValidator,
      lastCheckedAt: v.optional(v.number()),
      lastCheckStatus: websiteCheckStatusValidator,
      isActive: v.boolean(),
      isFeatured: v.boolean(),
      sortOrder: v.number(),
      visitCount: v.number(),
      createdBy: v.id("users"),
      verifiedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_url", ["url"])
      .index("by_category", ["categoryId"])
      .index("by_active_sort", ["isActive", "sortOrder"])
      .index("by_featured", ["isFeatured"])
      .index("by_created", ["createdAt"]),

    /** Per-user ordered favourites. Never shared between accounts. */
    user_favorites: defineTable({
      userId: v.id("users"),
      websiteId: v.id("websites"),
      sortOrder: v.number(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_website", ["userId", "websiteId"])
      .index("by_website", ["websiteId"]),

    /** One row per user/system, holding the latest visit for quick access. */
    website_visits: defineTable({
      userId: v.id("users"),
      websiteId: v.id("websites"),
      lastVisitedAt: v.number(),
      visitCount: v.number(),
    })
      .index("by_user_visited", ["userId", "lastVisitedAt"])
      .index("by_user_website", ["userId", "websiteId"])
      .index("by_website", ["websiteId"]),

    /** Community suggestions waiting for an administrator decision. */
    website_suggestions: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.string(),
      url: v.string(),
      categoryId: v.id("website_categories"),
      sourceName: v.string(),
      sourceUrl: v.optional(v.string()),
      status: websiteSuggestionStatusValidator,
      adminNote: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      websiteId: v.optional(v.id("websites")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status_created", ["status", "createdAt"])
      .index("by_url", ["url"])
      .index("by_created", ["createdAt"])
      .index("by_user_created", ["userId", "createdAt"]),

    /** User-submitted broken-link reports reviewed by the site admin. */
    website_reports: defineTable({
      websiteId: v.id("websites"),
      userId: v.id("users"),
      reason: websiteReportReasonValidator,
      note: v.optional(v.string()),
      status: websiteReportStatusValidator,
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.id("users")),
    })
      .index("by_status_created", ["status", "createdAt"])
      .index("by_created", ["createdAt"])
      .index("by_website", ["websiteId"])
      .index("by_user_website", ["userId", "websiteId"]),

    /** Official, market or internal documents backing a price. */
    price_sources: defineTable({
      name: v.string(),
      url: v.optional(v.string()),
      kind: priceSourceKindValidator,
      description: v.optional(v.string()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_active", ["isActive"]),

    /** Global service taxonomy, managed by the platform administrator. */
    service_categories: defineTable({
      slug: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      icon: v.string(),
      tone: v.string(),
      sortOrder: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sort_order", ["sortOrder"]),

    /** Platform-level service definitions and advisory base prices. */
    services: defineTable({
      name: v.string(),
      categoryId: v.id("service_categories"),
      description: v.string(),
      unit: v.string(),
      basePriceToman: v.optional(v.number()),
      priceType: servicePriceTypeValidator,
      priceStatus: servicePriceStatusValidator,
      sourceId: v.optional(v.id("price_sources")),
      validFrom: v.optional(v.number()),
      validUntil: v.optional(v.number()),
      isAddon: v.boolean(),
      isActive: v.boolean(),
      sortOrder: v.number(),
      createdBy: v.id("users"),
      updatedBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["categoryId"])
      .index("by_active_sort", ["isActive", "sortOrder"])
      .index("by_created", ["createdAt"]),

    /** Per-cafe overrides. A cafe can never see another cafe's row. */
    cafe_service_prices: defineTable({
      cafeId: v.id("internet_cafes"),
      serviceId: v.id("services"),
      priceMode: v.optional(servicePriceModeValidator),
      priceToman: v.optional(v.number()),
      markupPercent: v.optional(v.number()),
      markupToman: v.optional(v.number()),
      priceType: servicePriceTypeValidator,
      sourceId: v.optional(v.id("price_sources")),
      validFrom: v.optional(v.number()),
      validUntil: v.optional(v.number()),
      status: servicePriceStatusValidator,
      updatedBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe_service", ["cafeId", "serviceId"])
      .index("by_cafe", ["cafeId"])
      .index("by_service", ["serviceId"]),

    /** Append-only audit trail for every platform or cafe price change. */
    price_history: defineTable({
      scope: v.union(v.literal("platform"), v.literal("cafe")),
      cafeId: v.optional(v.id("internet_cafes")),
      serviceId: v.id("services"),
      oldPriceToman: v.optional(v.number()),
      newPriceToman: v.optional(v.number()),
      oldPriceType: v.optional(servicePriceTypeValidator),
      newPriceType: v.optional(servicePriceTypeValidator),
      oldPriceMode: v.optional(servicePriceModeValidator),
      newPriceMode: v.optional(servicePriceModeValidator),
      oldMarkupPercent: v.optional(v.number()),
      newMarkupPercent: v.optional(v.number()),
      oldMarkupToman: v.optional(v.number()),
      newMarkupToman: v.optional(v.number()),
      oldStatus: v.optional(servicePriceStatusValidator),
      newStatus: v.optional(servicePriceStatusValidator),
      sourceId: v.optional(v.id("price_sources")),
      note: v.optional(v.string()),
      changedBy: v.id("users"),
      changedAt: v.number(),
    })
      .index("by_service_changed", ["serviceId", "changedAt"])
      .index("by_cafe_changed", ["cafeId", "changedAt"])
      .index("by_changed", ["changedAt"]),

    /** Cafe-proposed base rates awaiting a platform admin decision. */
    rate_suggestions: defineTable({
      cafeId: v.id("internet_cafes"),
      serviceId: v.id("services"),
      proposedPriceToman: v.number(),
      proposedPriceType: servicePriceTypeValidator,
      sourceId: v.optional(v.id("price_sources")),
      note: v.optional(v.string()),
      status: rateSuggestionStatusValidator,
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status_created", ["status", "createdAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_service", ["serviceId"]),

    /** Global taxonomy for the AI knowledge base. */
    knowledge_categories: defineTable({
      slug: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      icon: v.string(),
      tone: v.string(),
      sortOrder: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sort_order", ["sortOrder"]),

    /** Only approved documents are used as AI context. */
    knowledge_documents: defineTable({
      categoryId: v.id("knowledge_categories"),
      title: v.string(),
      summary: v.string(),
      content: v.string(),
      sourceId: v.optional(v.id("price_sources")),
      sourceName: v.string(),
      sourceUrl: v.optional(v.string()),
      fileId: v.optional(v.id("_storage")),
      fileName: v.optional(v.string()),
      fileSize: v.optional(v.number()),
      fileMimeType: v.optional(v.string()),
      tags: v.array(v.string()),
      status: knowledgeStatusValidator,
      lastReviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.id("users")),
      updatedBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["categoryId"])
      .index("by_status_updated", ["status", "updatedAt"])
      .index("by_created", ["createdAt"]),

    /** Lexical RAG units rebuilt whenever a document changes. */
    knowledge_chunks: defineTable({
      documentId: v.id("knowledge_documents"),
      categoryId: v.id("knowledge_categories"),
      chunkIndex: v.number(),
      content: v.string(),
      createdAt: v.number(),
    })
      .index("by_document", ["documentId"])
      .index("by_category", ["categoryId"]),

    /** Private chat threads, scoped to one cafe and one user. */
    agent_conversations: defineTable({
      cafeId: v.id("internet_cafes"),
      userId: v.id("users"),
      title: v.string(),
      messageCount: v.number(),
      lastMessageAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_cafe_user_updated", ["cafeId", "userId", "updatedAt"])
      .index("by_user_updated", ["userId", "updatedAt"]),

    /** Messages retain grounded sources and any deterministic calculation. */
    agent_messages: defineTable({
      conversationId: v.id("agent_conversations"),
      cafeId: v.id("internet_cafes"),
      userId: v.id("users"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      sources: v.array(agentSourceValidator),
      calculation: v.optional(agentCalculationValidator),
      model: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_conversation_created", ["conversationId", "createdAt"])
      .index("by_user_created", ["userId", "createdAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_created", ["createdAt"]),

    /** Operational trail for the agent: route, duration and failures. */
    agent_runs: defineTable({
      cafeId: v.id("internet_cafes"),
      userId: v.id("users"),
      conversationId: v.optional(v.id("agent_conversations")),
      route: v.string(),
      status: v.union(
        v.literal("success"),
        v.literal("fallback"),
        v.literal("error"),
      ),
      model: v.optional(v.string()),
      durationMs: v.number(),
      hasSources: v.boolean(),
      question: v.string(),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_status_created", ["status", "createdAt"]),

    /** One feedback row per user and assistant message. */
    agent_feedback: defineTable({
      messageId: v.id("agent_messages"),
      conversationId: v.id("agent_conversations"),
      cafeId: v.id("internet_cafes"),
      userId: v.id("users"),
      rating: agentFeedbackRatingValidator,
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_message_user", ["messageId", "userId"])
      .index("by_cafe_created", ["cafeId", "createdAt"])
      .index("by_created", ["createdAt"]),

    /**
     * One-time recovery codes. Only a salted hash is stored; the plaintext is
     * shown to the account holder once and never persisted.
     */
    recovery_codes: defineTable({
      userId: v.id("users"),
      phone: v.string(),
      codeHash: v.string(),
      salt: v.string(),
      attempts: v.number(),
      lastAttemptAt: v.optional(v.number()),
      usedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_phone", ["phone"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
