const { spawnSync } = require("child_process");

if (process.env.MERIDIAN_SKIP_PLAYWRIGHT_INSTALL === "1") {
  console.log("[meridian] Skipping Playwright browser install (MERIDIAN_SKIP_PLAYWRIGHT_INSTALL=1).");
  process.exit(0);
}

const result = spawnSync("npx", ["playwright", "install", "chromium"], {
  stdio: "inherit",
  shell: true
});

if (result.status !== 0) {
  console.warn(
    "[meridian] Playwright browser install failed. Run manually: npx playwright install chromium"
  );
}
