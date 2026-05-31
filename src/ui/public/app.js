const state = {
  config: null,
  polling: null,
  selectedRunId: null,
  selectedResults: null,
  history: [],
  activeStatus: null,
  followActiveRun: false,
  lastHandledCompletionKey: "",
  resumeIntake: null,
  dashboard: "jobs",
  workspacePanelOpen: false,
  upskilledCategories: [],
  gmailResults: null,
  labelStacks: {
    resumeSummary: [],
    skills: [],
    targetTitles: [],
    searchQueries: []
  },
  labelSuggestions: {
    resumeSummary: [],
    skills: [],
    targetTitles: [],
    searchQueries: []
  }
};

const STACK_FIELDS = {
  resumeSummary: {
    type: "summary",
    inputId: "resumeSummaryStackInput",
    stackId: "resumeSummaryStack",
    suggestionId: "resumeSummarySuggestions"
  },
  skills: {
    type: "csv",
    inputId: "skillsStackInput",
    stackId: "skillsStack",
    suggestionId: "skillsSuggestions"
  },
  targetTitles: {
    type: "csv",
    inputId: "targetTitlesStackInput",
    stackId: "targetTitlesStack",
    suggestionId: "targetTitlesSuggestions"
  },
  searchQueries: {
    type: "lines",
    inputId: "searchQueriesStackInput",
    stackId: "searchQueriesStack",
    suggestionId: "searchQueriesSuggestions"
  }
};

const AGENT_STAGE_MAP = {
  "job-research-agent": "research",
  "business-research-agent": "business",
  "salary-upgrade-agent": "salary",
  "jd-comparison-agent": "comparison",
  "resume-modifier-agent": "resume",
  "learning-prep-agent": "prep",
  "email-apply-agent": "routing",
  "linkedin-easy-apply-agent": "apply",
  "naukri-apply-agent": "apply",
  "workday-apply-agent": "apply",
  "next-role-role-agent": "role",
  "next-role-skill-gap-agent": "gap",
  "next-role-learning-agent": "learning",
  "next-role-opportunity-agent": "opportunity",
  "next-role-compensation-agent": "compensation",
  "transition-mapping-agent": "transition",
  "transition-transferable-agent": "bridge",
  "transition-skill-gap-agent": "gap",
  "transition-learning-agent": "learning",
  "transition-opportunity-agent": "opportunity",
  "transition-compensation-agent": "compensation"
};

function byId(id) {
  return document.getElementById(id);
}

function parseCsv(text) {
  return String(text || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSummaryLabels(text) {
  const source = String(text || "").trim();
  const extracted = [];
  const titleMatch = source.match(
    /\b(senior software engineer|senior backend engineer|backend engineer|solution architect|technical architect|platform architect)\b/i
  );
  const experienceMatch = source.match(/(\d+\+?\s*years?)/i);
  const conceptPatterns = [
    ["Backend systems", /\bbackend systems?\b/i],
    ["Telecom domain", /\btelecom domain\b/i],
    ["Distributed systems", /\bdistributed systems?\b/i],
    ["Event-driven architecture", /\bevent[-\s]driven architecture\b/i],
    ["Cloud-native delivery", /\bcloud[-\s]native delivery\b/i],
    ["Release automation", /\brelease automation\b/i],
    ["Production support", /\bproduction support\b/i],
    ["Scalable systems", /\bscalable\b/i],
    ["Maintainable systems", /\bmaintainable\b/i],
    ["Observability", /\bobservable|observability\b/i],
    ["AI-assisted RCA", /\bai-assisted root-cause analysis|ai engineering ai-assisted rca\b/i],
    ["Workflow automation", /\bworkflow automation\b/i],
    ["Anomaly detection", /\banomaly detection\b/i],
    ["Developer productivity tooling", /\bdeveloper productivity tooling\b/i]
  ];

  if (titleMatch) {
    extracted.push(titleMatch[1]);
  }
  if (experienceMatch) {
    extracted.push(`${experienceMatch[1]} experience`);
  }
  for (const [label, pattern] of conceptPatterns) {
    if (pattern.test(source)) {
      extracted.push(label);
    }
  }

  const segmented = String(text || "")
    .split(/[.\n]+/g)
    .flatMap((block) => block.split(/,\s+/g))
    .map((value) =>
      value
        .replace(/^(focused on|strong experience across|strong experience in|experience across|experience in)\s+/i, "")
        .replace(/\bwith\b.+$/i, (match) => (match.length > 40 ? "" : match))
        .trim()
    )
    .filter((value) => value && value.length <= 42);

  return unique([...extracted, ...segmented]).slice(0, 14);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueBy(items, keyGetter) {
  const seen = new Set();
  const results = [];

  for (const item of items || []) {
    const key = keyGetter(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }

  return results;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function setFormValue(id, value) {
  const el = byId(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!value;
  } else {
    el.value = value ?? "";
  }
}

function normalizeStackItems(fieldId, value) {
  if (fieldId === "resumeSummary") {
    return parseSummaryLabels(value);
  }

  if (fieldId === "searchQueries") {
    return unique(parseLines(value));
  }

  return unique(parseCsv(value));
}

function serializeStackItems(fieldId, items) {
  const cleaned = unique((items || []).map((item) => String(item || "").trim()).filter(Boolean));

  if (fieldId === "resumeSummary") {
    return cleaned.length ? `${cleaned.join(". ")}.` : "";
  }

  if (fieldId === "searchQueries") {
    return cleaned.join("\n");
  }

  return cleaned.join(", ");
}

function syncHiddenStackField(fieldId) {
  const hiddenField = byId(fieldId);
  if (!hiddenField) {
    return;
  }

  hiddenField.value = serializeStackItems(fieldId, state.labelStacks[fieldId] || []);
}

function setStackItems(fieldId, items) {
  state.labelStacks[fieldId] = unique((items || []).map((item) => String(item || "").trim()).filter(Boolean));
  syncHiddenStackField(fieldId);
  renderStackField(fieldId);
  renderStackSuggestions(fieldId);
  renderSetupSummary();
}

function addStackItem(fieldId, value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return;
  }

  const nextItems = unique([...(state.labelStacks[fieldId] || []), cleaned]);
  setStackItems(fieldId, nextItems);

  const input = byId(STACK_FIELDS[fieldId]?.inputId);
  if (input) {
    input.value = "";
  }
}

function removeStackItem(fieldId, value) {
  const normalized = normalizeText(value);
  const nextItems = (state.labelStacks[fieldId] || []).filter((item) => normalizeText(item) !== normalized);
  setStackItems(fieldId, nextItems);
}

function renderStackField(fieldId) {
  const meta = STACK_FIELDS[fieldId];
  const container = byId(meta?.stackId);
  if (!container) {
    return;
  }

  const items = state.labelStacks[fieldId] || [];
  if (!items.length) {
    container.innerHTML = `<p class="empty-stack">No labels added yet.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <button
          type="button"
          class="stack-chip"
          data-stack-remove="${fieldId}"
          data-stack-value="${item.replace(/"/g, "&quot;")}"
          title="Remove label"
        >
          <span>${item}</span>
          <span class="stack-chip-remove" aria-hidden="true">+</span>
        </button>
      `
    )
    .join("");
}

function renderStackSuggestions(fieldId) {
  const meta = STACK_FIELDS[fieldId];
  const container = byId(meta?.suggestionId);
  if (!container) {
    return;
  }

  const selected = new Set((state.labelStacks[fieldId] || []).map(normalizeText));
  const suggestions = (state.labelSuggestions[fieldId] || []).filter(
    (item) => !selected.has(normalizeText(item))
  );

  if (!suggestions.length) {
    container.innerHTML = `<p class="empty-stack">No fresh suggestions right now.</p>`;
    return;
  }

  container.innerHTML = suggestions
    .map(
      (item) => `
        <button
          type="button"
          class="stack-suggestion"
          data-stack-add="${fieldId}"
          data-stack-value="${item.replace(/"/g, "&quot;")}"
        >
          ${item}
        </button>
      `
    )
    .join("");
}

function renderAllStackFields() {
  for (const fieldId of Object.keys(STACK_FIELDS)) {
    syncHiddenStackField(fieldId);
    renderStackField(fieldId);
    renderStackSuggestions(fieldId);
  }
}

function populateForm(config) {
  setFormValue("name", config.profile.name);
  setFormValue("currentTitle", config.profile.currentTitle);
  setFormValue("email", config.profile.email);
  setFormValue("phone", config.profile.phone);
  setFormValue("experienceYears", config.profile.experienceYears);
  setFormValue("linkedin", config.profile.linkedin);
  setStackItems("resumeSummary", normalizeStackItems("resumeSummary", config.profile.resumeSummary));
  setStackItems("skills", config.profile.skills || []);
  setStackItems("targetTitles", config.profile.targetTitles || []);
  setStackItems("searchQueries", config.preferences.searchQueries || []);
  setFormValue("avoidKeywords", (config.profile.avoidKeywords || []).join(", "));
  setFormValue("expectedPhysicalLocation", config.locationPolicy?.expectedPhysicalLocation || "");
  setFormValue("minimumScore", config.preferences.minimumScore);
  setFormValue("salaryCurrency", config.salary?.currency || "");
  setFormValue("currentAnnualCompensation", config.salary?.currentAnnualCompensation || "");
  setFormValue("minimumAnnualCompensation", config.salary?.minimumAnnualCompensation || "");
  setFormValue("targetAnnualCompensation", config.salary?.targetAnnualCompensation || "");
  setFormValue("easyApplyOnly", config.preferences.easyApplyOnly);
  setFormValue("currentCareerDomain", config.transition?.currentDomain || "");
  setFormValue("targetCareerDomain", config.transition?.targetDomain || "");
  setFormValue("transitionRoles", (config.transition?.targetRoles || []).join(", "));
  setFormValue("transitionLevel", config.transition?.transitionLevel || "bridge");
  setFormValue("transitionNotes", config.transition?.notes || "");
  setFormValue("gmailEnabled", config.gmail?.enabled);
  setFormValue("gmailCredentialsPath", config.gmail?.credentialsPath || "credentials.json");
  setFormValue("gmailTokenDir", config.gmail?.tokenDir || "data/gmail");
  setFormValue("gmailQuery", config.gmail?.query || "category:promotions OR label:^smartlabel_promo");
  setFormValue("gmailBatchSize", config.gmail?.batchSize || 100);
  setFormValue("gmailMaxMessagesPerRun", config.gmail?.maxMessagesPerRun || 500);
  setFormValue("gmailPreviewSampleSize", config.gmail?.previewSampleSize || 20);
  setFormValue("gmailAction", config.gmail?.action || "preview");
  setFormValue("llmProvider", config.llm?.provider || "openai-compatible");
  setFormValue("llmModel", config.llm?.model || "gpt-4.1-mini");
  setFormValue("llmBaseUrl", config.llm?.baseUrl || "https://api.openai.com/v1");
  setFormValue("llmApiKey", config.llm?.apiKey || "");
  setFormValue("llmWebhookUrl", config.llm?.webhookUrl || "");
  renderSetupSummary();
}

function readFormIntoConfig() {
  const next = structuredClone(state.config);
  next.profile.name = byId("name").value.trim();
  next.profile.currentTitle = byId("currentTitle").value.trim();
  next.profile.email = byId("email").value.trim();
  next.profile.phone = byId("phone").value.trim();
  next.profile.experienceYears = Number(byId("experienceYears").value || 0);
  next.profile.linkedin = byId("linkedin").value.trim();
  next.profile.resumeSummary = serializeStackItems("resumeSummary", state.labelStacks.resumeSummary);
  next.profile.skills = [...(state.labelStacks.skills || [])];
  next.profile.targetTitles = [...(state.labelStacks.targetTitles || [])];
  next.profile.avoidKeywords = parseCsv(byId("avoidKeywords").value);
  next.locationPolicy = next.locationPolicy || {};
  next.locationPolicy.expectedPhysicalLocation = byId("expectedPhysicalLocation").value.trim();
  next.preferences.minimumScore = Number(byId("minimumScore").value || 0);
  next.preferences.searchQueries = [...(state.labelStacks.searchQueries || [])];
  next.preferences.easyApplyOnly = byId("easyApplyOnly").checked;
  next.salary = next.salary || {};
  next.salary.currency = byId("salaryCurrency").value.trim() || "INR";
  next.salary.currentAnnualCompensation = byId("currentAnnualCompensation").value
    ? Number(byId("currentAnnualCompensation").value)
    : null;
  next.salary.minimumAnnualCompensation = byId("minimumAnnualCompensation").value
    ? Number(byId("minimumAnnualCompensation").value)
    : null;
  next.salary.targetAnnualCompensation = byId("targetAnnualCompensation").value
    ? Number(byId("targetAnnualCompensation").value)
    : null;
  next.transition = next.transition || {};
  next.transition.currentDomain = byId("currentCareerDomain").value.trim();
  next.transition.targetDomain = byId("targetCareerDomain").value.trim();
  next.transition.targetRoles = parseCsv(byId("transitionRoles").value);
  next.transition.transitionLevel = byId("transitionLevel").value.trim() || "bridge";
  next.transition.notes = byId("transitionNotes").value.trim();
  next.gmail = next.gmail || {};
  next.gmail.enabled = byId("gmailEnabled").checked;
  next.gmail.credentialsPath = byId("gmailCredentialsPath").value.trim() || "credentials.json";
  next.gmail.tokenDir = byId("gmailTokenDir").value.trim() || "data/gmail";
  next.gmail.query = byId("gmailQuery").value.trim() || "category:promotions OR label:^smartlabel_promo";
  next.gmail.batchSize = Number(byId("gmailBatchSize").value || 100);
  next.gmail.maxMessagesPerRun = Number(byId("gmailMaxMessagesPerRun").value || 500);
  next.gmail.previewSampleSize = Number(byId("gmailPreviewSampleSize").value || 20);
  next.gmail.action = byId("gmailAction").value || "preview";
  next.llm = next.llm || {};
  next.llm.provider = byId("llmProvider").value || "openai-compatible";
  next.llm.model = byId("llmModel").value.trim() || "gpt-4.1-mini";
  next.llm.baseUrl = byId("llmBaseUrl").value.trim() || "https://api.openai.com/v1";
  next.llm.apiKey = byId("llmApiKey").value.trim() || null;
  next.llm.webhookUrl = byId("llmWebhookUrl").value.trim() || null;
  return next;
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.text();
}

async function refreshLabelSuggestions() {
  if (!state.config) {
    return;
  }

  const draftConfig = readFormIntoConfig();
  const response = await fetchJson("/api/label-suggestions", {
    method: "POST",
    body: JSON.stringify({
      config: draftConfig,
      dashboard: state.dashboard
    })
  });

  state.labelSuggestions = {
    resumeSummary: response?.suggestions?.resumeSummary || [],
    skills: response?.suggestions?.skills || [],
    targetTitles: response?.suggestions?.targetTitles || [],
    searchQueries: response?.suggestions?.searchQueries || []
  };

  renderAllStackFields();
}

function formatDateTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatSummaryValue(value) {
  if (value == null || value === "") return "-";
  return String(value);
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCompactCurrency(value, currency = "INR") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "-";
  }

  try {
    return new Intl.NumberFormat([], {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function artifactLink(label, filePath) {
  if (!filePath) return "";
  const encoded = encodeURIComponent(filePath);
  return `<a href="/api/artifact?path=${encoded}" target="_blank" rel="noreferrer">${label}</a>`;
}

function reportUiError(error) {
  const message = String(error?.message || error || "Unknown error");
  const backendLogMeta = byId("backendLogMeta");
  if (backendLogMeta) {
    backendLogMeta.textContent = message;
  }
}

function selectedUpskilledCategories() {
  return unique([
    ...(state.config?.profile?.upskilledCategories || []),
    ...(state.labelStacks.skills || []),
    ...(state.config?.profile?.skills || [])
  ]);
}

function getSelectedRunEntry() {
  return state.history.find((item) => item.runId === state.selectedRunId) || null;
}

function isUpskillingRun(run) {
  return run?.mode === "next-role";
}

function isTransitionRun(run) {
  return run?.mode === "career-transition";
}

function isGmailRun(run) {
  return run?.mode === "gmail-cleanup";
}

function runSupportsUpskilling(run) {
  return (
    isUpskillingRun(run) ||
    Boolean(run?.summary?.prepTasks) ||
    Boolean(run?.artifacts?.prep)
  );
}

function runSupportsTransition(run) {
  return isTransitionRun(run) || Boolean(run?.artifacts?.transition);
}

function runMatchesDashboard(run, dashboard = state.dashboard) {
  if (dashboard === "gmail") {
    return isGmailRun(run);
  }

  if (dashboard === "upskilling") {
    return runSupportsUpskilling(run);
  }

  if (dashboard === "transition") {
    return runSupportsTransition(run);
  }

  return !isUpskillingRun(run) && !isTransitionRun(run) && !isGmailRun(run);
}

function getSelectedRunEntryForDashboard() {
  const selected = getSelectedRunEntry();
  return runMatchesDashboard(selected) ? selected : null;
}

function getActiveRunEntryForDashboard() {
  if (!runMatchesDashboard(state.activeStatus)) {
    return null;
  }

  const fromHistory = state.history.find((item) => item.runId === state.activeStatus?.runId);
  return fromHistory || state.activeStatus || null;
}

function getRunForBackendLogAccess() {
  return getSelectedRunEntryForDashboard() || getActiveRunEntryForDashboard();
}

function buildJobCriteriaPills() {
  const currency = byId("salaryCurrency")?.value?.trim() || state.config?.salary?.currency || "INR";
  const skillsCount = state.labelStacks.skills?.length || 0;
  const titleCount = state.labelStacks.targetTitles?.length || 0;
  const queryCount = state.labelStacks.searchQueries?.length || 0;
  const location = byId("expectedPhysicalLocation")?.value?.trim();
  const minScore = byId("minimumScore")?.value?.trim();
  const minComp = byId("minimumAnnualCompensation")?.value?.trim();
  const portal = byId("portal")?.value || "both";
  const easyApplyOnly = byId("easyApplyOnly")?.checked;

  return [
    ["Skills", skillsCount ? String(skillsCount) : ""],
    ["Target Titles", titleCount ? String(titleCount) : ""],
    ["Search Queries", queryCount ? String(queryCount) : ""],
    ["Location", location || ""],
    ["Fit Floor", minScore ? `${minScore}+` : ""],
    ["Salary Floor", minComp ? formatCompactCurrency(minComp, currency) : ""],
    ["Portal", portal ? humanizeKey(portal) : ""],
    ["Apply Mode", easyApplyOnly ? "Easy Apply only" : ""]
  ].filter(([, value]) => value);
}

function buildSetupSummaryPills() {
  if (state.dashboard === "transition") {
    return [
      ["Move", `${byId("currentCareerDomain")?.value?.trim() || "Current"} -> ${byId("targetCareerDomain")?.value?.trim() || "Target"}`],
      ["Transition Level", byId("transitionLevel")?.value || ""],
      ["Bridge Roles", parseCsv(byId("transitionRoles")?.value || "").length || ""],
      ["Skills", state.labelStacks.skills?.length || ""]
    ].filter(([, value]) => value && value !== "Current -> Target");
  }

  if (state.dashboard === "gmail") {
    return [
      ["Action", humanizeKey(byId("gmailAction")?.value || "preview")],
      ["Query", byId("gmailQuery")?.value?.trim() ? "Configured" : ""],
      ["Batch Size", byId("gmailBatchSize")?.value || ""],
      ["Message Cap", byId("gmailMaxMessagesPerRun")?.value || ""]
    ].filter(([, value]) => value);
  }

  if (state.dashboard === "upskilling") {
    return [
      ["Skills", state.labelStacks.skills?.length || ""],
      ["Target Titles", state.labelStacks.targetTitles?.length || ""],
      ["Current Role", byId("currentTitle")?.value?.trim() || ""],
      ["Current Compensation", byId("currentAnnualCompensation")?.value ? formatCompactCurrency(byId("currentAnnualCompensation").value, byId("salaryCurrency")?.value || "INR") : ""]
    ].filter(([, value]) => value);
  }

  return buildJobCriteriaPills();
}

function renderSetupSummary() {
  const container = byId("setupSummaryStrip");
  if (!container || !state.config) {
    return;
  }

  const pills = buildSetupSummaryPills();
  if (!pills.length) {
    container.innerHTML = `<p class="empty-state">Current run filters will appear here after config loads.</p>`;
    return;
  }

  container.innerHTML = pills
    .map(
      ([label, value]) => `
        <span class="setup-summary-pill">
          ${escapeHtml(label)}<strong>${escapeHtml(String(value))}</strong>
        </span>
      `
    )
    .join("");
}

function renderShortlistCriteria() {
  const container = byId("shortlistCriteriaStrip");
  const selectedRun = getSelectedRunEntryForDashboard();

  if (!container) {
    return;
  }

  if (!selectedRun || state.dashboard !== "jobs") {
    container.innerHTML = `<p class="empty-state">Active shortlist criteria will appear here for job-focused runs.</p>`;
    return;
  }

  const pills = buildJobCriteriaPills();
  if (!pills.length) {
    container.innerHTML = `<p class="empty-state">No shortlist criteria configured yet.</p>`;
    return;
  }

  container.innerHTML = pills
    .map(
      ([label, value]) => `
        <span class="setup-summary-pill">
          ${escapeHtml(label)}<strong>${escapeHtml(String(value))}</strong>
        </span>
      `
    )
    .join("");
}

function setWorkspacePanelOpen(nextOpen, options = {}) {
  state.workspacePanelOpen = !!nextOpen;
  document.body.classList.toggle("workspace-panel-open", state.workspacePanelOpen);

  const panel = byId("workspaceSection");
  const openButtons = [
    byId("openWorkspacePanelBtn"),
    byId("openWorkspacePanelInlineBtn"),
    byId("openWorkspaceNavBtn"),
    byId("openGmailSetupBtn")
  ].filter(Boolean);

  if (panel) {
    panel.setAttribute("aria-hidden", state.workspacePanelOpen ? "false" : "true");
  }

  for (const button of openButtons) {
    button.setAttribute("aria-expanded", state.workspacePanelOpen ? "true" : "false");
  }

  if (state.workspacePanelOpen && options.sectionId) {
    requestAnimationFrame(() => {
      byId(options.sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function historyForDashboard() {
  const history = [...(state.history || [])];
  let filtered = history.filter((item) => runMatchesDashboard(item, state.dashboard));

  if (state.dashboard === "upskilling" || state.dashboard === "transition" || state.dashboard === "gmail") {
    filtered.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  }

  const selected = getSelectedRunEntryForDashboard();
  if (selected && !filtered.some((item) => item.runId === selected.runId)) {
    filtered.unshift(selected);
  }

  return filtered;
}

function getRunModeForDashboard() {
  const modeSelect = byId("mode");
  if (state.dashboard === "upskilling") {
    modeSelect.value = "next-role";
    return "next-role";
  }

  if (state.dashboard === "transition") {
    modeSelect.value = "career-transition";
    return "career-transition";
  }

  if (state.dashboard === "gmail") {
    modeSelect.value = "gmail-cleanup";
    return "gmail-cleanup";
  }

  if (modeSelect.value === "next-role" || modeSelect.value === "career-transition" || modeSelect.value === "gmail-cleanup") {
    modeSelect.value = "search";
  }

  return modeSelect.value === "assist-apply" ? "assist-apply" : "search";
}

function dashboardFromHash(hash = window.location.hash) {
  const normalized = String(hash || "").toLowerCase();
  if (normalized === "#upskilling") {
    return "upskilling";
  }
  if (normalized === "#transition") {
    return "transition";
  }
  if (normalized === "#gmail") {
    return "gmail";
  }
  return "jobs";
}

function syncDashboardHash() {
  const nextHash =
    state.dashboard === "upskilling"
      ? "#upskilling"
      : state.dashboard === "transition"
        ? "#transition"
        : state.dashboard === "gmail"
          ? "#gmail"
          : "#jobs";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function syncDashboardUi() {
  const jobsActive = state.dashboard === "jobs";
  const upskillingActive = state.dashboard === "upskilling";
  const transitionActive = state.dashboard === "transition";
  const gmailActive = state.dashboard === "gmail";
  document.body.dataset.dashboard = state.dashboard;

  byId("jobsDashboardBtn").classList.toggle("active", jobsActive);
  byId("upskillDashboardBtn").classList.toggle("active", upskillingActive);
  byId("transitionDashboardBtn").classList.toggle("active", transitionActive);
  byId("gmailDashboardBtn").classList.toggle("active", gmailActive);
  if (jobsActive) {
    byId("jobsDashboardBtn").setAttribute("aria-current", "page");
    byId("upskillDashboardBtn").removeAttribute("aria-current");
    byId("transitionDashboardBtn").removeAttribute("aria-current");
    byId("gmailDashboardBtn").removeAttribute("aria-current");
  } else if (upskillingActive) {
    byId("upskillDashboardBtn").setAttribute("aria-current", "page");
    byId("jobsDashboardBtn").removeAttribute("aria-current");
    byId("transitionDashboardBtn").removeAttribute("aria-current");
    byId("gmailDashboardBtn").removeAttribute("aria-current");
  } else if (transitionActive) {
    byId("transitionDashboardBtn").setAttribute("aria-current", "page");
    byId("jobsDashboardBtn").removeAttribute("aria-current");
    byId("upskillDashboardBtn").removeAttribute("aria-current");
    byId("gmailDashboardBtn").removeAttribute("aria-current");
  } else {
    byId("gmailDashboardBtn").setAttribute("aria-current", "page");
    byId("jobsDashboardBtn").removeAttribute("aria-current");
    byId("upskillDashboardBtn").removeAttribute("aria-current");
    byId("transitionDashboardBtn").removeAttribute("aria-current");
  }
  byId("jobsDashboardGroup").hidden = !jobsActive;
  byId("upskillingDashboardGroup").hidden = !upskillingActive;
  byId("transitionDashboardGroup").hidden = !transitionActive;
  byId("gmailDashboardGroup").hidden = !gmailActive;

  if (jobsActive) {
    byId("dashboardTitle").textContent = "Eligible Jobs Dashboard";
    byId("dashboardDescription").textContent = "View eligible openings, shortlist stronger bets, and inspect the job market without losing the shared pipeline and run history.";
    byId("historyTitle").textContent = "Eligible Job Runs";
    byId("selectedRunHeading").textContent = "Selected Job Run";
    byId("runSearchBtn").textContent = "Run Jobs Dashboard";
  } else if (upskillingActive) {
    byId("dashboardTitle").textContent = "Upskilling Dashboard";
    byId("dashboardDescription").textContent = "Switch into upskilling mode to inspect skill gaps, learning paths, recommended courses, and role-readiness guidance.";
    byId("historyTitle").textContent = "Upskilling Runs";
    byId("selectedRunHeading").textContent = "Selected Upskilling Run";
    byId("runSearchBtn").textContent = "Run Upskilling Dashboard";
  } else if (transitionActive) {
    byId("dashboardTitle").textContent = "Career Transition Dashboard";
    byId("dashboardDescription").textContent = "Plan a non-native career move using bridge roles, transferable strengths, missing foundations, learning paths, and transition-safe opportunities.";
    byId("historyTitle").textContent = "Career Transition Runs";
    byId("selectedRunHeading").textContent = "Selected Transition Run";
    byId("runSearchBtn").textContent = "Run Transition Dashboard";
  } else {
    byId("dashboardTitle").textContent = "Gmail Cleanup Dashboard";
    byId("dashboardDescription").textContent = "Preview promotional mail, then move it to trash or permanently delete it with a clear review step and saved cleanup reports.";
    byId("historyTitle").textContent = "Gmail Cleanup Runs";
    byId("selectedRunHeading").textContent = "Selected Gmail Cleanup Run";
    byId("runSearchBtn").textContent = "Run Gmail Cleanup";
  }

  const modeSelect = byId("mode");
  if (!jobsActive) {
    modeSelect.value = upskillingActive ? "next-role" : transitionActive ? "career-transition" : "gmail-cleanup";
    modeSelect.setAttribute("disabled", "disabled");
  } else {
    modeSelect.removeAttribute("disabled");
    if (modeSelect.value === "next-role") {
      modeSelect.value = "search";
    }
  }

  if (jobsActive && byId("jobFilterSelect").value === "all") {
    byId("jobFilterSelect").value = "eligible";
  }

  renderSetupSummary();
  renderShortlistCriteria();
}

function setDashboard(nextDashboard, options = {}) {
  state.dashboard =
    nextDashboard === "upskilling"
      ? "upskilling"
      : nextDashboard === "transition"
        ? "transition"
        : nextDashboard === "gmail"
          ? "gmail"
        : "jobs";
  if (options.syncHash !== false) {
    syncDashboardHash();
  }
  syncDashboardUi();
  renderHistory();
  renderPipeline();
  renderSelectedRunMeta();
  renderSelectedResults();
}

function jobSummaryMetrics(results, selectedRun) {
  if (!results || !selectedRun) {
    return [];
  }

  const parent = results.report?.data?.parent?.summary || {};
  const jobs = results.jobs?.data || [];
  const eligibleJobs = jobs.filter((job) => job.eligibility?.eligible).length;

  return [
    ["Jobs Found", parent.jobsFound ?? jobs.length ?? 0],
    ["Eligible Jobs", eligibleJobs],
    ["Shortlisted", parent.shortlisted ?? results.shortlist?.data?.length ?? 0],
    ["Tailored Resumes", parent.tailoredResumes ?? 0],
    ["Salary Best Bets", parent.salaryBestBets ?? 0]
  ];
}

function collectUpskillingData(results) {
  const strategy = results?.nextRole?.data || null;

  if (strategy) {
    const learningPlan = strategy.learningPlan || [];
    const courses = learningPlan.map((item) => ({
      subject: item.skill,
      source: item.source,
      duration: item.duration,
      recommendations: item.recommendations || []
    }));

    const tasks = learningPlan.map((item) => ({
      company: "Market Readiness",
      roleTitle: item.skill,
      taskTitle: `Close ${item.skill}`,
      detail: item.source,
      effort: item.duration || "Flexible"
    }));

    return {
      summary: [
        ["Missing Skills", strategy.missingSkills?.length ?? 0],
        ["Demand Signals", strategy.demandSkills?.length ?? 0],
        ["Learning Paths", learningPlan.length],
        ["Course Suggestions", courses.reduce((sum, item) => sum + (item.recommendations?.length || 0), 0)]
      ],
      skillGaps: strategy.missingSkills || [],
      demandSkills: strategy.demandSkills || [],
      courses,
      tasks,
      strategy
    };
  }

  const prepPlans = results?.prep?.data || [];
  const tasks = prepPlans.flatMap((plan) =>
    (plan.tasks || []).map((task) => ({
      company: plan.company,
      roleTitle: plan.title,
      taskTitle: task.title,
      detail: task.detail,
      effort: task.effort
    }))
  );

  const courses = uniqueBy(
    prepPlans.flatMap((plan) =>
      (plan.recommendedResources || []).map((resource) => ({
        subject: resource.topic,
        source: resource.source,
        duration: resource.duration,
        recommendations: resource.recommendations || []
      }))
    ),
    (item) => item.subject
  );

  const skillGaps = unique(prepPlans.flatMap((plan) => plan.learningFocus || []));

  return {
    summary: [
      ["Prep Plans", prepPlans.length],
      ["Learning Topics", skillGaps.length],
      ["Study Tasks", tasks.length],
      ["Course Suggestions", courses.reduce((sum, item) => sum + (item.recommendations?.length || 0), 0)]
    ],
    skillGaps,
    demandSkills: [],
    courses,
    tasks,
    strategy: null
  };
}

function collectTransitionData(results) {
  const strategy = results?.transition?.data || null;

  if (!strategy) {
    return {
      summary: [],
      rolePaths: [],
      transferableStrengths: [],
      demandSkills: [],
      missingSkills: [],
      courses: [],
      tasks: [],
      strategy: null
    };
  }

  const courses = (strategy.learningPlan || []).map((item) => ({
    subject: item.skill,
    source: item.source,
    duration: item.duration,
    recommendations: item.recommendations || []
  }));

  return {
    summary: [
      ["Bridge Roles", strategy.rolePaths?.length ?? 0],
      ["Transferable Strengths", strategy.transferableStrengths?.length ?? 0],
      ["Missing Foundations", strategy.missingSkills?.length ?? 0],
      ["Course Suggestions", courses.reduce((sum, item) => sum + (item.recommendations?.length || 0), 0)],
      ["Bridge Opportunities", strategy.currentOpportunities?.length ?? 0]
    ],
    rolePaths: strategy.rolePaths || [],
    transferableStrengths: strategy.transferableStrengths || [],
    demandSkills: strategy.demandSkills || [],
    missingSkills: strategy.missingSkills || [],
    courses,
    tasks: strategy.tasks || [],
    strategy
  };
}

function getPipelineSource() {
  const activeRunMatches = state.activeStatus?.status === "running" && runMatchesDashboard(state.activeStatus);

  if (activeRunMatches) {
    return {
      pipeline: state.activeStatus.pipeline || [],
      meta: `Live run in progress: ${state.activeStatus.mode || "search"} on ${state.activeStatus.portal || "both"} since ${formatDateTime(state.activeStatus.startedAt)}.`
    };
  }

  const selectedRun = getSelectedRunEntryForDashboard();
  if (selectedRun?.pipeline?.length) {
    return {
      pipeline: selectedRun.pipeline,
      meta: `Showing pipeline for ${selectedRun.mode} on ${selectedRun.portal}, started ${formatDateTime(selectedRun.startedAt)}.`
    };
  }

  return {
    pipeline: [],
    meta: "No active run. Start a workflow or select a historical run to inspect its stages."
  };
}

function getStageReportMap() {
  const agents = state.selectedResults?.report?.data?.agents || [];
  const reportMap = new Map();

  for (const agent of agents) {
    const stageId = AGENT_STAGE_MAP[agent.agent];
    if (stageId) {
      reportMap.set(stageId, agent);
    }
  }

  return reportMap;
}

function formatPortalBreakdown(value) {
  const entries = Object.entries(value || {});
  if (!entries.length) {
    return "";
  }

  return entries.map(([key, count]) => `${key} ${count}`).join(", ");
}

function buildThoughtLinesFromReport(agentReport) {
  if (!agentReport) {
    return [];
  }

  const lines = [];
  const firstPlan = agentReport.plans?.[0];
  if (firstPlan?.goal) {
    lines.push(`Goal: ${firstPlan.goal}`);
  }
  for (const step of firstPlan?.steps || []) {
    lines.push(step);
  }
  for (const note of agentReport.notes || []) {
    lines.push(note);
  }
  for (const note of agentReport.credibility?.notes || []) {
    lines.push(note);
  }
  return unique(lines).slice(0, 10);
}

function deriveStageSummaryFromReport(stageId, agentReport) {
  if (!agentReport) {
    return "";
  }

  const summary = agentReport.execution?.[0] || {};

  if (stageId === "research") {
    const jobsFound = summary.jobsFound ?? agentReport.output?.jobs?.length ?? 0;
    const breakdown = formatPortalBreakdown(summary.portalBreakdown);
    return `Analyzed ${jobsFound} jobs${breakdown ? ` across ${breakdown}` : ""}.`;
  }

  if (stageId === "business") {
    return `Researched ${summary.companyInsights ?? 0} orgs and marked ${summary.stableCompanies ?? 0} as stronger stability bets.`;
  }

  if (stageId === "salary") {
    return `Evaluated salary signals for ${summary.salaryInsights ?? 0} roles and marked ${summary.bestBetJobs ?? 0} as stronger compensation bets.`;
  }

  if (stageId === "comparison") {
    return `Analyzed ${summary.totalJobs ?? 0} jobs, qualified ${summary.eligibleJobs ?? 0}, and shortlisted ${summary.shortlistedJobs ?? 0}.`;
  }

  if (stageId === "resume") {
    return `Generated ${summary.tailoredResumes ?? 0} tailored resume packages for shortlisted jobs.`;
  }

  if (stageId === "prep") {
    return `Created ${summary.taskList ?? 0} prep tasks from ${summary.sourceJobs ?? 0} strong openings.`;
  }

  if (stageId === "routing") {
    return `Prepared ${summary.drafts ?? 0} route-specific application drafts.`;
  }

  if (stageId === "apply") {
    return `Assisted apply state updated for ${summary.appliedJobs ?? summary.targetedJobs ?? 0} jobs.`;
  }

  if (stageId === "role") {
    return `Projected ${summary.projectedRoles ?? summary.roles ?? 0} stronger next-role paths.`;
  }

  if (stageId === "gap") {
    return `Mapped ${summary.missingSkills ?? summary.skillGaps ?? 0} priority gaps against market demand.`;
  }

  if (stageId === "learning") {
    return `Built ${summary.learningPlans ?? summary.learningPaths ?? summary.courses ?? 0} learning-path recommendations.`;
  }

  if (stageId === "opportunity") {
    return `Reviewed ${summary.opportunities ?? summary.currentOpportunities ?? 0} live opportunities for the current goal.`;
  }

  if (stageId === "compensation") {
    return "Benchmarked compensation guidance and realistic pay expectations.";
  }

  if (stageId === "transition") {
    return "Mapped the transition direction and initial bridge-route strategy.";
  }

  if (stageId === "bridge") {
    return "Identified transferable strengths and bridge-role positioning.";
  }

  const credibilityNote = agentReport.credibility?.notes?.[0];
  return credibilityNote || "";
}

function getDisplayPipeline() {
  const source = getPipelineSource();
  const reportMap = getStageReportMap();
  const pipeline = (source.pipeline || []).map((stage) => {
    const reportAgent = reportMap.get(stage.id);
    return {
      ...stage,
      thoughtLines:
        stage.thoughtLines?.length
          ? stage.thoughtLines
          : buildThoughtLinesFromReport(reportAgent),
      summary:
        stage.summary && stage.summary !== "Stage completed."
          ? stage.summary
          : deriveStageSummaryFromReport(stage.id, reportAgent) || stage.summary || "Waiting to start.",
      agentName: stage.agentName || reportAgent?.agent || null
    };
  });

  return {
    meta: source.meta,
    pipeline
  };
}

function formatStageStatus(status) {
  const normalized = String(status || "pending");
  if (normalized === "running") {
    return "Running";
  }
  if (normalized === "success") {
    return "Done";
  }
  if (normalized === "failed") {
    return "Failed";
  }
  if (normalized === "skipped") {
    return "Skipped";
  }
  return "Pending";
}

function formatStageWindow(stage) {
  if (stage.startedAt && stage.finishedAt) {
    return `${formatDateTime(stage.startedAt)} -> ${formatDateTime(stage.finishedAt)}`;
  }

  if (stage.startedAt) {
    return `Started ${formatDateTime(stage.startedAt)}`;
  }

  return "Waiting to start";
}

function formatAgentName(agentName) {
  if (!agentName) {
    return "";
  }

  return humanizeKey(String(agentName).replace(/-agent$/i, ""));
}

function renderRunStatus(status) {
  const badge = byId("runBadge");
  const meta = byId("runMeta");
  const currentStatus = status?.status || "idle";

  badge.textContent = currentStatus;
  badge.className = `status-pill ${currentStatus}`;

  meta.textContent =
    currentStatus === "running"
      ? status?.mode === "gmail-cleanup"
        ? `Running Gmail cleanup since ${formatDateTime(status.startedAt)}`
        : `Running ${status.mode || "search"} on ${status.portal || "both"} since ${formatDateTime(status.startedAt)}`
      : currentStatus === "completed"
        ? `Last run finished at ${formatDateTime(status.finishedAt)}`
        : currentStatus === "failed"
          ? `Last run failed at ${formatDateTime(status.finishedAt)}`
          : "No run in progress.";
}

function renderPipeline() {
  const board = byId("pipelineBoard");
  const meta = byId("pipelineMeta");
  const source = getDisplayPipeline();

  meta.textContent = source.meta;

  if (!source.pipeline.length) {
    board.innerHTML = `<p class="empty-state">Pipeline stages will appear here.</p>`;
    return;
  }

  board.innerHTML = source.pipeline
    .map((stage, index) => {
      const thoughtLines = unique(stage.thoughtLines || []).slice(-8);
      const hasThoughtLines = thoughtLines.length > 0;
      const shouldExpandThoughts = stage.status === "running" || stage.status === "failed";
      const thoughtBody = hasThoughtLines
        ? `
          <ul class="timeline-thought-list">
            ${thoughtLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        `
        : `<p class="timeline-thought-empty">This stage did not emit a detailed thought trace.</p>`;
      const agentLabel = stage.agentName
        ? `<span class="stage-agent">${escapeHtml(formatAgentName(stage.agentName))}</span>`
        : "";

      return `
        <article class="timeline-stage ${stage.status}">
          <div class="timeline-rail" aria-hidden="true">
            <span class="timeline-dot ${stage.status}"></span>
            ${index < source.pipeline.length - 1 ? `<span class="timeline-line ${stage.status}"></span>` : ""}
          </div>
          <div class="timeline-card">
            <div class="timeline-stage-title">
              <div class="timeline-stage-meta">
                <span class="stage-status">${escapeHtml(formatStageStatus(stage.status))}</span>
                ${agentLabel}
              </div>
              <div class="timeline-stage-head">
                <div>
                  <h4>${escapeHtml(stage.label)}</h4>
                  <p class="timeline-stage-window">${escapeHtml(formatStageWindow(stage))}</p>
                </div>
              </div>
            </div>
            <div class="timeline-thought-shell">
              <details class="timeline-thought" ${shouldExpandThoughts ? "open" : ""}>
                <summary>Agent Thought Process</summary>
                ${thoughtBody}
              </details>
            </div>
            <div class="timeline-summary">
              <span class="timeline-summary-label">Stage Summary</span>
              <p>${escapeHtml(stage.summary || "Waiting to start.")}</p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResumeIntake() {
  const meta = byId("resumeParseMeta");
  const detected = byId("resumeDetected");
  const preview = byId("resumePreview");

  if (!state.resumeIntake) {
    meta.textContent = "No resume uploaded yet. Supported formats: PDF, DOCX, TXT, MD.";
    detected.innerHTML = "";
    preview.textContent = "Resume preview will appear here after parsing.";
    return;
  }

  const draft = state.resumeIntake.profileDraft || {};
  meta.textContent = `Parsed ${state.resumeIntake.fileName}. Detected ${draft.name || "candidate profile"}, ${draft.currentTitle || "role"}, and ${state.resumeIntake.detected?.skills || 0} skill signals.`;

  const pills = [
    draft.name ? `Name: ${draft.name}` : "",
    draft.currentTitle ? `Title: ${draft.currentTitle}` : "",
    draft.experienceYears ? `Experience: ${draft.experienceYears} years` : "",
    draft.email ? "Email found" : "",
    state.resumeIntake.detected?.skills ? `${state.resumeIntake.detected.skills} skills` : "",
    state.resumeIntake.detected?.searchQueries ? `${state.resumeIntake.detected.searchQueries} search queries` : ""
  ].filter(Boolean);

  detected.innerHTML = pills.map((item) => `<span class="detected-pill">${item}</span>`).join("");
  preview.textContent = state.resumeIntake.extractedTextPreview || "No preview available.";
}

function renderHistory() {
  const container = byId("runHistoryList");
  const history = historyForDashboard();

  if (!history.length) {
    container.innerHTML = `<p class="empty-state">No runs yet for this dashboard.</p>`;
    return;
  }

  container.innerHTML = history
    .map((item) => {
      const activeClass = state.selectedRunId === item.runId ? "active" : "";
      const summary = item.summary
        ? Object.entries(item.summary)
            .slice(0, 2)
            .map(([key, value]) => `${humanizeKey(key)}: ${value}`)
            .join(" | ")
        : "No summary yet.";

      return `
        <button type="button" class="history-item ${item.status} ${activeClass}" data-run-id="${item.runId}">
          <div class="history-top">
            <span class="history-dot ${item.status}"></span>
            <strong>${item.mode || "search"} | ${item.portal || "both"}</strong>
            <span>${formatDateTime(item.startedAt)}</span>
          </div>
          <p>${summary}</p>
        </button>
      `;
    })
    .join("");
}

function renderSelectedRunMeta() {
  const meta = byId("selectedRunMeta");
  const selectedRun = getSelectedRunEntryForDashboard();

  if (!selectedRun) {
    meta.textContent =
      state.dashboard === "jobs"
        ? "Select a job-focused run to inspect eligible roles and shortlist outputs."
        : state.dashboard === "upskilling"
          ? "Select an upskilling run to inspect skill gaps, learning paths, and course recommendations."
          : state.dashboard === "transition"
            ? "Select a transition run to inspect bridge roles, transferable strengths, and transition strategy."
            : "Select a Gmail cleanup run to inspect the cleanup query, action, matched count, and email preview.";
    return;
  }

  meta.textContent = `Selected run ${selectedRun.runId} | ${selectedRun.mode} on ${selectedRun.portal} | ${selectedRun.status} | started ${formatDateTime(selectedRun.startedAt)}${selectedRun.finishedAt ? ` | finished ${formatDateTime(selectedRun.finishedAt)}` : ""}`;
}

function renderBackendLogAccess() {
  const meta = byId("backendLogMeta");
  const actions = byId("backendLogActions");
  const run = getRunForBackendLogAccess();

  if (!run) {
    meta.textContent = "Select a run or start a workflow to access its backend trace file.";
    actions.innerHTML = `<p class="empty-state">A run-specific backend log link will appear here.</p>`;
    return;
  }

  meta.textContent =
    run.status === "running"
      ? `Backend trace for active run ${run.runId}. The file keeps updating while the state machine advances.`
      : `Backend trace for run ${run.runId}. Open the file for the complete execution log.`;

  const primaryLinks = [];
  if (run.logPath) {
    primaryLinks.push(artifactLink("Open Backend Log", run.logPath));
  }

  const detailLinks = [];
  if (run.runId === state.selectedRunId) {
    if (state.selectedResults?.report?.fullPath) {
      detailLinks.push(artifactLink("Agent Report", state.selectedResults.report.fullPath));
    }
    if (state.selectedResults?.jobs?.fullPath) {
      detailLinks.push(artifactLink("Jobs Snapshot", state.selectedResults.jobs.fullPath));
    }
    if (state.selectedResults?.shortlist?.fullPath) {
      detailLinks.push(artifactLink("Shortlist", state.selectedResults.shortlist.fullPath));
    }
    if (state.selectedRunId && state.selectedResults?.shortlist?.data?.length) {
      detailLinks.push(
        `<a href="/api/export/csv?runId=${encodeURIComponent(state.selectedRunId)}" download>Export CSV</a>`
      );
    }
    if (state.selectedResults?.gmail?.fullPath) {
      detailLinks.push(artifactLink("Gmail Report", state.selectedResults.gmail.fullPath));
    }
  }

  actions.innerHTML = `
    <div class="backend-log-card">
      <div class="backend-log-top">
        <span class="backend-log-label">Run Trace</span>
        <code class="backend-log-path">${escapeHtml(run.logPath || "Log file path unavailable")}</code>
      </div>
      <div class="backend-log-links">
        ${primaryLinks.join("") || `<span class="subtle">Log file not available yet.</span>`}
        ${detailLinks.join("")}
      </div>
    </div>
  `;
}

function renderJobSummary() {
  const summaryStrip = byId("summaryStrip");
  const selectedRun = getSelectedRunEntryForDashboard();
  const metrics = jobSummaryMetrics(state.selectedResults, selectedRun);

  if (!selectedRun || !metrics.length) {
    summaryStrip.innerHTML = `<p class="empty-state">Select a job-focused run to load summary metrics.</p>`;
    return;
  }

  summaryStrip.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="summary-metric">
          <span>${label}</span>
          <strong>${formatSummaryValue(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderGmailSummary() {
  const summaryStrip = byId("gmailSummaryStrip");
  const selectedRun = getSelectedRunEntryForDashboard();
  const report = state.selectedResults?.gmail?.data || null;

  if (!selectedRun || !report) {
    summaryStrip.innerHTML = `<p class="empty-state">Select a Gmail cleanup run to load cleanup metrics.</p>`;
    return;
  }

  const metrics = [
    ["Action", report.action || "preview"],
    ["Matched Emails", report.totalMatched ?? 0],
    ["Preview Sample", (report.preview || []).length],
    ["Run Cap", report.maxMessages ?? "-"]
  ];

  summaryStrip.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="summary-metric">
          <span>${label}</span>
          <strong>${formatSummaryValue(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderGmailPreview() {
  const queryCard = byId("gmailQueryCard");
  const previewGrid = byId("gmailPreviewGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const report = state.selectedResults?.gmail?.data || null;

  if (!selectedRun || !report) {
    queryCard.innerHTML = `<p class="empty-state">Select a Gmail cleanup run to inspect its search query and action.</p>`;
    previewGrid.innerHTML = `<p class="empty-state">Matched promotional emails will preview here after a Gmail cleanup run.</p>`;
    return;
  }

  queryCard.innerHTML = `
    <article class="gmail-query-panel">
      <p class="section-label">Active Query</p>
      <h4>${escapeHtml(report.action || "preview")} promotional mail</h4>
      <code class="gmail-query-code">${escapeHtml(report.query || "")}</code>
      <p class="subtle">Generated ${escapeHtml(formatDateTime(report.generatedAt))}. Use preview first, then trash or delete only after you are comfortable with the matched sample.</p>
    </article>
  `;

  const preview = report.preview || [];
  if (!preview.length) {
    previewGrid.innerHTML = `<p class="empty-state">This run did not include preview rows.</p>`;
    return;
  }

  previewGrid.innerHTML = preview
    .map(
      (item) => `
        <article class="gmail-mail-card">
          <div class="gmail-mail-top">
            <p class="gmail-mail-from">${escapeHtml(item.from || "Unknown sender")}</p>
            <span class="route-pill">${escapeHtml(report.action || "preview")}</span>
          </div>
          <h4>${escapeHtml(item.subject || "(No subject)")}</h4>
          <p class="gmail-mail-date">${escapeHtml(item.date || "")}</p>
          <p class="gmail-mail-snippet">${escapeHtml(item.snippet || "")}</p>
          <code class="gmail-mail-id">${escapeHtml(item.id || "")}</code>
        </article>
      `
    )
    .join("");
}

function renderUpskillSummary() {
  const summaryStrip = byId("upskillSummaryStrip");
  const selectedRun = getSelectedRunEntryForDashboard();
  const upskillData = collectUpskillingData(state.selectedResults);

  if (!selectedRun || !upskillData.summary.length) {
    summaryStrip.innerHTML = `<p class="empty-state">Select an upskilling run to load readiness metrics.</p>`;
    return;
  }

  summaryStrip.innerHTML = upskillData.summary
    .map(
      ([label, value]) => `
        <div class="summary-metric">
          <span>${label}</span>
          <strong>${formatSummaryValue(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderUpskilledCategoryStrip() {
  const container = byId("upskilledCategoryStrip");
  const categories = state.upskilledCategories || [];

  if (!categories.length) {
    container.innerHTML = `<p class="empty-state">Run the upskilling or career-transition dashboard to surface reusable categories here.</p>`;
    return;
  }

  const selected = new Set(selectedUpskilledCategories().map(normalizeText));
  container.innerHTML = categories
    .map((item) => {
      const isSelected = selected.has(normalizeText(item.label));
      const sourceLabels = (item.sources || [])
        .map((source) => (source === "next-role" ? "upskill" : source === "career-transition" ? "transition" : source))
        .slice(0, 2);

      return `
        <button
          type="button"
          class="upskilled-pill ${isSelected ? "selected" : ""}"
          data-upskilled-category="${item.label}"
          ${isSelected ? "title=\"Already added to job-search criteria\"" : "title=\"Add to job-search criteria\""}
        >
          <span class="upskilled-pill-label">${item.label}</span>
          <span class="upskilled-pill-meta">
            <span class="upskilled-pill-count">${item.count || 1}x</span>
            ${sourceLabels.map((source) => `<span class="upskilled-pill-source">${source}</span>`).join("")}
          </span>
        </button>
      `;
    })
    .join("");
}

function renderTransitionSummary() {
  const summaryStrip = byId("transitionSummaryStrip");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun || !transitionData.summary.length) {
    summaryStrip.innerHTML = `<p class="empty-state">Select a transition run to load career-switch metrics.</p>`;
    return;
  }

  summaryStrip.innerHTML = transitionData.summary
    .map(
      ([label, value]) => `
        <div class="summary-metric">
          <span>${label}</span>
          <strong>${formatSummaryValue(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderShortlist() {
  const container = byId("shortlistGrid");
  const jobs = state.selectedResults?.shortlist?.data || [];
  const selectedRun = getSelectedRunEntryForDashboard();

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a run to inspect shortlisted and eligible jobs.</p>`;
    return;
  }

  if (!jobs.length) {
    container.innerHTML = `<p class="empty-state">This run did not produce shortlist results.</p>`;
    return;
  }

  const template = byId("jobCardTemplate");
  container.innerHTML = "";

  for (const job of jobs) {
    const node = template.content.cloneNode(true);
    node.querySelector(".job-company").textContent = job.company || "Unknown company";
    node.querySelector(".job-title").textContent = job.title || "Untitled role";
    node.querySelector(".job-location").textContent = job.location || "Unknown location";
    node.querySelector(".fit-score").textContent = job.score ?? "-";
    node.querySelector(".overall-score").textContent = job.overallBetScore ?? "-";
    node.querySelector(".salary-range").textContent = job.salaryInsight?.displayRange || "Estimate unavailable";
    node.querySelector(".job-reason").textContent =
      job.businessInsight?.recommendation ||
      job.salaryInsight?.bestBetReason ||
      job.eligibility?.reason ||
      "No reasoning available.";
    node.querySelector(".work-pill").textContent = job.eligibility?.workArrangement || "unknown arrangement";
    node.querySelector(".route-pill").textContent = job.applyRoute || "manual_review";

    const pill = node.querySelector(".eligibility-pill");
    pill.textContent = job.eligibility?.eligible ? "Eligible" : "Ineligible";
    pill.classList.add(job.eligibility?.eligible ? "eligible" : "ineligible");

    const links = [];
    if (job.url) {
      links.push(`<a href="${job.url}" target="_blank" rel="noreferrer">Job</a>`);
    }
    if (job.tailoredResume?.docxPath) {
      links.push(artifactLink("Resume", job.tailoredResume.docxPath));
    }
    if (job.tailoredResume?.jsonPath) {
      links.push(artifactLink("ATS Notes", job.tailoredResume.jsonPath));
    }

    node.querySelector(".card-links").innerHTML = links.join("");
    container.appendChild(node);
  }
}

const HYBRID_SEARCH_CONCEPTS = [
  ["backend engineering", ["backend", "java", "spring", "spring boot", "microservices", "api"]],
  ["distributed systems", ["distributed", "scalability", "fault tolerance", "resilience", "high availability"]],
  ["integration and messaging", ["kafka", "event", "messaging", "stream", "integration", "async"]],
  ["architecture and design", ["architecture", "system design", "solution", "technical design", "platform"]],
  ["cloud and platform", ["kubernetes", "docker", "aws", "azure", "gcp", "openshift", "cloud"]],
  ["ai automation", ["ai", "agent", "agentic", "rag", "llm", "context engineering", "automation"]],
  ["leadership", ["leadership", "lead", "stakeholder", "mentor", "ownership"]]
];

function tokenizeHybridSearch(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9+\s/-]+/g, " ")
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function detectHybridConcepts(value) {
  const haystack = normalizeText(value);
  return HYBRID_SEARCH_CONCEPTS
    .filter(([, terms]) => terms.some((term) => haystack.includes(normalizeText(term))))
    .map(([label]) => label);
}

function hybridSearchScore(job, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { total: 0, fts: 0, similarity: 0, semantic: 0 };
  }

  const jobText = [
    job.title,
    job.company,
    job.location,
    job.description,
    ...(job.tags || []),
    ...(job.comparison?.keywords || []),
    ...(job.comparison?.matchedConcepts || []),
    ...(job.hybridSearch?.matchedPhrases || [])
  ]
    .filter(Boolean)
    .join(" ");

  const normalizedJobText = normalizeText(jobText);
  const jobTitle = normalizeText(job.title);
  const queryTokens = tokenizeHybridSearch(query);
  const jobTokens = new Set(tokenizeHybridSearch(jobText));
  const sharedTokens = queryTokens.filter((token) => jobTokens.has(token));
  const queryConcepts = detectHybridConcepts(query);
  const jobConcepts = unique([
    ...(job.comparison?.matchedConcepts || []),
    ...(job.hybridSearch?.matchedConcepts || []),
    ...detectHybridConcepts(jobText)
  ]);
  const sharedConcepts = queryConcepts.filter((concept) =>
    jobConcepts.some((item) => normalizeText(item) === normalizeText(concept))
  );

  let fts = 0;
  if (jobTitle.includes(normalizedQuery)) {
    fts += 70;
  } else if (normalizedJobText.includes(normalizedQuery)) {
    fts += 45;
  }

  for (const token of sharedTokens) {
    if (jobTitle.includes(token)) {
      fts += 8;
    } else if (normalizedJobText.includes(token)) {
      fts += 4;
    }
  }
  fts = Math.min(100, fts);

  const similarity = queryTokens.length
    ? Math.round((sharedTokens.length / queryTokens.length) * 100)
    : 0;
  const semantic = queryConcepts.length
    ? Math.round((sharedConcepts.length / queryConcepts.length) * 100)
    : sharedTokens.length
      ? Math.min(55, sharedTokens.length * 12)
      : 0;

  const total = Math.round(fts * 0.45 + similarity * 0.25 + semantic * 0.3);

  return {
    total,
    fts,
    similarity,
    semantic
  };
}

function renderMarketBoard() {
  const container = byId("marketBoard");
  const jobs = state.selectedResults?.jobs?.data || [];
  const searchTerm = (byId("jobSearchInput")?.value || "").trim().toLowerCase();
  const filter = byId("jobFilterSelect")?.value || "eligible";
  const selectedRun = getSelectedRunEntryForDashboard();

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a run to inspect eligible job results.</p>`;
    return;
  }

  let filtered = [...jobs];

  if (searchTerm) {
    filtered = filtered
      .map((job) => ({
        ...job,
        _hybridSearchQueryScore: hybridSearchScore(job, searchTerm)
      }))
      .filter((job) => (job._hybridSearchQueryScore?.total || 0) >= 18);
  }

  if (filter === "eligible") {
    filtered = filtered.filter((job) => job.eligibility?.eligible);
  }

  if (filter === "remote") {
    filtered = filtered.filter((job) => job.eligibility?.workArrangement === "remote");
  }

  if (filter === "bestbet") {
    filtered = filtered.filter((job) => (job.overallBetScore || 0) >= 60);
  }

  filtered.sort((a, b) => {
    if (searchTerm) {
      return (
        (b._hybridSearchQueryScore?.total || 0) - (a._hybridSearchQueryScore?.total || 0) ||
        (b.overallBetScore || 0) - (a.overallBetScore || 0)
      );
    }

    return (b.overallBetScore || 0) - (a.overallBetScore || 0);
  });

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state">No jobs match the current filter for this run.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map((job) => {
      const tags = [
        job.eligibility?.eligible ? "eligible" : "ineligible",
        job.eligibility?.workArrangement || "unknown",
        job.applyRoute || "manual_review"
      ]
        .filter(Boolean)
        .map((tag) => `<span class="route-pill">${tag}</span>`)
        .join("");

      const links = [
        job.url ? `<a href="${job.url}" target="_blank" rel="noreferrer">Job</a>` : "",
        job.tailoredResume?.docxPath ? artifactLink("Resume", job.tailoredResume.docxPath) : "",
        job.tailoredResume?.jsonPath ? artifactLink("ATS Notes", job.tailoredResume.jsonPath) : ""
      ]
        .filter(Boolean)
        .join("");

      return `
        <article class="market-row">
          <div class="market-main">
            <strong>${job.title || "Untitled role"}</strong>
            <span>${job.company || "Unknown company"}</span>
          </div>
          <div class="market-location">${job.location || "Unknown location"}</div>
          <div class="market-score">
            <strong>${job.overallBetScore ?? "-"}</strong>
            <span>overall bet</span>
          </div>
          <div class="market-score">
            <strong>${searchTerm ? job._hybridSearchQueryScore?.total ?? "-" : job.score ?? "-"}</strong>
            <span>${searchTerm ? "hybrid search" : "fit score"}</span>
          </div>
          <div class="market-salary">
            <strong>${job.salaryInsight?.displayRange || "No range"}</strong>
            <span>${job.businessInsight?.stabilityLabel || "unknown stability"}</span>
          </div>
          <div class="market-actions-links">${links}</div>
          <div class="market-tags">${tags}</div>
        </article>
      `;
    })
    .join("");
}

function renderSkillGapGrid() {
  const container = byId("skillGapGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const upskillData = collectUpskillingData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select an upskilling run to inspect market-demanded skills and gaps.</p>`;
    return;
  }

  const gapItems = upskillData.skillGaps.map((skill) => ({
    label: skill,
    type: "gap"
  }));
  const demandItems = (upskillData.demandSkills || [])
    .slice(0, 8)
    .map((item) => ({
      label: item.value,
      type: "demand",
      meta: item.count ? `${item.count} matching openings` : "market signal"
    }));

  const cards = uniqueBy([...gapItems, ...demandItems], (item) => item.label);

  if (!cards.length) {
    container.innerHTML = `<p class="empty-state">No skill-gap signals were generated for this run.</p>`;
    return;
  }

  container.innerHTML = cards
    .map(
      (item) => `
        <article class="gap-card ${item.type}">
          <span class="gap-type">${item.type === "gap" ? "Skill gap" : "Demand signal"}</span>
          <strong>${item.label}</strong>
          <p>${item.meta || (item.type === "gap" ? "Recommended for focused upskilling." : "Appears repeatedly in current market demand.")}</p>
        </article>
      `
    )
    .join("");
}

function renderCourseGrid() {
  const container = byId("courseGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const upskillData = collectUpskillingData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select an upskilling run to view learning paths and recommended courses.</p>`;
    return;
  }

  const courses = upskillData.courses || [];
  if (!courses.length) {
    container.innerHTML = `<p class="empty-state">No course recommendations were generated for this run.</p>`;
    return;
  }

  container.innerHTML = courses
    .map((course) => {
      const recommendations = (course.recommendations || [])
        .map(
          (item) => `
            <li>
              <strong>${item.title}</strong>
              <span>${item.provider} | ${item.format} | ${item.effort}</span>
            </li>
          `
        )
        .join("");

      return `
        <article class="course-recommendation-card">
          <div class="course-top">
            <div>
              <p class="course-label">Learning Focus</p>
              <h4>${course.subject}</h4>
            </div>
            <span class="course-duration">${course.duration || "Flexible"}</span>
          </div>
          <p class="course-source">${course.source || "Recommended learning path."}</p>
          <ul class="course-list">
            ${recommendations || "<li><strong>Recommended path</strong><span>Use official docs and one applied project.</span></li>"}
          </ul>
        </article>
      `;
    })
    .join("");
}

function renderTaskList() {
  const container = byId("taskList");
  const selectedRun = getSelectedRunEntryForDashboard();
  const upskillData = collectUpskillingData(state.selectedResults);
  const tasks = upskillData.tasks || [];

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select an upskilling run to inspect your study queue.</p>`;
    return;
  }

  if (!tasks.length) {
    container.innerHTML = `<p class="empty-state">This run did not produce upskilling tasks.</p>`;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
        <article class="task-item">
          <p class="task-role">${task.company} - ${task.roleTitle}</p>
          <p class="task-title">${task.taskTitle}</p>
          <p class="task-detail">${task.detail}</p>
          <span class="task-effort">${task.effort || "Flexible"}</span>
        </article>
      `
    )
    .join("");
}

function renderNextRoleStrategy() {
  const container = byId("strategyBoard");
  const strategy = state.selectedResults?.nextRole?.data;
  const selectedRun = getSelectedRunEntryForDashboard();

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select an upskilling run to inspect strategic recommendations.</p>`;
    return;
  }

  if (!strategy) {
    container.innerHTML = `<p class="empty-state">Run the upskilling dashboard to generate role projections, target companies, and compensation guidance.</p>`;
    return;
  }

  const roleItems = (strategy.roleOptions || [])
    .map((item) => `<li><strong>${item.role}</strong>: ${item.reason}</li>`)
    .join("");
  const skillItems = (strategy.missingSkills || [])
    .map((item) => `<li>${item}</li>`)
    .join("");
  const learningItems = (strategy.learningPlan || [])
    .map((item) => `<li><strong>${item.skill}</strong>: ${item.source} (${item.duration})</li>`)
    .join("");
  const opportunityItems = (strategy.currentOpportunities || [])
    .map((item) => `<li><strong>${item.company}</strong> - ${item.role}${item.salaryRange ? ` (${item.salaryRange})` : ""}</li>`)
    .join("");
  const companyItems = (strategy.targetCompanies || [])
    .map((item) => `<li><strong>${item.company}</strong>: ${item.reason}</li>`)
    .join("");
  const compensation = strategy.compensationAdvice;

  container.innerHTML = `
    <section class="strategy-panel">
      <h4>1. Upgraded Roles</h4>
      <ul>${roleItems || "<li>No role projections yet.</li>"}</ul>
    </section>
    <section class="strategy-panel">
      <h4>2. Skill Gaps</h4>
      <ul>${skillItems || "<li>No major gaps detected yet.</li>"}</ul>
    </section>
    <section class="strategy-panel">
      <h4>3. Learning Plan</h4>
      <ul>${learningItems || "<li>No learning plan yet.</li>"}</ul>
    </section>
    <section class="strategy-panel">
      <h4>4. Opportunities and Targets</h4>
      <ul>${opportunityItems || "<li>No current opportunities yet.</li>"}</ul>
      <h4 style="margin-top:16px;">Target Companies</h4>
      <ul>${companyItems || "<li>No target companies yet.</li>"}</ul>
    </section>
    <section class="strategy-panel" style="grid-column: 1 / -1;">
      <h4>5. Fair Increment</h4>
      <ul>
        <li><strong>Current:</strong> ${compensation?.currentAnnualCompensation ?? "Set in dashboard"}</li>
        <li><strong>Fair minimum:</strong> ${compensation?.fairMinimum ?? "-"}</li>
        <li><strong>Fair maximum:</strong> ${compensation?.fairMaximum ?? "-"}</li>
        <li><strong>Recommendation:</strong> ${compensation?.recommendation || "No advice yet."}</li>
      </ul>
    </section>
  `;
}

function renderTransitionRoleGrid() {
  const container = byId("transitionRoleGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect recommended bridge roles.</p>`;
    return;
  }

  if (!transitionData.rolePaths.length) {
    container.innerHTML = `<p class="empty-state">No transition role paths were generated for this run.</p>`;
    return;
  }

  container.innerHTML = transitionData.rolePaths
    .map(
      (item) => `
        <article class="transition-role-item">
          <span class="gap-type">${item.routeType || "bridge route"}</span>
          <strong>${item.role}</strong>
          <p>${item.reason || "Recommended as a possible transition role."}</p>
        </article>
      `
    )
    .join("");
}

function renderTransitionStrengthGrid() {
  const container = byId("transitionStrengthGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect transferable strengths.</p>`;
    return;
  }

  if (!transitionData.transferableStrengths.length) {
    container.innerHTML = `<p class="empty-state">No transferable strengths were generated for this run.</p>`;
    return;
  }

  container.innerHTML = transitionData.transferableStrengths
    .map(
      (item) => `
        <article class="gap-card demand">
          <span class="gap-type">Transferable strength</span>
          <strong>${item.strength}</strong>
          <p>${item.reason || "Relevant to the transition path."}</p>
        </article>
      `
    )
    .join("");
}

function renderTransitionGapGrid() {
  const container = byId("transitionGapGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect missing foundations and demand signals.</p>`;
    return;
  }

  const gapItems = transitionData.missingSkills.map((skill) => ({
    label: skill,
    type: "gap"
  }));
  const demandItems = (transitionData.demandSkills || []).map((item) => ({
    label: item.value,
    type: "demand",
    meta: item.count ? `${item.count} matching openings` : "market signal"
  }));
  const cards = uniqueBy([...gapItems, ...demandItems], (item) => item.label);

  if (!cards.length) {
    container.innerHTML = `<p class="empty-state">No missing-foundation signals were generated for this run.</p>`;
    return;
  }

  container.innerHTML = cards
    .map(
      (item) => `
        <article class="gap-card ${item.type}">
          <span class="gap-type">${item.type === "gap" ? "Missing foundation" : "Demand signal"}</span>
          <strong>${item.label}</strong>
          <p>${item.meta || (item.type === "gap" ? "Recommended for focused transition preparation." : "Appears repeatedly in current transition demand.")}</p>
        </article>
      `
    )
    .join("");
}

function renderTransitionCourseGrid() {
  const container = byId("transitionCourseGrid");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect learning paths.</p>`;
    return;
  }

  if (!transitionData.courses.length) {
    container.innerHTML = `<p class="empty-state">No transition courses were generated for this run.</p>`;
    return;
  }

  container.innerHTML = transitionData.courses
    .map((course) => {
      const recommendations = (course.recommendations || [])
        .map(
          (item) => `
            <li>
              <strong>${item.title}</strong>
              <span>${item.provider} | ${item.format} | ${item.effort}</span>
            </li>
          `
        )
        .join("");

      return `
        <article class="course-recommendation-card">
          <div class="course-top">
            <div>
              <p class="course-label">Transition Focus</p>
              <h4>${course.subject}</h4>
            </div>
            <span class="course-duration">${course.duration || "Flexible"}</span>
          </div>
          <p class="course-source">${course.source || "Recommended transition learning path."}</p>
          <ul class="course-list">
            ${recommendations || "<li><strong>Recommended path</strong><span>Use structured fundamentals plus one applied exercise.</span></li>"}
          </ul>
        </article>
      `;
    })
    .join("");
}

function renderTransitionTaskList() {
  const container = byId("transitionTaskList");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect your transition task list.</p>`;
    return;
  }

  if (!transitionData.tasks.length) {
    container.innerHTML = `<p class="empty-state">This run did not produce transition tasks.</p>`;
    return;
  }

  container.innerHTML = transitionData.tasks
    .map(
      (task) => `
        <article class="task-item">
          <p class="task-role">Career Transition</p>
          <p class="task-title">${task.title}</p>
          <p class="task-detail">${task.detail}</p>
          <span class="task-effort">${task.effort || "Flexible"}</span>
        </article>
      `
    )
    .join("");
}

function renderTransitionStrategy() {
  const container = byId("transitionStrategyBoard");
  const selectedRun = getSelectedRunEntryForDashboard();
  const transitionData = collectTransitionData(state.selectedResults);
  const strategy = transitionData.strategy;

  if (!selectedRun) {
    container.innerHTML = `<p class="empty-state">Select a transition run to inspect the full transition strategy.</p>`;
    return;
  }

  if (!strategy) {
    container.innerHTML = `<p class="empty-state">Run the transition dashboard to generate bridge roles, transition opportunities, and compensation guidance.</p>`;
    return;
  }

  const intent = strategy.transitionIntent;
  const opportunityItems = (strategy.currentOpportunities || [])
    .map((item) => `<li><strong>${item.company}</strong> - ${item.role}${item.salaryRange ? ` (${item.salaryRange})` : ""} | ${item.routeType || "bridge"} route</li>`)
    .join("");
  const companyItems = (strategy.targetCompanies || [])
    .map((item) => `<li><strong>${item.company}</strong>: ${item.reason}</li>`)
    .join("");
  const compensation = strategy.compensationAdvice;
  const readiness = strategy.readiness;

  container.innerHTML = `
    <section class="strategy-panel">
      <h4>1. Transition Direction</h4>
      <ul>
        <li><strong>From:</strong> ${intent?.sourceDomain || "-"}</li>
        <li><strong>To:</strong> ${intent?.targetDomain || "-"}</li>
        <li><strong>Level:</strong> ${intent?.transitionLevel || "-"}</li>
        <li><strong>Intent:</strong> ${intent?.transitionNarrative || "No transition narrative yet."}</li>
      </ul>
    </section>
    <section class="strategy-panel">
      <h4>2. Readiness</h4>
      <ul>
        <li><strong>Score:</strong> ${readiness?.readinessScore ?? "-"}</li>
        <li><strong>Assessment:</strong> ${readiness?.readinessLabel || "No readiness label yet."}</li>
        <li><strong>Difficulty:</strong> ${readiness?.transitionDifficulty || "-"}</li>
      </ul>
    </section>
    <section class="strategy-panel">
      <h4>3. Transition Opportunities</h4>
      <ul>${opportunityItems || "<li>No current bridge opportunities yet.</li>"}</ul>
    </section>
    <section class="strategy-panel">
      <h4>4. Target Companies</h4>
      <ul>${companyItems || "<li>No target companies yet.</li>"}</ul>
    </section>
    <section class="strategy-panel" style="grid-column: 1 / -1;">
      <h4>5. Compensation Reality Check</h4>
      <ul>
        <li><strong>Current:</strong> ${compensation?.currentAnnualCompensation ?? "Set in dashboard"}</li>
        <li><strong>Market entry minimum:</strong> ${compensation?.marketEntryMin ?? "-"}</li>
        <li><strong>Market entry maximum:</strong> ${compensation?.marketEntryMax ?? "-"}</li>
        <li><strong>Recommendation:</strong> ${compensation?.recommendation || "No compensation guidance yet."}</li>
      </ul>
    </section>
  `;
}

function renderSelectedResults() {
  renderBackendLogAccess();
  renderShortlistCriteria();
  renderUpskilledCategoryStrip();
  renderSelectedRunMeta();
  renderJobSummary();
  renderGmailSummary();
  renderUpskillSummary();
  renderTransitionSummary();
  renderShortlist();
  renderMarketBoard();
  renderSkillGapGrid();
  renderCourseGrid();
  renderTaskList();
  renderNextRoleStrategy();
  renderTransitionRoleGrid();
  renderTransitionStrengthGrid();
  renderTransitionGapGrid();
  renderTransitionCourseGrid();
  renderTransitionTaskList();
  renderTransitionStrategy();
  renderGmailPreview();
}

async function loadConfig() {
  state.config = await fetchJson("/api/config");
  populateForm(state.config);
  await refreshLabelSuggestions();
}

async function loadUpskilledCategories() {
  const response = await fetchJson("/api/upskilled-categories");
  state.upskilledCategories = response.categories || [];
  if (state.config?.profile) {
    state.config.profile.upskilledCategories = response.selected || state.config.profile.upskilledCategories || [];
  }
  renderUpskilledCategoryStrip();
}

async function loadHistory() {
  state.history = await fetchJson("/api/run-history");
  renderHistory();
  renderPipeline();
  renderSelectedRunMeta();
  await loadUpskilledCategories();
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  state.followActiveRun = state.activeStatus?.status === "running" && state.activeStatus?.runId === runId;
  state.selectedResults = await fetchJson(`/api/results?runId=${encodeURIComponent(runId)}`);

  const selectedRun = getSelectedRunEntry();
  if (selectedRun) {
    state.dashboard = isGmailRun(selectedRun)
      ? "gmail"
      : isTransitionRun(selectedRun)
        ? "transition"
        : isUpskillingRun(selectedRun)
          ? "upskilling"
          : "jobs";
  }

  syncDashboardUi();
  renderHistory();
  renderPipeline();
  renderSelectedResults();
}

function clearSelectedRun() {
  state.selectedRunId = null;
  state.selectedResults = null;
  renderHistory();
  renderPipeline();
  renderSelectedResults();
}

async function pollStatus() {
  const status = await fetchJson("/api/status");
  state.activeStatus = status;
  renderRunStatus(status);
  renderPipeline();
  renderBackendLogAccess();

  if (status.runId && status.status === "running") {
    await loadHistory();
  }

  const completionKey =
    status.runId && (status.status === "completed" || status.status === "failed")
      ? `${status.runId}:${status.status}`
      : "";

  if (completionKey && completionKey !== state.lastHandledCompletionKey) {
    state.lastHandledCompletionKey = completionKey;
    await loadHistory();
    if (state.followActiveRun) {
      await selectRun(status.runId);
      state.followActiveRun = false;
    }
  }
}

async function saveConfig() {
  const next = readFormIntoConfig();
  await fetchJson("/api/config", {
    method: "POST",
    body: JSON.stringify(next)
  });
  state.config = next;
  renderSetupSummary();
  renderShortlistCriteria();
  await refreshLabelSuggestions();
  await loadSetupStatus();
}

function buildDerivedQueryFromCategory(category) {
  const titleSeed =
    parseCsv(byId("targetTitles").value)[0] ||
    byId("currentTitle").value.trim() ||
    "job";

  return `${titleSeed} ${category}`.trim();
}

async function applyUpskilledCategory(category) {
  const normalizedCategory = String(category || "").trim();
  if (!normalizedCategory || !state.config) {
    return;
  }

  if (!(state.labelStacks.skills || []).some((item) => normalizeText(item) === normalizeText(normalizedCategory))) {
    addStackItem("skills", normalizedCategory);
  }

  const selectedCategories = selectedUpskilledCategories();
  if (!selectedCategories.some((item) => normalizeText(item) === normalizeText(normalizedCategory))) {
    state.config.profile.upskilledCategories = unique([...selectedCategories, normalizedCategory]);
  }

  const existingQueries = [...(state.labelStacks.searchQueries || [])];
  const derivedQuery = buildDerivedQueryFromCategory(normalizedCategory);
  if (
    derivedQuery &&
    !existingQueries.some(
      (query) =>
        normalizeText(query) === normalizeText(derivedQuery) ||
        normalizeText(query).includes(normalizeText(normalizedCategory))
    )
  ) {
    addStackItem("searchQueries", derivedQuery);
  }

  await saveConfig();
  renderUpskilledCategoryStrip();
}

async function runWorkflow() {
  const mode = getRunModeForDashboard();
  await saveConfig();
  const run = await fetchJson("/api/run", {
    method: "POST",
    body: JSON.stringify({
      portal: byId("portal").value,
      mode,
      headed: byId("headed").checked,
      gmailAction: byId("gmailAction").value,
      gmailQuery: byId("gmailQuery").value.trim(),
      gmailMaxMessages: Number(byId("gmailMaxMessagesPerRun").value || 0)
    })
  });
  state.followActiveRun = true;
  state.selectedRunId = run.runId;
  state.selectedResults = null;
  await loadHistory();
  await pollStatus();
  renderSelectedResults();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function handleResumeUpload(file) {
  if (!file) {
    return;
  }

  byId("resumeParseMeta").textContent = `Parsing ${file.name}...`;
  const contentBase64 = arrayBufferToBase64(await file.arrayBuffer());

  const intake = await fetchJson("/api/resume-upload", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentBase64
    })
  });

  state.resumeIntake = intake;
  state.config = intake.configDraft;
  populateForm(state.config);
  await refreshLabelSuggestions();
  renderResumeIntake();
}

async function loadSetupStatus() {
  try {
    const status = await fetchJson("/api/setup-status");
    renderSetupChecklist(status);
  } catch {
    /* ignore */
  }
}

function renderSetupChecklist(status) {
  const list = byId("setupChecklist");
  if (!list || !status) {
    return;
  }

  list.querySelectorAll("li").forEach((item) => {
    const key = item.dataset.key;
    if (status[key]) {
      item.classList.add("done");
    } else {
      item.classList.remove("done");
    }
  });
}

async function runDemoWorkflow() {
  await saveConfig();
  const run = await fetchJson("/api/run", {
    method: "POST",
    body: JSON.stringify({ portal: "both", mode: "demo", headed: false })
  });
  state.followActiveRun = true;
  state.selectedRunId = run.runId;
  state.selectedResults = null;
  await loadHistory();
  await pollStatus();
  renderSelectedResults();
}

async function initialize() {
  state.dashboard = dashboardFromHash();
  await loadConfig();
  renderResumeIntake();
  syncDashboardUi();
  syncDashboardHash();
  clearSelectedRun();
  await loadHistory();
  await loadSetupStatus();
  await pollStatus();

  state.polling = setInterval(async () => {
    await pollStatus();
  }, 3000);
}

byId("saveConfigBtn").addEventListener("click", async () => {
  await saveConfig();
});

byId("testLlmBtn").addEventListener("click", async () => {
  await saveConfig();
  const result = await fetchJson("/api/llm/test", { method: "POST" });
  byId("llmTestMeta").textContent = result.message || (result.ok ? "Connected." : "Failed.");
});

[
  ["openWorkspacePanelBtn", "runGuardrailsBlock"],
  ["openWorkspacePanelInlineBtn", "runGuardrailsBlock"],
  ["openWorkspaceNavBtn", "profileSetupBlock"],
  ["openGmailSetupBtn", "gmailSection"]
].forEach(([id, sectionId]) => {
  byId(id).addEventListener("click", () => {
    setWorkspacePanelOpen(true, { sectionId });
  });
});

["closeWorkspacePanelBtn", "closeWorkspacePanelFooterBtn"].forEach((id) => {
  byId(id).addEventListener("click", () => {
    setWorkspacePanelOpen(false);
  });
});

byId("workspacePanelBackdrop").addEventListener("click", () => {
  setWorkspacePanelOpen(false);
});

byId("runSearchBtn").addEventListener("click", async () => {
  await runWorkflow();
});

byId("runDemoBtn").addEventListener("click", async () => {
  await runDemoWorkflow();
});

byId("jobsDashboardBtn").addEventListener("click", (event) => {
  event.preventDefault();
  setDashboard("jobs");
});

byId("upskillDashboardBtn").addEventListener("click", (event) => {
  event.preventDefault();
  setDashboard("upskilling");
});

byId("transitionDashboardBtn").addEventListener("click", (event) => {
  event.preventDefault();
  setDashboard("transition");
});

byId("gmailDashboardBtn").addEventListener("click", (event) => {
  event.preventDefault();
  setDashboard("gmail");
});

window.addEventListener("hashchange", () => {
  setDashboard(dashboardFromHash(), { syncHash: false });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.workspacePanelOpen) {
    setWorkspacePanelOpen(false);
  }
});

byId("resumeUploadBtn").addEventListener("click", () => {
  byId("resumeFileInput").click();
});

byId("resumeFileInput").addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  try {
    await handleResumeUpload(file);
  } catch (error) {
    byId("resumeParseMeta").textContent = String(error.message || error);
  } finally {
    event.target.value = "";
  }
});

["input", "change"].forEach((eventName) => {
  byId("workspacePanelBody").addEventListener(eventName, () => {
    renderSetupSummary();
    renderShortlistCriteria();
  });
});

byId("configForm").addEventListener("click", async (event) => {
  const removeChip = event.target.closest("[data-stack-remove]");
  if (removeChip) {
    removeStackItem(removeChip.dataset.stackRemove, removeChip.dataset.stackValue || "");
    return;
  }

  const addSuggestion = event.target.closest("[data-stack-add]");
  if (addSuggestion) {
    addStackItem(addSuggestion.dataset.stackAdd, addSuggestion.dataset.stackValue || "");
    return;
  }

  const addButton = event.target.closest("[data-stack-target]");
  if (addButton) {
    const fieldId = addButton.dataset.stackTarget;
    const input = byId(STACK_FIELDS[fieldId]?.inputId);
    addStackItem(fieldId, input?.value || "");
    return;
  }

  const refreshButton = event.target.closest("[data-stack-refresh]");
  if (refreshButton) {
    try {
      await refreshLabelSuggestions();
    } catch (error) {
      reportUiError(error);
    }
  }
});

byId("configForm").addEventListener("keydown", (event) => {
  const stackInput = event.target.closest("[data-stack-input]");
  if (!stackInput) {
    return;
  }

  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addStackItem(stackInput.dataset.stackInput, stackInput.value || "");
  }
});

["currentTitle", "experienceYears", "expectedPhysicalLocation"].forEach((id) => {
  byId(id).addEventListener("change", async () => {
    try {
      await refreshLabelSuggestions();
    } catch (error) {
      reportUiError(error);
    }
  });
});

byId("refreshHistoryBtn").addEventListener("click", async () => {
  await loadHistory();
  await pollStatus();
});

byId("clearSelectionBtn").addEventListener("click", () => {
  clearSelectedRun();
});

byId("upskilledCategoryStrip").addEventListener("click", async (event) => {
  const chip = event.target.closest("[data-upskilled-category]");
  if (!chip) {
    return;
  }

  const category = chip.getAttribute("data-upskilled-category");
  if (!category || chip.classList.contains("selected")) {
    return;
  }

  try {
    await applyUpskilledCategory(category);
  } catch (error) {
    reportUiError(error);
  }
});

byId("runHistoryList").addEventListener("click", async (event) => {
  const item = event.target.closest("[data-run-id]");
  if (!item) {
    return;
  }

  try {
    await selectRun(item.dataset.runId);
  } catch (error) {
    reportUiError(error);
  }
});

byId("jobSearchInput").addEventListener("input", () => {
  renderMarketBoard();
});

byId("jobFilterSelect").addEventListener("change", () => {
  renderMarketBoard();
});

initialize().catch((error) => {
  reportUiError(error);
});
