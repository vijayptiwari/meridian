const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { normalize, unique } = require("./job-analysis");

const headingAliases = {
  summary: ["summary", "professional summary", "profile", "objective", "about me"],
  skills: ["skills", "technical skills", "core skills", "key skills", "competencies"],
  experience: ["experience", "work experience", "professional experience", "employment history", "work history"],
  projects: ["projects", "project experience", "selected projects"],
  education: ["education", "academic background", "qualifications"],
  certifications: ["certifications", "licenses", "certificates"]
};

const skillVocabulary = [
  "Java",
  "Python",
  "JavaScript",
  "TypeScript",
  "Node.js",
  "React",
  "Angular",
  "Vue",
  "Next.js",
  "Spring Boot",
  "Spring",
  "Microservices",
  "REST APIs",
  "SOAP APIs",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Couchbase",
  "Kafka",
  "Confluent Kafka Streams",
  "Docker",
  "Kubernetes",
  "OpenShift",
  "AWS",
  "Azure",
  "GCP",
  "Linux",
  "TIBCO BusinessEvents",
  "TIBCO BusinessWorks",
  "TIBCO Spotfire",
  "Data Analytics",
  "Data Visualization",
  "System Architecture",
  "Solution Architecture",
  "Technical Design",
  "Technical Leadership",
  "Stakeholder Communication",
  "Platform Design",
  "AI Agent Development",
  "Context Engineering",
  "RAG Development",
  "Prompt Engineering",
  "LLM Application Development",
  "Vector Databases",
  "Knowledge Retrieval",
  "Workflow Automation",
  "Machine Learning",
  "Generative AI",
  "CI/CD",
  "Testing",
  "Agile"
];

const roleKeywordMap = [
  {
    keywords: ["architect", "architecture", "solution", "technical design", "platform design"],
    titles: ["Solution Architect", "Technical Architect", "Platform Architect"]
  },
  {
    keywords: ["leadership", "technical leadership", "stakeholder", "owner", "solutioning"],
    titles: ["Technical Lead", "Engineering Lead", "Lead Software Engineer"]
  },
  {
    keywords: ["java", "spring boot", "microservices", "kafka", "rest apis"],
    titles: ["Senior Software Engineer", "Backend Engineer", "Java Developer"]
  },
  {
    keywords: ["react", "frontend", "javascript", "typescript", "next.js"],
    titles: ["Frontend Engineer", "Full Stack Engineer", "Software Engineer"]
  },
  {
    keywords: ["ai agent development", "llm", "rag", "prompt engineering", "vector databases", "generative ai"],
    titles: ["AI Engineer", "Applied AI Engineer", "LLM Engineer", "Agent Engineer", "RAG Engineer"]
  },
  {
    keywords: ["data analytics", "data visualization", "spotfire", "analytics"],
    titles: ["Data Engineer", "Analytics Engineer", "BI Engineer"]
  }
];

function extractResumeTextWithPython(filePath) {
  const pythonExecutable = process.env.JOB_AGENT_PYTHON_PATH || "python";
  const extractorScriptPath = path.join(__dirname, "..", "ui", "scripts", "extract_resume_text.py");
  const result = spawnSync(pythonExecutable, [extractorScriptPath, filePath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Resume text extraction failed.");
  }

  const parsed = JSON.parse(result.stdout || "{}");
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return String(parsed.text || "");
}

async function extractResumeTextWithNode(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return String(result.value || "").trim();
  }

  if (extension === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return String(result.text || "").trim();
  }

  if ([".txt", ".md"].includes(extension)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }

  throw new Error(`Unsupported resume format: ${extension || "unknown"}`);
}

async function extractResumeText(filePath) {
  try {
    const text = await extractResumeTextWithNode(filePath);
    if (text) {
      return text;
    }
  } catch (error) {
    if (![".pdf", ".docx"].includes(path.extname(filePath).toLowerCase())) {
      throw error;
    }
  }

  return extractResumeTextWithPython(filePath);
}

function safeFileName(value) {
  return String(value || "resume").replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-").toLowerCase();
}

function splitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim());
}

function isLetterSpacedChunk(chunk) {
  const tokens = String(chunk || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) {
    return false;
  }

  const shortTokens = tokens.filter((token) => token.length === 1 || /^[()\-+@.,%&/]$/.test(token)).length;
  if (shortTokens === tokens.length) {
    return true;
  }

  if (tokens.length < 4) {
    return false;
  }

  return shortTokens / tokens.length >= 0.6;
}

function normalizeExtractedLine(line) {
  const trimmed = String(line || "").replace(/\u00a0/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed
    .split(/\s{2,}/)
    .map((chunk) => {
      const collapsed = isLetterSpacedChunk(chunk) ? chunk.replace(/\s+/g, "") : chunk.replace(/\s+/g, " ").trim();
      return collapsed;
    })
    .join(" ")
    .replace(/(\+?\d[\d-]{8,})([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(?:co\.in|com|in|org|net|edu))([A-Z][a-z])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized;
}

function normalizeExtractedText(text) {
  return splitLines(text)
    .map(normalizeExtractedLine)
    .join("\n");
}

function detectHeading(line) {
  const normalizedLine = normalize(line).replace(/[:\-]+$/g, "").trim();
  if (!normalizedLine || normalizedLine.length > 40) {
    return null;
  }

  for (const [section, aliases] of Object.entries(headingAliases)) {
    if (aliases.includes(normalizedLine)) {
      return section;
    }
  }

  return null;
}

function splitSections(text) {
  const lines = splitLines(text);
  const sections = {
    header: []
  };
  let current = "header";

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      sections[current] = sections[current] || [];
      continue;
    }

    sections[current] = sections[current] || [];
    sections[current].push(line);
  }

  return sections;
}

function firstMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? match[0] : "";
}

function extractEmail(text) {
  const direct = firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:CO\.IN|COM|IN|ORG|NET|EDU)/i);
  if (direct) {
    return direct;
  }

  const compact = String(text || "").replace(/\s+/g, "");
  return firstMatch(compact, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:CO\.IN|COM|IN|ORG|NET|EDU)/i);
}

function extractPhone(text) {
  const matches =
    String(text || "").match(/(?:\+?\d[\d\s().-]{8,}\d)/g) ||
    String(text || "")
      .replace(/\s+/g, "")
      .match(/(?:\+?\d[\d().-]{8,}\d)/g) ||
    [];
  const candidates = matches
    .map((item) => item.trim())
    .filter((item) => item.replace(/\D/g, "").length >= 10)
    .sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length);
  return candidates[0] || "";
}

function extractUrl(text, includesText) {
  const matches = String(text || "").match(/https?:\/\/[^\s)]+/gi) || [];
  return matches.find((match) => normalize(match).includes(includesText)) || "";
}

function looksLikePersonName(line) {
  if (!line) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (/\d|@|https?:\/\//i.test(line)) return false;
  return words.every((word) => /^[A-Za-z.'-]+$/.test(word));
}

function looksLikeTitle(line) {
  return /\b(engineer|developer|architect|manager|lead|consultant|analyst|designer|scientist|specialist|director|head|principal|staff)\b/i.test(
    line
  );
}

function guessName(sections) {
  const headerLines = (sections.header || []).filter(Boolean);
  return headerLines.find(looksLikePersonName) || "";
}

function guessCurrentTitle(sections) {
  const headerLines = (sections.header || []).filter(Boolean);
  const titleLine = headerLines.find((line) => looksLikeTitle(line) && !line.includes("@"));
  if (titleLine) {
    return titleLine;
  }

  const experienceLines = (sections.experience || []).filter(Boolean);
  const experienceTitle = experienceLines.find(looksLikeTitle);
  if (!experienceTitle) {
    return "";
  }

  const { title, company } = splitHeadline(experienceTitle);
  if (company && /\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b/gi.test(company)) {
    return title;
  }

  return experienceTitle;
}

function guessLocation(sections) {
  const candidateLines = [...(sections.header || []), ...(sections.summary || [])].filter(Boolean);
  for (const line of candidateLines) {
    const trailingLocation = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/);
    if (trailingLocation) {
      return trailingLocation[1];
    }
  }

  const candidate = candidateLines.find(
    (line) =>
      !line.includes("@") &&
      !/\d/.test(line) &&
      !/^https?:\/\//i.test(line) &&
      !looksLikePersonName(line) &&
      !looksLikeTitle(line) &&
      /,/.test(line) &&
      line.length < 80
  );
  return candidate || "";
}

function extractExperienceYears(text) {
  const matches = [...String(text || "").matchAll(/(\d{1,2})\+?\s+years?/gi)].map((match) => Number(match[1]));
  if (matches.length) {
    return Math.max(...matches);
  }
  return 0;
}

function parseSectionSkills(lines) {
  return unique(
    (lines || [])
      .join(" | ")
      .split(/[,|/•·]/)
      .map((value) => value.replace(/^[-*]\s*/, "").trim())
      .filter((value) => value && value.length <= 40)
  );
}

function extractSkills(sections, text, currentConfig) {
  const skillText = normalize(text);
  const bySection = parseSectionSkills(sections.skills || []);
  const byVocabulary = skillVocabulary.filter((skill) => skillText.includes(normalize(skill)));
  return unique([...bySection, ...byVocabulary]).slice(0, 40);
}

function extractSummary(sections, currentTitle, currentConfig) {
  const sectionSummary = (sections.summary || [])
    .filter(Boolean)
    .filter((line) => !extractEmail(line) && !extractPhone(line))
    .join(" ");
  if (sectionSummary) {
    return sectionSummary;
  }

  const headerLines = (sections.header || []).filter(Boolean);
  const summaryLines = headerLines.filter(
    (line) =>
      !looksLikePersonName(line) &&
      line !== currentTitle &&
      !line.includes("@") &&
      !/^https?:\/\//i.test(line) &&
      line.length > 35
  );
  if (summaryLines.length) {
    return summaryLines.slice(0, 3).join(" ");
  }

  return "";
}

function splitBlocks(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines || []) {
    if (!line) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
}

function isBullet(line) {
  return /^[-*•]/.test(line) || /^[A-Za-z].{15,}/.test(line);
}

function stripBullet(line) {
  return line.replace(/^[-*•]\s*/, "").trim();
}

function splitHeadline(line) {
  const separators = [" at ", " | ", " - ", " – ", ","];
  for (const separator of separators) {
    if (line.includes(separator)) {
      const [first, second] = line.split(separator).map((part) => part.trim());
      return {
        title: first || line,
        company: second || ""
      };
    }
  }

  return {
    title: line,
    company: ""
  };
}

function parseExperience(lines) {
  const blocks = splitBlocks(lines);

  return blocks
    .map((block) => {
      const cleaned = block.filter(Boolean);
      if (!cleaned.length) {
        return null;
      }

      const headline = cleaned[0];
      const { title, company } = splitHeadline(headline);
      const datesLine =
        cleaned.find((line) => /\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b/gi.test(line)) || "";
      const companyLooksLikeDate = company && /\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b/gi.test(company);
      const companyLine =
        cleaned.slice(1).find((line) => !/\b(19|20)\d{2}\b|\bpresent\b|\bcurrent\b/gi.test(line) && !isBullet(line)) || "";
      const metadataLines = cleaned.slice(1).filter((line) => line !== datesLine);
      const bullets = metadataLines.filter((line) => isBullet(line)).map(stripBullet).slice(0, 5);
      const fallbackBullets = metadataLines
        .filter((line) => line !== datesLine)
        .map(stripBullet)
        .slice(0, 4);

      return {
        company: companyLooksLikeDate ? companyLine : company || companyLine,
        title,
        dates: datesLine,
        location: "",
        bullets: bullets.length ? bullets : fallbackBullets
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function parseProjects(lines) {
  return splitBlocks(lines)
    .map((block) => {
      const cleaned = block.filter(Boolean);
      if (!cleaned.length) {
        return null;
      }

      return {
        name: cleaned[0],
        description: cleaned.slice(1).join(" ") || cleaned[0]
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function parseEducation(lines) {
  return splitBlocks(lines)
    .map((block) => {
      const cleaned = block.filter(Boolean);
      if (!cleaned.length) {
        return null;
      }

      return {
        degree: cleaned[0] || "",
        institution: cleaned[1] || "",
        dates: cleaned.find((line) => /\b(19|20)\d{2}\b/.test(line)) || ""
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function inferTargetTitles(skills, currentTitle) {
  const haystack = normalize(skills.join(" "));
  const inferred = roleKeywordMap.flatMap((group) =>
    group.keywords.some((keyword) => haystack.includes(keyword)) ? group.titles : []
  );
  return unique([currentTitle, ...inferred].filter(Boolean)).slice(0, 12);
}

function inferSearchQueries(targetTitles, skills) {
  const topSkills = skills.slice(0, 4);
  return unique(
    targetTitles
      .slice(0, 8)
      .map((title, index) => [title, topSkills[index % Math.max(topSkills.length, 1)], topSkills[(index + 1) % Math.max(topSkills.length, 1)]]
        .filter(Boolean)
        .join(" "))
  ).slice(0, 8);
}

function buildMasterResume(profile, sections, currentConfig) {
  return {
    basics: {
      name: profile.name || "Your Name",
      title: profile.currentTitle || "Professional",
      email: profile.email || "",
      phone: profile.phone || "",
      location: profile.location || "",
      linkedin: profile.linkedin || "",
      github: profile.github || ""
    },
    summary: profile.resumeSummary || "",
    skills: profile.skills || [],
    experience: parseExperience(sections.experience || []),
    projects: parseProjects(sections.projects || []),
    education: parseEducation(sections.education || [])
  };
}

function buildConfigDraft(currentConfig, profile, masterResumeRelativePath) {
  const next = structuredClone(currentConfig);
  next.profile.name = profile.name || "";
  next.profile.currentTitle = profile.currentTitle || "";
  next.profile.email = profile.email || "";
  next.profile.phone = profile.phone || "";
  next.profile.linkedin = profile.linkedin || "";
  next.profile.github = profile.github || "";
  next.profile.experienceYears = profile.experienceYears || 0;
  next.profile.resumeSummary = profile.resumeSummary || "";
  next.profile.skills = profile.skills?.length ? profile.skills : [];
  next.profile.targetTitles = profile.targetTitles?.length ? profile.targetTitles : [];
  next.preferences.searchQueries = profile.searchQueries?.length ? profile.searchQueries : [];
  next.locationPolicy = next.locationPolicy || {};
  next.locationPolicy.expectedPhysicalLocation = profile.location || "";
  next.resume = next.resume || {};
  next.resume.masterResumePath = masterResumeRelativePath;
  return next;
}

function parseResumeProfile(text, sections, currentConfig) {
  const name = guessName(sections) || "";
  const currentTitle = guessCurrentTitle(sections) || "";
  const email = extractEmail(text) || "";
  const phone = extractPhone(text) || "";
  const linkedin = extractUrl(text, "linkedin.com") || "";
  const github = extractUrl(text, "github.com") || "";
  const experienceYears = extractExperienceYears(text);
  const skills = extractSkills(sections, text, currentConfig);
  const resumeSummary = extractSummary(sections, currentTitle, currentConfig);
  const targetTitles = inferTargetTitles(skills, currentTitle);
  const searchQueries = inferSearchQueries(targetTitles, skills);
  const location = guessLocation(sections);

  return {
    name,
    currentTitle,
    email,
    phone,
    linkedin,
    github,
    experienceYears,
    skills,
    resumeSummary,
    targetTitles,
    searchQueries,
    location
  };
}

async function parseResumeUpload({ rootDir, uploadedFilePath, currentConfig }) {
  const rawText = await extractResumeText(uploadedFilePath);
  const text = normalizeExtractedText(rawText);
  const sections = splitSections(text);
  const profileDraft = parseResumeProfile(text, sections, currentConfig);
  const masterResume = buildMasterResume(profileDraft, sections, currentConfig);
  const masterResumeRelativePath = path.join("resume", "auto-master-resume.json");
  const masterResumePath = path.join(rootDir, masterResumeRelativePath);

  fs.mkdirSync(path.dirname(masterResumePath), { recursive: true });
  fs.writeFileSync(masterResumePath, JSON.stringify(masterResume, null, 2), "utf8");

  return {
    fileName: path.basename(uploadedFilePath),
    uploadedFilePath,
    profileDraft,
    configDraft: buildConfigDraft(currentConfig, profileDraft, masterResumeRelativePath),
    masterResumePath,
    extractedTextPreview: splitLines(text).filter(Boolean).slice(0, 18).join("\n"),
    detected: {
      skills: profileDraft.skills.length,
      targetTitles: profileDraft.targetTitles.length,
      searchQueries: profileDraft.searchQueries.length
    }
  };
}

function writeUploadedResume(base64Content, originalFileName, uploadDir) {
  const extension = path.extname(originalFileName || "").toLowerCase();
  const allowedExtensions = new Set([".pdf", ".docx", ".txt", ".md"]);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Only PDF, DOCX, TXT, and MD resumes are supported.");
  }

  const fileName = `${Date.now()}-${safeFileName(path.basename(originalFileName, extension))}${extension}`;
  const destinationPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(base64Content, "base64");

  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(destinationPath, buffer);

  return destinationPath;
}

module.exports = {
  parseResumeUpload,
  writeUploadedResume
};
