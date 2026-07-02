#!/usr/bin/env node
/* =========================================================
   PUCAR — collaborate build step (no dependencies)

   Reads content/jobs/*.json (written by Decap CMS or by hand)
   and generates:
     - collaborate/<slug>/index.html   crawlable page per role
     - collaborate/jobs.json           index used by the modal JS
     - static cards injected into index.html between
       <!-- COLLAB:START --> and <!-- COLLAB:END -->
     - sitemap.xml
   Run: node scripts/build-jobs.js   (Netlify runs this on deploy)
   ========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JOBS_DIR = path.join(ROOT, "content", "jobs");
const OUT_DIR = path.join(ROOT, "collaborate");
const SITE = (process.env.URL || "https://pucar-journey.netlify.app").replace(/\/$/, "");

/* ---------------- tiny helpers ---------------- */

function esc(s) {
  return String(s)
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
  const blocks = String(md).replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks.map(function (block) {
    const b = block.trim();
    if (!b) return "";
    const lines = b.split("\n").map(function (l) { return l.trim(); });
    const h = b.match(/^(#{1,4})\s+(.*)$/);
    if (h && lines.length === 1) {
      const level = Math.min(h[1].length + 1, 5); // # -> h2 … page h1 is the title
      return "<h" + level + ">" + inline(esc(h[2])) + "</h" + level + ">";
    }
    if (lines.every(function (l) { return /^[-*]\s+/.test(l); })) {
      return "<ul>" + lines.map(function (l) {
        return "<li>" + inline(esc(l.replace(/^[-*]\s+/, ""))) + "</li>";
      }).join("") + "</ul>";
    }
    if (lines.every(function (l) { return /^\d+\.\s+/.test(l); })) {
      return "<ol>" + lines.map(function (l) {
        return "<li>" + inline(esc(l.replace(/^\d+\.\s+/, ""))) + "</li>";
      }).join("") + "</ol>";
    }
    return "<p>" + inline(esc(b)).replace(/\n/g, "<br>") + "</p>";
  }).filter(Boolean).join("\n");
}

/* ---------------- load jobs ---------------- */

const jobs = fs.readdirSync(JOBS_DIR)
  .filter(function (f) { return f.endsWith(".json"); })
  .map(function (f) {
    const job = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), "utf8"));
    job.slug = f.replace(/\.json$/, "");
    job.url = "/collaborate/" + job.slug + "/";
    job.tags = job.tags || [];
    return job;
  })
  .filter(function (j) { return j.published !== false; })
  .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

/* ---------------- per-job crawlable page ---------------- */

function jobPage(job) {
  const bodyHtml = mdToHtml(job.body || "");
  const chips = [job.commitment, job.location].concat(job.tags)
    .filter(Boolean)
    .map(function (c) { return '<li>' + esc(c) + "</li>"; }).join("");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.summary,
    datePosted: job.date,
    employmentType: job.type,
    hiringOrganization: { "@type": "Organization", name: "PUCAR", sameAs: "https://pucar.org" },
    jobLocationType: /remote/i.test(job.location || "") ? "TELECOMMUTE" : undefined,
    directApply: true
  };
  return "<!DOCTYPE html>\n" +
'<html lang="en">\n<head>\n' +
'<meta charset="UTF-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n' +
"<title>" + esc(job.title) + " — Collaborate with PUCAR</title>\n" +
'<meta name="description" content="' + esc(job.summary) + '" />\n' +
'<link rel="canonical" href="' + SITE + job.url + '" />\n' +
'<meta property="og:type" content="website" />\n' +
'<meta property="og:title" content="' + esc(job.title) + " — PUCAR" + '" />\n' +
'<meta property="og:description" content="' + esc(job.summary) + '" />\n' +
'<meta property="og:url" content="' + SITE + job.url + '" />\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
'<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />\n' +
'<link rel="stylesheet" href="/css/style.css" />\n' +
'<script type="application/ld+json">' + JSON.stringify(jsonLd) + "</script>\n" +
"</head>\n<body class=\"job-page\">\n" +
'<header class="site-header">\n' +
'  <a class="logo" href="/">PUCAR</a>\n' +
'  <nav class="site-nav"><a href="/#collaborate">← All roles</a></nav>\n' +
"</header>\n" +
'<main class="job-main">\n' +
'  <p class="beat-eyebrow">' + esc(job.type || "Role") + "</p>\n" +
'  <h1 class="job-title">' + esc(job.title) + "</h1>\n" +
'  <p class="job-summary">' + esc(job.summary) + "</p>\n" +
'  <ul class="job-chips">' + chips + "</ul>\n" +
'  <article class="job-body">\n' + bodyHtml + "\n  </article>\n" +
'  <div class="cta-row">\n' +
'    <a class="btn btn-primary" href="' + esc(job.apply_url || "mailto:collaborate@pucar.org") + '">Express interest</a>\n' +
'    <a class="btn btn-outline" href="/#collaborate">See all roles</a>\n' +
"  </div>\n" +
"</main>\n" +
'<footer class="site-footer">\n' +
'  <div class="footer-top"><span class="logo">PUCAR</span>\n' +
"    <p>PUCAR is an unregistered non-profit public mission facilitating a collective of individuals and organizations to contribute their experience and expertise to advance new ideas and approaches in dispute resolution systems.</p>\n" +
"  </div>\n" +
'  <p class="footer-copy">© 2026 PUCAR.</p>\n' +
"</footer>\n</body>\n</html>\n";
}

/* ---------------- homepage cards ---------------- */

function card(job) {
  const chips = [job.commitment, job.location].concat(job.tags).filter(Boolean)
    .map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  return '<a class="collab-card" href="' + job.url + '" data-slug="' + esc(job.slug) + '">\n' +
    '  <span class="collab-type">' + esc(job.type || "Role") + "</span>\n" +
    '  <span class="collab-title">' + esc(job.title) + "</span>\n" +
    '  <span class="collab-summary">' + esc(job.summary) + "</span>\n" +
    '  <ul class="collab-chips">' + chips + "</ul>\n" +
    '  <span class="collab-btn">View role</span>\n' +
    "</a>";
}

/* ---------------- write everything ---------------- */

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

jobs.forEach(function (job) {
  const dir = path.join(OUT_DIR, job.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), jobPage(job));
});

fs.writeFileSync(path.join(OUT_DIR, "jobs.json"), JSON.stringify(jobs.map(function (j) {
  return {
    slug: j.slug, url: j.url, title: j.title, summary: j.summary, type: j.type,
    commitment: j.commitment, location: j.location, tags: j.tags,
    apply_url: j.apply_url, html: mdToHtml(j.body || "")
  };
}), null, 1));

/* inject static cards into index.html between markers */
const indexPath = path.join(ROOT, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const START = "<!-- COLLAB:START -->", END = "<!-- COLLAB:END -->";
const s = html.indexOf(START), e = html.indexOf(END);
if (s === -1 || e === -1) {
  console.error("COLLAB markers not found in index.html — cards not injected.");
  process.exit(1);
}
html = html.slice(0, s + START.length) + "\n" +
  (jobs.length
    ? jobs.map(card).join("\n")
    : '<p class="collab-empty">No open roles right now — check back soon, or write to us.</p>') +
  "\n" + html.slice(e);
fs.writeFileSync(indexPath, html);

/* sitemap */
const urls = [SITE + "/"].concat(jobs.map(function (j) { return SITE + j.url; }));
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(function (u) { return "  <url><loc>" + u + "</loc></url>"; }).join("\n") +
  "\n</urlset>\n");

console.log("Built " + jobs.length + " job page(s), jobs.json, homepage cards, sitemap.xml");
