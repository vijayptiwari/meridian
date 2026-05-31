const fs = require("fs");
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const ACTION_SCOPES = {
  preview: ["https://www.googleapis.com/auth/gmail.readonly"],
  trash: ["https://www.googleapis.com/auth/gmail.modify"],
  delete: ["https://mail.google.com/"]
};

function resolvePath(rootDir, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.join(rootDir, maybeRelativePath);
}

async function loadSavedCredentialsIfExist(tokenPath) {
  try {
    const content = await fs.promises.readFile(tokenPath, "utf8");
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (error) {
    return null;
  }
}

async function saveCredentials(client, credentialsPath, tokenPath) {
  const content = await fs.promises.readFile(credentialsPath, "utf8");
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;

  if (!key) {
    throw new Error("credentials.json must contain an installed or web OAuth client.");
  }

  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  });

  await fs.promises.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.promises.writeFile(tokenPath, payload, "utf8");
}

function getScopesForAction(action) {
  return ACTION_SCOPES[action] || ACTION_SCOPES.preview;
}

async function authorizeGmail({ rootDir, gmailConfig, action }) {
  const credentialsPath = resolvePath(rootDir, gmailConfig.credentialsPath);
  const tokenDir = resolvePath(rootDir, gmailConfig.tokenDir);
  const tokenPath = path.join(tokenDir, `token-${action}.json`);

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Missing Gmail OAuth client file at ${credentialsPath}. Download a desktop app credentials.json from Google Cloud and place it there.`
    );
  }

  const savedClient = await loadSavedCredentialsIfExist(tokenPath);
  if (savedClient) {
    return savedClient;
  }

  const client = await authenticate({
    scopes: getScopesForAction(action),
    keyfilePath: credentialsPath
  });

  if (client.credentials?.refresh_token) {
    await saveCredentials(client, credentialsPath, tokenPath);
  }

  return client;
}

module.exports = { authorizeGmail, resolvePath };
