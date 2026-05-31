const { normalize } = require("./job-analysis");
const { learningResourceFor } = require("./next-role");

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueBy(items, keyGetter) {
  const seen = new Set();
  const results = [];

  for (const item of items || []) {
    const key = keyGetter(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }

  return results;
}

function topByCount(items, limit = 8) {
  const counts = new Map();
  for (const item of items || []) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function containsAny(text, keywords) {
  const haystack = normalize(text);
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
}

function inferCurrentDomain(profile) {
  const text = normalize([
    profile?.currentTitle,
    profile?.resumeSummary,
    ...(profile?.skills || [])
  ].join(" | "));

  if (containsAny(text, ["java", "spring", "kafka", "backend", "software", "developer", "engineering", "api", "sql"])) {
    return "technology";
  }
  if (containsAny(text, ["marketing", "seo", "campaign", "brand", "growth", "content"])) {
    return "marketing";
  }
  if (containsAny(text, ["sales", "business development", "account executive", "presales", "quota", "crm"])) {
    return "sales";
  }
  if (containsAny(text, ["bpo", "kpo", "call center", "customer support", "technical support", "process associate"])) {
    return "bpo/kpo";
  }
  if (containsAny(text, ["back office", "operations", "process", "reporting", "uat", "quality", "auditing"])) {
    return "back office";
  }

  return "general business";
}

function inferTargetDomain(text) {
  const haystack = normalize(text);

  if (haystack.includes("marketing") && haystack.includes("sales")) {
    return "marketing and sales";
  }
  if (containsAny(haystack, ["technology", "tech", "software", "developer", "engineering", "qa", "data analyst", "implementation analyst"])) {
    return "technology";
  }
  if (containsAny(haystack, ["marketing", "growth", "content", "brand", "seo", "campaign"])) {
    return "marketing";
  }
  if (containsAny(haystack, ["sales", "business development", "account executive", "presales", "sales engineer", "solutions consultant"])) {
    return "sales";
  }
  if (containsAny(haystack, ["bpo", "kpo"])) {
    return "bpo/kpo";
  }
  if (containsAny(haystack, ["back office", "operations", "process", "reporting"])) {
    return "back office";
  }

  return "";
}

function targetIncludes(targetDomain, value) {
  return normalize(targetDomain).includes(normalize(value));
}

function defaultRoleCatalog(sourceDomain, targetDomain) {
  const source = normalize(sourceDomain);
  const target = normalize(targetDomain);
  const roles = [];

  if (targetIncludes(target, "marketing")) {
    if (source.includes("technology")) {
      roles.push(
        { role: "Product Marketing Associate", routeType: "adjacent", reason: "Technical fluency can translate well into product positioning and customer education." },
        { role: "Technical Content Strategist", routeType: "adjacent", reason: "Developer-facing communication is a natural bridge from engineering into marketing." },
        { role: "Growth Marketing Analyst", routeType: "bridge", reason: "Analytical engineers can often pivot into data-driven growth work." },
        { role: "Marketing Operations Specialist", routeType: "bridge", reason: "Systems thinking helps with campaign tooling, automation, and lifecycle workflows." }
      );
    } else {
      roles.push(
        { role: "Marketing Operations Executive", routeType: "bridge", reason: "Operational backgrounds transition well into process-heavy marketing workflows." },
        { role: "Content Marketing Associate", routeType: "bridge", reason: "Communication-heavy roles can pivot into content and customer storytelling." },
        { role: "Growth Marketing Coordinator", routeType: "stretch", reason: "A structured upskilling path can unlock entry growth roles." }
      );
    }
  }

  if (targetIncludes(target, "sales")) {
    if (source.includes("technology")) {
      roles.push(
        { role: "Sales Engineer", routeType: "adjacent", reason: "Strong technical depth transfers well into solution demonstrations and customer advisory work." },
        { role: "Solutions Consultant", routeType: "adjacent", reason: "Architecture and integration experience map well to pre-sales solutioning." },
        { role: "Pre-Sales Consultant", routeType: "adjacent", reason: "A technical profile can bridge into pre-sales without a full career reset." },
        { role: "Technical Account Manager", routeType: "bridge", reason: "Technical relationship ownership is often a good transition path from engineering." }
      );
    } else {
      roles.push(
        { role: "Business Development Executive", routeType: "bridge", reason: "Customer-facing or operations-heavy backgrounds can move into structured sales roles." },
        { role: "Sales Operations Analyst", routeType: "adjacent", reason: "Operational rigor transfers into CRM, reporting, and pipeline support." },
        { role: "Inside Sales Associate", routeType: "stretch", reason: "A focused sales foundation can open direct revenue roles." }
      );
    }
  }

  if (targetIncludes(target, "technology")) {
    if (source.includes("bpo") || source.includes("back office") || source.includes("marketing") || source.includes("sales")) {
      roles.push(
        { role: "Application Support Analyst", routeType: "bridge", reason: "It is a common first move into technology for process and support-heavy profiles." },
        { role: "Implementation Analyst", routeType: "bridge", reason: "Client coordination and process skills transfer well into implementation work." },
        { role: "QA Analyst", routeType: "bridge", reason: "Structured testing and documentation can be an accessible entry point into tech." },
        { role: "Technical Support Engineer", routeType: "bridge", reason: "Customer-facing operational roles can evolve into technical troubleshooting paths." },
        { role: "Junior Data Analyst", routeType: "stretch", reason: "Spreadsheet and reporting backgrounds can transition into analytics with SQL foundations." }
      );
    } else {
      roles.push(
        { role: "Business Analyst", routeType: "adjacent", reason: "Cross-functional profiles can move into requirement-heavy technology roles." },
        { role: "Solutions Engineer", routeType: "adjacent", reason: "A blended business-technical profile can bridge into customer-facing technology work." },
        { role: "Platform Support Engineer", routeType: "bridge", reason: "Operational understanding can be turned into technical platform ownership." }
      );
    }
  }

  if (targetIncludes(target, "back office") || targetIncludes(target, "bpo")) {
    roles.push(
      { role: "Operations Analyst", routeType: "adjacent", reason: "Structured execution and reporting skills transfer directly into operations work." },
      { role: "Process Excellence Analyst", routeType: "bridge", reason: "Quality and workflow improvement skills can translate into process-driven roles." },
      { role: "Reporting Analyst", routeType: "bridge", reason: "Documentation and data handling backgrounds often fit reporting-heavy teams." }
    );
  }

  if (!roles.length) {
    roles.push(
      { role: "Implementation Analyst", routeType: "bridge", reason: "A structured bridge role can reduce transition risk while building target-domain experience." },
      { role: "Operations Analyst", routeType: "bridge", reason: "Process and execution ownership can be a safe pivot lane." },
      { role: "Customer Success Specialist", routeType: "bridge", reason: "Customer-facing execution roles often create adjacent-entry opportunities." }
    );
  }

  return uniqueBy(roles, (item) => normalize(item.role));
}

function keywordsForTargetDomain(targetDomain) {
  const target = normalize(targetDomain);

  if (targetIncludes(target, "marketing")) {
    return ["campaign", "crm", "analytics", "growth", "content"];
  }
  if (targetIncludes(target, "sales")) {
    return ["crm", "pipeline", "customer", "discovery", "demo"];
  }
  if (targetIncludes(target, "technology")) {
    return ["sql", "api", "testing", "support", "debugging"];
  }
  if (targetIncludes(target, "back office") || targetIncludes(target, "bpo")) {
    return ["process", "reporting", "operations", "quality", "sla"];
  }

  return ["operations", "analysis", "customer", "process"];
}

function buildTransitionSearchQueries(intent, profile) {
  const locationHints = unique((profile?.preferredLocations || []).slice(0, 2));
  const keywords = keywordsForTargetDomain(intent.targetDomain).slice(0, 3).join(" ");
  const baseQueries = intent.targetRoles.map((role) => `${role} ${keywords}`.trim());
  const locationQueries = locationHints.length
    ? intent.targetRoles.slice(0, 3).map((role) => `${role} ${locationHints.join(" ")}`.trim())
    : [];

  return unique([...baseQueries, ...locationQueries]).slice(0, 8);
}

function buildTransitionIntent(config) {
  const sourceDomain = config.transition?.currentDomain?.trim() || inferCurrentDomain(config.profile);
  const targetRolesInput = config.transition?.targetRoles || [];
  const inferredTargetFromRoles = inferTargetDomain(targetRolesInput.join(" | "));
  const targetDomain =
    config.transition?.targetDomain?.trim() ||
    inferredTargetFromRoles ||
    inferTargetDomain((config.profile?.targetTitles || []).join(" | ")) ||
    "technology";
  const transitionLevel = config.transition?.transitionLevel?.trim() || "bridge";
  const rolePaths = defaultRoleCatalog(sourceDomain, targetDomain);
  const targetRoles = unique(
    targetRolesInput.length ? targetRolesInput : rolePaths.map((item) => item.role)
  ).slice(0, 6);
  const searchQueries = buildTransitionSearchQueries(
    {
      sourceDomain,
      targetDomain,
      transitionLevel,
      targetRoles
    },
    config.profile
  );
  const transitionNarrative = `Build a bridge from ${sourceDomain} into ${targetDomain} through adjacent roles, foundational skill closure, and current market opportunities.`;

  return {
    sourceDomain,
    targetDomain,
    transitionLevel,
    targetRoles,
    rolePaths,
    searchQueries,
    notes: config.transition?.notes?.trim() || "",
    transitionNarrative
  };
}

function buildTransitionRunConfig(config, intent) {
  return {
    ...config,
    profile: {
      ...config.profile,
      targetTitles: intent.targetRoles
    },
    preferences: {
      ...config.preferences,
      searchQueries: intent.searchQueries,
      minimumScore: Math.min(Number(config.preferences?.minimumScore || 50), 45)
    }
  };
}

function inferTransferableStrengths(config, intent) {
  const profileText = normalize([
    config.profile?.currentTitle,
    config.profile?.resumeSummary,
    ...(config.profile?.skills || [])
  ].join(" | "));
  const strengths = [];

  const domainStrengthMap = {
    technology: [
      ["Structured problem solving", "Engineering experience often carries strong analytical decomposition and root-cause discipline."],
      ["Systems thinking", "Technical roles usually build comfort with complex workflows, dependencies, and trade-offs."],
      ["Tooling and automation mindset", "Process simplification and automation are valuable in adjacent domains too."]
    ],
    marketing: [
      ["Customer storytelling", "Marketing work often develops strong audience framing and message clarity."],
      ["Campaign execution", "Campaign planning and measurement can transfer into growth, ops, and revenue roles."],
      ["Market awareness", "Understanding customer segments and positioning helps in cross-functional roles."]
    ],
    sales: [
      ["Customer communication", "Sales roles build live stakeholder handling, discovery, and persuasion skills."],
      ["Pipeline discipline", "Revenue workflows train consistency, follow-up discipline, and CRM hygiene."],
      ["Commercial awareness", "Sales exposure helps in customer-facing or go-to-market transitions."]
    ],
    "bpo/kpo": [
      ["Process discipline", "BPO and KPO experience often builds consistency, documentation, and SLA awareness."],
      ["Customer issue handling", "Escalation handling and structured support are strong bridge skills."],
      ["Operational reporting", "Ticket, workflow, and reporting rigor can transfer into analyst and support roles."]
    ],
    "back office": [
      ["Operational rigor", "Back-office work usually builds structured execution and process ownership."],
      ["Documentation discipline", "Documentation and audit trails help in QA, support, and operations roles."],
      ["Reporting fluency", "Spreadsheet and reporting strength can transfer into analyst pathways."]
    ],
    "general business": [
      ["Cross-functional coordination", "General business roles often build communication and execution reliability."],
      ["Process ownership", "Owning structured workflows is a useful base for many transitions."]
    ]
  };

  for (const [strength, reason] of domainStrengthMap[intent.sourceDomain] || domainStrengthMap["general business"]) {
    strengths.push({ strength, reason });
  }

  if (containsAny(profileText, ["stakeholder", "client", "customer", "communication", "presentation"])) {
    strengths.push({
      strength: "Stakeholder communication",
      reason: "Communication-heavy experience is a strong bridge into customer-facing and cross-functional roles."
    });
  }
  if (containsAny(profileText, ["sql", "report", "analysis", "analytics", "excel", "data"])) {
    strengths.push({
      strength: "Analytical reporting",
      reason: "Data and reporting fluency reduce transition friction in analyst, ops, and entry tech roles."
    });
  }
  if (containsAny(profileText, ["process", "quality", "uat", "audit", "sla"])) {
    strengths.push({
      strength: "Process and quality discipline",
      reason: "Process maturity is valuable in implementation, support, QA, operations, and marketing ops roles."
    });
  }

  return uniqueBy(strengths, (item) => normalize(item.strength)).slice(0, 8);
}

function demandKeywordSets(targetDomain) {
  const target = normalize(targetDomain);

  if (targetIncludes(target, "marketing")) {
    return {
      "marketing analytics": ["analytics", "ga4", "google analytics", "attribution", "reporting"],
      "campaign management": ["campaign", "campaign management", "lifecycle", "email marketing"],
      "content and messaging": ["content", "copywriting", "messaging", "positioning"],
      "crm and automation": ["crm", "hubspot", "marketo", "automation"],
      "growth experiments": ["growth", "experiments", "conversion", "funnel"]
    };
  }

  if (targetIncludes(target, "sales")) {
    return {
      "crm discipline": ["crm", "salesforce", "hubspot"],
      "discovery and demos": ["discovery", "demo", "presentation", "solution presentation"],
      "pipeline management": ["pipeline", "lead generation", "opportunity management"],
      "objection handling": ["negotiation", "objection", "closing"],
      "customer communication": ["customer", "account", "stakeholder"]
    };
  }

  if (targetIncludes(target, "technology")) {
    return {
      "sql and data basics": ["sql", "database", "data analysis"],
      "api and integration basics": ["api", "rest", "json", "integration"],
      "testing fundamentals": ["testing", "qa", "test cases", "automation testing"],
      "debugging and support": ["debugging", "incident", "support", "troubleshooting"],
      "programming foundations": ["java", "python", "javascript", "git", "coding"]
    };
  }

  if (targetIncludes(target, "back office") || targetIncludes(target, "bpo")) {
    return {
      "process reporting": ["reporting", "excel", "sla", "quality"],
      "workflow execution": ["process", "operations", "documentation"],
      "customer handling": ["customer", "ticket", "escalation"],
      "quality and audit": ["audit", "qa", "quality"]
    };
  }

  return {
    "process ownership": ["process", "operations", "delivery"],
    "customer communication": ["customer", "stakeholder", "client"],
    "reporting": ["reporting", "analysis", "excel"]
  };
}

function inferTransitionDemandSkills(jobs, intent) {
  const matches = [];
  const keywordSets = demandKeywordSets(intent.targetDomain);

  for (const job of jobs || []) {
    const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));
    for (const [skill, keywords] of Object.entries(keywordSets)) {
      if (keywords.some((keyword) => text.includes(normalize(keyword)))) {
        matches.push(skill);
      }
    }
  }

  return topByCount(matches, 10);
}

function baselineGapsForTargetDomain(targetDomain) {
  const target = normalize(targetDomain);

  if (targetIncludes(target, "marketing")) {
    return ["campaign management", "marketing analytics", "crm and automation", "content and messaging"];
  }
  if (targetIncludes(target, "sales")) {
    return ["crm discipline", "discovery and demos", "pipeline management", "objection handling"];
  }
  if (targetIncludes(target, "technology")) {
    return ["sql and data basics", "api and integration basics", "testing fundamentals", "debugging and support"];
  }
  if (targetIncludes(target, "back office") || targetIncludes(target, "bpo")) {
    return ["process reporting", "workflow execution", "quality and audit"];
  }

  return ["process ownership", "customer communication", "reporting"];
}

function mapTransitionGaps(demandSkills, config, intent) {
  const profileText = normalize([
    config.profile?.currentTitle,
    config.profile?.resumeSummary,
    ...(config.profile?.skills || [])
  ].join(" | "));

  const demandGaps = (demandSkills || [])
    .filter((item) => !profileText.includes(normalize(item.value)))
    .map((item) => item.value);
  const baselineGaps = baselineGapsForTargetDomain(intent.targetDomain).filter(
    (item) => !profileText.includes(normalize(item))
  );

  return unique([...demandGaps, ...baselineGaps]).slice(0, 8);
}

function transitionLearningResourceFor(skill, targetDomain) {
  const normalizedSkill = normalize(skill);
  const target = normalize(targetDomain);

  if (targetIncludes(target, "marketing")) {
    if (containsAny(normalizedSkill, ["analytics", "attribution", "reporting"])) {
      return {
        source: "Digital analytics fundamentals, attribution basics, and campaign reporting practice",
        duration: "1-2 weeks",
        recommendations: [
          { title: "Marketing analytics fundamentals", provider: "Analytics learning path", format: "Course path", effort: "4-5 hours" },
          { title: "Campaign reporting mini-project", provider: "Hands-on practice", format: "Project lab", effort: "3-4 hours" }
        ]
      };
    }
    if (containsAny(normalizedSkill, ["crm", "automation", "campaign"])) {
      return {
        source: "CRM workflow basics, lifecycle automation, and campaign execution walkthroughs",
        duration: "1-2 weeks",
        recommendations: [
          { title: "CRM and lifecycle operations path", provider: "Ops learning track", format: "Learning path", effort: "4-6 hours" },
          { title: "Marketing automation workflow lab", provider: "Hands-on lab", format: "Practice lab", effort: "3-4 hours" }
        ]
      };
    }
  }

  if (targetIncludes(target, "sales")) {
    return {
      source: "Discovery-call frameworks, CRM hygiene, demo practice, and basic negotiation training",
      duration: "1-2 weeks",
      recommendations: [
        { title: "Sales discovery and qualification path", provider: "Sales learning track", format: "Course path", effort: "3-4 hours" },
        { title: "CRM and demo preparation drills", provider: "Practice lab", format: "Simulation", effort: "2-3 hours" }
      ]
    };
  }

  if (targetIncludes(target, "back office") || targetIncludes(target, "bpo")) {
    return {
      source: "Operational reporting, documentation, process mapping, and quality-control practice",
      duration: "1 week",
      recommendations: [
        { title: "Operations reporting fundamentals", provider: "Operations learning path", format: "Learning path", effort: "3-4 hours" },
        { title: "Process mapping exercise", provider: "Hands-on practice", format: "Workshop", effort: "2-3 hours" }
      ]
    };
  }

  return learningResourceFor(skill);
}

function buildTransitionLearningPlan(missingSkills, intent) {
  return (missingSkills || []).map((skill) => ({
    skill,
    ...transitionLearningResourceFor(skill, intent.targetDomain)
  }));
}

function matchesTransitionRole(jobTitle, targetRoles) {
  const title = normalize(jobTitle);
  return (targetRoles || []).some((role) =>
    normalize(role)
      .split(/\s+/)
      .filter((token) => token.length > 3)
      .some((token) => title.includes(token))
  );
}

function selectTransitionOpportunities(jobs, intent) {
  return (jobs || [])
    .filter((job) => matchesTransitionRole(job.title, intent.targetRoles) || (job.overallBetScore || 0) >= 45)
    .sort((a, b) => (b.overallBetScore || 0) - (a.overallBetScore || 0))
    .slice(0, 8)
    .map((job) => ({
      company: job.company,
      role: job.title,
      salaryRange: job.salaryInsight?.displayRange || null,
      routeType: matchesTransitionRole(job.title, intent.targetRoles) ? "direct" : "bridge",
      whyItMatters:
        job.businessInsight?.recommendation ||
        job.salaryInsight?.bestBetReason ||
        "Looks like a viable bridge role for the transition."
    }));
}

function recommendTransitionCompanies(jobs, intent) {
  return uniqueBy(
    selectTransitionOpportunities(jobs, intent)
      .map((opportunity) => {
        const source = (jobs || []).find((job) => job.company === opportunity.company && job.title === opportunity.role);
        return {
          company: opportunity.company,
          role: opportunity.role,
          reason: opportunity.whyItMatters,
          stabilityScore: source?.businessInsight?.stabilityScore || null
        };
      })
      .sort((a, b) => (b.stabilityScore || 0) - (a.stabilityScore || 0)),
    (item) => normalize(item.company)
  ).slice(0, 6);
}

function transitionDifficulty(intent) {
  const source = normalize(intent.sourceDomain);
  const target = normalize(intent.targetDomain);

  if (source.includes("technology") && (targetIncludes(target, "sales") || targetIncludes(target, "marketing"))) {
    return "adjacent";
  }
  if ((source.includes("sales") || source.includes("marketing")) && targetIncludes(target, "technology")) {
    return "stretch";
  }
  if ((source.includes("bpo") || source.includes("back office")) && targetIncludes(target, "technology")) {
    return "stretch";
  }

  return "bridge";
}

function assessTransitionReadiness(intent, transferableStrengths, missingSkills) {
  let score = 55;
  score += Math.min(20, (transferableStrengths?.length || 0) * 4);
  score -= Math.min(24, (missingSkills?.length || 0) * 3);

  const difficulty = transitionDifficulty(intent);
  if (difficulty === "adjacent") {
    score += 8;
  } else if (difficulty === "stretch") {
    score -= 8;
  }

  const normalizedScore = Math.max(25, Math.min(92, score));
  const label =
    normalizedScore >= 75
      ? "Strong bridge potential"
      : normalizedScore >= 60
        ? "Promising with focused preparation"
        : normalizedScore >= 45
          ? "Possible, but foundation building is needed"
          : "Longer transition runway likely required";

  return {
    readinessScore: normalizedScore,
    readinessLabel: label,
    transitionDifficulty: difficulty
  };
}

function estimateTransitionCompensation(jobs, config, intent) {
  const current = Number(config.salary?.currentAnnualCompensation || 0) || null;
  const currency = config.salary?.currency || "INR";
  const matchingRanges = (jobs || [])
    .map((job) => job.salaryInsight)
    .filter((item) => item?.currency === currency && item?.estimatedMin && item?.estimatedMax);

  const marketEntryMin = matchingRanges.length
    ? Math.round(matchingRanges.reduce((sum, item) => sum + item.estimatedMin, 0) / matchingRanges.length)
    : Number(config.salary?.minimumAnnualCompensation || 0) || null;
  const marketEntryMax = matchingRanges.length
    ? Math.round(matchingRanges.reduce((sum, item) => sum + item.estimatedMax, 0) / matchingRanges.length)
    : Number(config.salary?.minimumAnnualCompensation || 0) || null;
  const difficulty = transitionDifficulty(intent);

  let recommendation = "Use current market ranges as the anchor for transition conversations.";
  if (difficulty === "adjacent") {
    recommendation =
      current && marketEntryMax
        ? "This transition can often target a flat-to-positive move because the route is adjacent and commercially useful."
        : "Adjacent transitions often preserve compensation better than hard resets.";
  } else if (difficulty === "stretch") {
    recommendation =
      current && marketEntryMin
        ? "A stretch transition may require accepting a flatter move or a temporary reset to gain target-domain credibility."
        : "Expect to optimize first for entry, learning speed, and bridge-role quality before maximizing compensation.";
  }

  return {
    currentAnnualCompensation: current,
    currency,
    marketEntryMin,
    marketEntryMax,
    recommendation
  };
}

module.exports = {
  inferCurrentDomain,
  inferTargetDomain,
  buildTransitionIntent,
  buildTransitionRunConfig,
  inferTransferableStrengths,
  inferTransitionDemandSkills,
  mapTransitionGaps,
  buildTransitionLearningPlan,
  selectTransitionOpportunities,
  recommendTransitionCompanies,
  assessTransitionReadiness,
  estimateTransitionCompensation
};
