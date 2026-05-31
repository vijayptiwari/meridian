# Changelog

## 0.1.0 — 2026-05-31

### Added

- **Meridian** rebrand (local-first open-source career agent)
- Cross-platform npm scripts and `scripts/run-agent.sh`
- Pluggable LLM layer: OpenAI-compatible, webhook, keyword-only fallback
- Pipeline orchestrator and shared agent stage map
- Node-native resume extraction (DOCX/PDF) with Python fallback
- Setup checklist, demo mode, CSV shortlist export, `npm run doctor`
- Docker Compose optional path
- Documentation: quickstart, configuration, LLM providers, portals, Gmail

### Changed

- UI server binds to `127.0.0.1` by default
- Removed hardcoded Windows codex runtime paths
- Playwright declared as npm dependency

### Removed

- OpenAI-only `src/lib/openai.js` (replaced by `src/lib/llm/`)
