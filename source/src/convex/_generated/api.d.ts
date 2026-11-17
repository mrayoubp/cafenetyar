/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounting from "../accounting.js";
import type * as admin from "../admin.js";
import type * as adminUsers from "../adminUsers.js";
import type * as agent from "../agent.js";
import type * as agentContext from "../agentContext.js";
import type * as agentStore from "../agentStore.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as authActions from "../authActions.js";
import type * as billing from "../billing.js";
import type * as billingAdmin from "../billingAdmin.js";
import type * as billingAuthz from "../billingAuthz.js";
import type * as crons from "../crons.js";
import type * as employees from "../employees.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeAdmin from "../knowledgeAdmin.js";
import type * as knowledgeExtract from "../knowledgeExtract.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_adminMfa from "../lib/adminMfa.js";
import type * as lib_adminPermissions from "../lib/adminPermissions.js";
import type * as lib_agent from "../lib/agent.js";
import type * as lib_agentDefaults from "../lib/agentDefaults.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_knowledge from "../lib/knowledge.js";
import type * as lib_newsDefaults from "../lib/newsDefaults.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_phoneCode from "../lib/phoneCode.js";
import type * as lib_platform from "../lib/platform.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rss from "../lib/rss.js";
import type * as lib_siteCms from "../lib/siteCms.js";
import type * as lib_siteFeatures from "../lib/siteFeatures.js";
import type * as lib_totp from "../lib/totp.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_websiteDefaults from "../lib/websiteDefaults.js";
import type * as lib_websites from "../lib/websites.js";
import type * as managedAccounts from "../managedAccounts.js";
import type * as news from "../news.js";
import type * as newsAdmin from "../newsAdmin.js";
import type * as newsIngest from "../newsIngest.js";
import type * as notifications from "../notifications.js";
import type * as permissions from "../permissions.js";
import type * as phoneActions from "../phoneActions.js";
import type * as phoneVerification from "../phoneVerification.js";
import type * as platformAdmin from "../platformAdmin.js";
import type * as provinces from "../provinces.js";
import type * as provisionAccounts from "../provisionAccounts.js";
import type * as rates from "../rates.js";
import type * as ratesAdmin from "../ratesAdmin.js";
import type * as recovery from "../recovery.js";
import type * as siteCms from "../siteCms.js";
import type * as superAdmin from "../superAdmin.js";
import type * as support from "../support.js";
import type * as tenancy from "../tenancy.js";
import type * as upgradeManagedAccess from "../upgradeManagedAccess.js";
import type * as users from "../users.js";
import type * as websiteCheck from "../websiteCheck.js";
import type * as websites from "../websites.js";
import type * as websitesAdmin from "../websitesAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounting: typeof accounting;
  admin: typeof admin;
  adminUsers: typeof adminUsers;
  agent: typeof agent;
  agentContext: typeof agentContext;
  agentStore: typeof agentStore;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  authActions: typeof authActions;
  billing: typeof billing;
  billingAdmin: typeof billingAdmin;
  billingAuthz: typeof billingAuthz;
  crons: typeof crons;
  employees: typeof employees;
  http: typeof http;
  knowledge: typeof knowledge;
  knowledgeAdmin: typeof knowledgeAdmin;
  knowledgeExtract: typeof knowledgeExtract;
  "lib/access": typeof lib_access;
  "lib/adminMfa": typeof lib_adminMfa;
  "lib/adminPermissions": typeof lib_adminPermissions;
  "lib/agent": typeof lib_agent;
  "lib/agentDefaults": typeof lib_agentDefaults;
  "lib/billing": typeof lib_billing;
  "lib/knowledge": typeof lib_knowledge;
  "lib/newsDefaults": typeof lib_newsDefaults;
  "lib/permissions": typeof lib_permissions;
  "lib/phoneCode": typeof lib_phoneCode;
  "lib/platform": typeof lib_platform;
  "lib/pricing": typeof lib_pricing;
  "lib/rss": typeof lib_rss;
  "lib/siteCms": typeof lib_siteCms;
  "lib/siteFeatures": typeof lib_siteFeatures;
  "lib/totp": typeof lib_totp;
  "lib/validation": typeof lib_validation;
  "lib/websiteDefaults": typeof lib_websiteDefaults;
  "lib/websites": typeof lib_websites;
  managedAccounts: typeof managedAccounts;
  news: typeof news;
  newsAdmin: typeof newsAdmin;
  newsIngest: typeof newsIngest;
  notifications: typeof notifications;
  permissions: typeof permissions;
  phoneActions: typeof phoneActions;
  phoneVerification: typeof phoneVerification;
  platformAdmin: typeof platformAdmin;
  provinces: typeof provinces;
  provisionAccounts: typeof provisionAccounts;
  rates: typeof rates;
  ratesAdmin: typeof ratesAdmin;
  recovery: typeof recovery;
  siteCms: typeof siteCms;
  superAdmin: typeof superAdmin;
  support: typeof support;
  tenancy: typeof tenancy;
  upgradeManagedAccess: typeof upgradeManagedAccess;
  users: typeof users;
  websiteCheck: typeof websiteCheck;
  websites: typeof websites;
  websitesAdmin: typeof websitesAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
