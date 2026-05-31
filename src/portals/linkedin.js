const { waitForManualLogin, uniqueJobs } = require("./common");

function buildSearchUrl(query, easyApplyOnly) {
  const params = new URLSearchParams({
    keywords: query
  });

  if (easyApplyOnly) {
    params.set("f_AL", "true");
  }

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function scrapeSearchResults(page, maxJobs) {
  const jobs = await page.evaluate((limit) => {
    const cards = Array.from(document.querySelectorAll("li, .jobs-search-results__list-item"));

    return cards.slice(0, limit).map((card, index) => {
      const titleEl =
        card.querySelector(".base-search-card__title") ||
        card.querySelector(".job-card-list__title") ||
        card.querySelector("a");
      const companyEl =
        card.querySelector(".base-search-card__subtitle") ||
        card.querySelector(".job-card-container__company-name");
      const locationEl =
        card.querySelector(".job-search-card__location") ||
        card.querySelector(".job-card-container__metadata-wrapper");
      const linkEl = card.querySelector("a[href*='/jobs/view/']");
      const easyApplyBadge = card.innerText.toLowerCase().includes("easy apply");

      const title = titleEl?.textContent?.trim() || "";
      const company = companyEl?.textContent?.trim() || "";
      const location = locationEl?.textContent?.trim() || "";
      const url = linkEl?.href || "";

      return {
        id: `linkedin-${title}-${company}-${index}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        portal: "linkedin",
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
    await page.waitForTimeout(2000);

    const details = await page.evaluate(() => {
      const description =
        document.querySelector(".description__text")?.innerText ||
        document.querySelector(".jobs-description__content")?.innerText ||
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

async function searchLinkedInJobs({ page, config, log }) {
  await waitForManualLogin(page, "https://www.linkedin.com/feed/", "LinkedIn", log);

  const collected = [];

  for (const query of config.preferences.searchQueries || []) {
    const searchUrl = buildSearchUrl(query, config.preferences.easyApplyOnly);
    log.info(`Searching LinkedIn for "${query}"`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const jobs = await scrapeSearchResults(page, config.preferences.maxJobsPerPortal);
    collected.push(...jobs);
  }

  const deduped = uniqueJobs(collected);
  const enriched = await enrichJobDescriptions(page, deduped);
  log.info(`Collected ${enriched.length} LinkedIn jobs.`);
  return enriched;
}

async function assistApplyLinkedIn({ page, jobs, log }) {
  for (const job of jobs) {
    log.info(`Opening LinkedIn application flow for ${job.title} at ${job.company}`);
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const easyApplyButton = page.getByRole("button", { name: /easy apply/i }).first();

    if (await easyApplyButton.isVisible().catch(() => false)) {
      await easyApplyButton.click().catch(() => {});
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

      log.info("Easy Apply dialog opened. Review details and submit manually if the form looks correct.");
      await page.waitForTimeout(8000);
    } else {
      log.warn(`No Easy Apply button found for ${job.title}.`);
    }
  }
}

module.exports = { searchLinkedInJobs, assistApplyLinkedIn };
