function shortlistToCsv(shortlist, trackerJobs = {}) {
  const jobs = Array.isArray(shortlist) ? shortlist : [];
  const headers = [
    "title",
    "company",
    "location",
    "score",
    "overallBetScore",
    "portal",
    "easyApply",
    "applyRoute",
    "trackerState",
    "url",
    "reason"
  ];
  const escape = (value) => {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  };

  const rows = jobs.map((job) => {
    const key = job.id || job.url || `${job.title}-${job.company}`;
    const trackerState = trackerJobs[key]?.state || "";
    return headers
      .map((header) => {
        if (header === "trackerState") {
          return escape(trackerState);
        }
        if (header === "overallBetScore") {
          return escape(job.overallBetScore ?? job.overallBet ?? "");
        }
        if (header === "applyRoute") {
          return escape(job.applyRoute || "");
        }
        return escape(job[header]);
      })
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

module.exports = { shortlistToCsv };
