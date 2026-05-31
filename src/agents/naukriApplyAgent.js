const { createGoalDrivenAgent } = require("./base");
const { assistApplyNaukri } = require("../portals/naukri");

const naukriApplyAgent = createGoalDrivenAgent({
  name: "naukri-apply-agent",
  skill: "Handle Naukri native apply flows using tailored resumes and human review.",
  emptyOutput() {
    return { appliedJobs: [], targetedJobs: [] };
  },
  async goalCheck({ state }) {
    const targetedJobs = (state.resumeModifier?.shortlistedWithResume || []).filter(
      (job) => job.applyRoute === "naukri_native_apply"
    );
    return {
      passed: state.mode === "assist-apply" && targetedJobs.length > 0,
      reason:
        state.mode !== "assist-apply"
          ? "Apply mode is not enabled."
          : targetedJobs.length > 0
            ? "Naukri native apply jobs are available."
            : "No Naukri native-apply jobs available."
    };
  },
  async plan({ state }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter(
      (job) => job.applyRoute === "naukri_native_apply"
    );
    return {
      goal: "Open Naukri apply flows and upload tailored resumes when possible.",
      steps: [`Process ${targetedJobs.length} Naukri jobs`, "Pause for human confirmation before final submission"]
    };
  },
  async execute({ state, services }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter(
      (job) => job.applyRoute === "naukri_native_apply"
    );

    await services.withBrowserSession({
      portal: "naukri",
      task: async ({ page }) => assistApplyNaukri({ page, jobs: targetedJobs, log: services.log })
    });

    return {
      summary: {
        targetedJobs: targetedJobs.length
      },
      output: {
        targetedJobs,
        appliedJobs: targetedJobs.map((job) => ({
          jobId: job.id,
          route: job.applyRoute,
          status: "opened-for-review"
        }))
      }
    };
  },
  async credibilityCheck({ execution }) {
    const targeted = execution.output?.targetedJobs?.length || 0;
    return {
      passed: targeted > 0,
      score: targeted > 0 ? 0.9 : 0.1,
      notes: targeted > 0 ? [`Opened ${targeted} Naukri apply flows.`] : ["No Naukri apply work was performed."]
    };
  }
});

module.exports = { naukriApplyAgent };
