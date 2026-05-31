const path = require("path");
const { saveJson, timestamp } = require("../lib/runtime");

const DEMO_JOBS = [
  {
    id: "demo-solution-architect-acme",
    portal: "demo",
    title: "Solution Architect",
    company: "Acme Platform",
    location: "Remote",
    url: "https://example.com/jobs/solution-architect",
    description:
      "Design Java microservices, event-driven systems, and cloud-native platforms. Lead architecture reviews and mentor engineers.",
    tags: ["Java", "Microservices", "Architecture"],
    easyApply: true,
    score: 88,
    reason: "Strong fit for architecture and backend platform experience."
  },
  {
    id: "demo-lead-engineer-nimbus",
    portal: "demo",
    title: "Lead Software Engineer",
    company: "Nimbus Systems",
    location: "Pune, Maharashtra, India",
    url: "https://example.com/jobs/lead-engineer",
    description:
      "Own backend services, API design, and delivery for a high-scale SaaS product. Collaborate with product and platform teams.",
    tags: ["Backend", "API", "Leadership"],
    easyApply: false,
    score: 79,
    reason: "Good leadership path with backend depth."
  },
  {
    id: "demo-ai-engineer-orbit",
    portal: "demo",
    title: "AI Application Engineer",
    company: "Orbit Labs",
    location: "Bengaluru, Karnataka, India",
    url: "https://example.com/jobs/ai-engineer",
    description:
      "Build LLM-powered workflows, RAG pipelines, and agent tooling for internal operations products.",
    tags: ["LLM", "RAG", "Agents"],
    easyApply: true,
    score: 84,
    reason: "Matches AI application and agent development interests."
  }
];

async function runDemoParent({ rootDir, config, log, outputDir }) {
  log.info("Demo mode: generating sample jobs and report without portal access.");

  const shortlistedJobs = DEMO_JOBS.filter((job) => job.score >= (config.preferences?.minimumScore || 60));
  const stamp = timestamp();
  const allJobsPath = path.join(outputDir, `jobs-${stamp}.json`);
  const shortlistPath = path.join(outputDir, `shortlist-${stamp}.json`);
  const tailoredPath = path.join(outputDir, `tailored-resumes-${stamp}.json`);
  const reportPath = path.join(outputDir, `agent-report-${stamp}.json`);

  const tailoredResumes = shortlistedJobs.map((job) => ({
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    markdownPath: null,
    textPath: null,
    docxPath: null,
    note: "Demo mode — run a full search with portals enabled to generate tailored files."
  }));

  await saveJson(allJobsPath, DEMO_JOBS);
  await saveJson(shortlistPath, shortlistedJobs);
  await saveJson(tailoredPath, tailoredResumes);
  await saveJson(reportPath, {
    parent: {
      goal: "Demonstrate Meridian dashboard outputs without LinkedIn/Naukri or LLM calls.",
      summary: {
        jobsFound: DEMO_JOBS.length,
        shortlisted: shortlistedJobs.length,
        tailoredResumes: tailoredResumes.length,
        demo: true
      }
    },
    agents: [
      {
        agent: "demo-agent",
        status: "success",
        output: { jobs: DEMO_JOBS, shortlistedJobs }
      }
    ]
  });

  return {
    allJobsPath,
    shortlistPath,
    tailoredPath,
    reportPath,
    summary: {
      jobsFound: DEMO_JOBS.length,
      shortlisted: shortlistedJobs.length,
      demo: true
    }
  };
}

module.exports = { runDemoParent };
