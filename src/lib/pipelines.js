const { jobResearchAgent } = require("../agents/jobResearchAgent");
const { businessResearchAgent } = require("../agents/businessResearchAgent");
const { salaryUpgradeAgent } = require("../agents/salaryUpgradeAgent");
const { jdComparisonAgent } = require("../agents/jdComparisonAgent");
const { resumeModifierAgent } = require("../agents/resumeModifierAgent");
const { learningPrepAgent } = require("../agents/learningPrepAgent");
const { emailApplyAgent } = require("../agents/emailApplyAgent");
const { linkedinEasyApplyAgent } = require("../agents/linkedinEasyApplyAgent");
const { naukriApplyAgent } = require("../agents/naukriApplyAgent");
const { workdayApplyAgent } = require("../agents/workdayApplyAgent");
const { nextRoleRoleAgent } = require("../agents/nextRoleRoleAgent");
const { nextRoleSkillGapAgent } = require("../agents/nextRoleSkillGapAgent");
const { nextRoleLearningAgent } = require("../agents/nextRoleLearningAgent");
const { nextRoleOpportunityAgent } = require("../agents/nextRoleOpportunityAgent");
const { nextRoleCompensationAgent } = require("../agents/nextRoleCompensationAgent");
const { transitionMappingAgent } = require("../agents/transitionMappingAgent");
const { transitionTransferableAgent } = require("../agents/transitionTransferableAgent");
const { transitionSkillGapAgent } = require("../agents/transitionSkillGapAgent");
const { transitionLearningAgent } = require("../agents/transitionLearningAgent");
const { transitionOpportunityAgent } = require("../agents/transitionOpportunityAgent");
const { transitionCompensationAgent } = require("../agents/transitionCompensationAgent");

const PIPELINES = {
  search: [
    jobResearchAgent,
    businessResearchAgent,
    salaryUpgradeAgent,
    jdComparisonAgent,
    resumeModifierAgent,
    learningPrepAgent,
    emailApplyAgent
  ],
  "assist-apply": [
    jobResearchAgent,
    businessResearchAgent,
    salaryUpgradeAgent,
    jdComparisonAgent,
    resumeModifierAgent,
    learningPrepAgent,
    emailApplyAgent,
    linkedinEasyApplyAgent,
    naukriApplyAgent,
    workdayApplyAgent
  ],
  "next-role": [
    jobResearchAgent,
    businessResearchAgent,
    salaryUpgradeAgent,
    jdComparisonAgent,
    nextRoleRoleAgent,
    nextRoleSkillGapAgent,
    nextRoleLearningAgent,
    nextRoleOpportunityAgent,
    nextRoleCompensationAgent
  ],
  "career-transition": [
    transitionMappingAgent,
    jobResearchAgent,
    businessResearchAgent,
    salaryUpgradeAgent,
    jdComparisonAgent,
    transitionTransferableAgent,
    transitionSkillGapAgent,
    transitionLearningAgent,
    transitionOpportunityAgent,
    transitionCompensationAgent
  ]
};

function getPipelineAgents(mode) {
  if (mode === "demo") {
    return null;
  }
  return PIPELINES[mode] || PIPELINES.search;
}

module.exports = { PIPELINES, getPipelineAgents };
