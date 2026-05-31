# Meridian 10/10 Roadmap and Impact Plan

## North star

**10/10 for Meridian means:** a serious job seeker or career pivoter can install Meridian, see value in under 2 minutes (demo), run a real search in under 15 minutes, and use it daily as their **local career ops system** — not a one-off resume generator.

This plan does **not** chase mass-market auto-apply or cloud SaaS. It doubles down on local-first, assisted workflow, and privacy.

---

## Current state (baseline)

| Dimension | Today | Primary blocker |
|-----------|-------|-----------------|
| Problem / ICP fit | 7.5 | Setup friction; unclear positioning |
| Product depth | 7 | Pipeline exists; post-shortlist lifecycle missing |
| UX / onboarding | 4–5 | Clone + config + Playwright path; no wizard |
| Brand / marketing | 4 | CSS mock hero; logo polish needed |
| Docs | 6 | Solid markdown; no video, search, or troubleshooting hub |
| Trust / compliance | 5 | Disclaimers in docs only; no apply audit or portal health |
| AI differentiation | ~6 | Scores exist; reasons buried; keyword-only under-marketed |

**Hidden value already in code (productized in v0.2+):**

- Match breakdown: `computeMatchBreakdown()` in `src/lib/job-analysis.js`
- Company stability: `businessResearchAgent`
- Apply routing: `classifyApplyRoute()` in job-analysis
- Email drafts: `emailApplyAgent`
- Interview prep: `learningPrepAgent`

---

## Releases

### v0.2 — Credibility and first 15 minutes

- Brand and marketing surface (headline, social proof, product media)
- First-run wizard (resume → demo → filters → optional LLM/portal)
- Match panel on job cards (skills, stability, apply route, score reasons)
- ToS modal before portal run + privacy diagram
- This document published and linked from docs hub

### v0.3 — Daily workflow stickiness

- Application tracker (`data/tracker.json`)
- Resume diff view (master vs tailored)
- Shortlist sort/filter/bulk export
- Portal selector health in `npm run doctor`
- Ollama preset + email-apply draft UI

### v0.4 — Trust, compare, and growth

- Run compare + dedupe/stale jobs
- Outcome loop + weekly ops summary
- Export/import data bundle
- Troubleshooting hub, architecture page, docs search
- CONTRIBUTING.md + release cadence

---

## Impact matrix

| Initiative | UX | Brand | Product | Trust | AI | Docs | OSS |
|------------|:--:|:-----:|:-------:|:-----:|:--:|:----:|:---:|
| Real screenshots + headline | — | +2 | +0.5 | +0.5 | — | +0.5 | +0.5 |
| First-run wizard + demo | +2.5 | +0.5 | +1 | +0.5 | — | +0.5 | — |
| Match panel + score reasons | +1 | — | +1.5 | +1.5 | +2 | — | — |
| ToS + privacy diagram | +0.5 | +0.5 | — | +2 | — | +1 | — |
| Application tracker | +2 | — | +2.5 | +1 | — | — | — |
| Resume diff | +1 | — | +2 | +2 | +1 | — | — |
| Shortlist sort/filter/bulk | +1.5 | — | +1.5 | — | — | — | — |
| Doctor portal checks | +1 | — | +0.5 | +2 | — | +1 | +0.5 |
| Email/cover letter UI | +1 | — | +1.5 | +1 | +1 | +0.5 | — |
| Run compare + dedupe | +1 | — | +1.5 | +0.5 | — | — | — |
| Outcome loop + weekly summary | +1.5 | — | +2 | +1 | +1 | — | — |
| Export/import bundle | +0.5 | — | +1 | +2 | — | +0.5 | +1 |
| npx/Docker + video + troubleshooting | +2 | +1 | — | +0.5 | — | +2 | +1 |
| Architecture + releases + issues | — | +0.5 | +0.5 | — | — | +1 | +2 |

**Projected scores after v0.4:**

| Dimension | Today | After v0.2 | After v0.4 |
|-----------|-------|------------|------------|
| UX / onboarding | 4–5 | 7 | 9–10 |
| Brand / marketing | 4 | 7 | 9 |
| Product depth | 7 | 8 | 10 |
| Trust / compliance | 5 | 7 | 9 |
| AI differentiation | 6 | 8 | 9–10 |
| Docs | 6 | 7 | 9 |
| OSS / momentum | 5 | 6 | 9 |
| Problem / ICP fit | 7.5 | 8 | 9 |

---

## KPIs

| Metric | v0.2 target | v0.4 target |
|--------|-------------|-------------|
| Time to demo shortlist | under 2 min | under 2 min |
| Time to first real run | under 15 min | under 10 min |
| Wizard completion rate | 60% | 80% |
| Return visits per active search week | — | 3+ |
| Jobs marked in tracker | — | 50%+ of shortlist |
| Doctor portal checks passing | — | 95% on release tag |

---

## Out of scope

- Gmail / inbox cleanup (removed)
- Full auto-apply at scale
- Hosted multi-tenant SaaS (separate from local OSS roadmap)
- Networking CRM / mobile app
- New portals beyond LinkedIn/Naukri until v0.4 adapter docs exist
