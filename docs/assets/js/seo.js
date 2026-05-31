(function () {
  var SITE_ORIGIN = "https://vijayptiwari.github.io";
  var SITE_PATH = "/meridian";
  var SITE_URL = SITE_ORIGIN + SITE_PATH;
  var SITE_NAME = "Meridian";
  var TWITTER_HANDLE = "@vijayptiwari";
  var AUTHOR = "Vijay Prakash Tiwari";
  var DEFAULT_IMAGE = SITE_URL + "/assets/brand/social-preview.svg";
  var DEFAULT_KEYWORDS =
    "Meridian, job search, career operations, resume tailoring, local-first, open source, AI job agent, LinkedIn jobs, Naukri, upskilling, career transition";

  var PAGES = {
    "index.html": {
      title: "Meridian — Local-first career operations platform",
      description:
        "Open-source career agent for job search, fit scoring, resume tailoring, upskilling, and career transitions. Runs locally on your machine — no cloud upload, no account.",
      keywords:
        "local job search tool, open source career agent, resume tailoring software, LinkedIn job search automation, private job application assistant",
      type: "website",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL + "/",
          description:
            "Open-source local-first career operations platform for job search, resume tailoring, and career planning.",
          inLanguage: "en-US",
          publisher: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL + "/",
            sameAs: ["https://github.com/vijayptiwari/meridian"]
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Career management software",
          operatingSystem: "Windows, macOS, Linux",
          description:
            "Multi-agent job search and career operations tool that runs locally with optional BYOK LLM support.",
          url: SITE_URL + "/",
          downloadUrl: "https://github.com/vijayptiwari/meridian",
          softwareHelp: SITE_URL + "/getting-started.html",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
          },
          author: {
            "@type": "Person",
            name: AUTHOR
          },
          license: "https://opensource.org/licenses/MIT"
        }
      ]
    },
    "getting-started.html": {
      title: "Quickstart — Install and run Meridian locally",
      description:
        "Install Meridian in five minutes: clone the repo, run npm init, start the dashboard at localhost:3030, upload your resume, and run your first job search pipeline.",
      keywords: "Meridian install, npm run ui, local job search setup, Playwright Chromium, career agent quickstart"
    },
    "dashboard.html": {
      title: "Dashboard guide — Meridian local workspace",
      description:
        "Use the Meridian dashboard: upload resume, choose jobs/upskilling/transition goals, manage settings, resume runs from checkpoints, and replay completed pipelines.",
      keywords: "Meridian dashboard, run resume replay, career workspace, local job search UI"
    },
    "configuration.html": {
      title: "Configuration — Meridian profile, portals, and LLM",
      description:
        "Configure Meridian profile, search filters, LinkedIn and Naukri portals, salary guardrails, transition settings, and optional LLM providers.",
      keywords: "Meridian config.json, JOB_AGENT settings, OpenAI Ollama configuration, job search filters"
    },
    "compare.html": {
      title: "Compare — Meridian vs job boards, bots, and AI resume SaaS",
      description:
        "Compare Meridian with job boards, auto-apply bots, and cloud resume SaaS. Local-first, open source, multi-agent, and privacy-preserving career operations.",
      keywords: "Meridian vs LinkedIn, auto apply bot comparison, local-first job search, AI resume SaaS alternative"
    },
    "docs.html": {
      title: "Documentation — Meridian product docs",
      description:
        "Meridian documentation hub: quickstart, dashboard guide, configuration, LLM providers, portals, architecture, privacy, troubleshooting, and roadmap.",
      keywords: "Meridian documentation, career agent docs, job search software guide"
    },
    "llm-providers.html": {
      title: "LLM providers — OpenAI, Ollama, webhook, keyword-only",
      description:
        "Connect OpenAI-compatible APIs, Ollama, Groq, Azure, or custom webhooks to Meridian. Use keyword-only mode with zero API cost.",
      keywords: "Meridian LLM, Ollama job search, BYOK AI career agent, keyword-only resume tailoring"
    },
    "portals.html": {
      title: "Portals — LinkedIn and Naukri setup for Meridian",
      description:
        "Set up LinkedIn and Naukri for Meridian with local Playwright sessions, headed browser login, and persisted browser state on your machine.",
      keywords: "Meridian LinkedIn search, Naukri job automation, Playwright local login, assisted apply"
    },
    "roadmap.html": {
      title: "Roadmap — Meridian product direction",
      description:
        "Meridian product roadmap, release milestones, impact scorecard, and planned features toward a complete local career operations system.",
      keywords: "Meridian roadmap, open source job search roadmap, career agent features"
    },
    "privacy.html": {
      title: "Privacy — Meridian local-first data model",
      description:
        "What stays on your machine with Meridian: resumes, browser sessions, run logs, and checkpoints. Optional LLM API traffic only when configured.",
      keywords: "Meridian privacy, local-first job search, resume data local storage, no cloud upload"
    },
    "troubleshooting.html": {
      title: "Troubleshooting — Fix Meridian install and run issues",
      description:
        "Fix Playwright install errors, portal login issues, LLM connection failures, interrupted runs, port conflicts, and configuration problems in Meridian.",
      keywords: "Meridian troubleshooting, npm run doctor, Playwright fix, resume checkpoint"
    },
    "architecture.html": {
      title: "Architecture — Meridian multi-agent pipeline",
      description:
        "How Meridian orchestrates research, salary, fit scoring, resume tailoring, and apply agents locally with checkpoints and UI server persistence.",
      keywords: "Meridian architecture, multi-agent job search, pipeline orchestrator, local career automation"
    }
  };

  function currentFileName() {
    var segments = location.pathname.split("/").filter(Boolean);
    var last = segments[segments.length - 1] || "";
    if (!last || !/\.html$/i.test(last)) {
      return "index.html";
    }
    return last;
  }

  function upsertMeta(name, content, property) {
    if (!content) {
      return;
    }

    var selector = property ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
    var node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      if (property) {
        node.setAttribute("property", name);
      } else {
        node.setAttribute("name", name);
      }
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function upsertLink(rel, href) {
    if (!href) {
      return;
    }

    var node = document.head.querySelector('link[rel="' + rel + '"]');
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", rel);
      document.head.appendChild(node);
    }
    node.setAttribute("href", href);
  }

  function upsertJsonLd(payload) {
    var node = document.createElement("script");
    node.type = "application/ld+json";
    node.textContent = JSON.stringify(payload);
    document.head.appendChild(node);
  }

  var fileName = currentFileName();
  var page = PAGES[fileName] || PAGES["index.html"];
  var canonicalPath = fileName === "index.html" ? "/" : "/" + fileName;
  var canonicalUrl = SITE_URL + canonicalPath;
  var ogType = page.type || "article";

  document.title = page.title;
  upsertMeta("description", page.description);
  upsertMeta("keywords", page.keywords || DEFAULT_KEYWORDS);
  upsertMeta("author", AUTHOR);
  upsertMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  upsertMeta("googlebot", "index, follow, max-image-preview:large");
  upsertMeta("bingbot", "index, follow");
  upsertMeta("theme-color", "#ffffff");

  upsertLink("canonical", canonicalUrl);
  upsertLink("sitemap", SITE_URL + "/sitemap.xml");

  upsertMeta("og:site_name", SITE_NAME, true);
  upsertMeta("og:locale", "en_US", true);
  upsertMeta("og:type", ogType, true);
  upsertMeta("og:url", canonicalUrl, true);
  upsertMeta("og:title", page.title, true);
  upsertMeta("og:description", page.description, true);
  upsertMeta("og:image", DEFAULT_IMAGE, true);
  upsertMeta("og:image:alt", "Meridian — Align your next move. Local-first career operations platform.", true);

  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:site", TWITTER_HANDLE);
  upsertMeta("twitter:title", page.title);
  upsertMeta("twitter:description", page.description);
  upsertMeta("twitter:image", DEFAULT_IMAGE);
  upsertMeta("twitter:image:alt", "Meridian — local-first career operations platform");

  if (Array.isArray(page.jsonLd)) {
    page.jsonLd.forEach(upsertJsonLd);
  } else if (fileName !== "index.html") {
    upsertJsonLd({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      description: page.description,
      url: canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL + "/"
      }
    });
  }
})();
