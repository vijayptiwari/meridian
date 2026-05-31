const path = require("path");
const { saveJson, timestamp } = require("../lib/runtime");
const { runPipeline } = require("../lib/pipeline-orchestrator");
const { getPipelineAgents } = require("../lib/pipelines");

function summarize(state) {
  return {
    transitionRoles: state.transitionMapping?.rolePaths?.length || 0,
    jobsAnalyzed: state.strategyResearch?.jobs?.length || 0,
    bridgeOpportunities: state.transitionOpportunity?.currentOpportunities?.length || 0,
    missingSkills: state.transitionSkillGap?.missingSkills?.length || 0,
    learningItems: state.transitionLearning?.learningPlan?.length || 0
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
  services
}) {
  const state = {
    rootDir,
    config,
    mode,
    headed,
    selectedPortals,
    browserStateDir,
    outputDir
  };

  const { state: currentState, reports } = await runPipeline({
    agents: getPipelineAgents("career-transition"),
    state,
    services,
    log,
    parentLabel: "Career-transition parent agent"
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
