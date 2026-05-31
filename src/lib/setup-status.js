const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config");
const { resolveLlmConfig } = require("./llm");
const { readWizardState, buildWizardStatus } = require("./wizard-state");
const { getTrackerSummary } = require("./tracker");

function getSetupStatus(rootDir) {
  const configPath = path.join(rootDir, "src", "config.json");
  const masterResumePath = path.join(rootDir, "resume", "master-resume.json");
  const autoResumePath = path.join(rootDir, "resume", "auto-master-resume.json");
  const portalHealthPath = path.join(rootDir, "data", "ui", "portal-health.json");

  let config = null;
  let configOk = false;
  try {
    if (fs.existsSync(configPath)) {
      config = loadConfig(configPath);
      configOk = Boolean(config.profile?.name && config.profile?.name !== "Your Name");
    }
  } catch {
    configOk = false;
  }

  const resumeOk = fs.existsSync(masterResumePath) || fs.existsSync(autoResumePath);
  const llm = config ? resolveLlmConfig(config) : null;
  const llmOk =
    llm?.provider === "keyword-only" ||
    (llm?.provider === "webhook" && Boolean(llm.webhookUrl)) ||
    (llm?.provider === "openai-compatible" && Boolean(llm.apiKey || process.env.OPENAI_API_KEY));

  const filtersOk = Boolean((config?.preferences?.searchQueries || []).length);
  const wizardState = readWizardState(rootDir);
  const wizard = buildWizardStatus(
    { config: configOk, resume: resumeOk, llm: llmOk, filters: filtersOk },
    wizardState
  );

  let portals = { linkedin: null, naukri: null, checkedAt: null };
  if (fs.existsSync(portalHealthPath)) {
    try {
      portals = JSON.parse(fs.readFileSync(portalHealthPath, "utf8"));
    } catch {
      portals = { linkedin: null, naukri: null, checkedAt: null };
    }
  }

  return {
    config: configOk,
    resume: resumeOk,
    llm: llmOk,
    filters: filtersOk,
    ready: configOk && resumeOk && filtersOk,
    wizard,
    tracker: getTrackerSummary(rootDir),
    portals
  };
}

module.exports = { getSetupStatus };
