const path = require("path");
const { saveJson, timestamp } = require("../lib/runtime");
const { runPipeline } = require("../lib/pipeline-orchestrator");
const { getPipelineAgents } = require("../lib/pipelines");
const { createCheckpointPayload, hydrateStateFromCheckpoint, saveCheckpoint } = require("../lib/run-checkpoint");

function deriveParentSummary(state, reports) {
  return {
    jobsFound: state.research?.jobs?.length || 0,
    shortlisted: state.comparison?.shortlistedJobs?.length || 0,
    tailoredResumes: state.resumeModifier?.tailoredResumes?.length || 0,
    prepTasks: state.learningPrep?.taskList?.length || 0,
    stableCompanies: state.businessResearch?.stableCompanies?.length || 0,
    salaryBestBets: state.salaryUpgrade?.bestBetJobs?.length || 0,
    applyReports: reports
      .filter((report) => report.agent.includes("apply"))
      .map((report) => ({
        agent: report.agent,
        status: report.status,
        credibility: report.credibility
      }))
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

async function runParentAgent({
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
  let state = {
    ...runtime,
    applyResults: []
  };
  let startIndex = 0;

  if (resumeFromCheckpoint) {
    state = hydrateStateFromCheckpoint(resumeFromCheckpoint, runtime);
    startIndex = resumeFromCheckpoint.completedAgentCount || 0;
    log.info(`Resuming parent agent from checkpoint after ${startIndex} completed agents.`);
  }

  const agents = getPipelineAgents(mode === "assist-apply" ? "assist-apply" : "search");
  const { state: currentState, reports } = await runPipeline({
    agents,
    state,
    services,
    log,
    parentLabel: "Parent agent",
    startIndex,
    onAgentComplete: buildCheckpointSaver({ rootDir, runId, mode, portal, headed })
  });

  const stamp = timestamp();
  const allJobsPath = path.join(outputDir, `jobs-${stamp}.json`);
  const shortlistPath = path.join(outputDir, `shortlist-${stamp}.json`);
  const tailoredPath = path.join(outputDir, `tailored-resumes-${stamp}.json`);
  const prepPath = path.join(outputDir, `prep-tasks-${stamp}.json`);
  const reportPath = path.join(outputDir, `agent-report-${stamp}.json`);

  await saveJson(allJobsPath, currentState.comparison?.scoredJobs || currentState.research?.jobs || []);
  await saveJson(shortlistPath, currentState.resumeModifier?.shortlistedWithResume || currentState.comparison?.shortlistedJobs || []);
  await saveJson(tailoredPath, currentState.resumeModifier?.tailoredResumes || []);
  await saveJson(prepPath, currentState.learningPrep?.prepPlans || []);
  await saveJson(reportPath, {
    parent: {
      goal: "Find, compare, tailor, and assist with job applications using specialized mini-agents.",
      summary: deriveParentSummary(currentState, reports)
    },
    agents: reports
  });

  return {
    allJobsPath,
    shortlistPath,
    tailoredPath,
    prepPath,
    reportPath,
    summary: deriveParentSummary(currentState, reports),
    reports
  };
}

module.exports = { runParentAgent };
