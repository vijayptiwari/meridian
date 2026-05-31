const fs = require("fs");
const path = require("path");
const { readTracker } = require("./tracker");
const { readWizardState } = require("./wizard-state");

function redactConfig(config) {
  if (!config) {
    return null;
  }

  const clone = structuredClone(config);
  if (clone.llm?.apiKey) {
    clone.llm.apiKey = "[redacted]";
  }
  return clone;
}

function buildExportBundle(rootDir, history) {
  const configPath = path.join(rootDir, "src", "config.json");
  let config = null;

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      config = null;
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    product: "Meridian",
    config: redactConfig(config),
    tracker: readTracker(rootDir),
    wizard: readWizardState(rootDir),
    runHistory: (history || []).map((entry) => ({
      runId: entry.runId,
      mode: entry.mode,
      portal: entry.portal,
      status: entry.status,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      summary: entry.summary
    }))
  };
}

function importExportBundle(rootDir, bundle, writers) {
  if (!bundle || bundle.version !== 1) {
    throw new Error("Unsupported export bundle version.");
  }

  if (bundle.tracker) {
    writers.writeTracker(rootDir, bundle.tracker);
  }

  if (bundle.wizard) {
    writers.writeWizardState(rootDir, bundle.wizard);
  }

  return {
    ok: true,
    imported: {
      tracker: Boolean(bundle.tracker),
      wizard: Boolean(bundle.wizard)
    }
  };
}

module.exports = { buildExportBundle, importExportBundle, redactConfig };
