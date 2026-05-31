function mergeStateFromReport(state, report) {
  if (!report.output) {
    return state;
  }

  switch (report.agent) {
    case "job-research-agent":
      return { ...state, research: report.output };
    case "business-research-agent":
      return { ...state, businessResearch: report.output };
    case "salary-upgrade-agent":
      return { ...state, salaryUpgrade: report.output };
    case "jd-comparison-agent": {
      const next = { ...state, comparison: report.output };
      if (state.mode === "next-role" || state.mode === "career-transition") {
        next.strategyResearch = {
          jobs: report.output.scoredJobs || [],
          shortlistedJobs: report.output.shortlistedJobs || []
        };
      }
      return next;
    }
    case "resume-modifier-agent":
      return { ...state, resumeModifier: report.output };
    case "learning-prep-agent":
      return { ...state, learningPrep: report.output };
    case "transition-mapping-agent":
      return {
        ...state,
        config: report.output.configOverride || state.config,
        transitionIntent: report.output.intent || null,
        transitionMapping: report.output
      };
    case "next-role-role-agent":
      return { ...state, nextRoleRoles: report.output };
    case "next-role-skill-gap-agent":
      return { ...state, nextRoleSkillGap: report.output };
    case "next-role-learning-agent":
      return { ...state, nextRoleLearning: report.output };
    case "next-role-opportunity-agent":
      return { ...state, nextRoleOpportunity: report.output };
    case "next-role-compensation-agent":
      return { ...state, nextRoleCompensation: report.output };
    case "transition-transferable-agent":
      return { ...state, transitionTransferable: report.output };
    case "transition-skill-gap-agent":
      return { ...state, transitionSkillGap: report.output };
    case "transition-learning-agent":
      return { ...state, transitionLearning: report.output };
    case "transition-opportunity-agent":
      return { ...state, transitionOpportunity: report.output };
    case "transition-compensation-agent":
      return { ...state, transitionCompensation: report.output };
    default:
      if (report.agent.includes("apply") || report.agent === "gmail-cleanup-agent") {
        const applyResults = [...(state.applyResults || []), { agent: report.agent, ...(report.output || {}) }];
        return { ...state, applyResults };
      }
      return state;
  }
}

async function runPipeline({ agents, state, services, log, parentLabel = "Parent agent" }) {
  let currentState = state;
  const reports = [];

  log.info(`${parentLabel} is building the execution plan.`);
  for (const agent of agents) {
    log.info(`${parentLabel} delegated work to ${agent.name}.`);
    const report = await agent.run({ state: currentState, services });
    reports.push(report);
    currentState = mergeStateFromReport(currentState, report);
  }

  return { state: currentState, reports };
}

module.exports = { mergeStateFromReport, runPipeline };
