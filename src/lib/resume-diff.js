const fs = require("fs");
const path = require("path");

function loadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function flattenResume(resume) {
  if (!resume) {
    return {};
  }

  return {
    summary: String(resume.summary || ""),
    skills: (resume.skills || []).join(", "),
    experience: (resume.experience || [])
      .map((role) => `${role.title} @ ${role.company}: ${(role.bullets || []).join(" ")}`)
      .join("\n"),
    projects: (resume.projects || []).map((item) => `${item.name}: ${item.description}`).join("\n"),
    education: (resume.education || []).map((item) => `${item.degree} - ${item.institution}`).join("\n")
  };
}

function diffText(before, after) {
  const beforeText = String(before || "").trim();
  const afterText = String(after || "").trim();

  if (beforeText === afterText) {
    return { changed: false, before: beforeText, after: afterText };
  }

  return { changed: true, before: beforeText, after: afterText };
}

function buildResumeDiff(rootDir, tailoredJsonPath) {
  const masterPath = path.join(rootDir, "resume", "master-resume.json");
  const autoPath = path.join(rootDir, "resume", "auto-master-resume.json");
  const master = loadJson(fs.existsSync(masterPath) ? masterPath : autoPath);
  const tailored = loadJson(tailoredJsonPath);

  if (!master || !tailored) {
    return {
      ok: false,
      error: "Master or tailored resume JSON not found.",
      sections: []
    };
  }

  const masterFlat = flattenResume(master);
  const tailoredFlat = flattenResume(tailored);
  const sections = Object.keys(masterFlat).map((key) => ({
    id: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    ...diffText(masterFlat[key], tailoredFlat[key])
  }));

  return {
    ok: true,
    sections,
    changedSections: sections.filter((section) => section.changed).map((section) => section.id)
  };
}

module.exports = { buildResumeDiff };
