# Gmail cleanup

Optional feature to preview, trash, or delete promotional Gmail messages.

## Setup

1. Enable Gmail API in Google Cloud Console
2. Create OAuth **Desktop app** credentials
3. Save as `credentials.json` in project root
4. Set `gmail.enabled: true` in config

## Run

```bash
npm run gmail:preview
npm run gmail:trash
```

Or use the **Gmail Cleanup** dashboard in the UI.

Tokens are stored locally in `data/gmail/`.
