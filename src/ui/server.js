const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");
const { parseResumeUpload, writeUploadedResume } = require("../lib/resume-upload");
const { buildLabelSuggestions } = require("../lib/label-suggestions");
const { AGENT_STAGE_MAP, PIPELINE_DEFINITIONS } = require("../lib/agent-stages");
const { getSetupStatus } = require("../lib/setup-status");
const { shortlistToCsv } = require("../lib/export-csv");
const { testLlmConnection } = require("../lib/llm");
const {
  completeWizardStep,
  acknowledgePortalTerms,
  dismissWizard,
  readWizardState,
  writeWizardState
} = require("../lib/wizard-state");
const { readTracker, writeTracker, upsertTrackerJob, buildWeeklySummary } = require("../lib/tracker");
const { buildResumeDiff } = require("../lib/resume-diff");
const { compareRuns } = require("../lib/job-dedupe");
const { buildExportBundle, importExportBundle } = require("../lib/bundle-export");
const { checkPortalHealth } = require("../lib/portal-health");
const { deleteCheckpoint, loadCheckpoint } = require("../lib/run-checkpoint");

const rootDir = path.resolve(__dirname, "..", "..");
const publicDir = path.join(__dirname, "public");
const configPath = path.join(rootDir, "src", "config.json");
const outputDir = path.join(rootDir, "data", "output");
const uiDataDir = path.join(rootDir, "data", "ui");
const uploadsDir = path.join(uiDataDir, "uploads");
const runLogsDir = path.join(uiDataDir, "run-logs");
const runHistoryPath = path.join(uiDataDir, "run-history.json");
const activeRunPath = path.join(uiDataDir, "active-run.json");
const port = Number(process.env.JOB_AGENT_UI_PORT || 3030);
const host = process.env.JOB_AGENT_UI_HOST || "127.0.0.1";

const pipelineDefinitions = PIPELINE_DEFINITIONS;
const agentStageMap = AGENT_STAGE_MAP;

let activeRun = null;
let recoverableRun = null;

ensureUiDataDirs();
reconcileRunsOnStartup();

function ensureUiDataDirs() {
  fs.mkdirSync(uiDataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(runLogsDir, { recursive: true });
  if (!fs.existsSync(runHistoryPath)) {
    fs.writeFileSync(runHistoryPath, JSON.stringify([], null, 2), "utf8");
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(text);
}

function sendFile(res, statusCode, filePath) {
  res.writeHead(statusCode, { "Content-Type": mimeType(filePath) });
  res.end(fs.readFileSync(filePath));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function isProcessAlive(pid) {
  if (!pid || Number.isNaN(Number(pid))) {
    return false;
  }

  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function serializeActiveRunSnapshot(run) {
  if (!run) {
    return null;
  }

  return {
    runId: run.runId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
    portal: run.portal,
    mode: run.mode,
    headed: run.headed,
    pipeline: clonePipeline(run.pipeline),
    currentStageId: run.currentStageId || null,
    logPath: run.logPath || null,
    logOffset: run.logOffset || 0,
    pid: run.process?.pid || run.pid || null,
    exitCode: run.exitCode ?? null,
    summary: run.summary || null,
    artifacts: run.artifacts || null
  };
}

function persistActiveRunSnapshot(run = activeRun) {
  if (!run) {
    if (fs.existsSync(activeRunPath)) {
      fs.unlinkSync(activeRunPath);
    }
    return;
  }

  writeJsonFile(activeRunPath, serializeActiveRunSnapshot(run));
}

function markHistoryRunStatus(runId, status, extra = {}) {
  const historyEntry = findRunHistory(runId);
  if (!historyEntry) {
    return null;
  }

  const nextEntry = {
    ...historyEntry,
    status,
    finishedAt: extra.finishedAt ?? historyEntry.finishedAt ?? new Date().toISOString(),
    exitCode: extra.exitCode ?? historyEntry.exitCode ?? null,
    pipeline: extra.pipeline ? clonePipeline(extra.pipeline) : historyEntry.pipeline,
    canResume: extra.canResume ?? historyEntry.canResume ?? false
  };
  upsertRunHistory(nextEntry);
  return nextEntry;
}

function markPipelineFromCheckpoint(pipeline, checkpoint) {
  if (!checkpoint?.completedAgents?.length) {
    return;
  }

  const run = { pipeline };

  for (const agentName of checkpoint.completedAgents) {
    const stageId = agentStageMap[agentName];
    if (!stageId) {
      continue;
    }

    const stage = pipeline.find((item) => item.id === stageId);
    if (!stage) {
      continue;
    }

    updateStageState(run, stageId, "success");
    stage.agentName = agentName;
    stage.summary = summarizeStageThought(stage);
  }
}

function inferRunOutcomeFromLog(logText) {
  const text = String(logText || "");
  if (/fatal error/i.test(text)) {
    return { status: "failed", exitCode: 1 };
  }

  if (/Run .+ completed successfully\./i.test(text) || /Saved jobs to/i.test(text) || /Saved next-role strategy to/i.test(text) || /Saved career-transition strategy to/i.test(text)) {
    return { status: "completed", exitCode: 0 };
  }

  return { status: "interrupted", exitCode: null };
}

function finalizeDetachedRun(run) {
  stopLogTail(run);

  const logText = fs.existsSync(run.logPath) ? fs.readFileSync(run.logPath, "utf8") : run.logText || "";
  run.logText = logText.slice(-250000);
  const outcome = inferRunOutcomeFromLog(logText);
  run.status = outcome.status;
  run.exitCode = outcome.exitCode;
  run.finishedAt = new Date().toISOString();
  finalizePipeline(run, outcome.status === "completed" ? "completed" : "failed");

  const artifacts = collectArtifactsForRun(run.runId);
  const summary = summarizeArtifacts(run.mode, artifacts);
  run.summary = summary;
  run.artifacts = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value ? value.fileName : null]));

  upsertRunHistory(
    createHistoryEntryFromRun(run, {
      summary,
      artifacts: run.artifacts
    })
  );

  if (outcome.status === "interrupted" && loadCheckpoint(rootDir, run.runId)) {
    recoverableRun = {
      runId: run.runId,
      mode: run.mode,
      portal: run.portal,
      headed: run.headed,
      startedAt: run.startedAt,
      canResume: true
    };
  }

  activeRun = null;
  persistActiveRunSnapshot(null);
}

function stopLogTail(run) {
  if (run?.logTailTimer) {
    clearInterval(run.logTailTimer);
    run.logTailTimer = null;
  }
}

function startLogTail(run) {
  if (run.logTailTimer || !run.logPath) {
    return;
  }

  if (fs.existsSync(run.logPath)) {
    run.logOffset = fs.statSync(run.logPath).size;
  } else {
    run.logOffset = 0;
  }

  run.logTailTimer = setInterval(() => {
    if (!activeRun || activeRun.runId !== run.runId) {
      stopLogTail(run);
      return;
    }

    if (run.pid && !isProcessAlive(run.pid)) {
      finalizeDetachedRun(run);
      return;
    }

    if (!fs.existsSync(run.logPath)) {
      return;
    }

    const stat = fs.statSync(run.logPath);
    if (stat.size <= run.logOffset) {
      return;
    }

    const length = stat.size - run.logOffset;
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(run.logPath, "r");
    fs.readSync(fd, buffer, 0, length, run.logOffset);
    fs.closeSync(fd);
    run.logOffset = stat.size;
    appendRunLog(run, buffer.toString("utf8"), { skipPersist: false });
  }, 1000);
}

function attachChildHandlers(run, child) {
  run.process = child;
  run.pid = child.pid;

  child.stdout.on("data", (chunk) => {
    appendRunLog(run, chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk) => {
    appendRunLog(run, chunk.toString("utf8"));
  });

  child.on("exit", (code) => {
    stopLogTail(run);

    if (activeRun?.runId !== run.runId) {
      return;
    }

    if (activeRun?.partialLog) {
      appendRunLog(activeRun, "\n");
    }

    activeRun.status = code === 0 ? "completed" : "failed";
    activeRun.exitCode = code;
    activeRun.finishedAt = new Date().toISOString();
    finalizePipeline(activeRun, activeRun.status);

    const artifacts = collectArtifactsForRun(run.runId);
    const summary = summarizeArtifacts(run.mode, artifacts);
    activeRun.summary = summary;
    activeRun.artifacts = Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value ? value.fileName : null]));

    if (activeRun.logStream) {
      activeRun.logStream.end();
      activeRun.logStream = null;
    }

    upsertRunHistory(
      createHistoryEntryFromRun(activeRun, {
        summary,
        artifacts: activeRun.artifacts
      })
    );

    deleteCheckpoint(rootDir, run.runId);
    recoverableRun = null;
    activeRun = null;
    persistActiveRunSnapshot(null);
  });

  persistActiveRunSnapshot(run);
}

function reattachActiveRun(snapshot) {
  const logPath = snapshot.logPath || path.join(runLogsDir, `${snapshot.runId}.log`);
  activeRun = {
    runId: snapshot.runId,
    status: "running",
    startedAt: snapshot.startedAt,
    finishedAt: null,
    portal: snapshot.portal,
    mode: snapshot.mode,
    headed: snapshot.headed,
    pipeline: clonePipeline(snapshot.pipeline || createPipeline(snapshot.mode)),
    currentStageId: snapshot.currentStageId || null,
    partialLog: "",
    logText: fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-250000) : "",
    logPath,
    logStream: null,
    pid: snapshot.pid,
    logOffset: snapshot.logOffset || 0
  };

  if (fs.existsSync(logPath)) {
    appendRunLog(activeRun, "", { skipPersist: true });
  }

  startLogTail(activeRun);
  persistActiveRunSnapshot(activeRun);
  recoverableRun = null;
}

function markInterruptedRun(snapshot, checkpoint) {
  const pipeline = clonePipeline(snapshot.pipeline || createPipeline(snapshot.mode));
  markPipelineFromCheckpoint(pipeline, checkpoint);
  finalizePipeline({ pipeline, currentStageId: snapshot.currentStageId }, "failed");

  const interruptedEntry = markHistoryRunStatus(snapshot.runId, "interrupted", {
    pipeline,
    finishedAt: new Date().toISOString(),
    exitCode: null,
    canResume: Boolean(checkpoint)
  });

  recoverableRun = interruptedEntry
    ? {
        runId: interruptedEntry.runId,
        mode: interruptedEntry.mode,
        portal: interruptedEntry.portal,
        headed: interruptedEntry.headed,
        startedAt: interruptedEntry.startedAt,
        canResume: Boolean(checkpoint)
      }
    : null;
}

function reconcileRunsOnStartup() {
  recoverableRun = null;
  const snapshot = readJsonFile(activeRunPath, null);

  if (snapshot?.status === "running") {
    if (snapshot.pid && isProcessAlive(snapshot.pid)) {
      reattachActiveRun(snapshot);
      return;
    }

    const checkpoint = loadCheckpoint(rootDir, snapshot.runId);
    markInterruptedRun(snapshot, checkpoint);
    persistActiveRunSnapshot(null);
  }

  const history = readRunHistory();
  for (const entry of history) {
    if (entry.status !== "running") {
      continue;
    }

    const checkpoint = loadCheckpoint(rootDir, entry.runId);
    markHistoryRunStatus(entry.runId, "interrupted", {
      finishedAt: new Date().toISOString(),
      exitCode: null,
      canResume: Boolean(checkpoint)
    });

    if (!recoverableRun && checkpoint) {
      recoverableRun = {
        runId: entry.runId,
        mode: entry.mode,
        portal: entry.portal,
        headed: entry.headed,
        startedAt: entry.startedAt,
        canResume: true
      };
    }
  }
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function writeConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function normalizeRunId(value) {
  return String(value || "").replace(/[^0-9TZ-]/g, "");
}

function buildRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function createPipeline(mode) {
  const definition = pipelineDefinitions[mode] || pipelineDefinitions.search;
  return definition.map(([id, label]) => ({
    id,
    label,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    agentName: null,
    thoughtLines: [],
    summary: "Waiting to start."
  }));
}

function clonePipeline(pipeline) {
  return (pipeline || []).map((stage) => ({
    ...stage,
    thoughtLines: [...(stage.thoughtLines || [])]
  }));
}

function sanitizeLogLine(line) {
  return String(line || "")
    .replace(/^\[[^\]]+\]\s*/g, "")
    .trim();
}

function truncateThoughtLines(lines, maxLines = 40) {
  return (lines || []).slice(-maxLines);
}

function summarizeStageThought(stage) {
  const lines = stage.thoughtLines || [];

  if (stage.id === "research") {
    const queries = lines
      .map((line) => line.match(/Searching (LinkedIn|Naukri) for "(.+)"/i))
      .filter(Boolean);
    const counts = lines
      .map((line) => line.match(/Collected (\d+) (LinkedIn|Naukri) jobs\./i))
      .filter(Boolean)
      .map((match) => `${match[1]} ${match[2]}`);

    if (queries.length || counts.length) {
      return `Ran ${queries.length || 0} search intents and collected ${counts.join(" + ") || "candidate openings"}.`;
    }
  }

  if (stage.id === "business") {
    const companies = [
      ...new Set(
        lines
          .map((line) => line.match(/Researching business stability for (.+)$/i)?.[1]?.trim())
          .filter(Boolean)
      )
    ];

    if (companies.length) {
      return `Researched ${companies.length} orgs including ${companies.slice(0, 3).join(", ")}.`;
    }
  }

  if (stage.id === "salary") {
    return "Reviewed compensation quality and estimated market ranges for extracted roles.";
  }

  if (stage.id === "comparison") {
    return "Scored fit, location eligibility, and overall bet strength across the extracted jobs.";
  }

  if (stage.id === "resume") {
    return "Tailored ATS-ready resumes for the strongest shortlisted roles.";
  }

  if (stage.id === "prep") {
    return "Generated study priorities and interview-prep tasks from the strongest openings.";
  }

  if (stage.id === "routing") {
    return "Classified application routes and prepared route-specific application artifacts.";
  }

  if (stage.id === "apply") {
    return "Prepared assisted apply execution for jobs that passed the earlier stages.";
  }

  if (stage.id === "role") {
    return "Projected stronger next-role paths based on demand, fit, and compensation upside.";
  }

  if (stage.id === "gap") {
    return "Mapped the highest-priority skill gaps against current market demand.";
  }

  if (stage.id === "learning") {
    return "Built learning paths and recommended courses for the selected goal.";
  }

  if (stage.id === "opportunity") {
    return "Ranked live opportunities and target companies for the selected path.";
  }

  if (stage.id === "compensation") {
    return "Benchmarked realistic compensation ranges and fair increment guidance.";
  }

  if (stage.id === "transition") {
    return "Mapped the initial transition path from source domain to target domain.";
  }

  if (stage.id === "bridge") {
    return "Identified transferable strengths and bridge-role routes for the career move.";
  }

  if (lines.length) {
    return lines[lines.length - 1];
  }

  return stage.status === "pending" ? "Waiting to start." : "Stage completed.";
}

function finalizeStage(stage, nextStatus) {
  if (!stage) {
    return;
  }

  stage.status = nextStatus;
  if (!stage.finishedAt) {
    stage.finishedAt = new Date().toISOString();
  }
  stage.thoughtLines = truncateThoughtLines(stage.thoughtLines);
  stage.summary = summarizeStageThought(stage);
}

function appendThoughtToStage(stage, rawLine) {
  if (!stage) {
    return;
  }

  const line = sanitizeLogLine(rawLine);
  if (!line) {
    return;
  }

  stage.thoughtLines = truncateThoughtLines([...(stage.thoughtLines || []), line]);
  if (stage.status === "running") {
    stage.summary = summarizeStageThought(stage);
  }
}

function updateStageState(run, stageId, nextStatus) {
  const stage = (run.pipeline || []).find((item) => item.id === stageId);
  if (!stage) {
    return;
  }

  if (nextStatus === "running" && stage.status === "pending") {
    stage.startedAt = new Date().toISOString();
  }

  if ((nextStatus === "success" || nextStatus === "failed" || nextStatus === "skipped") && !stage.finishedAt) {
    stage.finishedAt = new Date().toISOString();
  }

  stage.status = nextStatus;
  if (nextStatus === "running" && !stage.summary) {
    stage.summary = "Stage in progress.";
  }
}

function movePipelineToStage(run, stageId, agentName = null) {
  if (!stageId) {
    return;
  }

  if (run.currentStageId && run.currentStageId !== stageId) {
    const previousStage = run.pipeline.find((item) => item.id === run.currentStageId);
    if (previousStage && previousStage.status === "running") {
      finalizeStage(previousStage, "success");
    }
  }

  const nextStage = run.pipeline.find((item) => item.id === stageId);
  if (nextStage) {
    nextStage.agentName = agentName || nextStage.agentName || null;
    if (nextStage.status === "pending") {
      updateStageState(run, stageId, "running");
      nextStage.summary = "Stage in progress.";
    }
  }

  run.currentStageId = stageId;
  upsertRunHistory(createHistoryEntryFromRun(run));
  persistActiveRunSnapshot(run);
}

function finalizePipeline(run, finalStatus) {
  if (run.currentStageId) {
    const currentStage = run.pipeline.find((item) => item.id === run.currentStageId);
    if (currentStage && currentStage.status === "running") {
      finalizeStage(currentStage, finalStatus === "completed" ? "success" : "failed");
    }
  }

  if (finalStatus === "completed") {
    for (const stage of run.pipeline) {
      if (stage.status === "pending" || stage.status === "running") {
        finalizeStage(stage, "success");
      }
    }
    return;
  }

  if (finalStatus !== "completed") {
    for (const stage of run.pipeline) {
      if (stage.status === "pending") {
        updateStageState(run, stage.id, "skipped");
        stage.summary = "Skipped because an earlier stage failed or the run stopped.";
      }
    }
  }
}

function appendRunLog(run, text, options = {}) {
  run.logText = `${run.logText || ""}${text}`.slice(-250000);
  if (run.logStream) {
    run.logStream.write(text);
  }

  const combined = `${run.partialLog || ""}${text}`;
  const lines = combined.split(/\r?\n/);
  run.partialLog = lines.pop() || "";

  for (const line of lines) {
    const delegated = line.match(/delegated work to ([a-z-]+)\./i);
    if (delegated) {
      movePipelineToStage(run, agentStageMap[delegated[1]], delegated[1]);
    }

    const currentStage = run.currentStageId
      ? run.pipeline.find((item) => item.id === run.currentStageId)
      : null;
    appendThoughtToStage(currentStage, line);

    if (/fatal error/i.test(line)) {
      finalizePipeline(run, "failed");
    }
  }

  if (!options.skipPersist) {
    persistActiveRunSnapshot(run);
  }
}

function readRunHistory() {
  return readJsonFile(runHistoryPath, []);
}

function writeRunHistory(history) {
  writeJsonFile(runHistoryPath, history);
}

function upsertRunHistory(entry) {
  const history = readRunHistory();
  const nextHistory = history.filter((item) => item.runId !== entry.runId);
  nextHistory.unshift(entry);
  nextHistory.sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
  writeRunHistory(nextHistory.slice(0, 60));
}

function findRunHistory(runId) {
  return readRunHistory().find((item) => item.runId === runId) || null;
}

function artifactPathForRun(prefix, runId) {
  return path.join(outputDir, `${prefix}-${runId}.json`);
}

function loadArtifact(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    fileName: path.basename(filePath),
    fullPath: filePath,
    data: readJsonFile(filePath, null)
  };
}

function collectArtifactsForRun(runId) {
  const emailDrafts = loadEmailDraftsForRun(runId);
  return {
    report: loadArtifact(artifactPathForRun("agent-report", runId)),
    shortlist: loadArtifact(artifactPathForRun("shortlist", runId)),
    jobs: loadArtifact(artifactPathForRun("jobs", runId)),
    tailored: loadArtifact(artifactPathForRun("tailored-resumes", runId)),
    prep: loadArtifact(artifactPathForRun("prep-tasks", runId)),
    nextRole: loadArtifact(artifactPathForRun("next-role-strategy", runId)),
    transition: loadArtifact(artifactPathForRun("career-transition-strategy", runId)),
    emailDrafts
  };
}

function loadEmailDraftsForRun(runId) {
  const draftsDir = path.join(outputDir, "email-drafts");
  if (!fs.existsSync(draftsDir)) {
    return { data: [], fullPath: draftsDir };
  }

  const files = fs.readdirSync(draftsDir).filter((name) => name.endsWith(".json"));
  const drafts = [];

  for (const fileName of files) {
    const filePath = path.join(draftsDir, fileName);
    const loaded = loadArtifact(filePath);
    if (loaded?.data) {
      drafts.push(loaded.data);
    }
  }

  return {
    data: drafts,
    fullPath: draftsDir,
    runId
  };
}

function summarizeArtifacts(mode, artifacts) {
  if (mode === "next-role") {
    return artifacts.nextRole?.data?.summary || null;
  }

  if (mode === "career-transition") {
    return artifacts.transition?.data?.summary || null;
  }

  return artifacts.report?.data?.parent?.summary || null;
}

function createHistoryEntryFromRun(run, extra = {}) {
  return {
    runId: run.runId,
    status: run.status,
    mode: run.mode,
    portal: run.portal,
    headed: run.headed,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
    exitCode: run.exitCode ?? null,
    pipeline: clonePipeline(run.pipeline),
    logPath: run.logPath,
    summary: extra.summary || null,
    artifacts: extra.artifacts || null
  };
}

function listRunHistory() {
  const history = readRunHistory();
  if (activeRun && activeRun.runId) {
    const activeEntry = createHistoryEntryFromRun(activeRun, {
      summary: activeRun.summary || null,
      artifacts: activeRun.artifacts || null
    });
    return [activeEntry, ...history.filter((item) => item.runId !== activeRun.runId)];
  }
  return history;
}

function collectUpskilledCategories() {
  const history = readRunHistory();
  const counts = new Map();

  for (const entry of history) {
    if (!["next-role", "career-transition"].includes(entry.mode)) {
      continue;
    }

    const artifacts = collectArtifactsForRun(entry.runId);
    const labels = [
      ...(artifacts.nextRole?.data?.learningPlan || []).map((item) => item.skill),
      ...(artifacts.transition?.data?.learningPlan || []).map((item) => item.skill)
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    for (const label of labels) {
      const key = label.toLowerCase();
      const current = counts.get(key) || {
        label,
        count: 0,
        sources: new Set(),
        lastRunId: entry.runId,
        lastStartedAt: entry.startedAt
      };
      current.count += 1;
      current.sources.add(entry.mode);

      if (String(entry.startedAt || "").localeCompare(String(current.lastStartedAt || "")) > 0) {
        current.lastRunId = entry.runId;
        current.lastStartedAt = entry.startedAt;
      }

      counts.set(key, current);
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || String(b.lastStartedAt || "").localeCompare(String(a.lastStartedAt || "")))
    .map((item) => ({
      label: item.label,
      count: item.count,
      sources: [...item.sources],
      lastRunId: item.lastRunId,
      lastStartedAt: item.lastStartedAt
    }))
    .slice(0, 20);
}

function readRunLog(runId) {
  const filePath = path.join(runLogsDir, `${runId}.log`);
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function serializeStatus() {
  if (!activeRun) {
    return {
      status: "idle",
      logPath: null,
      pipeline: [],
      recoverable: recoverableRun
    };
  }

  return {
    runId: activeRun.runId,
    status: activeRun.status,
    startedAt: activeRun.startedAt,
    finishedAt: activeRun.finishedAt || null,
    portal: activeRun.portal,
    mode: activeRun.mode,
    headed: activeRun.headed,
    pipeline: clonePipeline(activeRun.pipeline),
    logPath: activeRun.logPath || null,
    recoverable: recoverableRun
  };
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".txt" || ext === ".md" || ext === ".log") return "text/plain; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function resolvePublicFile(pathname = "/") {
  const relativePath = decodeURIComponent(String(pathname || "/"))
    .replace(/^\/+/, "")
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const safeRelative = relativePath || "index.html";
  const localPath = path.resolve(publicDir, safeRelative);
  const publicRoot = path.resolve(publicDir);

  if (localPath !== publicRoot && !localPath.startsWith(`${publicRoot}${path.sep}`)) {
    return null;
  }

  if (!fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
    return null;
  }

  return localPath;
}

function serveStatic(req, res, pathname = "/") {
  const localPath = resolvePublicFile(pathname === "/" ? "/index.html" : pathname);

  if (!localPath) {
    sendText(res, 404, "Not found");
    return;
  }

  sendFile(res, 200, localPath);
}

function spawnRunProcess(run, { resume = false } = {}) {
  const nodeExecutable = process.execPath;
  const env = {
    ...process.env,
    JOB_AGENT_PORTAL: run.portal,
    JOB_AGENT_MODE: run.mode,
    JOB_AGENT_HEADED: run.headed ? "true" : "false",
    JOB_AGENT_RUN_ID: run.runId
  };

  if (resume) {
    env.JOB_AGENT_RESUME_RUN_ID = run.runId;
  }

  const child = spawn(nodeExecutable, [path.join(rootDir, "src", "index.js")], {
    cwd: rootDir,
    env,
    windowsHide: false
  });

  attachChildHandlers(run, child);
  return run;
}

function startRun({ portal, mode, headed, resumeRunId = null, replayRunId = null }) {
  if (activeRun && activeRun.status === "running") {
    return activeRun;
  }

  if (resumeRunId) {
    const checkpoint = loadCheckpoint(rootDir, resumeRunId);
    const historyEntry = findRunHistory(resumeRunId);
    if (!checkpoint || !historyEntry) {
      throw new Error("Cannot resume run without a saved checkpoint.");
    }

    const logPath = path.join(runLogsDir, `${resumeRunId}.log`);
    const pipeline = clonePipeline(historyEntry.pipeline || createPipeline(historyEntry.mode));
    markPipelineFromCheckpoint(pipeline, checkpoint);

    activeRun = {
      runId: resumeRunId,
      status: "running",
      startedAt: historyEntry.startedAt,
      finishedAt: null,
      portal: historyEntry.portal,
      mode: historyEntry.mode,
      headed: historyEntry.headed,
      pipeline,
      currentStageId: historyEntry.currentStageId || null,
      partialLog: "",
      logText: fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-250000) : "",
      logPath,
      logStream: fs.createWriteStream(logPath, { flags: "a" })
    };

    activeRun.logStream.write(`\n[meridian-ui] Resuming run ${resumeRunId} from checkpoint after ${checkpoint.completedAgentCount} agents.\n`);
    recoverableRun = null;
    upsertRunHistory(createHistoryEntryFromRun(activeRun));
    persistActiveRunSnapshot(activeRun);
    return spawnRunProcess(activeRun, { resume: true });
  }

  let nextPortal = portal || "both";
  let nextMode = mode || "search";
  let nextHeaded = !!headed;

  if (replayRunId) {
    const historyEntry = findRunHistory(replayRunId);
    if (!historyEntry) {
      throw new Error("Cannot replay unknown run.");
    }

    nextPortal = historyEntry.portal;
    nextMode = historyEntry.mode;
    nextHeaded = !!historyEntry.headed;
  }

  const runId = buildRunId();
  const pipeline = createPipeline(nextMode);
  const logPath = path.join(runLogsDir, `${runId}.log`);

  activeRun = {
    runId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    portal: nextPortal,
    mode: nextMode,
    headed: nextHeaded,
    pipeline,
    currentStageId: null,
    partialLog: "",
    logText: "",
    logPath,
    logStream: fs.createWriteStream(logPath, { flags: "a" })
  };

  if (nextMode === "demo") {
    movePipelineToStage(activeRun, "research", "demo-agent");
  }

  if (replayRunId) {
    activeRun.logStream.write(`[meridian-ui] Replaying run ${replayRunId} as new run ${runId} (${nextMode} on ${nextPortal}).\n`);
  }

  recoverableRun = null;
  upsertRunHistory(createHistoryEntryFromRun(activeRun));
  persistActiveRunSnapshot(activeRun);
  return spawnRunProcess(activeRun);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && requestUrl.pathname === "/api/config") {
    sendJson(res, 200, readConfig());
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/config") {
    const body = await readBody(req);
    const parsed = safeParseJson(body);
    if (!parsed) {
      sendJson(res, 400, { error: "Invalid JSON payload." });
      return;
    }
    writeConfig(parsed);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/resume-upload") {
    const body = await readBody(req);
    const parsed = safeParseJson(body);

    if (!parsed?.fileName || !parsed?.contentBase64) {
      sendJson(res, 400, { error: "Missing resume file payload." });
      return;
    }

    try {
      const uploadedFilePath = writeUploadedResume(parsed.contentBase64, parsed.fileName, uploadsDir);
      const intake = await parseResumeUpload({
        rootDir,
        uploadedFilePath,
        currentConfig: readConfig()
      });

      sendJson(res, 200, {
        ok: true,
        fileName: intake.fileName,
        uploadedFilePath: intake.uploadedFilePath,
        profileDraft: intake.profileDraft,
        configDraft: intake.configDraft,
        masterResumePath: intake.masterResumePath,
        extractedTextPreview: intake.extractedTextPreview,
        detected: intake.detected
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Resume parsing failed." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/run-history") {
    sendJson(res, 200, listRunHistory());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/upskilled-categories") {
    sendJson(res, 200, {
      categories: collectUpskilledCategories(),
      selected: readConfig().profile.upskilledCategories || []
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/label-suggestions") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    const config = parsed.config || readConfig();
    const upskilledCategories = collectUpskilledCategories().map((item) => item.label);

    sendJson(res, 200, {
      suggestions: buildLabelSuggestions(config, {
        upskilledCategories,
        dashboard: parsed.dashboard || "jobs"
      })
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/results") {
    const runId = normalizeRunId(requestUrl.searchParams.get("runId"));

    if (!runId) {
      sendJson(res, 200, {
        runId: null,
        report: null,
        shortlist: null,
        jobs: null,
        tailored: null,
        prep: null,
        nextRole: null
      });
      return;
    }

    sendJson(res, 200, {
      runId,
      ...collectArtifactsForRun(runId)
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/setup-status") {
    sendJson(res, 200, getSetupStatus(rootDir));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/llm/test") {
    const config = readConfig();
    const result = await testLlmConnection(config, {
      warn: (message) => console.warn(`[meridian-ui] ${message}`)
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/export/csv") {
    const runId = normalizeRunId(requestUrl.searchParams.get("runId"));
    if (!runId) {
      sendJson(res, 400, { error: "Missing runId." });
      return;
    }

    const artifacts = collectArtifactsForRun(runId);
    const shortlist = artifacts.shortlist?.data || [];
    const tracker = readTracker(rootDir);
    const csv = shortlistToCsv(shortlist, tracker.jobs);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meridian-shortlist-${runId}.csv"`
    });
    res.end(csv);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/meta") {
    sendJson(res, 200, {
      product: "Meridian",
      tagline: "Align your next move.",
      agentStageMap: AGENT_STAGE_MAP,
      pipelineDefinitions: PIPELINE_DEFINITIONS
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/status") {
    sendJson(res, 200, serializeStatus());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/run-log") {
    const runId = normalizeRunId(requestUrl.searchParams.get("runId"));
    if (!runId) {
      sendJson(res, 400, { error: "Missing runId." });
      return;
    }
    sendText(res, 200, readRunLog(runId));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/run") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    try {
      const run = startRun({
        portal: parsed.portal || "both",
        mode: parsed.mode || "search",
        headed: !!parsed.headed
      });

      sendJson(res, 200, {
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Unable to start run." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/run/resume") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    const runId = normalizeRunId(parsed.runId);
    if (!runId) {
      sendJson(res, 400, { error: "Missing runId." });
      return;
    }

    try {
      const run = startRun({ resumeRunId: runId });
      sendJson(res, 200, {
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        resumed: true
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Unable to resume run." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/run/replay") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    const runId = normalizeRunId(parsed.runId);
    if (!runId) {
      sendJson(res, 400, { error: "Missing runId." });
      return;
    }

    try {
      const run = startRun({ replayRunId: runId });
      sendJson(res, 200, {
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        replayedFrom: runId
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Unable to replay run." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/wizard/complete-step") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    if (!parsed.step) {
      sendJson(res, 400, { error: "Missing wizard step." });
      return;
    }
    completeWizardStep(rootDir, parsed.step);
    sendJson(res, 200, getSetupStatus(rootDir));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/wizard/dismiss") {
    dismissWizard(rootDir);
    sendJson(res, 200, getSetupStatus(rootDir));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/wizard/portal-ack") {
    acknowledgePortalTerms(rootDir);
    sendJson(res, 200, getSetupStatus(rootDir));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/tracker") {
    sendJson(res, 200, readTracker(rootDir));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/tracker") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    if (parsed.jobs && typeof parsed.jobs === "object") {
      sendJson(res, 200, writeTracker(rootDir, parsed));
      return;
    }
    if (!parsed.jobKey) {
      sendJson(res, 400, { error: "Missing jobKey or jobs payload." });
      return;
    }
    sendJson(res, 200, upsertTrackerJob(rootDir, parsed.jobKey, parsed));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/weekly-summary") {
    sendJson(res, 200, buildWeeklySummary(rootDir, listRunHistory()));
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/resume-diff") {
    const tailoredPath = requestUrl.searchParams.get("path");
    sendJson(res, 200, buildResumeDiff(rootDir, tailoredPath));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/runs/compare") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    const runAId = normalizeRunId(parsed.runA);
    const runBId = normalizeRunId(parsed.runB);
    if (!runAId || !runBId) {
      sendJson(res, 400, { error: "Missing runA or runB." });
      return;
    }
    const artifactsA = collectArtifactsForRun(runAId);
    const artifactsB = collectArtifactsForRun(runBId);
    sendJson(
      res,
      200,
      compareRuns(
        { runId: runAId, jobs: artifactsA.shortlist?.data || artifactsA.jobs?.data || [] },
        { runId: runBId, jobs: artifactsB.shortlist?.data || artifactsB.jobs?.data || [] }
      )
    );
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/export/bundle") {
    const bundle = buildExportBundle(rootDir, listRunHistory());
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meridian-export-${new Date().toISOString().slice(0, 10)}.json"`
    });
    res.end(JSON.stringify(bundle, null, 2));
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/import/bundle") {
    const body = await readBody(req);
    const parsed = safeParseJson(body);
    if (!parsed) {
      sendJson(res, 400, { error: "Invalid JSON bundle." });
      return;
    }
    try {
      const result = importExportBundle(rootDir, parsed, {
        writeTracker,
        writeWizardState
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Import failed." });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/outcome/reject") {
    const body = await readBody(req);
    const parsed = safeParseJson(body) || {};
    if (!parsed.jobKey) {
      sendJson(res, 400, { error: "Missing jobKey." });
      return;
    }
    const tracker = upsertTrackerJob(rootDir, parsed.jobKey, {
      state: "rejected",
      rejectReason: parsed.reason || "",
      title: parsed.title,
      company: parsed.company,
      url: parsed.url,
      runId: parsed.runId
    });
    let suggestedAvoidKeyword = null;
    if (parsed.reason && parsed.reason.length >= 3) {
      suggestedAvoidKeyword = String(parsed.reason).trim().slice(0, 80);
    }
    sendJson(res, 200, { tracker, suggestedAvoidKeyword });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/portals/health-check") {
    try {
      const result = await checkPortalHealth({ skipNetwork: false });
      const payload = {
        linkedin: result.linkedin,
        naukri: result.naukri,
        checkedAt: new Date().toISOString(),
        probed: true
      };
      const healthPath = path.join(rootDir, "data", "ui", "portal-health.json");
      fs.mkdirSync(path.dirname(healthPath), { recursive: true });
      fs.writeFileSync(healthPath, JSON.stringify(payload, null, 2), "utf8");
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Portal health check failed." });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/artifact") {
    const requestedPath = requestUrl.searchParams.get("path");

    if (!requestedPath) {
      sendJson(res, 400, { error: "Missing artifact path." });
      return;
    }

    const resolvedPath = path.resolve(requestedPath);
    const allowedRoots = [
      path.join(rootDir, "data"),
      path.join(rootDir, "resume"),
      path.join(rootDir, "src")
    ].map((dir) => path.resolve(dir));

    const isAllowed = allowedRoots.some(
      (allowedRoot) => resolvedPath === allowedRoot || resolvedPath.startsWith(`${allowedRoot}${path.sep}`)
    );

    if (!isAllowed || !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      sendJson(res, 404, { error: "Artifact not found." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeType(resolvedPath),
      "Content-Disposition": `inline; filename="${path.basename(resolvedPath)}"`
    });
    fs.createReadStream(resolvedPath).pipe(res);
    return;
  }

  serveStatic(req, res, requestUrl.pathname);
});

server.listen(port, host, () => {
  console.log(`[meridian-ui] Dashboard available at http://${host}:${port}`);
});
