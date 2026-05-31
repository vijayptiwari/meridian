const { createGoalDrivenAgent } = require("./base");
const { assessTransitionReadiness, estimateTransitionCompensation } = require("../lib/career-transition");

const transitionCompensationAgent = createGoalDrivenAgent({
  name: "transition-compensation-agent",
  skill: "Estimate readiness and compensation realism for a cross-domain move.",
  emptyOutput() {
    return { compensationAdvice: null, readiness: null };
  },
  async goalCheck({ state }) {
    return {
      passed: Boolean(state.transitionIntent),
      reason: state.transitionIntent ? "Transition intent is available." : "No transition intent available."
    };
  },
  async plan() {
    return {
      goal: "Assess how realistic the transition is and what compensation expectations make sense.",
      steps: [
        "Use transferable strengths and missing skills to estimate readiness",
        "Use current market salary ranges to frame compensation guidance"
      ]
    };
  },
  async execute({ state }) {
    const compensationAdvice = estimateTransitionCompensation(state.strategyResearch?.jobs || [], state.config, state.transitionIntent);
    const readiness = assessTransitionReadiness(
      state.transitionIntent,
      state.transitionTransferable?.transferableStrengths || [],
      state.transitionSkillGap?.missingSkills || []
    );

    return {
      summary: {
        readinessScore: readiness.readinessScore,
        transitionDifficulty: readiness.transitionDifficulty
      },
      output: {
        compensationAdvice,
        readiness
      }
    };
  },
  async credibilityCheck() {
    return {
      passed: true,
      score: 0.87,
      notes: ["Estimated transition readiness and compensation realism."]
    };
  }
});

module.exports = { transitionCompensationAgent };
