# Configuration

Meridian reads `src/config.json`. Copy from `src/config.example.json`.

## Sections

| Section | Purpose |
|---|---|
| `profile` | Name, skills, titles, resume summary |
| `preferences` | Search queries, score threshold, easy apply |
| `locationPolicy` | Expected physical location for hybrid/WFO |
| `salary` | Compensation filters |
| `transition` | Career transition mode inputs |
| `gmail` | Gmail cleanup settings |
| `portals` | Enable LinkedIn / Naukri |
| `llm` | Provider, model, base URL, webhook |

## Environment variables

See `.env.example`. Env vars override config for LLM keys and agent runtime flags.

## Security

- Never commit `src/config.json` or `.env`
- UI listens on `127.0.0.1` by default (`JOB_AGENT_UI_HOST`)
