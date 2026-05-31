const path = require("path");
const { createGoalDrivenAgent } = require("./base");

function buildEmailDraft(job, profile) {
  return {
    subject: `Application for ${job.title} - ${profile.name}`,
    body: [
      `Hello Hiring Team,`,
      "",
      `I am applying for the ${job.title} role at ${job.company}.`,
      `My background aligns with the position, and I have attached a resume tailored to the job requirements.`,
      "",
      `Key fit areas: ${(job.comparison?.matchedSkills || []).slice(0, 5).join(", ") || "Relevant software engineering experience"}.`,
      "",
      `Regards,`,
      profile.name,
      profile.email,
      profile.phone
    ].join("\n")
  };
}

const emailApplyAgent = createGoalDrivenAgent({
  name: "email-apply-agent",
  skill: "Prepare email-application drafts for roles that require direct outreach.",
  emptyOutput() {
    return { drafts: [], targetedJobs: [] };
  },
  async goalCheck({ state }) {
    const targetedJobs = (state.resumeModifier?.shortlistedWithResume || []).filter((job) => job.applyRoute === "email");
    return {
      passed: targetedJobs.length > 0,
      reason: targetedJobs.length > 0 ? "Email-based jobs are available." : "No email-apply jobs available."
    };
  },
  async plan({ state }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter((job) => job.applyRoute === "email");
    return {
      goal: "Draft recruiter-ready email applications with tailored resume attachments.",
      steps: [`Prepare drafts for ${targetedJobs.length} email-apply jobs`, "Save structured subject and body templates"]
    };
  },
  async execute({ state, services }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter((job) => job.applyRoute === "email");
    const draftsDir = path.join(state.outputDir, "email-drafts");
    await services.ensureDir(draftsDir);
    const drafts = [];

    for (const job of targetedJobs) {
      const draft = buildEmailDraft(job, state.config.profile);
      const filePath = path.join(draftsDir, `${job.id}.json`);
      await services.saveJson(filePath, {
        job,
        draft,
        attachmentPath: job.tailoredResume?.docxPath || null
      });
      drafts.push({
        jobId: job.id,
        filePath,
        subject: draft.subject,
        attachmentPath: job.tailoredResume?.docxPath || null
      });
    }

    return {
      summary: {
        drafts: drafts.length
      },
      output: {
        drafts,
        targetedJobs
      }
    };
  },
  async credibilityCheck({ execution }) {
    const drafts = execution.output?.drafts?.length || 0;
    return {
      passed: drafts > 0,
      score: drafts > 0 ? 0.92 : 0.1,
      notes: drafts > 0 ? [`Prepared ${drafts} email-apply drafts.`] : ["No email drafts were created."]
    };
  }
});

module.exports = { emailApplyAgent };
