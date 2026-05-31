const { createGoalDrivenAgent } = require("./base");
const { buildTransitionIntent, buildTransitionRunConfig } = require("../lib/career-transition");

const transitionMappingAgent = createGoalDrivenAgent({
  name: "transition-mapping-agent",
  skill: "Map a cross-domain career transition into realistic bridge roles and search intent.",
  emptyOutput() {
    return { intent: null, rolePaths: [], configOverride: null };
  },
  async goalCheck({ state }) {
    const hasSignal =
      Boolean(state.config.transition?.targetDomain) ||
      (state.config.transition?.targetRoles || []).length > 0 ||
      (state.config.profile?.targetTitles || []).length > 0;

    return {
      passed: hasSignal,
      reason: hasSignal ? "There is enough transition intent to map a target direction." : "No target transition direction was provided."
    };
  },
  async plan({ state }) {
    return {
      goal: "Translate the requested transition into target roles and search queries.",
      steps: [
        `Infer source domain from ${state.config.profile.currentTitle || "the profile"}`,
        "Resolve the target domain, bridge roles, and search-ready queries",
        "Create a search config tuned for transition discovery"
      ]
    };
  },
  async execute({ state }) {
    const intent = buildTransitionIntent(state.config);
    const configOverride = buildTransitionRunConfig(state.config, intent);

    return {
      summary: {
        sourceDomain: intent.sourceDomain,
        targetDomain: intent.targetDomain,
        rolePaths: intent.rolePaths.length,
        searchQueries: intent.searchQueries.length
      },
      output: {
        intent,
        rolePaths: intent.rolePaths,
        configOverride
      }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.rolePaths?.length || 0) > 0,
      score: 0.92,
      notes: ["Mapped the transition into bridge roles and search intent."]
    };
  }
});

module.exports = { transitionMappingAgent };
