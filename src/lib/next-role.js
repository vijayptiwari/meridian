const { normalize } = require("./job-analysis");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function topByCount(items, limit = 8) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function inferRoleTracks(jobs) {
  const titles = jobs.map((job) => normalize(job.title));
  const tracks = [];

  if (titles.some((title) => title.includes("architect"))) {
    tracks.push("Solution Architect");
  }
  if (titles.some((title) => title.includes("technical lead") || title.includes("lead software"))) {
    tracks.push("Technical Lead");
  }
  if (titles.some((title) => title.includes("principal") || title.includes("staff"))) {
    tracks.push("Principal / Staff Engineer");
  }
  if (titles.some((title) => title.includes("ai") || title.includes("llm") || title.includes("rag"))) {
    tracks.push("AI Solutions Architect");
  }
  if (titles.some((title) => title.includes("platform"))) {
    tracks.push("Platform Architect");
  }

  return unique([
    ...tracks,
    "Solution Architect",
    "Technical Lead",
    "Principal Engineer"
  ]).slice(0, 5);
}

function inferDemandSkills(jobs) {
  const terms = [];
  const keywords = [
    "system design",
    "solution architecture",
    "microservices",
    "java",
    "spring boot",
    "kafka",
    "cloud",
    "aws",
    "azure",
    "gcp",
    "kubernetes",
    "openshift",
    "stakeholder management",
    "technical leadership",
    "architecture",
    "platform",
    "rag",
    "agent",
    "llm",
    "vector database",
    "observability",
    "data modeling"
  ];

  for (const job of jobs) {
    const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        terms.push(keyword);
      }
    }
  }

  return topByCount(terms, 12);
}

function mapSkillGap(demandSkills, profileSkills) {
  const profileText = normalize((profileSkills || []).join(" | "));
  return demandSkills
    .filter((item) => !profileText.includes(normalize(item.value)))
    .map((item) => item.value)
    .slice(0, 8);
}

function learningResourceFor(skill) {
  const normalized = normalize(skill);

  if (normalized.includes("architecture") || normalized.includes("system design")) {
    return {
      source: "Architecture case studies, distributed-systems reading, and whiteboard walkthrough practice",
      duration: "2-4 weeks",
      recommendations: [
        {
          title: "System design foundations learning path",
          provider: "Architecture practice track",
          format: "Learning path",
          effort: "6-8 hours"
        },
        {
          title: "Scalability and trade-off drills",
          provider: "Hands-on case study practice",
          format: "Workshop",
          effort: "4-6 hours"
        }
      ]
    };
  }
  if (normalized.includes("stakeholder") || normalized.includes("leadership")) {
    return {
      source: "Leadership story preparation, architecture review simulations, and communication practice",
      duration: "1-2 weeks",
      recommendations: [
        {
          title: "Technical leadership communication practice",
          provider: "Leadership workshop track",
          format: "Workshop",
          effort: "3-4 hours"
        },
        {
          title: "Architecture review storytelling drills",
          provider: "Interview preparation set",
          format: "Practice set",
          effort: "2-3 hours"
        }
      ]
    };
  }
  if (normalized.includes("rag") || normalized.includes("llm") || normalized.includes("agent")) {
    return {
      source: "Official LLM platform docs plus one end-to-end applied portfolio build",
      duration: "2-3 weeks",
      recommendations: [
        {
          title: "LLM application development path",
          provider: "Official platform docs",
          format: "Documentation path",
          effort: "4-6 hours"
        },
        {
          title: "Agent workflow implementation lab",
          provider: "Hands-on build",
          format: "Project lab",
          effort: "6-8 hours"
        }
      ]
    };
  }
  if (normalized.includes("cloud") || normalized.includes("aws") || normalized.includes("azure") || normalized.includes("gcp")) {
    return {
      source: "Cloud architecture fundamentals plus one deployment-focused project",
      duration: "2-4 weeks",
      recommendations: [
        {
          title: "Cloud architecture fundamentals",
          provider: "Official cloud learning path",
          format: "Learning path",
          effort: "6-10 hours"
        },
        {
          title: "Backend deployment practice project",
          provider: "Hands-on lab",
          format: "Project lab",
          effort: "4-6 hours"
        }
      ]
    };
  }
  if (normalized.includes("kubernetes") || normalized.includes("openshift")) {
    return {
      source: "Container orchestration basics, deployment labs, and operations practice",
      duration: "1-2 weeks",
      recommendations: [
        {
          title: "Kubernetes for backend engineers",
          provider: "Official docs and labs",
          format: "Guided lab",
          effort: "4-5 hours"
        },
        {
          title: "Deployment troubleshooting drills",
          provider: "Practice environment",
          format: "Troubleshooting lab",
          effort: "2-3 hours"
        }
      ]
    };
  }
  if (normalized.includes("kafka") || normalized.includes("event") || normalized.includes("message")) {
    return {
      source: "Event-driven architecture fundamentals plus Kafka debugging practice",
      duration: "1-2 weeks",
      recommendations: [
        {
          title: "Kafka fundamentals learning path",
          provider: "Official messaging learning track",
          format: "Learning path",
          effort: "4-6 hours"
        },
        {
          title: "Retry, DLQ, and consumer lag lab",
          provider: "Hands-on integration lab",
          format: "Lab",
          effort: "3-4 hours"
        }
      ]
    };
  }
  if (normalized.includes("java") || normalized.includes("spring") || normalized.includes("microservices") || normalized.includes("api")) {
    return {
      source: "Java and Spring backend reinforcement with service-design practice",
      duration: "1-2 weeks",
      recommendations: [
        {
          title: "Spring backend development path",
          provider: "Official framework learning path",
          format: "Course path",
          effort: "5-7 hours"
        },
        {
          title: "Microservices and API design practice",
          provider: "Architecture lab",
          format: "Practice lab",
          effort: "3-5 hours"
        }
      ]
    };
  }

  return {
    source: "Official docs, targeted tutorials, and one applied practice project",
    duration: "1-2 weeks",
    recommendations: [
      {
        title: "Fundamentals learning path",
        provider: "Official docs",
        format: "Learning path",
        effort: "3-4 hours"
      },
      {
        title: "Applied practice exercise",
        provider: "Hands-on project",
        format: "Practice lab",
        effort: "2-3 hours"
      }
    ]
  };
}

function recommendCompanies(jobs) {
  return jobs
    .filter((job) => (job.businessInsight?.stabilityScore || 0) >= 60 || (job.salaryInsight?.bestBetScore || 0) >= 60)
    .sort((a, b) => (b.overallBetScore || 0) - (a.overallBetScore || 0))
    .slice(0, 8)
    .map((job) => ({
      company: job.company,
      role: job.title,
      reason:
        job.businessInsight?.recommendation ||
        job.salaryInsight?.bestBetReason ||
        "Strong role and market fit.",
      salaryRange: job.salaryInsight?.displayRange || null,
      stabilityScore: job.businessInsight?.stabilityScore || null
    }));
}

function suggestIncrement(jobs, config) {
  const current = Number(config.salary?.currentAnnualCompensation || 0);
  const numericRanges = jobs
    .map((job) => job.salaryInsight)
    .filter((item) => item?.currency === (config.salary?.currency || "INR") && item?.estimatedMax)
    .map((item) => item.estimatedMax);

  const marketAnchor = numericRanges.length ? Math.max(...numericRanges) : config.salary?.minimumAnnualCompensation || 0;
  const minimumTarget = Number(config.salary?.minimumAnnualCompensation || 0);
  const fairTarget = Math.max(marketAnchor, minimumTarget);
  const fairMinimum = Math.max(minimumTarget, current ? Math.round(current * 1.25) : minimumTarget);
  const fairMaximum = current ? Math.max(fairTarget, Math.round(current * 1.55)) : fairTarget;

  return {
    currentAnnualCompensation: current || null,
    currency: config.salary?.currency || "INR",
    fairMinimum,
    fairMaximum,
    recommendation:
      current > 0
        ? `A fair increment target is roughly ${Math.round(((fairMinimum / current) - 1) * 100)}% to ${Math.round(((fairMaximum / current) - 1) * 100)}% over current compensation.`
        : "Set your current salary in the dashboard to get a personalized increment range."
  };
}

module.exports = {
  inferRoleTracks,
  inferDemandSkills,
  mapSkillGap,
  learningResourceFor,
  recommendCompanies,
  suggestIncrement
};
