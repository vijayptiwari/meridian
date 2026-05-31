const AGENT_STAGE_MAP = {
  "job-research-agent": "research",
  "business-research-agent": "business",
  "salary-upgrade-agent": "salary",
  "jd-comparison-agent": "comparison",
  "resume-modifier-agent": "resume",
  "learning-prep-agent": "prep",
  "email-apply-agent": "routing",
  "linkedin-easy-apply-agent": "apply",
  "naukri-apply-agent": "apply",
  "workday-apply-agent": "apply",
  "next-role-role-agent": "role",
  "next-role-skill-gap-agent": "gap",
  "next-role-learning-agent": "learning",
  "next-role-opportunity-agent": "opportunity",
  "next-role-compensation-agent": "compensation",
  "transition-mapping-agent": "transition",
  "transition-transferable-agent": "bridge",
  "transition-skill-gap-agent": "gap",
  "transition-learning-agent": "learning",
  "transition-opportunity-agent": "opportunity",
  "transition-compensation-agent": "compensation",
  "demo-agent": "research"
};

const PIPELINE_DEFINITIONS = {
  search: [
    ["research", "Job Research"],
    ["business", "Business Research"],
    ["salary", "Salary Research"],
    ["comparison", "JD Comparison"],
    ["resume", "Resume Tailoring"],
    ["prep", "Prep Planner"],
    ["routing", "Apply Routing"]
  ],
  "assist-apply": [
    ["research", "Job Research"],
    ["business", "Business Research"],
    ["salary", "Salary Research"],
    ["comparison", "JD Comparison"],
    ["resume", "Resume Tailoring"],
    ["prep", "Prep Planner"],
    ["routing", "Apply Routing"],
    ["apply", "Assisted Apply"]
  ],
  "next-role": [
    ["research", "Job Research"],
    ["business", "Business Research"],
    ["salary", "Salary Research"],
    ["comparison", "Fit Analysis"],
    ["role", "Role Projection"],
    ["gap", "Skill Gap"],
    ["learning", "Learning Plan"],
    ["opportunity", "Opportunity Scan"],
    ["compensation", "Comp Advice"]
  ],
  "career-transition": [
    ["transition", "Transition Mapping"],
    ["research", "Job Research"],
    ["business", "Business Research"],
    ["salary", "Salary Research"],
    ["comparison", "Transition Fit"],
    ["bridge", "Transferable Strengths"],
    ["gap", "Gap Analysis"],
    ["learning", "Learning Plan"],
    ["opportunity", "Bridge Opportunities"],
    ["compensation", "Transition Pay"]
  ],
  demo: [
    ["research", "Demo Job Research"],
    ["comparison", "Demo Fit Analysis"],
    ["resume", "Demo Resume Tailoring"]
  ]
};

module.exports = { AGENT_STAGE_MAP, PIPELINE_DEFINITIONS };
