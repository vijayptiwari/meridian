const { createGoalDrivenAgent } = require("./base");
const { inferTransferableStrengths } = require("../lib/career-transition");

const transitionTransferableAgent = createGoalDrivenAgent({
  name: "transition-transferable-agent",
  skill: "Identify which current strengths can credibly transfer into the new career path.",
  emptyOutput() {
    return { transferableStrengths: [] };
  },
  async goalCheck({ state }) {
    return {
      passed: Boolean(state.transitionIntent),
      reason: state.transitionIntent ? "A transition intent is available." : "No transition intent available."
    };
  },
  async plan() {
    return {
      goal: "Extract the strongest transferable strengths for the transition.",
      steps: [
        "Read the current title, summary, and skills",
        "Map the strongest adjacent strengths into the target domain"
      ]
    };
  },
  async execute({ state }) {
    const transferableStrengths = inferTransferableStrengths(state.config, state.transitionIntent);
    return {
      summary: { transferableStrengths: transferableStrengths.length },
      output: { transferableStrengths }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.transferableStrengths?.length || 0) > 0,
      score: 0.9,
      notes: ["Extracted transferable strengths for cross-domain positioning."]
    };
  }
});

module.exports = { transitionTransferableAgent };
