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

const rootDir = path.resolve(__dirname, "..", "..");
const publicDir = path.join(__dirname, "public");
const configPath = path.join(rootDir, "src", "config.json");
const outputDir = path.join(rootDir, "data", "output");
const uiDataDir = path.join(rootDir, "data", "ui");
const uploadsDir = path.join(uiDataDir, "uploads");
const runLogsDir = path.join(uiDataDir, "run-logs");
const runHistoryPath = path.join(uiDataDir, "run-history.json");
const port = Number(process.env.JOB_AGENT_UI_PORT || 3030);
const host = process.env.JOB_AGENT_UI_HOST || "127.0.0.1";

const pipelineDefinitions = PIPELINE_DEFINITIONS;
const agentStageMap = AGENT_STAGE_MAP;

let activeRun = null;

ensureUiDataDirs();

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

function appendRunLog(run, text) {
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
  return {
    report: loadArtifact(artifactPathForRun("agent-report", runId)),
    gmail: loadArtifact(artifactPathForRun("gmail-cleanup-report", runId)),
    shortlist: loadArtifact(artifactPathForRun("shortlist", runId)),
    jobs: loadArtifact(artifactPathForRun("jobs", runId)),
    tailored: loadArtifact(artifactPathForRun("tailored-resumes", runId)),
    prep: loadArtifact(artifactPathForRun("prep-tasks", runId)),
    nextRole: loadArtifact(artifactPathForRun("next-role-strategy", runId)),
    transition: loadArtifact(artifactPathForRun("career-transition-strategy", runId))
  };
}

function summarizeArtifacts(mode, artifacts) {
  if (mode === "gmail-cleanup") {
    const report = artifacts.gmail?.data || {};
    return {
      action: report.action || "preview",
      totalMatched: report.totalMatched ?? 0,
      query: report.query || ""
    };
  }

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
      pipeline: []
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
    logPath: activeRun.logPath || null
  };
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".txt" || ext === ".md" || ext === ".log") return "text/plain; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function serveStatic(req, res, pathname = "/") {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const localPath = path.normalize(path.join(publicDir, requestPath));

  if (!localPath.startsWith(publicDir) || !fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  sendText(res, 200, fs.readFileSync(localPath), mimeType(localPath));
}

function startRun({ portal, mode, headed, gmailAction, gmailQuery, gmailMaxMessages }) {
  if (activeRun && activeRun.status === "running") {
    return activeRun;
  }

  const runId = buildRunId();
  const nodeExecutable = process.execPath;
  const pipeline = createPipeline(mode);
  const logPath = path.join(runLogsDir, `${runId}.log`);

  activeRun = {
    runId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    portal,
    mode,
    headed,
    pipeline,
    currentStageId: null,
    partialLog: "",
    logText: "",
    logPath,
    logStream: fs.createWriteStream(logPath, { flags: "a" })
  };

  if (mode === "gmail-cleanup") {
    movePipelineToStage(activeRun, "gmail", "gmail-cleanup-agent");
  }

  if (mode === "demo") {
    movePipelineToStage(activeRun, "research", "demo-agent");
  }

  upsertRunHistory(createHistoryEntryFromRun(activeRun));

  const child = spawn(nodeExecutable, [path.join(rootDir, "src", "index.js")], {
    cwd: rootDir,
    env: {
      ...process.env,
      JOB_AGENT_PORTAL: portal,
      JOB_AGENT_MODE: mode,
      JOB_AGENT_HEADED: headed ? "true" : "false",
      JOB_AGENT_RUN_ID: runId,
      JOB_AGENT_GMAIL_ACTION: gmailAction || "",
      JOB_AGENT_GMAIL_QUERY: gmailQuery || "",
      JOB_AGENT_GMAIL_MAX_MESSAGES: gmailMaxMessages ? String(gmailMaxMessages) : ""
    },
    windowsHide: false
  });

  activeRun.process = child;

  child.stdout.on("data", (chunk) => {
    appendRunLog(activeRun, chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk) => {
    appendRunLog(activeRun, chunk.toString("utf8"));
  });

  child.on("exit", (code) => {
    if (activeRun?.partialLog) {
      appendRunLog(activeRun, "\n");
    }

    activeRun.status = code === 0 ? "completed" : "failed";
    activeRun.exitCode = code;
    activeRun.finishedAt = new Date().toISOString();
    finalizePipeline(activeRun, activeRun.status);

    const artifacts = collectArtifactsForRun(runId);
    const summary = summarizeArtifacts(mode, artifacts);
    activeRun.summary = summary;
    activeRun.artifacts = Object.fromEntries(
      Object.entries(artifacts).map(([key, value]) => [key, value ? value.fileName : null])
    );

    if (activeRun.logStream) {
      activeRun.logStream.end();
    }

    upsertRunHistory(
      createHistoryEntryFromRun(activeRun, {
        summary,
        artifacts: activeRun.artifacts
      })
    );
  });

  return activeRun;
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
        gmail: null,
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
    const csv = shortlistToCsv(shortlist);
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
   const run = startRun({
      portal: parsed.portal || "both",
      mode: parsed.mode || "search",
      headed: !!parsed.headed,
      gmailAction: parsed.gmailAction || "preview",
      gmailQuery: parsed.gmailQuery || "",
      gmailMaxMessages: parsed.gmailMaxMessages || 0
    });

    sendJson(res, 200, {
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt
    });
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
