function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  const seen = new Set();
  const results = [];

  for (const value of values || []) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(String(value).trim());
  }

  return results;
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildDocumentSections(jobOrConfig, mode = "job") {
  if (mode === "profile") {
    return {
      title: normalizeText(jobOrConfig?.profile?.currentTitle),
      summary: normalizeText(jobOrConfig?.profile?.resumeSummary),
      skills: unique(jobOrConfig?.profile?.skills || []).map(normalizeText),
      targetTitles: unique(jobOrConfig?.profile?.targetTitles || []).map(normalizeText),
      queries: unique(jobOrConfig?.preferences?.searchQueries || []).map(normalizeText)
    };
  }

  return {
    title: normalizeText(jobOrConfig?.title),
    company: normalizeText(jobOrConfig?.company),
    location: normalizeText(jobOrConfig?.location),
    description: normalizeText(jobOrConfig?.description),
    tags: unique(jobOrConfig?.tags || []).map(normalizeText)
  };
}

const conceptFamilies = [
  {
    id: "backend",
    label: "backend engineering",
    terms: ["backend", "java", "spring", "spring boot", "rest", "api", "microservices"]
  },
  {
    id: "distributed",
    label: "distributed systems",
    terms: ["distributed systems", "scalability", "scalable", "fault tolerance", "resilience", "high availability"]
  },
  {
    id: "integration",
    label: "integration and messaging",
    terms: ["kafka", "event driven", "event-driven", "stream", "messaging", "integration", "async"]
  },
  {
    id: "architecture",
    label: "architecture and system design",
    terms: ["architecture", "system design", "solution architecture", "technical design", "platform design", "solutioning"]
  },
  {
    id: "cloud",
    label: "cloud and platform",
    terms: ["kubernetes", "docker", "openshift", "aws", "azure", "gcp", "cloud native", "cloud-native"]
  },
  {
    id: "observability",
    label: "observability and reliability",
    terms: ["observability", "monitoring", "logging", "tracing", "reliability", "performance"]
  },
  {
    id: "leadership",
    label: "leadership and ownership",
    terms: ["leadership", "lead", "mentor", "stakeholder", "ownership", "cross functional", "cross-functional"]
  },
  {
    id: "ai",
    label: "ai automation",
    terms: ["ai", "agent", "agentic", "rag", "llm", "prompt", "context engineering", "automation"]
  }
];

function detectConcepts(text) {
  const haystack = normalizeText(text);

  return conceptFamilies
    .filter((family) => family.terms.some((term) => haystack.includes(normalizeText(term))))
    .map((family) => family.label);
}

function buildProfilePhrases(config) {
  const profile = buildDocumentSections(config, "profile");
  return unique([
    ...profile.skills,
    ...profile.targetTitles,
    ...profile.queries,
    ...profile.summary.split(/[.,;]+/g).map((item) => item.trim()).filter(Boolean),
    profile.title
  ]).filter((item) => item.length >= 3);
}

function buildJobText(job) {
  const sections = buildDocumentSections(job, "job");
  return [sections.title, sections.company, sections.location, sections.description, ...sections.tags]
    .filter(Boolean)
    .join(" ");
}

function computeFullTextScore(job, config) {
  const text = buildJobText(job);
  const title = normalizeText(job?.title);
  const description = normalizeText(job?.description);
  const phrases = buildProfilePhrases(config);

  let availableWeight = 0;
  let matchedWeight = 0;
  const matchedPhrases = [];

  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase || normalizedPhrase.length < 3) {
      continue;
    }

    let weight = 1;
    if ((config?.profile?.targetTitles || []).some((item) => normalizeText(item) === normalizedPhrase)) {
      weight = 2.3;
    } else if ((config?.preferences?.searchQueries || []).some((item) => normalizeText(item) === normalizedPhrase)) {
      weight = 2;
    } else if ((config?.profile?.skills || []).some((item) => normalizeText(item) === normalizedPhrase)) {
      weight = 1.4;
    }

    availableWeight += weight;

    if (title.includes(normalizedPhrase)) {
      matchedWeight += weight * 1.35;
      matchedPhrases.push(phrase);
      continue;
    }

    if (description.includes(normalizedPhrase) || text.includes(normalizedPhrase)) {
      matchedWeight += weight;
      matchedPhrases.push(phrase);
    }
  }

  const score = availableWeight ? Math.min(100, Math.round((matchedWeight / availableWeight) * 100)) : 0;
  return {
    score,
    matchedPhrases: unique(matchedPhrases).slice(0, 12)
  };
}

function computeSimilarityScore(job, config) {
  const jobTokens = new Set(tokenize(buildJobText(job)));
  const profileTokens = new Set(
    tokenize(
      [
        config?.profile?.currentTitle,
        config?.profile?.resumeSummary,
        ...(config?.profile?.skills || []),
        ...(config?.profile?.targetTitles || []),
        ...(config?.preferences?.searchQueries || [])
      ].join(" ")
    )
  );

  if (!jobTokens.size || !profileTokens.size) {
    return {
      score: 0,
      sharedTokens: []
    };
  }

  const shared = [...profileTokens].filter((token) => jobTokens.has(token));
  const unionSize = new Set([...profileTokens, ...jobTokens]).size;
  const overlapRatio = shared.length / Math.max(1, unionSize);
  const sharedDensity = shared.length / Math.max(1, profileTokens.size);
  const score = Math.round(Math.min(1, overlapRatio * 1.8 + sharedDensity * 0.45) * 100);

  return {
    score,
    sharedTokens: shared.slice(0, 16)
  };
}

function computeSemanticScore(job, config) {
  const profileText = [
    config?.profile?.currentTitle,
    config?.profile?.resumeSummary,
    ...(config?.profile?.skills || []),
    ...(config?.profile?.targetTitles || [])
  ].join(" ");
  const jobText = buildJobText(job);
  const profileConcepts = detectConcepts(profileText);
  const jobConcepts = detectConcepts(jobText);
  const overlap = profileConcepts.filter((concept) => jobConcepts.includes(concept));
  const score = profileConcepts.length
    ? Math.round((overlap.length / profileConcepts.length) * 100)
    : 0;

  return {
    score,
    profileConcepts,
    jobConcepts,
    matchedConcepts: unique(overlap)
  };
}

function hybridScoreJob(job, config) {
  const fullText = computeFullTextScore(job, config);
  const similarity = computeSimilarityScore(job, config);
  const semantic = computeSemanticScore(job, config);
  const coverageBoost = Math.min(16, (fullText.matchedPhrases?.length || 0) * 4);
  const combined = Math.round(
    fullText.score * 0.35 +
      similarity.score * 0.25 +
      semantic.score * 0.4 +
      coverageBoost
  );

  return {
    score: Math.max(0, Math.min(100, combined)),
    reason: `Hybrid JD rank uses FTS ${fullText.score}, similarity ${similarity.score}, and semantic ${semantic.score}.`,
    components: {
      fts: fullText.score,
      similarity: similarity.score,
      semantic: semantic.score
    },
    matchedPhrases: fullText.matchedPhrases,
    sharedTokens: similarity.sharedTokens,
    matchedConcepts: semantic.matchedConcepts,
    jobConcepts: semantic.jobConcepts
  };
}

module.exports = {
  normalizeText,
  tokenize,
  detectConcepts,
  hybridScoreJob
};
