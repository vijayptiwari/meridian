# Changelog

## 0.2.0 — 2026-05-31

### Added

- Product roadmap (`docs/ROADMAP.md`, `docs/roadmap.html`) with impact scorecard
- First-run wizard, application tracker, resume diff, run compare, export/import bundle
- Job card match panels (skills, stability, apply route, score reasons)
- Portal ToS modal, privacy/troubleshooting/architecture docs
- `npm run init` one-command setup, Ollama preset, portal health checks in doctor
- Weekly ops summary, email-apply draft panel, shortlist sorting

### Changed

- Homepage headline and product-style dashboard preview
- CSV export includes tracker state and apply route columns
- Setup checklist includes demo and portal health steps

### Removed

- Gmail cleanup feature (out of scope)

## 0.1.0 — 2026-05-31

### Added

- **Meridian** rebrand (local-first open-source career agent)
- Cross-platform npm scripts and `scripts/run-agent.sh`
- Pluggable LLM layer: OpenAI-compatible, webhook, keyword-only fallback
- Pipeline orchestrator and shared agent stage map
- Node-native resume extraction (DOCX/PDF) with Python fallback
- Setup checklist, demo mode, CSV shortlist export, `npm run doctor`
- Docker Compose optional path
- Documentation: quickstart, configuration, LLM providers, portals

### Changed

- UI server binds to `127.0.0.1` by default
- Removed hardcoded Windows codex runtime paths
- Playwright declared as npm dependency

### Removed

- OpenAI-only `src/lib/openai.js` (replaced by `src/lib/llm/`)
