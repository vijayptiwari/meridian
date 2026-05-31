# Contributing to Meridian

Thank you for helping improve Meridian. This project is local-first, agent-driven, and focused on assisted career operations.

## Development setup

```bash
git clone https://github.com/vijayptiwari/meridian.git
cd meridian
npm run init
npm run ui
```

Open `http://127.0.0.1:3030`.

## Project layout

| Path | Purpose |
|------|---------|
| `src/agents/` | Pipeline agents (research, scoring, resume, apply) |
| `src/lib/` | Shared libraries (scoring, config, LLM, tracker) |
| `src/portals/` | LinkedIn and Naukri integrations |
| `src/ui/` | Local dashboard server and static UI |
| `docs/` | Product site and markdown documentation |

## Adding an agent

1. Create `src/agents/yourAgent.js` using `createGoalDrivenAgent` from `src/agents/base.js`.
2. Register the agent in `src/lib/pipelines.js`.
3. Add a stage mapping in `src/lib/agent-stages.js`.
4. Expose any new artifacts through `src/ui/server.js` if the dashboard should display them.

## Adding a portal

1. Create `src/portals/yourPortal.js` with search/scrape helpers.
2. Wire the portal into `src/agents/jobResearchAgent.js` or the parent orchestrator.
3. Add selector health constants to `src/lib/portal-health.js`.
4. Document login and headed-browser usage in `docs/portals.md`.

## Pull requests

- Keep changes focused and match existing code style.
- Run `npm run doctor` before submitting.
- Update docs when user-facing behavior changes.

## Good first issues

- Portal selector fixes
- Documentation improvements
- Dashboard UX polish
- Score explanation copy

See [ROADMAP.md](docs/ROADMAP.md) for planned work.
