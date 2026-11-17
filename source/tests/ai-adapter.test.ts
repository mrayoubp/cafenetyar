import { afterEach, expect, test, vi } from "vitest";
import { getVly } from "../src/lib/vly-integrations";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("the agent requires a server key and never calls the gateway without one", () => {
  vi.stubEnv("VLY_INTEGRATION_KEY", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(() => getVly()).toThrow(/تنظیم نشده/);
  expect(fetcher).not.toHaveBeenCalled();
});

test("completion preserves the legacy gateway contract and validates the text response", async () => {
  vi.stubEnv("VLY_INTEGRATION_KEY", "fixture-only");
  const fetcher = vi.fn(async () => Response.json({ choices: [{ message: { content: "پاسخ آزمون" } }] }));
  vi.stubGlobal("fetch", fetcher);
  const result = await getVly().ai.completion({ model: "model-fixture", messages: [{ role: "user", content: "پرسش" }], maxTokens: 700 });
  expect(result.data?.choices[0].message.content).toBe("پاسخ آزمون");
  const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://integrations.vly.ai/v1/llm/chat/completions");
  expect(request.headers).toMatchObject({ Authorization: "Bearer fixture-only" });
  expect(JSON.parse(request.body as string)).toMatchObject({ model: "model-fixture", max_tokens: 700, stream: false });
  expect(request.signal).toBeDefined();
});

test.each(["rejected", "empty", "network"])("gateway %s failures produce a safe fallback", async (kind) => {
  vi.stubEnv("VLY_INTEGRATION_KEY", "fixture-only");
  vi.stubGlobal("fetch", vi.fn(async () => {
    if (kind === "network") throw new Error("sensitive-upstream-response");
    return kind === "rejected" ? new Response("sensitive-upstream-response", { status: 401 }) : Response.json({ choices: [] });
  }));
  const result = await getVly().ai.completion({ messages: [] });
  expect(result.success).toBe(false);
  expect(result.error).not.toContain("sensitive-upstream-response");
});
