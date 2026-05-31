const { createGoalDrivenAgent } = require("./base");
const { inferRoleTracks } = require("../lib/next-role");

const nextRoleRoleAgent = createGoalDrivenAgent({
  name: "next-role-role-agent",
  skill: "Project the best upgraded roles to pursue based on current profile and current market opportunities.",
  emptyOutput() {
    return { roleOptions: [] };
  },
  async goalCheck({ state }) {
    const jobs = state.strategyResearch?.jobs?.length || 0;
    return {
      passed: jobs > 0,
      reason: jobs > 0 ? "There are market opportunities to project from." : "No jobs available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Infer the best next-role options.",
      steps: [
        `Analyze ${state.strategyResearch.jobs.length} jobs`,
        "Project role tracks that upgrade scope, decision-making, and leadership level"
      ]
    };
  },
  async execute({ state }) {
    const roleOptions = inferRoleTracks(state.strategyResearch.jobs).map((role, index) => ({
      rank: index + 1,
      role,
      reason: "Based on the current market mix and your leadership/architecture direction."
    }));

    return {
      summary: { roleOptions: roleOptions.length },
      output: { roleOptions }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.roleOptions?.length || 0) > 0,
      score: 0.9,
      notes: ["Projected next-role options from current market signals."]
    };
  }
});

module.exports = { nextRoleRoleAgent };
