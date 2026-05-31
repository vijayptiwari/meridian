const { createGoalDrivenAgent } = require("./base");
const { researchSalary } = require("../lib/salary-research");

const salaryUpgradeAgent = createGoalDrivenAgent({
  name: "salary-upgrade-agent",
  skill: "Research salary from extracted job data, estimate market ranges when missing, and decide whether each role is a best-bet compensation target.",
  emptyOutput() {
    return { salaryInsights: [], bestBetJobs: [], jobs: [] };
  },
  async goalCheck({ state }) {
    const totalJobs = state.businessResearch?.jobs?.length || state.research?.jobs?.length || 0;
    return {
      passed: totalJobs > 0,
      reason: totalJobs > 0 ? "There are extracted jobs to analyze." : "No extracted jobs available."
    };
  },
  async plan({ state }) {
    const sourceJobs = state.businessResearch?.jobs || state.research.jobs;
    return {
      goal: "Research salary quality for extracted jobs before downstream decisions.",
      steps: [
        `Analyze ${sourceJobs.length} extracted jobs`,
        "Use salary listed in the JD when available",
        "Estimate market ranges when the JD omits pay",
        "Mark jobs that qualify as stronger bets based on compensation and seniority fit"
      ]
    };
  },
  async execute({ state }) {
    const sourceJobs = state.businessResearch?.jobs || state.research.jobs;
    const salaryInsights = sourceJobs.map((job) => ({
      jobId: job.id,
      ...researchSalary(job, state.config)
    }));
    const byJobId = new Map(salaryInsights.map((item) => [item.jobId, item]));
    const enrichedJobs = sourceJobs.map((job) => ({
      ...job,
      salaryInsight: byJobId.get(job.id) || null
    }));
    const bestBetJobs = enrichedJobs.filter((job) => job.salaryInsight?.qualifiesAsBestBet);

    return {
      summary: {
        salaryInsights: salaryInsights.length,
        bestBetJobs: bestBetJobs.length
      },
      output: {
        salaryInsights,
        jobs: enrichedJobs,
        bestBetJobs
      }
    };
  },
  async credibilityCheck({ execution }) {
    const count = execution.output?.salaryInsights?.length || 0;
    return {
      passed: count > 0,
      score: count > 0 ? 0.88 : 0.1,
      notes: count > 0 ? [`Produced salary research signals for ${count} jobs.`] : ["No salary insights created."]
    };
  }
});

module.exports = { salaryUpgradeAgent };
