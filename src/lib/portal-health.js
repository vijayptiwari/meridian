const LINKEDIN_SELECTORS = [
  ".base-search-card__title",
  ".job-card-list__title",
  "a[href*='/jobs/view/']"
];

const NAUKRI_SELECTORS = [
  ".title",
  ".companyInfo",
  "a.title"
];

async function probePortal(page, url, selectors, label) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    const matches = await page.evaluate((items) => {
      return items.map((selector) => ({
        selector,
        count: document.querySelectorAll(selector).length
      }));
    }, selectors);

    const hit = matches.some((item) => item.count > 0);
    return {
      ok: hit,
      detail: hit
        ? `${label} selectors reachable (${matches.filter((m) => m.count > 0).length}/${selectors.length} matched)`
        : `${label} selectors did not match — portal UI may have changed`
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${label} probe failed: ${error.message}`
    };
  }
}

async function checkPortalHealth(options = {}) {
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    return {
      linkedin: { ok: false, detail: "Playwright not installed" },
      naukri: { ok: false, detail: "Playwright not installed" },
      skipped: true
    };
  }

  if (options.skipNetwork) {
    return {
      linkedin: { ok: true, detail: "Selector constants present (network probe skipped)" },
      naukri: { ok: true, detail: "Selector constants present (network probe skipped)" },
      skipped: true
    };
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const linkedin = await probePortal(
      page,
      "https://www.linkedin.com/jobs/search/?keywords=software%20engineer",
      LINKEDIN_SELECTORS,
      "LinkedIn"
    );
    const naukri = await probePortal(
      page,
      "https://www.naukri.com/software-engineer-jobs",
      NAUKRI_SELECTORS,
      "Naukri"
    );

    return { linkedin, naukri, skipped: false };
  } finally {
    await browser.close();
  }
}

module.exports = { checkPortalHealth, LINKEDIN_SELECTORS, NAUKRI_SELECTORS };
