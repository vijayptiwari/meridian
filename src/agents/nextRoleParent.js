const path = require("path");
const { saveJson, timestamp } = require("../lib/runtime");
const { runPipeline } = require("../lib/pipeline-orchestrator");
const { getPipelineAgents } = require("../lib/pipelines");
const { createCheckpointPayload, hydrateStateFromCheckpoint, saveCheckpoint } = require("../lib/run-checkpoint");

function summarize(state) {
  return {
    jobsAnalyzed: state.strategyResearch?.jobs?.length || 0,
    projectedRoles: state.nextRoleRoles?.roleOptions?.length || 0,
    missingSkills: state.nextRoleSkillGap?.missingSkills?.length || 0,
    learningItems: state.nextRoleLearning?.learningPlan?.length || 0,
    targetCompanies: state.nextRoleOpportunity?.targetCompanies?.length || 0
  };
}

function buildCheckpointSaver({ rootDir, runId, mode, portal, headed }) {
  const completedAgents = [];

  return async ({ agent, state, reports }) => {
    completedAgents.push(agent.name);
    saveCheckpoint(
      rootDir,
      createCheckpointPayload({
        runId,
        mode,
        portal,
        headed,
        completedAgents: [...completedAgents],
        state,
        reports
      })
    );
  };
}

async function runNextRoleParent({
  rootDir,
  config,
  log,
  mode,
  headed,
  selectedPortals,
  browserStateDir,
  outputDir,
  services,
  resumeFromCheckpoint = null,
  portal = "both"
}) {
  const runtime = { rootDir, config, mode, headed, selectedPortals, browserStateDir, outputDir };
  const runId = process.env.JOB_AGENT_RUN_ID || timestamp();
  let state = { ...runtime };
  let startIndex = 0;

  if (resumeFromCheckpoint) {
    state = hydrateStateFromCheckpoint(resumeFromCheckpoint, runtime);
    startIndex = resumeFromCheckpoint.completedAgentCount || 0;
    log.info(`Resuming next-role parent from checkpoint after ${startIndex} completed agents.`);
  }

  const { state: currentState, reports } = await runPipeline({
    agents: getPipelineAgents("next-role"),
    state,
    services,
    log,
    parentLabel: "Next-role parent agent",
    startIndex,
    onAgentComplete: buildCheckpointSaver({ rootDir, runId, mode, portal, headed })
  });

  const stamp = timestamp();
  const strategyPath = path.join(outputDir, `next-role-strategy-${stamp}.json`);
  await saveJson(strategyPath, {
    summary: summarize(currentState),
    roleOptions: currentState.nextRoleRoles?.roleOptions || [],
    demandSkills: currentState.nextRoleSkillGap?.demandSkills || [],
    missingSkills: currentState.nextRoleSkillGap?.missingSkills || [],
    learningPlan: currentState.nextRoleLearning?.learningPlan || [],
    currentOpportunities: currentState.nextRoleOpportunity?.currentOpportunities || [],
    targetCompanies: currentState.nextRoleOpportunity?.targetCompanies || [],
    compensationAdvice: currentState.nextRoleCompensation?.compensationAdvice || null,
    reports
  });

  return {
    strategyPath,
    summary: summarize(currentState)
  };
}

module.exports = { runNextRoleParent };
