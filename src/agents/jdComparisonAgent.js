const { createGoalDrivenAgent } = require("./base");
const { scoreJobs } = require("../lib/scoring");
const { computeMatchBreakdown, classifyApplyRoute, checkLocationEligibility } = require("../lib/job-analysis");

const jdComparisonAgent = createGoalDrivenAgent({
  name: "jd-comparison-agent",
  skill: "Compare jobs to candidate profile, score fit, assign apply routes, and replan shortlist threshold if needed.",
  emptyOutput() {
    return { scoredJobs: [], shortlistedJobs: [] };
  },
  async goalCheck({ state }) {
    const totalJobs = state.salaryUpgrade?.jobs?.length || state.businessResearch?.jobs?.length || state.research?.jobs?.length || 0;
    return {
      passed: totalJobs > 0,
      reason: totalJobs > 0 ? "Research returned jobs to compare." : "No jobs available for comparison."
    };
  },
  async plan({ state, workingMemory, attempt }) {
    const sourceJobs = state.salaryUpgrade?.jobs || state.businessResearch?.jobs || state.research.jobs;
    return {
      attempt,
      goal: "Score and shortlist jobs against target profile.",
      steps: [
        `Score ${sourceJobs.length} jobs`,
        `Use minimum shortlist threshold: ${workingMemory.minimumScoreOverride ?? state.config.preferences.minimumScore}`,
        "Apply location eligibility, then add route classification, JD keyword breakdown, salary weighting, and business-stability weighting"
      ]
    };
  },
  async execute({ state, services, workingMemory, attempt }) {
    const minimumScore = workingMemory.minimumScoreOverride ?? state.config.preferences.minimumScore;
    const sourceJobs = state.salaryUpgrade?.jobs || state.businessResearch?.jobs || state.research.jobs;
    const scored = await scoreJobs(sourceJobs, state.config, services.log);
    const enriched = scored.map((job) => ({
      ...job,
      eligibility: checkLocationEligibility(job, state.config),
      comparison: computeMatchBreakdown(job, state.config),
      applyRoute: classifyApplyRoute(job),
      overallBetScore: Math.round(
        (job.score || 0) * 0.55 +
          ((job.salaryInsight?.bestBetScore || job.salaryInsight?.upgradeScore || 50) * 0.25) +
          ((job.businessInsight?.stabilityScore || 50) * 0.2)
      )
    }));
    const shortlistedJobs = enriched.filter(
      (job) =>
        job.eligibility?.eligible &&
        job.score >= minimumScore &&
        (job.overallBetScore || 0) >= minimumScore
    );
    const replanRequired = attempt === 1 && shortlistedJobs.length === 0 && enriched.length > 0;

    return {
      summary: {
        totalJobs: enriched.length,
        eligibleJobs: enriched.filter((job) => job.eligibility?.eligible).length,
        shortlistedJobs: shortlistedJobs.length,
        minimumScore
      },
      replanRequired,
      output: {
        scoredJobs: enriched,
        shortlistedJobs,
        minimumScoreUsed: minimumScore
      },
      notes: replanRequired ? ["No jobs met the initial threshold. Retrying with a lower threshold."] : []
    };
  },
  async replan({ state }) {
    return {
      reason: "Lower shortlist threshold slightly to recover borderline matches.",
      workingMemoryPatch: {
        minimumScoreOverride: Math.max(40, Number(state.config.preferences.minimumScore || 60) - 10)
      }
    };
  },
  async credibilityCheck({ execution }) {
    const total = execution.output?.scoredJobs?.length || 0;
    const shortlisted = execution.output?.shortlistedJobs?.length || 0;
    const allClassified = (execution.output?.scoredJobs || []).every((job) => job.applyRoute);

    return {
      passed: total > 0 && allClassified,
      score: total > 0 ? (shortlisted > 0 ? 0.95 : 0.7) : 0.1,
      notes: [
        `${total} jobs were scored.`,
        `${shortlisted} jobs were shortlisted.`,
        allClassified ? "Every job received an apply-route classification." : "Some jobs are missing route classification."
      ]
    };
  }
});

module.exports = { jdComparisonAgent };
