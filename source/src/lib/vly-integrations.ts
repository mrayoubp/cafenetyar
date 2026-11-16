// VLY Integrations Configuration
// See /integrations.md for usage documentation

import { createVlyIntegrations } from "@vly-ai/integrations";

type VlyClient = ReturnType<typeof createVlyIntegrations>;

let client: VlyClient | null = null;

/**
 * Initialise the integration client lazily so deterministic features such as
 * price calculation still work when the external AI key is not configured.
 */
export function getVly(): VlyClient {
  const deploymentToken = process.env.VLY_INTEGRATION_KEY?.trim();
  if (!deploymentToken) {
    throw new Error("سرویس هوش مصنوعی هنوز روی سرور تنظیم نشده است.");
  }
  if (!client) {
    client = createVlyIntegrations({
      deploymentToken,
      debug: process.env.NODE_ENV === "development",
    });
  }
  return client;
}
