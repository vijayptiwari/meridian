const { extractJsonFromText } = require("./parse-json");

async function completeOpenAICompatible({ llmConfig, systemPrompt, userPayload, log }) {
  if (!llmConfig.apiKey) {
    log?.warn?.("LLM skipped: no API key configured.");
    return { data: null, provider: "openai-compatible", status: "missing_key" };
  }

  const userText = JSON.stringify(userPayload, null, 2);
  const chatUrl = `${llmConfig.baseUrl}/chat/completions`;
  const chatPayload = {
    model: llmConfig.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ]
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${llmConfig.apiKey}`,
    ...llmConfig.headers
  };

  try {
    let response = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(chatPayload)
    });

    if (response.ok) {
      const json = await response.json();
      const text = json.choices?.[0]?.message?.content || "";
      const data = extractJsonFromText(text);
      if (data !== null) {
        return { data, provider: "openai-compatible", status: "ok" };
      }
    }

    const responsesUrl = `${llmConfig.baseUrl}/responses`;
    const responsesPayload = {
      model: llmConfig.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userText }]
        }
      ]
    };

    response = await fetch(responsesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(responsesPayload)
    });

    if (!response.ok) {
      log?.warn?.(`LLM request failed with status ${response.status}.`);
      return { data: null, provider: "openai-compatible", status: "error" };
    }

    const json = await response.json();
    const text = json.output_text || "";
    const data = extractJsonFromText(text);
    return { data, provider: "openai-compatible", status: data === null ? "parse_error" : "ok" };
  } catch (error) {
    log?.warn?.(`LLM request skipped: ${error.message}`);
    return { data: null, provider: "openai-compatible", status: "error" };
  }
}

module.exports = { completeOpenAICompatible };
