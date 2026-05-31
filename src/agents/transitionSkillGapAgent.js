const { createGoalDrivenAgent } = require("./base");
const { inferTransitionDemandSkills, mapTransitionGaps } = require("../lib/career-transition");

const transitionSkillGapAgent = createGoalDrivenAgent({
  name: "transition-skill-gap-agent",
  skill: "Find the main missing foundations for a cross-domain career move.",
  emptyOutput() {
    return { demandSkills: [], missingSkills: [] };
  },
  async goalCheck({ state }) {
    return {
      passed: Boolean(state.transitionIntent),
      reason: state.transitionIntent ? "Transition intent is ready for gap analysis." : "No transition intent available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Map transition demand and missing foundations.",
      steps: [
        `Inspect ${state.strategyResearch?.jobs?.length || 0} jobs for transition demand signals`,
        "Compare market demand with the current profile baseline"
      ]
    };
  },
  async execute({ state }) {
    const demandSkills = inferTransitionDemandSkills(state.strategyResearch?.jobs || [], state.transitionIntent);
    const missingSkills = mapTransitionGaps(demandSkills, state.config, state.transitionIntent);

    return {
      summary: {
        demandSkills: demandSkills.length,
        missingSkills: missingSkills.length
      },
      output: {
        demandSkills,
        missingSkills
      }
    };
  },
  async credibilityCheck({ execution }) {
    const totalSignals = (execution.output?.demandSkills?.length || 0) + (execution.output?.missingSkills?.length || 0);
    return {
      passed: totalSignals > 0,
      score: 0.88,
      notes: ["Computed transition demand and missing-skill signals."]
    };
  }
});

module.exports = { transitionSkillGapAgent };
