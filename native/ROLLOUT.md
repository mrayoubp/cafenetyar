# Native Sites backend

The native entrypoint is native/server.mjs, bundled into dist/server/index.js. Original Convex source and static artifacts are retained for recovery; they are not the native runtime.

Uses Sites identity headers, an owner email bootstrap configured only in runtime, application session cookies, D1 persistence, owner TOTP, and server-side permissions. Phone is contact data, not verified authentication. Owner account bootstrap requires both a dispatch-authenticated identity and exact configured owner email; identity ID becomes the durable key.

Implemented: owner/admin/customer accounts, per-admin grants, account blocking, session revocation, last login, immutable API audit with before/after snapshots, published/draft text content, news/services/plan descriptions, logo upload and site settings, personal income/expense records, ticket submission/replies, subscription-end enforcement for transaction writes.

Not connected: SMS delivery/verification, payment gateway, previous Convex data, AI agent. The previous full application contains additional modules not yet ported into the native UI. Site remains owner-private; inviting records does not grant Sites hosting access. No public audience change is authorized.

Checks: node --test native/server.test.mjs. Tests use SQLite with the same migration and a D1 adapter; they are not live Cloudflare acceptance tests. Browser QA unavailable in managed runtime.

Runtime: OWNER_EMAIL, OWNER_PHONE (contact only). Deploy migrations before Worker activation; never mutate schema in request handlers.
