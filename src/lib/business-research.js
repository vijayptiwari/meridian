const { normalize } = require("./job-analysis");

function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const regex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null && results.length < 5) {
    results.push({
      url: stripHtml(match[1]),
      title: stripHtml(match[2]),
      snippet: stripHtml(match[3])
    });
  }

  return results;
}

function stabilityFromText(text) {
  const haystack = normalize(text);
  let score = 50;
  const notes = [];

  const positiveSignals = [
    ["series a", 6],
    ["series b", 8],
    ["series c", 10],
    ["series d", 12],
    ["funding", 5],
    ["profitable", 14],
    ["profit", 6],
    ["revenue", 5],
    ["public company", 12],
    ["nasdaq", 10],
    ["nyse", 10],
    ["growth", 4],
    ["expansion", 4],
    ["enterprise", 3]
  ];

  const riskSignals = [
    ["layoff", -18],
    ["layoffs", -18],
    ["bankruptcy", -35],
    ["shutdown", -30],
    ["decline", -8],
    ["losses", -8],
    ["downturn", -8],
    ["restructuring", -10],
    ["acquired", -2]
  ];

  for (const [keyword, delta] of positiveSignals) {
    if (haystack.includes(keyword)) {
      score += delta;
      notes.push(`Positive signal: ${keyword}`);
    }
  }

  for (const [keyword, delta] of riskSignals) {
    if (haystack.includes(keyword)) {
      score += delta;
      notes.push(`Risk signal: ${keyword}`);
    }
  }

  return {
    stabilityScore: Math.max(0, Math.min(100, score)),
    notes
  };
}

function inferCompanyProfile(job) {
  const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));

  if (text.includes("architect") || text.includes("lead") || text.includes("principal") || text.includes("staff")) {
    return "leadership-and-design";
  }
  if (text.includes("backend") || text.includes("microservices") || text.includes("platform")) {
    return "backend-platform";
  }
  if (text.includes("agent") || text.includes("llm") || text.includes("rag") || text.includes("ai")) {
    return "applied-ai";
  }
  return "general-product-engineering";
}

async function searchCompany(company, job) {
  const query = encodeURIComponent(
    `${company} funding financial results layoffs market position ${job.title || ""}`.trim()
  );
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  return parseDuckDuckGoResults(await response.text());
}

async function researchBusiness(job) {
  const company = job.company || "Unknown company";
  let sources = [];
  let summaryText = "";

  try {
    sources = await searchCompany(company, job);
    summaryText = sources.map((item) => `${item.title}. ${item.snippet}`).join(" ");
  } catch {
    summaryText = [job.company, job.description].filter(Boolean).join(" ");
  }

  const stability = stabilityFromText(summaryText);
  const profileFit = inferCompanyProfile(job);

  return {
    company: company,
    fundingSignals: sources
      .filter((item) => /funding|series|raised|investor|valuation/i.test(`${item.title} ${item.snippet}`))
      .map((item) => ({
        title: item.title,
        url: item.url
      }))
      .slice(0, 3),
    marketSignals: sources.slice(0, 5),
    stabilityScore: stability.stabilityScore,
    stabilityLabel:
      stability.stabilityScore >= 72 ? "stable" : stability.stabilityScore >= 55 ? "watchlist" : "risky",
    profileContext: profileFit,
    recommendation:
      stability.stabilityScore >= 72
        ? "Business looks reasonably stable from public signals."
        : stability.stabilityScore >= 55
          ? "Mixed business signals. Good to validate manually before prioritizing."
          : "Business stability signals are weak or uncertain. Treat cautiously.",
    notes: stability.notes.slice(0, 6)
  };
}

module.exports = { researchBusiness };
