function normalize(text) {
  return String(text || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractKeywordsFromJob(job) {
  const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));
  const phrases = [
    "javascript",
    "typescript",
    "react",
    "node.js",
    "node",
    "sql",
    "rest api",
    "api",
    "microservices",
    "aws",
    "azure",
    "docker",
    "kubernetes",
    "next.js",
    "frontend",
    "backend",
    "full stack",
    "testing",
    "agile",
    "performance",
    "scalability",
    "workday",
    "email"
  ];

  return phrases.filter((phrase) => text.includes(phrase)).slice(0, 12);
}

function computeMatchBreakdown(job, config) {
  const haystack = normalize(
    [job.title, job.company, job.location, job.description, ...(job.tags || [])].join(" ")
  );
  const hybrid = job.hybridSearch || {};
  const matchedSkills = [];
  const missingPrioritySkills = [];

  for (const skill of config.profile.skills || []) {
    if (haystack.includes(normalize(skill))) {
      matchedSkills.push(skill);
    }
  }

  for (const targetTitle of config.profile.targetTitles || []) {
    if (!haystack.includes(normalize(targetTitle))) {
      missingPrioritySkills.push(targetTitle);
    }
  }

  return {
    keywords: extractKeywordsFromJob(job),
    matchedSkills: unique(matchedSkills).slice(0, 12),
    missingPrioritySkills: unique(missingPrioritySkills).slice(0, 5),
    matchedConcepts: hybrid.matchedConcepts || [],
    matchedPhrases: hybrid.matchedPhrases || [],
    hybridScoreBreakdown: hybrid.components || null
  };
}

function classifyWorkArrangement(job) {
  const text = normalize([job.title, job.location, job.description, ...(job.tags || [])].join(" "));

  if (text.includes("remote")) {
    return "remote";
  }

  if (text.includes("hybrid")) {
    return "hybrid";
  }

  if (
    text.includes("work from office") ||
    text.includes("onsite") ||
    text.includes("on-site") ||
    text.includes("in office") ||
    text.includes("office-based")
  ) {
    return "onsite";
  }

  return "physical_presence_unspecified";
}

function checkLocationEligibility(job, config) {
  const arrangement = classifyWorkArrangement(job);
  const expectedPhysicalLocation = normalize(config.locationPolicy?.expectedPhysicalLocation || "");
  const jobLocation = normalize(job.location);

  if (arrangement === "remote") {
    return {
      eligible: true,
      workArrangement: arrangement,
      reason: "Remote job is eligible regardless of location."
    };
  }

  const requiresPhysicalPresence = arrangement === "hybrid" || arrangement === "onsite" || arrangement === "physical_presence_unspecified";
  const locationMatches = expectedPhysicalLocation && jobLocation.includes(expectedPhysicalLocation);

  if (requiresPhysicalPresence && locationMatches) {
    return {
      eligible: true,
      workArrangement: arrangement,
      reason: "Physical-presence job matches the expected user location."
    };
  }

  if (requiresPhysicalPresence) {
    return {
      eligible: false,
      workArrangement: arrangement,
      reason: `Physical-presence job is outside the expected location: ${config.locationPolicy?.expectedPhysicalLocation}.`
    };
  }

  return {
    eligible: true,
    workArrangement: arrangement,
    reason: "Job passed location eligibility."
  };
}

function classifyApplyRoute(job) {
  const text = normalize([job.title, job.description, job.url, ...(job.tags || [])].join(" "));

  if (job.portal === "linkedin" && job.easyApply) {
    return "linkedin_easy_apply";
  }

  if (text.includes("workday") || normalize(job.url).includes("workdayjobs.com")) {
    return "workday";
  }

  if (text.includes("email") || text.includes("@")) {
    return "email";
  }

  if (job.portal === "naukri") {
    return "naukri_native_apply";
  }

  return "manual_review";
}

function estimateSalaryUpgrade(job, config) {
  const title = normalize(job.title);
  const keywords = extractKeywordsFromJob(job);
  let uplift = 0;
  let marketSignal = "stable";

  if (title.includes("senior") || title.includes("lead") || title.includes("staff")) {
    uplift += 20;
    marketSignal = "upgrade";
  }

  if (keywords.includes("aws") || keywords.includes("docker") || keywords.includes("kubernetes")) {
    uplift += 10;
  }

  if (keywords.includes("typescript") || keywords.includes("react") || keywords.includes("node.js")) {
    uplift += 8;
  }

  if (normalize(job.location).includes("remote")) {
    uplift += 5;
  }

  const currentYears = Number(config.profile.experienceYears || 0);
  if (currentYears >= 3 && (title.includes("senior") || title.includes("lead"))) {
    uplift += 7;
  }

  const upgradeScore = Math.max(0, Math.min(100, uplift + 45));

  return {
    marketSignal,
    upgradeScore,
    recommendation:
      upgradeScore >= 70
        ? "High-priority salary upgrade target."
        : upgradeScore >= 55
          ? "Worth applying if role and scope are strong."
          : "Compensation upside unclear from available JD data."
  };
}

module.exports = {
  normalize,
  unique,
  extractKeywordsFromJob,
  computeMatchBreakdown,
  classifyWorkArrangement,
  checkLocationEligibility,
  classifyApplyRoute,
  estimateSalaryUpgrade
};
