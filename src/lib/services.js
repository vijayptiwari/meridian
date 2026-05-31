const { ensureDir, saveJson, withBrowserSession } = require("./runtime");
const { completeJson } = require("./llm");

function createServices({ rootDir, config, log, browserStateDir, headed }) {
  return {
    log,
    config,
    rootDir,
    ensureDir,
    saveJson,
    llm: {
      completeJson: (input) => completeJson({ ...input, config, log })
    },
    withBrowserSession: ({ portal, task }) =>
      withBrowserSession({
        browserStateDir,
        headed,
        portal,
        task
      })
  };
}

module.exports = { createServices };
