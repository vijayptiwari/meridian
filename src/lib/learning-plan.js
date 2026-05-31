const { normalize } = require("./job-analysis");
const { learningResourceFor } = require("./next-role");

function inferTopics(job, config) {
  const text = normalize([job.title, job.description, ...(job.tags || [])].join(" "));
  const topics = [];

  const candidateTopics = [
    ["system design", ["system design", "architecture", "scalability", "distributed systems"]],
    ["solution architecture", ["solution architecture", "technical design", "platform", "integration patterns"]],
    ["java and spring boot", ["java", "spring boot", "spring", "junit", "mockito"]],
    ["microservices and api design", ["microservices", "rest", "api", "openapi", "swagger"]],
    ["data and sql", ["sql", "postgresql", "mysql", "database", "data modeling"]],
    ["event-driven architecture", ["kafka", "event", "eda", "stream"]],
    ["cloud and containers", ["aws", "azure", "gcp", "docker", "kubernetes", "openshift"]],
    ["ai agents and rag", ["agent", "rag", "llm", "prompt", "vector", "retrieval", "context engineering"]],
    ["leadership and stakeholder communication", ["lead", "leadership", "stakeholder", "cross-functional", "mentor"]],
    ["observability and reliability", ["observability", "logging", "monitoring", "reliability", "performance"]]
  ];

  for (const [topic, keywords] of candidateTopics) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      topics.push(topic);
    }
  }

  if (job.comparison?.missingPrioritySkills?.length) {
    topics.push(`positioning for ${job.comparison.missingPrioritySkills[0]}`);
  }

  return [...new Set(topics)].slice(0, 5);
}

function buildTasksForTopic(topic, job) {
  const company = job.company || "the company";
  const title = job.title || "the role";

  const generic = [
    {
      title: `Revise ${topic}`,
      detail: `Refresh the concepts most relevant to ${title} at ${company}.`,
      effort: "60-90 min"
    },
    {
      title: `Prepare examples for ${topic}`,
      detail: `Write 2-3 stories from your experience that show depth in ${topic}.`,
      effort: "30-45 min"
    }
  ];

  if (topic === "system design") {
    return [
      {
        title: "Practice one architecture walkthrough",
        detail: `Prepare an end-to-end architecture explanation for a scalable backend system relevant to ${company}.`,
        effort: "90 min"
      },
      ...generic
    ];
  }

  if (topic === "leadership and stakeholder communication") {
    return [
      {
        title: "Frame your leadership stories",
        detail: `Prepare examples showing design decisions, influence, trade-offs, and stakeholder alignment.`,
        effort: "45 min"
      },
      ...generic
    ];
  }

  return generic;
}

function createLearningPlan(job, config) {
  const topics = inferTopics(job, config);
  const tasks = topics.flatMap((topic) => buildTasksForTopic(topic, job)).slice(0, 8);
  const recommendedResources = topics.map((topic) => ({
    topic,
    ...learningResourceFor(topic)
  }));

  return {
    jobId: job.id,
    portal: job.portal,
    company: job.company,
    title: job.title,
    learningFocus: topics,
    recommendedResources,
    tasks,
    readinessSummary:
      tasks.length > 0
        ? `Focus on ${topics.slice(0, 3).join(", ")} to be better prepared for this opening.`
        : "No explicit learning gaps detected from the current JD."
  };
}

module.exports = { createLearningPlan };
