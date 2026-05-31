const { resolveLlmConfig } = require("./config");
const { completeOpenAICompatible } = require("./openai-compat");
const { completeWebhook } = require("./webhook");

async function completeJson({ config, systemPrompt, userPayload, log }) {
  const llmConfig = resolveLlmConfig(config);

  if (llmConfig.provider === "keyword-only") {
    return null;
  }

  if (llmConfig.provider === "webhook") {
    const result = await completeWebhook({ llmConfig, systemPrompt, userPayload, log });
    return result.data;
  }

  const result = await completeOpenAICompatible({ llmConfig, systemPrompt, userPayload, log });
  return result.data;
}

async function testLlmConnection(config, log) {
  const llmConfig = resolveLlmConfig(config);

  if (llmConfig.provider === "keyword-only") {
    return { ok: true, provider: "keyword-only", message: "Keyword-only mode is active." };
  }

  const probe = await completeJson({
    config,
    systemPrompt: 'Return strict JSON: {"ok": true}',
    userPayload: { ping: true },
    log
  });

  if (probe && probe.ok === true) {
    return { ok: true, provider: llmConfig.provider, message: "LLM connection successful." };
  }

  return {
    ok: false,
    provider: llmConfig.provider,
    message: "LLM connection failed. Check API key, base URL, or webhook."
  };
}

module.exports = { completeJson, testLlmConnection, resolveLlmConfig };
