const fs = require("fs");
const path = require("path");

const TRACKER_STATES = ["saved", "drafted", "applied", "interview", "offer", "rejected"];

function trackerPath(rootDir) {
  return path.join(rootDir, "data", "tracker.json");
}

function readTracker(rootDir) {
  const filePath = trackerPath(rootDir);
  if (!fs.existsSync(filePath)) {
    return { jobs: {}, updatedAt: null };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      jobs: parsed.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {},
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return { jobs: {}, updatedAt: null };
  }
}

function writeTracker(rootDir, tracker) {
  const filePath = trackerPath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    jobs: tracker.jobs || {},
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function upsertTrackerJob(rootDir, jobKey, patch) {
  const tracker = readTracker(rootDir);
  const existing = tracker.jobs[jobKey] || {};
  const nextState = patch.state && TRACKER_STATES.includes(patch.state) ? patch.state : existing.state || "saved";

  tracker.jobs[jobKey] = {
    ...existing,
    ...patch,
    state: nextState,
    updatedAt: new Date().toISOString(),
    jobId: jobKey,
    title: patch.title ?? existing.title ?? null,
    company: patch.company ?? existing.company ?? null,
    url: patch.url ?? existing.url ?? null,
    runId: patch.runId ?? existing.runId ?? null
  };

  return writeTracker(rootDir, tracker);
}

function getTrackerSummary(rootDir) {
  const tracker = readTracker(rootDir);
  const counts = TRACKER_STATES.reduce((acc, state) => {
    acc[state] = 0;
    return acc;
  }, {});

  for (const entry of Object.values(tracker.jobs)) {
    if (counts[entry.state] !== undefined) {
      counts[entry.state] += 1;
    }
  }

  return {
    total: Object.keys(tracker.jobs).length,
    counts,
    updatedAt: tracker.updatedAt
  };
}

function buildWeeklySummary(rootDir, history) {
  const tracker = readTracker(rootDir);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRuns = (history || []).filter((entry) => new Date(entry.startedAt).getTime() >= weekAgo);
  const applied = Object.values(tracker.jobs).filter((entry) =>
    ["applied", "interview", "offer"].includes(entry.state)
  ).length;
  const interviews = Object.values(tracker.jobs).filter((entry) =>
    ["interview", "offer"].includes(entry.state)
  ).length;
  const jobsFound = recentRuns.reduce((sum, entry) => sum + (entry.summary?.jobsFound || 0), 0);

  return {
    runsThisWeek: recentRuns.length,
    jobsFound,
    applied,
    interviews,
    rejections: Object.values(tracker.jobs).filter((entry) => entry.state === "rejected").length
  };
}

module.exports = {
  TRACKER_STATES,
  readTracker,
  writeTracker,
  upsertTrackerJob,
  getTrackerSummary,
  buildWeeklySummary
};
