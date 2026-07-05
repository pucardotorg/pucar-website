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
'<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />\n' +
'<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png" />\n' +
'<link rel="apple-touch-icon" href="/assets/favicon-apple-touch.png" />\n' +
(opts.jsonLd ? '<script type="application/ld+json">' + JSON.stringify(opts.jsonLd) + "</script>\n" : "") +
'</head>\n<body class="job-page">\n' +
'<script src="/js/nav.js" defer></script>\n' +
'<header class="site-header">\n  <a class="logo" href="/">\n' +
'    <img class="logo-light logo-light-long" src="/assets/pucar-normal-expanded.png" alt="PUCAR: Public Collective for Avoidance and Resolution of Disputes" width="777" height="93" />\n' +
'    <img class="logo-light logo-light-short" src="/assets/logo-pucar-green.avif" alt="PUCAR" width="401" height="100" />\n' +
'    <img class="logo-dark logo-dark-long" src="/assets/pucar-white-expanded.avif" alt="PUCAR: Public Collective for Avoidance and Resolution of Disputes" width="835" height="100" />\n' +
'    <img class="logo-dark logo-dark-short" src="/assets/pucar-white-short.png" alt="PUCAR" width="379" height="87" />\n' +
'  </a>\n' +
/* "Back" uses real browser history (falls back to opts.backHref for no-JS
   visitors and crawlers); the second pill always offers the contributors list */
'  <nav class="site-nav">' +
'<a class="nav-home" href="/" aria-label="Home" data-tip="Home"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5 8 2.5l5.5 5v6h-4v-3.5h-3V13.5h-4z"/></svg></a>' +
'<a class="nav-back" href="' + opts.backHref + '" onclick="if(history.length>1){history.back();return false;}">← Back</a>' +
'<a href="/contributors/">View all Collaborators</a>' +
"</nav>\n</header>\n" +
'<main class="job-main">\n' + opts.main + "\n</main>\n" +
FOOTER + "\n</body>\n</html>\n";
}

/* ---------------- job pieces ---------------- */

function jobMetaHtml(job) {
  return '<div class="job-meta">' +
    '<span class="collab-cat">' + esc(job.category || "Work") + "</span>" +
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + esc(job.difficulty || "Moderate") + "</span>" +
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

function contributorsIndexPage() {
  const people = contributors.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  const orgs = Array.from(new Set(people.map(function (p) { return p.organisation; })
    .filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
  const main =
'  <p class="beat-eyebrow">The PUCAR collective</p>\n' +
'  <h1 class="job-title">The people behind the work.</h1>\n' +
'  <article class="job-body">\n' +
"    <p>PUCAR is a collective of 100+ contributors from economics, legal practice, public technology, artificial intelligence, and government. These are some of the people lending their time and expertise. Click anyone to read more about them and the work they have taken up.</p>\n" +
"  </article>\n" +
"</main>\n" +
'<section class="collaborate contrib-section" id="contributors">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Contributors</p>\n' +
'    <h2 class="collab-title-main">Find a collaborator.</h2>\n' +
'    <p class="collab-sub">Search by name or role, or filter by organisation.</p>\n' +
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
'    <button class="job-modal-close" type="button" data-close aria-label="Close">\u00d7</button>\n' +
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
'<script src="/js/contributors-page.js"></script>\n<script src="/js/view-toggle.js"></script>\n<main hidden>';
  return pageShell({
    title: "Contributors | PUCAR",
    desc: "The people behind PUCAR: " + contributors.length + " contributors from law, technology, economics, and government working to transform dispute resolution in India.",
    url: "/contributors/",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "PUCAR contributors",
      about: "Contributors to the PUCAR collective" },
    backHref: "/", backLabel: "← Home", main: main
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
  const withPhotos = contributors.filter(function (c) { return c.photo; });
  const stripCount = Math.min(6, withPhotos.length);
  const stripStep = Math.max(1, Math.floor(withPhotos.length / (stripCount || 1)));
  const stripPicks = [];
  for (let i = 0; i < withPhotos.length && stripPicks.length < stripCount; i += stripStep) stripPicks.push(withPhotos[i]);
  const stripHeads = stripPicks.map(function (c, i) {
    /* same waving 👋 as the homepage strip, staggered so the greeting
       ripples down the line on hover */
    return '<span class="strip-head"><img src="' + esc(c.photo) + '" alt="' + esc(c.name) + '" loading="lazy" />' +
      '<span class="strip-wave" style="animation-delay:' + (i * 0.12).toFixed(2) + 's">\ud83d\udc4b</span></span>';
  }).join("");
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
'  <div class="about-parallax-img" id="aboutParallax" style="background-image:url(/assets/pucar-drawing.jpg)"></div>\n' +
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
(stripHeads
  ? '  <a class="collab-strip about-strip" href="/contributors/">\n' +
    '    <span class="strip-text">Meet the <strong>100+ collaborators</strong> behind PUCAR</span>\n' +
    '    <span class="strip-group">\n' +
    '      <span class="strip-stack" aria-hidden="true">' + stripHeads + "</span>\n" +
    '      <span class="strip-btn">See everyone<span class="strip-arrow" aria-hidden="true">&rarr;</span></span>\n' +
    "    </span>\n" +
    "  </a>\n"
  : "") +
'  <div class="cta-row">\n' +
'    <a class="btn btn-primary" href="/#collaborate">See open work</a>\n' +
'    <a class="btn btn-outline" href="/contributors/">Meet the contributors</a>\n' +
"  </div>\n" +
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

function teamPage() {
  /* PLACEHOLDER members -- replace with the real team before launch. */
  const placeholders = [
    { name: "Team Member", role: "Convenor" },
    { name: "Team Member", role: "Programs" },
    { name: "Team Member", role: "Technology" },
    { name: "Team Member", role: "Design" },
    { name: "Team Member", role: "Partnerships" },
    { name: "Team Member", role: "Operations" }
  ];
  const cards = placeholders.map(function (p, i) {
    return '<div class="contrib-card team-placeholder">' +
      '<span class="avatar avatar-lg" style="background:hsl(' + (i * 55 % 360) + ',20%,45%)" aria-hidden="true">?</span>' +
      '<span class="contrib-card-text">' +
      '<span class="contrib-card-name">' + esc(p.name) + "</span>" +
      '<span class="contrib-card-role">' + esc(p.role) + " · placeholder</span>" +
      "</span></div>";
  }).join("\n");
  const main =
'  <p class="beat-eyebrow">The team</p>\n' +
'  <h1 class="job-title">The people who hold it together.</h1>\n' +
'  <article class="job-body">\n' +
"    <p>PUCAR is powered by a small anchor team and a wide collective of contributors. The team below is a placeholder while we gather everyone's details and photos.</p>\n" +
"  </article>\n" +
"</main>\n" +
'<section class="collaborate contrib-section" id="team">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Core team</p>\n' +
'    <h2 class="collab-title-main">Coming soon.</h2>\n' +
'    <p class="collab-sub">Real names, faces, and bios are on their way. Meanwhile, the wider collective is already listed.</p>\n' +
"  </div>\n" +
'  <div class="contrib-grid">\n' + cards + "\n  </div>\n" +
'  <div class="cta-row" style="justify-content:center; margin-top:28px;">\n' +
'    <a class="btn btn-primary" href="/contributors/">Meet the contributors</a>\n' +
"  </div>\n" +
"</section>\n" +
"<main hidden>";
  return pageShell({
    title: "Meet the Team | PUCAR",
    desc: "The core team behind PUCAR, the public collective for avoidance and resolution of disputes.",
    url: "/team/",
    jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: "PUCAR team" },
    backHref: "/", backLabel: "← Home", main: main
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
    '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + esc(job.difficulty || "Moderate") + "</span></div>\n" +
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

["collaborate", "contributors", "sc-ai-policy", "about", "team"].forEach(function (d) {
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
fs.writeFileSync(path.join(ROOT, "contributors", "index.html"), contributorsIndexPage());
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
const urls = [SITE + "/", SITE + "/sc-ai-policy/", SITE + "/contributors/", SITE + "/about/", SITE + "/team/"]
  .concat(jobs.map(function (j) { return SITE + j.url; }))
  .concat(contributors.map(function (c) { return SITE + c.url; }));
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(function (u) { return "  <url><loc>" + u + "</loc></url>"; }).join("\n") + "\n</urlset>\n");

console.log("Built " + jobs.length + " job page(s) (" + boardJobs.length + " on the board), " +
  contributors.length + " contributor page(s), sc-ai-policy (" + perspectives.length +
  " perspectives, " + scEvents.length + " events), jobs.json, cards, sitemap.xml");
