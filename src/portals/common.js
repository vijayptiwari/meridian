async function waitForManualLogin(page, url, portalName, log) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  log.info(`If ${portalName} is not logged in, please log in manually in the opened browser window.`);
  await page.waitForTimeout(15000);
}

function uniqueJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    if (seen.has(job.id)) {
      return false;
    }

    seen.add(job.id);
    return true;
  });
}

module.exports = { waitForManualLogin, uniqueJobs };
