const path = require("path");
const { google } = require("googleapis");
const { authorizeGmail } = require("../lib/gmailAuth");
const { saveJson, timestamp } = require("../lib/runtime");

function getHeader(headers, name) {
  const match = (headers || []).find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return match ? match.value : "";
}

function chunk(list, size) {
  const items = [];

  for (let index = 0; index < list.length; index += size) {
    items.push(list.slice(index, index + size));
  }

  return items;
}

async function listMessageIds({ gmail, query, batchSize, maxMessages }) {
  const ids = [];
  let pageToken;

  while (ids.length < maxMessages) {
    const result = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(batchSize, maxMessages - ids.length),
      pageToken
    });

    const messages = result.data.messages || [];
    ids.push(...messages.map((message) => message.id));
    pageToken = result.data.nextPageToken;

    if (!pageToken || messages.length === 0) {
      break;
    }
  }

  return ids;
}

async function loadPreviewMessages({ gmail, ids, previewSampleSize }) {
  const sampleIds = ids.slice(0, previewSampleSize);
  return Promise.all(
    sampleIds.map(async (id) => {
      const result = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"]
      });
      const headers = result.data.payload?.headers || [];
      return {
        id,
        from: getHeader(headers, "From"),
        subject: getHeader(headers, "Subject"),
        date: getHeader(headers, "Date"),
        snippet: result.data.snippet || ""
      };
    })
  );
}

async function trashMessages({ gmail, ids, log }) {
  for (const [index, id] of ids.entries()) {
    await gmail.users.messages.trash({ userId: "me", id });
    if ((index + 1) % 50 === 0 || index === ids.length - 1) {
      log.info(`Moved ${index + 1}/${ids.length} Gmail messages to trash.`);
    }
  }
}

async function deleteMessages({ gmail, ids, log }) {
  const batches = chunk(ids, 1000);

  for (const [index, batch] of batches.entries()) {
    await gmail.users.messages.batchDelete({
      userId: "me",
      requestBody: { ids: batch }
    });
    log.info(`Permanently deleted batch ${index + 1}/${batches.length} (${batch.length} messages).`);
  }
}

async function runGmailCleanupAgent({ rootDir, config, log, outputDir }) {
  if (!config.gmail?.enabled) {
    throw new Error("Gmail cleanup is disabled. Set gmail.enabled to true in src/config.json.");
  }

  const action = process.env.JOB_AGENT_GMAIL_ACTION || config.gmail.action || "preview";
  const query = process.env.JOB_AGENT_GMAIL_QUERY || config.gmail.query;
  const maxMessagesOverride = Number.parseInt(process.env.JOB_AGENT_GMAIL_MAX_MESSAGES || "", 10);
  const maxMessages = Number.isFinite(maxMessagesOverride) && maxMessagesOverride > 0
    ? maxMessagesOverride
    : config.gmail.maxMessagesPerRun;

  if (!["preview", "trash", "delete"].includes(action)) {
    throw new Error(`Unsupported Gmail action: ${action}`);
  }

  const auth = await authorizeGmail({
    rootDir,
    gmailConfig: config.gmail,
    action
  });
  const gmail = google.gmail({ version: "v1", auth });

  log.info(`Searching Gmail with query: ${query}`);
  const ids = await listMessageIds({
    gmail,
    query,
    batchSize: config.gmail.batchSize,
    maxMessages
  });
  const preview = await loadPreviewMessages({
    gmail,
    ids,
    previewSampleSize: config.gmail.previewSampleSize
  });

  if (action === "trash" && ids.length > 0) {
    await trashMessages({ gmail, ids, log });
  }

  if (action === "delete" && ids.length > 0) {
    await deleteMessages({ gmail, ids, log });
  }

  const report = {
    mode: "gmail-cleanup",
    action,
    query,
    totalMatched: ids.length,
    maxMessages,
    generatedAt: new Date().toISOString(),
    preview
  };

  const reportPath = path.join(outputDir, `gmail-cleanup-report-${timestamp()}.json`);
  await saveJson(reportPath, report);

  return {
    reportPath
  };
}

module.exports = { runGmailCleanupAgent };
