const { createGoalDrivenAgent } = require("./base");
const { tailorResumeForJobs } = require("../lib/resume");

const resumeModifierAgent = createGoalDrivenAgent({
  name: "resume-modifier-agent",
  skill: "Tailor the master resume to each shortlisted JD, keeping every change truthful and ATS-oriented.",
  emptyOutput() {
    return { tailoredResumes: [], shortlistedWithResume: [] };
  },
  async goalCheck({ state }) {
    const shortlisted = state.comparison?.shortlistedJobs?.length || 0;
    return {
      passed: shortlisted > 0,
      reason: shortlisted > 0 ? "There are shortlisted jobs to tailor for." : "No shortlisted jobs available."
    };
  },
  async plan({ state }) {
    const jobs = state.comparison.shortlistedJobs;
    return {
      goal: "Generate tailored resume packages for shortlisted jobs.",
      steps: [
        `Tailor up to ${state.config.resume?.maxTailoredResumesPerRun || jobs.length} resumes`,
        "Create DOCX, Markdown, text, and JSON artifacts"
      ]
    };
  },
  async execute({ state, services }) {
    const jobs = state.comparison.shortlistedJobs;
    const tailoredResumes = await tailorResumeForJobs({
      rootDir: state.rootDir,
      outputDir: state.outputDir,
      jobs,
      config: state.config,
      log: services.log
    });
    const byJobId = new Map(tailoredResumes.map((item) => [item.jobId, item]));
    const shortlistedWithResume = jobs.map((job) => ({
      ...job,
      tailoredResume: byJobId.get(job.id) || null
    }));

    return {
      summary: {
        tailoredResumes: tailoredResumes.length
      },
      output: {
        tailoredResumes,
        shortlistedWithResume
      }
    };
  },
  async credibilityCheck({ execution, state }) {
    const expected = Math.min(
      state.config.resume?.maxTailoredResumesPerRun || state.comparison.shortlistedJobs.length,
      state.comparison.shortlistedJobs.length
    );
    const actual = execution.output?.tailoredResumes?.length || 0;

    return {
      passed: actual === expected || actual === state.comparison.shortlistedJobs.length,
      score: expected === 0 ? 1 : actual / expected,
      notes: [`Generated ${actual} tailored resume packages out of ${expected} expected.`]
    };
  }
});

module.exports = { resumeModifierAgent };
