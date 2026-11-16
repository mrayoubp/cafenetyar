# Managed administration rollout

Implemented: navy/cyan palette, owner-only provisioning, server authorization, enforced owner MFA, blocked public password signup, mobile verification with hashed codes, five attempts and hourly send limits, audit date/section filters, session revocation backend. 43 tests pass.

Production currently runs the visual changes with VITE_MANAGED_ACCOUNTS=false. Backend changes have NOT been deployed. Do not enable the UI flag before deployment and migration.

Required deployment access: Convex production deployment credential, configured securely outside chat. Set SITE_ADMIN_BOOTSTRAP_PHONE=09939417533. Do not replace an existing owner. The initial owner must be provisioned through the trusted deployment administration path and mobile ownership verified; the migration never fabricates verification. Enroll authenticator MFA before owner operations.

SMS adapter prepared for Kavenegar: KAVENEGAR_API_KEY and KAVENEGAR_VERIFY_TEMPLATE. No SMS provider is currently connected. Accounts created by the new flow remain unable to access protected resources until mobile verification succeeds. Existing accounts are preserved.

Deploy Convex source, run upgradeManagedAccess:apply with the authenticated Convex CLI, then build with VITE_MANAGED_ACCOUNTS=true and the existing production VITE_CONVEX_URL. Test actual owner login, provisioning, OTP delivery and role limits before release.

Original logo image is visible in the conversation but unavailable as a local asset; exact PNG/JPG still required. No replacement image has been invented.

Remaining: production configuration and acceptance; full integration of session revocation controls and individual admin profile/permission overrides; comprehensive audit before/after snapshots. Current role-based permission editor remains in place.
