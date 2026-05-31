const { createGoalDrivenAgent } = require("./base");
const { selectTransitionOpportunities, recommendTransitionCompanies } = require("../lib/career-transition");

const transitionOpportunityAgent = createGoalDrivenAgent({
  name: "transition-opportunity-agent",
  skill: "Surface the best bridge openings and target companies for a career transition.",
  emptyOutput() {
    return { currentOpportunities: [], targetCompanies: [] };
  },
  async goalCheck({ state }) {
    const jobs = state.strategyResearch?.jobs?.length || 0;
    return {
      passed: jobs > 0 && Boolean(state.transitionIntent),
      reason: jobs > 0 ? "There are jobs available for transition opportunity analysis." : "No jobs available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Convert the market scan into realistic transition opportunities.",
      steps: [
        `Score ${state.strategyResearch.jobs.length} jobs for bridge-role potential`,
        "Prefer roles that align with the transition path and stable companies"
      ]
    };
  },
  async execute({ state }) {
    const currentOpportunities = selectTransitionOpportunities(state.strategyResearch.jobs, state.transitionIntent);
    const targetCompanies = recommendTransitionCompanies(state.strategyResearch.jobs, state.transitionIntent);

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
      notes: ["Generated bridge-role opportunities and transition-safe target companies."]
    };
  }
});

module.exports = { transitionOpportunityAgent };
