(function () {
  const REPO = "https://github.com/vijayptiwari/meridian";
  const LICENSE = REPO + "/blob/main/LICENSE";

  const NAV = [
    { href: "index.html", label: "Overview", id: "home" },
    { href: "compare.html", label: "Compare", id: "compare" },
    { href: "getting-started.html", label: "Get started", id: "getting-started" },
    { href: "docs.html", label: "Documentation", id: "docs" }
  ];

  const DOC_LINKS = [
    { href: "getting-started.html", label: "Quickstart" },
    { href: "configuration.html", label: "Configuration" },
    { href: "llm-providers.html", label: "LLM providers" },
    { href: "portals.html", label: "Portals" },
    { href: "gmail-cleanup.html", label: "Gmail cleanup" },
    { href: "compare.html", label: "Why Meridian" }
  ];

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

  function renderHeader(active) {
    const page = active || currentPage().replace(".html", "");
    return (
      '<header class="site-header" data-header>' +
      '<div class="site-shell site-header__inner">' +
      '<a class="site-brand site-brand--lockup" href="index.html">' +
      '<img src="assets/brand/logo-full.svg" width="148" height="36" alt="Meridian" /></a>' +
      '<nav class="site-nav" aria-label="Primary">' +
      NAV.map(function (item) {
        return navLink(item, page === "index" ? "home" : page);
      }).join("") +
      "</nav>" +
      '<div class="site-header__actions">' +
      '<a class="btn btn--ghost btn--sm" href="' +
      REPO +
      '" target="_blank" rel="noopener">GitHub</a>' +
      '<a class="btn btn--primary btn--sm" href="getting-started.html">Get started</a>' +
      '<button class="site-nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-nav-toggle>' +
      "<span></span><span></span><span></span></button>" +
      "</div></div></header>"
    );
  }

  function renderFooter() {
    return (
      '<footer class="site-footer">' +
      '<div class="site-shell site-footer__grid">' +
      '<div class="site-footer__brand">' +
      '<a class="site-brand site-brand--lockup" href="index.html">' +
      '<img src="assets/brand/logo-full.svg" width="132" height="32" alt="Meridian" /></a>' +
      '<p class="site-footer__tagline">Career operations platform. Open source, local-first, built for professionals.</p>' +
      "</div>" +
      '<div><h3 class="site-footer__heading">Product</h3><ul class="site-footer__links">' +
      '<li><a href="compare.html">Why Meridian</a></li>' +
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
      '<div class="site-shell site-footer__bottom">' +
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
      "<p>Ready to run Meridian locally?</p>" +
      '<a class="btn btn--primary btn--block" href="getting-started.html">Get started</a>' +
      "</div></aside>"
    );
  }

  function mount() {
    const headerSlot = document.querySelector("[data-site-header]");
    const footerSlot = document.querySelector("[data-site-footer]");
    const sidebarSlot = document.querySelector("[data-doc-sidebar]");
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
