const { createGoalDrivenAgent } = require("./base");
const { inferDemandSkills, mapSkillGap } = require("../lib/next-role");

const nextRoleSkillGapAgent = createGoalDrivenAgent({
  name: "next-role-skill-gap-agent",
  skill: "Find the main market-demanded skills you still need for your next upgraded role.",
  emptyOutput() {
    return { demandSkills: [], missingSkills: [] };
  },
  async goalCheck({ state }) {
    const jobs = state.strategyResearch?.jobs?.length || 0;
    return {
      passed: jobs > 0,
      reason: jobs > 0 ? "There are market opportunities to compare against." : "No jobs available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Identify skill gaps relative to market demand.",
      steps: [
        `Analyze demand patterns across ${state.strategyResearch.jobs.length} jobs`,
        "Compare against the profile's declared strengths"
      ]
    };
  },
  async execute({ state }) {
    const demandSkills = inferDemandSkills(state.strategyResearch.jobs);
    const missingSkills = mapSkillGap(demandSkills, state.config.profile.skills);
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
    return {
      passed: (execution.output?.demandSkills?.length || 0) > 0,
      score: 0.88,
      notes: ["Computed market-demanded skills and gaps."]
    };
  }
});

module.exports = { nextRoleSkillGapAgent };
