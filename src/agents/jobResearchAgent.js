const { createGoalDrivenAgent } = require("./base");
const { searchLinkedInJobs } = require("../portals/linkedin");
const { searchNaukriJobs } = require("../portals/naukri");

const jobResearchAgent = createGoalDrivenAgent({
  name: "job-research-agent",
  skill: "Search LinkedIn and Naukri, gather JDs, and replan if search filters are too narrow.",
  emptyOutput() {
    return { jobs: [], portalBreakdown: {} };
  },
  async goalCheck({ state }) {
    return {
      passed: state.selectedPortals.length > 0,
      reason: state.selectedPortals.length > 0 ? "At least one portal is enabled." : "No portals selected."
    };
  },
  async plan({ state, workingMemory, attempt }) {
    const easyApplyOnly =
      workingMemory.easyApplyOnlyOverride ?? state.config.preferences.easyApplyOnly ?? false;
    return {
      attempt,
      goal: "Find relevant jobs across enabled portals.",
      steps: [
        `Search portals: ${state.selectedPortals.join(", ")}`,
        `Use queries: ${(state.config.preferences.searchQueries || []).join(", ")}`,
        `LinkedIn Easy Apply filter: ${easyApplyOnly}`
      ]
    };
  },
  async execute({ state, services, workingMemory, attempt }) {
    const jobs = [];
    const portalBreakdown = {};
    const runConfig = JSON.parse(JSON.stringify(state.config));

    if (typeof workingMemory.easyApplyOnlyOverride === "boolean") {
      runConfig.preferences.easyApplyOnly = workingMemory.easyApplyOnlyOverride;
    }

    for (const portal of state.selectedPortals) {
      const portalJobs = await services.withBrowserSession({
        portal,
        task: async ({ page }) => {
          if (portal === "linkedin") {
            return searchLinkedInJobs({ page, config: runConfig, log: services.log });
          }

          if (portal === "naukri") {
            return searchNaukriJobs({ page, config: runConfig, log: services.log });
          }

          return [];
        }
      });

      portalBreakdown[portal] = portalJobs.length;
      jobs.push(...portalJobs);
    }

    const replanRequired =
      attempt === 1 &&
      jobs.length === 0 &&
      runConfig.preferences.easyApplyOnly === true &&
      state.selectedPortals.includes("linkedin");

    return {
      summary: {
        jobsFound: jobs.length,
        portalBreakdown
      },
      replanRequired,
      output: {
        jobs,
        portalBreakdown,
        searchConfigUsed: {
          easyApplyOnly: runConfig.preferences.easyApplyOnly
        }
      },
      notes: replanRequired ? ["No jobs found. Retrying once without LinkedIn Easy Apply filter."] : []
    };
  },
  async replan() {
    return {
      reason: "Relax Easy Apply-only filter for discovery retry.",
      workingMemoryPatch: {
        easyApplyOnlyOverride: false
      }
    };
  },
  async credibilityCheck({ execution }) {
    const totalJobs = execution.output?.jobs?.length || 0;
    return {
      passed: totalJobs > 0,
      score: totalJobs > 0 ? Math.min(1, 0.5 + totalJobs / 50) : 0.2,
      notes:
        totalJobs > 0
          ? [`Collected ${totalJobs} jobs across the enabled portals.`]
          : ["No jobs collected. Search conditions or portal selectors may need review."]
    };
  }
});

module.exports = { jobResearchAgent };
