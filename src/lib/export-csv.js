function shortlistToCsv(shortlist) {
  const jobs = Array.isArray(shortlist) ? shortlist : [];
  const headers = ["title", "company", "location", "score", "portal", "easyApply", "url", "reason"];
  const escape = (value) => {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  };

  const rows = jobs.map((job) =>
    headers.map((header) => escape(job[header])).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

module.exports = { shortlistToCsv };
