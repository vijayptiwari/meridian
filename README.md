# Meridian

**Align your next move.**

Meridian is an open-source, local-first AI career agent. Search jobs, score fit, tailor resumes, and assist with applications on LinkedIn and Naukri. **Your data never leaves your machine.** No account. No login.

## Features

- Local web dashboard (`npm run ui`)
- Multi-agent pipeline: research → salary → fit → resume tailoring → prep
- Upskilling and career-transition modes
- BYOK LLM: OpenAI-compatible APIs, Ollama, Groq, Azure, or custom webhook
- Keyword-only fallback when no API key is configured
- Optional Gmail cleanup (local OAuth)
- Demo mode — try the UI without portal access

## Quick start

```bash
git clone <repository-url>
cd JobApplier
cp src/config.example.json src/config.json
cp .env.example .env
npm install
npx playwright install chromium
npm run doctor
npm run ui
```

Open **http://127.0.0.1:3030** — the dashboard loads immediately.

### First run

1. Upload a resume or edit profile in **Settings**
2. Add your LLM API key in `.env` or Settings (optional)
3. Click **Try Demo** or run a full job search with **Headed browser** for LinkedIn login

## Scripts

| Command | Description |
|---|---|
| `npm run ui` | Start local dashboard |
| `npm run search` | CLI job search |
| `npm run assist-apply` | Search + assisted apply |
| `npm run demo` | Generate sample output |
| `npm run doctor` | Verify install health |

Windows: `.\run-agent.ps1 -Mode search -Headed`  
macOS/Linux: `bash scripts/run-agent.sh both search`

## Docker (optional)

```bash
cp src/config.example.json src/config.json
docker compose up --build
```

## Documentation

- [Quickstart](docs/quickstart.md)
- [Configuration](docs/configuration.md)
- [LLM providers](docs/llm-providers.md)
- [Portals](docs/portals.md)
- [Gmail cleanup](docs/gmail-cleanup.md)

## Disclaimer

Meridian is an **assisted** workflow tool. You are responsible for complying with LinkedIn, Naukri, and employer terms of service. Review all generated resume content before submitting.

## License

MIT — see [LICENSE](LICENSE)
