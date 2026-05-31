const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const { completeJson } = require("./llm");
const { normalize, extractKeywordsFromJob, unique } = require("./job-analysis");

function sanitizeFileName(value) {
  return String(value || "resume").replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-").toLowerCase();
}

function loadMasterResume(rootDir, config) {
  const resumePath = path.join(rootDir, config.resume?.masterResumePath || "resume/master-resume.json");

  if (!fs.existsSync(resumePath)) {
    throw new Error(`Master resume file not found at ${resumePath}`);
  }

  return JSON.parse(fs.readFileSync(resumePath, "utf8"));
}

function fallbackTailorResume(masterResume, job) {
  const keywords = extractKeywordsFromJob(job);
  const prioritizedSkills = unique([
    ...masterResume.skills.filter((skill) => keywords.some((keyword) => normalize(skill).includes(keyword))),
    ...masterResume.skills
  ]).slice(0, 12);

  const experience = (masterResume.experience || []).map((role) => {
    const rankedBullets = [...(role.bullets || [])]
      .map((bullet) => ({
        bullet,
        score: keywords.reduce((sum, keyword) => sum + (normalize(bullet).includes(keyword) ? 1 : 0), 0)
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.bullet)
      .slice(0, 4);

    return {
      ...role,
      bullets: rankedBullets
    };
  });

  const summaryParts = [
    masterResume.summary,
    keywords.length ? `Targeted for roles emphasizing ${keywords.join(", ")}.` : "",
    job.title ? `Aligned to ${job.title} opportunities.` : ""
  ].filter(Boolean);

  return {
    summary: summaryParts.join(" "),
    skills: prioritizedSkills,
    experience,
    projects: masterResume.projects || [],
    education: masterResume.education || [],
    atsKeywords: keywords,
    tailoringNotes: "Fallback tailoring used keyword extraction and bullet prioritization."
  };
}

async function llmTailorResume(masterResume, job, config, log) {
  return completeJson({
    config,
    systemPrompt:
      "You are tailoring a resume for ATS optimization and recruiter readability. Do not invent experience, technologies, employers, education, or metrics that are not supported by the source resume. Reorder, compress, and rewrite using only truthful source material. Return strict JSON with summary, skills, experience, projects, education, atsKeywords, and tailoringNotes.",
    userPayload: {
      candidateProfile: config.profile,
      sourceResume: masterResume,
      targetJob: {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        tags: job.tags,
        portal: job.portal
      }
    },
    log
  });
}

function renderMarkdown(masterResume, tailoredResume, job) {
  const basics = masterResume.basics || {};
  const lines = [];

  lines.push(`# ${basics.name || ""}`.trim());
  lines.push([basics.title, basics.location].filter(Boolean).join(" | "));
  lines.push([basics.email, basics.phone].filter(Boolean).join(" | "));
  lines.push([basics.linkedin, basics.github].filter(Boolean).join(" | "));
  lines.push("");
  lines.push(`## Target Role`);
  lines.push(`${job.title || ""} at ${job.company || ""}`.trim());
  lines.push("");
  lines.push("## Professional Summary");
  lines.push(tailoredResume.summary || "");
  lines.push("");
  lines.push("## Core Skills");
  lines.push((tailoredResume.skills || []).join(" | "));
  lines.push("");
  lines.push("## Professional Experience");

  for (const role of tailoredResume.experience || []) {
    lines.push(`### ${role.title} | ${role.company}`);
    lines.push([role.dates, role.location].filter(Boolean).join(" | "));
    for (const bullet of role.bullets || []) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  if ((tailoredResume.projects || []).length) {
    lines.push("## Projects");
    for (const project of tailoredResume.projects) {
      lines.push(`### ${project.name}`);
      lines.push(project.description || "");
      lines.push("");
    }
  }

  if ((tailoredResume.education || []).length) {
    lines.push("## Education");
    for (const item of tailoredResume.education) {
      lines.push(`### ${item.degree}`);
      lines.push([item.institution, item.dates].filter(Boolean).join(" | "));
      lines.push("");
    }
  }

  if ((tailoredResume.atsKeywords || []).length) {
    lines.push("## ATS Keywords");
    lines.push((tailoredResume.atsKeywords || []).join(", "));
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function renderPlainText(masterResume, tailoredResume, job) {
  return renderMarkdown(masterResume, tailoredResume, job).replace(/^#+\s/gm, "").replace(/\|/g, " - ");
}

function paragraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    spacing: { after: options.after ?? 120 },
    children: [new TextRun({ text: text || "", bold: !!options.bold })]
  });
}

async function writeDocx(filePath, masterResume, tailoredResume, job) {
  const basics = masterResume.basics || {};
  const children = [];

  children.push(paragraph(basics.name || "", { heading: HeadingLevel.TITLE, after: 80 }));
  children.push(
    paragraph(
      [basics.title, basics.location, basics.email, basics.phone].filter(Boolean).join(" | "),
      { after: 160 }
    )
  );
  children.push(paragraph("Professional Summary", { heading: HeadingLevel.HEADING_1 }));
  children.push(paragraph(tailoredResume.summary || ""));
  children.push(paragraph("Core Skills", { heading: HeadingLevel.HEADING_1 }));
  children.push(paragraph((tailoredResume.skills || []).join(" | ")));
  children.push(paragraph("Professional Experience", { heading: HeadingLevel.HEADING_1 }));

  for (const role of tailoredResume.experience || []) {
    children.push(paragraph(`${role.title || ""} | ${role.company || ""}`, { bold: true, after: 60 }));
    children.push(paragraph([role.dates, role.location].filter(Boolean).join(" | "), { after: 80 }));
    for (const bullet of role.bullets || []) {
      children.push(
        new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 60 }
        })
      );
    }
  }

  if ((tailoredResume.projects || []).length) {
    children.push(paragraph("Projects", { heading: HeadingLevel.HEADING_1 }));
    for (const project of tailoredResume.projects) {
      children.push(paragraph(project.name || "", { bold: true, after: 60 }));
      children.push(paragraph(project.description || ""));
    }
  }

  if ((tailoredResume.education || []).length) {
    children.push(paragraph("Education", { heading: HeadingLevel.HEADING_1 }));
    for (const item of tailoredResume.education) {
      children.push(paragraph(item.degree || "", { bold: true, after: 60 }));
      children.push(paragraph([item.institution, item.dates].filter(Boolean).join(" | ")));
    }
  }

  children.push(paragraph("Target Role", { heading: HeadingLevel.HEADING_1 }));
  children.push(paragraph(`${job.title || ""} at ${job.company || ""}`.trim()));

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(filePath, buffer);
}

async function tailorResumeForJobs({ rootDir, outputDir, jobs, config, log }) {
  const masterResume = loadMasterResume(rootDir, config);
  const limit = config.resume?.maxTailoredResumesPerRun || jobs.length;
  const selectedJobs = jobs.slice(0, limit);
  const tailoredDir = path.join(outputDir, "tailored-resumes");

  await fs.promises.mkdir(tailoredDir, { recursive: true });

  const results = [];

  for (const job of selectedJobs) {
    log.info(`Tailoring resume for ${job.title} at ${job.company}`);

    const tailoredResume =
      (await llmTailorResume(masterResume, job, config, log)) || fallbackTailorResume(masterResume, job);

    const slug = sanitizeFileName(`${job.portal}-${job.company}-${job.title}`);
    const markdownPath = path.join(tailoredDir, `${slug}.md`);
    const textPath = path.join(tailoredDir, `${slug}.txt`);
    const jsonPath = path.join(tailoredDir, `${slug}.json`);
    const docxPath = path.join(tailoredDir, `${slug}.docx`);

    await fs.promises.writeFile(markdownPath, renderMarkdown(masterResume, tailoredResume, job), "utf8");
    await fs.promises.writeFile(textPath, renderPlainText(masterResume, tailoredResume, job), "utf8");
    await fs.promises.writeFile(
      jsonPath,
      JSON.stringify(
        {
          job,
          tailoredResume
        },
        null,
        2
      ),
      "utf8"
    );
    await writeDocx(docxPath, masterResume, tailoredResume, job);

    results.push({
      jobId: job.id,
      markdownPath,
      textPath,
      jsonPath,
      docxPath,
      atsKeywords: tailoredResume.atsKeywords || [],
      tailoringNotes: tailoredResume.tailoringNotes || ""
    });
  }

  return results;
}

module.exports = { tailorResumeForJobs };
