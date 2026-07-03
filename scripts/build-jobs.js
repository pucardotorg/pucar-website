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
'<header class="site-header">\n  <a class="logo" href="/">\n' +
'    <img class="logo-light logo-light-long" src="/assets/pucar-normal-expanded.png" alt="PUCAR — Public Collective for Avoidance and Resolution of Disputes" width="777" height="93" />\n' +
'    <img class="logo-light logo-light-short" src="/assets/logo-pucar-green.avif" alt="PUCAR" width="401" height="100" />\n' +
'    <img class="logo-dark logo-dark-long" src="/assets/pucar-white-expanded.avif" alt="PUCAR — Public Collective for Avoidance and Resolution of Disputes" width="835" height="100" />\n' +
'    <img class="logo-dark logo-dark-short" src="/assets/pucar-white-short.png" alt="PUCAR" width="379" height="87" />\n' +
'  </a>\n' +
'  <nav class="site-nav"><a href="' + opts.backHref + '">' + opts.backLabel + "</a></nav>\n</header>\n" +
'<main class="job-main">\n' + opts.main + "\n</main>\n" +
'<footer class="site-footer">\n  <div class="footer-top">' +
'<img class="logo logo-long" src="/assets/pucar-white-expanded.avif" alt="PUCAR — Public Collective for Avoidance and Resolution of Disputes" width="835" height="100" />' +
'<img class="logo logo-short" src="/assets/pucar-white-short.png" alt="PUCAR" width="379" height="87" />\n' +
"    <p>PUCAR is an unregistered non-profit public mission facilitating a collective of individuals and organizations to contribute their experience and expertise to advance new ideas and approaches in dispute resolution systems.</p>\n" +
'  </div>\n  <p class="footer-copy">© 2026 PUCAR.</p>\n</footer>\n</body>\n</html>\n';
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
    title: job.title + " — Collaborate with PUCAR",
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
    (person.role ? '<p class="job-summary">' + esc(person.role) + "</p>" : "") +
    "</div></div>\n" +
    '  <article class="job-body">\n' + mdToHtml(person.body || "") + "\n  </article>\n" +
    (links ? '  <div class="cta-row">\n    ' + links + "\n  </div>\n" : "") +
    (posted.length ? '  <h2 class="contrib-sub">Work they’ve posted</h2>\n  <ul class="contrib-jobs">' +
      posted.map(function (j) { return jobLine(j, j.status); }).join("") + "</ul>\n" : "") +
    (taken.length ? '  <h2 class="contrib-sub">Work taken up</h2>\n  <ul class="contrib-jobs">' +
      taken.map(function (j) { return jobLine(j, j.status === "Completed" ? "Completed" : "In progress"); }).join("") + "</ul>\n" : "");
  return pageShell({
    title: person.name + " — PUCAR contributor",
    desc: (person.role ? person.role + ". " : "") + "Contributor to the PUCAR collective.",
    url: person.url,
    jsonLd: { "@context": "https://schema.org", "@type": "Person", name: person.name, description: person.role,
      affiliation: { "@type": "Organization", name: "PUCAR" } },
    backHref: "/#collaborate", backLabel: "← Collaborate", main: main
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
    '  <div class="collab-topline"><span class="collab-cat">' + esc(p.type || "View") + "</span>" +
    '<span class="collab-status">' + esc(p.outlet || "") + "</span></div>\n" +
    '  <span class="collab-type">' + esc(p.author || "") + "</span>\n" +
    '  <span class="collab-title">' + esc(p.title) + "</span>\n" +
    '  <span class="collab-summary">' + esc(p.summary) + "</span>\n" +
    '  <ul class="collab-chips">' + (p.tags || []).map(function (t) { return '<li title="' + esc(t) + '">' + esc(t) + "</li>"; }).join("") + "</ul>\n" +
    '  <div class="collab-foot">\n    <span></span>\n    <span class="collab-btn">Read the summary</span>\n  </div>\n' +
    "</article>";
}

function eventCard(ev) {
  return '<article class="event-card">\n' +
    '  <div class="event-when"><span class="event-city">' + esc(ev.city) + "</span>" +
    '<span class="event-date">' + esc(ev.date_display || "") + "</span>" +
    '<span class="event-time">' + esc(ev.time_display || "") + "</span></div>\n" +
    '  <div class="event-body">\n' +
    '    <h3 class="event-title">' + esc(ev.title) + "</h3>\n" +
    '    <p class="event-venue">' + esc(ev.venue || "") + "</p>\n" +
    '    <p class="event-desc">' + esc(ev.description || "") + "</p>\n" +
    '    <a class="btn btn-primary event-cta" href="' + esc(ev.url || "mailto:collaborate@pucar.org") + '">' + esc(ev.cta || "Register interest") + "</a>\n" +
    "  </div>\n</article>";
}

function scPolicyPage() {
  const main =
'  <p class="beat-eyebrow">PUCAR // Public consultation</p>\n' +
'  <h1 class="job-title">The Supreme Court wants your views on AI in its courts.</h1>\n' +
'  <article class="job-body">\n' +
"    <p>On 3 June 2026, the Supreme Court's Artificial Intelligence Committee published the draft <strong>Regulations for Use of Artificial Intelligence (AI) in Courts, 2026</strong> — a first-of-its-kind framework covering the Supreme Court, all High Courts, subordinate courts, tribunals, and statutory bodies performing adjudicatory roles.</p>\n" +
"    <p>The draft rests on a simple hierarchy: <strong>AI may assist, but never adjudicate.</strong> It permits AI for research, summarisation, translation, transcription, scheduling, litigant-assistance chatbots, and court analytics — and absolutely prohibits AI-only decisions, AI-based risk scoring for bail or credibility, predictive profiling, surveillance of judges or lawyers, and undisclosed AI-generated evidence. Lawyers must disclose AI use in filings, and a permanent Apex Body at the Supreme Court would approve and supervise tools across the system.</p>\n" +
'    <p><strong>Citizen feedback is open until 15 July 2026</strong> (extended from June 20). Anyone — lawyers, technologists, litigants, or curious citizens — can email comments to the Member Secretary, AI Committee, at <a href="mailto:office.regcc@sci.nic.in">office.regcc@sci.nic.in</a>.<sup>[verify status before publishing — sources: SCC Online, LiveLaw, The Week, Jun 2026]</sup></p>\n' +
"  </article>\n" +
'  <div class="cta-row">\n' +
'    <a class="btn btn-primary" href="mailto:office.regcc@sci.nic.in?subject=Feedback%20on%20Draft%20AI%20Regulations%20for%20Courts%2C%202026">Send the Court your feedback</a>\n' +
'    <a class="btn btn-outline" href="https://cdnbbsr.s3waas.gov.in/s3ec0490f1f4972d133619a60c30f3559e/uploads/2026/06/2026060342.pdf" target="_blank" rel="noopener">Read the Court’s notice</a>\n' +
"  </div>\n" +
"</main>\n" +
'<section class="collaborate persp-section" id="perspectives">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">What people are saying</p>\n' +
'    <h2 class="collab-title-main">The public record, so far.</h2>\n' +
'    <p class="collab-sub">Explainers, critiques, and formal submissions on the draft regulations — click any card for a summary of the viewpoint, or open the original.</p>\n' +
"  </div>\n" +
'  <div class="collab-grid" id="perspGrid">\n' +
perspectives.map(function (p) { return perspCard(p, p.slug); }).join("\n") + "\n" +
"  </div>\n" +
"</section>\n" +
'<section class="participate" id="participate">\n' +
'  <div class="collab-head">\n' +
'    <p class="beat-eyebrow">Ways to participate</p>\n' +
'    <h2 class="participate-title">Say something before July 15.</h2>\n' +
"  </div>\n" +
'  <div class="participate-grid">\n' +
'    <article class="event-card suggest-card">\n' +
'      <div class="event-when"><span class="event-city">Anywhere</span><span class="event-date">Until 15 July 2026</span></div>\n' +
'      <div class="event-body">\n' +
'        <h3 class="event-title">Send your suggestions</h3>\n' +
'        <p class="event-desc">Email your comments on the draft to the Member Secretary of the Supreme Court’s AI Committee. Plain language is fine — what matters is the litigant’s point of view. Copy us in if you’d like PUCAR to build on your input.</p>\n' +
'        <div class="cta-row">\n' +
'          <a class="btn btn-primary event-cta" href="mailto:office.regcc@sci.nic.in?subject=Feedback%20on%20Draft%20AI%20Regulations%20for%20Courts%2C%202026&cc=collaborate@pucar.org">Email the AI Committee</a>\n' +
"        </div>\n      </div>\n    </article>\n" +
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
'<script src="/js/perspectives.js"></script>\n<main hidden>';
  return pageShell({
    title: "The Supreme Court’s draft AI regulations — have your say | PUCAR",
    desc: "The Supreme Court of India is inviting public feedback on its draft Regulations for Use of AI in Courts, 2026, until July 15. Read what people are saying and add your voice.",
    url: "/sc-ai-policy/",
    backHref: "/", backLabel: "← pucar.org", main: main
  }).replace("<main hidden>\n</main>", ""); // close the shell's main early; sections above are full-bleed
}

/* ---------------- write everything ---------------- */

["collaborate", "contributors", "sc-ai-policy"].forEach(function (d) {
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
const urls = [SITE + "/", SITE + "/sc-ai-policy/"]
  .concat(jobs.map(function (j) { return SITE + j.url; }))
  .concat(contributors.map(function (c) { return SITE + c.url; }));
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(function (u) { return "  <url><loc>" + u + "</loc></url>"; }).join("\n") + "\n</urlset>\n");

console.log("Built " + jobs.length + " job page(s) (" + boardJobs.length + " on the board), " +
  contributors.length + " contributor page(s), sc-ai-policy (" + perspectives.length +
  " perspectives, " + scEvents.length + " events), jobs.json, cards, sitemap.xml");
