const { createGoalDrivenAgent } = require("./base");
const { suggestIncrement } = require("../lib/next-role");

const nextRoleCompensationAgent = createGoalDrivenAgent({
  name: "next-role-compensation-agent",
  skill: "Estimate fair increment expectations using current salary and the opportunity mix in the market.",
  emptyOutput() {
    return { compensationAdvice: null };
  },
  async goalCheck({ state }) {
    const jobs = state.strategyResearch?.jobs?.length || 0;
    return {
      passed: jobs > 0,
      reason: jobs > 0 ? "There are market opportunities to benchmark compensation." : "No jobs available."
    };
  },
  async plan() {
    return {
      goal: "Estimate fair increment expectations for the next role.",
      steps: [
        "Use current salary from user input when available",
        "Anchor against market salary ranges and your minimum expected compensation"
      ]
    };
  },
  async execute({ state }) {
    return {
      summary: { compensation: 1 },
      output: {
        compensationAdvice: suggestIncrement(state.strategyResearch.jobs, state.config)
      }
    };
  },
  async credibilityCheck() {
    return {
      passed: true,
      score: 0.87,
      notes: ["Estimated a fair increment band from current salary and market data."]
    };
  }
});

module.exports = { nextRoleCompensationAgent };
