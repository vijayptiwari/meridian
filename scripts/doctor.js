const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../src/lib/config");
const { resolveLlmConfig } = require("../src/lib/llm");

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

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const checks = {
    node: checkNodeVersion(),
    playwright: checkPlaywright(),
    config: checkConfig(rootDir),
    dataDir: checkWritableData(rootDir),
    llm: checkLlm(rootDir)
  };

  let exitCode = 0;
  console.log("Meridian doctor\n");

  for (const [name, result] of Object.entries(checks)) {
    const label = result.ok ? "OK" : "FAIL";
    if (!result.ok && name !== "llm") {
      exitCode = 1;
    }
    console.log(`[${label}] ${name}: ${result.detail}`);
  }

  process.exit(exitCode);
}

main();
