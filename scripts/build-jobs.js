#!/usr/bin/env node
/* =========================================================
   PUCAR — collaborate build step (no dependencies)

   Reads content/jobs/*.json + content/contributors/*.json
   (written by Decap CMS or by hand) and generates:
     - collaborate/<slug>/index.html    crawlable page per work item
     - contributors/<slug>/index.html   crawlable page per contributor
     - collaborate/jobs.json            index used by the modal JS
     - homepage cards injected between <!-- COLLAB:START/END -->
     - sitemap.xml
   Board rules: cards appear only while status is "Open" AND the
   listing hasn't expired (posted date + listing_days). Every
   published item still gets its page.
   Run: node scripts/build-jobs.js   (Netlify runs this on deploy)
   ========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = (process.env.URL || "https://pucar-journey.netlify.app").replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

/* ---------------- tiny helpers ---------------- */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(md) {
  return md
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/* minimal markdown: #/##/### headings, -/* and 1. lists, paragraphs */
function mdToHtml(md) {
  return String(md).replace(/\r\n/g, "\n").split(/\n{2,}/).map(function (block) {
    const b = block.trim();
    if (!b) return "";
    const lines = b.split("\n").map(function (l) { return l.trim(); });
    const h = b.match(/^(#{1,4})\s+(.*)$/);
    if (h && lines.length === 1) {
      const level = Math.min(h[1].length + 1, 5);
      return "<h" + level + ">" + inline(esc(h[2])) + "</h" + level + ">";
    }
    if (lines.every(function (l) { return /^[-*]\s+/.test(l); }))
      return "<ul>" + lines.map(function (l) { return "<li>" + inline(esc(l.replace(/^[-*]\s+/, ""))) + "</li>"; }).join("") + "</ul>";
    if (lines.every(function (l) { return /^\d+\.\s+/.test(l); }))
      return "<ol>" + lines.map(function (l) { return "<li>" + inline(esc(l.replace(/^\d+\.\s+/, ""))) + "</li>"; }).join("") + "</ol>";
    return "<p>" + inline(esc(b)).replace(/\n/g, "<br>") + "</p>";
  }).filter(Boolean).join("\n");
}

function loadDir(dir) {
  const full = path.join(ROOT, "content", dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(function (f) { return f.endsWith(".json"); })
    .map(function (f) {
      const item = JSON.parse(fs.readFileSync(path.join(full, f), "utf8"));
      item.slug = f.replace(/\.json$/, "");
      return item;
    })
    .filter(function (i) { return i.published !== false; });
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (days || 0));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmt(iso) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
}

function diffClass(d) {
  const w = String(d || "moderate").split(" ")[0].toLowerCase();
  return w === "low" ? "diff-low" : w === "high" ? "diff-high" : "diff-moderate";
}

function streamLabel(job) {
  return job.stream === "Paid" ? "Paid" + (job.term ? " · " + job.term : "") : (job.stream || "Volunteer");
}

/* initials avatar (or photo) — `size` is a CSS class suffix */
function avatarHtml(person, cls) {
  if (person.photo) {
    return '<img class="avatar ' + (cls || "") + '" src="' + esc(person.photo) + '" alt="' + esc(person.name) + '" loading="lazy" />';
  }
  const initials = String(person.name || "?").split(/\s+/).map(function (w) { return w[0]; })
    .join("").slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < person.name.length; i++) hash = (hash * 31 + person.name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return '<span class="avatar ' + (cls || "") + '" style="background:hsl(' + hue + ',35%,38%)" aria-hidden="true">' + esc(initials) + "</span>";
}

/* ---------------- load content ---------------- */

const contributors = loadDir("contributors");
const bySlug = {};
contributors.forEach(function (c) { c.url = "/contributors/" + c.slug + "/"; bySlug[c.slug] = c; });

const jobs = loadDir("jobs").map(function (j) {
  j.url = "/collaborate/" + j.slug + "/";
  j.tags = j.tags || [];
  j.expiry = addDays(String(j.date).slice(0, 10), j.listing_days || 30);
  j.poster = bySlug[j.posted_by] || null;
  j.assignee = bySlug[j.assigned_to] || null;
  j.status = j.status || "Open";
  return j;
}).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

const boardJobs = jobs.filter(function (j) { return j.status === "Open" && j.expiry >= TODAY; });

/* ---------------- shared page chrome ---------------- */

/* THE footer: extracted verbatim from index.html at build time, so the
   homepage is the single source of truth and every generated page's footer
   can never drift again ("make all footers consistent and dynamic with the
   home page"). Edit the footer in index.html only. */
const FOOTER = (function () {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = src.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
  if (!m) throw new Error("site-footer not found in index.html — pageShell needs it");
  return m[0];
})();

/* THE nav: extracted from index.html at build time (same single-source
   idea as FOOTER). Transformed for inner pages: in-page anchors become
   /#anchors, and the homepage's animated up-arrow home becomes a plain
   house link to "/". */
const NAV = (function () {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = src.match(/<nav class="site-nav">[\s\S]*?<\/nav>/);
  if (!m) throw new Error("site-nav not found in index.html");
  let nav = m[0];
  nav = nav.replace(/href="#/g, 'href="/#');
  nav = nav.replace(/<a class="nav-home"[\s\S]*?<\/a>/,
    '<a class="nav-home" href="/" aria-label="Home" data-tip="Home"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5 8 2.5l5.5 5v6h-4v-3.5h-3V13.5h-4z"/></svg></a>');
  return nav;
})();

const BURGER = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>';

/* builds the fixed nav cluster; opts.subnav = [{label, href}] makes the
   main nav boot collapsed behind a "Main Menu" burger with the page's
   sub-nav expanded beside it (js/nav.js swaps which one is open) */
function navCluster(subnav) {
  let main = NAV;
  if (subnav && subnav.length) {
    main = main.replace('<nav class="site-nav">',
      '<nav class="site-nav main-nav is-collapsed">' +
      '<button class="nav-toggle" type="button" data-nav="main">' + BURGER + "Main Menu</button>");
    /* no static show-home here: js/nav.js reveals the up-arrow only after
       the visitor has scrolled a little (same 200px gate as the homepage) */
    const sub = '<nav class="site-nav sub-nav" aria-label="Page sections">' +
      '<button class="nav-toggle" type="button" data-nav="sub">' + BURGER + "Page Menu</button>" +
      /* homepage-style looping up-arrow: back to the top of this page */
      '<a class="nav-home subnav-top" href="#" aria-label="Back to top" data-tip="Back to Top"><svg viewBox="0 0 16 16" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg></a>' +
      subnav.map(function (it) { return '<a href="' + esc(it.href) + '">' + esc(it.label) + "</a>"; }).join("") +
      "</nav>";
    return '<div class="nav-cluster">' + main + sub + "</div>";
  }
  return '<div class="nav-cluster">' + main.replace('<nav class="site-nav">', '<nav class="site-nav main-nav">') + "</div>";
}

function pageShell(opts) {
  return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n" +
'<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n' +
"<title>" + esc(opts.title) + "</title>\n" +
'<meta name="description" content="' + esc(opts.desc) + '" />\n' +
'<link rel="canonical" href="' + SITE + opts.url + '" />\n' +
'<meta property="og:type" content="website" />\n' +
'<meta property="og:title" content="' + esc(opts.title) + '" />\n' +
'<meta property="og:description" content="' + esc(opts.desc) + '" />\n' +
'<meta property="og:url" content="' + SITE + opts.url + '" />\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
'<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet" />\n' +
'<link rel="stylesheet" href="/css/style.css" />\n' +
'<link rel="icon" type="image/png" href="/assets/pucar-new-favicon.png" />\n' +
'<link rel="apple-touch-icon" href="/assets/pucar-new-favicon.png" />\n' +
(opts.jsonLd ? '<script type="application/ld+json">' + JSON.stringify(opts.jsonLd) + "</script>\n" : "") +
'</head>\n<body class="job-page">\n' +
'<script src="/js/nav.js" defer></script>\n' +
'<script src="/js/mobile-nav.js" defer></script>\n' +
'<header class="site-header">\n  <a class="logo" href="/">\n' +
'    <img class="logo-light logo-light-long" src="/assets/pucar-normal-expanded.png" alt="PUCAR: Public Collective for Avoidance and Resolution of Disputes" width="777" height="93" />\n' +
'    <img class="logo-light logo-light-short" src="/assets/logo-pucar-green.avif" alt="PUCAR" width="401" height="100" />\n' +
'    <img class="logo-dark logo-dark-long" src="/assets/pucar-white-expanded.avif" alt="PUCAR: Public Collective for Avoidance and Resolution of Disputes" width="835" height="100" />\n' +
'    <img class="logo-dark logo-dark-short" src="/assets/pucar-white-short.png" alt="PUCAR" width="379" height="87" />\n' +
'    <img class="logo-p" src="/assets/pacar-p-icon.png" alt="PUCAR" width="250" height="250" />\n' +
'  </a>\n' +
/* ecosystem switcher, same as index.html's (desktop only) */
'  <div class="brand-switch">\n' +
'    <button class="brand-switch-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Visit Agami and OpenNyAI"><svg viewBox="0 0 10 6" width="11" height="7" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n' +
'    <div class="brand-menu" role="menu" aria-label="Agami missions">\n' +
'      <p class="brand-menu-label">Also visit</p>\n' +
'      <a class="brand-menu-item" role="menuitem" href="https://www.agami.in" target="_blank" rel="noopener"><img src="/assets/agami-logo.svg" alt="Agami" width="692" height="162" /><span class="brand-menu-desc">A movement of ideas and people reshaping law and justice in India. PUCAR is one of its collaborative missions.</span></a>\n' +
'      <a class="brand-menu-item" role="menuitem" href="https://opennyai.org" target="_blank" rel="noopener"><img src="/assets/opennyai-logo.svg" alt="OpenNyAI" width="506" height="101" /><span class="brand-menu-desc">A sibling Agami mission building open AI public goods to transform how India accesses justice.</span></a>\n' +
"    </div>\n  </div>\n" +
/* SAME navbar as the homepage (extracted at build time); pages can add a
   sub-nav via opts.subnav which collapses the main nav behind a burger */
"  " + navCluster(opts.subnav) + "\n</header>\n" +
'<main class="job-main' + (opts.mainClass ? " " + opts.mainClass : "") + '">\n' + opts.main + "\n</main>\n" +
FOOTER + "\n</body>\n</html>\n";
}

/* ---------------- job pieces ---------------- */

function jobMetaHtml(job) {
  return '<div class="job-meta">' +
    '<span class="collab-cat">' + esc(job.category || "Work") + "</span>" +
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + '<svg class="diff-bars" viewBox="0 0 14 12" width="13" height="11" aria-hidden="true"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5.5" y="3.5" width="3" height="8.5" rx="1"/><rect x="11" y="0" width="3" height="12" rx="1"/></svg>' + esc(job.difficulty || "Moderate") + "</span>" +
    '<span class="collab-stream">' + esc(streamLabel(job)) + "</span>" +
    (job.status !== "Open" ? '<span class="collab-status">' + esc(job.status) + "</span>" : "") +
    "</div>";
}

function jobDatesHtml(job) {
  return '<div class="job-dates">' +
    (job.deadline ? "<span><strong>Deadline</strong> " + fmt(job.deadline) + "</span>" : "") +
    '<span class="collab-closes" data-expiry="' + esc(job.expiry) + '"><strong>Listing closes</strong> ' + fmt(job.expiry) + "</span>" +
    "<span><strong>Posted</strong> " + fmt(job.date) + "</span>" +
    "</div>";
}

function postedByHtml(job, cls) {
  if (!job.poster) return "";
  return '<a class="collab-poster ' + (cls || "") + '" href="' + job.poster.url + '">' +
    avatarHtml(job.poster, "") +
    '<span class="poster-meta"><span class="poster-label">Posted by</span><span class="poster-name">' + esc(job.poster.name) + "</span></span></a>";
}

function chipsHtml(job) {
  /* title attr = native tooltip when a long chip is ellipsised by CSS */
  return [job.commitment, job.location].concat(job.tags).filter(Boolean)
    .map(function (c) { return '<li title="' + esc(c) + '">' + esc(c) + "</li>"; }).join("");
}

function jobPage(job) {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: job.title, description: job.summary,
    datePosted: job.date, validThrough: job.expiry,
    employmentType: job.stream === "Paid" ? (job.term === "Permanent" ? "FULL_TIME" : "TEMPORARY") : "VOLUNTEER",
    hiringOrganization: { "@type": "Organization", name: "PUCAR", sameAs: "https://pucar.org" },
    jobLocationType: /remote/i.test(job.location || "") ? "TELECOMMUTE" : undefined,
    directApply: true
  };
  const main =
    '  <p class="beat-eyebrow">' + esc(streamLabel(job)) + "</p>\n" +
    '  <h1 class="job-title">' + esc(job.title) + "</h1>\n" +
    "  " + jobMetaHtml(job) + "\n" +
    '  <p class="job-summary">' + esc(job.summary) + "</p>\n" +
    "  " + jobDatesHtml(job) + "\n" +
    '  <ul class="job-chips">' + chipsHtml(job) + "</ul>\n" +
    "  " + postedByHtml(job, "on-light") + "\n" +
    '  <article class="job-body">\n' + mdToHtml(job.body || "") + "\n  </article>\n" +
    '  <div class="cta-row">\n' +
    (job.status === "Open"
      ? '    <a class="btn btn-primary" href="' + esc(job.apply_url || "mailto:collaborate@pucar.org") + '">Express interest</a>\n'
      : '    <span class="btn btn-outline is-disabled">' + esc(job.status) + "</span>\n") +
    '    <a class="btn btn-outline" href="/#collaborate">See all work</a>\n  </div>';
  return pageShell({
    title: job.title + " | Collaborate with PUCAR",
    desc: job.summary, url: job.url, jsonLd: jsonLd,
    backHref: "/#collaborate", backLabel: "← All work", main: main
  });
}

/* ---------------- contributor pages ---------------- */

function jobLine(job, note) {
  return '<li><a href="' + job.url + '">' + esc(job.title) + "</a>" +
    '<span class="collab-cat">' + esc(job.category || "") + "</span>" +
    '<span class="collab-status">' + esc(note) + "</span></li>";
}

function contributorPage(person) {
  const posted = jobs.filter(function (j) { return j.posted_by === person.slug; });
  const taken = jobs.filter(function (j) { return j.assigned_to === person.slug; });
  const links = (person.links || []).map(function (l) {
    return '<a class="btn btn-outline" href="' + esc(l.url) + '" rel="noopener">' + esc(l.label) + "</a>";
  }).join("\n    ");
  const main =
    '  <div class="contrib-head">' + avatarHtml(person, "avatar-xl") +
    '<div><p class="beat-eyebrow">Contributor</p>' +
    '<h1 class="job-title">' + esc(person.name) + "</h1>" +
    ((person.role || person.organisation) ? '<p class="job-summary">' +
      esc([person.role,
        (person.role && person.organisation &&
          person.role.toLowerCase().indexOf(person.organisation.toLowerCase()) !== -1)
          ? "" : person.organisation].filter(Boolean).join(" · ")) + "</p>" : "") +
    "</div></div>\n" +
    '  <article class="job-body">\n' + mdToHtml(person.body || "") + "\n  </article>\n" +
    (links ? '  <div class="cta-row">\n    ' + links + "\n  </div>\n" : "") +
    (posted.length ? '  <h2 class="contrib-sub">Work they’ve posted</h2>\n  <ul class="contrib-jobs">' +
      posted.map(function (j) { return jobLine(j, j.status); }).join("") + "</ul>\n" : "") +
    (taken.length ? '  <h2 class="contrib-sub">Work taken up</h2>\n  <ul class="contrib-jobs">' +
      taken.map(function (j) { return jobLine(j, j.status === "Completed" ? "Completed" : "In progress"); }).join("") + "</ul>\n" : "");
  return pageShell({
    title: person.name + " | PUCAR contributor",
    desc: ((person.role || person.organisation) ? [person.role, person.organisation].filter(Boolean).join(", ") + ". " : "") +
      "Contributor to the PUCAR collective.",
    url: person.url,
    jsonLd: { "@context": "https://schema.org", "@type": "Person", name: person.name,
      description: [person.role, person.organisation].filter(Boolean).join(", "),
      affiliation: { "@type": "Organization", name: person.organisation || "PUCAR" } },
    backHref: "/#collaborate", backLabel: "← Collaborate", main: main
  });
}

/* ---------------- contributors index page ---------------- */

function contributorIndexCard(person) {
  return '<a class="contrib-card" href="' + person.url + '"' +
    ' data-name="' + esc(person.name) + '"' +
    ' data-role="' + esc(person.role || "") + '"' +
    ' data-org="' + esc(person.organisation || "") + '">' +
    avatarHtml(person, "avatar-lg") +
    '<span class="contrib-card-text">' +
    '<span class="contrib-card-name">' + esc(person.name) + "</span>" +
    (person.role ? '<span class="contrib-card-role">' + esc(person.role) + "</span>" : "") +
    (person.organisation ? '<span class="contrib-card-org">' + esc(person.organisation) + "</span>" : "") +
    "</span></a>";
}

/* the SHARED open-work board body (filters + grid + job modal +
   js/collaborate.js). Rendered from the same boardJobs/card() everywhere it
   appears (homepage, /contributors/, /dristi/), so the three can never
   drift out of sync. Ids are fixed; collaborate.js works by id. */
function collabBoardHtml() {
  const cards = boardJobs.length ? boardJobs.map(card).join("\n")
    : '<p class="collab-filter-empty">No open work right now -- check back soon, or write to us.</p>';
  return '  <div class="collab-filters" id="collabFilters" hidden>\n' +
'    <select data-filter="stream" aria-label="Filter by stream">\n' +
'      <option value="">All streams</option>\n' +
"      <option>Volunteer</option>\n" +
"      <option>Paid</option>\n" +
"    </select>\n" +
'    <select data-filter="category" aria-label="Filter by type of work">\n' +
'      <option value="">All types</option>\n' +
"    </select>\n" +
'    <select data-filter="difficulty" aria-label="Filter by difficulty">\n' +
'      <option value="">Any difficulty</option>\n' +
"      <option>Low Difficulty</option>\n" +
"      <option>Moderate</option>\n" +
"      <option>High</option>\n" +
"    </select>\n" +
'    <select data-filter="deadline" aria-label="Filter by deadline">\n' +
'      <option value="">Any deadline</option>\n' +
'      <option value="7">Due within a week</option>\n' +
'      <option value="14">Due within 2 weeks</option>\n' +
'      <option value="30">Due within a month</option>\n' +
'      <option value="90">Due within 3 months</option>\n' +
"    </select>\n" +
'    <div class="collab-tagbar" id="collabTagbar" role="group" aria-label="Filter by tag"></div>\n' +
'    <button class="collab-clear" id="collabClear" type="button" hidden>Clear filters ×</button>\n' +
"  </div>\n" +
'  <p class="collab-count" id="collabCount" hidden></p>\n' +
'  <div class="collab-grid" id="collabGrid">\n' + cards + "\n" +
'    <div class="collab-filter-empty" id="collabEmpty" hidden>No work matches these filters right now. Try widening them.</div>\n' +
"  </div>\n" +
"</section>\n" +
'<div class="job-modal" id="jobModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel" role="dialog" aria-modal="true" aria-labelledby="jobModalTitle">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">×</button>\n' +
'    <p class="beat-eyebrow" id="jobModalType"></p>\n' +
'    <h2 class="job-title" id="jobModalTitle"></h2>\n' +
'    <div class="job-meta" id="jobModalMeta"></div>\n' +
'    <ul class="job-chips" id="jobModalChips"></ul>\n' +
'    <article class="job-body" id="jobModalBody"></article>\n' +
'    <div class="cta-row">\n' +
'      <a class="btn btn-primary" id="jobModalApply" href="#" target="_blank" rel="noopener">Read the original</a>\n' +
"    </div>\n  </div>\n</div>\n" +
'<script src="/js/collaborate.js"></script>\n';
}

function contributorsSection() {
  /* Extracted for reuse: this used to be the whole standalone page (see
     contributorsPage() below, which now folds this into a bigger
     consolidated page at the same /contributors/ URL). The old page-level
     intro (h1 + paragraph) becomes this section's collab-head instead --
     it's a SECTION on a bigger page now, not a page of its own, and a
     page should only have one <h1>. */
  const people = contributors.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  const orgs = Array.from(new Set(people.map(function (p) { return p.organisation; })
    .filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
  return '<section class="collaborate contrib-section" id="contributors">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Contributors</p>\n' +
'    <h2 class="collab-title-main">Find a collaborator.</h2>\n' +
'    <p class="collab-sub">PUCAR is a collective of 100+ contributors from economics, legal practice, public technology, artificial intelligence, and government. Search by name or role, or filter by organisation.</p>\n' +
"  </div>\n" +
'  <div class="collab-filters contrib-filters" id="contribFilters" hidden>\n' +
'    <input class="contrib-search" id="contribSearch" type="search" placeholder="Search people, roles…" aria-label="Search contributors" />\n' +
'    <select id="contribOrg" aria-label="Filter by organisation">\n' +
'      <option value="">All organisations</option>\n' +
orgs.map(function (o) { return "      <option>" + esc(o) + "</option>"; }).join("\n") + "\n" +
"    </select>\n" +
'    <button class="collab-clear" id="contribClear" type="button" hidden>Clear filters ×</button>\n' +
"  </div>\n" +
'  <p class="collab-count" id="contribCount" hidden></p>\n' +
'  <div class="contrib-grid" id="contribGrid">\n' +
people.map(contributorIndexCard).join("\n") + "\n" +
"  </div>\n" +
"</section>\n" +
'<div class="job-modal" id="contribModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel" role="dialog" aria-modal="true" aria-labelledby="cmName">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">×</button>\n' +
'    <div class="contrib-head">\n' +
'      <img class="avatar avatar-xl" id="cmPhoto" src="" alt="" />\n' +
'      <div><p class="beat-eyebrow">Contributor</p>\n' +
'      <h2 class="job-title" id="cmName"></h2>\n' +
'      <p class="job-summary" id="cmRole"></p></div>\n' +
"    </div>\n" +
'    <article class="job-body" id="cmBody"></article>\n' +
'    <div class="cta-row" id="cmLinks"></div>\n' +
"  </div>\n" +
"</div>\n" +
'<script src="/js/contributors-page.js"></script>\n<script src="/js/view-toggle.js"></script>\n';
}

function contributorsPage() {
  /* Jul 2026: /contributors/ is now the consolidated "ways to contribute"
     hub -- DRISTI 2.0 (live board), the Supreme Court AI policy (summary +
     link), and the full contributor directory, all on one page with
     anchors. Explicitly NOT a redirect -- this page IS /contributors/, not
     a stub pointing somewhere else.

     DRISTI 2.0 gets a live view of the actual open-work cards (same
     card()/boardJobs the homepage board renders), reusing the exact
     #collabFilters/#collabGrid/#jobModal ids so js/collaborate.js -- built
     to work by id, not by page -- runs here unmodified. Policy gets a
     short summary (adapted from scPolicyPage's intro) plus a link through
     to the full /sc-ai-policy/ page, which stays exactly as it is. */

  const main =
'  <p class="beat-eyebrow">About Contributing</p>\n' +
'  <h1 class="job-title">Find your way into the work.</h1>\n' +
'  <article class="job-body">\n' +
"    <p>PUCAR's work happens in three places right now: building the DRISTI 2.0 stack, shaping how the courts use AI, and the wider collective of contributors who make both possible. Pick a thread below, or scroll through all three.</p>\n" +
"  </article>\n" +
"</main>\n" +

'<section class="collaborate dristi-section" id="dristi">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">DRISTI 2.0</p>\n' +
'    <h2 class="collab-title-main">Advance the DRISTI 2.0 stack.</h2>\n' +
'    <p class="collab-sub">Open work on the people-centric courts platform -- some volunteer, some paid (permanent or temporary). This is what’s open right now. <a class="collab-dristi-link" href="/dristi/">About the DRISTI platform &rarr;</a></p>\n' +
"  </div>\n" +
collabBoardHtml() +

'<section class="policy-band" id="policy">\n' +
'  <div class="policy-callout">\n' +
'    <div class="policy-callout-text">\n' +
'      <p class="policy-kicker">Public consultation</p>\n' +
'      <h2 class="policy-title">The Supreme Court wants your views on AI in its courts.</h2>\n' +
'      <p class="policy-sub">A draft framework for how courts can use AI -- assist, never adjudicate. The collective has been reading it closely: explainers, critiques, and formal submissions, all in one place.</p>\n' +
'      <div class="cta-row">\n' +
'        <a class="btn btn-primary" href="/sc-ai-policy/">Explore the Supreme Court’s AI policy</a>\n' +
"      </div>\n" +
"    </div>\n" +
'    <div class="policy-countdown" id="policyCountdown" data-deadline="2026-07-15">\n' +
'      <span class="policy-countdown-num" id="policyCountdownNum">—</span>\n' +
'      <span class="policy-countdown-label" id="policyCountdownLabel">days left</span>\n' +
'      <span class="policy-countdown-sub">to respond by 15 July 2026</span>\n' +
"    </div>\n" +
"  </div>\n" +
"</section>\n" +
'<script src="/js/policy-countdown.js"></script>\n\n' +

contributorsSection() +
"<main hidden>";
  return pageShell({
    title: "About Contributing | PUCAR",
    desc: "Three ways into PUCAR's work: the DRISTI 2.0 platform, the Supreme Court's AI policy consultation, and the 100+ contributors who make up the collective.",
    url: "/contributors/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "About contributing to PUCAR",
      about: "Ways to contribute to the PUCAR collective" },
    backHref: "/", backLabel: "← Home", main: main,
    subnav: [
      { label: "DRISTI 2.0", href: "#dristi" },
      { label: "Policy", href: "#policy" },
      { label: "Contributors", href: "#contributors" }
    ]
  });
}

/* ---------------- about + team pages ---------------- */

/* funding contributors (pucar.org/about ticker, identified visually July
   2026). Logos live at assets/funders/<slug>.png -- run
   scripts/mirror-funder-logos.js locally once to download them. */
const FUNDERS = [
  ["binny-bansal", "Binny Bansal"],
  ["nilekani-philanthropies", "Rohini & Nandan Nilekani Philanthropies"],
  ["tree-of-life-foundation", "Tree of Life Foundation"],
  ["ravi-venkatesan", "Ravi Venkatesan"],
  ["harish-bina-shah-foundation", "Harish & Bina Shah Foundation"],
  ["trilegal", "Trilegal"],
  ["lal-foundation", "Lal Foundation"],
  ["cyrus-j-guzder", "Cyrus J. Guzder"],
  ["godrej", "Godrej"],
  ["spectrum-impact", "Spectrum Impact"],
  ["c-s-vaidyanathan", "C.S. Vaidyanathan"],
  ["ajit-issac", "Ajit Issac"],
  ["mahesh-krishnamurthy", "Mahesh Krishnamurthy"],
  ["amita-gupta", "Amita Gupta"]
];

function aboutPage() {
  /* Content adapted from https://pucar.org/about (July 2026). Jul 2026
     revision: the page was a single unbroken column of prose top to
     bottom ("can use a better layout that looks more visual" -- user
     feedback with a screenshot of the live page). Restructured around
     three visual beats without inventing or dropping any copy:
       1. a stat strip right under the title (numbers the prose already
          states, just pulled out and made big -- same "78% / 5.5 Cr"
          treatment the story beats use for stats),
       2. "How we work"'s three bullet paragraphs turned into a numbered
          3-card process grid instead of a wall of bold lead-ins,
       3. a real photo strip of the collective (reusing the homepage's
          .collab-strip component) right before the CTAs, so "100+
          contributors" ends on actual faces, not just a sentence. */
  const openRoles = boardJobs.length;

  const steps = [
    { title: "Discover and empower contributors", body: "We discover, curate and empower mission-aligned contributors. Together, we identify strategic opportunities for action." },
    { title: "Re-imagine with people at the centre", body: "We recognize systemic challenges and understand user needs. We fundamentally redesign solutions to meet those needs in the most effective and meaningful way." },
    { title: "Co-create solutions", body: "We co-create public goods: blueprints for processes and policies, prototypes for services, data, knowledge, and technology. We support changemakers to ensure their adoption." }
  ];
  const stepsHtml = steps.map(function (s, i) {
    return '    <div class="about-step">\n' +
      '      <span class="about-step-num">0' + (i + 1) + '</span>\n' +
      "      <h3>" + esc(s.title) + "</h3>\n" +
      "      <p>" + esc(s.body) + "</p>\n" +
      "    </div>";
  }).join("\n");

  const main =
'  <p class="beat-eyebrow">About</p>\n' +
'  <h1 class="job-title">Transforming dispute resolution.</h1>\n' +
'  <div class="about-stats">\n' +
    /* "100+"/"2023" are PUCAR's own real-world figures from the prose below
       (and pucar.org), kept as literals -- NOT contributors.length, which
       is only how many of those 100+ have a profile built out on this site
       so far (77 as of Jul 2026, see README §6.3) and would understate the
       real number. Open roles IS computed live: it's exactly boardJobs,
       the same list the homepage board renders, so it can never drift out
       of sync with what's actually posted. */
'    <div class="about-stat"><span class="about-stat-num">100+</span><span class="about-stat-label">Contributors</span></div>\n' +
'    <div class="about-stat"><span class="about-stat-num">2023</span><span class="about-stat-label">Founded</span></div>\n' +

'  </div>\n' +
/* "What we do" is set as a MISSION STATEMENT, not article prose ("this is
   key information about us, don't treat like other pages"): eyebrow label,
   the full first paragraph as display type with 'unstucks' accented, and
   the second as supporting text. No drop cap here. */
'  <div class="about-what">\n' +
'    <p class="beat-eyebrow">What we do</p>\n' +
'    <p class="about-what-statement">We are building an ecosystem that continuously fuels innovation. PUCAR <em>\u2018unstucks\u2019</em> the dispute resolution system by inspiring imagination and harnessing capacities to create new possibilities.</p>\n' +

"  </div>\n" +
"</main>\n" +
/* full-bleed parallax drawing between "What we do" and the Why band.
   The actual parallax translate lives in js/nav.js (About page loads it
   like every generated page); pure decoration, hidden from AT. */
'<section class="about-parallax" aria-hidden="true">\n' +
'  <div class="about-parallax-img" style="background-image:url(/assets/pucar-drawing.jpg)"></div>\n' +
"</section>\n" +
/* full-bleed dark band: the About page finally gets the cream<->forest
   rhythm the rest of the site runs on. Same copy, elevated: first para as
   a lede, the "Born in 2023" line as a display pull-quote. */
'<section class="about-why">\n' +
'  <div class="about-why-inner">\n' +
'    <p class="beat-eyebrow">Why PUCAR?</p>\n' +
'    <p class="about-why-lede">The outdated processes and insular structure of our dispute resolution system have left millions disillusioned. To restore trust and reset expectations, we must actively engage diverse users and innovators in evolving resolution processes.</p>\n' +
'    <p class="about-why-pull">Born in 2023, PUCAR is now a group of <em>100+ contributors</em> from diverse fields that include economics, legal practice, public technology, artificial intelligence, and government.</p>\n' +
"  </div>\n" +
"</section>\n" +
/* second parallax band, flush against the why band above (group shot) */
'<section class="about-parallax" aria-hidden="true">\n' +
'  <div class="about-parallax-img" style="background-image:url(/assets/pucar-group-shot.avif)"></div>\n' +
"</section>\n" +
'<div class="job-main about-lower">\n' +
  /* No <p> inside this one -- just the heading, wrapped in the same
     job-body.prose classes purely to reuse its h2 styling (display face +
     short green rule) without also reusing the drop-cap rule, which is
     scoped to `.prose p:first-of-type` and simply has nothing to attach to
     here. */
'  <div class="job-body prose about-steps-head"><h2>How we work</h2></div>\n' +
'  <div class="about-steps">\n' + stepsHtml + "\n  </div>\n" +
'  <article class="job-body prose no-cap">\n' +
"    <h2>How we organise</h2>\n" +
"    <p>We self-organise and raise resources around different opportunities that can contribute to the mission. We evolve roles, responsibilities, and processes within each opportunity to guide our efforts and invite participation from the public. Guided by the mission and values, all contributors have the autonomy and flexibility to create and manage opportunities.</p>\n" +
"  </article>\n" +
"</div>\n" +
/* the CORE TEAM band (moved here from the old /team/ page) + the single
   contributors strip -- the old about-strip and the "Meet the
   contributors" outline button are gone (they duplicated it) */
teamSection() +
'<div class="job-main about-lower">\n' +
'  <div class="about-funders">\n' +
'    <p class="beat-eyebrow">Funding Contributors</p>\n' +
'    <div class="funder-grid">\n' +
FUNDERS.map(function (f) {
  return '      <img src="/assets/funders/' + f[0] + '.png" alt="' + esc(f[1]) + '" title="' + esc(f[1]) + '" loading="lazy" />';
}).join("\n") + "\n" +
"    </div>\n" +
"  </div>\n" +
"</div>\n<main hidden>";
  return pageShell({
    title: "About PUCAR",
    desc: "PUCAR is a public collective transforming dispute resolution in India: 100+ contributors from law, technology, economics, and government building people-centric justice.",
    url: "/about/",
    jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: "About PUCAR" },
    backHref: "/", backLabel: "← Home", main: main
  });
}

function resourcesPage() {
  const resBlog = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/blog.json"), "utf8"));
  const resData = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/data.json"), "utf8"));
  const resCircles = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/circles.json"), "utf8"));

  const blogTags = Array.from(new Set(resBlog.reduce(function (a, b) { return a.concat(b.tags || []); }, []))).sort();

  const CAL_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M1.5 6h13M5 1v3M11 1v3"/></svg>';
  resBlog.sort(function (a, b) { return new Date(b.date) - new Date(a.date); }); // newest first
  const blogCards = resBlog.map(function (b) {
    return '<a class="collab-card res-card" data-tags="' + esc((b.tags || []).join("|")) + '" href="' + esc(b.url) + '" target="_blank" rel="noopener">\n' +
      '  <span class="res-thumb-wrap"><span class="res-thumb-clip"><img class="res-thumb" src="' + esc(b.thumb) + '" alt="" loading="lazy" /><span class="res-shine" aria-hidden="true"></span></span><img class="res-thumb-glow" src="' + esc(b.thumb) + '" alt="" aria-hidden="true" loading="lazy" /></span>\n' +
      '  <div class="collab-topline"><span class="res-outlet">' + esc(b.outlet) + '</span><span class="res-date">' + CAL_SVG + esc(b.date) + "</span></div>\n" +
      '  <span class="collab-title">' + esc(b.title) + "</span>\n" +
      '  <span class="collab-summary">' + esc(b.summary) + "</span>\n" +
      '  <ul class="collab-chips">' + (b.tags || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>\n" +
      '  <div class="collab-foot"><span class="collab-btn">Read article</span></div>\n' +
      "</a>";
  }).join("\n");

  /* per-type icons (Lucide-style inline strokes) shown instead of the old
     type pill on data cards, and inside the type-filter pills */
  function typeIcon(inner) {
    return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }
  const TYPE_ICONS = {
    "Policy": typeIcon('<path d="M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z"/><path d="M5.5 5h5M5.5 7.5h5M5.5 10h3"/>'),
    "Dataset": typeIcon('<ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9"/><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>'),
    "Courts": typeIcon('<path d="M2 6 8 1.8 14 6"/><path d="M3.5 6v6M6.5 6v6M9.5 6v6M12.5 6v6"/><path d="M2 14.2h12M2 12h12"/>'),
    "Open Source": typeIcon('<circle cx="4.5" cy="3.8" r="1.7"/><circle cx="4.5" cy="12.2" r="1.7"/><circle cx="11.5" cy="3.8" r="1.7"/><path d="M4.5 5.5v5M11.5 5.5c0 2.8-3.2 3-5.3 3.6"/>'),
    "Code": typeIcon('<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/>'),
    "Presentation": typeIcon('<rect x="1.5" y="2.5" width="13" height="8.5" rx="1.2"/><path d="M8 11v1.7M5.2 15 8 12.7 10.8 15M8 1v1.5"/>'),
    "Article": typeIcon('<rect x="1.5" y="3" width="13" height="10" rx="1.2"/><path d="M4 6.2h4.5M4 8.5h8M4 10.8h8M11 6.2h1"/>'),
    "Research": typeIcon('<path d="M6.3 1.5h3.4M7 1.5v4.2L3.2 12a1.6 1.6 0 0 0 1.4 2.4h6.8A1.6 1.6 0 0 0 12.8 12L9 5.7V1.5"/><path d="M4.6 10h6.8"/>'),
    "Dashboard": typeIcon('<circle cx="8" cy="8.8" r="5.8"/><path d="M8 8.8l2.8-2.8M4.8 8.8h.01M11.2 8.8h.01M8 5.6h.01"/>'),
    "Handbook": typeIcon('<path d="M8 3.6C6.7 2.7 4.9 2.3 2.3 2.3v10.8c2.6 0 4.4.4 5.7 1.3 1.3-.9 3.1-1.3 5.7-1.3V2.3C11.1 2.3 9.3 2.7 8 3.6v10.5"/>')
  };
  const DEFAULT_TYPE_ICON = typeIcon('<path d="M4 1.5h5.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z"/><path d="M9.5 1.5V5H13"/>');

  const TABS = [
    { key: "all", label: "All", desc: "Everything the collective has put into the commons: datasets, policy documents, research, code, and playbooks." },
    { key: "People Centric Courts", label: "People Centric Courts", desc: "Transforming court processes for a seamless, predictable and empowering experience for all litigants." },
    { key: "Court Performance", label: "Court Performance Metrics", desc: "A framework focused on outcomes like efficiency, fairness, and predictability, giving litigants crucial insights to improve decision-making and drive justice system improvements." },
    { key: "ODR", label: "Online Dispute Resolution (ODR)", desc: "Enabling an online dispute resolution ecosystem in India: technology combined with trusted mechanisms of negotiation, mediation, conciliation, and arbitration, at scale." }
  ];
  const tabBtns = TABS.map(function (t, i) {
    return '<button type="button" class="res-tab' + (i === 0 ? " is-active" : "") + '" data-tab="' + esc(t.key) + '" data-desc="' + esc(t.desc) + '">' + esc(t.label) + "</button>";
  }).join("\n      ");

  /* the resource TYPE (second tag: Policy/Dataset/Article/...) renders as an
     icon + quiet uppercase label instead of a pill, and doubles as a filter
     (data-type). No chips row: the tab covers the initiative, the type
     label + filter bar cover the rest -- pills were pure duplication. */
  const dataTypes = Array.from(new Set(resData.map(function (d) { return (d.tags || [])[1] || "Resource"; }))).sort();
  const typeBtns = dataTypes.map(function (t) {
    return '<button type="button" class="res-tab res-type-pill" data-type="' + esc(t) + '">' + (TYPE_ICONS[t] || DEFAULT_TYPE_ICON) + esc(t) + "</button>";
  }).join("\n      ");

  const dataCards = resData.map(function (d) {
    const type = (d.tags || [])[1] || "Resource";
    return '<a class="collab-card res-data-card" data-tab="' + esc(d.tab) + '" data-type="' + esc(type) + '" href="' + esc(d.url) + '" target="_blank" rel="noopener">\n' +
      '  <div class="collab-topline"><span class="res-type">' + (TYPE_ICONS[type] || DEFAULT_TYPE_ICON) + esc(type) + "</span></div>\n" +
      '  <span class="collab-title">' + esc(d.title) + "</span>\n" +
      '  <span class="collab-summary">' + esc(d.desc) + "</span>\n" +
      '  <div class="collab-foot"><span class="collab-btn">Open resource</span></div>\n' +
      "</a>";
  }).join("\n");

  const VIDEO_ICON = typeIcon('<rect x="1.5" y="4" width="9.5" height="8" rx="1.8"/><path d="M11 8l3.5-2.3v4.6L11 8z"/>');
  const circleCards = resCircles
    .slice().sort(function (a, b) { return b.n - a.n; }) // newest circle first
    .map(function (c) {
      return '<button type="button" class="collab-card res-card circle-card" data-id="' + esc(c.id) + '" data-title="' + esc(c.title) + '" data-desc="' + esc(c.desc) + '">\n' +
        '  <span class="res-thumb-wrap"><span class="res-thumb-clip"><img class="res-thumb" src="' + esc(c.thumb) + '" alt="" loading="lazy" /><span class="circle-play" aria-hidden="true">▶</span></span><img class="res-thumb-glow" src="' + esc(c.thumb) + '" alt="" aria-hidden="true" loading="lazy" /></span>\n' +
        '  <div class="collab-topline"><span class="res-type res-circle-type">' + VIDEO_ICON + "Learning Circle #" + c.n + "</span></div>\n" +
        '  <span class="collab-title">' + esc(c.title) + "</span>\n" +
        '  <div class="collab-foot"><span class="collab-btn">Watch</span></div>\n' +
        "</button>";
    }).join("\n");

  const main =
'  <p class="beat-eyebrow">Resources</p>\n' +
'  <h1 class="job-title">Things worth keeping open in a tab.</h1>\n' +
'  <article class="job-body prose no-cap">\n' +
"    <p>Writing, data, and shared learning from the PUCAR collective.</p>\n" +
"  </article>\n" +
"</main>\n" +

'<section class="collaborate res-section" id="blog">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Blog</p>\n' +
'    <h2 class="collab-title-main">Uncover fresh perspectives.</h2>\n' +
'    <p class="collab-sub">Learnings, perspectives and insights published across the press and the collective’s own notes.</p>\n' +
"  </div>\n" +
'  <div class="res-tagbar" id="blogTagbar">\n' +
'      <button type="button" class="res-tab is-active" data-tag="all">All topics</button>\n' +
blogTags.map(function (t) { return '      <button type="button" class="res-tab" data-tag="' + esc(t) + '">' + esc(t) + "</button>"; }).join("\n") + "\n" +
"  </div>\n" +
'  <div class="collab-grid res-grid" id="blogGrid">\n' + blogCards + "\n  </div>\n" +
"</section>\n" +

'<section class="collaborate res-section" id="data-resources">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Data, Policy, Research and more</p>\n' +
'    <h2 class="collab-title-main">An open body of knowledge.</h2>\n' +
"  </div>\n" +
'  <div class="res-tabbar" id="dataTabs" role="tablist">\n      ' + tabBtns + "\n  </div>\n" +
'  <p class="res-tab-desc" id="dataTabDesc">' + esc(TABS[0].desc) + "</p>\n" +
'  <div class="res-tagbar res-typebar" id="dataTypebar">\n' +
'      <button type="button" class="res-tab res-type-pill is-active" data-type="all">All types</button>\n      ' + typeBtns + "\n  </div>\n" +
'  <div class="collab-grid res-grid" id="dataGrid">\n' + dataCards + "\n  </div>\n" +
"</section>\n" +

'<section class="collaborate res-section" id="learning-circles">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Learning Circles</p>\n' +
'    <h2 class="collab-title-main">Learn with the collective.</h2>\n' +
'    <p class="collab-sub">Recorded sessions where contributors teach each other. Click any card to watch.</p>\n' +
"  </div>\n" +
'  <div class="collab-grid res-grid" id="circleGrid">\n' + circleCards + "\n  </div>\n" +
"</section>\n" +

/* deliberately NOT the usual modal look: a compact amber-edged warning
   strip, small uppercase header, no big serif title */
'<div class="job-modal" id="leaveModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel leave-panel" role="alertdialog" aria-modal="true" aria-labelledby="lmTitle">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">\u00d7</button>\n' +
'    <p class="leave-head" id="lmTitle"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8 15 14H1L8 1.8z"/><path d="M8 6.2v3.6M8 11.9h.01"/></svg>External link</p>\n' +
'    <p class="leave-text">This link opens an external site \u2014 <strong id="lmHost"></strong>. It\u2019s a link we curated, safe to follow, and it will open in a new tab.</p>\n' +
'    <div class="cta-row leave-actions">\n' +
'      <button class="btn btn-primary" type="button" id="lmGo">Continue</button>\n' +
'      <button class="btn btn-outline" type="button" data-close>Stay here</button>\n' +
"    </div>\n" +
"  </div>\n" +
"</div>\n" +
'<div class="job-modal" id="videoModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel video-panel" role="dialog" aria-modal="true" aria-labelledby="vmTitle">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">×</button>\n' +
'    <div class="video-wrap"><iframe id="vmFrame" src="about:blank" title="Learning circle video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>\n' +
'    <h2 class="video-title" id="vmTitle"></h2>\n' +
'    <p class="video-desc" id="vmDesc"></p>\n' +
"  </div>\n" +
"</div>\n" +
'<script src="/js/resources.js"></script>\n<script src="/js/view-toggle.js"></script>\n<main hidden>';
  return pageShell({
    title: "Resources | PUCAR",
    desc: "Writing, open data, policy, research, and learning circles from the PUCAR collective.",
    url: "/resources/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "PUCAR resources" },
    backHref: "/", backLabel: "← Home", main: main,
    subnav: [
      { label: "Blog", href: "#blog" },
      { label: "Data, Policy & More", href: "#data-resources" },
      { label: "Learning Circle", href: "#learning-circles" }
    ]
  });
}

function teamSection() {
  /* Real team (July 2026): content/team/team.json -- name, PUCAR role,
     3rd-person bio (LinkedIn-sourced), headshot in assets/team/ (all ten
     committed). Rendered as a SECTION at the bottom of /about/ (Jul 2026
     revision: "move the whole team section to the About page... go to
     this anchor"), not a standalone page. Layout modelled on
     opennyai.org/about's team wall: 3:4 portrait cards, grayscale until
     hover, name/role rising over a bottom gradient; click opens the
     shared job-modal with the bio (js/team.js, data inlined in
     #teamData). The contributors strip lives HERE (it replaced the About
     page's old about-strip AND the "Meet the contributors" outline
     button -- one contributors CTA on the page, not three). */
  const team = JSON.parse(fs.readFileSync(path.join(ROOT, "content/team/team.json"), "utf8"));

  const cards = team.map(function (p) {
    return '<article class="team-card" data-slug="' + esc(p.slug) + '" tabindex="0" role="button" aria-label="' + esc(p.name) + ', ' + esc(p.role) + '">\n' +
      '  <img class="team-photo" src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy" />\n' +
      '  <span class="team-veil" aria-hidden="true"></span>\n' +
      '  <span class="team-meta"><span class="team-name">' + esc(p.name) + '</span><span class="team-role">' + esc(p.role) + '</span></span>\n' +
      "</article>";
  }).join("\n");

  return '<section class="collaborate team-section" id="team">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Core team</p>\n' +
'    <h2 class="collab-title-main">The anchors.</h2>\n' +
'    <p class="collab-sub">A small team with an outsized brief: lawyers, product builders, designers and policy minds who lead the mission day to day. Tap any card for the longer story.</p>\n' +
"  </div>\n" +
'  <div class="team-grid" id="teamGrid">\n' + cards + "\n  </div>\n" +
"</section>\n" +
/* contributors bridge: same stylised strip as the homepage (heads filled
   by js/team.js from /contributors/photos.json, waves on hover) */
'<div class="collab-strip team-strip" id="collabStrip">\n' +
'  <span class="strip-text">The anchor team leads the mission day to day, but none of it would be possible without <strong>100+ contributors</strong> across the ecosystem</span>\n' +
'  <span class="strip-group">\n' +
'    <span class="strip-stack" id="stripStack" aria-hidden="true"></span>\n' +
'    <a class="strip-btn" href="/contributors/#contributors">Meet the contributors<span class="strip-arrow" aria-hidden="true">&rarr;</span></a>\n' +
"  </span>\n" +
"</div>\n" +
'<div class="job-modal" id="teamModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel" role="dialog" aria-modal="true" aria-labelledby="tmName">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">\u00d7</button>\n' +
'    <div class="contrib-head">\n' +
'      <img class="avatar avatar-xl" id="tmPhoto" src="" alt="" />\n' +
'      <div><p class="beat-eyebrow">Core team</p>\n' +
'      <h2 class="job-title" id="tmName"></h2>\n' +
'      <p class="job-summary" id="tmRole"></p></div>\n' +
"    </div>\n" +
'    <article class="job-body" id="tmBody"></article>\n' +
'    <div class="cta-row" id="tmLinks"></div>\n' +
"  </div>\n" +
"</div>\n" +
'<script type="application/json" id="teamData">' + JSON.stringify(team) + "</script>\n" +
'<script src="/js/team.js"></script>\n';
}

function teamPage() {
  /* /team/ is a REDIRECT STUB now: the team lives at /about/#team. Kept so
     old links and the pushed nav keep working; excluded from sitemap. */
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n' +
    '<meta http-equiv="refresh" content="0; url=/about/#team" />\n' +
    '<link rel="canonical" href="' + SITE + '/about/" />\n' +
    '<meta name="robots" content="noindex" />\n' +
    "<title>Meet the Team | PUCAR</title>\n</head>\n<body>\n" +
    '<p>The team has moved to <a href="/about/#team">the About page</a>.</p>\n' +
    '<script>location.replace("/about/#team");</script>\n' +
    "</body>\n</html>\n";
}


function dristiPage() {
  /* /dristi/ (July 2026). Sources: AGAMI_CONTEXT.md + ARCHITECTURE.md (2.0)
     + oncourts.kerala.gov.in (about + public Metabase dashboard, numbers
     read 5 July 2026) + egov.org.in/product/dristi-by-pucar +
     github.com/pucardotorg/dristi. Copy conventions: no em dashes.
     Layout: intro (what DRISTI is) -> five levers -> 1.0 vs 2.0 -> WHERE
     IT RUNS: state tabs (Kerala live; Punjab/Haryana/Gujarat greyed
     "coming soon"), district sub-tabs under each state (Kollam live).
     The Kerala panel carries the live-dashboard stats, the 600->140
     journey, the district RACE chart (user-supplied Kaplan-Meier data,
     re-themed from the uploaded oncourts_overtake.html), and voices. */

  const LEVERS = [
    { t: "Integrated", b: "The court is digitally connected to police, post and treasury. Summons, fees and processes move between institutions in real time, with tracking." },
    { t: "Asynchronous", b: "Key case actions happen without everyone standing in the same room at the same time. Cognizance, submissions and many hearings proceed on their own clock." },
    { t: "Proactive", b: "The court reaches out first: SMS alerts tell litigants where their case stands and what to do next, instead of leaving them to chase updates." },
    { t: "Assisted", b: "Rule-based guidance helps lawyers file complete cases in about 30 minutes, helps staff scrutinise them, and helps judges act on structured information." },
    { t: "Data driven", b: "A live public dashboard shows how the court is performing, stage by stage, so processes and policies evolve on evidence rather than anecdote." }
  ];
  const leversHtml = LEVERS.map(function (l, i) {
    return '    <div class="about-step">\n' +
      '      <span class="about-step-num">0' + (i + 1) + '</span>\n' +
      "      <h3>" + esc(l.t) + "</h3>\n" +
      "      <p>" + esc(l.b) + "</p>\n" +
      "    </div>";
  }).join("\n");

  const JOURNEY = [
    ["Filing to registration", "10 days", "Same day"],
    ["Registration to cognizance", "150 days", "7 days"],
    ["Summons and bail", "300 days", "52 days"],
    ["Between hearings", "60 days", "14 days"],
    ["Filing to disposal", "~600 days", "~140 days"]
  ];
  const journeyHtml = JOURNEY.map(function (r, i) {
    var last = i === JOURNEY.length - 1;
    return '    <div class="dristi-journey-row' + (last ? " is-total" : "") + '">' +
      '<span class="dj-stage">' + esc(r[0]) + "</span>" +
      '<span class="dj-old">' + esc(r[1]) + "</span>" +
      '<span class="dj-arrow" aria-hidden="true">&rarr;</span>' +
      '<span class="dj-new">' + esc(r[2]) + "</span></div>";
  }).join("\n");

  /* two HERO stats up front, four supporting below (revised: six equal
     cards in one row read as noise; the story is volume + speed). Each
     carries an icon from the site's inline stroke set (same style as the
     resources type icons) so the numbers read at a glance. */
  const kstatsHtml =
'      <div class="dristi-stat is-big"><span class="dristi-stat-num">1,920</span><span class="dristi-stat-label">cases filed in a court that did not exist two years ago</span></div>\n' +
'      <div class="dristi-stat is-big"><span class="dristi-stat-num">~5 <em>months</em></span><span class="dristi-stat-label">average time to disposal. The conventional baseline: about 2 years</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">402</span><span class="dristi-stat-label">Cases disposed</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">98%</span><span class="dristi-stat-label">Hearings held as scheduled</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">851</span><span class="dristi-stat-label">Advocates on the platform</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">1,757</span><span class="dristi-stat-label">Litigants using it</span></div>';

  const main =
'  <p class="beat-eyebrow">DRISTI</p>\n' +
'  <h1 class="job-title">The operating system for people-centric courts.</h1>\n' +
'  <article class="job-body prose no-cap" id="what">\n' +
"    <p>DRISTI, the Dispute Resolution Intelligent System for Transformation, is the open-source platform that powers PUCAR\u2019s 24x7 Open and Networked Courts. It is not a digitisation of paper processes: it redesigns the court journey end to end, so that filing, scrutiny, summons, bail, hearings and orders all work the way you would build them today, natively digital, rule-based, and connected to the institutions around the court.</p>\n" +
"    <p>Built in the open as a Digital Public Good, DRISTI is PUCAR\u2019s contribution to Phase III of India\u2019s eCourts project, which calls for exactly this: open, interoperable infrastructure, shared data standards, and reimagined processes. A litigant should be proactively informed, a lawyer should file in minutes from anywhere, a judge should act on structured information, and none of them should run pillar to post.</p>\n" +
"  </article>\n" +
'  <div class="about-stats dristi-hero-stats">\n' +
'    <div class="about-stat"><span class="about-stat-num">10%</span><span class="about-stat-label">of India\u2019s criminal pendency is cheque dishonour, the first case type</span></div>\n' +
'    <div class="about-stat"><span class="about-stat-num">600 \u2192 140</span><span class="about-stat-label">days, filing to disposal, in the redesigned journey</span></div>\n' +
'    <div class="about-stat"><span class="about-stat-num">24x7</span><span class="about-stat-label">the court accepts filings and requests around the clock</span></div>\n' +
"  </div>\n" +
'  <div class="job-body prose about-steps-head"><h2>Five levers of transformation</h2></div>\n' +
'  <div class="about-steps dristi-steps">\n' + leversHtml + "\n  </div>\n" +
"</main>\n" +

'<section class="collaborate dristi-versions" id="versions">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">The platform</p>\n' +
'    <h2 class="collab-title-main">From 1.0 to 2.0.</h2>\n' +
'    <p class="collab-sub">The first generation proved the model in a real court. The second is being rebuilt around everything that court taught us.</p>\n' +
"  </div>\n" +
'  <div class="ver-grid">\n' +
'    <article class="ver-card ver-one">\n' +
'      <span class="ver-num" aria-hidden="true">1.0</span>\n' +
'      <span class="ver-status"><i class="ver-dot"></i>Live in Kollam</span>\n' +
'      <h3 class="ver-title">The proven foundation.</h3>\n' +
'      <p class="ver-body">Built as a Digital Public Good on the DIGIT platform: a rules-based system that runs the 24x7 ON Court today, wired into police, post, treasury and SMS.</p>\n' +
'      <ul class="ver-list">\n' +
'        <li>Rules-based workflows, end to end</li>\n' +
'        <li>Shared registries and open data standards</li>\n' +
'        <li>Modular services on DIGIT</li>\n' +
'        <li>Open source, in the commons</li>\n' +
"      </ul>\n" +
'      <a class="ver-link" href="https://github.com/pucardotorg/dristi" target="_blank" rel="noopener">See the code<span aria-hidden="true"> &rarr;</span></a>\n' +
"    </article>\n" +
'    <span class="ver-bridge" aria-hidden="true"><svg viewBox="0 0 40 16" width="40" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h34M30 2l6 6-6 6"/></svg></span>\n' +
'    <article class="ver-card ver-two">\n' +
'      <span class="ver-num" aria-hidden="true">2.0</span>\n' +
'      <span class="ver-status is-build"><i class="ver-dot"></i>In build</span>\n' +
'      <h3 class="ver-title">The AI-native rebuild.</h3>\n' +
'      <p class="ver-body">2.0 starts from the lessons of running a real court: intelligence woven through the platform rather than rules bolted on, and a system light enough to live on the court\u2019s own hardware.</p>\n' +
'      <ul class="ver-list">\n' +
'        <li>AI-native from the first line of code</li>\n' +
'        <li>Standards-compliant by default</li>\n' +
'        <li>Lightweight: one deployable, on-premise</li>\n' +
'        <li>Bespoke to each court, configurable by its own staff</li>\n' +
"      </ul>\n" +
'      <a class="ver-link" href="/#collaborate">Help build it<span aria-hidden="true"> &rarr;</span></a>\n' +
"    </article>\n" +
"  </div>\n" +
"</section>\n" +

'<section class="collaborate dristi-deploy" id="deployments">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Where it runs</p>\n' +
'    <h2 class="collab-title-main">One court live. More on the way.</h2>\n' +
'    <p class="collab-sub">ON Courts in Kollam is the first running instance of DRISTI. Work with new High Courts is underway; each state lights up here as it goes live.</p>\n' +
"  </div>\n" +
'  <div class="res-tabbar state-tabbar" role="tablist" aria-label="States">\n' +
'    <button type="button" class="res-tab is-active" data-state="kerala"><span class="board-live" aria-hidden="true"></span>Kerala</button>\n' +
'    <button type="button" class="res-tab tab-soon" disabled>Punjab<span class="soon-chip">Coming soon</span></button>\n' +
'    <button type="button" class="res-tab tab-soon" disabled>Haryana<span class="soon-chip">Coming soon</span></button>\n' +
'    <button type="button" class="res-tab tab-soon" disabled>Gujarat<span class="soon-chip">Coming soon</span></button>\n' +
"  </div>\n" +
'  <div class="res-tagbar district-tagbar" aria-label="Districts">\n' +
'    <button type="button" class="res-tab is-active" data-district="kollam"><span class="board-live" aria-hidden="true"></span>Kollam</button>\n' +
'    <button type="button" class="res-tab tab-soon" disabled>More districts<span class="soon-chip">Coming soon</span></button>\n' +
"  </div>\n" +

'  <div class="dristi-panel" id="panelKollam">\n' +
'    <div class="dristi-panel-head">\n' +
'      <h3 class="dristi-panel-title">24x7 ON Court, Kollam</h3>\n' +
'      <p class="dristi-panel-sub">Live since 20 November 2024 under the High Court of Kerala. It accepts cheque dishonour cases under Section 138 of the Negotiable Instruments Act arising from nine police stations in Kollam district, and it never closes: a court that goes to people, instead of people going to courts.</p>\n' +
"    </div>\n" +
'    <div class="dristi-stat-grid">\n' + kstatsHtml + "\n    </div>\n" +
'    <p class="dristi-source">Figures from the <a href="https://oncourts.kerala.gov.in/dashboard" target="_blank" rel="noopener">public ON Courts dashboard</a>, July 2026. 80% of disposed cases end in withdrawal: parties settle directly once the process is credible and predictable.</p>\n' +

'    <div class="dristi-journey">\n' +
'      <div class="dristi-journey-head"><h4>The journey, before and after</h4><p>Median stage times for cheque dishonour cases, conventional process versus the ON Court redesign.</p></div>\n' +
journeyHtml + "\n" +
"    </div>\n" +

/* ---- the race (user-supplied Kaplan-Meier data, PUCAR-themed) ---- */
'    <div class="race" id="race">\n' +
'      <div class="race-head">\n' +
'        <div>\n' +
'          <h4 class="race-title">The race: fifteen districts, one year</h4>\n' +
'          <p class="race-sub">Share of January 2025 cheque dishonour filings resolved, day by day, across every Kerala district. The ON Court starts near the back of the pack and finishes first.</p>\n' +
"        </div>\n" +
'        <button class="race-btn" id="raceBtn" type="button">\u25b6 Play the race</button>\n' +
"      </div>\n" +
'      <div class="race-stats">\n' +
'        <div class="race-stat is-hero"><span class="race-stat-num">#8 \u2192 #1</span><span class="race-stat-label">ON Court rank over one year</span></div>\n' +
'        <div class="race-stat"><span class="race-stat-num">39% vs 11%</span><span class="race-stat-label">resolved at one year, ON Court vs Kerala average</span></div>\n' +
'        <div class="race-stat"><span class="race-stat-num">~Day 359</span><span class="race-stat-label">the ON Court overtakes the last district ahead of it</span></div>\n' +
"      </div>\n" +
'      <div class="race-rank"><span class="race-rank-label">ON Court rank</span><span class="race-rank-num" id="raceRank">#8</span><span class="race-rank-pips" id="racePips"></span><span class="race-rank-day" id="raceDay">Day 0</span></div>\n' +
'      <div class="race-legend">\n' +
'        <span class="race-leg"><i style="background:#30CF8C;height:4px"></i>ON Court, Kollam</span>\n' +
'        <span class="race-leg"><i style="background:#DA6EAA;height:3px"></i>Malappuram (closest rival)</span>\n' +
'        <span class="race-leg"><i style="background:#F0A28A;height:2px"></i>Kerala combined</span>\n' +
'        <span class="race-leg"><i style="background:rgba(251,248,242,.3);height:2px"></i>Other districts</span>\n' +
"      </div>\n" +
'      <div id="raceChart" aria-label="Resolution race chart"></div>\n' +
'      <div class="race-flash" id="raceFlash" aria-hidden="true"><span class="race-flash-tag">Final overtake</span><span class="race-flash-head">ON Court reaches #1</span><span class="race-flash-sub">Around day 359</span></div>\n' +
'      <p class="race-note">Kaplan-Meier estimates, January 2025 filing cohort, tracked through day 417. "Rest of Kollam" is the district excluding the ON Court.</p>\n' +
"    </div>\n" +

'    <div class="dristi-voices">\n' +
'      <blockquote class="dristi-voice"><p>\u201cIn my experience, the court is completely paperless and filing is very easy. Now it only takes me 10 to 20 minutes to file a case.\u201d</p><cite data-initial="A">Asha G.V<br />Advocate, the first filer at the ON Court</cite></blockquote>\n' +
'      <blockquote class="dristi-voice"><p>\u201cThe launch is just the beginning of the journey. Progress is not a destination, it is an ongoing journey of knowledge, debate, community and continuous refinement.\u201d</p><cite data-initial="J">Justice Raja Vijayaraghavan<br />Computer Committee, High Court of Kerala</cite></blockquote>\n' +
"    </div>\n" +
'    <div class="cta-row dristi-links">\n' +
'      <a class="btn btn-primary" href="https://oncourts.kerala.gov.in/" target="_blank" rel="noopener">Visit ON Courts</a>\n' +
'      <a class="btn btn-ghost" href="https://oncourts.kerala.gov.in/dashboard" target="_blank" rel="noopener">Live dashboard</a>\n' +
'      <a class="btn btn-ghost" href="https://pucar.gitbook.io/dristi" target="_blank" rel="noopener">Documentation</a>\n' +
"    </div>\n" +
"  </div>\n" +
"</section>\n" +

'<section class="collaborate dristi-board" id="collaborate">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Collaborate</p>\n' +
'    <h2 class="collab-title-main">Citizen tools should be citizen-shaped.</h2>\n' +
'    <p class="collab-sub">DRISTI is the tool citizens will meet on the hardest days of their lives, so it is built in the open, by the people it serves: lawyers, judges, court staff, engineers, designers, researchers. This is the live board of open work on the platform. Pick up a piece of it.</p>\n' +
"  </div>\n" +
collabBoardHtml() +
'<script src="/js/view-toggle.js"></script>\n' +
'<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" defer></script>\n' +
'<script src="/js/dristi.js" defer></script>\n<main hidden>';

  return pageShell({
    title: "DRISTI | PUCAR",
    mainClass: "dristi-main",
    desc: "DRISTI is the open-source platform behind PUCAR's 24x7 ON Courts: a people-centric redesign of the court journey, live in Kollam and headed to more states.",
    url: "/dristi/",
    jsonLd: { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DRISTI",
      applicationCategory: "GovernmentApplication",
      description: "Open-source dispute resolution platform powering India's 24x7 Open and Networked Courts" },
    backHref: "/", backLabel: "\u2190 Home", main: main,
    subnav: [
      { label: "What it is", href: "#what" },
      { label: "1.0 \u2192 2.0", href: "#versions" },
      { label: "Where it runs", href: "#deployments" }
    ]
  });
}

/* ---------------- homepage cards ---------------- */

function card(job) {
  return '<article class="collab-card"' +
    ' data-slug="' + esc(job.slug) + '"' +
    ' data-stream="' + esc(job.stream || "Volunteer") + '"' +
    ' data-category="' + esc(job.category || "") + '"' +
    ' data-difficulty="' + esc(job.difficulty || "Moderate") + '"' +
    ' data-deadline="' + esc(String(job.deadline || "").slice(0, 10)) + '"' +
    ' data-expiry="' + esc(job.expiry) + '"' +
    ' data-tags="' + esc(job.tags.join("|")) + '">\n' +
    '  <a class="collab-cover" href="' + job.url + '" aria-label="' + esc(job.title) + '"></a>\n' +
    '  <div class="collab-topline"><span class="collab-cat">' + esc(job.category || "Work") + "</span>" +
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + '<svg class="diff-bars" viewBox="0 0 14 12" width="13" height="11" aria-hidden="true"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5.5" y="3.5" width="3" height="8.5" rx="1"/><rect x="11" y="0" width="3" height="12" rx="1"/></svg>' + esc(job.difficulty || "Moderate") + "</span></div>\n" +
    '  <span class="collab-type">' + esc(streamLabel(job)) + "</span>\n" +
    '  <span class="collab-title">' + esc(job.title) + "</span>\n" +
    '  <span class="collab-summary">' + esc(job.summary) + "</span>\n" +
    '  <ul class="collab-chips">' + chipsHtml(job) + "</ul>\n" +
    '  <div class="collab-meta">' +
    (job.deadline ? "<span>Deadline " + fmt(job.deadline) + "</span>" : "") +
    '<span class="collab-closes" data-expiry="' + esc(job.expiry) + '">Closes ' + fmt(job.expiry) + "</span></div>\n" +
    '  <div class="collab-foot">\n    ' + (postedByHtml(job, "") || "<span></span>") + "\n" +
    '    <span class="collab-btn">View</span>\n  </div>\n' +
    "</article>";
}

/* ---------------- SC AI policy page ---------------------------------------
   /sc-ai-policy/ -- a research-backed page on the Supreme Court's draft
   "Regulations for Use of Artificial Intelligence (AI) in Courts, 2026"
   (published 3 June 2026 by the SC's AI Committee; public feedback to
   office.regcc@sci.nic.in extended to 15 July 2026). Perspectives come
   from content/sc-perspectives/*.json (sourced from the tracking sheet),
   events from content/sc-events/*.json. Cards reuse the collaborate-card
   classes exactly; the modal is the same job-modal, driven by
   js/perspectives.js reading perspectives.json. */

const perspectives = loadDir("sc-perspectives")
  .sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
const scEvents = loadDir("sc-events")
  .sort(function (a, b) { return (a.order || 99) - (b.order || 99); });

function perspCard(p, slug) {
  return '<article class="collab-card persp-card" data-slug="' + esc(slug) + '">\n' +
    '  <a class="collab-cover" href="' + esc(p.url || "#") + '" ' + (p.url ? 'target="_blank" rel="noopener" ' : "") + 'aria-label="' + esc(p.title) + '"></a>\n' +
    '  <div class="collab-topline"><span class="collab-status">' + esc(p.outlet || "") + "</span></div>\n" +
    '  <span class="collab-type">' + esc(p.author || "") + "</span>\n" +
    '  <span class="collab-title">' + esc(p.title) + "</span>\n" +
    '  <span class="collab-summary">' + esc(p.summary) + "</span>\n" +
    '  <ul class="collab-chips">' + (p.tags || []).map(function (t) { return '<li title="' + esc(t) + '">' + esc(t) + "</li>"; }).join("") + "</ul>\n" +
    '  <div class="collab-foot">\n    <span class="collab-btn">Read the summary</span>\n  </div>\n' +
    "</article>";
}

/* Inline glyphs only -- no icon library on this site (README \u00a79). Same
   anatomy as the existing nav-home icon: 16x16 viewBox, currentColor
   stroke, aria-hidden (the text label next to each carries the meaning). */
const PIN_ICON = '<svg class="tag-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14.3S3.2 9.6 3.2 6.3a4.8 4.8 0 0 1 9.6 0c0 3.3-4.8 8-4.8 8Z"/><circle cx="8" cy="6.2" r="1.5"/></svg>';
const CALENDAR_ICON = '<svg class="tag-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.3" y="3.3" width="11.4" height="10.4" rx="1.6"/><path d="M2.3 6.6h11.4M5.6 2v2.6M10.4 2v2.6"/></svg>';

function eventCard(ev) {
  /* SAME anatomy as the collaborate/persp cards (frosted .collab-card on a
     dark section) -- explicit request after two other designs were rejected.
     The whole card is the link. City gets a pin icon, date/time gets a
     calendar icon -- the plain text pills were "barely visible" against the
     dark card background (fixed properly in CSS, see .collaborate
     .collab-status), and the icons add a second, non-colour cue on top. */
  const when = [ev.date_display, ev.time_display].filter(Boolean).join(" \u00b7 ");
  return '<a class="collab-card event-card" href="' + esc(ev.url || "mailto:collaborate@pucar.org") + '">\n' +
    '  <div class="collab-topline"><span class="collab-cat">' + PIN_ICON + esc(ev.city) + "</span>" +
    (when ? '<span class="collab-status">' + CALENDAR_ICON + esc(when) + "</span>" : "") + "</div>\n" +
    '  <span class="collab-title">' + esc(ev.title) + "</span>\n" +
    (ev.venue ? '  <span class="event-venue">' + esc(ev.venue) + "</span>\n" : "") +
    '  <span class="collab-summary">' + esc(ev.description || "") + "</span>\n" +
    '  <div class="collab-foot">\n    <span class="collab-btn">' + esc(ev.cta || "Register interest") + "</span>\n  </div>\n" +
    "</a>";
}

function scPolicyPage() {
  const main =
'  <p class="beat-eyebrow">PUCAR // Public consultation</p>\n' +
'  <h1 class="job-title">The Supreme Court wants your views on AI in its courts.</h1>\n' +
'  <article class="job-body prose">\n' +
"    <p>On 3 June 2026, the Supreme Court's Artificial Intelligence Committee published the draft Regulations for Use of Artificial Intelligence (AI) in Courts, 2026, a first-of-its-kind framework covering the Supreme Court, all High Courts, subordinate courts, tribunals, and statutory bodies performing adjudicatory roles.</p>\n" +
"    <p>The draft rests on a simple hierarchy: AI may assist, but never adjudicate. It permits AI for research, summarisation, translation, transcription, scheduling, litigant-assistance chatbots, and court analytics, and absolutely prohibits AI-only decisions, AI-based risk scoring for bail or credibility, predictive profiling, surveillance of judges or lawyers, and undisclosed AI-generated evidence. Lawyers must disclose AI use in filings, and a permanent Apex Body at the Supreme Court would approve and supervise tools across the system.</p>\n" +
'    <p>Citizen feedback is open until 15 July 2026 (extended from June 20). Anyone (lawyers, technologists, litigants, or curious citizens) can email comments to the Member Secretary, AI Committee, at <a href="mailto:office.regcc@sci.nic.in">office.regcc@sci.nic.in</a>.</p>\n' +
"  </article>\n" +
'  <div class="cta-row">\n' +
'    <a class="btn btn-primary" href="mailto:office.regcc@sci.nic.in?subject=Feedback%20on%20Draft%20AI%20Regulations%20for%20Courts%2C%202026">Send the Court your feedback</a>\n' +
'    <a class="btn btn-outline" href="https://cdnbbsr.s3waas.gov.in/s3ec0490f1f4972d133619a60c30f3559e/uploads/2026/06/2026060342.pdf" target="_blank" rel="noopener">Read the Court’s notice</a>\n' +
"  </div>\n" +
'  <aside class="civis-callout">\n' +
'    <div class="civis-callout-text">\n' +
'      <p class="civis-kicker">Respond in minutes</p>\n' +
'      <h2 class="civis-title">Not sure where to start? Respond on CIVIS.</h2>\n' +
'      <p class="civis-sub">CIVIS turns the draft into a short guided questionnaire, in English and four Indian languages, and delivers your views to the Court\u2019s AI Committee.</p>\n' +
"    </div>\n" +
'    <div class="civis-callout-action">\n' +
'      <a class="civis-btn" href="https://www.civis.vote/consultations/1575/read" target="_blank" rel="noopener">Respond on CIVIS<span class="civis-btn-arrow" aria-hidden="true">\u2192</span></a>\n' +
'      <p class="civis-count" id="civisCount" hidden></p>\n' +
"    </div>\n" +
"  </aside>\n" +
"</main>\n" +
'<section class="collaborate persp-section" id="perspectives">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">What people are saying</p>\n' +
'    <h2 class="collab-title-main">The public record, so far.</h2>\n' +
'    <p class="collab-sub">Explainers, critiques, and formal submissions on the draft regulations. Click any card for a summary of the viewpoint, or open the original.</p>\n' +
"  </div>\n" +
'  <div class="collab-grid" id="perspGrid">\n' +
perspectives.map(function (p) { return perspCard(p, p.slug); }).join("\n") + "\n" +
"  </div>\n" +
"</section>\n" +
'<section class="collaborate participate" id="participate">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Ways to participate</p>\n' +
'    <h2 class="participate-title">Say something before July 15.</h2>\n' +
"  </div>\n" +
'  <div class="participate-grid">\n' +
scEvents.map(eventCard).join("\n") + "\n" +
"  </div>\n" +
'</section>\n' +
'<div class="job-modal" id="jobModal" hidden>\n' +
'  <div class="job-modal-backdrop" data-close></div>\n' +
'  <div class="job-modal-panel" role="dialog" aria-modal="true" aria-labelledby="jobModalTitle">\n' +
'    <button class="job-modal-close" type="button" data-close aria-label="Close">×</button>\n' +
'    <p class="beat-eyebrow" id="jobModalType"></p>\n' +
'    <h2 class="job-title" id="jobModalTitle"></h2>\n' +
'    <div class="job-meta" id="jobModalMeta"></div>\n' +
'    <ul class="job-chips" id="jobModalChips"></ul>\n' +
'    <article class="job-body" id="jobModalBody"></article>\n' +
'    <div class="cta-row">\n' +
'      <a class="btn btn-primary" id="jobModalApply" href="#" target="_blank" rel="noopener">Read the original</a>\n' +
"    </div>\n  </div>\n</div>\n" +
'<script src="/js/perspectives.js"></script>\n<script src="/js/view-toggle.js"></script>\n<main hidden>';
  return pageShell({
    title: "The Supreme Court’s draft AI regulations | Have your say | PUCAR",
    desc: "The Supreme Court of India is inviting public feedback on its draft Regulations for Use of AI in Courts, 2026, until July 15. Read what people are saying and add your voice.",
    url: "/sc-ai-policy/",
    backHref: "/", backLabel: "← pucar.org", main: main
  }).replace("<main hidden>\n</main>", ""); // close the shell's main early; sections above are full-bleed
}

/* ---------------- write everything ---------------- */

["collaborate", "contributors", "sc-ai-policy", "about", "team", "resources"].forEach(function (d) {
  fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });
});
fs.mkdirSync(path.join(ROOT, "collaborate"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "sc-ai-policy"), { recursive: true });

fs.writeFileSync(path.join(ROOT, "sc-ai-policy", "index.html"), scPolicyPage());
fs.writeFileSync(path.join(ROOT, "sc-ai-policy", "perspectives.json"), JSON.stringify(perspectives.map(function (p) {
  return {
    slug: p.slug, title: p.title, author: p.author, outlet: p.outlet,
    type: p.type, url: p.url, tags: p.tags || [],
    html: mdToHtml(p.body || "")
  };
}), null, 1));

jobs.forEach(function (job) {
  const dir = path.join(ROOT, "collaborate", job.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), jobPage(job));
});

contributors.forEach(function (person) {
  const dir = path.join(ROOT, "contributors", person.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), contributorPage(person));
});
fs.writeFileSync(path.join(ROOT, "contributors", "index.html"), contributorsPage());
/* full profile payloads for the contributors-page modal */
fs.writeFileSync(path.join(ROOT, "contributors", "profiles.json"),
  JSON.stringify(contributors.map(function (c) {
    return { slug: c.slug, url: c.url, name: c.name, role: c.role || "",
      organisation: c.organisation || "", photo: c.photo || "",
      links: c.links || [], html: mdToHtml(c.body || "") };
  })));
/* photo list for the homepage's beat-9 "waving heads" stream */
fs.writeFileSync(path.join(ROOT, "contributors", "photos.json"),
  JSON.stringify(contributors.filter(function (c) { return c.photo; })
    .map(function (c) { return { src: c.photo, name: c.name, org: c.organisation || "", url: c.url }; })));
fs.mkdirSync(path.join(ROOT, "about"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "about", "index.html"), aboutPage());
fs.mkdirSync(path.join(ROOT, "team"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "team", "index.html"), teamPage());
fs.mkdirSync(path.join(ROOT, "resources"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "resources", "index.html"), resourcesPage());
fs.mkdirSync(path.join(ROOT, "dristi"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dristi", "index.html"), dristiPage());

fs.writeFileSync(path.join(ROOT, "collaborate", "jobs.json"), JSON.stringify(jobs.map(function (j) {
  return {
    slug: j.slug, url: j.url, title: j.title, summary: j.summary,
    stream: j.stream, term: j.term, streamLabel: streamLabel(j),
    category: j.category, difficulty: j.difficulty, status: j.status,
    date: j.date, deadline: j.deadline, expiry: j.expiry,
    commitment: j.commitment, location: j.location, tags: j.tags,
    apply_url: j.apply_url,
    poster: j.poster ? { name: j.poster.name, url: j.poster.url, photo: j.poster.photo || "" } : null,
    html: mdToHtml(j.body || "")
  };
}), null, 1));

/* inject board cards into index.html between markers */
const indexPath = path.join(ROOT, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const START = "<!-- COLLAB:START -->", END = "<!-- COLLAB:END -->";
const s = html.indexOf(START), e = html.indexOf(END);
if (s === -1 || e === -1) {
  console.error("COLLAB markers not found in index.html — cards not injected.");
  process.exit(1);
}
html = html.slice(0, s + START.length) + "\n" +
  (boardJobs.length ? boardJobs.map(card).join("\n")
    : '<p class="collab-empty">No open work right now — check back soon, or write to us.</p>') +
  "\n" + html.slice(e);
fs.writeFileSync(indexPath, html);

/* sitemap */
const urls = [SITE + "/", SITE + "/sc-ai-policy/", SITE + "/contributors/", SITE + "/about/", SITE + "/dristi/", SITE + "/resources/"]
  .concat(jobs.map(function (j) { return SITE + j.url; }))
  .concat(contributors.map(function (c) { return SITE + c.url; }));
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(function (u) { return "  <url><loc>" + u + "</loc></url>"; }).join("\n") + "\n</urlset>\n");

/* robots.txt -- allow everything (incl. AI crawlers) and point at the sitemap */
fs.writeFileSync(path.join(ROOT, "robots.txt"),
  "User-agent: *\nAllow: /\n\nSitemap: " + SITE + "/sitemap.xml\n");

console.log("Built " + jobs.length + " job page(s) (" + boardJobs.length + " on the board), " +
  contributors.length + " contributor page(s), sc-ai-policy (" + perspectives.length +
  " perspectives, " + scEvents.length + " events), jobs.json, cards, sitemap.xml, robots.txt");
