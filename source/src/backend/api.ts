import type { Id, Doc } from "./ids";
import type { PermissionKey } from "./permissions";
export type Endpoint<A, R> = {
  readonly name: string;
  readonly _args?: A;
  readonly _returnType?: R;
};
export type Api = {
  accounting: {
    list: Endpoint<
      {},
      {
        items: {
          id: Id<"accounting_transactions">;
          title: string;
          direction: "income" | "expense";
          category: string;
          method: string;
          amountToman: number;
          note: string | null;
          occurredAt: number;
          operatorName: string;
          isVoided: boolean;
          createdAt: number;
        }[];
        summary: {
          incomeToman: number;
          expenseToman: number;
          balanceToman: number;
          todayIncomeToman: number;
          todayExpenseToman: number;
          weekIncomeToman: number;
          weekExpenseToman: number;
          count: number;
          voidedCount: number;
          limitedTo: number;
        };
      }
    >;
    create: Endpoint<
      {
        note?: string | undefined;
        occurredAt?: number | undefined;
        title: string;
        direction: "income" | "expense";
        category: string;
        method: string;
        amountToman: number;
      },
      { transactionId: Id<"accounting_transactions"> }
    >;
    voidTransaction: Endpoint<
      { transactionId: Id<"accounting_transactions"> },
      { ok: boolean }
    >;
  };
  admin: {
    adminExists: Endpoint<{}, boolean>;
    claimSiteAdmin: Endpoint<{}, { ok: boolean }>;
    overview: Endpoint<
      {},
      {
        cafes: { total: number; active: number; suspended: number };
        employees: { total: number; active: number };
        users: number;
        usersTotal: number;
        subscriptions: {
          expiringSoon: number;
          monthly: number;
          yearly: number;
          trial: number;
          active: number;
          expired: number;
          canceled: number;
          pending_payment: number;
        };
        revenue: {
          todayToman: number;
          monthToman: number;
          yearToman: number;
          successfulPayments: number;
          failedPayments: number;
          pendingPayments: number;
        };
        ai: { requests: number; runs: number; aiRuns: number; errors: number };
        news: { published: number; pending: number; total: number };
        support: { open: number; inProgress: number; urgent: number };
        plans: {
          code: string;
          name: string;
          durationDays: number;
          priceToman: number;
          isActive: boolean;
          subscribers: number;
        }[];
        chart: {
          month: string;
          revenueToman: number;
          newCafes: number;
          newUsers: number;
          newSubscriptions: number;
        }[];
        recentAudit: {
          id: Id<"audit_logs">;
          actorName: string;
          action: string;
          summary: string;
          createdAt: number;
        }[];
        generatedAt: number;
      }
    >;
    listCafes: Endpoint<
      {
        search?: string | undefined;
        status?: "active" | "suspended" | undefined;
        subscriptionStatus?:
          | "active"
          | "trial"
          | "expired"
          | "canceled"
          | "pending_payment"
          | undefined;
      },
      {
        id: Id<"internet_cafes">;
        name: string;
        province: string;
        city: string;
        address: string;
        status: "active" | "suspended";
        createdAt: number;
        ownerName: string;
        ownerPhone: string | null;
        employeeCount: number;
        activeEmployeeCount: number;
        lastActivityAt: number;
        subscription: {
          planCode: string;
          planName: string;
          status:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment"
            | null;
          endsAt: number;
          billingCycle: "monthly" | "yearly" | null;
        } | null;
      }[]
    >;
    cafeDetails: Endpoint<
      { cafeId: Id<"internet_cafes"> },
      {
        id: Id<"internet_cafes">;
        name: string;
        province: string;
        city: string;
        address: string;
        status: "active" | "suspended";
        createdAt: number;
        updatedAt: number;
        owner: {
          id: Id<"users">;
          name: string;
          phone: string | null;
          blocked: boolean;
        };
        employees: {
          id: Id<"employees">;
          name: string;
          phone: string;
          roleTitle: string | null;
          active: boolean;
          permissions: string[];
          lastActivityAt: number;
        }[];
        subscription: {
          planCode: string;
          planName: string;
          status:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment";
          startsAt: number;
          endsAt: number;
          billingCycle: "monthly" | "yearly" | null;
          lastPaymentAt: number | null;
        } | null;
        invoices: {
          id: Id<"invoices">;
          number: string;
          totalToman: number;
          status: "paid" | "void";
          issuedAt: number;
        }[];
        orders: {
          id: Id<"payment_orders">;
          number: string;
          totalToman: number;
          status: "pending" | "failed" | "canceled" | "paid";
          createdAt: number;
        }[];
        activity: (
          | {
              id: Id<"audit_logs">;
              type: "audit";
              summary: string;
              actorName: string;
              createdAt: number;
            }
          | {
              id: Id<"agent_runs">;
              type: "ai";
              summary: string;
              actorName: string;
              createdAt: number;
            }
        )[];
      }
    >;
    recordCafeAccess: Endpoint<
      { cafeId: Id<"internet_cafes"> },
      { ok: boolean }
    >;
    setCafeStatus: Endpoint<
      { status: "active" | "suspended"; cafeId: Id<"internet_cafes"> },
      { ok: boolean }
    >;
    updateSubscription: Endpoint<
      {
        status: "active" | "trial" | "expired" | "canceled" | "pending_payment";
        cafeId: Id<"internet_cafes">;
        planCode: string;
        endsAt: number;
      },
      { ok: boolean }
    >;
    extendSubscription: Endpoint<
      { cafeId: Id<"internet_cafes">; days: number },
      { ok: boolean }
    >;
    ensurePlans: Endpoint<{}, { ok: boolean }>;
  };
  adminUsers: {
    list: Endpoint<
      {
        search?: string | undefined;
        roleKey?: string | undefined;
        onlyBlocked?: boolean | undefined;
      },
      {
        items: {
          id: Id<"users">;
          name: string;
          phone: string | null;
          email: string | null;
          isGuest: boolean;
          isBlocked: boolean;
          blockedReason: string | null;
          blockedAt: number | null;
          isSuperAdmin: boolean;
          roles: {
            assignmentId: Id<"admin_user_roles">;
            roleId: Id<"admin_roles">;
            key: string;
            name: string;
          }[];
          cafe: {
            id: Id<"internet_cafes">;
            name: string;
            status: "active" | "suspended";
            membership: "owner" | "employee";
            employeeActive: boolean | null;
          } | null;
          lastLoginAt: number | null;
          createdAt: number;
          phoneVerified: boolean;
          lastActivityAt: number | null;
          isPlatformOwner: boolean;
        }[];
        total: number;
        counts: {
          total: number;
          owners: number;
          employees: number;
          blocked: number;
          adminTeam: number;
        };
        roles: {
          id: Id<"admin_roles">;
          key: string;
          name: string;
          isSystem: boolean;
          isActive: boolean;
        }[];
      }
    >;
    setBlocked: Endpoint<
      { reason?: string | undefined; userId: Id<"users">; blocked: boolean },
      { ok: boolean }
    >;
    assignRole: Endpoint<
      { roleId: Id<"admin_roles">; userId: Id<"users"> },
      | { ok: boolean; alreadyAssigned: boolean }
      | { ok: boolean; alreadyAssigned?: undefined }
    >;
    removeRole: Endpoint<
      { roleId: Id<"admin_roles">; userId: Id<"users"> },
      { ok: boolean }
    >;
    roles: Endpoint<
      {},
      {
        id: Id<"admin_roles">;
        key: string;
        name: string;
        description: string;
        isSystem: boolean;
        isActive: boolean;
        permissionKeys: string[];
        memberCount: number;
        activeMemberCount: number;
      }[]
    >;
    permissionCatalog: Endpoint<
      {},
      {
        _id: Id<"admin_permissions">;
        _creationTime: number;
        key: string;
        label: string;
        description: string;
        sortOrder: number;
        isActive: boolean;
      }[]
    >;
    saveRole: Endpoint<
      {
        roleId?: Id<"admin_roles"> | undefined;
        name: string;
        description: string;
        isActive: boolean;
        permissionKeys: string[];
      },
      { roleId: Id<"admin_roles"> }
    >;
    deleteRole: Endpoint<{ roleId: Id<"admin_roles"> }, { ok: boolean }>;
    recordAdminLogin: Endpoint<{}, { ok: boolean }>;
  };
  agent: {
    meta: Endpoint<
      {},
      {
        knowledgeDocs: number;
        totalServices: number;
        overriddenServices: number;
        usage: {
          periodKey: string;
          aiUsed: number;
          aiLimit: number;
          aiRemaining: number;
        };
        canUseAgent: boolean;
        canViewRates: boolean;
        canManageRates: boolean;
        model: string;
        aiEnabled: boolean;
        aiConfigured: boolean;
        serverNow: number;
      }
    >;
    conversations: Endpoint<
      {},
      {
        id: Id<"agent_conversations">;
        title: string;
        messageCount: number;
        lastMessageAt: number;
        createdAt: number;
      }[]
    >;
    conversation: Endpoint<
      { conversationId: Id<"agent_conversations"> },
      {
        id: Id<"agent_conversations">;
        title: string;
        createdAt: number;
        messages: {
          id: Id<"agent_messages">;
          role: "user" | "assistant";
          content: string;
          sources: {
            updatedAt?: number | undefined;
            url?: string | undefined;
            serviceId?: Id<"services"> | undefined;
            documentId?: Id<"knowledge_documents"> | undefined;
            kind: "knowledge" | "official" | "price";
            title: string;
          }[];
          calculation: {
            sourceName?: string | undefined;
            validUntil?: number | undefined;
            addons?:
              | {
                  unit: string;
                  serviceId: Id<"services">;
                  serviceName: string;
                  quantity: number;
                  unitPriceToman: number;
                  lineTotalToman: number;
                }[]
              | undefined;
            totalToman: number;
            priceType: "official" | "suggested" | "custom";
            unit: string;
            serviceId: Id<"services">;
            serviceName: string;
            quantity: number;
            unitPriceToman: number;
            lineTotalToman: number;
          } | null;
          model: string | null;
          createdAt: number;
          feedback: "helpful" | "not_helpful" | null;
        }[];
      }
    >;
    deleteConversation: Endpoint<
      { conversationId: Id<"agent_conversations"> },
      { ok: boolean }
    >;
    submitFeedback: Endpoint<
      {
        note?: string | undefined;
        conversationId: Id<"agent_conversations">;
        rating: "helpful" | "not_helpful";
        messageId: Id<"agent_messages">;
      },
      { ok: boolean }
    >;
    ask: Endpoint<
      {
        conversationId?: Id<"agent_conversations"> | undefined;
        message: string;
      },
      {
        conversationId: Id<"agent_conversations">;
        answer: string;
        sources: AgentSource[];
        calculation: AgentCalculation | null;
        model?: string;
      }
    >;
  };
  auth: {
    signIn: Endpoint<
      {
        provider?: string | undefined;
        verifier?: string | undefined;
        refreshToken?: string | undefined;
        params?: any;
        calledBy?: string | undefined;
      },
      {
        redirect?: string;
        verifier?: string;
        tokens?: Tokens | null;
        started?: boolean;
      }
    >;
    signOut: Endpoint<{}, null>;
    isAuthenticated: Endpoint<{}, boolean>;
  };
  authActions: {
    registerOwner: Endpoint<
      {
        phone: string;
        province: string;
        city: string;
        address: string;
        fullName: string;
        cafeName: string;
        password: string;
        confirmPassword: string;
        acceptedTerms: boolean;
      },
      { recoveryCode: string }
    >;
    createEmployee: Endpoint<
      {
        roleTitle?: string | undefined;
        permissions: string[];
        phone: string;
        fullName: string;
        password: string;
        confirmPassword: string;
      },
      { employeeId: Id<"employees">; recoveryCode: string }
    >;
    changePassword: Endpoint<
      { confirmPassword: string; currentPassword: string; newPassword: string },
      { ok: boolean }
    >;
    resetPasswordWithRecovery: Endpoint<
      {
        phone: string;
        confirmPassword: string;
        newPassword: string;
        recoveryCode: string;
      },
      { recoveryCode: string }
    >;
    regenerateRecoveryCode: Endpoint<{}, { recoveryCode: string }>;
  };
  billing: {
    mySubscription: Endpoint<
      {},
      {
        invoices: {
          id: Id<"invoices">;
          number: string;
          planCode: string;
          planName: string;
          billingCycle: "monthly" | "yearly";
          subtotalToman: number;
          discountToman: number;
          totalToman: number;
          status: "paid" | "void";
          issuedAt: number;
          paidAt: number | null;
        }[];
        orders: {
          id: Id<"payment_orders">;
          orderNumber: string;
          planCode: string;
          billingCycle: "monthly" | "yearly";
          subtotalToman: number;
          discountToman: number;
          totalToman: number;
          discountCode: string | null;
          status: "pending" | "failed" | "canceled" | "paid";
          gateway: string | null;
          authority: string | null;
          referenceId: string | null;
          failureReason: string | null;
          paidAt: number | null;
          createdAt: number;
        }[];
        cafeId: Id<"internet_cafes">;
        subscription: {
          id: Id<"subscriptions">;
          planCode: string;
          planName: string;
          status:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment";
          storedStatus:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment";
          startsAt: number;
          endsAt: number;
          billingCycle: "monthly" | "yearly";
          lastPaymentAt: number | null;
          renewalAt: number;
        } | null;
        plan: {
          code: string;
          name: string;
          description: string | null;
          features: string[];
          entitlements: {
            accounting: "limited" | "full";
            agent: boolean;
            rates: boolean;
            maxEmployees: number;
            aiRequestsPerMonth: number;
            advancedReports: boolean;
            advancedManagement: boolean;
            prioritySupport: boolean;
          };
          monthlyPriceToman: number;
          yearlyPriceToman: number;
          yearlyDiscountPercent: number;
          isTrial: boolean;
          durationDays: number;
        } | null;
        status: "active" | "trial" | "expired" | "canceled" | "pending_payment";
        isActive: boolean;
        daysLeft: number;
        entitlements: {
          accounting: "limited" | "full";
          agent: boolean;
          rates: boolean;
          maxEmployees: number;
          aiRequestsPerMonth: number;
          advancedReports: boolean;
          advancedManagement: boolean;
          prioritySupport: boolean;
        };
        usage: {
          periodKey: string;
          aiUsed: number;
          aiLimit: number;
          aiRemaining: number;
        };
        canUseAgent: boolean;
        canUseRates: boolean;
        hasAdvancedReports: boolean;
        hasAdvancedManagement: boolean;
        trialUsed: boolean;
        serverNow: number;
      }
    >;
    createOrder: Endpoint<
      {
        discountCode?: string | undefined;
        planCode: string;
        billingCycle: "monthly" | "yearly";
      },
      {
        order: {
          id: Id<"payment_orders">;
          orderNumber: string;
          planCode: string;
          billingCycle: "monthly" | "yearly";
          subtotalToman: number;
          discountToman: number;
          totalToman: number;
          discountCode: string | null;
          status: "pending" | "failed" | "canceled" | "paid";
          gateway: string | null;
          authority: string | null;
          referenceId: string | null;
          failureReason: string | null;
          paidAt: number | null;
          createdAt: number;
        };
        reused: boolean;
      }
    >;
    cancelOrder: Endpoint<{ orderId: Id<"payment_orders"> }, { ok: boolean }>;
    startPayment: Endpoint<
      { orderId: Id<"payment_orders"> },
      {
        configured: boolean;
        alreadyPaid: boolean;
        redirectUrl: string | null;
        order: {
          id: Id<"payment_orders">;
          orderNumber: string;
          planCode: string;
          billingCycle: "monthly" | "yearly";
          subtotalToman: number;
          discountToman: number;
          totalToman: number;
          discountCode: string | null;
          status: "pending" | "failed" | "canceled" | "paid";
          gateway: string | null;
          authority: string | null;
          referenceId: string | null;
          failureReason: string | null;
          paidAt: number | null;
          createdAt: number;
        };
        message?: string;
      }
    >;
    confirmPayment: Endpoint<
      {
        authority?: string | undefined;
        gatewayStatus?: string | undefined;
        orderId: Id<"payment_orders">;
      },
      {
        status: "paid" | "failed" | "not_configured" | "verify_error";
        configured: boolean;
        order: {
          id: Id<"payment_orders">;
          orderNumber: string;
          planCode: string;
          billingCycle: "monthly" | "yearly";
          subtotalToman: number;
          discountToman: number;
          totalToman: number;
          discountCode: string | null;
          status: "pending" | "failed" | "canceled" | "paid";
          gateway: string | null;
          authority: string | null;
          referenceId: string | null;
          failureReason: string | null;
          paidAt: number | null;
          createdAt: number;
        };
        invoiceNumber?: string | null;
        message?: string;
      }
    >;
  };
  billingAdmin: {
    overview: Endpoint<
      {},
      {
        cafes: number;
        subscribers: number;
        expiringSoon: number;
        statusCounts: {
          active: number;
          trial: number;
          expired: number;
          canceled: number;
          pending_payment: number;
        };
        plans: {
          subscribers: number;
          id: Id<"subscription_plans">;
          code: string;
          name: string;
          description: string | null;
          durationDays: number;
          monthlyPriceToman: number;
          yearlyPriceToman: number;
          yearlyDiscountPercent: number;
          features: string[];
          entitlements:
            | {
                accounting: "limited" | "full";
                agent: boolean;
                rates: boolean;
                maxEmployees: number;
                aiRequestsPerMonth: number;
                advancedReports: boolean;
                advancedManagement: boolean;
                prioritySupport: boolean;
              }
            | {
                readonly maxEmployees: 0;
                readonly aiRequestsPerMonth: 0;
                readonly agent: false;
                readonly rates: false;
                readonly accounting: "limited";
                readonly advancedReports: false;
                readonly advancedManagement: false;
                readonly prioritySupport: false;
              };
          isTrial: boolean;
          isActive: boolean;
          sortOrder: number;
        }[];
        revenue: {
          totalToman: number;
          thisMonthToman: number;
          paidInvoices: number;
          pendingOrders: number;
        };
        discounts: { total: number; active: number };
        settings: { allowTrialReuse: boolean; gatewayProvider: string };
        serverNow: number;
      }
    >;
    plans: Endpoint<
      {},
      {
        id: Id<"subscription_plans">;
        code: string;
        name: string;
        description: string | null;
        durationDays: number;
        monthlyPriceToman: number;
        yearlyPriceToman: number;
        yearlyDiscountPercent: number;
        features: string[];
        entitlements:
          | {
              accounting: "limited" | "full";
              agent: boolean;
              rates: boolean;
              maxEmployees: number;
              aiRequestsPerMonth: number;
              advancedReports: boolean;
              advancedManagement: boolean;
              prioritySupport: boolean;
            }
          | {
              readonly maxEmployees: 0;
              readonly aiRequestsPerMonth: 0;
              readonly agent: false;
              readonly rates: false;
              readonly accounting: "limited";
              readonly advancedReports: false;
              readonly advancedManagement: false;
              readonly prioritySupport: false;
            };
        isTrial: boolean;
        isActive: boolean;
        sortOrder: number;
      }[]
    >;
    subscribers: Endpoint<
      { search?: string | undefined },
      {
        cafeId: Id<"internet_cafes">;
        cafeName: string;
        city: string;
        province: string;
        cafeStatus: "active" | "suspended";
        ownerName: string;
        ownerPhone: string | null;
        employeeCount: number;
        planCode: string | null;
        planName: string;
        status: "active" | "trial" | "expired" | "canceled" | "pending_payment";
        startsAt: number;
        endsAt: number;
        billingCycle: "monthly" | "yearly" | null;
        lastPaymentAt: number | null;
        renewalAt: number;
        daysLeft: number;
        trialUsed: boolean;
        aiUsed: number;
        aiLimit: number | null;
      }[]
    >;
    payments: Endpoint<
      { search?: string | undefined },
      {
        orderId: Id<"payment_orders">;
        orderNumber: string;
        cafeName: string;
        planCode: string;
        billingCycle: "monthly" | "yearly";
        subtotalToman: number;
        discountToman: number;
        totalToman: number;
        discountCode: string | null;
        status: "pending" | "failed" | "canceled" | "paid";
        gateway: string | null;
        authority: string | null;
        referenceId: string | null;
        failureReason: string | null;
        invoiceNumber: string | null;
        invoiceStatus: "paid" | "void" | null;
        transactionStatus: "pending" | "failed" | "canceled" | "succeeded";
        transactionKind: "gateway" | "manual";
        paidAt: number | null;
        createdAt: number;
        cafeId: Id<"internet_cafes">;
      }[]
    >;
    discounts: Endpoint<
      {},
      {
        id: Id<"discount_codes">;
        code: string;
        title: string;
        discountType: "fixed" | "percent";
        value: number;
        startsAt: number;
        endsAt: number;
        maxUses: number;
        maxUsesPerCafe: number;
        applicablePlans: string[];
        isActive: boolean;
        usedCount: number;
        discountTotalToman: number;
        createdAt: number;
      }[]
    >;
    events: Endpoint<
      {},
      {
        id: Id<"billing_events">;
        type: string;
        description: string;
        cafeName: string | null;
        actorName: string;
        metadata: string | null;
        createdAt: number;
      }[]
    >;
    settings: Endpoint<
      {},
      {
        allowTrialReuse: boolean;
        gatewayProvider: string;
        trial: {
          id: Id<"subscription_plans">;
          code: string;
          name: string;
          description: string | null;
          durationDays: number;
          monthlyPriceToman: number;
          yearlyPriceToman: number;
          yearlyDiscountPercent: number;
          features: string[];
          entitlements:
            | {
                accounting: "limited" | "full";
                agent: boolean;
                rates: boolean;
                maxEmployees: number;
                aiRequestsPerMonth: number;
                advancedReports: boolean;
                advancedManagement: boolean;
                prioritySupport: boolean;
              }
            | {
                readonly maxEmployees: 0;
                readonly aiRequestsPerMonth: 0;
                readonly agent: false;
                readonly rates: false;
                readonly accounting: "limited";
                readonly advancedReports: false;
                readonly advancedManagement: false;
                readonly prioritySupport: false;
              };
          isTrial: boolean;
          isActive: boolean;
          sortOrder: number;
        } | null;
        gatewayConfigured: boolean;
      }
    >;
    reports: Endpoint<
      {},
      {
        totalRevenueToman: number;
        totalInvoices: number;
        monthly: { revenue: number; invoices: number; key: string }[];
        yearly: { revenue: number; invoices: number; key: string }[];
        subscribersByPlan: { code: string; name: string; count: number }[];
      }
    >;
    updatePlan: Endpoint<
      {
        description?: string | undefined;
        durationDays?: number | undefined;
        name: string;
        code: string;
        monthlyPriceToman: number;
        yearlyPriceToman: number;
        yearlyDiscountPercent: number;
        features: string[];
        entitlements: {
          accounting: "limited" | "full";
          agent: boolean;
          rates: boolean;
          maxEmployees: number;
          aiRequestsPerMonth: number;
          advancedReports: boolean;
          advancedManagement: boolean;
          prioritySupport: boolean;
        };
        isActive: boolean;
      },
      { ok: boolean }
    >;
    updateSettings: Endpoint<
      { allowTrialReuse: boolean; gatewayProvider: string },
      { ok: boolean }
    >;
    grantTrial: Endpoint<
      {
        days?: number | undefined;
        allowReuse?: boolean | undefined;
        cafeId: Id<"internet_cafes">;
      },
      { ok: boolean }
    >;
    cancelOrder: Endpoint<{ orderId: Id<"payment_orders"> }, { ok: boolean }>;
    changeSubscription: Endpoint<
      {
        endsAt?: number | undefined;
        billingCycle?: "monthly" | "yearly" | undefined;
        days?: number | undefined;
        status: "active" | "trial" | "expired" | "canceled" | "pending_payment";
        cafeId: Id<"internet_cafes">;
        planCode: string;
      },
      { ok: boolean }
    >;
    cancelSubscription: Endpoint<
      { cafeId: Id<"internet_cafes"> },
      { ok: boolean }
    >;
    upsertDiscount: Endpoint<
      {
        discountId?: Id<"discount_codes"> | undefined;
        startsAt: number;
        endsAt: number;
        code: string;
        isActive: boolean;
        title: string;
        discountType: "fixed" | "percent";
        value: number;
        maxUses: number;
        maxUsesPerCafe: number;
        applicablePlans: string[];
      },
      { discountId: Id<"discount_codes"> }
    >;
    setDiscountActive: Endpoint<
      { isActive: boolean; discountId: Id<"discount_codes"> },
      { ok: boolean }
    >;
    recordManualPayment: Endpoint<
      {
        note?: string | undefined;
        referenceId: string;
        orderId: Id<"payment_orders">;
      },
      { invoiceNumber: string }
    >;
  };
  employees: {
    list: Endpoint<
      {},
      {
        employees: {
          id: Id<"employees">;
          fullName: string;
          phone: string;
          roleTitle: string | null;
          permissions: string[];
          active: boolean;
          hasAccount: boolean;
          createdAt: number;
          updatedAt: number;
          isSelf: boolean;
        }[];
        isOwner: boolean;
      }
    >;
    update: Endpoint<
      {
        roleTitle?: string | undefined;
        permissions: string[];
        active: boolean;
        fullName: string;
        employeeId: Id<"employees">;
      },
      { ok: boolean }
    >;
    setActive: Endpoint<
      { active: boolean; employeeId: Id<"employees"> },
      { ok: boolean }
    >;
    remove: Endpoint<{ employeeId: Id<"employees"> }, { ok: boolean }>;
  };
  knowledge: {
    search: Endpoint<
      { search: string },
      {
        results: {
          id: Id<"knowledge_documents">;
          title: string;
          summary: string;
          snippet: string;
          categoryName: string;
          sourceName: string;
          sourceUrl: string | null;
          fileUrl: string | null;
          reviewedAt: number;
          updatedAt: number;
        }[];
        total: number;
      }
    >;
  };
  knowledgeAdmin: {
    generateUploadUrl: Endpoint<{}, string>;
    overview: Endpoint<
      {},
      {
        documents: {
          total: number;
          approved: number;
          draft: number;
          archived: number;
        };
        categories: number;
        chunks: number;
        conversations: number;
        feedback: { total: number; helpful: number; notHelpful: number };
      }
    >;
    categories: Endpoint<
      {},
      {
        id: Id<"knowledge_categories">;
        slug: string;
        name: string;
        description: string | null;
        icon: string;
        tone: string;
        sortOrder: number;
        isActive: boolean;
        documentCount: number;
        approvedCount: number;
      }[]
    >;
    documents: Endpoint<
      {
        search?: string | undefined;
        status?: "draft" | "archived" | "approved" | undefined;
        categoryId?: Id<"knowledge_categories"> | undefined;
      },
      {
        id: Id<"knowledge_documents">;
        title: string;
        summary: string;
        categoryId: Id<"knowledge_categories">;
        categoryName: string;
        categoryTone: string;
        sourceName: string;
        sourceUrl: string | null;
        fileName: string | null;
        sourceId: Id<"price_sources"> | null;
        sourceRegistryName: string | null;
        tags: string[];
        status: "draft" | "archived" | "approved";
        chunkCount: number;
        lastReviewedAt: number | null;
        createdAt: number;
        updatedAt: number;
      }[]
    >;
    document: Endpoint<
      { documentId: Id<"knowledge_documents"> },
      {
        id: Id<"knowledge_documents">;
        title: string;
        summary: string;
        content: string;
        categoryId: Id<"knowledge_categories">;
        categoryName: string;
        sourceId: Id<"price_sources"> | null;
        sourceName: string;
        sourceUrl: string | null;
        fileId: Id<"_storage"> | null;
        fileName: string | null;
        fileSize: number | null;
        fileMimeType: string | null;
        fileUrl: string | null;
        sourceRegistryName: string | null;
        tags: string[];
        status: "draft" | "archived" | "approved";
        chunkCount: number;
        lastReviewedAt: number | null;
        reviewedBy: Id<"users"> | null;
        createdAt: number;
        updatedAt: number;
      }
    >;
    feedback: Endpoint<
      { rating?: "helpful" | "not_helpful" | undefined },
      {
        id: Id<"agent_feedback">;
        rating: "helpful" | "not_helpful";
        note: string | null;
        answerExcerpt: string;
        userName: string;
        cafeName: string;
        createdAt: number;
      }[]
    >;
    frequentQuestions: Endpoint<
      {},
      {
        question: string;
        count: number;
        lastAskedAt: number;
        cafeCount: number;
      }[]
    >;
    saveDocument: Endpoint<
      {
        sourceId?: Id<"price_sources"> | undefined;
        sourceUrl?: string | undefined;
        fileId?: Id<"_storage"> | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        fileMimeType?: string | undefined;
        documentId?: Id<"knowledge_documents"> | undefined;
        status: "draft" | "archived" | "approved";
        title: string;
        summary: string;
        content: string;
        categoryId: Id<"knowledge_categories">;
        sourceName: string;
        tags: string[];
      },
      { documentId: Id<"knowledge_documents">; chunkCount: number }
    >;
    setDocumentStatus: Endpoint<
      {
        status: "draft" | "archived" | "approved";
        documentId: Id<"knowledge_documents">;
      },
      { ok: boolean }
    >;
    deleteDocument: Endpoint<
      { documentId: Id<"knowledge_documents"> },
      { ok: boolean }
    >;
    agentPerformance: Endpoint<
      {},
      {
        total: number;
        success: number;
        fallback: number;
        errors: number;
        avgDurationMs: number;
        aiRequests: number;
        aiCostPerRequestToman: number;
        estimatedCostToman: number;
        aiEnabled: boolean;
        aiModel: string;
        routes: { route: string; count: number }[];
        recentErrors: {
          id: Id<"agent_runs">;
          route: string;
          status: "success" | "error" | "fallback";
          question: string;
          errorMessage: string | null;
          durationMs: number;
          createdAt: number;
        }[];
      }
    >;
    createCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        tone: string;
        icon: string;
      },
      { categoryId: Id<"knowledge_categories"> }
    >;
    updateCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        isActive: boolean;
        tone: string;
        categoryId: Id<"knowledge_categories">;
        icon: string;
      },
      { ok: boolean }
    >;
    deleteCategory: Endpoint<
      { categoryId: Id<"knowledge_categories"> },
      { ok: boolean }
    >;
  };
  knowledgeExtract: {
    extractTextFromFile: Endpoint<
      { fileId: Id<"_storage">; fileName: string },
      { text: string; truncated: boolean }
    >;
  };
  managedAccounts: {
    capabilities: Endpoint<
      {},
      { smsConfigured: boolean; publicRegistration: boolean }
    >;
    revokeAllSessions: Endpoint<
      { userId?: Id<"users"> | undefined },
      { count: number }
    >;
    recordSession: Endpoint<{}, null>;
    adminDetails: Endpoint<
      { userId: Id<"users"> },
      {
        id: Id<"users">;
        name: string;
        phone: string;
        isOwner: boolean;
        isAdmin: boolean;
        phoneVerified: boolean;
        lastLoginAt: number | null;
        lastActivityAt: number | null;
        activeSessions: number;
        permissionOverride: string[] | null;
        rolePermissions: string[];
        catalog: { key: AdminPermission; label: string; description: string }[];
        activity: {
          id: Id<"audit_logs">;
          summary: string;
          action: string;
          createdAt: number;
        }[];
      }
    >;
    updateAdmin: Endpoint<
      {
        name: string;
        userId: Id<"users">;
        permissionOverride: string[] | null;
      },
      { ok: boolean }
    >;
  };
  news: {
    feed: Endpoint<
      {
        search?: string | undefined;
        categoryId?: Id<"news_categories"> | undefined;
        sort?: "newest" | "oldest" | undefined;
        savedOnly?: boolean | undefined;
        unreadOnly?: boolean | undefined;
        preferredOnly?: boolean | undefined;
      },
      {
        items: {
          id: Id<"news">;
          title: string;
          summary: string;
          imageUrl: string | null;
          category: {
            id: Id<"news_categories">;
            name: string;
            slug: string;
            tone: string;
          };
          sourceName: string;
          sourceUrl: string | null;
          publishedAt: number;
          isUrgent: boolean;
          isPinned: boolean;
          isDemo: boolean;
          saved: boolean;
          read: boolean;
        }[];
        urgent: {
          id: Id<"news">;
          title: string;
          summary: string;
          imageUrl: string | null;
          category: {
            id: Id<"news_categories">;
            name: string;
            slug: string;
            tone: string;
          };
          sourceName: string;
          sourceUrl: string | null;
          publishedAt: number;
          isUrgent: boolean;
          isPinned: boolean;
          isDemo: boolean;
          saved: boolean;
          read: boolean;
        }[];
        categories: {
          id: Id<"news_categories">;
          name: string;
          slug: string;
          tone: string;
          newsCount: number;
        }[];
        preferences: {
          categoryIds: Id<"news_categories">[];
          updatedAt: number | null;
        };
        savedCount: number;
        unreadCount: number;
        totalCount: number;
        hasDemo: boolean;
        sources: {
          id: Id<"news_sources">;
          name: string;
          kind: "rss" | "manual" | "api";
          lastFetchedAt: number | null;
        }[];
        serverNow: number;
      }
    >;
    get: Endpoint<
      { newsId: string },
      {
        body: string;
        id: Id<"news">;
        title: string;
        summary: string;
        imageUrl: string | null;
        category: {
          id: Id<"news_categories">;
          name: string;
          slug: string;
          tone: string;
        };
        sourceName: string;
        sourceUrl: string | null;
        publishedAt: number;
        isUrgent: boolean;
        isPinned: boolean;
        isDemo: boolean;
        saved: boolean;
        read: boolean;
      } | null
    >;
    highlights: Endpoint<
      {},
      {
        items: {
          id: Id<"news">;
          title: string;
          summary: string;
          imageUrl: string | null;
          category: {
            id: Id<"news_categories">;
            name: string;
            slug: string;
            tone: string;
          };
          sourceName: string;
          sourceUrl: string | null;
          publishedAt: number;
          isUrgent: boolean;
          isPinned: boolean;
          isDemo: boolean;
          saved: boolean;
          read: boolean;
        }[];
        hasDemo: boolean;
      }
    >;
    markRead: Endpoint<{ newsId: Id<"news"> }, { ok: boolean }>;
    toggleSaved: Endpoint<{ newsId: Id<"news"> }, { saved: boolean }>;
    setPreferences: Endpoint<
      { categoryIds: Id<"news_categories">[] },
      { ok: boolean }
    >;
  };
  newsAdmin: {
    overview: Endpoint<
      {},
      {
        news: {
          total: number;
          published: number;
          pending: number;
          draft: number;
          urgent: number;
          demo: number;
        };
        categories: number;
        sources: { total: number; active: number };
        generatedAt: number;
      }
    >;
    list: Endpoint<
      {
        search?: string | undefined;
        status?:
          | "pending"
          | "published"
          | "draft"
          | "rejected"
          | "archived"
          | undefined;
        categoryId?: Id<"news_categories"> | undefined;
      },
      {
        items: {
          id: Id<"news">;
          title: string;
          summary: string;
          body: string;
          imageUrl: string | null;
          categoryId: Id<"news_categories">;
          categoryName: string;
          categoryTone: string;
          sourceId: Id<"news_sources"> | null;
          sourceName: string;
          sourceUrl: string | null;
          sourceKind: "rss" | "manual" | "api" | null;
          publishedAt: number;
          isUrgent: boolean;
          isPinned: boolean;
          status: "pending" | "published" | "draft" | "rejected" | "archived";
          isDemo: boolean;
          externalId: string | null;
          createdAt: number;
          updatedAt: number;
        }[];
        total: number;
      }
    >;
    categories: Endpoint<
      {},
      {
        id: Id<"news_categories">;
        slug: string;
        name: string;
        description: string | null;
        tone: string;
        sortOrder: number;
        isActive: boolean;
        newsCount: number;
      }[]
    >;
    sources: Endpoint<
      {},
      {
        id: Id<"news_sources">;
        name: string;
        kind: "rss" | "manual" | "api";
        url: string | null;
        defaultCategoryId: Id<"news_categories"> | null;
        isActive: boolean;
        isDemo: boolean;
        lastFetchedAt: number | null;
        lastError: string | null;
        lastItemCount: number | null;
        pendingCount: number;
        publishedCount: number;
      }[]
    >;
    createNews: Endpoint<
      {
        imageUrl?: string | undefined;
        sourceId?: Id<"news_sources"> | undefined;
        sourceUrl?: string | undefined;
        status: "pending" | "published" | "draft" | "rejected" | "archived";
        title: string;
        summary: string;
        body: string;
        publishedAt: number;
        categoryId: Id<"news_categories">;
        sourceName: string;
        isUrgent: boolean;
        isPinned: boolean;
      },
      { newsId: Id<"news"> }
    >;
    updateNews: Endpoint<
      {
        imageUrl?: string | undefined;
        sourceId?: Id<"news_sources"> | undefined;
        sourceUrl?: string | undefined;
        status: "pending" | "published" | "draft" | "rejected" | "archived";
        title: string;
        summary: string;
        body: string;
        publishedAt: number;
        categoryId: Id<"news_categories">;
        sourceName: string;
        isUrgent: boolean;
        isPinned: boolean;
        newsId: Id<"news">;
      },
      { ok: boolean }
    >;
    setNewsStatus: Endpoint<
      {
        status: "pending" | "published" | "draft" | "rejected" | "archived";
        newsId: Id<"news">;
      },
      { ok: boolean }
    >;
    deleteNews: Endpoint<{ newsId: Id<"news"> }, { ok: boolean }>;
    seedDemo: Endpoint<{}, { categories: number; seededDemo: number }>;
    deleteDemo: Endpoint<{}, { removed: number }>;
    createCategory: Endpoint<
      { description?: string | undefined; name: string; tone: string },
      { categoryId: Id<"news_categories"> }
    >;
    updateCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        isActive: boolean;
        tone: string;
        categoryId: Id<"news_categories">;
      },
      { ok: boolean }
    >;
    deleteCategory: Endpoint<
      { categoryId: Id<"news_categories"> },
      { ok: boolean }
    >;
    createSource: Endpoint<
      {
        url?: string | undefined;
        defaultCategoryId?: Id<"news_categories"> | undefined;
        name: string;
        kind: "rss" | "manual" | "api";
      },
      { sourceId: Id<"news_sources"> }
    >;
    updateSource: Endpoint<
      {
        url?: string | undefined;
        defaultCategoryId?: Id<"news_categories"> | undefined;
        name: string;
        isActive: boolean;
        sourceId: Id<"news_sources">;
      },
      { ok: boolean }
    >;
    deleteSource: Endpoint<{ sourceId: Id<"news_sources"> }, { ok: boolean }>;
  };
  newsIngest: {
    fetchSource: Endpoint<
      { sourceId: Id<"news_sources"> },
      { imported: number; skipped: number }
    >;
  };
  notifications: {
    myNotifications: Endpoint<
      {},
      {
        items: {
          id: Id<"user_notifications">;
          kind: "billing" | "news" | "rates" | "support" | "system" | "account";
          title: string;
          body: string;
          href: string | null;
          isRead: boolean;
          createdAt: number;
        }[];
        unread: number;
      }
    >;
    markRead: Endpoint<
      { notificationId: Id<"user_notifications"> },
      { ok: boolean }
    >;
    markAllRead: Endpoint<{}, { updated: number }>;
  };
  phoneActions: {
    send: Endpoint<{}, { sent: boolean }>;
    verify: Endpoint<{ code: string }, { ok: boolean }>;
  };
  phoneVerification: {
    status: Endpoint<{}, { required: boolean; configured: boolean }>;
  };
  platformAdmin: {
    ensureDefaults: Endpoint<{}, { ok: boolean }>;
    settings: Endpoint<
      {},
      {
        trialDays: number | null;
        trialPlanCode: string | null;
        billingSettings: {
          allowTrialReuse: boolean;
          gatewayProvider: string;
        } | null;
        platformName: string;
        tagline: string;
        logoUrl: string | null;
        supportEmail: string | null;
        supportPhone: string | null;
        supportAddress: string | null;
        instagramUrl: string | null;
        telegramUrl: string | null;
        whatsappUrl: string | null;
        websiteUrl: string | null;
        timezone: string;
        locale: string;
        defaultTheme: "light" | "dark" | "system";
        registrationEnabled: boolean;
        notificationsEnabled: boolean;
        emailNotificationsEnabled: boolean;
        smsNotificationsEnabled: boolean;
        maintenanceMode: boolean;
        maintenanceMessage: string | null;
        aiEnabled: boolean;
        aiModel: string;
        aiCostPerRequestToman: number;
        backupSchedule: string;
        backupNote: string | null;
        updatedAt: number;
      } | null
    >;
    updateSettings: Endpoint<
      {
        logoUrl?: string | undefined;
        supportEmail?: string | undefined;
        supportPhone?: string | undefined;
        supportAddress?: string | undefined;
        instagramUrl?: string | undefined;
        telegramUrl?: string | undefined;
        whatsappUrl?: string | undefined;
        websiteUrl?: string | undefined;
        maintenanceMessage?: string | undefined;
        backupNote?: string | undefined;
        platformName: string;
        tagline: string;
        timezone: string;
        locale: string;
        defaultTheme: "light" | "dark" | "system";
        registrationEnabled: boolean;
        notificationsEnabled: boolean;
        emailNotificationsEnabled: boolean;
        smsNotificationsEnabled: boolean;
        maintenanceMode: boolean;
        aiEnabled: boolean;
        aiModel: string;
        aiCostPerRequestToman: number;
        backupSchedule: string;
      },
      { ok: boolean }
    >;
    systemHealth: Endpoint<
      {},
      {
        generatedAt: number;
        database: { reachable: boolean; cafesCapped: boolean };
        cafes: { total: number; active: number; suspended: number };
        support: { open: number; inProgress: number; urgent: number };
        billing: {
          pendingOrders: number;
          failedOrders: number;
          expiringWithinSevenDays: number;
        };
        agent: {
          runs24h: number;
          errors24h: number;
          fallbacks24h: number;
          requestsThisMonth: number;
          estimatedCostThisMonthToman: number;
        };
        backup: { schedule: string; note: string | null };
        integrations: {
          paymentConfigured: boolean;
          aiConfigured: boolean;
          emailToggle: boolean;
          smsToggle: boolean;
        };
        recentAudit: {
          id: Id<"audit_logs">;
          action: string;
          summary: string;
          createdAt: number;
        }[];
        sectionsCappedAt: number;
      }
    >;
    publicProfile: Endpoint<
      {},
      {
        platformName: string;
        tagline: string;
        logoUrl: string | null;
        supportEmail: string | null;
        supportPhone: string | null;
        supportAddress: string | null;
        instagramUrl: string | null;
        telegramUrl: string | null;
        whatsappUrl: string | null;
        websiteUrl: string | null;
        registrationEnabled: boolean;
        maintenanceMode: boolean;
        maintenanceMessage: string | null;
      }
    >;
    notifications: Endpoint<
      {},
      {
        id: Id<"platform_notifications">;
        title: string;
        body: string;
        tone: "success" | "info" | "warning" | "critical";
        isActive: boolean;
        startsAt: number;
        endsAt: number | null;
        audience: "all" | "plan" | "cafe";
        planCode: string | null;
        cafeId: Id<"internet_cafes"> | null;
        kind: "broadcast" | "welcome" | "expiry_warning";
        createdAt: number;
      }[]
    >;
    notificationCafes: Endpoint<
      {},
      { id: Id<"internet_cafes">; name: string }[]
    >;
    createNotification: Endpoint<
      {
        kind?: "broadcast" | "welcome" | "expiry_warning" | undefined;
        cafeId?: Id<"internet_cafes"> | undefined;
        planCode?: string | undefined;
        endsAt?: number | undefined;
        audience?: "all" | "plan" | "cafe" | undefined;
        startsAt: number;
        title: string;
        body: string;
        tone: "success" | "info" | "warning" | "critical";
      },
      { notificationId: Id<"platform_notifications"> }
    >;
    setNotificationActive: Endpoint<
      { isActive: boolean; notificationId: Id<"platform_notifications"> },
      { ok: boolean }
    >;
    auditLogs: Endpoint<
      {
        search?: string | undefined;
        action?: string | undefined;
        entityType?: string | undefined;
      },
      {
        id: Id<"audit_logs">;
        actorName: string;
        actorPhone: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        cafeName: string | null;
        summary: string;
        metadata: string | null;
        createdAt: number;
      }[]
    >;
  };
  provisionAccounts: {
    create: Endpoint<
      {
        roleId?: Id<"admin_roles"> | undefined;
        province?: string | undefined;
        city?: string | undefined;
        address?: string | undefined;
        cafeName?: string | undefined;
        name: string;
        phone: string;
        kind: "admin" | "customer";
        password: string;
      },
      { userId: Id<"users"> }
    >;
  };
  rates: {
    catalog: Endpoint<
      {
        search?: string | undefined;
        categoryId?: Id<"service_categories"> | undefined;
      },
      {
        items: {
          id: Id<"services">;
          name: string;
          description: string;
          unit: string;
          isAddon: boolean;
          categoryId: Id<"service_categories">;
          categoryName: string;
          categoryTone: string;
          base: {
            priceToman: number | null;
            priceType: "official" | "suggested" | "custom";
            status: "active" | "needs_review" | "inactive";
            source: {
              id: Id<"price_sources">;
              name: string;
              url: string | null;
              kind: "internal" | "official" | "market";
            } | null;
            validFrom: number | null;
            validUntil: number | null;
          };
          override: {
            priceMode: "fixed" | "markup_percent" | "markup_toman";
            priceToman: number | null;
            markupPercent: number | null;
            markupToman: number | null;
            priceType: "official" | "suggested" | "custom";
            status: "active" | "needs_review" | "inactive";
            source: {
              id: Id<"price_sources">;
              name: string;
              url: string | null;
              kind: "internal" | "official" | "market";
            } | null;
            validFrom: number | null;
            validUntil: number | null;
          } | null;
          effective: {
            priceToman: number;
            priceType: "official" | "suggested" | "custom";
            priceMode: "fixed" | "markup_percent" | "markup_toman";
            markupPercent: number | null;
            markupToman: number | null;
            source: {
              id: Id<"price_sources">;
              name: string;
              url: string | null;
              kind: "internal" | "official" | "market";
            } | null;
            validFrom: number | null;
            validUntil: number | null;
            isCafeOverride: boolean;
            priceTypeLabel: string;
          } | null;
          effectiveStatus:
            | "available"
            | "expired"
            | "needs_review"
            | "inactive"
            | "missing"
            | "future";
        }[];
        categories: {
          id: Id<"service_categories">;
          name: string;
          description: string | null;
          icon: string;
          tone: string;
          count: number;
        }[];
        sources: ({
          id: Id<"price_sources">;
          name: string;
          url: string | null;
          kind: "internal" | "official" | "market";
        } | null)[];
        canManage: boolean;
        isOwner: boolean;
        serverNow: number;
      }
    >;
    myHistory: Endpoint<
      { serviceId?: Id<"services"> | undefined },
      {
        id: Id<"price_history">;
        scope: "platform" | "cafe";
        serviceId: Id<"services">;
        serviceName: string;
        oldPriceToman: number | null;
        newPriceToman: number | null;
        oldPriceType: "official" | "suggested" | "custom" | null;
        newPriceType: "official" | "suggested" | "custom" | null;
        oldPriceMode: "fixed" | "markup_percent" | "markup_toman" | null;
        newPriceMode: "fixed" | "markup_percent" | "markup_toman" | null;
        oldMarkupPercent: number | null;
        newMarkupPercent: number | null;
        oldMarkupToman: number | null;
        newMarkupToman: number | null;
        oldStatus: "active" | "needs_review" | "inactive" | null;
        newStatus: "active" | "needs_review" | "inactive" | null;
        sourceName: string | null;
        note: string | null;
        changedByName: string;
        changedAt: number;
      }[]
    >;
    mySuggestions: Endpoint<
      {},
      {
        id: Id<"rate_suggestions">;
        serviceName: string;
        proposedPriceToman: number;
        proposedPriceType: "official" | "suggested" | "custom";
        status: "pending" | "rejected" | "approved";
        note: string | null;
        createdAt: number;
        reviewedAt: number | null;
      }[]
    >;
    setMyPrice: Endpoint<
      {
        priceToman?: number | undefined;
        sourceId?: Id<"price_sources"> | undefined;
        validFrom?: number | undefined;
        validUntil?: number | undefined;
        priceMode?: "fixed" | "markup_percent" | "markup_toman" | undefined;
        markupPercent?: number | undefined;
        markupToman?: number | undefined;
        priceType: "suggested" | "custom";
        serviceId: Id<"services">;
      },
      { ok: boolean }
    >;
    clearMyPrice: Endpoint<{ serviceId: Id<"services"> }, { ok: boolean }>;
    submitRateSuggestion: Endpoint<
      {
        note?: string | undefined;
        sourceId?: Id<"price_sources"> | undefined;
        serviceId: Id<"services">;
        proposedPriceType: "official" | "suggested";
        proposedPriceToman: number;
      },
      { ok: boolean }
    >;
  };
  ratesAdmin: {
    overview: Endpoint<
      {},
      {
        services: {
          total: number;
          active: number;
          priced: number;
          needsReview: number;
        };
        categories: number;
        sources: number;
        pendingSuggestions: number;
        cafeOverrides: number;
      }
    >;
    listServices: Endpoint<
      {
        search?: string | undefined;
        status?:
          | "active"
          | "all"
          | "needs_review"
          | "inactive"
          | "priced"
          | undefined;
        categoryId?: Id<"service_categories"> | undefined;
      },
      {
        id: Id<"services">;
        name: string;
        description: string;
        unit: string;
        categoryId: Id<"service_categories">;
        categoryName: string;
        categoryTone: string;
        basePriceToman: number | null;
        priceType: "official" | "suggested" | "custom";
        priceStatus: "active" | "needs_review" | "inactive";
        source: {
          id: Id<"price_sources">;
          name: string;
          url: string | null;
          kind: "internal" | "official" | "market";
          description: string | null;
          isActive: boolean;
          createdAt: number;
          updatedAt: number;
        } | null;
        validFrom: number | null;
        validUntil: number | null;
        isAddon: boolean;
        isActive: boolean;
        sortOrder: number;
        effectiveStatus:
          | "available"
          | "expired"
          | "needs_review"
          | "inactive"
          | "missing"
          | "future";
        cafeOverrideCount: number;
        createdAt: number;
        updatedAt: number;
      }[]
    >;
    categories: Endpoint<
      {},
      {
        id: Id<"service_categories">;
        slug: string;
        name: string;
        description: string | null;
        icon: string;
        tone: string;
        sortOrder: number;
        isActive: boolean;
        serviceCount: number;
      }[]
    >;
    sources: Endpoint<
      {},
      {
        usageCount: number;
        id: Id<"price_sources">;
        name: string;
        url: string | null;
        kind: "internal" | "official" | "market";
        description: string | null;
        isActive: boolean;
        createdAt: number;
        updatedAt: number;
      }[]
    >;
    suggestions: Endpoint<
      { status?: "pending" | "rejected" | "approved" | undefined },
      {
        id: Id<"rate_suggestions">;
        serviceId: Id<"services">;
        serviceName: string;
        unit: string;
        cafeId: Id<"internet_cafes">;
        cafeName: string;
        proposedPriceToman: number;
        proposedPriceType: "official" | "suggested" | "custom";
        sourceName: string | null;
        note: string | null;
        status: "pending" | "rejected" | "approved";
        createdAt: number;
        reviewedAt: number | null;
      }[]
    >;
    history: Endpoint<
      {
        cafeId?: Id<"internet_cafes"> | undefined;
        serviceId?: Id<"services"> | undefined;
      },
      {
        id: Id<"price_history">;
        scope: "platform" | "cafe";
        serviceName: string;
        cafeName: string | null;
        oldPriceToman: number | null;
        newPriceToman: number | null;
        oldPriceType: "official" | "suggested" | "custom" | null;
        newPriceType: "official" | "suggested" | "custom" | null;
        oldStatus: "active" | "needs_review" | "inactive" | null;
        newStatus: "active" | "needs_review" | "inactive" | null;
        sourceName: string | null;
        note: string | null;
        changedByName: string;
        changedAt: number;
      }[]
    >;
    createService: Endpoint<
      {
        sortOrder?: number | undefined;
        sourceId?: Id<"price_sources"> | undefined;
        basePriceToman?: number | undefined;
        validFrom?: number | undefined;
        validUntil?: number | undefined;
        name: string;
        description: string;
        isActive: boolean;
        categoryId: Id<"service_categories">;
        priceType: "official" | "suggested" | "custom";
        priceStatus: "active" | "needs_review" | "inactive";
        unit: string;
        isAddon: boolean;
      },
      { serviceId: Id<"services"> }
    >;
    updateService: Endpoint<
      {
        sourceId?: Id<"price_sources"> | undefined;
        basePriceToman?: number | undefined;
        validFrom?: number | undefined;
        validUntil?: number | undefined;
        name: string;
        description: string;
        sortOrder: number;
        isActive: boolean;
        categoryId: Id<"service_categories">;
        priceType: "official" | "suggested" | "custom";
        priceStatus: "active" | "needs_review" | "inactive";
        unit: string;
        isAddon: boolean;
        serviceId: Id<"services">;
      },
      { ok: boolean }
    >;
    setServiceActive: Endpoint<
      { isActive: boolean; serviceId: Id<"services"> },
      { ok: boolean }
    >;
    deleteService: Endpoint<
      { serviceId: Id<"services"> },
      { ok: boolean; deletedName: string }
    >;
    createCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        tone: string;
        icon: string;
      },
      { categoryId: Id<"service_categories"> }
    >;
    updateCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        isActive: boolean;
        tone: string;
        categoryId: Id<"service_categories">;
        icon: string;
      },
      { ok: boolean }
    >;
    deleteCategory: Endpoint<
      { categoryId: Id<"service_categories"> },
      { ok: boolean }
    >;
    createSource: Endpoint<
      {
        description?: string | undefined;
        url?: string | undefined;
        name: string;
        kind: "internal" | "official" | "market";
      },
      { sourceId: Id<"price_sources"> }
    >;
    updateSource: Endpoint<
      {
        description?: string | undefined;
        url?: string | undefined;
        name: string;
        kind: "internal" | "official" | "market";
        isActive: boolean;
        sourceId: Id<"price_sources">;
      },
      { ok: boolean }
    >;
    deleteSource: Endpoint<{ sourceId: Id<"price_sources"> }, { ok: boolean }>;
    approveRateSuggestion: Endpoint<
      { suggestionId: Id<"rate_suggestions"> },
      { ok: boolean }
    >;
    rejectRateSuggestion: Endpoint<
      { suggestionId: Id<"rate_suggestions"> },
      { ok: boolean }
    >;
    restorePriceVersion: Endpoint<
      { historyId: Id<"price_history"> },
      { ok: boolean }
    >;
    seedAgentCatalog: Endpoint<
      {},
      {
        categoriesCreated: number;
        servicesCreated: number;
        knowledgeCategories: number;
      }
    >;
  };
  siteCms: {
    publicSite: Endpoint<
      {},
      {
        theme: SiteTheme;
        home: HomeContent;
        pages: {
          slug: string;
          title: string;
          summary: string;
          body: string;
          imageUrls: string[];
          sortOrder: number;
          publishedAt: number | null;
        }[];
      }
    >;
    publicPageBySlug: Endpoint<
      { slug: string },
      {
        slug: string;
        title: string;
        summary: string;
        body: string;
        imageUrls: string[];
        sortOrder: number;
        publishedAt: number | null;
      } | null
    >;
    publicNavigation: Endpoint<
      { location?: "public" | "footer" | undefined },
      {
        id: Id<"navigation_items">;
        label: string;
        href: string;
        location: "public" | "dashboard" | "footer";
        sortOrder: number;
        isActive: boolean;
        isExternal: boolean;
        requiredPlanCode: string | null;
        requiredPermission: string | null;
        updatedAt: number;
      }[]
    >;
    overview: Endpoint<
      {},
      {
        settings: {
          draft: SiteSettingsSnapshot;
          published: SiteSettingsSnapshot;
          publishedAt: number | null;
          updatedAt: number | null;
        };
        pages: {
          id: Id<"site_pages">;
          slug: string;
          published: {
            title: string;
            summary: string;
            body: string;
            imageUrls: string[];
            sortOrder: number;
            status: "published" | "hidden";
          };
          draft: {
            title: string;
            summary: string;
            body: string;
            imageUrls: string[];
            sortOrder: number;
            status: "published" | "hidden";
          };
          publishedAt: number | null;
          updatedAt: number;
        }[];
        navigation: {
          id: Id<"navigation_items">;
          label: string;
          href: string;
          location: "public" | "dashboard" | "footer";
          sortOrder: number;
          isActive: boolean;
          isExternal: boolean;
          requiredPlanCode: string | null;
          requiredPermission: string | null;
          updatedAt: number;
        }[];
        features: {
          id: Id<"feature_flags">;
          key: string;
          label: string;
          description: string;
          isEnabled: boolean;
          allowedPlans: string[];
          allowedRoles: string[];
          dailyLimit: number;
          monthlyLimit: number;
          sortOrder: number;
          updatedAt: number;
        }[];
        planLimits: {
          id: Id<"feature_plan_limits">;
          featureKey: string;
          planCode: string;
          isAllowed: boolean;
          dailyLimit: number;
          monthlyLimit: number;
        }[];
        usage: { aiRequests: number; note: string };
        versions: {
          id: Id<"content_versions">;
          entityType: "site_settings" | "site_page" | "navigation" | "feature";
          entityKey: string;
          label: string;
          createdAt: number;
        }[];
        planCodes: ("trial" | "pro" | "premium" | "basic")[];
        roleCodes: ("owner" | "employee" | "site_admin")[];
      }
    >;
    ensure: Endpoint<{}, { ok: boolean }>;
    saveSettingsDraft: Endpoint<
      {
        settings: {
          theme: {
            primaryColor: string;
            secondaryColor: string;
            backgroundColor: string;
            darkBackgroundColor: string;
            buttonColor: string;
            buttonTextColor: string;
            fontFamily: "system" | "vazirmatn" | "tahoma";
            textScale: number;
            cardRadius: number;
            cardStyle: "flat" | "clay" | "outline";
            iconStyle: "rounded" | "circle" | "square";
            backgroundImageUrl: string | null;
            darkModeEnabled: boolean;
          };
          home: {
            features: {
              active: boolean;
              description: string;
              title: string;
              tone: string;
              icon: string;
            }[];
            heroEyebrow: string;
            heroTitle: string;
            heroSubtitle: string;
            primaryCtaLabel: string;
            primaryCtaHref: string;
            secondaryCtaLabel: string;
            secondaryCtaHref: string;
            announcementEnabled: boolean;
            announcementText: string;
            sectionOrder: string[];
            hiddenSections: string[];
          };
        };
      },
      { ok: boolean }
    >;
    discardSettingsDraft: Endpoint<{}, { ok: boolean }>;
    publishSettings: Endpoint<{}, { ok: boolean }>;
    restoreSettingsVersion: Endpoint<
      { versionId: Id<"content_versions"> },
      { ok: boolean }
    >;
    createPage: Endpoint<
      { title: string; slug: string },
      { pageId: Id<"site_pages"> }
    >;
    savePageDraft: Endpoint<
      {
        status: "published" | "hidden";
        sortOrder: number;
        title: string;
        summary: string;
        body: string;
        imageUrls: string[];
        pageId: Id<"site_pages">;
      },
      { ok: boolean }
    >;
    discardPageDraft: Endpoint<{ pageId: Id<"site_pages"> }, { ok: boolean }>;
    publishPage: Endpoint<{ pageId: Id<"site_pages"> }, { ok: boolean }>;
    restorePageVersion: Endpoint<
      { versionId: Id<"content_versions">; pageId: Id<"site_pages"> },
      { ok: boolean }
    >;
    saveNavigationItem: Endpoint<
      {
        requiredPlanCode?: string | undefined;
        requiredPermission?: string | undefined;
        itemId?: Id<"navigation_items"> | undefined;
        label: string;
        sortOrder: number;
        isActive: boolean;
        href: string;
        location: "public" | "dashboard" | "footer";
        isExternal: boolean;
      },
      { itemId: Id<"navigation_items"> }
    >;
    deleteNavigationItem: Endpoint<
      { itemId: Id<"navigation_items"> },
      { ok: boolean }
    >;
    saveFeatureFlag: Endpoint<
      {
        isEnabled: boolean;
        allowedPlans: string[];
        allowedRoles: string[];
        dailyLimit: number;
        monthlyLimit: number;
        featureId: Id<"feature_flags">;
      },
      { ok: boolean }
    >;
    saveFeaturePlanLimit: Endpoint<
      {
        planCode: string;
        dailyLimit: number;
        monthlyLimit: number;
        featureKey: string;
        isAllowed: boolean;
      },
      { ok: boolean }
    >;
    history: Endpoint<
      {
        entityKey?: string | undefined;
        entityType: "site_settings" | "site_page" | "navigation" | "feature";
      },
      {
        id: Id<"content_versions">;
        entityKey: string;
        label: string;
        createdAt: number;
      }[]
    >;
  };
  superAdmin: {
    recordLoginFailure: Endpoint<{ phone: string }, { ok: boolean }>;
    securityStatus: Endpoint<
      {},
      {
        isPlatformOwner: boolean;
        mfaEnabled: boolean;
        verified: boolean;
        verificationExpiresAt: number | null;
        enabledAt: number | null;
        lastLoginAt: number | null;
        lastMfaAt: number | null;
      }
    >;
    beginMfaSetup: Endpoint<{}, { secret: string; uri: string }>;
    confirmMfaSetup: Endpoint<
      { code: string },
      | { ok: boolean; mfaEnabled: boolean }
      | { ok: boolean; mfaEnabled?: undefined }
    >;
    verifyMfa: Endpoint<{ code: string }, { ok: boolean; mfaEnabled: boolean }>;
    disableMfa: Endpoint<
      { code: string },
      { ok: boolean; message?: undefined } | { ok: boolean; message: string }
    >;
    sessions: Endpoint<
      {},
      {
        id: Id<"authSessions">;
        createdAt: number;
        expiresAt: number;
        expired: boolean;
        current: boolean;
        mfaVerified: boolean;
        mfaExpiresAt: number | null;
      }[]
    >;
    revokeSession: Endpoint<{ sessionId: Id<"authSessions"> }, { ok: boolean }>;
    activity: Endpoint<
      {},
      {
        id: Id<"admin_security_events">;
        action: string;
        outcome: "success" | "failure" | "blocked";
        detail: string | null;
        identifierMasked: string | null;
        actorName: string | null;
        createdAt: number;
      }[]
    >;
    recordAdminLogout: Endpoint<{}, { ok: boolean }>;
    settingsHistory: Endpoint<
      {},
      {
        currentUpdatedAt: number | null;
        rows: {
          id: Id<"platform_settings_history">;
          actorName: string;
          note: string | null;
          createdAt: number;
        }[];
      }
    >;
    restoreSettings: Endpoint<
      { historyId: Id<"platform_settings_history"> },
      { ok: boolean }
    >;
    securitySummary: Endpoint<
      {},
      {
        mfaEnabled: boolean;
        mfaVerified: boolean;
        activeSessions: number;
        failedLogins24h: number;
        failedMfa24h: number;
        recentEvents: {
          id: Id<"admin_security_events">;
          action: string;
          outcome: "success" | "failure" | "blocked";
          identifierMasked: string | null;
          createdAt: number;
        }[];
      }
    >;
  };
  support: {
    myTickets: Endpoint<
      {},
      {
        id: Id<"support_tickets">;
        number: string;
        subject: string;
        category: "billing" | "account" | "technical" | "content" | "other";
        priority: "low" | "normal" | "high" | "urgent";
        status: "open" | "in_progress" | "closed";
        lastMessageAt: number;
        createdAt: number;
        closedAt: number | null;
      }[]
    >;
    myTicket: Endpoint<
      { ticketId: Id<"support_tickets"> },
      {
        id: Id<"support_tickets">;
        number: string;
        subject: string;
        category: "billing" | "account" | "technical" | "content" | "other";
        priority: "low" | "normal" | "high" | "urgent";
        status: "open" | "in_progress" | "closed";
        lastMessageAt: number;
        createdAt: number;
        messages: {
          id: Id<"support_messages">;
          body: string;
          isAdmin: boolean;
          createdAt: number;
        }[];
      }
    >;
    createTicket: Endpoint<
      {
        category: "billing" | "account" | "technical" | "content" | "other";
        subject: string;
        priority: "low" | "normal" | "high" | "urgent";
        body: string;
      },
      { ticketId: Id<"support_tickets">; number: string }
    >;
    replyMyTicket: Endpoint<
      { ticketId: Id<"support_tickets">; body: string },
      { ok: boolean }
    >;
    closeMyTicket: Endpoint<
      { ticketId: Id<"support_tickets"> },
      { ok: boolean }
    >;
    adminList: Endpoint<
      {
        search?: string | undefined;
        status?: "open" | "in_progress" | "closed" | undefined;
        priority?: "low" | "normal" | "high" | "urgent" | undefined;
      },
      {
        items: {
          id: Id<"support_tickets">;
          number: string;
          subject: string;
          category: "billing" | "account" | "technical" | "content" | "other";
          priority: "low" | "normal" | "high" | "urgent";
          status: "open" | "in_progress" | "closed";
          userName: string;
          userPhone: string | null;
          cafeName: string | null;
          assignedTo: Id<"users"> | null;
          lastMessageAt: number;
          createdAt: number;
        }[];
        counts: {
          total: number;
          open: number;
          inProgress: number;
          closed: number;
          urgent: number;
        };
      }
    >;
    adminDetail: Endpoint<
      { ticketId: Id<"support_tickets"> },
      {
        id: Id<"support_tickets">;
        number: string;
        subject: string;
        category: "billing" | "account" | "technical" | "content" | "other";
        priority: "low" | "normal" | "high" | "urgent";
        status: "open" | "in_progress" | "closed";
        createdAt: number;
        lastMessageAt: number;
        assignedTo: string | null;
        user: { id: Id<"users">; name: string; phone: string | null };
        cafe: { id: Id<"internet_cafes">; name: string } | null;
        messages: {
          id: Id<"support_messages">;
          body: string;
          isInternal: boolean;
          isAdmin: boolean;
          createdAt: number;
        }[];
      }
    >;
    adminLogAccess: Endpoint<
      { ticketId: Id<"support_tickets"> },
      { ok: boolean }
    >;
    adminReply: Endpoint<
      {
        setStatus?: "open" | "in_progress" | "closed" | undefined;
        ticketId: Id<"support_tickets">;
        body: string;
        isInternal: boolean;
      },
      { ok: boolean }
    >;
    adminSetStatus: Endpoint<
      {
        status: "open" | "in_progress" | "closed";
        ticketId: Id<"support_tickets">;
      },
      { ok: boolean }
    >;
    adminSetCategory: Endpoint<
      {
        category: "billing" | "account" | "technical" | "content" | "other";
        ticketId: Id<"support_tickets">;
      },
      { ok: boolean }
    >;
    adminSetPriority: Endpoint<
      {
        priority: "low" | "normal" | "high" | "urgent";
        ticketId: Id<"support_tickets">;
      },
      { ok: boolean }
    >;
  };
  tenancy: {
    createMyCafe: Endpoint<
      { name: string; province: string; city: string; address: string },
      { cafeId: Id<"internet_cafes"> }
    >;
    myContext: Endpoint<
      {},
      {
        user: {
          id: Id<"users">;
          name: string | null;
          phone: string | null;
          isAnonymous: boolean;
          requiresPhoneVerification: boolean;
        };
        isSiteAdmin: boolean;
        isSuperAdmin: boolean;
        isPlatformOwner: boolean;
        isBlocked: boolean;
        adminRoles: string[];
        adminPermissions: AdminPermission[];
        isGuest: boolean;
        needsSetup: boolean;
        isOwner: boolean;
        membershipActive: boolean;
        permissions: PermissionKey[];
        cafe: {
          id: Id<"internet_cafes">;
          name: string;
          province: string;
          city: string;
          address: string;
          status: "active" | "suspended";
          createdAt: number;
        } | null;
        membership:
          | { role: "owner"; title: string; id?: undefined; active?: undefined }
          | {
              role: "employee";
              id: Id<"employees">;
              title: string;
              active: boolean;
            }
          | null;
        subscription: {
          id: Id<"subscriptions">;
          planCode: string;
          planName: string;
          status:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment";
          storedStatus:
            | "active"
            | "trial"
            | "expired"
            | "canceled"
            | "pending_payment";
          startsAt: number;
          endsAt: number;
          billingCycle: "monthly" | "yearly";
          lastPaymentAt: number | null;
          renewalAt: number;
        } | null;
        plan: {
          code: string;
          name: string;
          description: string | null;
          features: string[];
          entitlements: {
            accounting: "limited" | "full";
            agent: boolean;
            rates: boolean;
            maxEmployees: number;
            aiRequestsPerMonth: number;
            advancedReports: boolean;
            advancedManagement: boolean;
            prioritySupport: boolean;
          };
          monthlyPriceToman: number;
          yearlyPriceToman: number;
          yearlyDiscountPercent: number;
          isTrial: boolean;
          durationDays: number;
        } | null;
        entitlements: {
          accounting: "limited" | "full";
          agent: boolean;
          rates: boolean;
          maxEmployees: number;
          aiRequestsPerMonth: number;
          advancedReports: boolean;
          advancedManagement: boolean;
          prioritySupport: boolean;
        } | null;
        usage: {
          periodKey: string;
          aiUsed: number;
          aiLimit: number;
          aiRemaining: number;
        } | null;
        subscriptionActive: boolean;
        canUseAgent: boolean;
        canUseRates: boolean;
        hasAdvancedReports: boolean;
        hasAdvancedManagement: boolean;
        daysLeft: number;
        trialUsed: boolean;
        platform: {
          name: string;
          tagline: string;
          supportEmail: string | null;
          supportPhone: string | null;
          maintenanceMode: boolean;
          maintenanceMessage: string | null;
          registrationEnabled: boolean;
          adminBootstrapConfigured: boolean;
          canBootstrapAdmin: boolean;
        };
        notifications: {
          id: Id<"platform_notifications">;
          title: string;
          body: string;
          tone: "success" | "info" | "warning" | "critical";
          createdAt: number;
          kind: "broadcast" | "welcome" | "expiry_warning";
        }[];
        serverNow: number;
      } | null
    >;
    updateCafe: Endpoint<
      { name: string; province: string; city: string; address: string },
      { ok: boolean }
    >;
    updateProfileName: Endpoint<{ name: string }, { ok: boolean }>;
    listPlans: Endpoint<
      {},
      {
        code: string;
        name: string;
        description: string | null;
        durationDays: number;
        priceToman: number;
        monthlyPriceToman: number;
        yearlyPriceToman: number;
        yearlyDiscountPercent: number;
        features: string[];
        entitlements: {
          accounting: "limited" | "full";
          agent: boolean;
          rates: boolean;
          maxEmployees: number;
          aiRequestsPerMonth: number;
          advancedReports: boolean;
          advancedManagement: boolean;
          prioritySupport: boolean;
        } | null;
        isActive: boolean;
      }[]
    >;
  };
  users: {
    currentUser: Endpoint<
      {},
      {
        _id: Id<"users">;
        _creationTime: number;
        name?: string | undefined;
        image?: string | undefined;
        email?: string | undefined;
        emailVerificationTime?: number | undefined;
        isAnonymous?: boolean | undefined;
        role?: "admin" | "user" | "member" | undefined;
        phone?: string | undefined;
        requiresPhoneVerification?: boolean | undefined;
        phoneVerificationTime?: number | undefined;
        lastActivityAt?: number | undefined;
        sessionsRevokedAt?: number | undefined;
        adminPermissionOverride?: string[] | undefined;
        lastLoginAt?: number | undefined;
        termsAcceptedAt?: number | undefined;
        isBlocked?: boolean | undefined;
        blockedAt?: number | undefined;
        blockedReason?: string | undefined;
        blockedBy?: Id<"users"> | undefined;
      } | null
    >;
  };
  websiteCheck: {
    checkWebsite: Endpoint<
      { websiteId: Id<"websites"> },
      { ok: boolean; status: number | null; message: string; checkedAt: number }
    >;
  };
  websites: {
    catalog: Endpoint<
      {},
      {
        items: {
          id: Id<"websites">;
          name: string;
          description: string;
          url: string;
          logoUrl: string | null;
          sourceName: string;
          sourceUrl: string | null;
          verificationStatus: "verified" | "needs_review";
          lastCheckedAt: number | null;
          lastCheckStatus: "ok" | "error" | "unchecked";
          visitCount: number;
          isFeatured: boolean;
          isActive: boolean;
          sortOrder: number;
          updatedAt: number;
          createdAt: number;
          isFavorite: boolean;
          favoriteOrder: number | null;
          lastVisitedAt: number | null;
          category: {
            id: Id<"website_categories">;
            name: string;
            icon: string;
            tone: string;
          };
        }[];
        categories: {
          id: Id<"website_categories">;
          slug: string;
          name: string;
          description: string | null;
          icon: string;
          tone: string;
          count: number;
        }[];
        mySuggestions: {
          id: Id<"website_suggestions">;
          name: string;
          url: string;
          description: string;
          status: "pending" | "rejected" | "approved";
          adminNote: string | null;
          createdAt: number;
        }[];
        stats: {
          total: number;
          favorites: number;
          recent: number;
          featured: number;
          needsReview: number;
        };
        serverNow: number;
      }
    >;
    toggleFavorite: Endpoint<
      { websiteId: Id<"websites"> },
      { isFavorite: boolean }
    >;
    moveFavorite: Endpoint<
      { direction: "up" | "down"; websiteId: Id<"websites"> },
      { moved: boolean }
    >;
    recordVisit: Endpoint<{ websiteId: Id<"websites"> }, { ok: boolean }>;
    submitSuggestion: Endpoint<
      {
        sourceUrl?: string | undefined;
        name: string;
        description: string;
        url: string;
        categoryId: Id<"website_categories">;
        sourceName: string;
      },
      { suggestionId: Id<"website_suggestions"> }
    >;
    reportBroken: Endpoint<
      {
        note?: string | undefined;
        websiteId: Id<"websites">;
        reason: "other" | "not_working" | "wrong_address" | "unsafe";
      },
      { ok: boolean }
    >;
    highlights: Endpoint<
      {},
      {
        items: {
          id: Id<"websites">;
          name: string;
          description: string;
          url: string;
          logoUrl: string | null;
          sourceName: string;
          sourceUrl: string | null;
          verificationStatus: "verified" | "needs_review";
          lastCheckedAt: number | null;
          lastCheckStatus: "ok" | "error" | "unchecked";
          visitCount: number;
          isFeatured: boolean;
          isActive: boolean;
          sortOrder: number;
          updatedAt: number;
          createdAt: number;
          isFavorite: boolean;
          favoriteOrder: number | null;
          lastVisitedAt: number | null;
          category: {
            id: Id<"website_categories">;
            name: string;
            icon: string;
            tone: string;
          };
        }[];
        favoriteCount: number;
        total: number;
      }
    >;
  };
  websitesAdmin: {
    overview: Endpoint<
      {},
      {
        websites: {
          total: number;
          active: number;
          needsReview: number;
          featured: number;
        };
        categories: { total: number; active: number };
        suggestions: number;
        reports: number;
        visits: number;
        generatedAt: number;
      }
    >;
    listWebsites: Endpoint<
      {
        search?: string | undefined;
        status?: "active" | "all" | "needs_review" | "inactive" | undefined;
        categoryId?: Id<"website_categories"> | undefined;
      },
      {
        items: {
          id: Id<"websites">;
          name: string;
          description: string;
          url: string;
          logoUrl: string | null;
          categoryId: Id<"website_categories">;
          categoryName: string;
          categoryTone: string;
          sourceName: string;
          sourceUrl: string | null;
          verificationStatus: "verified" | "needs_review";
          isActive: boolean;
          isFeatured: boolean;
          sortOrder: number;
          visitCount: number;
          lastCheckedAt: number | null;
          lastCheckStatus: "ok" | "error" | "unchecked";
          verifiedAt: number | null;
          createdAt: number;
          updatedAt: number;
          reportCount: number;
          favoriteCount: number;
        }[];
        total: number;
      }
    >;
    categories: Endpoint<
      {},
      {
        id: Id<"website_categories">;
        slug: string;
        name: string;
        description: string | null;
        icon: string;
        tone: string;
        sortOrder: number;
        isActive: boolean;
        websiteCount: number;
        activeCount: number;
      }[]
    >;
    suggestions: Endpoint<
      { status?: "pending" | "rejected" | "approved" | undefined },
      {
        id: Id<"website_suggestions">;
        name: string;
        description: string;
        url: string;
        categoryId: Id<"website_categories">;
        categoryName: string;
        sourceName: string;
        sourceUrl: string | null;
        status: "pending" | "rejected" | "approved";
        adminNote: string | null;
        websiteId: Id<"websites"> | null;
        createdByName: string;
        createdAt: number;
        reviewedAt: number | null;
      }[]
    >;
    reports: Endpoint<
      { status?: "open" | "resolved" | undefined },
      {
        id: Id<"website_reports">;
        websiteId: Id<"websites">;
        websiteName: string;
        websiteUrl: string | null;
        reason: "other" | "not_working" | "wrong_address" | "unsafe";
        note: string | null;
        status: "open" | "resolved";
        createdByName: string;
        createdAt: number;
        resolvedAt: number | null;
      }[]
    >;
    createWebsite: Endpoint<
      {
        sortOrder?: number | undefined;
        logoUrl?: string | undefined;
        sourceUrl?: string | undefined;
        name: string;
        description: string;
        isActive: boolean;
        url: string;
        categoryId: Id<"website_categories">;
        sourceName: string;
        verificationStatus: "verified" | "needs_review";
        isFeatured: boolean;
      },
      { websiteId: Id<"websites"> }
    >;
    updateWebsite: Endpoint<
      {
        logoUrl?: string | undefined;
        sourceUrl?: string | undefined;
        name: string;
        description: string;
        sortOrder: number;
        isActive: boolean;
        url: string;
        categoryId: Id<"website_categories">;
        sourceName: string;
        verificationStatus: "verified" | "needs_review";
        isFeatured: boolean;
        websiteId: Id<"websites">;
      },
      { ok: boolean }
    >;
    setWebsiteActive: Endpoint<
      { isActive: boolean; websiteId: Id<"websites"> },
      { ok: boolean }
    >;
    deleteWebsite: Endpoint<{ websiteId: Id<"websites"> }, { ok: boolean }>;
    seedCatalog: Endpoint<
      {},
      { categoriesCreated: number; websitesCreated: number }
    >;
    createCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        tone: string;
        icon: string;
      },
      { categoryId: Id<"website_categories"> }
    >;
    updateCategory: Endpoint<
      {
        description?: string | undefined;
        name: string;
        isActive: boolean;
        tone: string;
        categoryId: Id<"website_categories">;
        icon: string;
      },
      { ok: boolean }
    >;
    deleteCategory: Endpoint<
      { categoryId: Id<"website_categories"> },
      { ok: boolean }
    >;
    approveSuggestion: Endpoint<
      {
        categoryId?: Id<"website_categories"> | undefined;
        adminNote?: string | undefined;
        suggestionId: Id<"website_suggestions">;
      },
      { websiteId: Id<"websites"> }
    >;
    rejectSuggestion: Endpoint<
      {
        adminNote?: string | undefined;
        suggestionId: Id<"website_suggestions">;
      },
      { ok: boolean }
    >;
    resolveReport: Endpoint<
      { reportId: Id<"website_reports"> },
      { ok: boolean }
    >;
  };
};
export const api = new Proxy(
  {},
  {
    get: (_, module) =>
      new Proxy(
        {},
        { get: (_, name) => ({ name: String(module) + ":" + String(name) }) },
      ),
  },
) as Api;

type Tokens = { token: string; refreshToken: string };
export type AgentSource = {
  updatedAt?: number | undefined;
  url?: string | undefined;
  serviceId?: Id<"services"> | undefined;
  documentId?: Id<"knowledge_documents"> | undefined;
  kind: "knowledge" | "official" | "price";
  title: string;
};
export type AgentCalculation = {
  sourceName?: string | undefined;
  validUntil?: number | undefined;
  addons?:
    | {
        unit: string;
        serviceId: Id<"services">;
        serviceName: string;
        quantity: number;
        unitPriceToman: number;
        lineTotalToman: number;
      }[]
    | undefined;
  totalToman: number;
  priceType: "official" | "suggested" | "custom";
  unit: string;
  serviceId: Id<"services">;
  serviceName: string;
  quantity: number;
  unitPriceToman: number;
  lineTotalToman: number;
};
export type AdminPermission =
  | "dashboard.view"
  | "rates.view"
  | "rates.manage"
  | "cafes.view"
  | "cafes.manage"
  | "users.view"
  | "users.manage"
  | "roles.manage"
  | "finance.view"
  | "finance.manage"
  | "content.view"
  | "content.manage"
  | "ai.view"
  | "ai.manage"
  | "support.view"
  | "support.manage"
  | "settings.manage"
  | "audit.view"
  | "notifications.manage";
export type SiteTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  darkBackgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: "vazirmatn" | "tahoma" | "system";
  textScale: number;
  cardRadius: number;
  cardStyle: "clay" | "flat" | "outline";
  iconStyle: "rounded" | "circle" | "square";
  backgroundImageUrl: string | null;
  darkModeEnabled: boolean;
};
export type HomeContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  announcementEnabled: boolean;
  announcementText: string;
  features: HomeFeatureCard[];
  sectionOrder: string[];
  hiddenSections: string[];
};
export type SiteSettingsSnapshot = { theme: SiteTheme; home: HomeContent };
export type HomeFeatureCard = {
  title: string;
  description: string;
  icon: string;
  tone: string;
  active: boolean;
};

export type ServicePriceMode = "fixed" | "markup_percent" | "markup_toman";
export type ServicePriceType = "official" | "suggested" | "custom";
