function createLogger() {
  return {
    info(message) {
      console.log(`[job-agent] ${message}`);
    },
    warn(message) {
      console.warn(`[job-agent] ${message}`);
    },
    child(scope) {
      return {
        info(message) {
          console.log(`[job-agent:${scope}] ${message}`);
        },
        warn(message) {
          console.warn(`[job-agent:${scope}] ${message}`);
        }
      };
    }
  };
}

module.exports = { createLogger };
