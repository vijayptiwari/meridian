const { createGoalDrivenAgent } = require("./base");
const { recommendCompanies } = require("../lib/next-role");

const nextRoleOpportunityAgent = createGoalDrivenAgent({
  name: "next-role-opportunity-agent",
  skill: "Turn current market openings into target companies and opportunity themes.",
  emptyOutput() {
    return { targetCompanies: [], currentOpportunities: [] };
  },
  async goalCheck({ state }) {
    const jobs = state.strategyResearch?.jobs?.length || 0;
    return {
      passed: jobs > 0,
      reason: jobs > 0 ? "There are jobs to turn into opportunity targets." : "No jobs available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Identify current market opportunities and best target companies.",
      steps: [
        `Rank opportunities across ${state.strategyResearch.jobs.length} jobs`,
        "Prefer strong salary, fit, and business-stability signals"
      ]
    };
  },
  async execute({ state }) {
    const currentOpportunities = state.strategyResearch.jobs
      .sort((a, b) => (b.overallBetScore || 0) - (a.overallBetScore || 0))
      .slice(0, 8)
      .map((job) => ({
        company: job.company,
        role: job.title,
        salaryRange: job.salaryInsight?.displayRange || null,
        whyItMatters:
          job.businessInsight?.recommendation ||
          job.salaryInsight?.bestBetReason ||
          "Strong opportunity."
      }));
    const targetCompanies = recommendCompanies(state.strategyResearch.jobs);

    return {
      summary: {
        currentOpportunities: currentOpportunities.length,
        targetCompanies: targetCompanies.length
      },
      output: {
        currentOpportunities,
        targetCompanies
      }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.currentOpportunities?.length || 0) > 0,
      score: 0.9,
      notes: ["Generated current-opportunity and target-company suggestions."]
    };
  }
});

module.exports = { nextRoleOpportunityAgent };
