# PUCAR — The Litigant's Journey

A scroll-driven storytelling site for PUCAR (a non-profit public mission
working on people-centric dispute resolution in India), plus a "Collaborate"
work board with crawlable job and contributor pages, editable through Decap
CMS.

**Stack: plain HTML/CSS/JS. No framework, no npm dependencies.** The only
build step is a dependency-free Node script that generates the collaborate
pages. Hosted on Netlify (free tier).

This README is the full handover document: architecture, every moving part,
how to extend it, and what's still placeholder. If you're an agent or
developer picking this up — read this top to bottom before touching anything.

---

## 1. Repository map

```
index.html             Single-page story (8 scroll beats) + collaborate board + job modal.
                       PARTLY GENERATED: cards between <!-- COLLAB:START/END --> markers
                       are injected by the build script — don't hand-edit that region.
css/style.css          Everything visual: palette vars, story layout, litigant animations,
                       collaborate board, filters, modal, job/contributor page styles.
js/script.js           Story engine: beat switching, count-up stats, is-walking and
                       is-idle classes driven by scroll.
js/collaborate.js      Board enhancement: filters, closes-in labels, modal + pushState.
scripts/build-jobs.js  THE build step (node scripts/build-jobs.js). Zero dependencies.
content/jobs/          One JSON per work item  ← source of truth, edited via Decap or hand.
content/contributors/  One JSON per contributor ← source of truth.
admin/                 Decap CMS: index.html (loads decap from unpkg) + config.yml.
collaborate/           GENERATED: <slug>/index.html per work item + jobs.json index.
contributors/          GENERATED: <slug>/index.html per contributor.
sitemap.xml            GENERATED.
assets/litigant-source.svg  Cleaned copy of the litigant illustration (same as inline).
netlify.toml           publish=".", command="node scripts/build-jobs.js", security headers.
```

Generated files ARE committed (so local preview works without running the
build), but Netlify regenerates them on every deploy — never edit them
directly.

**Local dev:** `node scripts/build-jobs.js && python3 -m http.server 8000`.
No install step, ever.

---

## 2. The story (scrollytelling)

- `#story` is `height: calc(var(--beats) * 100vh)` with `--beats:8` set
  inline; `.pin` inside is `position:sticky` and holds the whole viewport.
- `js/script.js` maps scroll progress through `#story` to the nearest beat
  (0–7), sets `data-beat` on `#pin` (drives background tints, motif
  visibility, per-beat CSS), toggles `.is-active` on `.beat` articles, runs
  the count-up stat animation once per stat, and fills the progress rail.
- Beats 0–7: intro → pendency stat → narrative → 10-yr wait → undertrials →
  PUCAR turn (navy) → initiatives grid → CTA (navy-deep). All stats are
  marked `[placeholder — verify]` in the markup.
- **Walk state:** on every scroll frame the pin gets `.is-walking`; a 180 ms
  timeout removes it after scrolling stops. All walk animations and the
  ground/path/shadow layers are `animation-play-state: paused` by default
  and `running` only under `.pin.is-walking` — so the whole scene freezes
  mid-pose the moment scrolling stops.
- **Idle state:** `resetIdle()` (also in script.js) removes `.is-idle` and
  re-arms a 10 s timer (`IDLE_DELAY = 10000`) on every scroll frame; when it
  fires, the pin gets `.is-idle` and the litigant's head looks around (see
  below). Any scroll clears it instantly.

## 3. The litigant figure (SVG anatomy + animations)

The figure is a user-supplied top-down flat illustration (Canva export,
810×810), embedded inline in `index.html` as `svg.litigant`
(`viewBox="90 140 620 530"`, cropped to the figure). A cleaned copy lives at
`assets/litigant-source.svg`. History: this is the SECOND supplied asset; it
replaced an earlier one whose CSS animation never ran (root cause: missing
`transform-box: view-box`, so px transform-origins didn't resolve in viewBox
units — that fix is now applied to every animated group).

Cleanup performed on the asset when embedding:
- Removed a tiny green icon in the bottom-left corner (3 paths + 2 clipPaths).
- Removed 3 stray paths behind the head's upper-left (a disembodied shoe +
  skin blob next to the bun) and a static knee-blob that peeked from under
  the skirt (replaced by a real second leg).
- ClipPath ids prefixed: `ligShoe`, `ligHandR`, `ligSlvL`, `ligBun`.

Animatable groups inside `.fig` (z-order preserved — order matters, the
skirt/coat are drawn over the leg tops and arm pivots):
- `.leg-front` — the originally drawn right leg (thigh + skin + shoe).
- `.leg-back` — a clone of those 3 paths inside `transform="translate(-92 0)"`
  (the left leg; the -92 sets stance width — was -57, widened on request).
- `.arm-left`, `.arm-right` — forearm + hand clusters.
- `.head` ×2 — the face-skin path AND the hair+bun pair, wrapped as two
  separate groups (other paths sit between them in z-order) sharing the same
  class/pivot/animation so they turn as one head.

CSS animations (all in style.css, all `transform-box: view-box`, pivots in
asset user units; 1 s cycle, paused unless `.is-walking`):

| keyframes | element    | what                                    | origin      |
|-----------|-----------|------------------------------------------|-------------|
| legFront  | .leg-front | scaleY 1.02 ↔ .62 (stride)              | 455px 508px |
| legBack   | .leg-back  | same, opposite phase                     | 363px 508px |
| figWalk   | .fig       | scale 1 ↔ 1.016 (bob) + ±.7° rock       | 400px 430px |
| armLeft/Right | arms   | ±2.4° counter-sway                       | 150px 430px / 592px 330px |
| headLook  | .head (×2) | ±16° glance left, hold, right, hold, rest| 379px 372px |

`headLook` (5.5 s, infinite) runs only under `.pin.is-idle`. The hip pivots
(y≈508) hide under the skirt hem so the scaling legs never show a seam.
Tuning knobs: stride depth = the `.62`; bob = the `1.016`; stance width =
the `translate(-92 0)` in both index.html and assets/litigant-source.svg.

Supporting layers: `.ground-dots` (dotted floor scrolling upward),
`.path` (dashed line inside `.litigant-stage`, `height:200vh` centred on the
stage so it spans any viewport), `.shadow` (pulsing ellipse). The stage sits
in grid column 1 and slides to viewport centre (`translateX(25vw)`) from
beat 2 onward; disabled on mobile (≤860px, single column).

`prefers-reduced-motion` disables every figure/layer animation.

## 4. Collaborate board

### 4.1 Why it's built this way (decision log)

Requirement: job cards on the homepage opening a modal, where each job has a
**crawlable deeplink** (link-preview bots and most crawlers don't run JS), on
Netlify free tier. Options considered: Supabase+Functions (rejected: extra
moving parts, free-tier pausing, client-side fetches aren't crawlable),
plain JSON+build (chosen as the base), Decap CMS on top (chosen: user wanted
an editing UI). Everything is pre-rendered static HTML; the modal is pure
progressive enhancement over real pages.

### 4.2 Content model — content/jobs/*.json

Filename = slug = URL (`/collaborate/<slug>/`). Fields:

- `title`, `summary` (card + meta description), `body` (markdown)
- `date` (posted, YYYY-MM-DD) and `listing_days` (int): the build computes
  `expiry = date + listing_days`; the card leaves the board after that.
- `deadline` (YYYY-MM-DD): when the work itself is due (separate from expiry).
- `stream`: `"Volunteer" | "Paid"`; `term`: `"" | "Permanent" | "Temporary"`
  (only meaningful for Paid; displayed as "Paid · Temporary" etc.)
- `category`: Design | Development | Research | Legal | Data | Content | Operations
- `difficulty`: `"Low Difficulty" | "Moderate" | "High"` — colour-coded
  labels (green `#3F7D4E` / amber `#C98A2E` / red `#B0402F`, classes
  `diff-low|moderate|high` derived from the first word).
- `commitment`, `location`, `tags[]`, `apply_url`
- `posted_by` / `assigned_to`: contributor slugs (Decap relation widgets)
- `status`: `Open | Assigned | Completed`
- `published`: false hides it everywhere

**Board rules (enforced in the build):** a card appears on the homepage only
if `status === "Open"` AND `expiry >= today` (build date). ALL published
items still get their detail page (old links keep working) and appear on
contributor pages. Client-side JS additionally hides cards whose expiry
passed since the last deploy and rewrites "Closes <date>" to
"Closes in N days" (`.is-urgent` styling at ≤5 days).

### 4.3 Content model — content/contributors/*.json

Filename = slug = URL (`/contributors/<slug>/`). Fields: `name`, `role`,
`photo` (optional; empty → initials avatar, background hue hashed from the
name), `email`, `links[]` ({label,url}), `published`, `body` (bio markdown).

### 4.4 The build script — scripts/build-jobs.js

Run by Netlify (`netlify.toml` command) and locally. Zero deps. It:
1. Loads both content folders (skips `published:false`), joins jobs ↔
   contributors, computes expiry, sorts jobs newest-first.
2. Writes `collaborate/<slug>/index.html` per job — canonical + OG tags,
   JobPosting JSON-LD (employmentType mapped from stream/term, validThrough
   = expiry), meta badges, dates row, chips, "Posted by" row linking the
   contributor, body, apply CTA (disabled pill when not Open).
3. Writes `contributors/<slug>/index.html` — avatar, bio, link buttons,
   "Work they've posted" and "Work taken up" lists with status, Person JSON-LD.
4. Injects board cards as static HTML into `index.html` between
   `<!-- COLLAB:START -->` / `<!-- COLLAB:END -->` (hard-fails if markers are
   missing). Cards are `<article>` with a stretched `.collab-cover` link
   (real href — crawlable) + a z-raised `.collab-poster` link, and carry
   `data-slug/-stream/-category/-difficulty/-deadline/-expiry/-tags` for the
   client-side filters.
5. Writes `collaborate/jobs.json` (everything the modal needs, incl.
   pre-rendered body HTML and poster info) and `sitemap.xml` (home + all job
   + contributor pages; domain from Netlify's `URL` env var, placeholder
   locally).

Markdown support is intentionally minimal (headings #–####, -/1. lists,
bold/italic/links/inline code, paragraphs). HTML in bodies is escaped. If
richer markdown is ever needed, swap `mdToHtml` for a real parser — that's
the only place.

### 4.5 Client behaviour — js/collaborate.js

- **Filters** (`#collabFilters`, hidden until JS runs): stream, category,
  difficulty selects; deadline-range select (due within 7/14/30/90 days,
  computed client-side against `data-deadline`); tag chips (toggle,
  AND-combined). Category options and tag chips are derived from the cards
  present. Active filters show a result count + clear button.
- **Custom dropdowns**: the native `<select>`s are kept as the hidden source
  of truth (options still populated there; `change` events still drive the
  filter state) but their UI is replaced by `enhanceSelect()` with a styled
  `.dd` button + `.dd-menu` listbox (paper panel, terracotta selected-dot,
  gold "active" state on the trigger) so open menus match the site instead
  of the OS. Keyboard: ArrowUp/Down to open and move, Enter/Space to pick,
  Escape to close; outside click closes. The clear button re-renders them
  via `select.__ddRender()`. If you add a new select filter, no extra work —
  every select inside `#collabFilters` is enhanced automatically.
- **Modal** (`#jobModal`): clicking a card's cover link opens it (populated
  from jobs.json — badges, deadline/closes, chips, posted-by, body) and
  `history.pushState`s the job's real URL. Back button / Escape / backdrop /
  × close it (with `history.back()` if we pushed). Cmd/Ctrl/Shift-click and
  the posted-by link fall through to real navigation. No JS → cards are
  plain links to the static pages.

### 4.6 Decap CMS — admin/

`/admin/` loads Decap 3 from unpkg; `admin/config.yml` defines both
collections (jobs incl. relation widgets to contributors; format json).
Backend is `github`, repo `pucardotorg/pucar-website`, branch `main` —
every publish is a git commit → Netlify rebuild.

**One-time setup still pending (not possible from this environment):**
1. Create a GitHub OAuth app (Settings → Developer settings): homepage =
   site URL, callback = `https://api.netlify.com/auth/done`.
2. Netlify → Site configuration → Access & security → OAuth → Install
   provider → GitHub, paste Client ID/Secret.
3. Anyone with repo write access can then log in at `/admin/`.
Local editing without auth: uncomment `local_backend: true` in config.yml
and run `npx decap-server` next to the static server.

---

## 5. Deployment & git state

- Remote: `https://github.com/pucardotorg/pucar-website` (remote `origin`
  configured; repo identity user "Varun" <varun@agami.in>).
- **The working environment here cannot push** (no GitHub credentials;
  github.com unreachable from the sandbox). Commits are made locally and
  Varun pushes from his own terminal. Always end a work session by giving
  him the push command.
- Netlify: connect the repo; `netlify.toml` handles the rest (publish root,
  build command, X-Frame-Options/nosniff headers). The build needs no
  install step. Note: because expiry is computed at build time, a site with
  no commits for weeks won't drop expired cards server-side — the client
  hides them anyway; a scheduled/manual redeploy also refreshes it.

## 6. Known placeholders / TODO before launch

- All story stats (5.5 Cr pending, 10+ yr, 75% undertrials) are
  approximations marked `[placeholder — verify]` — check NJDG / Prison
  Statistics India and cite.
- Beat-2 narrative is a stand-in; initiative cards (beat 6) and CTA buttons
  (beat 7) link to `#`.
- All 5 work items and contributors "Aditi Rao" and "Rohan Mehta" are sample
  content marked `[placeholder]`; "Varun H" bio is placeholder. Add real
  photos via Decap (media goes to `assets/uploads/`).
- Decap OAuth setup (section 4.6) not yet done.
- Sample job dates are relative to July 2026; re-check expiry behaviour when
  updating.

## 7. Conventions for future changes

- Never hand-edit `collaborate/`, `contributors/`, `sitemap.xml`, or the
  card region of `index.html` — change `content/` or the build script and
  re-run it.
- Keep the litigant SVG edits mirrored in both `index.html` and
  `assets/litigant-source.svg`.
- New animated SVG groups need `transform-box: view-box` + a px
  `transform-origin`, and should be added to the `prefers-reduced-motion`
  block and (if walk-related) the paused/`.is-walking` lists.
- Stay dependency-free: no package.json unless the publish-directory
  strategy changes (publish=".", so node_modules would get deployed).
