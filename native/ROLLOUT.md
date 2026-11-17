# Original application with connected management

The published entrypoint is `native/composed-server.mjs`, bundled into `dist/server/index.js`. It serves the ORIGINAL React/Vite application at `/` and its existing dashboard routes. `/manage` serves the management panel; `/admin` and `/super-admin` redirect there. Never deploy `native/server.mjs` alone: that would replace the original site with the standalone UI again.

The original site layout and accounting, employees, agent, rates and account screens remain in `source/`. Those modules retain the previous Convex connection. Existing Convex accounts, subscriptions, payments and tickets have NOT been migrated or made editable by the new panel. The management overview states this boundary.

The new panel manages site branding, uploaded logo, landing heading, contact details, articles and website directory entries. The original News, NewsDetail and Sites components use `/api/bridge` for compatible data. Favorites, read markers, suggestions and broken-link reports persist in D1 under the verified Sites identity. The review queue is protected by content permissions. Approving a suggestion records review; publishing a suggested website is a separate CMS action.

Published content merges `native/library.json` (42 websites and six articles) with D1 overrides. Hiding a bundled item persists an unpublished override. No automatic news refresh or live link availability is claimed. New preferences and request tables use additive migration 0002.

Administration uses Sites identity headers, exact configured owner email bootstrap, application session cookies, owner TOTP, permissions, account blocking, session revocation and audit. New panel accounts are separate from original Convex accounts. Runtime configuration: `OWNER_EMAIL`, `OWNER_PHONE` (contact only). SMS is not connected. Site remains owner-private; creating account records does not change hosting access.

The only new purchase offer is a one-month subscription for 500,000 toman. A shared `MonthlyPlanCard` appears on the landing page, subscription screen and `/p/plans`. It opens `https://t.me/Cafenetyarr` with a purchase/renewal draft. The customer sends the message in Telegram; clicking does not send it or activate a subscription. Existing subscription/payment history and old payment callbacks are preserved, but new online orders and annual/multi-tier purchase controls are removed. Activation of original Convex subscriptions still requires access to that backend.

Build from the repository root:

```sh
cd source
VITE_CONVEX_URL=https://striped-cobra-115.convex.cloud VITE_MANAGED_ACCOUNTS=false VITE_SITE_ADMIN=true npm run build
cd ..
node scripts/build-original-with-admin.mjs
node --test native/server.test.mjs native/composition.test.mjs
```

The build embeds only `source/dist` assets in the composed Worker and copies migrations. The composition checks ensure the root and original dashboard routes serve the exact original Vite HTML, assets are intact, and management stays on its own route. API tests use SQLite and a D1 adapter. Original application tests run with `npm test` inside `source/`. Browser QA is unavailable in this managed runtime; no live browser validation is claimed. Deploy migrations before activation; never mutate schema from request handlers.

Release hardening (2026-11-17): dashboard news and site highlights now use the same managed content as their full pages. Removed the prior builder's frontend integration plugin and toolbar. The legacy AI source now uses a small typed fetch adapter with the same gateway contract, timeout and safe failures, replacing the vulnerable SDK chain. Its live Convex deployment is unchanged. Added a reproducible npm lockfile, root build/test commands, GitHub CI, release notes, favicon routing, and current-repository download links. The whole release and original source history are backed up in the private GitHub repository; runtime D1 and Convex data are not source backups.
