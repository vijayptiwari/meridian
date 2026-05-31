# LLM providers

Meridian supports three modes via `config.llm.provider`:

## OpenAI-compatible (default)

Works with OpenAI, Azure OpenAI, Groq, Together, and **Ollama**.

```json
"llm": {
  "provider": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4.1-mini",
  "apiKey": null
}
```

Set `OPENAI_API_KEY` in `.env` instead of storing the key in config.

### Ollama example

```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
```

## Webhook

POST JSON to your endpoint; expect JSON back within 60 seconds.

```json
"llm": {
  "provider": "webhook",
  "webhookUrl": "http://localhost:8080/meridian-llm"
}
```

Request body:

```json
{
  "systemPrompt": "...",
  "userPayload": { },
  "schema": "json"
}
```

## Keyword-only

No LLM calls — deterministic scoring and resume keyword tailoring.

```json
"llm": {
  "provider": "keyword-only"
}
```

## Test connection

Use **Test LLM connection** in Settings or:

```bash
curl -X POST http://127.0.0.1:3030/api/llm/test
```
