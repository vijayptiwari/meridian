const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/lib/config");
const { resolveLlmConfig } = require("../src/lib/llm");
const { checkPortalHealth } = require("../src/lib/portal-health");

function checkNodeVersion() {
  const major = Number(process.version.slice(1).split(".")[0]);
  return {
    ok: major >= 20,
    detail: process.version
  };
}

function checkPlaywright() {
  try {
    require.resolve("playwright");
    return { ok: true, detail: "playwright package installed" };
  } catch {
    return { ok: false, detail: "Run npm install && npx playwright install chromium" };
  }
}

function checkConfig(rootDir) {
  const configPath = path.join(rootDir, "src", "config.json");
  if (!fs.existsSync(configPath)) {
    return { ok: false, detail: "Missing src/config.json — copy from src/config.example.json" };
  }

  try {
    loadConfig(configPath);
    return { ok: true, detail: configPath };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

function checkWritableData(rootDir) {
  const dataDir = path.join(rootDir, "data");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const probe = path.join(dataDir, ".write-test");
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return { ok: true, detail: dataDir };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

function checkLlm(rootDir) {
  try {
    const config = loadConfig(path.join(rootDir, "src", "config.json"));
    const llm = resolveLlmConfig(config);
    if (llm.provider === "keyword-only") {
      return { ok: true, detail: "Keyword-only mode (no LLM key required)" };
    }
    if (llm.provider === "webhook") {
      return {
        ok: Boolean(llm.webhookUrl),
        detail: llm.webhookUrl ? "Webhook URL configured" : "Missing webhook URL"
      };
    }
    return {
      ok: Boolean(llm.apiKey || process.env.OPENAI_API_KEY),
      detail: llm.apiKey || process.env.OPENAI_API_KEY ? "API key present" : "No API key — keyword fallback only"
    };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

async function checkPortals(rootDir, options) {
  const result = await checkPortalHealth({
    skipNetwork: !options.probePortals
  });

  const payload = {
    linkedin: result.linkedin,
    naukri: result.naukri,
    checkedAt: new Date().toISOString(),
    probed: Boolean(options.probePortals && !result.skipped)
  };

  const healthPath = path.join(rootDir, "data", "ui", "portal-health.json");
  fs.mkdirSync(path.dirname(healthPath), { recursive: true });
  fs.writeFileSync(healthPath, JSON.stringify(payload, null, 2), "utf8");

  return {
    linkedin: result.linkedin,
    naukri: result.naukri,
    ok: result.linkedin?.ok && result.naukri?.ok
  };
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const probePortals = process.argv.includes("--portals");
  const checks = {
    node: checkNodeVersion(),
    playwright: checkPlaywright(),
    config: checkConfig(rootDir),
    dataDir: checkWritableData(rootDir),
    llm: checkLlm(rootDir)
  };

  if (checks.playwright.ok) {
    const portals = await checkPortals(rootDir, { probePortals });
    checks.linkedin = portals.linkedin;
    checks.naukri = portals.naukri;
  } else {
    checks.linkedin = { ok: false, detail: "Install Playwright before portal checks" };
    checks.naukri = { ok: false, detail: "Install Playwright before portal checks" };
  }

  let exitCode = 0;
  console.log("Meridian doctor\n");
  if (!probePortals) {
    console.log("Tip: run `npm run doctor -- --portals` to probe LinkedIn/Naukri selectors over the network.\n");
  }

  for (const [name, result] of Object.entries(checks)) {
    const label = result.ok ? "OK" : "WARN";
    if (!result.ok && !["llm", "linkedin", "naukri"].includes(name)) {
      exitCode = 1;
    }
    console.log(`[${label}] ${name}: ${result.detail}`);
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
