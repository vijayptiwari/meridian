# Configuration

Meridian reads `src/config.json`. Copy from `src/config.example.json`.

Edit via **Settings** in the dashboard (Profile · Search & run · LLM) or directly in the file. See [dashboard.md](./dashboard.md).

## Sections

| Section | Purpose |
|---|---|
| `profile` | Name, skills, titles, resume summary |
| `preferences` | Search queries, score threshold, easy apply |
| `locationPolicy` | Expected physical location for hybrid/WFO |
| `salary` | Compensation filters |
| `transition` | Career transition mode inputs |
| `portals` | Enable LinkedIn / Naukri |
| `llm` | Provider, model, base URL, webhook |

## Environment variables

See `.env.example`. Env vars override config for LLM keys and agent runtime flags.

- `JOB_AGENT_MODE` — search, assist-apply, demo, next-role, career-transition
- `JOB_AGENT_PORTAL` — linkedin, naukri, or both
- `JOB_AGENT_HEADED` — visible browser for portal login
- `JOB_AGENT_RUN_ID` — run id for artifacts (set by UI server)
- `JOB_AGENT_RESUME_RUN_ID` — resume from checkpoint (set by UI on resume)
- `JOB_AGENT_UI_HOST` — dashboard bind address (default `127.0.0.1`)
- `JOB_AGENT_UI_PORT` — dashboard port (default `3030`)

## Documentation ↔ self-hosted dashboard

Product docs: [vijayptiwari.github.io/meridian](https://vijayptiwari.github.io/meridian/)

Those pages include **Open dashboard** links that default to `http://127.0.0.1:3030`. If you run Meridian on another host or port, open any docs page once with:

`?dashboard=https://your-host:3030`

The docs site remembers that URL in your browser for header, footer, sidebar, and callout links.

## Security

- Never commit `src/config.json` or `.env`
- UI listens on `127.0.0.1` by default — do not expose without reverse proxy and auth
- Browser session state in `data/browser-state/` — treat like credentials
