const fs = require("fs");
const path = require("path");

const WIZARD_STEPS = ["resume", "demo", "filters", "llm", "portal"];

function wizardStatePath(rootDir) {
  return path.join(rootDir, "data", "ui", "wizard-state.json");
}

function readWizardState(rootDir) {
  const filePath = wizardStatePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return {
      completedSteps: [],
      portalAcknowledged: false,
      dismissed: false
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
      portalAcknowledged: Boolean(parsed.portalAcknowledged),
      dismissed: Boolean(parsed.dismissed)
    };
  } catch {
    return {
      completedSteps: [],
      portalAcknowledged: false,
      dismissed: false
    };
  }
}

function writeWizardState(rootDir, state) {
  const filePath = wizardStatePath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

function completeWizardStep(rootDir, step) {
  const state = readWizardState(rootDir);
  if (!state.completedSteps.includes(step)) {
    state.completedSteps.push(step);
  }
  writeWizardState(rootDir, state);
  return state;
}

function acknowledgePortalTerms(rootDir) {
  const state = readWizardState(rootDir);
  state.portalAcknowledged = true;
  writeWizardState(rootDir, state);
  return state;
}

function dismissWizard(rootDir) {
  const state = readWizardState(rootDir);
  state.dismissed = true;
  writeWizardState(rootDir, state);
  return state;
}

function buildWizardStatus(setupStatus, wizardState) {
  const stepStatus = {
    resume: setupStatus.resume,
    demo: wizardState.completedSteps.includes("demo"),
    filters: setupStatus.filters,
    llm: setupStatus.llm,
    portal: wizardState.portalAcknowledged
  };

  const requiredComplete =
    stepStatus.resume && stepStatus.demo && stepStatus.filters;
  const currentStep =
    WIZARD_STEPS.find((step) => !stepStatus[step] && (step !== "llm" && step !== "portal")) ||
    (stepStatus.llm ? null : "llm") ||
    (stepStatus.portal ? null : "portal") ||
    null;

  return {
    steps: stepStatus,
    currentStep,
    complete: requiredComplete,
    dismissed: wizardState.dismissed,
    portalAcknowledged: wizardState.portalAcknowledged,
    demoRequiredBeforeRun: !stepStatus.demo
  };
}

module.exports = {
  WIZARD_STEPS,
  readWizardState,
  writeWizardState,
  completeWizardStep,
  acknowledgePortalTerms,
  dismissWizard,
  buildWizardStatus
};
