function jobFingerprint(job) {
  const url = String(job.url || "").trim().toLowerCase();
  if (url) {
    return `url:${url}`;
  }

  return `title:${String(job.title || "").trim().toLowerCase()}|company:${String(job.company || "").trim().toLowerCase()}`;
}

function dedupeJobs(jobs) {
  const seen = new Map();
  const result = [];

  for (const job of jobs || []) {
    const key = jobFingerprint(job);
    const prior = seen.get(key);

    if (!prior) {
      seen.set(key, job);
      result.push(job);
      continue;
    }

    const priorDate = new Date(prior.scrapedAt || prior.foundAt || 0).getTime();
    const nextDate = new Date(job.scrapedAt || job.foundAt || 0).getTime();
    if (nextDate >= priorDate) {
      const index = result.indexOf(prior);
      if (index >= 0) {
        result[index] = { ...prior, ...job, seenCount: (prior.seenCount || 1) + 1 };
      }
      seen.set(key, result[index]);
    } else {
      prior.seenCount = (prior.seenCount || 1) + 1;
      prior.staleCandidate = true;
    }
  }

  return result.map((job) => ({
    ...job,
    staleCandidate: Boolean(job.staleCandidate || (job.seenCount || 0) > 2)
  }));
}

function compareRuns(runA, runB) {
  const jobsA = runA?.jobs || [];
  const jobsB = runB?.jobs || [];
  const mapA = new Map(jobsA.map((job) => [jobFingerprint(job), job]));
  const mapB = new Map(jobsB.map((job) => [jobFingerprint(job), job]));

  const added = [];
  const removed = [];
  const shared = [];

  for (const [key, job] of mapB.entries()) {
    if (mapA.has(key)) {
      shared.push({ key, jobA: mapA.get(key), jobB: job });
    } else {
      added.push(job);
    }
  }

  for (const [key, job] of mapA.entries()) {
    if (!mapB.has(key)) {
      removed.push(job);
    }
  }

  return {
    runAId: runA?.runId || null,
    runBId: runB?.runId || null,
    added,
    removed,
    shared,
    summary: {
      added: added.length,
      removed: removed.length,
      shared: shared.length
    }
  };
}

module.exports = { jobFingerprint, dedupeJobs, compareRuns };
