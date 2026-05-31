const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config");
const { resolveLlmConfig } = require("./llm");

function getSetupStatus(rootDir) {
  const configPath = path.join(rootDir, "src", "config.json");
  const masterResumePath = path.join(rootDir, "resume", "master-resume.json");
  const autoResumePath = path.join(rootDir, "resume", "auto-master-resume.json");

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

  return {
    config: configOk,
    resume: resumeOk,
    llm: llmOk,
    filters: filtersOk,
    ready: configOk && resumeOk && filtersOk
  };
}

module.exports = { getSetupStatus };
