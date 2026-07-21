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
const SITE = (process.env.URL || "https://pucar.netlify.app").replace(/\/$/, "");
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

function catIcon(cat) {
  var w = String(cat || "").toLowerCase();
  var d =
    w.indexOf("dev") === 0 ? "M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" :            // code
    w.indexOf("design") === 0 ? "M9.5 2.5 13.5 6.5 6 14H2v-4L9.5 2.5zM8 4l4 4" :        // pen
    w.indexOf("legal") === 0 ? "M8 1.5v11M4.2 3.5h7.6M4.2 3.5 2.4 8a2 2 0 0 0 3.6 0L4.2 3.5zM11.8 3.5 10 8a2 2 0 0 0 3.6 0l-1.8-4.5zM5.5 14.5h5" : // scales
    w.indexOf("content") === 0 ? "M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3" :        // doc lines
    w.indexOf("research") === 0 ? "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6 14 14" : // magnifier
    w.indexOf("data") === 0 ? "M2 13.5h12M4 13.5V8M8 13.5V4M12 13.5V6" :                  // chart
    w.indexOf("policy") === 0 ? "M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM5.5 5h5M5.5 7.5h5M5.5 10h3" : // scroll
    "M8 2l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L4.4 13l.7-4L2.2 6.2l4-.6L8 2z";               // star (fallback)
  return '<svg class="cat-ico" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
}

function catLabel(cat) { // display-only shortening; data stays intact
  return String(cat || "Work").replace(/^Development$/i, "Dev");
}
function diffLabel(d) { // "Low Difficulty" -> "Low": bare text needs no suffix
  return String(d || "Moderate").split(" ")[0];
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
  // the LISTING never closes before the application DEADLINE ("deadline
  // says 30 Sep but it closes in 39 days" -- flipped and confusing).
  // With a deadline, the listing stays up exactly until it; otherwise the
  // old posted+listing_days window applies.
  j.expiry = j.deadline ? String(j.deadline).slice(0, 10)
    : addDays(String(j.date).slice(0, 10), j.listing_days || 30);
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

/* CACHE BUSTING (Jul 2026): iPhone Safari was serving week-old style.css
   despite fix after fix landing ("this judge thing keeps breaking") -- the
   site had no versioning at all. Every build stamps local css/js URLs with
   ?v=<build id>, in generated pages AND index.html (rewritten below). */
const BUILD_V = Date.now().toString(36);
function bust(html) {
  return html.replace(/(href|src)="((?:\/)?(?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g, '$1="$2?v=' + BUILD_V + '"');
}

function pageShell(opts) {
  return bust("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n" +
'<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n' +
"<title>" + esc(opts.title) + "</title>\n" +
'<meta name="description" content="' + esc(opts.desc) + '" />\n' +
'<link rel="canonical" href="' + SITE + opts.url + '" />\n' +
'<meta property="og:type" content="website" />\n' +
'<meta property="og:site_name" content="PUCAR" />\n' +
'<meta property="og:title" content="' + esc(opts.title) + '" />\n' +
'<meta property="og:description" content="' + esc(opts.desc) + '" />\n' +
'<meta property="og:url" content="' + SITE + opts.url + '" />\n' +
'<meta property="og:image" content="' + SITE + '/assets/graph-photo.webp" />\n' +
'<meta property="og:image:width" content="1920" />\n' +
'<meta property="og:image:height" content="1080" />\n' +
'<meta property="og:image:type" content="image/webp" />\n' +
'<meta property="og:image:alt" content="' + esc(opts.title) + '" />\n' +
'<meta name="twitter:card" content="summary_large_image" />\n' +
'<meta name="twitter:title" content="' + esc(opts.title) + '" />\n' +
'<meta name="twitter:description" content="' + esc(opts.desc) + '" />\n' +
'<meta name="twitter:image" content="' + SITE + '/assets/graph-photo.webp" />\n' +
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
FOOTER + "\n</body>\n</html>\n");
}

/* ---------------- job pieces ---------------- */

function jobMetaHtml(job) {
  return '<div class="job-meta">' +
    '<span class="collab-cat">' + catIcon(job.category) + esc(catLabel(job.category)) + "</span>" +
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + '<svg class="diff-bars" viewBox="0 0 14 12" width="13" height="11" aria-hidden="true"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5.5" y="3.5" width="3" height="8.5" rx="1"/><rect x="11" y="0" width="3" height="12" rx="1"/></svg>' + esc(diffLabel(job.difficulty)) + "</span>" +
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
    '    <a class="btn btn-outline" href="/dristi/#collaborate">See all work</a>\n  </div>';
  return pageShell({
    title: job.title + " | Collaborate with PUCAR",
    desc: job.summary, url: job.url, jsonLd: jsonLd,
    backHref: "/dristi/#collaborate", backLabel: "← All work", main: main
  });
}

/* ---------------- contributor pages ---------------- */

function jobLine(job, note) {
  return '<li><a href="' + job.url + '">' + esc(job.title) + "</a>" +
    '<span class="collab-cat">' + catIcon(job.category) + esc(catLabel(job.category)) + "</span>" +
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
'      <p class="policy-kicker">AI in courts</p>\n' +
'      <h2 class="policy-title">Our comments on the SC&rsquo;s AI policy.</h2>\n' +
'      <p class="policy-sub">A draft framework for how courts can use AI -- assist, never adjudicate. The collective read it closely and put its views on the record: explainers, critiques, and formal submissions, all in one place.</p>\n' +
'      <div class="cta-row">\n' +
'        <a class="btn btn-primary" href="/sc-ai-policy/">Our comments on the SC&rsquo;s AI policy</a>\n' +
"      </div>\n" +
"    </div>\n" +
"  </div>\n" +
"</section>\n\n" +

contributorsSection() +
"<main hidden>";
  return pageShell({
    title: "About Contributing | PUCAR",
    desc: "Three ways into PUCAR's work: the DRISTI 2.0 platform, the Supreme Court's AI policy, and the 100+ contributors who make up the collective.",
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

/* THE blog section — a single generator shared by the /resources/ page and
   the homepage mirror, so the two can never drift. Both read the same
   content/resources/blog.json; on the homepage this is injected between the
   <!-- BLOG:START/END --> markers below the map. */
function blogSection() {
  const resBlog = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/blog.json"), "utf8"));
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
  return '<section class="collaborate res-section" id="blog">\n' +
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
    "</section>\n";
}

function resourcesPage() {
  const resData = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/data.json"), "utf8"));
  const resCircles = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/circles.json"), "utf8"));

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

blogSection() +

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


/* ---------------- The 10 Unlocks (DRISTI page section) ----------------
   Interactive "unlock" cards drawn from the ON Court transformation-
   learnings note. Each card is locked; opening it reveals the BEFORE ->
   ON COURT change and its replicability rating, and the three cards with
   a documented day-saving drive the running "days off the clock" tally.
   Behaviour lives in /js/unlocks.js; styling in css/style.css (.unlocks). */
function tenUnlocksHtml() {
  var LOCK =
    '<svg class="unlock-lock" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
    '<path class="shk" d="M8 11V7.7a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<rect class="bod" x="5" y="11" width="14" height="9.4" rx="2.2" fill="currentColor"/>' +
    '<circle class="hle" cx="12" cy="15" r="1.5" fill="var(--forest-deep)"/>' +
    '<rect class="hle" x="11.3" y="15.6" width="1.4" height="3" rx=".7" fill="var(--forest-deep)"/>' +
    "</svg>";
  var DIM = { efficiency: "Efficiency", predictability: "Predictability", seamlessness: "Seamlessness" };
  var U = [
    { dim: "efficiency", days: 14, title: "Fees collected upfront, at filing", metric: "saves 14+ days",
      before: "Advocates made small, separate payments (₹1–5) at every step — for notices, summons and warrants. A missed or delayed payment stalled the process and wasted a court date.",
      after: "All fees are auto-calculated and collected in one payment at filing. Every later step — notice, summons, warrant — dispatches automatically, with no further payment dependency.",
      stars: 3, rep: "Replicable across dispute types and state contexts." },
    { dim: "efficiency", days: 10, title: "Defects caught at filing, fixed online", metric: "saves ~10 days",
      before: "Errors in required data or documents — limitation dates, condonation applications, affidavits — were marked on physical files. Advocates had to come in person to find and fix them.",
      after: "Required data and documents are flagged and auto-generated at filing. In 80% of defective cases, corrections now happen online the same day, with no visit to court.",
      stars: 3, rep: "Replicable across states; needs configuration to each case type’s requirements." },
    { dim: "efficiency", days: 150, title: "Cognizance taken same day, asynchronously", metric: "saves ~150 days",
      before: "A magistrate scheduled a hearing just to take cognizance — usually set two-plus months out, depending on the court’s caseload.",
      after: "Cognizance is taken the same day as filing, without a hearing. The complainant and advocate never appear for this step at all.",
      stars: 3, rep: "Replicable across case types and state contexts." },
    { dim: "efficiency", days: 0, title: "Process dispatch wired into police systems", metric: "manual handoffs → 0",
      before: "When a magistrate ordered a process, staff printed it, updated it and physically handed it to police — with no reliable way to track status in between.",
      after: "Dispatch is immediate and system-generated, shared straight with police. Magistrates and staff track the live status of every process and summons.",
      stars: 2, rep: "Depends on the maturity of the state’s police and postal systems." },
    { dim: "predictability", days: 0, title: "Hearing dates set from data, not habit", metric: "60 → 14 days between hearings",
      before: "Magistrates set the next hearing roughly two months out as a thumb rule — regardless of what the case actually needed next.",
      after: "System data guides scheduling: hearings are set 14 days apart by default, with shorter or longer gaps chosen deliberately by action type.",
      stars: 2, rep: "Needs rigorous, periodic data governance to sustain." },
    { dim: "seamlessness", days: 0, title: "Litigants told directly, in plain language", metric: "advocate dependency → 0",
      before: "Litigants depended entirely on their advocate for case information. Direct access meant fighting captchas and legal jargon on court websites.",
      after: "Litigants get a personal login and direct SMS updates — hearing dates, purpose, documents needed, outcomes — in plain language, independent of their advocate.",
      stars: 3, rep: "Replicable across case types and state contexts." },
    { dim: "seamlessness", days: 0, title: "Orders bulk-signed, published same day", metric: "next-day → same-day",
      before: "Orders were typed, signed and copied one by one through the day — often published only the next day. Magistrates spent 30+ minutes a day just signing.",
      after: "The magistrate reviews and bulk-signs every order from the day’s hearings in one sitting. All signed orders publish to the public docket immediately.",
      stars: 3, rep: "Replicable across case types and state contexts." },
    { dim: "seamlessness", days: 0, title: "Physical registers eliminated", metric: "50+ registers → 0",
      before: "Courts kept 50+ physical registers by hand — case, bail, process, order, appearance, daily diary — duplicating what was already in the file.",
      after: "Zero physical registers. Register data is captured as a byproduct of digital case actions, and reports generate automatically.",
      stars: 2, rep: "Needs adaptation to each state’s context and practices." },
    { dim: "seamlessness", days: 0, title: "Natively digital filing, end to end", metric: "0 print · scan · visits",
      before: "‘E-filing’ elsewhere still meant printing, scanning and uploading a file, plus a physical copy — and a visit to court to fix any defect.",
      after: "Litigants and advocates file cases and applications digitally first. Defects are corrected online, without resubmitting the whole file.",
      stars: 2, rep: "Needs configuration of rules to each case type." },
    { dim: "seamlessness", days: 0, title: "One shared digital case file", metric: "4 copies → 1 source of truth",
      before: "The case file existed only on paper — the judge’s copy, the clerk’s record, the advocate’s notes and the litigant’s copies all separate, exchanged by hand.",
      after: "All documents, orders, evidence and notes live in one digital case file, visible in real time to magistrate, advocate and litigant alike.",
      stars: 3, rep: "Replicable across case types and state contexts." }
  ];
  var totalDays = U.reduce(function (s, u) { return s + u.days; }, 0);
  var cards = U.map(function (u, i) {
    var no = (i + 1 < 10 ? "0" : "") + (i + 1);
    return '<article class="unlock" data-dim="' + u.dim + '" data-days="' + u.days + '">' +
      '<button type="button" class="unlock-face" aria-expanded="false">' +
        '<span class="unlock-top"><span class="unlock-no">' + no + "</span>" + LOCK + "</span>" +
        '<span class="unlock-dim u-' + u.dim + '">' + DIM[u.dim] + "</span>" +
        '<span class="unlock-title">' + u.title + "</span>" +
        '<span class="unlock-metric">' + u.metric + "</span>" +
        '<span class="unlock-cue"><span class="uc-lock">Tap to unlock</span><span class="uc-open">Unlocked</span></span>' +
      "</button>" +
      '<div class="unlock-body"><div class="ub-inner">' +
        '<div class="ub-cols">' +
          '<div class="ub-col ub-before"><span class="ub-tag">Before</span><p>' + u.before + "</p></div>" +
          '<div class="ub-col ub-after"><span class="ub-tag">ON Court</span><p>' + u.after + "</p></div>" +
        "</div>" +
      "</div></div>" +
    "</article>";
  }).join("\n");

  return '<section class="unlocks cp-darkzone" id="unlocks" data-total-days="' + totalDays + '">\n' +
    '  <div class="unlocks-head">\n' +
    '    <p class="beat-eyebrow">The 10 Unlocks</p>\n' +
    '    <h2 class="unlocks-title">The numbers came from redesign, not digitisation.</h2>\n' +
    '    <p class="unlocks-sub">Ten specific changes account for the impact above. Open each to see what it replaced — and what it saved. Three of them, on their own, take ' + totalDays + ' days off the clock before a case is even argued.</p>\n' +
    "  </div>\n" +
    '  <div class="unlocks-dash">\n' +
    '    <div class="unlocks-tally"><div class="ut-num"><span data-count>0</span><span class="ut-unit">days</span></div>' +
      '<div class="ut-cap">of delay removed as you unlock</div></div>\n' +
    '    <div class="unlocks-progress">\n' +
    '      <div class="up-label">0 / 10 unlocked</div>\n' +
    '      <div class="up-bar"><span class="up-fill"></span></div>\n' +
    '      <div class="up-actions"><button type="button" class="up-all">Unlock all</button><button type="button" class="up-reset">Reset</button></div>\n' +
    "    </div>\n" +
    "  </div>\n" +
    '  <div class="unlocks-filters">\n' +
    '    <button type="button" class="uf is-active" data-dim="all">All 10</button>\n' +
    '    <button type="button" class="uf" data-dim="efficiency">Efficiency</button>\n' +
    '    <button type="button" class="uf" data-dim="predictability">Predictability</button>\n' +
    '    <button type="button" class="uf" data-dim="seamlessness">Seamlessness</button>\n' +
    "  </div>\n" +
    '  <div class="unlocks-grid">\n' + cards + "\n  </div>\n" +
    '  <script src="/js/unlocks.js" defer></script>\n' +
    "</section>\n";
}

/* ---------------- Who benefits (DRISTI page section) ----------------
   The same redesign seen from each role's side: an interactive switcher
   (Litigant / Advocate / Registry / Judge) plus PUCAR survey stats.
   Behaviour: /js/benefits.js. Styling: css/style.css (.benefits). */
function userBenefitsHtml() {
  var IC = {
    litigant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></svg>',
    advocate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8.5 8V6.2A2.2 2.2 0 0 1 10.7 4h2.6a2.2 2.2 0 0 1 2.2 2.2V8"/><path d="M3 13h18"/></svg>',
    registry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13 3v4h4"/><path d="M10 12h5M10 15.5h5"/></svg>',
    judge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h9"/><path d="M13.5 4.5l6 6"/><rect x="10.6" y="2.3" width="7.2" height="3.4" rx="1" transform="rotate(45 14.2 4)"/><path d="M12.5 8.5 5.5 15.5"/><path d="M9 12l3 3"/></svg>'
  };
  var R = [
    { id: "litigant", name: "Litigant", stat: "68%", cap: "of documents now e-signed",
      items: ["A personal login to their own case", "Proactively told of every hearing date and next step", "Predictable timelines they can plan around", "Updates in plain language, not legal jargon", "No court visits"] },
    { id: "advocate", name: "Advocate", stat: "30 min", cap: "to file — with no physical visit",
      items: ["Filing in about 30 minutes, fully online", "Defects corrected remotely, without resubmitting", "Guided filing with fees calculated and paid in one step", "On-ground assistance when it’s needed", "No court visits"] },
    { id: "registry", name: "Registry", stat: "0", cap: "physical registers to maintain",
      items: ["No manual data entry", "Assisted scrutiny of filings", "Summons auto-generated, dispatched and tracked", "Instant access to every case file", "No 50+ physical registers kept by hand"] },
    { id: "judge", name: "Judge", stat: "Same day", cap: "orders signed and published",
      items: ["Every order from the day bulk-signed in one sitting", "Instant access to the full case file", "Assisted templates for common orders", "A predictable, data-set schedule", "Dashboards and live data at their fingertips"] }
  ];
  var btns = R.map(function (r, i) {
    return '<button type="button" class="role-btn' + (i === 0 ? " is-active" : "") + '" data-role="' + r.id + '" role="tab" aria-selected="' + (i === 0 ? "true" : "false") + '">' +
      '<span class="role-ic">' + IC[r.id] + '</span><span class="role-name">' + r.name + "</span></button>";
  }).join("\n");
  var panels = R.map(function (r, i) {
    var lis = r.items.map(function (t) { return "<li>" + t + "</li>"; }).join("");
    return '<div class="role-panel' + (i === 0 ? " is-active" : "") + '" data-role-panel="' + r.id + '" role="tabpanel">' +
      '<div class="role-card">' +
        '<div class="role-stat"><div class="role-stat-num">' + r.stat + '</div><div class="role-stat-cap">' + r.cap + "</div></div>" +
        '<ul class="role-benefits">' + lis + "</ul>" +
      "</div></div>";
  }).join("\n");

  return '<section class="benefits cp-darkzone" id="benefits">\n' +
    '  <div class="benefits-head">\n' +
    '    <p class="beat-eyebrow">Who benefits</p>\n' +
    '    <h2 class="benefits-title">The same redesign, from every side of the courtroom.</h2>\n' +
    '    <p class="benefits-sub">One system, four very different days made easier. Pick a role to see what changes for them.</p>\n' +
    "  </div>\n" +
    '  <div class="benefits-switch" role="tablist" aria-label="Roles">\n' + btns + "\n  </div>\n" +
    '  <div class="benefits-stage">\n' + panels + "\n  </div>\n" +
    '  <script src="/js/benefits.js" defer></script>\n' +
    "</section>\n";
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

  /* each row: [term, before, after, plain-English description] --
     6 Jul 2026 sync feedback: court terminology needs definitions */
  const JOURNEY = [
    ["Filing to registration", "10 days", "Same day", "The lawyer submits the case; the court checks it for defects and takes it on record."],
    ["Registration to cognizance", "150 days", "7 days", "The court formally takes notice of the complaint so the case can move forward."],
    ["Summons and bail", "300 days", "52 days", "The accused is officially notified of the case, appears, and the question of bail is settled."],
    ["Between hearings", "60 days", "14 days", "The wait from one hearing to the next."],
    ["Filing to disposal", "~600 days", "~140 days", "The whole journey, from submitting the case to its resolution."]
  ];
  const journeyHtml = JOURNEY.map(function (r, i) {
    var last = i === JOURNEY.length - 1;
    return '    <div class="dristi-journey-row' + (last ? " is-total" : "") + '">' +
      '<span class="dj-stage">' + esc(r[0]) + '<em class="dj-stage-desc">' + esc(r[3]) + "</em></span>" +
      '<span class="dj-old">' + esc(r[1]) + "</span>" +
      '<span class="dj-arrow" aria-hidden="true">&rarr;</span>' +
      '<span class="dj-new">' + esc(r[2]) + "</span></div>";
  }).join("\n");

  /* two HERO stats up front, four supporting below (revised: six equal
     cards in one row read as noise; the story is volume + speed). Each
     carries an icon from the site's inline stroke set (same style as the
     resources type icons) so the numbers read at a glance. */
  /* Stat NUMBERS are refreshed daily from the public ON Courts (Metabase)
     dashboard by scripts/fetch-oncourts.js -> content/dristi-stats.json
     (committed by .github/workflows/oncourts-refresh.yml). If that file is
     missing or a field is absent, fall back to these known-good figures so
     the page always renders. The 98% ("held as scheduled") has no matching
     dashboard card, so it is edited here. */
  var dsFallback = { filed: 1920, timeToDisposalDays: 164, hearingsToDisposal: 7, hearingsHeldPct: 98, advocates: 851, litigants: 1758 };
  var ds = dsFallback;
  try { ds = Object.assign({}, dsFallback, JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "dristi-stats.json"), "utf8"))); } catch (e) {}
  var nf = function (n) { return Number(n).toLocaleString("en-IN"); };
  var syncedStr = "";
  try { var _dt = new Date(ds.updated); if (!isNaN(_dt.getTime())) syncedStr = _dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " IST"; } catch (e) {}

  const kstatsHtml =
'      <div class="dristi-stat is-big"><span class="dristi-stat-num">' + nf(ds.filed) + '</span><span class="dristi-stat-label">cases filed in a court that did not exist two years ago</span></div>\n' +
'      <div class="dristi-stat is-big"><span class="dristi-stat-num">' + ds.timeToDisposalDays + ' <em>days</em></span><span class="dristi-stat-label">median time to disposal. The conventional baseline: about 2 years</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">' + ds.hearingsToDisposal + '</span><span class="dristi-stat-label">Median hearings to disposal</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">' + ds.hearingsHeldPct + '%</span><span class="dristi-stat-label">Hearings held as scheduled</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">' + nf(ds.advocates) + '</span><span class="dristi-stat-label">Advocates on the platform</span></div>\n' +
'      <div class="dristi-stat"><span class="dristi-stat-num">' + nf(ds.litigants) + '</span><span class="dristi-stat-label">Litigants using it</span></div>';

  const main =
'  <p class="beat-eyebrow">DRISTI</p>\n' +
'  <h1 class="job-title">The operating system for people-centric courts.</h1>\n' +
'  <article class="job-body prose no-cap" id="what">\n' +
"    <p>DRISTI, the Dispute Resolution Intelligent System for Transformation, is the open-source platform that powers PUCAR\u2019s 24x7 Open and Networked Courts. It is not a digitisation of paper processes: it redesigns the court journey end to end, so that filing, scrutiny, summons, bail, hearings and orders all work the way you would build them today, natively digital, rule-based, and connected to the institutions around the court.</p>\n" +
"    <p>Built in the open as a Digital Public Good, DRISTI is PUCAR\u2019s contribution to Phase III of India\u2019s eCourts project, which calls for exactly this: open, interoperable infrastructure, shared data standards, and reimagined processes. A litigant should be proactively informed, a lawyer should file in minutes from anywhere, a judge should act on structured information, and none of them should run pillar to post.</p>\n" +
"  </article>\n" +
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
'      <a class="ver-link" href="#collaborate">Help build it<span aria-hidden="true"> &rarr;</span></a>\n' +
"    </article>\n" +
"  </div>\n" +
"</section>\n" +

'<section class="collaborate dristi-deploy" id="deployments">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Where it runs</p>\n' +
'    <h2 class="collab-title-main">One court live. More on the way.</h2>\n' +
'    <p class="collab-sub">ON Courts in Kollam is the first running instance of DRISTI. Work with new High Courts is underway; each state lights up here as it goes live.</p>\n' +
"  </div>\n" +
/* ALL states clickable (6 Jul 2026): Punjab & Haryana are ONE tab;
   each state has its own district row and panel. Non-live districts
   show a coming-soon body; the state maps (assets/*-map.svg, inlined)
   share one look and the district highlight + dot GLIDE between
   districts (CSS transitions, driven by js/dristi.js). */
'  <div class="res-tabbar state-tabbar" role="tablist" aria-label="States">\n' +
'    <button type="button" class="res-tab is-active" data-state-tab="kerala"><span class="board-live" aria-hidden="true"></span>Kerala</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-state-tab="ph">Punjab &amp; Haryana<span class="soon-chip">Coming soon</span></button>\n' +
'    <button type="button" class="res-tab tab-soon" data-state-tab="gujarat">Gujarat<span class="soon-chip">Coming soon</span></button>\n' +
"  </div>\n" +
'  <div class="res-tagbar district-tagbar" data-state-row="kerala" aria-label="Kerala districts">\n' +
'    <button type="button" class="res-tab is-active" data-district="kollam"><span class="board-live" aria-hidden="true"></span>Kollam</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="thrissur">Thrissur</button>\n' +
"  </div>\n" +
'  <div class="res-tagbar district-tagbar" data-state-row="ph" aria-label="Punjab and Haryana districts" hidden>\n' +
'    <button type="button" class="res-tab tab-soon is-active" data-district="panchkula">Panchkula</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="gurgaon">Gurgaon</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="chandigarh">Chandigarh</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="mohali">Mohali</button>\n' +
"  </div>\n" +
'  <div class="res-tagbar district-tagbar" data-state-row="gujarat" aria-label="Gujarat districts" hidden>\n' +
'    <button type="button" class="res-tab tab-soon is-active" data-district="ahmedabad">Ahmedabad</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="rajkot">Rajkot</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="vadodara">Vadodara</button>\n' +
'    <button type="button" class="res-tab tab-soon" data-district="surat">Surat</button>\n' +
"  </div>\n" +

'  <div class="dristi-panel" id="panelKollam" data-state-panel="kerala">\n' +
'    <div class="dristi-panel-head">\n' +
'      <div class="dristi-panel-copy" data-dcopy="kollam">\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Kollam</h3>\n' +
'        <p class="dristi-panel-sub">Live since 20 November 2024 under the High Court of Kerala. It accepts cheque dishonour cases under Section 138 of the Negotiable Instruments Act arising from all 20+ police stations in Kollam district, and it never closes: a court that goes to people, instead of people going to courts.</p>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="thrissur" hidden>\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Thrissur</h3>\n' +
'        <p class="dristi-panel-sub">The ON Court model is expanding within Kerala, and Thrissur is on the roadmap. The same platform, the same people-first redesign of the court journey; it will light up here the day it goes live.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
      /* vector Kerala with the active district outlined green + gliding
         dot (assets/kerala-map.svg, geohacker/kerala GeoJSON, equirect,
         simplified); INLINED so site CSS drives colours + transitions */
'      <div class="dristi-map" aria-hidden="true">\n' +
fs.readFileSync(path.join(ROOT, "assets", "kerala-map.svg"), "utf8") + "\n" +
"      </div>\n" +
"    </div>\n" +
'    <div class="dristi-live-body">\n' +
'    <div class="dristi-stat-grid">\n' + kstatsHtml + "\n    </div>\n" +
'    <p class="dristi-source">Figures pulled from the <a href="https://oncourts.kerala.gov.in/dashboard" target="_blank" rel="noopener">public ON Courts dashboard</a>' + (syncedStr ? ', last synced ' + syncedStr : ', July 2026') + '. 80% of disposed cases end in withdrawal: parties settle directly once the process is credible and predictable.</p>\n' +

/* quarterly filings + disposals, live from the dashboard (Plotly bars) */
'    <div class="dristi-growth">\n' +
'      <div class="dristi-journey-head"><h4>Adoption is accelerating</h4><p>Cases filed and disposed each quarter since the court opened. Filings have grown five-fold, and disposals are keeping pace.</p></div>\n' +
'      <div id="growthChart" aria-label="Quarterly cases filed and disposed chart"></div>\n' +
'      <p class="race-note">From the public dashboard, July 2026. The quarter in progress is not shown.</p>\n' +
"    </div>\n" +

'    <div class="dristi-journey">\n' +
'      <div class="dristi-journey-head"><h4>The journey, before and after</h4><p>Median stage times for cheque dishonour cases, conventional process versus the ON Court redesign.</p></div>\n' +
journeyHtml + "\n" +
"    </div>\n" +

/* ---- the race (user-supplied Kaplan-Meier data, PUCAR-themed) ---- */
'    <div class="race" id="race">\n' +
'      <div class="race-head">\n' +
'        <div>\n' +
'          <h4 class="race-title">The race: fourteen districts, one year</h4>\n' +
'          <p class="race-sub">Share of January 2025 cheque dishonour filings resolved, day by day, across Kerala’s districts. The ON Court starts near the back of the pack and finishes first.</p>\n' +
"        </div>\n" +
'        <button class="race-btn" id="raceBtn" type="button">\u25b6 Play the race</button>\n' +
"      </div>\n" +
'      <div class="race-stats">\n' +
'        <div class="race-stat is-hero"><span class="race-stat-num">#14 \u2192 #1</span><span class="race-stat-label">ON Court rank over one year</span></div>\n' +
'        <div class="race-stat"><span class="race-stat-num">39% vs 11%</span><span class="race-stat-label">resolved at one year, ON Court vs Kerala average</span></div>\n' +
'        <div class="race-stat"><span class="race-stat-num">~Day 306</span><span class="race-stat-label">the ON Court overtakes the last district ahead of it</span></div>\n' +
"      </div>\n" +
'      <div class="race-rank"><span class="race-rank-label">ON Court rank</span><span class="race-rank-num" id="raceRank">#1</span><span class="race-rank-pips" id="racePips"></span><span class="race-rank-day" id="raceDay">Day 0</span></div>\n' +
'      <div class="race-legend">\n' +
'        <span class="race-leg"><i style="background:#30CF8C;height:4px"></i>ON Court, Kollam</span>\n' +
'        <span class="race-leg"><i style="background:#F0A28A;height:2px"></i>All Kerala (average)</span>\n' +
'        <span class="race-leg"><i style="background:rgba(251,248,242,.3);height:2px"></i>Other districts</span>\n' +
"      </div>\n" +
'      <div id="raceChart" aria-label="Resolution race chart"></div>\n' +
'      <div class="race-flash" id="raceFlash" aria-hidden="true"><span class="race-flash-tag">Final overtake</span><span class="race-flash-head">ON Court reaches #1</span><span class="race-flash-sub">Around day 306</span></div>\n' +
'      <p class="race-note">Kaplan-Meier estimates, January 2025 filing cohort, tracked through day 417. "Rest of Kollam" is the district excluding the ON Court. Malappuram is not shown.</p>\n' +
"    </div>\n" +

'    <div class="dristi-survey">\n' +
'      <p class="beat-eyebrow">What people tell us</p>\n' +
'      <div class="survey-grid">\n' +
'        <div class="survey-group"><p class="survey-grp-label">Advocates</p>' +
    '<div class="survey-item"><span class="survey-num">94%</span><span class="survey-txt">are satisfied with the overall experience</span></div>' +
    '<div class="survey-item"><span class="survey-num">76%</span><span class="survey-txt">say it has improved the court process</span></div></div>\n' +
'        <div class="survey-group"><p class="survey-grp-label">Litigants</p>' +
    '<div class="survey-item"><span class="survey-num">66%</span><span class="survey-txt">say SMS updates help them follow their case</span></div>' +
    '<div class="survey-item"><span class="survey-num">53%</span><span class="survey-txt">say their case is progressing faster</span></div></div>\n' +
'      </div>\n' +
'      <p class="survey-src">PUCAR user survey, 2025. Collected by survey, not from the live dashboard.</p>\n' +
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
"    </div>\n" + /* /.dristi-live-body */
'    <div class="dristi-soon-body" hidden>\n' +
"    </div>\n" +
"  </div>\n" +

/* Punjab & Haryana panel: coming soon (four districts) */
'  <div class="dristi-panel" data-state-panel="ph" hidden>\n' +
'    <div class="dristi-panel-head">\n' +
'      <div class="dristi-panel-copy" data-dcopy="panchkula">\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Panchkula</h3>\n' +
'        <p class="dristi-panel-sub">Work with the High Court of Punjab and Haryana is underway. The Panchkula ON Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="gurgaon" hidden>\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Gurgaon</h3>\n' +
'        <p class="dristi-panel-sub">Work with the High Court of Punjab and Haryana is underway. The Gurgaon ON Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="chandigarh" hidden>\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Chandigarh</h3>\n' +
'        <p class="dristi-panel-sub">Work with the High Court of Punjab and Haryana is underway. The Chandigarh ON Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="mohali" hidden>\n' +
'        <h3 class="dristi-panel-title">24x7 ON Court, Mohali</h3>\n' +
'        <p class="dristi-panel-sub">Work with the High Court of Punjab and Haryana is underway. The Mohali ON Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-map" aria-hidden="true">\n' +
fs.readFileSync(path.join(ROOT, "assets", "ph-map.svg"), "utf8") + "\n" +
"      </div>\n" +
"    </div>\n" +
'    <div class="dristi-soon-body">\n' +
"    </div>\n" +
"  </div>\n" +

/* Gujarat panel: coming soon (four districts) */
'  <div class="dristi-panel" data-state-panel="gujarat" hidden>\n' +
'    <div class="dristi-panel-head">\n' +
'      <div class="dristi-panel-copy" data-dcopy="ahmedabad">\n' +
'        <h3 class="dristi-panel-title">SARAS 2.0 Court, Ahmedabad</h3>\n' +
'        <p class="dristi-panel-sub">Work with the Gujarat High Court is underway. The Ahmedabad SARAS 2.0 Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="rajkot" hidden>\n' +
'        <h3 class="dristi-panel-title">SARAS 2.0 Court, Rajkot</h3>\n' +
'        <p class="dristi-panel-sub">Work with the Gujarat High Court is underway. The Rajkot SARAS 2.0 Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="vadodara" hidden>\n' +
'        <h3 class="dristi-panel-title">SARAS 2.0 Court, Vadodara</h3>\n' +
'        <p class="dristi-panel-sub">Work with the Gujarat High Court is underway. The Vadodara SARAS 2.0 Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-panel-copy" data-dcopy="surat" hidden>\n' +
'        <h3 class="dristi-panel-title">SARAS 2.0 Court, Surat</h3>\n' +
'        <p class="dristi-panel-sub">Work with the Gujarat High Court is underway. The Surat SARAS 2.0 Court is being prepared on the same platform and the same people-first redesign proven in Kollam; it will light up here the day it opens.</p>\n' +
'        <span class="soon-flag">Coming soon</span>\n' +
"      </div>\n" +
'      <div class="dristi-map" aria-hidden="true">\n' +
fs.readFileSync(path.join(ROOT, "assets", "gj-map.svg"), "utf8") + "\n" +
"      </div>\n" +
"    </div>\n" +
'    <div class="dristi-soon-body">\n' +
"    </div>\n" +
"  </div>\n" +
"</section>\n" +

/* ARCHIVED (Jul 2026): the "10 Unlocks" (tenUnlocksHtml) and "Who benefits"
   (userBenefitsHtml) sections were removed from /dristi/ at the user's request
   and may return on a different page later. The generator functions above and
   js/unlocks.js + js/benefits.js + their CSS are kept intact — to bring a
   section back, re-add its call here. See README §8. */

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

function approachPage() {
  /* /approach/ (July 2026, user brief): WHY the people-centric lens.
     Litigants are the PRIMARY USERS of the court; the court exists to
     serve them. That flips the metrics: away from system-centric
     pendency, toward litigant-centric seamlessness, efficiency and
     predictability (the three pillars, each with a live proof point).
     Then: why the unit of change is a CASE TYPE, and why Sec 138
     cheque dishonour came first. Sources: AGAMI_CONTEXT.md (vision
     line, theory of change, selection criteria, baseline vs ON Court
     tables) + the public ON Courts dashboard (July 2026 reads).
     NOT in the nav yet: user reviews the page first. */

  const PILLARS = [
    { n: "01", t: "Seamlessness", b: "A litigant should experience one continuous journey, not a relay of disconnected offices. The court is digitally connected to police, post and treasury, so summons, fees and processes move between institutions without the litigant carrying paper from counter to counter. Filing happens from anywhere, registration follows the same day, and mediation is available at any stage without leaving the process.",
      num: "Same day", cap: "filing to registration at the ON Court. The conventional process takes 10 days" },
    { t: "Efficiency", n: "02", b: "Efficiency here is measured in the litigant’s time, not the court’s throughput. Asynchronous proceedings mean key case actions happen without everyone travelling to stand in the same room: no roll calls, no appearances that exist only to fix the next date. Every hearing that does happen moves the case forward.",
      num: "164 days", cap: "median filing to disposal, in 7 hearings. The conventional baseline is about 2 years" },
    { t: "Predictability", n: "03", b: "The quiet cruelty of the conventional process is not knowing: whether the hearing will happen, what comes next, how long anything takes. The ON Court reaches out first, with SMS alerts that tell litigants where their case stands and what to do next, and a schedule that holds.",
      num: "98%", cap: "hearings held as scheduled, against a conventional baseline of 40%" }
  ];
  const pillarsHtml = PILLARS.map(function (p) {
    return '    <article class="pillar-card">\n' +
      '      <span class="pillar-num" aria-hidden="true">' + p.n + "</span>\n" +
      '      <h3 class="pillar-title">' + esc(p.t) + "</h3>\n" +
      '      <p class="pillar-body">' + esc(p.b) + "</p>\n" +
      '      <div class="pillar-proof"><span class="pillar-proof-num">' + esc(p.num) + '</span><span class="pillar-proof-cap">' + esc(p.cap) + "</span></div>\n" +
      "    </article>";
  }).join("\n");

  /* the metric shift: system questions struck through, litigant
     questions in green (reuses the dristi journey row styling) */
  const SHIFT = [
    ["What the metric asks", "How many cases does the system hold?", "How long does one person wait?"],
    ["What a hearing means", "A line in the cause list", "A day of wages, travel and waiting"],
    ["What success looks like", "Clearance rates and disposal counts", "A journey that is seamless, efficient and predictable"]
  ];
  const shiftHtml = SHIFT.map(function (r) {
    return '    <div class="dristi-journey-row">' +
      '<span class="dj-stage">' + esc(r[0]) + "</span>" +
      '<span class="dj-old">' + esc(r[1]) + "</span>" +
      '<span class="dj-arrow" aria-hidden="true">&rarr;</span>' +
      '<span class="dj-new">' + esc(r[2]) + "</span></div>";
  }).join("\n");

  const STAGES4 = [
    { t: "Select", b: "Choose a dispute type with high pendency, low legal complexity, a diverse litigant base, and room for focused change management." },
    { t: "Transform", b: "Re-engineer the entire experience of that dispute type: process, technology, rules and behaviour, end to end." },
    { t: "Enable", b: "Scale the transformation across courts in the state, and build the enablers: policy, infrastructure, capacity." },
    { t: "Extend", b: "Carry the learnings and the reusable capabilities to the next dispute type, and begin again." }
  ];
  const stages4Html = STAGES4.map(function (s, i) {
    return '    <div class="about-step">\n' +
      '      <span class="about-step-num">0' + (i + 1) + '</span>\n' +
      "      <h3>" + esc(s.t) + "</h3>\n" +
      "      <p>" + esc(s.b) + "</p>\n" +
      "    </div>";
  }).join("\n");

  const main =
'  <p class="beat-eyebrow">Our approach</p>\n' +
'  <h1 class="job-title">The court exists to serve the litigant.</h1>\n' +
'  <article class="job-body prose no-cap" id="lens">\n' +
"    <p>Every system gets designed around whoever it treats as its primary user. For decades, India’s courts have been designed, measured and reformed around the institution itself: its cause lists, its disposal counts, its pendency figures. The litigant, the person the whole apparatus supposedly exists for, appears in that picture only as a unit of backlog.</p>\n" +
"    <p>PUCAR starts from the opposite premise. The litigant is the primary user of the court, and the court is a service that exists to resolve their dispute. That is not a slogan: it is a design constraint. It means every process, every hearing, every notice is judged by one question: what did this cost the person waiting for justice, and what did it move forward for them?</p>\n" +
"    <p>Taking that lens seriously changes what you measure. Pendency is a system-centric metric: it tells you how burdened the institution is, not how any person inside it is faring. A court can improve its numbers while every litigant in it still runs pillar to post. So we measure the litigant’s experience instead, along three pillars: is the journey <strong>seamless</strong>, is it <strong>efficient</strong>, and is it <strong>predictable</strong>?</p>\n" +
"  </article>\n" +
"</main>\n" +

'<section class="collaborate approach-pillars" id="pillars">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">The metrics that matter</p>\n' +
'    <h2 class="collab-title-main">From pendency to people.</h2>\n' +
'    <p class="collab-sub">System-centric metrics ask how the institution is doing. Litigant-centric metrics ask how the person is doing. The difference decides what gets fixed.</p>\n' +
"  </div>\n" +
'  <div class="dristi-journey approach-shift">\n' +
shiftHtml + "\n" +
"  </div>\n" +
'  <div class="pillar-grid">\n' + pillarsHtml + "\n  </div>\n" +
'  <p class="race-note approach-note">Proof points from the ON Court in Kollam: the public dashboard (July 2026) and PUCAR baseline studies of the conventional Sec 138 process.</p>\n' +
"</section>\n" +

'<div class="job-main about-lower" id="unit">\n' +
'  <article class="job-body prose no-cap">\n' +
"    <h2>Our unit of change is a case type</h2>\n" +
"    <p>Most reform picks a court, a state or a policy as its unit and improves it a few percent at a time. PUCAR’s unit of change is a dispute type. We take one kind of case and redesign its entire journey, from the moment a dispute arises to the day it is resolved, across process, technology, rules and behaviour at once. A whole journey transformed for one case type beats a marginal gain spread thinly across all of them: it produces a working court people can see, use and demand elsewhere.</p>\n" +
"  </article>\n" +
'  <div class="about-steps approach-stages">\n' + stages4Html + "\n  </div>\n" +
'  <article class="job-body prose no-cap" id="sec138">\n' +
"    <h2>Why we started with cheque dishonour</h2>\n" +
"    <p>The first case type had to be chosen carefully: common enough to matter, simple enough to transform, and contained enough to manage. Cheque dishonour cases under Section 138 of the Negotiable Instruments Act fit on every count. They make up roughly 10% of India’s criminal pendency, so the volume is enormous. Their legal structure is simple, with clear constituent elements and a well-defined process, which makes them ideal for rule-based redesign. Their litigants are everyone: individuals, small businesses, large corporates. And they can be routed to a dedicated special court, so the whole transformation can be managed, measured and proven in one place.</p>\n" +
"    <p>That proof now exists. The 24x7 ON Court in Kollam has taken the conventional 600-day Sec 138 journey down to a median of 164 days, and the learnings and reusable capabilities are ready to extend to the next case type.</p>\n" +
"  </article>\n" +
'  <div class="cta-row">\n' +
'    <a class="btn btn-primary" href="/dristi/">Explore DRISTI, the platform</a>\n' +
'    <a class="btn btn-ghost" href="/dristi/#collaborate">Help build what comes next</a>\n' +
"  </div>\n" +
"</div>\n<main hidden>";

  return pageShell({
    title: "Our Approach | PUCAR",
    desc: "Why PUCAR takes a people-centric lens: litigants are the primary users of courts. We measure seamlessness, efficiency and predictability instead of pendency, and transform one case type at a time.",
    url: "/approach/",
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Our Approach",
      description: "PUCAR's people-centric lens: litigant-centric metrics and case-type-level transformation" },
    backHref: "/", backLabel: "← Home", main: main,
    subnav: [
      { label: "The lens", href: "#lens" },
      { label: "Three pillars", href: "#pillars" },
      { label: "Unit of change", href: "#unit" }
    ]
  });
}

/* ---------------- careers: open roles (July 2026) ----------------
   DISTINCT from the collaborate board by explicit user decision: the
   board holds open WORK the community can take up; /careers/ holds
   ROLES PUCAR is hiring for (Permanent / Part-time / Volunteer).
   Data: content/careers/*.json. All six launch listings are DRAFTS
   ([draft description...] markers in the bodies) pending user review.
   NOT in the nav yet: user reviews first. */

const careerRoles = fs.readdirSync(path.join(ROOT, "content/careers"))
  .filter(function (f) { return f.endsWith(".json"); })
  .map(function (f) {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, "content/careers", f), "utf8"));
    r.slug = f.replace(/\.json$/, "");
    r.url = "/careers/" + r.slug + "/";
    return r;
  })
  .filter(function (r) { return r.published !== false; });

/* every careers role applies to supriya@pucar.org, CC varun@pucar.org, with a
   per-role subject (centralised so it's consistent across ALL roles). */
function applyMailto(role) {
  return "mailto:supriya@pucar.org?cc=varun@pucar.org&subject=" +
    encodeURIComponent("Role - " + (role.title || ""));
}
function openingsLabel(r) {
  if (r.openings) return r.openings;   // explicit override, e.g. "3–4 roles available"
  var n = parseInt(r.positions, 10);
  if (!n || n < 1) n = 1;
  return n + (n === 1 ? " position open" : " positions open");
}
/* compact "how hiring works" block embedded INSIDE each role's JD (modal +
   role page) instead of a standalone section on /careers/ */
function hiringInlineHtml() {
  var STEPS = [
    { t: "Coding challenge", d: "A short, real-shaped task you complete in your own time." },
    { t: "Pair coding", d: "Build something live with one of our engineers — your tools and AI welcome." },
    { t: "Interview with the Tech Lead", d: "A deeper look at systems, trade-offs and how you work." },
    { t: "Interview with the PUCAR team", d: "Mission, collaboration, and working with courts and stakeholders." }
  ];
  var steps = STEPS.map(function (s, i) {
    return '<li><span class="jhs-node">' + (i + 1) + '</span>' +
      '<div><strong>' + s.t + '</strong><span>' + s.d + '</span></div></li>';
  }).join("");
  return '<div class="jd-hiring">' +
    '<p class="jd-hiring-eyebrow">How hiring works</p>' +
    '<h3 class="jd-hiring-title">A clear, four-step process.</h3>' +
    '<ol class="jd-hiring-steps">' + steps + '</ol>' +
    '<p class="jd-hiring-note"><span class="jd-hiring-badge">≈ 2 weeks</span>from the first round to a final decision, for candidates who move through every round.</p>' +
  '</div>';
}

function careerPage(role) {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: role.title, description: role.summary, datePosted: role.posted,
    employmentType: role.type === "Permanent" ? "FULL_TIME" : role.type === "Part-time" ? "PART_TIME" : "VOLUNTEER",
    hiringOrganization: { "@type": "Organization", name: "PUCAR", sameAs: "https://pucar.org" },
    jobLocationType: /remote/i.test(role.location || "") ? "TELECOMMUTE" : undefined,
    directApply: true
  };
  const main =
    '  <p class="beat-eyebrow">' + esc(role.type) + " role</p>\n" +
    '  <h1 class="job-title">' + esc(role.title) + "</h1>\n" +
    '  <p class="job-openings"><span class="career-openings">' + esc(openingsLabel(role)) + "</span></p>\n" +
    '  <p class="job-summary">' + esc(role.summary) + "</p>\n" +
    '  <ul class="job-chips">' +
    [role.commitment, role.location, role.experience].concat(role.tags || []).filter(Boolean)
      .map(function (c) { return '<li title="' + esc(c) + '">' + esc(c) + "</li>"; }).join("") +
    "</ul>\n" +
    '  <article class="job-body">\n' + mdToHtml(role.body || "") + "\n  </article>\n" +
    hiringInlineHtml() + "\n" +
    '  <div class="cta-row">\n' +
    (role.status === "Open"
      ? '    <a class="btn btn-primary" href="' + esc(applyMailto(role)) + '">Apply for this role</a>\n'
      : '    <span class="btn btn-outline is-disabled">' + esc(role.status) + "</span>\n") +
    (role.pdf ? '    <a class="btn btn-ghost" href="' + esc(role.pdf) + '" download>Download JD (PDF)</a>\n' : '') +
    '    <a class="btn btn-outline" href="/careers/">All open roles</a>\n  </div>';
  return pageShell({
    title: role.title + " | Careers at PUCAR",
    desc: role.summary, url: role.url, jsonLd: jsonLd,
    backHref: "/careers/", backLabel: "← Open roles", main: main
  });
}

/* ---------------- careers: hiring process (visual 4-step timeline) ---- */
function hiringProcessHtml() {
  var STEPS = [
    { t: "Coding challenge", d: "A short, real-shaped task you complete in your own time." },
    { t: "Pair coding", d: "Build something live with one of our engineers — your tools and AI welcome." },
    { t: "Interview with the Tech Lead", d: "A deeper look at systems, trade-offs and how you work." },
    { t: "Interview with the PUCAR team", d: "Mission, collaboration, and working with courts and stakeholders." }
  ];
  var steps = STEPS.map(function (s, i) {
    return '    <li class="hiring-step">' +
      '<span class="hs-node">' + (i + 1) + '</span>' +
      '<div class="hs-body"><h3 class="hs-title">' + s.t + '</h3><p class="hs-desc">' + s.d + '</p></div>' +
    '</li>';
  }).join("\n");
  return '<section class="hiring" id="hiring">\n' +
    '  <div class="hiring-head">\n' +
    '    <p class="beat-eyebrow">How hiring works</p>\n' +
    '    <h2 class="hiring-title">A clear, four-step process.</h2>\n' +
    '    <p class="hiring-sub">We reach out to shortlisted candidates and let you know before it begins. You move through the steps one at a time, and from the first round to a final decision it usually takes about two weeks.</p>\n' +
    "  </div>\n" +
    '  <ol class="hiring-steps">\n' + steps + "\n  </ol>\n" +
    '  <p class="hiring-note"><span class="hiring-badge">≈ 2 weeks</span>from first round to final decision, for candidates who move through every round.</p>\n' +
    "</section>\n";
}

function careersPage() {
  const GROUPS = [
    ["Permanent", "Permanent roles", "Full-time seats at the heart of the mission."]
  ];
  const open = careerRoles.filter(function (r) { return r.status === "Open"; })
    .sort(function (a, b) { return (a.order || 99) - (b.order || 99) || String(a.title).localeCompare(b.title); });
  const groupsHtml = GROUPS.map(function (g) {
    const rows = open.filter(function (r) { return r.type === g[0]; });
    if (!rows.length) return "";
    return '  <div class="career-group">\n' +
      '    <div class="career-group-head"><h3>' + esc(g[1]) + '</h3><p>' + esc(g[2]) + "</p></div>\n" +
      '    <div class="career-cards">\n' +
      rows.map(function (r) {
        var facts = [
          r.experience ? '<span class="cc-chip cc-chip-key">' + esc(r.experience) + '</span>' : '',
          r.commitment ? '<span class="cc-chip">' + esc(r.commitment) + '</span>' : '',
          r.location ? '<span class="cc-chip">' + esc(r.location) + '</span>' : ''
        ].filter(Boolean).join('');
        var tags = (r.tags || []).map(function (t) { return '<span class="cc-tag">' + esc(t) + '</span>'; }).join('');
        return '      <a class="career-card" href="' + r.url + '" data-jd="' + esc(r.slug) + '">\n' +
          '        <span class="cc-head"><span class="cc-title">' + esc(r.title) + '</span>' +
          '<span class="career-openings">' + esc(openingsLabel(r)) + '</span></span>\n' +
          '        <span class="cc-sum">' + esc(r.summary) + '</span>\n' +
          (facts ? '        <span class="cc-facts">' + facts + '</span>\n' : '') +
          (tags ? '        <span class="cc-tags">' + tags + '</span>\n' : '') +
          '        <span class="cc-cta">Read the full brief <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h8M8 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>\n' +
          '      </a>';
      }).join("\n") +
      "\n    </div>\n  </div>";
  }).filter(Boolean).join("\n");

  const permanent = open.filter(function (r) { return r.type === "Permanent"; });
  function jdSource(r) {
    return '<div class="jd-src" id="jd-' + esc(r.slug) + '" hidden>' +
      '<p class="beat-eyebrow jdm-eyebrow">' + esc(r.type) + ' role</p>' +
      '<h2 class="jdm-title">' + esc(r.title) + '</h2>' +
      '<p class="jdm-openings"><span class="career-openings">' + openingsLabel(r) + '</span></p>' +
      '<ul class="job-chips">' +
        [r.commitment, r.location, r.experience].concat(r.tags || []).filter(Boolean).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join("") +
      '</ul>' +
      '<div class="job-body">' + mdToHtml(r.body || "") + '</div>' +
      hiringInlineHtml() +
      '<div class="cta-row jdm-cta">' +
        (r.status === "Open"
          ? '<a class="btn btn-primary" href="' + esc(applyMailto(r)) + '">Apply for this role</a>'
          : '<span class="btn btn-outline is-disabled">' + esc(r.status) + '</span>') +
        (r.pdf ? '<a class="btn btn-ghost" href="' + esc(r.pdf) + '" download>Download JD (PDF)</a>' : '') +
      '</div>' +
    '</div>';
  }
  const jdSources = permanent.map(jdSource).join("\n");
  const jdModal =
    '<div class="jdm-overlay" id="jdModal" hidden>' +
      '<div class="jdm-dialog" role="dialog" aria-modal="true" aria-label="Role details">' +
        '<button type="button" class="jdm-close" aria-label="Close role details">&times;</button>' +
        '<div class="jdm-body"></div>' +
      '</div>' +
    '</div>';

  const main =
"</main>\n" +

'<section class="collaborate careers-board careers-board-lead" id="roles">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Open roles</p>\n' +
'    <h2 class="collab-title-main">The bench is forming. Take your seat.</h2>\n' +
'    <p class="collab-sub">Permanent roles across engineering, product, design, law and research. Every one of them exists to make courts work for the people who need them. Tap any role to read the full brief.</p>\n' +
"  </div>\n" +
(groupsHtml ||
'  <p class="collab-empty">No open roles right now. Check back soon, or write to us anyway: the right person has a way of creating their own role.</p>\n') + "\n" +
jdSources + "\n" + jdModal + "\n" +
"</section>\n" +
'<script src="/js/careers-modal.js" defer></script>\n' +
"<main hidden>";

  return pageShell({
    title: "Careers | PUCAR",
    mainClass: "dristi-main careers-lean",
    desc: "Help build the future of courts. Permanent roles at PUCAR, the collective behind India's 24x7 people-centric ON Courts.",
    url: "/careers/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Careers at PUCAR",
      description: "Open permanent roles at PUCAR" },
    backHref: "/", backLabel: "← Home", main: main
  });
}

/* ---------------- homepage cards ---------------- */

function card(job) {
  return '<article class="collab-card"' +
    ' data-slug="' + esc(job.slug) + '"' +
    ' data-stream="' + esc(job.stream || "Volunteer") + '"' +
    ' data-category="' + esc(catLabel(job.category)) + '"' +
    ' data-difficulty="' + esc(diffLabel(job.difficulty)) + '"' +
    ' data-deadline="' + esc(String(job.deadline || "").slice(0, 10)) + '"' +
    ' data-expiry="' + esc(job.expiry) + '"' +
    ' data-tags="' + esc(job.tags.join("|")) + '">\n' +
    '  <a class="collab-cover" href="' + job.url + '" aria-label="' + esc(job.title) + '"></a>\n' +
    '  <div class="collab-topline"><span class="collab-cat">' + catIcon(job.category) + esc(catLabel(job.category)) + "</span>" +
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + '<svg class="diff-bars" viewBox="0 0 14 12" width="13" height="11" aria-hidden="true"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5.5" y="3.5" width="3" height="8.5" rx="1"/><rect x="11" y="0" width="3" height="12" rx="1"/></svg>' + esc(diffLabel(job.difficulty)) + "</span></div>\n" +
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
   (published 3 June 2026 by the SC's AI Committee; the public feedback
   window closed 15 July 2026, so the page is now retrospective -- our
   comments and the public record, no send-feedback CTA). Perspectives come
   from content/sc-perspectives/*.json (sourced from the tracking sheet).
   Cards reuse the collaborate-card
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
'  <p class="beat-eyebrow">PUCAR // AI in courts</p>\n' +
'  <h1 class="job-title">Our comments on the SC&rsquo;s AI policy.</h1>\n' +
'  <article class="job-body prose">\n' +
"    <p>On 3 June 2026, the Supreme Court's Artificial Intelligence Committee published the draft Regulations for Use of Artificial Intelligence (AI) in Courts, 2026, a first-of-its-kind framework covering the Supreme Court, all High Courts, subordinate courts, tribunals, and statutory bodies performing adjudicatory roles.</p>\n" +
"    <p>The draft rests on a simple hierarchy: AI may assist, but never adjudicate. It permits AI for research, summarisation, translation, transcription, scheduling, litigant-assistance chatbots, and court analytics, and absolutely prohibits AI-only decisions, AI-based risk scoring for bail or credibility, predictive profiling, surveillance of judges or lawyers, and undisclosed AI-generated evidence. Lawyers must disclose AI use in filings, and a permanent Apex Body at the Supreme Court would approve and supervise tools across the system.</p>\n" +
'    <p>The Court&rsquo;s public feedback window has now closed. PUCAR and the wider collective read the draft closely and put our views on the record. What we and others made of it is collected below.</p>\n' +
"  </article>\n" +
'  <div class="cta-row">\n' +
'    <a class="btn btn-outline" href="https://cdnbbsr.s3waas.gov.in/s3ec0490f1f4972d133619a60c30f3559e/uploads/2026/06/2026060342.pdf" target="_blank" rel="noopener">Read the Court&rsquo;s notice</a>\n' +
"  </div>\n" +
'  <aside class="civis-callout">\n' +
'    <div class="civis-callout-text">\n' +
'      <p class="civis-kicker">The consultation has closed</p>\n' +
'      <h2 class="civis-title">See how the draft was put to citizens on CIVIS.</h2>\n' +
'      <p class="civis-sub">CIVIS turned the draft into a short guided questionnaire, in English and four Indian languages, and carried people&rsquo;s views to the Court&rsquo;s AI Committee. The response window is now closed, but the consultation is still worth reading.</p>\n' +
"    </div>\n" +
'    <div class="civis-callout-action">\n' +
'      <a class="civis-btn" href="https://www.civis.vote/consultations/1575/read" target="_blank" rel="noopener">View the CIVIS consultation<span class="civis-btn-arrow" aria-hidden="true">&rarr;</span></a>\n' +
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
    title: "Our comments on the SC’s AI policy | PUCAR",
    desc: "PUCAR’s comments on the Supreme Court of India’s draft Regulations for Use of AI in Courts, 2026. The public feedback window has closed; read what we and others made of it.",
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
fs.mkdirSync(path.join(ROOT, "approach"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "approach", "index.html"), approachPage());
fs.mkdirSync(path.join(ROOT, "careers"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "careers", "index.html"), careersPage());
careerRoles.forEach(function (r) {
  const dir = path.join(ROOT, "careers", r.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), careerPage(r));
});

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

/* mirror the /resources/ blog section on the homepage (below the map),
   from the same blog.json so the two stay in sync */
const BSTART = "<!-- BLOG:START -->", BEND = "<!-- BLOG:END -->";
const bs = html.indexOf(BSTART), be = html.indexOf(BEND);
if (bs === -1 || be === -1) {
  console.error("BLOG markers not found in index.html — blog mirror not injected.");
} else {
  html = html.slice(0, bs + BSTART.length) + "\n" + blogSection() + html.slice(be);
}

fs.writeFileSync(indexPath, bust(html));

/* sitemap */
const urls = [SITE + "/", SITE + "/litigant-journey/", SITE + "/sc-ai-policy/", SITE + "/contributors/", SITE + "/about/", SITE + "/dristi/", SITE + "/approach/", SITE + "/cheque-journey/", SITE + "/careers/", SITE + "/resources/"]
  .concat(jobs.map(function (j) { return SITE + j.url; }))
  .concat(careerRoles.map(function (r) { return SITE + r.url; }))
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
