const { normalize, extractKeywordsFromJob } = require("./job-analysis");

function parseSalaryNumbers(text) {
  const numericValues = [];
  const patterns = [
    /\$?\s?(\d{2,3}(?:,\d{3})+)(?:\.\d+)?/g,
    /\b(\d+(?:\.\d+)?)\s*(k|lpa|lakhs?|lac|lakh)\b/gi,
    /\b(\d+(?:\.\d+)?)\s*(crore|cr)\b/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = Number(String(match[1]).replace(/,/g, ""));
      const unit = String(match[2] || "").toLowerCase();
      let annualValue = raw;

      if (unit === "k") {
        annualValue = raw * 1000;
      } else if (unit === "lpa" || unit === "lakh" || unit === "lakhs" || unit === "lac") {
        annualValue = raw * 100000;
      } else if (unit === "crore" || unit === "cr") {
        annualValue = raw * 10000000;
      }

      if (annualValue >= 10000) {
        numericValues.push(annualValue);
      }
    }
  }

  return numericValues.sort((a, b) => a - b);
}

function detectCurrency(text, location) {
  const haystack = normalize(`${text} ${location || ""}`);

  if (haystack.includes("usd") || haystack.includes("$") || haystack.includes("united states")) {
    return "USD";
  }

  if (haystack.includes("inr") || haystack.includes("rs") || haystack.includes("india") || haystack.includes("pune")) {
    return "INR";
  }

  return "UNKNOWN";
}

function inferSeniority(job) {
  const title = normalize(job.title);

  if (title.includes("staff") || title.includes("principal") || title.includes("architect")) {
    return "staff_plus";
  }
  if (title.includes("lead") || title.includes("senior") || title.includes("sr")) {
    return "senior";
  }
  if (title.includes("junior") || title.includes("jr") || title.includes("associate") || title.includes("entry")) {
    return "junior";
  }
  return "mid";
}

function inferRoleTrack(job) {
  const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));

  if (text.includes("java") || text.includes("spring")) {
    return "java_backend";
  }
  if (text.includes("integration") || text.includes("tibco") || text.includes("middleware")) {
    return "integration";
  }
  if (text.includes("frontend") || text.includes("react") || text.includes("angular")) {
    return "frontend";
  }
  return "general_software";
}

function inferRegion(job) {
  const location = normalize(job.location);

  if (location.includes("india") || location.includes("pune") || location.includes("bengaluru") || location.includes("hyderabad") || location.includes("mumbai")) {
    return "india";
  }

  if (location.includes("remote")) {
    return "remote";
  }

  return "global";
}

function estimateBaseRange(job, config) {
  const region = inferRegion(job);
  const seniority = inferSeniority(job);
  const roleTrack = inferRoleTrack(job);

  const indiaRanges = {
    junior: [600000, 1200000],
    mid: [1200000, 2400000],
    senior: [2400000, 4200000],
    staff_plus: [4000000, 6500000]
  };
  const globalRanges = {
    junior: [70000, 110000],
    mid: [110000, 170000],
    senior: [160000, 240000],
    staff_plus: [220000, 320000]
  };

  const base = region === "india" ? indiaRanges[seniority] : globalRanges[seniority];
  let [min, max] = base;

  if (roleTrack === "java_backend" || roleTrack === "integration") {
    min *= 1.05;
    max *= 1.12;
  }

  if (extractKeywordsFromJob(job).includes("kubernetes") || extractKeywordsFromJob(job).includes("aws")) {
    min *= 1.08;
    max *= 1.12;
  }

  if (region === "remote") {
    min *= 1.05;
    max *= 1.1;
  }

  const currentYears = Number(config.profile.experienceYears || 0);
  if (currentYears >= 8 && seniority === "junior") {
    min *= 0.9;
    max *= 0.92;
  }

  return {
    estimatedMin: Math.round(min),
    estimatedMax: Math.round(max),
    currency: region === "india" ? "INR" : "USD",
    source: "heuristic-market-estimate"
  };
}

function formatComp(value, currency) {
  if (!value || !currency || currency === "UNKNOWN") {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function buildQualification(job, comp, config) {
  const salaryPrefs = config.salary || {};
  const title = normalize(job.title);
  const currentYears = Number(config.profile.experienceYears || 0);
  let score = 50;
  const notes = [];

  if (title.includes("junior") || title.includes("jr")) {
    score -= 20;
    notes.push("Role title looks junior for your experience level.");
  }

  if (title.includes("senior") || title.includes("lead")) {
    score += 12;
    notes.push("Role seniority is more aligned with career progression.");
  }

  if (comp.source === "job-description-salary-range") {
    score += 10;
    notes.push("Salary range was explicitly found in the job description.");
  } else {
    notes.push("Salary range was estimated from role, region, and skill signals.");
  }

  if (salaryPrefs.minimumAnnualCompensation && salaryPrefs.currency && salaryPrefs.currency === comp.currency) {
    if ((comp.estimatedMax || 0) >= salaryPrefs.minimumAnnualCompensation) {
      score += 15;
      notes.push("Estimated maximum meets your minimum compensation target.");
    } else {
      score -= 15;
      notes.push("Estimated maximum is below your stated compensation target.");
    }
  }

  if (salaryPrefs.targetAnnualCompensation && salaryPrefs.currency && salaryPrefs.currency === comp.currency) {
    if ((comp.estimatedMax || 0) >= salaryPrefs.targetAnnualCompensation) {
      score += 10;
      notes.push("Estimated range reaches your target compensation.");
    } else {
      notes.push("Estimated range does not clearly reach your target compensation.");
    }
  }

  if (currentYears >= 8 && (title.includes("junior") || title.includes("jr"))) {
    score -= 10;
  }

  const qualifiesAsBestBet = score >= 65;
  const bestBetReason = qualifiesAsBestBet
    ? "Compensation and seniority together make this a strong bet."
    : "Compensation and seniority do not make this one of the strongest bets yet.";

  return {
    qualifiesAsBestBet,
    bestBetScore: Math.max(0, Math.min(100, score)),
    bestBetReason,
    notes
  };
}

function researchSalary(job, config) {
  const salaryValues = parseSalaryNumbers(`${job.title}\n${job.description || ""}`);
  const currency = detectCurrency(`${job.title}\n${job.description || ""}`, job.location);

  let comp;
  if (salaryValues.length >= 2) {
    comp = {
      estimatedMin: salaryValues[0],
      estimatedMax: salaryValues[salaryValues.length - 1],
      currency,
      source: "job-description-salary-range"
    };
  } else if (salaryValues.length === 1) {
    const base = salaryValues[0];
    comp = {
      estimatedMin: Math.round(base * 0.9),
      estimatedMax: Math.round(base * 1.1),
      currency,
      source: "job-description-single-value"
    };
  } else {
    comp = estimateBaseRange(job, config);
  }

  const qualification = buildQualification(job, comp, config);

  return {
    ...comp,
    displayRange:
      comp.estimatedMin && comp.estimatedMax
        ? `${formatComp(comp.estimatedMin, comp.currency)} - ${formatComp(comp.estimatedMax, comp.currency)}`
        : null,
    ...qualification
  };
}

module.exports = { researchSalary };
