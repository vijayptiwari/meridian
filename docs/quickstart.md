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

Visit http://127.0.0.1:3030

## 3. Configure profile

- Open **Settings** in the sidebar
- Fill in name, skills, target titles, and search queries
- Or upload a resume on the intake panel

## 4. LLM (optional)

Set in `.env`:

```env
OPENAI_API_KEY=sk-...
```

Or configure in Settings → **LLM Provider**.

For **Ollama**:

```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.1
```

## 5. Run

- **Try Demo** — sample jobs, no portals
- **Run Jobs Dashboard** — full pipeline (enable **Headed browser** for first LinkedIn login)

## Outputs

Results are saved under `data/output/`:

- `jobs-*.json`, `shortlist-*.json`, `agent-report-*.json`
- Tailored resumes in `data/output/tailored-resumes/`
