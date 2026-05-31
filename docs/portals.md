# Portals

Meridian uses local Playwright to search LinkedIn and Naukri.

## First login

1. Enable **Headed browser** in the run panel
2. Start a search run
3. Log in manually when the browser opens
4. Sessions are saved to `data/browser-state/`

## Enable/disable portals

In `src/config.json`:

```json
"portals": {
  "linkedin": { "enabled": true },
  "naukri": { "enabled": true }
}
```

## CLI

```bash
JOB_AGENT_PORTAL=linkedin npm run search
JOB_AGENT_HEADED=true npm run search
```

## Notes

- Portal UIs change frequently — selectors may need maintenance
- Use assisted apply mode for human-in-the-loop submissions
- Respect platform rate limits and terms of service
