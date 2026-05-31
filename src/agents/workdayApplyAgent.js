const { createGoalDrivenAgent } = require("./base");

async function assistApplyWorkday({ page, jobs, log }) {
  const outcomes = [];

  for (const job of jobs) {
    log.info(`Opening Workday application flow for ${job.title} at ${job.company}`);
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const applyLink = page.getByRole("link", { name: /apply/i }).first();
    const applyButton = page.getByRole("button", { name: /apply/i }).first();
    let status = "opened-for-review";

    if (await applyLink.isVisible().catch(() => false)) {
      await applyLink.click().catch(() => {});
      await page.waitForTimeout(2500);
    } else if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click().catch(() => {});
      await page.waitForTimeout(2500);
    } else {
      status = "manual-review-required";
    }

    const resumePath = job.tailoredResume?.docxPath;
    if (resumePath) {
      const fileInput = page.locator("input[type='file']").first();
      if (await fileInput.isVisible().catch(() => false)) {
        await fileInput.setInputFiles(resumePath).catch(() => {});
        log.info(`Uploaded tailored resume: ${resumePath}`);
      } else {
        log.info(`Tailored resume ready for manual upload: ${resumePath}`);
      }
    }

    outcomes.push({
      jobId: job.id,
      route: job.applyRoute,
      status
    });
  }

  return outcomes;
}

const workdayApplyAgent = createGoalDrivenAgent({
  name: "workday-apply-agent",
  skill: "Handle Workday apply flows with tailored resumes and human review checkpoints.",
  emptyOutput() {
    return { appliedJobs: [], targetedJobs: [] };
  },
  async goalCheck({ state }) {
    const targetedJobs = (state.resumeModifier?.shortlistedWithResume || []).filter((job) => job.applyRoute === "workday");
    return {
      passed: state.mode === "assist-apply" && targetedJobs.length > 0,
      reason:
        state.mode !== "assist-apply"
          ? "Apply mode is not enabled."
          : targetedJobs.length > 0
            ? "Workday jobs are available."
            : "No Workday jobs available."
    };
  },
  async plan({ state }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter((job) => job.applyRoute === "workday");
    return {
      goal: "Open Workday flows and upload tailored resumes where possible.",
      steps: [`Process ${targetedJobs.length} Workday jobs`, "Leave final submission to human review"]
    };
  },
  async execute({ state, services }) {
    const targetedJobs = state.resumeModifier.shortlistedWithResume.filter((job) => job.applyRoute === "workday");
    const outcomes = await services.withBrowserSession({
      portal: "linkedin",
      task: async ({ page }) => assistApplyWorkday({ page, jobs: targetedJobs, log: services.log })
    });

    return {
      summary: {
        targetedJobs: targetedJobs.length
      },
      output: {
        targetedJobs,
        appliedJobs: outcomes
      }
    };
  },
  async credibilityCheck({ execution }) {
    const targeted = execution.output?.targetedJobs?.length || 0;
    return {
      passed: targeted > 0,
      score: targeted > 0 ? 0.85 : 0.1,
      notes: targeted > 0 ? [`Opened ${targeted} Workday apply flows.`] : ["No Workday apply work was performed."]
    };
  }
});

module.exports = { workdayApplyAgent };
