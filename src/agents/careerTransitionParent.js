const path = require("path");
const { saveJson, timestamp } = require("../lib/runtime");
const { runPipeline } = require("../lib/pipeline-orchestrator");
const { getPipelineAgents } = require("../lib/pipelines");
const { createCheckpointPayload, hydrateStateFromCheckpoint, saveCheckpoint } = require("../lib/run-checkpoint");

function summarize(state) {
  return {
    transitionRoles: state.transitionMapping?.rolePaths?.length || 0,
    jobsAnalyzed: state.strategyResearch?.jobs?.length || 0,
    bridgeOpportunities: state.transitionOpportunity?.currentOpportunities?.length || 0,
    missingSkills: state.transitionSkillGap?.missingSkills?.length || 0,
    learningItems: state.transitionLearning?.learningPlan?.length || 0
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

async function runCareerTransitionParent({
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
    log.info(`Resuming career-transition parent from checkpoint after ${startIndex} completed agents.`);
  }

  const { state: currentState, reports } = await runPipeline({
    agents: getPipelineAgents("career-transition"),
    state,
    services,
    log,
    parentLabel: "Career-transition parent agent",
    startIndex,
    onAgentComplete: buildCheckpointSaver({ rootDir, runId, mode, portal, headed })
  });

  const stamp = timestamp();
  const strategyPath = path.join(outputDir, `career-transition-strategy-${stamp}.json`);
  await saveJson(strategyPath, {
    summary: summarize(currentState),
    transitionIntent: currentState.transitionIntent || null,
    rolePaths: currentState.transitionMapping?.rolePaths || [],
    transferableStrengths: currentState.transitionTransferable?.transferableStrengths || [],
    demandSkills: currentState.transitionSkillGap?.demandSkills || [],
    missingSkills: currentState.transitionSkillGap?.missingSkills || [],
    learningPlan: currentState.transitionLearning?.learningPlan || [],
    tasks: currentState.transitionLearning?.tasks || [],
    currentOpportunities: currentState.transitionOpportunity?.currentOpportunities || [],
    targetCompanies: currentState.transitionOpportunity?.targetCompanies || [],
    compensationAdvice: currentState.transitionCompensation?.compensationAdvice || null,
    readiness: currentState.transitionCompensation?.readiness || null,
    reports
  });

  return {
    strategyPath,
    summary: summarize(currentState)
  };
}

module.exports = { runCareerTransitionParent };
