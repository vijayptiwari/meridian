const { createGoalDrivenAgent } = require("./base");
const { learningResourceFor } = require("../lib/next-role");

const nextRoleLearningAgent = createGoalDrivenAgent({
  name: "next-role-learning-agent",
  skill: "Turn skill gaps into a realistic learning plan with sources and time estimates.",
  emptyOutput() {
    return { learningPlan: [] };
  },
  async goalCheck({ state }) {
    const gaps = state.nextRoleSkillGap?.missingSkills?.length || 0;
    return {
      passed: gaps > 0,
      reason: gaps > 0 ? "There are missing skills to plan for." : "No significant skill gaps found."
    };
  },
  async plan({ state }) {
    return {
      goal: "Build a learning roadmap for next-role readiness.",
      steps: [
        `Create a plan for ${state.nextRoleSkillGap.missingSkills.length} missing skills`,
        "Attach learning source suggestions and time estimates"
      ]
    };
  },
  async execute({ state }) {
    const learningPlan = state.nextRoleSkillGap.missingSkills.map((skill) => ({
      skill,
      ...learningResourceFor(skill)
    }));

    return {
      summary: { learningPlan: learningPlan.length },
      output: { learningPlan }
    };
  },
  async credibilityCheck({ execution }) {
    return {
      passed: (execution.output?.learningPlan?.length || 0) > 0,
      score: 0.9,
      notes: ["Generated learning roadmap with source guidance and time estimates."]
    };
  }
});

module.exports = { nextRoleLearningAgent };
