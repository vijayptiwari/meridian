const fs = require("fs");

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing config file at ${configPath}. Copy src/config.example.json to src/config.json and update it.`
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  config.resume = {
    masterResumePath: "resume/master-resume.json",
    maxTailoredResumesPerRun: 10,
    ...(config.resume || {})
  };
  config.agentSystem = {
    maxCyclesPerAgent: 2,
    ...(config.agentSystem || {})
  };
  config.locationPolicy = {
    expectedPhysicalLocation: "",
    ...(config.locationPolicy || {})
  };
  config.salary = {
    currency: "INR",
    currentAnnualCompensation: null,
    minimumAnnualCompensation: null,
    targetAnnualCompensation: null,
    ...(config.salary || {})
  };
  config.transition = {
    currentDomain: "",
    targetDomain: "",
    targetRoles: [],
    transitionLevel: "bridge",
    notes: "",
    ...(config.transition || {})
  };

  if (!Array.isArray(config.transition.targetRoles)) {
    config.transition.targetRoles = [];
  }

  if (!config.profile || !config.preferences || !config.portals) {
    throw new Error("Config must include profile, preferences, and portals sections.");
  }

  config.profile.upskilledCategories = Array.isArray(config.profile.upskilledCategories)
    ? config.profile.upskilledCategories
    : [];

  config.llm = {
    provider: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    apiKey: null,
    webhookUrl: null,
    timeoutMs: 60000,
    headers: {},
    ...(config.llm || {})
  };

  if (process.env.OPENAI_API_KEY && !config.llm.apiKey) {
    config.llm.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.OPENAI_BASE_URL) {
    config.llm.baseUrl = process.env.OPENAI_BASE_URL;
  }
  if (process.env.OPENAI_MODEL) {
    config.llm.model = process.env.OPENAI_MODEL;
  }
  if (process.env.MERIDIAN_LLM_PROVIDER) {
    config.llm.provider = process.env.MERIDIAN_LLM_PROVIDER;
  }
  if (process.env.MERIDIAN_LLM_WEBHOOK_URL) {
    config.llm.webhookUrl = process.env.MERIDIAN_LLM_WEBHOOK_URL;
  }

  return config;
}

module.exports = { loadConfig };
