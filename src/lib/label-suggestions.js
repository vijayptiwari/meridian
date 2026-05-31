function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueValues(values) {
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

const capabilityClusters = [
  {
    id: "backend-java",
    detect: ["java", "spring", "spring boot", "backend", "rest", "microservices"],
    summary: [
      "Backend platform engineering",
      "Java and Spring Boot microservices",
      "API and service design",
      "Enterprise backend reliability"
    ],
    skills: [
      "Backend Platform Engineering",
      "API Design",
      "Service Decomposition",
      "Domain Modeling"
    ],
    targetTitles: [
      "Senior Backend Engineer",
      "Lead Backend Engineer",
      "Staff Backend Engineer"
    ],
    queryThemes: [
      "senior backend engineer java spring boot microservices",
      "lead backend engineer distributed systems java"
    ]
  },
  {
    id: "kafka-integration",
    detect: ["kafka", "integration", "event-driven", "event driven", "messaging", "stream"],
    summary: [
      "Kafka-based integration workflows",
      "Event-driven backend architectures",
      "Loose-coupled service communication"
    ],
    skills: [
      "Kafka Architecture",
      "Event-Driven Systems",
      "Integration Reliability",
      "Async Message Flows"
    ],
    targetTitles: [
      "Integration Architect",
      "Platform Engineer",
      "Solution Architect"
    ],
    queryThemes: [
      "solution architect kafka integration microservices",
      "platform engineer event driven architecture kafka"
    ]
  },
  {
    id: "architecture",
    detect: ["architecture", "solution", "system design", "technical design", "platform"],
    summary: [
      "System design and architecture decisions",
      "Technical solutioning across services",
      "Production-first design trade-offs"
    ],
    skills: [
      "System Design",
      "Solution Architecture",
      "Architecture Decision Making",
      "Platform Design"
    ],
    targetTitles: [
      "Solution Architect",
      "Technical Architect",
      "Platform Architect",
      "Principal Engineer"
    ],
    queryThemes: [
      "technical architect backend platform system design",
      "solution architect distributed systems integration"
    ]
  },
  {
    id: "cloud-platform",
    detect: ["kubernetes", "docker", "openshift", "aws", "azure", "gcp", "cloud"],
    summary: [
      "Cloud-native platform delivery",
      "Containers and orchestration readiness",
      "Platform reliability at scale"
    ],
    skills: [
      "Cloud-Native Delivery",
      "Kubernetes Platforms",
      "Container Operations",
      "Release Engineering"
    ],
    targetTitles: [
      "Platform Engineer",
      "Senior Software Engineer",
      "Site Reliability Engineer"
    ],
    queryThemes: [
      "platform engineer kubernetes backend microservices",
      "senior software engineer cloud native java"
    ]
  },
  {
    id: "leadership",
    detect: ["leadership", "stakeholder", "mentor", "ownership", "design decisions", "solutioning"],
    summary: [
      "Technical leadership in delivery",
      "Design ownership and stakeholder alignment",
      "Engineering decision support"
    ],
    skills: [
      "Technical Leadership",
      "Stakeholder Communication",
      "Cross-Functional Solutioning",
      "Design Review Leadership"
    ],
    targetTitles: [
      "Technical Lead",
      "Engineering Lead",
      "Lead Software Engineer",
      "Solutions Consultant"
    ],
    queryThemes: [
      "technical lead backend architecture platform",
      "engineering lead system design distributed systems"
    ]
  },
  {
    id: "ai-automation",
    detect: ["ai", "agent", "agentic", "rag", "llm", "prompt", "context engineering", "automation"],
    summary: [
      "AI-assisted engineering automation",
      "Agent development for workflows",
      "Context-aware developer tooling"
    ],
    skills: [
      "Agent Development",
      "Context Engineering",
      "RAG Development",
      "Workflow Intelligence"
    ],
    targetTitles: [
      "Applied AI Engineer",
      "Agent Engineer",
      "AI Automation Engineer"
    ],
    queryThemes: [
      "applied ai engineer backend agents rag",
      "agent engineer workflow automation context engineering"
    ]
  }
];

function detectActiveClusters(config, extraCategories = []) {
  const haystack = normalizeText(
    [
      config?.profile?.currentTitle,
      config?.profile?.resumeSummary,
      ...(config?.profile?.skills || []),
      ...(config?.profile?.targetTitles || []),
      ...(config?.preferences?.searchQueries || []),
      ...extraCategories
    ].join(" ")
  );

  return capabilityClusters.filter((cluster) =>
    cluster.detect.some((keyword) => haystack.includes(normalizeText(keyword)))
  );
}

function buildRoleAnchors(config) {
  return uniqueValues([
    ...(config?.profile?.targetTitles || []),
    config?.profile?.currentTitle
  ]).slice(0, 6);
}

function buildLocationAnchor(config) {
  const location =
    config?.locationPolicy?.expectedPhysicalLocation ||
    config?.profile?.preferredLocations?.[0] ||
    "remote";
  return String(location || "").trim();
}

function buildSearchQuerySuggestions(config, clusters) {
  const roleAnchors = buildRoleAnchors(config);
  const locationAnchor = buildLocationAnchor(config);
  const topSkillAnchors = uniqueValues(config?.profile?.skills || []).slice(0, 6);
  const titles = roleAnchors.length ? roleAnchors : ["senior backend engineer"];
  const skillPairs = topSkillAnchors.slice(0, 4);
  const suggestions = [];

  for (const title of titles.slice(0, 4)) {
    const pairedSkills = skillPairs.slice(0, 2).join(" ");
    if (pairedSkills) {
      suggestions.push(`${title} ${pairedSkills}`);
    }

    if (locationAnchor) {
      suggestions.push(`${title} ${locationAnchor}`);
    }
  }

  for (const cluster of clusters) {
    suggestions.push(...(cluster.queryThemes || []));
  }

  return uniqueValues(suggestions).slice(0, 12);
}

function buildLabelSuggestions(config, options = {}) {
  const extraCategories = options.upskilledCategories || [];
  const clusters = detectActiveClusters(config, extraCategories);
  const existingSummary = String(config?.profile?.resumeSummary || "");
  const existingSkills = config?.profile?.skills || [];
  const existingTitles = config?.profile?.targetTitles || [];
  const existingQueries = config?.preferences?.searchQueries || [];

  const summarySuggestions = uniqueValues([
    "Distributed systems engineering",
    "Scalable backend platforms",
    "Production support and debugging",
    "System design ownership",
    ...clusters.flatMap((cluster) => cluster.summary || []),
    ...extraCategories
  ]).filter((item) => !normalizeText(existingSummary).includes(normalizeText(item)));

  const skillSuggestions = uniqueValues([
    "System Design",
    "Distributed Systems",
    "Technical Leadership",
    "Solutioning",
    "Observability",
    ...clusters.flatMap((cluster) => cluster.skills || []),
    ...extraCategories
  ]).filter((item) => !existingSkills.some((skill) => normalizeText(skill) === normalizeText(item)));

  const titleSuggestions = uniqueValues([
    "Technical Lead",
    "Lead Software Engineer",
    "Solution Architect",
    ...clusters.flatMap((cluster) => cluster.targetTitles || [])
  ]).filter((item) => !existingTitles.some((title) => normalizeText(title) === normalizeText(item)));

  const querySuggestions = buildSearchQuerySuggestions(config, clusters).filter(
    (item) => !existingQueries.some((query) => normalizeText(query) === normalizeText(item))
  );

  return {
    resumeSummary: summarySuggestions.slice(0, 12),
    skills: skillSuggestions.slice(0, 16),
    targetTitles: titleSuggestions.slice(0, 12),
    searchQueries: querySuggestions.slice(0, 12)
  };
}

module.exports = {
  buildLabelSuggestions
};
