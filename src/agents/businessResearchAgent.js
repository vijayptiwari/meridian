const { createGoalDrivenAgent } = require("./base");
const { researchBusiness } = require("../lib/business-research");
const { normalize } = require("../lib/job-analysis");

const businessResearchAgent = createGoalDrivenAgent({
  name: "business-research-agent",
  skill: "Research company funding, business stability, market signals, and the opening's business context before downstream decisions.",
  emptyOutput() {
    return { companyInsights: [], jobs: [], stableCompanies: [] };
  },
  async goalCheck({ state }) {
    const totalJobs = state.research?.jobs?.length || 0;
    return {
      passed: totalJobs > 0,
      reason: totalJobs > 0 ? "There are extracted jobs to analyze." : "No extracted jobs available."
    };
  },
  async plan({ state }) {
    return {
      goal: "Research business quality and company stability for extracted openings.",
      steps: [
        `Analyze ${state.research.jobs.length} extracted jobs`,
        "Look for public signals about funding, financial health, layoffs, and market position",
        "Assess how the opening aligns with leadership, architecture, backend, or AI business needs"
      ]
    };
  },
  async execute({ state, services }) {
    const companyInsights = [];
    const companyCache = new Map();

    for (const job of state.research.jobs) {
      const companyKey = normalize(job.company || "unknown-company");

      if (!companyCache.has(companyKey)) {
        services.log.info(`Researching business stability for ${job.company}`);
        companyCache.set(companyKey, await researchBusiness(job));
      }

      companyInsights.push({
        jobId: job.id,
        ...companyCache.get(companyKey)
      });
    }

    const byJobId = new Map(companyInsights.map((item) => [item.jobId, item]));
    const jobs = state.research.jobs.map((job) => ({
      ...job,
      businessInsight: byJobId.get(job.id) || null
    }));
    const stableCompanies = jobs.filter((job) => (job.businessInsight?.stabilityScore || 0) >= 72);

    return {
      summary: {
        companyInsights: companyInsights.length,
        stableCompanies: stableCompanies.length
      },
      output: {
        companyInsights,
        jobs,
        stableCompanies
      }
    };
  },
  async credibilityCheck({ execution }) {
    const count = execution.output?.companyInsights?.length || 0;
    return {
      passed: count > 0,
      score: count > 0 ? 0.82 : 0.1,
      notes: count > 0 ? [`Produced business research signals for ${count} jobs.`] : ["No business research created."]
    };
  }
});

module.exports = { businessResearchAgent };
