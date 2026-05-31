# Meridian

**Align your next move.**

**Website:** [vijayptiwari.github.io/meridian](https://vijayptiwari.github.io/meridian/) — product overview, docs, and why Meridian is different.

Meridian is an open-source, local-first AI career agent. Search jobs, score fit, tailor resumes, and assist with applications on LinkedIn and Naukri. **Your data never leaves your machine.** No account. No login.

## Features

- Local web dashboard (`npm run ui`) with **Get started** flow — upload resume, pick a goal, run analysis
- Three workspaces: **Find jobs**, **Upskilling**, **Career transition**
- **Settings** panel: Profile · Search & run · LLM (not a separate filters-only screen)
- Run **persistence** — page refresh reconnects; **resume from checkpoint** or **replay** after interrupt
- Multi-agent pipeline: research → salary → fit → resume tailoring → prep
- BYOK LLM: OpenAI-compatible APIs, Ollama, Groq, Azure, or custom webhook
- Keyword-only fallback when no API key is configured
- Demo mode — try the UI without portal access
- Docs site links back to your self-hosted dashboard ([vijayptiwari.github.io/meridian](https://vijayptiwari.github.io/meridian/))

## Quick start

```bash
git clone <repository-url>
cd meridian
cp src/config.example.json src/config.json
cp .env.example .env
npm install
npx playwright install chromium
npm run doctor
npm run ui
```

Open **http://127.0.0.1:3030** — the dashboard loads immediately.

### First run

1. Upload a resume in **Get started** (step 1) or edit profile in **Settings**
2. Choose **Find jobs**, **Upskill**, or **Change career** (step 2)
3. Click **Try demo first** or **Start job search** (step 3)
4. Optional: LLM API key in `.env` or Settings → LLM

See [docs/dashboard.md](docs/dashboard.md) and the [dashboard guide](https://vijayptiwari.github.io/meridian/dashboard.html) for tabs, resume/replay, and data paths.

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

- [Product site & docs hub](https://vijayptiwari.github.io/meridian/) — includes links back to your self-hosted dashboard (`http://127.0.0.1:3030` by default)
- [Dashboard guide](https://vijayptiwari.github.io/meridian/dashboard.html) · [markdown](docs/dashboard.md)
- [Why Meridian is different](https://vijayptiwari.github.io/meridian/compare.html)
- [Quickstart](https://vijayptiwari.github.io/meridian/getting-started.html) · [markdown](docs/quickstart.md)
- [Configuration](https://vijayptiwari.github.io/meridian/configuration.html) · [markdown](docs/configuration.md)
- [LLM providers](https://vijayptiwari.github.io/meridian/llm-providers.html) · [markdown](docs/llm-providers.md)
- [Portals](https://vijayptiwari.github.io/meridian/portals.html) · [markdown](docs/portals.md)
- [Roadmap](https://vijayptiwari.github.io/meridian/roadmap.html) · [markdown](docs/ROADMAP.md)

## Disclaimer

Meridian is an **assisted** workflow tool. You are responsible for complying with LinkedIn, Naukri, and employer terms of service. Review all generated resume content before submitting.

## License

MIT — see [LICENSE](LICENSE)
