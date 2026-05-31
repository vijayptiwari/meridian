const { createGoalDrivenAgent } = require("./base");
const { createLearningPlan } = require("../lib/learning-plan");

function selectPrepJobs(state) {
  const shortlisted = state.resumeModifier?.shortlistedWithResume || state.comparison?.shortlistedJobs || [];
  if (shortlisted.length) {
    return shortlisted;
  }

  const scoredJobs = state.comparison?.scoredJobs || [];
  return scoredJobs
    .filter((job) => job.eligibility?.eligible)
    .sort((a, b) => (b.overallBetScore || 0) - (a.overallBetScore || 0))
    .slice(0, 12);
}

const learningPrepAgent = createGoalDrivenAgent({
  name: "learning-prep-agent",
  skill: "Create a practical learning and interview-prep task list from the strongest available jobs so the user knows what to study next.",
  emptyOutput() {
    return { prepPlans: [], taskList: [] };
  },
  async goalCheck({ state }) {
    const prepJobs = selectPrepJobs(state);
    return {
      passed: prepJobs.length > 0,
      reason: prepJobs.length > 0 ? "There are strong jobs to prepare for." : "No suitable jobs available."
    };
  },
  async plan({ state }) {
    const jobs = selectPrepJobs(state);
    return {
      goal: "Create a learning and readiness task list for the strongest available roles.",
      steps: [
        `Analyze ${jobs.length} jobs`,
        "Infer what the user should learn or revise from the JD",
        "Return actionable tasks grouped by job opening"
      ]
    };
  },
  async execute({ state }) {
    const jobs = selectPrepJobs(state);
    const prepPlans = jobs.map((job) => createLearningPlan(job, state.config));
    const taskList = prepPlans.flatMap((plan) =>
      plan.tasks.map((task, index) => ({
        id: `${plan.jobId}-task-${index + 1}`,
        jobId: plan.jobId,
        portal: plan.portal,
        company: plan.company,
        title: plan.title,
        ...task
      }))
    );

    return {
      summary: {
        prepPlans: prepPlans.length,
        taskList: taskList.length,
        sourceJobs: jobs.length
      },
      output: {
        prepPlans,
        taskList
      }
    };
  },
  async credibilityCheck({ execution }) {
    const count = execution.output?.taskList?.length || 0;
    return {
      passed: count > 0,
      score: count > 0 ? 0.9 : 0.1,
      notes: count > 0 ? [`Prepared ${count} learning tasks from strong available jobs.`] : ["No learning tasks were generated."]
    };
  }
});

module.exports = { learningPrepAgent };
