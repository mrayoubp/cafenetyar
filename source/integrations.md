# Legacy AI integration

The original Convex agent calls `getVly().ai.completion` in `src/lib/vly-integrations.ts`. This small server-side adapter uses the same OpenAI-compatible gateway as the previous SDK: `https://integrations.vly.ai/v1/llm/chat/completions`. It requires `VLY_INTEGRATION_KEY` in Convex server settings, uses a 30-second request timeout, validates text responses, and returns a safe fallback on failure. No key belongs in Vite variables or GitHub.

The old browser integration plugin and its SDK dependency were removed from the release because of vulnerable transitive dependencies and unnecessary browser tooling. The adapter is covered by mocked transport tests. No paid generation was called for release verification. The existing Convex production backend has not been redeployed: deployment and live AI verification still require its owner's credentials.

This adapter does not provide SMS, email delivery or payment processing. Telegram purchase requests are separate and do not automatically activate old subscriptions.
