#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");

function copyIfMissing(source, target) {
  if (fs.existsSync(target)) {
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function main() {
  console.log("Meridian init\n");

  const configExample = path.join(rootDir, "src", "config.example.json");
  const configTarget = path.join(rootDir, "src", "config.json");
  const envExample = path.join(rootDir, ".env.example");
  const envTarget = path.join(rootDir, ".env");

  if (copyIfMissing(configExample, configTarget)) {
    console.log("Created src/config.json");
  } else {
    console.log("Kept existing src/config.json");
  }

  if (copyIfMissing(envExample, envTarget)) {
    console.log("Created .env");
  } else {
    console.log("Kept existing .env");
  }

  fs.mkdirSync(path.join(rootDir, "data"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "resume"), { recursive: true });

  console.log("\nInstalling dependencies...");
  const install = spawnSync("npm", ["install"], { cwd: rootDir, stdio: "inherit", shell: true });
  if (install.status !== 0) {
    process.exit(install.status || 1);
  }

  console.log("\nInstalling Playwright Chromium...");
  const playwright = spawnSync("npx", ["playwright", "install", "chromium"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: true
  });
  if (playwright.status !== 0) {
    process.exit(playwright.status || 1);
  }

  console.log("\nRunning doctor...");
  const doctor = spawnSync("npm", ["run", "doctor"], { cwd: rootDir, stdio: "inherit", shell: true });

  console.log("\nDone. Start the dashboard with: npm run ui");
  process.exit(doctor.status || 0);
}

main();
