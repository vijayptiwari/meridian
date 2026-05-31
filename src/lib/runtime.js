const fs = require("fs");
const path = require("path");

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

function timestamp() {
  return process.env.JOB_AGENT_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
}

async function saveJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getPortalSelection(config) {
  const requested = process.env.JOB_AGENT_PORTAL || "both";
  const selected = [];

  if ((requested === "linkedin" || requested === "both") && config.portals.linkedin?.enabled) {
    selected.push("linkedin");
  }

  if ((requested === "naukri" || requested === "both") && config.portals.naukri?.enabled) {
    selected.push("naukri");
  }

  return selected;
}

async function withBrowserSession({ browserStateDir, headed, portal, task }) {
  const { chromium } = require("playwright");
  const statePath = path.join(browserStateDir, `${portal}.json`);
  const browser = await chromium.launch({
    headless: !headed,
    slowMo: headed ? 150 : 0
  });

  try {
    const context = await browser.newContext({
      storageState: fs.existsSync(statePath) ? statePath : undefined,
      viewport: { width: 1440, height: 960 }
    });

    try {
      const page = await context.newPage();
      const result = await task({ page, context, statePath });
      await context.storageState({ path: statePath });
      return result;
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = { ensureDir, timestamp, saveJson, getPortalSelection, withBrowserSession };
