const { extractJsonFromText } = require("./parse-json");

async function completeWebhook({ llmConfig, systemPrompt, userPayload, log }) {
  if (!llmConfig.webhookUrl) {
    log?.warn?.("LLM webhook skipped: no webhook URL configured.");
    return { data: null, provider: "webhook", status: "missing_url" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llmConfig.timeoutMs || 60000);

  try {
    const response = await fetch(llmConfig.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        userPayload,
        schema: "json"
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      log?.warn?.(`LLM webhook failed with status ${response.status}.`);
      return { data: null, provider: "webhook", status: "error" };
    }

    const raw = await response.text();
    let data;
    try {
      const parsed = JSON.parse(raw);
      data = parsed.result !== undefined ? parsed.result : parsed;
      if (typeof data === "string") {
        data = extractJsonFromText(data);
      }
    } catch {
      data = extractJsonFromText(raw);
    }

    return { data, provider: "webhook", status: data === null ? "parse_error" : "ok" };
  } catch (error) {
    log?.warn?.(`LLM webhook skipped: ${error.message}`);
    return { data: null, provider: "webhook", status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { completeWebhook };
