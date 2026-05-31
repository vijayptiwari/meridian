const fs = require("fs");
const path = require("path");

const SERIALIZABLE_STATE_KEYS = [
  "research",
  "businessResearch",
  "salaryUpgrade",
  "comparison",
  "resumeModifier",
  "learningPrep",
  "applyResults",
  "strategyResearch",
  "transitionIntent",
  "transitionMapping",
  "transitionTransferable",
  "transitionSkillGap",
  "transitionLearning",
  "transitionOpportunity",
  "transitionCompensation",
  "nextRoleRoles",
  "nextRoleSkillGap",
  "nextRoleLearning",
  "nextRoleOpportunity",
  "nextRoleCompensation",
  "config"
];

function getCheckpointsDir(rootDir) {
  return path.join(rootDir, "data", "ui", "checkpoints");
}

function checkpointPathForRun(rootDir, runId) {
  return path.join(getCheckpointsDir(rootDir), `${runId}.json`);
}

function pickSerializableState(state) {
  const next = {};
  for (const key of SERIALIZABLE_STATE_KEYS) {
    if (state[key] !== undefined) {
      next[key] = state[key];
    }
  }
  return next;
}

function saveCheckpoint(rootDir, payload) {
  const filePath = checkpointPathForRun(rootDir, payload.runId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

function loadCheckpoint(rootDir, runId) {
  const filePath = checkpointPathForRun(rootDir, runId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function deleteCheckpoint(rootDir, runId) {
  const filePath = checkpointPathForRun(rootDir, runId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function hydrateStateFromCheckpoint(checkpoint, runtime) {
  const saved = checkpoint?.state || {};
  return {
    rootDir: runtime.rootDir,
    config: saved.config || runtime.config,
    mode: runtime.mode,
    headed: runtime.headed,
    selectedPortals: runtime.selectedPortals,
    browserStateDir: runtime.browserStateDir,
    outputDir: runtime.outputDir,
    applyResults: saved.applyResults || [],
    ...pickSerializableState(saved)
  };
}

function createCheckpointPayload({ runId, mode, portal, headed, completedAgents, state, reports }) {
  return {
    runId,
    mode,
    portal,
    headed,
    completedAgentCount: completedAgents.length,
    completedAgents,
    state: pickSerializableState(state),
    reports: (reports || []).map((report) => ({
      agent: report.agent,
      status: report.status,
      credibility: report.credibility || null,
      output: report.output || null
    })),
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  SERIALIZABLE_STATE_KEYS,
  checkpointPathForRun,
  createCheckpointPayload,
  deleteCheckpoint,
  hydrateStateFromCheckpoint,
  loadCheckpoint,
  pickSerializableState,
  saveCheckpoint
};
