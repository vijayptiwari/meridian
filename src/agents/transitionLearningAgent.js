const { createGoalDrivenAgent } = require("./base");
const { buildTransitionLearningPlan } = require("../lib/career-transition");

const transitionLearningAgent = createGoalDrivenAgent({
  name: "transition-learning-agent",
  skill: "Turn transition skill gaps into an actionable learning roadmap with course recommendations.",
  emptyOutput() {
    return { learningPlan: [], tasks: [] };
  },
  async goalCheck({ state }) {
    const gaps = state.transitionSkillGap?.missingSkills?.length || 0;
    return {
      passed: gaps > 0,
      reason: gaps > 0 ? "There are transition gaps to close." : "No major transition gaps found."
    };
  },
  async plan({ state }) {
    return {
      goal: "Create a transition learning roadmap.",
      steps: [
        `Build a plan for ${state.transitionSkillGap.missingSkills.length} missing skills`,
        "Attach sources, time estimates, and study tasks"
      ]
    };
  },
  async execute({ state }) {
    const learningPlan = buildTransitionLearningPlan(state.transitionSkillGap.missingSkills, state.transitionIntent);
    const tasks = learningPlan.map((item) => ({
      title: `Build confidence in ${item.skill}`,
      detail: item.source,
      effort: item.duration || "Flexible"
    }));

    return {
      summary: {
        learningPlan: learningPlan.length,
        tasks: tasks.length
      },
      output: {
        learningPlan,
        tasks
      }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.learningPlan?.length || 0) > 0,
      score: 0.9,
      notes: ["Generated a transition learning roadmap with time estimates."]
    };
  }
});

module.exports = { transitionLearningAgent };
