(function () {
  const REPO = "https://github.com/vijayptiwari/meridian";
  const LICENSE = REPO + "/blob/main/LICENSE";
  const DOCS_HOME = "index.html";
  const DEFAULT_DASHBOARD_URL = "http://127.0.0.1:3030";
  const DASHBOARD_STORAGE_KEY = "meridian-dashboard-url";

  const NAV = [
    { href: "index.html", label: "Overview", id: "home" },
    { href: "compare.html", label: "Compare", id: "compare" },
    { href: "getting-started.html", label: "Get started", id: "getting-started" },
    { href: "docs.html", label: "Documentation", id: "docs" }
  ];

  const DOC_LINKS = [
    { href: "getting-started.html", label: "Quickstart" },
    { href: "dashboard.html", label: "Dashboard guide" },
    { href: "configuration.html", label: "Configuration" },
    { href: "llm-providers.html", label: "LLM providers" },
    { href: "portals.html", label: "Portals" },
    { href: "roadmap.html", label: "Roadmap" },
    { href: "privacy.html", label: "Privacy" },
    { href: "troubleshooting.html", label: "Troubleshooting" },
    { href: "architecture.html", label: "Architecture" },
    { href: "compare.html", label: "Why Meridian" }
  ];

  function normalizeDashboardUrl(value) {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(String(value).trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      const pathname = url.pathname.replace(/\/$/, "");
      return url.origin + pathname;
    } catch {
      return null;
    }
  }

  function resolveDashboardUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeDashboardUrl(params.get("dashboard"));

    if (fromQuery) {
      try {
        localStorage.setItem(DASHBOARD_STORAGE_KEY, fromQuery);
      } catch {
        /* ignore storage failures */
      }
      return fromQuery;
    }

    try {
      const stored = normalizeDashboardUrl(localStorage.getItem(DASHBOARD_STORAGE_KEY));
      if (stored) {
        return stored;
      }
    } catch {
      /* ignore storage failures */
    }

    return DEFAULT_DASHBOARD_URL;
  }

  function currentPage() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return path === "" ? "index.html" : path;
  }

  function navLink(item, active) {
    const isActive = active === item.id || active === item.href.replace(".html", "");
    return (
      '<a class="site-nav__link' +
      (isActive ? " is-active" : "") +
      '" href="' +
      item.href +
      '">' +
      item.label +
      "</a>"
    );
  }

  function dashboardLink(label, className) {
    return (
      '<a class="' +
      className +
      '" data-dashboard-open href="' +
      DEFAULT_DASHBOARD_URL +
      '" target="_blank" rel="noopener noreferrer">' +
      label +
      "</a>"
    );
  }

  function renderHeader(active) {
    const page = active || currentPage().replace(".html", "");
    return (
      '<header class="site-header" data-header>' +
      '<div class="site-shell site-shell--full">' +
      '<div class="site-header__inner">' +
      '<a class="site-brand site-brand--lockup" href="index.html">' +
      '<img src="assets/brand/logo-full.svg" width="132" height="32" alt="Meridian" /></a>' +
      '<nav class="site-nav" aria-label="Primary">' +
      NAV.map(function (item) {
        return navLink(item, page === "index" ? "home" : page);
      }).join("") +
      "</nav>" +
      '<div class="site-header__actions">' +
      dashboardLink("Dashboard", "btn btn--secondary btn--sm") +
      '<a class="btn btn--ghost btn--sm" href="' +
      REPO +
      '" target="_blank" rel="noopener">GitHub</a>' +
      '<a class="btn btn--primary btn--sm" href="getting-started.html">Get started</a>' +
      '<button class="site-nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-nav-toggle>' +
      "<span></span><span></span><span></span></button>" +
      "</div></div></div></header>"
    );
  }

  function renderFooter() {
    return (
      '<footer class="site-footer">' +
      '<div class="site-shell site-shell--full site-footer__grid">' +
      '<div class="site-footer__brand">' +
      '<a class="site-brand site-brand--lockup" href="index.html">' +
      '<img src="assets/brand/logo-full.svg" width="120" height="28" alt="Meridian" /></a>' +
      '<p class="site-footer__tagline">Career operations platform. Open source, local-first, built for professionals.</p>' +
      "</div>" +
      '<div><h3 class="site-footer__heading">Product</h3><ul class="site-footer__links">' +
      '<li>' +
      dashboardLink("Self-hosted dashboard", "") +
      "</li>" +
      '<li><a href="compare.html">Why Meridian</a></li>' +
      '<li><a href="dashboard.html">Dashboard guide</a></li>' +
      '<li><a href="getting-started.html">Quickstart</a></li>' +
      '<li><a href="docs.html">Documentation</a></li>' +
      "</ul></div>" +
      '<div><h3 class="site-footer__heading">Docs</h3><ul class="site-footer__links">' +
      DOC_LINKS.slice(0, 4)
        .map(function (l) {
          return '<li><a href="' + l.href + '">' + l.label + "</a></li>";
        })
        .join("") +
      "</ul></div>" +
      '<div><h3 class="site-footer__heading">Project</h3><ul class="site-footer__links">' +
      '<li><a href="' +
      REPO +
      '" target="_blank" rel="noopener">Source code</a></li>' +
      '<li><a href="' +
      REPO +
      '/issues" target="_blank" rel="noopener">Issues</a></li>' +
      '<li><a href="' +
      LICENSE +
      '" target="_blank" rel="noopener">MIT License</a></li>' +
      "</ul></div>" +
      "</div>" +
      '<div class="site-shell site-shell--full site-footer__bottom">' +
      "<span>© " +
      new Date().getFullYear() +
      " Meridian contributors</span>" +
      '<span>Your data stays on your machine. No account required.</span>' +
      "</div></footer>"
    );
  }

  function renderDocSidebar(activeHref) {
    const page = activeHref || currentPage();
    return (
      '<aside class="doc-sidebar" aria-label="Documentation">' +
      "<h2 class=" +
      '"doc-sidebar__title">Documentation</h2>' +
      '<nav class="doc-sidebar__nav">' +
      DOC_LINKS.map(function (link) {
        return (
          '<a class="doc-sidebar__link' +
          (page === link.href ? " is-active" : "") +
          '" href="' +
          link.href +
          '">' +
          link.label +
          "</a>"
        );
      }).join("") +
      "</nav>" +
      '<div class="doc-sidebar__cta">' +
      "<p>Already running <code>npm run ui</code>?</p>" +
      dashboardLink("Open dashboard", "btn btn--secondary btn--block") +
      '<a class="btn btn--primary btn--block" href="getting-started.html">Get started</a>' +
      "</div></aside>"
    );
  }

  function renderDashboardCallout() {
    return (
      '<section class="dashboard-callout">' +
      '<div class="dashboard-callout__copy">' +
      '<span class="eyebrow">Self-hosted workspace</span>' +
      "<h2>Jump back to your Meridian dashboard</h2>" +
      "<p>" +
      "This site is the product documentation. Your live workspace runs separately after " +
      "<code>npm run ui</code> (default <code>" +
      DEFAULT_DASHBOARD_URL +
      "</code>)." +
      "</p>" +
      "<p class=" +
      '"dashboard-callout__hint">' +
      "Hosting on another machine or port? Open any docs page once with " +
      "<code>?dashboard=https://your-host:3030</code> — this browser remembers your dashboard URL." +
      "</p>" +
      "</div>" +
      '<div class="dashboard-callout__actions">' +
      dashboardLink("Open dashboard", "btn btn--primary") +
      '<p class="dashboard-callout__url">Current link: <code data-dashboard-url-display>' +
      DEFAULT_DASHBOARD_URL +
      "</code></p>" +
      '<a class="btn btn--ghost btn--sm" href="' +
      DOCS_HOME +
      '">Back to docs home</a>' +
      "</div></section>"
    );
  }

  function applyDashboardLinks(url) {
    document.querySelectorAll("[data-dashboard-open]").forEach(function (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });

    document.querySelectorAll("[data-dashboard-url-display]").forEach(function (node) {
      node.textContent = url;
    });

    document.querySelectorAll("[data-dashboard-url-inline]").forEach(function (node) {
      node.textContent = url;
    });
  }

  function mount() {
    const dashboardUrl = resolveDashboardUrl();
    const headerSlot = document.querySelector("[data-site-header]");
    const footerSlot = document.querySelector("[data-site-footer]");
    const sidebarSlot = document.querySelector("[data-doc-sidebar]");
    const calloutSlot = document.querySelector("[data-dashboard-callout]");
    const active = document.body.dataset.page;

    if (headerSlot) {
      headerSlot.innerHTML = renderHeader(active);
    }
    if (footerSlot) {
      footerSlot.innerHTML = renderFooter();
    }
    if (sidebarSlot) {
      sidebarSlot.innerHTML = renderDocSidebar(document.body.dataset.docPage);
    }
    if (calloutSlot) {
      calloutSlot.innerHTML = renderDashboardCallout();
    }

    applyDashboardLinks(dashboardUrl);

    const toggle = document.querySelector("[data-nav-toggle]");
    const header = document.querySelector("[data-header]");
    if (toggle && header) {
      toggle.addEventListener("click", function () {
        const open = header.classList.toggle("is-nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    document.querySelectorAll("[data-copy-code]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const block = btn.closest(".code-block");
        const code = block && block.querySelector("code");
        if (!code) {
          return;
        }
        navigator.clipboard.writeText(code.textContent.trim()).then(function () {
          btn.textContent = "Copied";
          setTimeout(function () {
            btn.textContent = "Copy";
          }, 1600);
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
