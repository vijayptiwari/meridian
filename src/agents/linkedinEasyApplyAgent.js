const { createGoalDrivenAgent } = require("./base");
const { assistApplyLinkedIn } = require("../portals/linkedin");

const linkedinEasyApplyAgent = createGoalDrivenAgent({
  name: "linkedin-easy-apply-agent",
  skill: "Handle LinkedIn Easy Apply flows using tailored resumes and human review for final submission.",
  emptyOutput() {
    return { appliedJobs: [], targetedJobs: [] };
  },
  async goalCheck({ state }) {
    const targetedJobs = (state.resumeModifier?.shortlistedWithResume || []).filter(
      (job) => job.applyRoute === "linkedin_easy_apply"
    );
    return {
      passed: state.mode === "assist-apply" && targetedJobs.length > 0,
      reason:
        state.mode !== "assist-apply"
          ? "Apply mode is not enabled."
          : targetedJobs.length > 0
            ? "LinkedIn Easy Apply jobs are available."
            : "No LinkedIn Easy Apply jobs available."
    };
  },
  async plan({ state }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter(
      (job) => job.applyRoute === "linkedin_easy_apply"
    );
    return {
      goal: "Open LinkedIn Easy Apply flows and upload tailored resumes when possible.",
      steps: [`Process ${targetedJobs.length} LinkedIn Easy Apply jobs`, "Pause for human confirmation before final submission"]
    };
  },
  async execute({ state, services }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter(
      (job) => job.applyRoute === "linkedin_easy_apply"
    );

    await services.withBrowserSession({
      portal: "linkedin",
      task: async ({ page }) => assistApplyLinkedIn({ page, jobs: targetedJobs, log: services.log })
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
      notes: targeted > 0 ? [`Opened ${targeted} LinkedIn Easy Apply flows.`] : ["No LinkedIn Easy Apply work was performed."]
    };
  }
});

module.exports = { linkedinEasyApplyAgent };
