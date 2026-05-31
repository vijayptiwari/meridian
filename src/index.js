const path = require("path");
const { loadConfig } = require("./lib/config");
const { createLogger } = require("./lib/logger");
const { ensureDir, getPortalSelection } = require("./lib/runtime");
const { createServices } = require("./lib/services");

async function main() {
  const rootDir = process.cwd();
  const dataDir = path.join(rootDir, "data");
  const browserStateDir = path.join(dataDir, "browser-state");
  const outputDir = path.join(dataDir, "output");
  const log = createLogger();
  const config = loadConfig(path.join(rootDir, "src", "config.json"));
  const headed = process.env.JOB_AGENT_HEADED === "true";
  const mode = process.env.JOB_AGENT_MODE || "search";
  const selectedPortals =
    mode === "gmail-cleanup" || mode === "demo" ? [] : getPortalSelection(config);

  await ensureDir(browserStateDir);
  await ensureDir(outputDir);

  if (!["gmail-cleanup", "demo"].includes(mode) && selectedPortals.length === 0) {
    throw new Error("No portals enabled in config for the requested run.");
  }

  const services = createServices({ rootDir, config, log, browserStateDir, headed });

  const result =
    mode === "demo"
      ? await require("./agents/demoParent").runDemoParent({
          rootDir,
          config,
          log,
          outputDir
        })
      : mode === "gmail-cleanup"
        ? await require("./agents/gmailCleanupAgent").runGmailCleanupAgent({
            rootDir,
            config,
            log,
            outputDir
          })
        : mode === "next-role"
          ? await require("./agents/nextRoleParent").runNextRoleParent({
              rootDir,
              config,
              log,
              mode,
              headed,
              selectedPortals,
              browserStateDir,
              outputDir,
              services
            })
          : mode === "career-transition"
            ? await require("./agents/careerTransitionParent").runCareerTransitionParent({
                rootDir,
                config,
                log,
                mode,
                headed,
                selectedPortals,
                browserStateDir,
                outputDir,
                services
              })
            : await require("./agents/parent").runParentAgent({
                rootDir,
                config,
                log,
                mode,
                headed,
                selectedPortals,
                browserStateDir,
                outputDir,
                services
              });

  if (mode === "next-role") {
    log.info(`Saved next-role strategy to ${result.strategyPath}`);
    return;
  }

  if (mode === "gmail-cleanup") {
    log.info(`Saved Gmail cleanup report to ${result.reportPath}`);
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
}

main().catch((error) => {
  console.error("[meridian] Fatal error:", error.message);
  process.exitCode = 1;
});
