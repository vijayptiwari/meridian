const { waitForManualLogin, uniqueJobs } = require("./common");

function buildSearchUrl(query) {
  const encoded = encodeURIComponent(query.trim().replace(/\s+/g, "-"));
  return `https://www.naukri.com/${encoded}-jobs`;
}

async function scrapeSearchResults(page, maxJobs) {
  const jobs = await page.evaluate((limit) => {
    const cards = Array.from(document.querySelectorAll("article, .srp-jobtuple-wrapper"));

    return cards.slice(0, limit).map((card, index) => {
      const titleEl = card.querySelector("a.title") || card.querySelector("a");
      const companyEl = card.querySelector(".comp-name") || card.querySelector(".companyInfo a");
      const locationEl = card.querySelector(".locWdth") || card.querySelector(".location");
      const easyApplyBadge = card.innerText.toLowerCase().includes("apply");

      const title = titleEl?.textContent?.trim() || "";
      const company = companyEl?.textContent?.trim() || "";
      const location = locationEl?.textContent?.trim() || "";
      const url = titleEl?.href || "";

      return {
        id: `naukri-${title}-${company}-${index}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        portal: "naukri",
        title,
        company,
        location,
        url,
        description: "",
        tags: [],
        easyApply: easyApplyBadge
      };
    });
  }, maxJobs);

  return uniqueJobs(jobs).filter((job) => job.title && job.url);
}

async function enrichJobDescriptions(page, jobs, maxDetails = 5) {
  const enriched = [];

  for (const job of jobs.slice(0, maxDetails)) {
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const details = await page.evaluate(() => {
      const description =
        document.querySelector(".styles_JDC__dang-inner-html__h0K4t")?.innerText ||
        document.querySelector(".job-desc")?.innerText ||
        "";

      const tags = Array.from(document.querySelectorAll("li, span"))
        .map((node) => node.textContent?.trim() || "")
        .filter((text) => text && text.length < 50)
        .slice(0, 10);

      return { description, tags };
    });

    enriched.push({ ...job, ...details });
  }

  return [...enriched, ...jobs.slice(maxDetails)];
}

async function searchNaukriJobs({ page, config, log }) {
  await waitForManualLogin(page, "https://www.naukri.com/mnjuser/homepage", "Naukri", log);

  const collected = [];

  for (const query of config.preferences.searchQueries || []) {
    const searchUrl = buildSearchUrl(query);
    log.info(`Searching Naukri for "${query}"`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4500);

    const jobs = await scrapeSearchResults(page, config.preferences.maxJobsPerPortal);
    collected.push(...jobs);
  }

  const deduped = uniqueJobs(collected);
  const enriched = await enrichJobDescriptions(page, deduped);
  log.info(`Collected ${enriched.length} Naukri jobs.`);
  return enriched;
}

async function assistApplyNaukri({ page, jobs, log }) {
  for (const job of jobs) {
    log.info(`Opening Naukri job page for ${job.title} at ${job.company}`);
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const applyButton = page.getByRole("button", { name: /apply/i }).first();

    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click().catch(() => {});
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

      log.info("Apply flow opened. Review details and continue manually if everything looks correct.");
      await page.waitForTimeout(8000);
    } else {
      log.warn(`No apply button found for ${job.title}.`);
    }
  }
}

module.exports = { searchNaukriJobs, assistApplyNaukri };
