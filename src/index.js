const path = require("path");
const { loadConfig } = require("./lib/config");
const { createLogger } = require("./lib/logger");
const { ensureDir, getPortalSelection } = require("./lib/runtime");
const { createServices } = require("./lib/services");
const { loadCheckpoint } = require("./lib/run-checkpoint");

async function main() {
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  const browserStateDir = path.join(dataDir, "browser-state");
  const outputDir = path.join(dataDir, "output");
  const log = createLogger();
  const config = loadConfig(path.join(rootDir, "src", "config.json"));
  const headed = process.env.JOB_AGENT_HEADED === "true";
  const mode = process.env.JOB_AGENT_MODE || "search";
  const portal = process.env.JOB_AGENT_PORTAL || "both";
  const runId = process.env.JOB_AGENT_RUN_ID || null;
  const resumeRunId = process.env.JOB_AGENT_RESUME_RUN_ID || "";
  const resumeFromCheckpoint = resumeRunId ? loadCheckpoint(rootDir, resumeRunId) : null;
  const selectedPortals = mode === "demo" ? [] : getPortalSelection(config);

  await ensureDir(browserStateDir);
  await ensureDir(outputDir);

  if (resumeRunId && !resumeFromCheckpoint) {
    throw new Error(`No checkpoint found for run ${resumeRunId}.`);
  }

  if (mode !== "demo" && selectedPortals.length === 0) {
    throw new Error("No portals enabled in config for the requested run.");
  }

  const services = createServices({ rootDir, config, log, browserStateDir, headed });
  const parentArgs = {
    rootDir,
    config,
    log,
    mode,
    headed,
    selectedPortals,
    browserStateDir,
    outputDir,
    services,
    portal,
    resumeFromCheckpoint
  };

  const result =
    mode === "demo"
      ? await require("./agents/demoParent").runDemoParent({
          rootDir,
          config,
          log,
          outputDir
        })
      : mode === "next-role"
        ? await require("./agents/nextRoleParent").runNextRoleParent(parentArgs)
        : mode === "career-transition"
          ? await require("./agents/careerTransitionParent").runCareerTransitionParent(parentArgs)
          : await require("./agents/parent").runParentAgent(parentArgs);

  if (mode === "next-role") {
    log.info(`Saved next-role strategy to ${result.strategyPath}`);
    return;
  }

  if (mode === "career-transition") {
    log.info(`Saved career-transition strategy to ${result.strategyPath}`);
    return;
  }

  log.info(`Saved jobs to ${result.allJobsPath}`);
  log.info(`Saved shortlist to ${result.shortlistPath}`);
  log.info(`Saved tailored resumes to ${result.tailoredPath}`);
  log.info(`Saved agent report to ${result.reportPath}`);

  if (runId) {
    log.info(`Run ${runId} completed successfully.`);
  }
}

main().catch((error) => {
  console.error("[meridian] Fatal error:", error.message);
  process.exitCode = 1;
});
