function resolveLlmConfig(config) {
  const fromConfig = config?.llm || {};
  const provider = fromConfig.provider || process.env.MERIDIAN_LLM_PROVIDER || "openai-compatible";

  if (provider === "keyword-only") {
    return { provider: "keyword-only" };
  }

  if (provider === "webhook") {
    return {
      provider: "webhook",
      webhookUrl: fromConfig.webhookUrl || process.env.MERIDIAN_LLM_WEBHOOK_URL || "",
      timeoutMs: Number(fromConfig.timeoutMs || process.env.MERIDIAN_LLM_WEBHOOK_TIMEOUT_MS || 60000)
    };
  }

  return {
    provider: "openai-compatible",
    apiKey: fromConfig.apiKey || process.env.OPENAI_API_KEY || "",
    baseUrl: (fromConfig.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: fromConfig.model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    headers: fromConfig.headers || {}
  };
}

module.exports = { resolveLlmConfig };
