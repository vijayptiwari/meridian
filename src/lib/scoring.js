const { completeJson } = require("./llm");
const { hybridScoreJob } = require("./hybrid-search");

function normalize(text) {
  return String(text || "").toLowerCase();
}

function keywordScore(job, config) {
  const haystack = normalize(
    [job.title, job.company, job.location, job.description, ...(job.tags || [])].join(" ")
  );

  let score = 0;

  for (const skill of config.profile.skills || []) {
    if (haystack.includes(normalize(skill))) {
      score += 8;
    }
  }

  for (const title of config.profile.targetTitles || []) {
    if (haystack.includes(normalize(title))) {
      score += 15;
    }
  }

  for (const location of config.profile.preferredLocations || []) {
    if (haystack.includes(normalize(location))) {
      score += 8;
    }
  }

  for (const avoid of config.profile.avoidKeywords || []) {
    if (haystack.includes(normalize(avoid))) {
      score -= 25;
    }
  }

  if (job.easyApply) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

async function llmScoreJobs(jobs, config, log) {
  return completeJson({
    config,
    systemPrompt:
      "Score each job from 0 to 100 for fit with the candidate profile. Return strict JSON array with id, score, and reason.",
    userPayload: {
      profile: config.profile,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        tags: job.tags,
        portal: job.portal,
        easyApply: job.easyApply
      }))
    },
    log
  });
}

async function scoreJobs(jobs, config, log) {
  if (!jobs.length) {
    return [];
  }

  const llmScores = await llmScoreJobs(jobs, config, log);
  const hybridScores = new Map(
    jobs.map((job) => {
      const hybrid = hybridScoreJob(job, config);
      return [job.id, hybrid];
    })
  );

  if (Array.isArray(llmScores)) {
    const byId = new Map(llmScores.map((item) => [item.id, item]));
    return jobs.map((job) => {
      const scored = byId.get(job.id);
      const hybrid = hybridScores.get(job.id);
      const hybridScore = typeof hybrid?.score === "number" ? hybrid.score : keywordScore(job, config);
      const llmScore = typeof scored?.score === "number" ? scored.score : null;
      const finalScore =
        typeof llmScore === "number"
          ? Math.round(hybridScore * 0.8 + llmScore * 0.2)
          : hybridScore;

      return {
        ...job,
        score: Math.max(0, Math.min(100, finalScore)),
        reason: scored?.reason || hybrid?.reason || "Hybrid JD score.",
        hybridSearch: hybrid
      };
    });
  }

  return jobs.map((job) => ({
    ...job,
    score: hybridScores.get(job.id)?.score ?? keywordScore(job, config),
    reason: hybridScores.get(job.id)?.reason || "Hybrid keyword and preference match score.",
    hybridSearch: hybridScores.get(job.id)
  }));
}

module.exports = { scoreJobs };
