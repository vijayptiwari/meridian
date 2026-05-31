# Contributing to Meridian

Thank you for helping improve Meridian.

## Development setup

```bash
git clone <your-fork>
cd meridian
cp src/config.example.json src/config.json
cp .env.example .env
npm install
npx playwright install chromium
npm run doctor
npm run ui
```

## Pull requests

1. Keep changes focused and small.
2. Match existing CommonJS style in `src/`.
3. Run `npm run doctor` before opening a PR.
4. Describe portal selector changes with screenshots when UI scraping is affected.

## Reporting issues

Include OS, Node version, mode (`search`, `demo`, etc.), and relevant log excerpts from `data/ui/run-logs/`.

## Code of conduct

Be respectful and constructive. Meridian is a community tool — no harassment or spam.
