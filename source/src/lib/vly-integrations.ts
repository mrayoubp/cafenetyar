/** Minimal server-only adapter for the legacy agent's existing completion API.
 * Keeps the original gateway contract without loading browser tooling or SDKs.
 */
type CompletionRequest = {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
};
type CompletionResult = {
  success: boolean;
  data?: { choices: Array<{ message: { content: string } }> };
  error?: string;
};

export function getVly() {
  const token = process.env.VLY_INTEGRATION_KEY?.trim();
  if (!token) throw new Error("سرویس هوش مصنوعی هنوز روی سرور تنظیم نشده است.");
  return {
    ai: {
      async completion(request: CompletionRequest): Promise<CompletionResult> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        try {
          const response = await fetch("https://integrations.vly.ai/v1/llm/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: request.model || "gpt-5",
              messages: request.messages,
              temperature: request.temperature,
              max_tokens: request.maxTokens,
              stream: false,
            }),
            signal: controller.signal,
          });
          if (!response.ok) return { success: false, error: "پاسخ سرویس هوش مصنوعی ناموفق بود." };
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content;
          if (typeof text !== "string" || !text.trim()) return { success: false, error: "پاسخ معتبر دریافت نشد." };
          return { success: true, data: { choices: [{ message: { content: text } }] } };
        } catch {
          return { success: false, error: "ارتباط با سرویس هوش مصنوعی برقرار نشد." };
        } finally {
          clearTimeout(timer);
        }
      },
    },
  };
}
