# Dashboard guide

Start the UI with `npm run ui`, then open [http://127.0.0.1:3030](http://127.0.0.1:3030).

Full HTML version: [dashboard.html](./dashboard.html) on the product site.

## Get started (first screen)

1. **Upload resume** — PDF, DOCX, TXT, or MD (parsed locally).
2. **Choose your goal** — Find jobs · Upskill · Change career.
3. **Start analysis** — Start search / Try demo / Open settings.

Click the **Meridian** logo for about info, docs link, and contact.

## Settings panel

| Section | Contents |
|---|---|
| Profile | Name, skills, titles, queries, summary |
| Search & run | Portal, mode, headed browser, salary, transition |
| LLM | Provider, model, API key, keyword-only |

Saved to `src/config.json`.

## Workspaces

| Goal | Mode | Tabs |
|---|---|---|
| Find jobs | search, assist-apply, demo | Results · Runs · Jobs · Tracker |
| Upskill | next-role | Overview · Runs · Learning |
| Change career | career-transition | Overview · Runs · Plan |

## Run persistence

- **Page refresh** — worker keeps running; UI reconnects.
- **Server restart** — reattach if PID alive; else **interrupted** with checkpoint.
- **Resume from checkpoint** — same run id, continues after last completed agent.
- **Replay run** — new run with same mode/portal/settings.

Checkpoints: `data/ui/checkpoints/{runId}.json`  
Active run: `data/ui/active-run.json`  
History: `data/ui/run-history.json`  
Logs: `data/ui/run-logs/{runId}.log`

## Docs ↔ dashboard

Portfolio docs link back to your dashboard. Custom URL: append `?dashboard=http://your-host:3030` to any docs page once.
