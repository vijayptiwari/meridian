# Quickstart

## 1. Install

```bash
cp src/config.example.json src/config.json
cp .env.example .env
npm install
npx playwright install chromium
npm run doctor
```

## 2. Start the dashboard

```bash
npm run ui
```

Visit [http://127.0.0.1:3030](http://127.0.0.1:3030) after starting the UI.

### Link back from the docs site

The GitHub Pages documentation at [vijayptiwari.github.io/meridian](https://vijayptiwari.github.io/meridian/) includes **Open dashboard** links in the header, footer, and doc sidebar. They default to `http://127.0.0.1:3030`.

If you self-host on another machine or port, open any docs page once with a query parameter, for example:

`https://vijayptiwari.github.io/meridian/getting-started.html?dashboard=http://192.168.1.10:3030`

The docs site stores that URL in your browser and uses it for all dashboard links.

## 3. First run in the dashboard

1. **Upload resume** in the Get started section (or edit profile in **Settings**).
2. **Choose your goal** — Find jobs, Upskill, or Change career.
3. Click **Try demo first** or **Start job search** (wording changes per goal).
4. Enable **Headed browser** in Settings → Search & run when portal login is needed.

See [dashboard.md](./dashboard.md) for tabs, resume/replay, and data paths.

## 4. LLM (optional)

Set in `.env`:

```env
OPENAI_API_KEY=sk-...
```

Or configure in Settings → **LLM**.

For **Ollama**:

```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
```

## 5. Run

- **Try demo first** — sample jobs, no portals
- **Start job search** — full pipeline (headed browser for first LinkedIn/Naukri login)
- **Resume from checkpoint** — after an interrupted run (see dashboard guide)
- **Replay run** — re-run a completed or failed run with the same settings

## Outputs

Results under `data/output/`:

- `jobs-{runId}.json`, `shortlist-{runId}.json`, `agent-report-{runId}.json`
- Tailored resumes in `data/output/tailored-resumes/`
- Checkpoints in `data/ui/checkpoints/`, logs in `data/ui/run-logs/`
