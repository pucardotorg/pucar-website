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
js/contact.js          Get-in-touch modal + Netlify form AJAX + themed validation.
js/perspectives.js     sc-ai-policy: perspective-card modal + live CIVIS respondent count.
js/contributors-page.js  Contributor directory search + org filter (used inside /contributors/).
js/nav.js              GENERATED PAGES ONLY: nav glider + body.nav-dark flip over dark sections.
js/view-toggle.js      Cards <-> list switch for all three card grids.
scripts/build-jobs.js  THE build step (node scripts/build-jobs.js). Zero dependencies.
scripts/import-pucar-contributors.js   one-off: 77 contributors scraped from pucar.org/about.
scripts/mirror-contributor-photos.js   one-off: self-hosts contributor photos (run locally).
content/jobs/          One JSON per work item  ← source of truth, edited via Decap or hand.
content/contributors/  One JSON per contributor ← source of truth (77 real + 3 unpublished samples).
content/sc-perspectives/ + content/sc-events/  sc-ai-policy page content.
admin/                 Decap CMS: index.html (loads decap from unpkg) + config.yml.
collaborate/           GENERATED: <slug>/index.html per work item + jobs.json index.
contributors/          GENERATED: <slug>/index.html per contributor + index.html (the
                       consolidated hub — DRISTI 2.0 + Policy + Contributors, see 6.3c) +
                       photos.json (waving-heads data) + profiles.json (modal data).
about/ sc-ai-policy/   GENERATED pages (aboutPage/scPolicyPage in build script).
team/                  GENERATED redirect stub → /about/#team (teamPage() in build script).
sitemap.xml / robots.txt  GENERATED at build time (urls array + allow-all robots.txt
                       pointing at the sitemap).
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

## 2. Design system: colour, type, buttons

All of this lives in `css/style.css`'s `:root` block (lines ~8–35). Every
other rule in the stylesheet reads colour through a `var(--name)` — there
are exactly two hardcoded hex exceptions, both called out below with why.

### Colour

Brand colours, given directly by the client (not sampled from anywhere):

| Variable | Hex | Role |
|---|---|---|
| `--green` | `#30CF8C` | Dominant accent — **dark backgrounds only**, see rule below. Also the exact colour of the logo mark (`assets/pucar-normal-expanded.png`, sampled and confirmed pixel-identical). |
| `--pink` | `#DA6EAA` | Secondary accent. Eyebrow labels, tag/chip highlights, footer link hover. No light/dark restriction. |
| `--forest` | `#111F26` | Dark background *and* the light-background stand-in for `--green` (see rule below). Also replaces the old navy-blue dark background (beat 5, nav hover). |
| `--forest-deep` | `#0A151A` | Darkest background. Replaces the old navy-deep (beat 7, footer). |
| `--green-soft` | `#CCEBDE` | Pale tint of `--green` (~86% lightness, same hue/lower saturation). Available for soft backgrounds; not currently used anywhere but kept for consistency. |
| `--pink-soft` | `#F1D0E2` | Pale tint of `--pink`. Used as beat 4's background tint. |

`--forest`/`--forest-deep` and `--green-soft`/`--pink-soft` were derived
from the brand hexes by converting to HSL and dropping lightness (for the
dark backgrounds) or raising it (for the soft tints), keeping hue and
roughly the same saturation — so everything reads as "the same colour,
darker/lighter," not an unrelated palette bolted on.

**Rule: the bright `--green` (`#30CF8C`) only ever sits on a dark
background — explicit client instruction.** It fails contrast on every
light surface in this palette (1.8:1 on `--cream`, WCAG needs 4.5:1 for
text), which is exactly why it read as illegible on the beat 0 eyebrow
before this fix. Wherever the codebase used to reach for
`--terracotta`/`--green` on a light background, it now uses `--forest`
(the same hue, just dark — 11–12:1 contrast on `--cream`/`--paper`)
instead:
- `.beat-eyebrow`, `.beat-stat` (base rule, i.e. beats 0–3 and 6) — `--forest`.
  Beats 5 & 7 sit on `--navy`/`--navy-deep` (dark), so `.beat-stat` there
  is explicitly overridden back to bright `--green` — this is the one
  spot in the story where the literal brand green is meant to appear.
  Beat 4 keeps its own dark-pink override (`#7C1D52` on `--pink-soft`).
- `.initiative-num` (beat 6, light) — `--forest`.
- `.job-body a`, the `.dd-menu` selected-item dot marker — both sit on
  light surfaces (`--paper`) — `--forest`.
- `.progress-fill` (the scroll-progress rail) — `--forest` by default
  since the rail is fixed and overlays whichever beat background is
  currently showing, most of which are light; overridden to bright
  `--green` specifically on beats 5 & 7 the same way `.beat-stat` is.
- `.btn-primary` — see "Buttons" below, it's the one case that needed a
  *contextual* override rather than a flat swap, since the same class is
  reused on both a dark background (beat 7 CTA) and light ones (job
  modal/page).

Cream/paper/ink neutrals (`--cream`, `--cream-deep`, `--paper`, `--ink`,
`--ink-soft`, `--muted`) are unchanged from the original build — the client
only asked to change the accent/background colours, not the warm paper
base or body text colour.

**Migration mechanism — read this before renaming anything:** the codebase
was originally written against `--navy`, `--navy-deep`, `--terracotta`,
`--terracotta-soft`, and `--gold`. Rather than rename every call site (high
risk of missing one across `index.html`, `style.css`, and five generated
job/contributor pages), those five variables are kept as **aliases**:

```css
--navy:         var(--forest);
--navy-deep:    var(--forest-deep);
--terracotta:   var(--green);
--terracotta-soft: var(--green-soft);
--gold:         var(--pink);
```

So `var(--terracotta)` and `var(--navy)` still work everywhere in the
stylesheet and now resolve to the new brand colours automatically. If you
add new CSS, prefer the real names (`--green`, `--pink`, `--forest`) —
the aliases exist for backward compatibility, not as the preferred API.

**The two hardcoded hex exceptions** (not run through a variable, on
purpose — they're semantic status colours, not brand accents):
- `.diff-low` / `.diff-moderate` / `.diff-high` (collaborate board
  difficulty badges) use an independent green/amber/red traffic-light
  system (`#3F7D4E` / `#C98A2E` / `#B0402F`). `#C98A2E` happens to equal
  the *old* `--gold` value, but changing it to `--pink` would break the
  intuitive amber-for-"moderate" convention, so it was left as a literal.
- `.collab-closes.is-urgent` (`#F0A28A` / `#B0402F`) is a red/orange
  urgency warning, unrelated to brand identity.

**The litigant SVG is explicitly untouched.** It's an inline illustration
that carries its own `fill`/`stroke` values baked into the markup (dark
bun, purple coat, pink bag, grey skirt — see §5 below) — none of its
colour ever passes through a CSS variable, so the palette rebrand couldn't
have touched it even by accident. Verified by grepping `css/style.css` for
`.litigant` rules: every one only sets `transform`/`animation`/layout
properties, never `fill`, `stroke`, or `color`.

### Type

- `--font-display: 'Fraunces', ...` (serif) — **unchanged**, per explicit
  instruction to leave serif alone.
- `--font-body: 'Source Sans 3', -apple-system, ...` (sans-serif) —
  changed from Inter. Loaded via the same Google Fonts `<link>` pattern
  already in place (`index.html` head, and the `pageShell()` template in
  `scripts/build-jobs.js` so every generated collaborate/contributor page
  matches): `family=Source+Sans+3:wght@400;500;600;700`.
- No other font-family declarations exist anywhere in the codebase — both
  variables are referenced everywhere text is styled, so this was a
  two-line change (the `<link>` href and the `--font-body` value) plus
  regenerating/patching the already-built static pages (see §7, the
  `build-jobs.js` EPERM caveat — pages were hand-patched, not rebuilt).

### Buttons & interactive states

- `.btn-primary` is reused in two different lighting contexts, so it
  can't take a single flat colour the way most other rules could:
  - Base rule: `background: var(--green)`, `color: var(--ink)` (not
    `--paper` — white text on bright green is only 1.9:1 contrast, dark
    ink on the same green is 8.2:1). This is what renders for its one
    dark-background use, the beat 7 CTA ("Get in touch"). Hover lightens
    to `#51D79E` (keeps ink at ~9:1 on hover too — darkening instead would
    have *dropped* the ink contrast, since ink and a darker green converge
    tonally; lightening moves them apart).
  - `.job-page .btn-primary` / `.job-modal-panel .btn-primary` — both of
    those wrapper contexts are light backgrounds (`--cream`/`--paper`), so
    this override swaps to `background: var(--forest)`, `color: var(--paper)`
    (light text now, since the background itself is dark) — 12.4:1
    contrast. Hover darkens further to `#1C3540`, a lighter tint of
    `--forest` (still reads as "hover state," 9.6:1 with `--paper`).
- `.btn-ghost` — unaffected (uses `rgba(251,248,242,...)`, not a brand var).
- Filter chips / tag toggles (`.chip-toggle`, active/hover states) —
  `var(--gold)` → resolves to `--pink` now. Pink has no light/dark
  restriction (2.7:1 on cream — still not print-quality, but it's used at
  chip/label sizes with weight, not body copy, and wasn't part of the
  client's dark-bg-only instruction, which named green specifically).
- Beat eyebrows (`.beat-eyebrow` on beats 5 & 7, `.collab-head
  .beat-eyebrow`) — `var(--gold)` → `--pink`, unaffected by the green rule.

---

## 3. Intro hero (before the story starts)

`<section class="intro-hero" id="intro">`, the first thing in `<main>`,
directly above `#story`. This is deliberately **not** part of the
scrollytelling mechanism below — no `data-beat`, no sticky positioning, no
`js/script.js` involvement at all. It's a plain static full-height section
that introduces PUCAR the organisation before the litigant's narrative
begins, per explicit instruction: "The first section of the website should
just talk about PUCAR."

Structure (`.intro-hero-inner`, all centred, `max-width:720px`):
- `.intro-eyebrow` — "PUCAR", small caps, `--forest` (light bg, see §2's
  green rule).
- `.intro-tagline` — **the page's only `<h1>`**: "PUCAR is a non-profit
  public mission to transform the dispute resolution experience of every
  person." Beat 0's heading (`#story`'s opening beat, "Every case is a
  person.") was demoted from `<h1>` to `<h2>` when this was added, since a
  page should really only have one `<h1>` and this mission statement is
  the more fundamental one — beat 0 is the opening line of the *narrative*,
  this is the opening line of the *organisation*.
- `.intro-hook` — "Find out what happens when you design courts by putting
  citizens at the centre." (secondary line, `--ink-soft`).
- `.intro-skip` — "Skip the story. Find out how you can collaborate."
  (italic, `--ink-soft` — *not* `--muted`, which only hits 3.5:1 contrast
  on `--cream` and fails AA at this text size; `--ink-soft` is 7.7:1).
- `.intro-actions` (`class="intro-actions cta-row"`, reusing the same
  `.cta-row`/`.btn` classes as beat 7's CTA) — two buttons:
  - `<a class="btn btn-primary" href="#story">Tell me more</a>` — jumps to
    the scrollytelling story.
  - `<a class="btn btn-ghost" href="#collaborate">Collaborate</a>` — jumps
    straight past the story to the collaborate board.

Both buttons needed light-background overrides, same reasoning as §2's
button section: `.btn-primary`/`.btn-ghost` default to styling meant for a
dark backdrop (they're normally used on beat 7's `--navy-deep`), but
`.intro-hero`'s background is `--cream` (light). `.intro-hero .btn-primary`
is folded into the same shared override as `.job-page`/`.job-modal-panel`
(background `--forest`, text `--paper`); `.btn-ghost` didn't have an
existing light-bg variant anywhere else, so `.intro-hero .btn-ghost` gets
its own (`border:1px solid rgba(36,30,26,.32)`, `color:var(--ink)`).

One cascade gotcha worth flagging: `.intro-actions` sets `margin-top:0`
(the `.intro-skip` line above it already carries its own bottom margin, so
`.cta-row`'s usual `margin-top:28px` would double up the gap) — but
`.cta-row` is declared *later* in the stylesheet than a plain `.intro-actions`
rule would be, and both are single-class selectors of equal specificity, so
source order would let `.cta-row` win and silently undo the override. Fixed
by scoping the rule to `.intro-hero .intro-actions` (two classes = higher
specificity), which reliably wins regardless of where either rule sits in
the file.

`.site-header` is `position:fixed` with a transparent background (see §2
if that's news), so it already overlays `.pin` the same way — `.intro-hero`
needed no special accommodation for it beyond generous top padding.

### 3.1 Hero layout: copy left, bulletin board right

The hero is a two-column grid (Jul 2026 revision — it was a single centred
column): `.intro-copy` on the left, all text LEFT-aligned, and
`.intro-board` on the right — a "bulletin board" of currently active work.
The board is a dark forest panel (slight `.5deg` tilt) with paper notes
"pinned" to it (`.board-note`, uneven border-radius, a `::before` pink pin
dot, alternating tilts that straighten + lift on hover) and a pulsing
green "live" dot in its eyebrow. Two notes: **Advance the DRISTI 2.0
stack** → `#collaborate` (picked up by the existing `cleanJumpTo` click
handler, so it jumps cleanly past the story) and **Explore the Supreme
Court's AI policy** → `/sc-ai-policy/`. **Mobile (≤900px): the grid
collapses to one column and the board stacks below the copy, full-width,
tilts eased.** Add new notes as more work streams open — the deadline
line in note 02 ("until 15 July 2026") will need updating/removal when
the consultation closes.

## 3.2 The /sc-ai-policy/ page

Generated by `scripts/build-jobs.js` (same run as everything else), from
two content folders:
- `content/sc-perspectives/*.json` — public commentary on the Supreme
  Court's draft **Regulations for Use of AI in Courts, 2026**. Fields:
  title, author, outlet, type (Explainer/Critique/Analysis/Comparative/
  Viewpoint/Submission), url, tags[], summary (card), body (markdown,
  the modal's summary), order, published. Sourced Jul 2026 from the
  team's tracking sheet (SC_AI_Policy_Critiques) + web research; 10
  entries currently.
- `content/sc-events/*.json` — gatherings (title, city, date_display/
  time_display/venue — ALL PLACEHOLDER strings right now, real details
  to come from Varun — description, url, cta, order).

Page structure: light intro (`.job-main` chrome — the draft was published
3 Jun 2026 by the SC's AI Committee; assist-never-adjudicate framing;
**feedback to office.regcc@sci.nic.in until 15 July 2026, extended from
Jun 20**; links to the Court's notice PDF; a `[verify status before
publishing]` sup is in the copy since the deadline may pass) → dark
`.persp-section` reusing `.collaborate`/`.collab-card` styling wholesale
("styled exactly like our collaborate cards") with `js/perspectives.js`
opening the shared job-modal from `perspectives.json` (click = summary
modal; "Read the original"/modified-click = source article; no-JS =
cards are plain links to the originals) → light `.participate` section:
a "Send your suggestions" card (mailto the AI Committee, cc
collaborate@pucar.org) + event cards (`.event-card`: forest date banner,
body, CTA), Bengaluru round-table + online discussion placeholders.
The page is in `sitemap.xml`; `sc-ai-policy/` is a GENERATED directory —
never hand-edit it.

### 3.3 Header CTA + contact modal (Netlify Form)

"Get in touch" no longer lives inside the nav pill: it's a solid CTA
button (`.header-cta`, `#contactOpen`) to the right of the nav (both
wrapped in `.header-right`). Forest-on-light by default; on the story's
dark half it flips to bright `--green` via the same `body:has(.pin
[data-beat=4..8])` mechanism as the logo swap. On ≤640px the nav hides
but the CTA stays.

Modal scrolling gotcha: the OVERLAY (.job-modal) is the scroll container,
not the rounded panel. When the panel scrolled itself, macOS rubber-band made
WebKit/Blink drop the border-radius clip for a frame (corners flashed
square); layer hacks didn't cure it. The backdrop is position:fixed so it
keeps covering the viewport while the overlay scrolls, and overscroll is
contained.

Clicking it opens `#contactModal` (shared job-modal chrome) containing a
**Netlify Form** (`name="contact"`): name*, email*, phone (optional),
message*. Netlify-forms requirements that MUST NOT be broken: the form
exists statically in index.html with `data-netlify="true"`, a hidden
`form-name` input, and a `netlify-honeypot="bot-field"` — Netlify's
build-time parser registers forms from the deployed HTML, so a
JS-injected form would silently never receive submissions.
`js/contact.js` submits via fetch (urlencoded POST to `/`, Netlify's
documented AJAX pattern) and swaps in the success line — exact copy,
by request: "Thank you for reaching out! If your message requires a
response, we'll get in touch!" Errors (e.g. local preview, where there's
no Netlify to receive it) show an inline fallback with the collaborate@
email. Submissions appear in the Netlify dashboard under Forms;
notification emails can be configured there.

## 4. The story (scrollytelling)

- `#story` is `height: calc(var(--beats) * 100vh)` with `--beats:8` set
  inline; `.pin` inside is `position:sticky` and holds the whole viewport.
- `js/script.js` maps scroll progress through `#story` to the nearest beat
  (0–7), sets `data-beat` on `#pin` (drives background tints, per-beat
  CSS), toggles `.is-active` on `.beat` articles, runs the count-up stat
  animation once per stat, and fills the progress rail.
- **No decorative motifs.** The story used to have a `.motifs` layer —
  four floating SVG icons (files/clock/scale/spark) that faded in behind
  specific beats. Removed entirely (markup in `index.html`, all
  `.motif*` rules and the `@media (max-width:480px) .motif` rule in
  `style.css`) — they visually overlapped the beat text and added no
  informational value. If a future pass wants ambient decoration again,
  don't resurrect this exact approach; position anything decorative well
  clear of `.beats`' text box instead of layered behind/near it.
- **NINE beats now** (`--beats:9` on `#story`; a new intro beat 0 was
  inserted Jul 2026 and every other beat renumbered +1 — all
  `[data-beat="N"]` CSS was shifted mechanically, so grep for the number
  you mean, don't trust old notes): **intro (78% stat)** → **invisible
  litigant** → **pendency queue (5.5 Cr)** → **300 years / the judge** →
  **reimagine (orbits)** → **Kollam / 24x7 ON Courts (orbits continue)** →
  **the film break** → PUCAR turn → initiatives grid → CTA. **TEN beats**
  (`--beats:10`) since the film beat was inserted at 6 and the old 6–8
  became 7–9 (second renumbering; grep, don't trust old notes).
- **Beat 5 — Kollam**: replaced the 75% undertrials stat. Copy: PUCAR +
  Kerala High Court launched 24x7 ON Courts in Kollam, India's first
  fully digital end-to-end court. The beat-4 orbit rings deliberately
  stay visible through this beat (`[data-beat="5"] .orbits`).
- **Beat 6 — the film break (v2: the video is FIXED UNDERNEATH and the
  page scrolls off it).** Revised after "I meant it should be fixed
  behind": `#videoBreak` sits at z-index 2 (the fixed underlayer, visible
  on beat 6), and a `--curtain` custom property on the pin, written by
  `updateFilm()` every scroll frame, drives the reveal: `.film-curtain`
  (full-bleed forest panel, z-index 3, visible beats 5–6) plus
  `.litigant-stage` and `.beats` all `translateY(-curtain·~105vh)` — the
  previous section literally passes up and over the waiting film.
  Curtain mechanics (v4, after "it's weird that the section comes in from
  the top"): TWO panels + a signed content shift. `filmEntryAt` drives
  `--curtain` (the entry panel slides UP across 5.5→5.95 and never
  returns); `filmExitAt` drives `--curtain-exit` (a dedicated exit panel
  parked one viewport BELOW rises to cover the film across 6.15→6.45, so
  leaving reads as the next section arriving naturally from underneath);
  `filmShiftAt` drives `--content-shift` in vh (stage/text ride up to
  −105 with the entry, park off-screen, and return from +105 below with
  the exit — the sign flip happens while parked, never visible). All
  settled deliberately BEFORE the 6.5 boundary so her stage is in
  position when the beat-7 walk-in (with its scroll freeze) fires. At
  curtain==1 with a playable file (`canplay` sets `filmUsable`; missing
  file shows `.video-missing` and never traps), **the film does NOT
  autoplay** (v5 revision, Jul 2026: "let it say click to watch, and the
  video should open full screen"): `.film-ready` on #videoBreak reveals a
  centred "Click to watch the film" pill (`#videoWatch`, white pill +
  green play circle, springs in). Clicking plays WITH sound (real click,
  no autoplay-policy dance) and calls `enterFullscreen()` on the <video>
  (requestFullscreen with webkit fallbacks incl. iPhone's
  webkitEnterFullscreen); `.film-watching` hides the pill. On `ended`:
  exit fullscreen, chrome returns, and the pill comes back reading
  "Watch again". The old muted-autoplay + "Tap for sound" flow is GONE.
  Still **NO scroll lock** beyond the 700ms arrival hold; **leaving the
  zone in either direction pauses the video** and restores the chrome;
  re-entering RESUMES (it only restarts from 0 after a completed watch,
  so a wobble at the zone edge doesn't restart it). Native `controls`
  are on. While the film is the
  centrepiece, `body.film-playing` slides the fixed header UP out of
  frame and the `.progress-rail` DOWN, both gliding back on scroll-away
  (or on `ended`). Scrolling onward crosses into beat 7, whose walk-in
  (own lock) runs; the beat-4 orbits additionally wait for walk-ins to
  finish (`.pin.is-entrance .orbits{opacity:0}`, after the show rule) so
  the rings only appear once she has settled.
  The beat has a near-empty `data-beat="6"` article (sr-only) so the
  engine counts it. Mobile note: the stage's mobile reset is
  `translate:none` ONLY — its `transform` now carries the curtain ride
  and must not be force-reset. **The real film is in place at
  `assets/oncourts-film.mp4`** (60.6 MB, added by Varun Jul 2026; muted
  autoplay, so sound/captions are open decisions). Note: it's over
  GitHub's 50 MB warning threshold (under the 100 MB hard limit), so
  pushes will nag; if the repo gets heavy, move it to Git LFS or host the
  file on a video CDN and point the `<source>` there. **Copy conventions (explicit instructions, Jul 2026): NO em dashes
  anywhere in user-facing copy** (use commas/colons/periods; titles use
  `|`) **and no `[placeholder — verify]` citation sups** — both were
  stripped sitewide, including build-script templates; don't reintroduce
  them. (Content-level placeholders like the sample jobs/events remain.)
- **Beat 4 — "Reimagine justice around the citizen"** (replaced the 10+ yrs
  stat beat): copy asks what changes if processes, rules, and tech are
  designed around the litigant. Design: `.orbits` inside the walker —
  three concentric paper-coloured rings centred on her FEET (top:87% of
  the walker) with solid brand-colour dots (`--green`/`--pink`/`--paper`)
  riding the ring paths; the ring elements themselves spin (varied
  durations, middle ring reversed, one ring carries two dots on opposite
  sides), fade in via `.pin[data-beat="4"]`, travel with her, and stop
  under `prefers-reduced-motion`.
- **Exactly TWO story backgrounds** (explicit instruction with colour
  swatches, Jul 2026 — the old per-beat tints incl. the pink beat are
  gone): beats 0–3 (everything up to and including the judge) are
  `--cream-deep`; beats 4–8 are `--forest` with paper text. The dark half
  carries a full set of overrides extended from what used to be only
  beats 6/8: `.beat-body`/`.beat-eyebrow`/`.beat-stat` (bright `--green`,
  which is dark-bg-only per the palette rule), placeholder-tag/sup
  lifting, paper ground-dots, progress track/fill, the header logo
  light↔dark swap (`body:has` selectors), and the initiative cards
  (restyled paper-on-forest — they used to be ink-on-light).
- **Her resting position sits ABOVE the viewport midline** (fix: "the
  litigant is too low on the page"): `updateLitigantPosition()` applies a
  constant `-12vh` lift on every beat, plus `-6vh` more while centred
  (replacing the old centred-only `-9vh`). The stage's `align-self:center`
  alone had put her mass below centre.
- **Grid auto-placement gotcha (shipped as a bug once — everything "sat at
  the bottom"):** `.judge-stage` is explicitly placed at grid cell (1,1).
  When `.litigant-stage` and `.beats` had only `grid-column` set, grid
  auto-placement refused to drop them into the occupied (1,1)/(1,2) row
  and silently created a SECOND row — the 100vh pin became two stacked
  half-height rows: judge floating in the top half, litigant + beat text
  pushed into the bottom half on *every* beat. Both now carry an explicit
  `grid-row:1` on desktop (overlap is intentional; only one stage is
  visible at a time), and the ≤860px media block explicitly restores the
  real two-row mobile layout (`.beats{grid-row:2}`, judge sized/rowed for
  mobile too). If you add another stage to the pin, give it explicit
  `grid-column` AND `grid-row`.
- **She stays on the LEFT through beats 0–3; after the judge she returns
  by WALKING IN FROM THE CENTRE TOP** (Jul 2026 revision — there is no
  left→centre slide any more at all; earlier iterations panned the stage,
  then walked her sideways, both rejected). Mechanics: `targetCenterT` is
  a STEP (`beatFloat >= 3.45 ? 1 : 0`), and while she's unseen
  (`currentBeat === 3`, where her stage is opacity 0 behind the judge, or
  pre-reveal) `smoothCenterT` snaps instantly — so the horizontal
  reposition to `25vw` happens invisibly. The visible part is
  `playReturnEntrance()`, fired by `setActiveBeat` on a genuine 3→4
  transition: the same `lateWalkIn` drop + `.is-running` hurried gait as
  the beat-0 entrance (shared classes/keyframes), minus the scripted
  bubble; ~2.4s, replays on every 3→4, cancelled cleanly if you return
  to beat 3 mid-drop. Direct flings past beat 3 skip it (she's already
  centred + revealed plainly). The bottom-left text treatment (`.beats`
  full-row rules, §5) starts at `data-beat="4"`.
- **The walker owns her transform** (`.litigant-walker`, a wrapper inside
  the stage holding the figure + her shadow + her speech bubble; JS writes
  `translate(x vw, −6vh·t)` on it every frame). The road (`.path`) stays
  outside the walker, fixed on the left, and is hidden with
  `transition:none` on beats 3–8 — instantly, not faded, because the
  road's base 2s fade let it get caught mid-transition when her stage
  faded back in on beat 4 ("the road briefly fades in and fades out").
  There is no road at all from the judge onward; scrolling back to beat 2
  restores it with the normal soft fade. The constant `-12vh` midline lift lives
  as a CSS `translate` on the stage (mobile resets it with
  `translate:none !important` — `translate` is a separate property from
  `transform`, one reset does not cover the other).
- **Leaving the judge: a Thanos snap, SCRUBBED by scroll — guaranteed
  complete before beat 4 shows, and the wind blows LEFT.** The snap's
  virtual time is a direct function of scroll position across the last
  stretch of his own beat (`JUDGE_SNAP_START..END` = beatFloat 3.22..3.5,
  mapped to 0..`JUDGE_SNAP_TOTAL` virtual seconds) — the "extra space" for
  the animation is the final quarter of his section itself, so at ANY
  scroll speed he is fully dust by the time the beat flips (a fast fling
  past the zone jumps `t` straight to done, no easing lag; see
  `runJudgeDust`). Slow scrolling scrubs the grains away gradually;
  **scrolling back scrubs them back on — he reassembles grain by grain**;
  stopping mid-zone freezes mid-dissolve, consistent with the rest of the
  scroll-driven page. `judgeSeen` stops direct landings on later beats
  from flashing him. Two implementations, chosen in `startJudgeExit()`:
  - **Primary — canvas particle field** (`prepareJudgeDust`/`drawJudgeDust`
    /`runJudgeDust` in js/script.js): while the visitor is still looking
    at beat 3, the judge SVG is serialised → blob URL → offscreen canvas →
    sampled on a 4px grid into ~5k grains. **Prepared AT PAGE LOAD, not on
    arrival at beat 3** (Jul 2026 fix — preparing on arrival raced fast
    scrolls, and losing the race dropped users onto the filter fallback:
    "the old filter sometimes shows up"). This is possible because all
    geometry comes from transform-free layout values — computed
    width/height for the figure, the `offsetLeft/Top` chain up to `.pin`
    for the viewport pads — valid even while the stage is hidden and
    transformed, since at snap time the pin is stuck at the viewport
    origin and the stage's beat-3 translate is 0. The old
    settle-gate/rect approach is gone; the field also rebuilds on
    (debounced) resize, never mid-snap. **No hard swap:** over the
    first .35 virtual seconds `runJudgeDust` cross-fades inline opacities
    — crisp SVG down, grain canvas (on top) up — so the artwork fades
    into the dust; early windward grains fly while the solid figure is
    still visible beneath, reading as dust lifting off him.
    `stopJudgeDust` clears the inline opacities so scroll-back restores
    the intact SVG. **Measurement gate:** the stage
    animates in when beat 3 arrives (translate/scale transition), and
    `getBoundingClientRect` returns the TRANSFORMED box — preparing on the
    beat's first frame once captured him ~6% small and offset, making the
    SVG→canvas swap visibly shrink/shift. `prepareJudgeDust` therefore
    only accepts a rect whose width matches the transform-free computed
    style width (±0.75px), retrying on a 450ms timer until the entrance
    transition has settled. On exit the SVG flips to
    `visibility:hidden` the same frame the visible `.judge-dust-canvas`
    paints every grain at rest (seamless swap). Erosion starts on the
    windward (RIGHT) side — `delay = (W−x)/W·0.5 + jitter` — and each
    grain flies up-and-LEFT (negative vx) with sinusoidal flutter,
    shrinking and fading. The canvas extends to the VIEWPORT's left and
    top edges (`judgeDust.pad`/`padTop`, measured from the stage's rect at
    prepare time; inline width/height/left/top on the element) so the dust
    never hits a visible clip boundary — grains either fade mid-air or
    stream off the actual screen edge. `drawJudgeDust(t)` is a pure function of
    virtual time — that's what makes bidirectional scrubbing free.
    Nothing animates the stage's opacity on this path, or it would fade
    the grains too. Inline-SVG → blob → canvas does NOT taint the canvas
    (same-origin), so `getImageData` is safe; wrapped in try/catch anyway.
  - **Fallback** (`.is-judge-exit-fallback`, canvas prep failed/not
    ready): the `#judgeDissolve` turbulence filter + `judgeDissolveAway`
    keyframes (also drifting left), time-based.
  His speech bubble hides the instant the snap starts (rule after the
  `[data-beat="3"]` show rule — same specificity, source order decides).
  The eight CSS `.judge-dust i` motes land on him first and scatter left
  with him. Under `prefers-reduced-motion` there are no theatrics at all —
  beats 4+ simply hide his stage.
- **His speech bubble is anchored to the stage's top edge**
  (`bottom:calc(100% + 12px)`, not a % `top` offset) — his head sits at
  that edge, so this keeps a constant small gap above his head at every
  screen size; % offsets scaled with the tall bench artwork and drifted
  way too high on large screens.
- **Beat 0 — "No one wants to be in court" (78% Civic Studios stat in the
  body):** she walks in exactly as before (the run-in entrance), in FULL
  colour — no greyscale here (explicit correction: "don't lose colour or
  opacity now").
- **Beat 1 — "To most courts, the litigant is invisible":**
  `.pin[data-beat="1"] #litigant{ filter:grayscale(1); opacity:.5 }` with a
  1.1s transition each way — colour drains as this beat arrives and
  returns as beat 2 begins. Scoped to `#litigant` (id), NOT `.litigant`,
  because the queue clones share the class. `lateWalkIn` carries no
  opacity keyframes precisely so this rule owns the opacity channel.
- **Beat 2 — the pendency queue:** four clones of her figure
  (`buildQueue()` in js/script.js — id/role/aria/defs stripped, coat
  paths `#754a76` recoloured per clone) at `--q-slot` offsets
  ±105 %/±210 % of their own height (a full figure + gap — the old
  ±92/184 overlapped, "positioning seems off"). **They fade in AT their
  slots** with a small settling drift (12% from the arriving side, out
  the other side on later beats) — the old walk-in-from-above choreography
  made front clones cross straight over her ("person slides in over the
  litigant") and is gone. **While the beat is active the whole line walks
  forward in a loop**: `.pin[data-beat="2"]` forces
  `animation-play-state:running` on every figure's walk cycle AND on the
  ground dots / road / shadow — nobody translates, the world scrolls, so
  the loop is seamless with no wrap-around jump.
- **Beat 3 — the judge, "case adjourned to March 2326!!":** she is left
  behind — `.pin[data-beat="3"] .litigant-stage{ opacity:0 }` (must stay
  AFTER `.pin.is-revealed .litigant-stage` in the file; equal specificity,
  source order decides). `.judge-stage` (grid cell 1/1, overlapping hers)
  fades/rises in; the gavel — two `.gavel` groups split out of the
  original compound paths (hand from one path, head+handle from another,
  z-order preserved; same twin-group trick as her `.head`) — swings on a
  2.8s loop (raise 26° → strike −16° → settle → rest) around a wrist pivot
  at `190,300`, and his speech bubble (shared `.speech-bubble` styling,
  `top:-11%` to clear his face) appears via `transition-delay:1.2s`, timed
  to the first strike. Judge asset cleaned into `assets/judge-source.svg`
  (clip ids prefixed `jdg*`, viewBox widened to `30 20 720 980` so the
  swing never clips).
- **Walk state:** on every scroll frame the pin gets `.is-walking`; a 180 ms
  timeout removes it after scrolling stops. All walk animations and the
  ground/path/shadow layers are `animation-play-state: paused` by default
  and `running` only under `.pin.is-walking` — so the whole scene freezes
  mid-pose the moment scrolling stops.
- **Idle state:** `resetIdle()` (js/script.js) is bound directly to the real
  `window` `"scroll"` event (not folded into the rAF-throttled
  `onScrollFrame`, so it fires on the actual scroll signal, not once per
  animation frame). On scroll it removes `.is-idle` from `#pin` and re-arms
  a 10 s timer (`IDLE_DELAY = 10000`); when the timer fires with no further
  scrolling, `#pin` gets `.is-idle` back and the litigant's head looks
  around (`headLook`, see §5 below). **On first page load she starts idle
  immediately** — `pin.classList.add("is-idle")` runs once at the bottom of
  the IIFE, outside the normal 10 s wait, so she's already looking around
  and the speech bubbles below start right when the page opens, not 10 s
  into it. The very first real scroll cancels that initial idle state the
  same way any later one does.
- **Idle speech bubbles:** while `.is-idle` is active, `startBubbles()`
  (js/script.js) schedules a random line from `SPEECH_LINES` to appear
  every 5–10 s (`randomDelay(5000, 10000)`, re-rolled after each line),
  shown for `SPEECH_VISIBLE_MS = 3400` ms via `.is-visible` on
  `#litigantSpeech` (the `.speech-bubble` div inside `.litigant-stage`,
  right before the inline SVG in `index.html`). `stopBubbles()` — called
  from the same `resetIdle()` that removes `.is-idle` — clears both the
  "next bubble" timer and the "hide this bubble" timer and force-hides
  whatever's showing, so scrolling kills a mid-display bubble instantly,
  not just future ones. Bubble scheduling/hiding is entirely decoupled
  from the walk/idle head animation itself — it just happens to share the
  same `.is-idle` trigger condition, per the brief ("only if they stay in
  one place for 10 seconds will the speech bubbles come back"). The
  bubble's CSS lives in style.css right above `.path` — it's `aria-hidden`
  (decorative flavour text) and positioned with a small tail
  (`.speech-bubble::after`) pointing down toward the figure's head, which
  sits in the upper half of the SVG's viewBox.
- **Hand-drawn ("Excalidraw") bubble styling:** the bubble's font is
  `'Comic Relief'` (Google Fonts, linked in `index.html`'s existing
  Fraunces/Source Sans 3 `<link>` — one more `family=` param, no separate
  request). The wobbly-outline look is an SVG filter, not a CSS trick:
  `index.html` defines `<filter id="speechWobble">` right after `<body>`
  (zero-size, `aria-hidden`, renders nothing itself) using
  `feTurbulence` → `feDisplacementMap` to push the shape's pixels around
  slightly, and `.speech-bubble::before`/`::after` in style.css reference
  it via `filter:url(#speechWobble)`. **The filter is deliberately kept
  off `.speech-bubble` itself** — the fill, ink border, shadow, and
  irregular (unequal-corner) `border-radius` all live on `::before`, a
  separate layer behind the actual text, with `::after` as a small
  matching-style tail. If the turbulence filter were applied to the
  element containing the text, the text would wobble/blur along with the
  border, which reads as broken rendering rather than a hand-drawn effect
  — keeping the filter scoped to the empty decorative pseudo-elements
  gets the sketchy outline without touching the type. Both bubble and
  shape carry a slight independent `rotate()` too, on top of the
  turbulence, for extra "drawn free-hand" wonkiness.
- **Bubble size/tilt/jitter:** bubbles are bigger than the original pass
  (`max-width` 180px → 230px, `font-size` .8rem → .94rem, more padding) and
  no longer sit at a fixed angle. `.speech-bubble` uses the independent CSS
  `translate`/`scale`/`rotate` properties instead of one `transform`
  shorthand — deliberately, so the position/size entrance (`translate` +
  `scale`, still driven by the existing `transition`) and a continuous
  rotate-only jitter (`animation`) can run at the same time without
  fighting over the same property. `pickBubbleTilt()` (js/script.js) rolls
  a random `-5deg..5deg` angle into the `--bubble-tilt` CSS variable every
  time a bubble is shown (idle or scripted, see below), and
  `@keyframes bubbleJitter` — running continuously while `.is-visible` —
  oscillates a few degrees around whatever that base tilt is, with
  uneven, non-sinusoidal keyframe spacing so it reads as an unsteady hand
  holding a sign rather than a mechanical wobble.
- **"Running in late" entrance:** plays on every entry into the story from
  the hero (the section-existence check in `onScrollFrame`) and on every
  genuine beat transition back to 0 — it replays every time, not just once.
  `playLateEntrance()` adds `.is-revealed` + `.is-entrance` + `.is-running`
  + `.is-walking` to `.pin`: **`.litigant` (the `<svg>` figure only — NOT
  `.litigant-stage`)** runs `@keyframes lateWalkIn` (a single smooth
  descent from `-70vh`, see below) while `.is-running` speeds the gait
  keyframes up to .35s cycles. As she lands (`ENTRANCE_BUBBLE_DELAY_MS =
  2050`), the speech bubble shows a fixed line — "OMG! I'm so late to get
  to court!" — and stays up ~1.5s (the bubble is anchored to the stage,
  which doesn't descend with her any more, so showing it mid-air would
  leave it floating with no head under it). After `ENTRANCE_MS = 2400` ms,
  `.is-entrance`/`.is-running` come off and `setWalking(false)` stops her
  cleanly.
  - **The dotted road doesn't move during the entrance** (Jul 2026 fix:
    "it looks like the road's moving with her"). The walk-in originally
    animated `.litigant-stage`, whose children include the road (`.path`)
    and shadow — so the road slid down with the figure. Now only the
    figure descends; the road fades in slowly in place, and `pathScroll`
    is paused for the entrance (her motion over a static road sells the
    walking).
  - **Road fade is a `transition` + a play-state longhand, NOT a keyframe
    animation** (fixed "the dotted road jitters a little at the end"): the
    first version put a `pathFadeIn` animation on the `animation`
    shorthand, which displaced `pathScroll` and restarted it from 0 when
    the entrance ended — the dash `background-position` visibly snapped.
    Now `.path` carries `transition:opacity 2s`, `.pin:not(.is-revealed)
    .path{opacity:0}` provides the from-state, and `.pin.is-entrance
    .path{animation-play-state:paused}` (which must stay AFTER
    `.pin.is-walking .path` in source order — equal specificity) pauses
    the dashes without ever touching their clock.
  - **The shadow doesn't exist until she lands** (fixed "her shadow shows
    up in place before her"): `.pin:not(.is-revealed) .shadow` and
    `.pin.is-entrance .shadow` hold it at `opacity:0`; it fades in via
    `.shadow`'s own .7s transition when `.is-entrance` comes off, right
    as she arrives. This required making `shadowPulse` **transform-only**
    — it used to animate opacity too, and even a paused animation
    overrides the element's opacity declarations, which is exactly why
    the shadow couldn't be hidden before.
  - **Her descent speed is matched to her feet** (Jul 2026 fix: "she
    slides in faster than her feet are moving"). At desktop size the
    figure renders ~0.6× its viewBox, so one .35s run cycle strides
    ~100px of ground → credible speed ≈ 285px/s → the ~630px (`-70vh`)
    travel takes 2.2s, with a near-linear bezier (a strongly decelerating
    curve would desync the constant cadence at both ends). The full
    arithmetic lives in the CSS comment on `.pin.is-entrance .litigant`;
    rebalance duration/cadence/distance together or she reads as sliding
    (too fast) or moonwalking (too slow).
  - **Scroll IS locked during walk-ins — by explicit request, and it has
    flip-flopped, so know the history before changing it again.** The
    original entrance locked scroll; that lock was removed as half of a
    "super jerky" complaint; then it was explicitly requested back ("can
    we lock scroll until the litigant moves in? Same in the other section
    where the litigant moves in after the judge"). `lockScroll()`/
    `unlockScroll()` (body.scroll-locked → overflow:hidden) wrap BOTH the
    beat-0 entrance and the post-judge return (~2.4s each). Release paths
    — all of them matter: the entrance/return end timers,
    `derevealLitigant()` (scrolled back to the hero mid-entrance),
    the `setActiveBeat` return-cancel branch (back to beat 3 mid-drop),
    and `cleanJumpTo()` (nav clicks must scroll, and `scrollIntoView`
    can't move an overflow:hidden viewport). No lock under
    `prefers-reduced-motion` (nothing to wait for).
  - **Exactly two keyframes in `lateWalkIn` — the other half of the old
    "super jerky" fix.** CSS easing applies **per keyframe segment**, so
    the original four-stop version (`-70vh → -16vh → +3vh → 0`)
    decelerated into and re-accelerated out of every intermediate stop —
    three visible hitches. It's a single `0% → 100%` segment now, one
    continuous descent. No opacity fade either: she starts fully opaque
    but clipped above the pin's `overflow:hidden` edge, so she appears by
    walking into frame rather than fading.
  - **She's invisible until she "arrives," not just off-screen.** Revised
    after the first pass read as "doesn't seem to walk in" — a small
    horizontal slide on an already-opaque figure just wasn't a legible
    entrance. `.litigant-stage{ opacity:0; }` is the default state —
    she's not present at all until something reveals her.
    `.pin.is-revealed` is the only thing that ever does that.
    `.pin.is-entrance` layers `@keyframes lateWalkIn` on top of that reveal
    while it's active — she fades in and drops down from 220px off-screen
    at the top, landing (with a slight overshoot past the resting line,
    read as skidding to a stop) exactly where `.litigant-stage` already
    has her positioned. Every later beat-0 arrival re-adds `.is-entrance`,
    restarting the keyframes from their `0%` (`opacity:0`) — so she
    genuinely vanishes and walks back in from the top *every* time, not
    just the first.
  - **`.is-revealed` is no longer permanent — she ceases to exist at the
    intro hero.** (Jul 2026 revision, explicit instruction: "the litigant
    should be invisible or non-existent if I'm on the first section", and
    the walk-in "should happen not just on the first load".) A
    scroll-position check in `onScrollFrame` — not a beat-transition check,
    because `currentBeat` sits at 0 both at the hero AND at the story's
    opening beat, so `setActiveBeat` can never see a hero→story crossing —
    now drives her existence: while `story.rect.top > 50vh` (the hero owns
    the screen), `derevealLitigant()` strips `.is-revealed` and cancels any
    in-flight entrance (timers, classes, bubble). When the story pins
    (`rect.top <= 1`) and she isn't revealed: `beatFloat < 0.5` →
    `playLateEntrance()` (the run-in, replaying on *every* hero→story
    entry); otherwise → `revealLitigantPlainly()` (fast fling / jump landed
    mid-story, nothing to hang a run-in on). Verified with a jsdom
    simulation: invisible at load, entrance on entering the story, gone
    again back at the hero, entrance replays on re-entry, plain reveal on
    a hero→mid-story fling.
  - **Why the opacity/drop-in targets `.litigant-stage` and the vertical
    motion uses `translate`, not `transform`:** `.litigant-stage`'s
    `transform` is exclusively owned by `updateLitigantPosition()`,
    rewritten inline every animation frame to drive the scroll-linked
    side→centre motion — a CSS animation/transition on that property would
    just get overwritten the next frame (same reasoning as the mobile
    safety-net comment further down). The independent `translate` CSS
    property doesn't have this problem: per spec it composes with
    `transform` rather than overriding it (final position = the
    independent `translate`/`rotate`/`scale` properties combined with the
    `transform` property's own function list), so `@keyframes lateWalkIn`
    can drive her vertical drop-in via `translate` while
    `updateLitigantPosition()`'s inline `transform` keeps driving her
    horizontal beat-based position, with zero conflict between the two.
  - **First real-browser bug: the travel distance was much too small to
    actually leave the frame.** `.litigant-stage` is `align-self:center`
    inside `.pin`, which is exactly `100vh` tall with `overflow:hidden` —
    so her resting position already sits roughly `50vh` down from the
    pin's (clipped) top edge. The first version of `@keyframes lateWalkIn`
    started her at a fixed `-220px`, which on a typical 800–1000px-tall
    viewport barely nudges her off that centred spot and never actually
    crosses the pin's clipped top boundary — so nothing visibly left the
    frame, and the whole animation just read as a small in-place wobble
    rather than "walking in from off-screen." Fixed by switching to a
    viewport-relative `-70vh` starting offset, which reliably lands her at
    roughly `50vh - 70vh = -20vh` from the pin's top — genuinely clipped
    out of view — regardless of screen height, since it's proportional
    rather than fixed. Total duration also went from `.62s`/`.75s` up to
    `.95s` to give the now much more visible travel room to read clearly
    rather than blur past.
  - **Fallback for a case the walk-in can't cover:** if the user's very
    first real scroll is fast/far enough to skip beat 0 entirely (landing
    straight on, say, beat 3), nothing would ever add `.is-revealed` and
    she'd stay invisible for the rest of the visit. `setActiveBeat` in
    js/script.js checks for exactly this — first real scroll, index isn't
    0, `.is-revealed` isn't already set — and calls
    `revealLitigantPlainly()`, a plain CSS-transition fade-in with no
    walk-in theatrics (there's no "arriving at beat 0" moment to hang one
    on in that case).
  - **`hasScrolledOnce` guard, and a page-load gotcha it had to work
    around:** the entrance must not play before the user has scrolled
    even once (she shouldn't be "late" before anyone's left the intro
    hero). The obvious guard is a flag set by the existing real-`"scroll"`
    listener already bound to `resetIdle()`. But `setActiveBeat(0)` also
    runs once synthetically at page load, purely to render the correct
    initial DOM state — that call leaves `currentBeat` at `0` before any
    real scrolling happens, which meant the very first *real* scroll into
    beat 0 saw `index(0) === currentBeat(0)`, hit `setActiveBeat`'s early
    return, and never registered as a transition — so the entrance would
    never fire for what should be its most important trigger, the user's
    actual first arrival. Fixed by resetting `currentBeat = -1` right
    after that initial synthetic call, so the first genuine scroll-driven
    `setActiveBeat(0)` is seen as a real change again.
  - **A second, subtler bug this surfaced:** the ordinary 180 ms
    `walkTimeout` (armed by `onScrollFrame` on every real scroll frame,
    including the one that triggers the entrance) would call
    `setWalking(false)` and strip `.is-walking` at 180 ms — long before
    the ~1.6s entrance ends — freezing her mid-stride for the rest of the
    entrance. `setWalking(false)` now no-ops while `.is-entrance` is
    present; `playLateEntrance()`'s own end-of-entrance `setWalking(false)`
    call still works because it removes `.is-entrance` on the line right
    before calling it.
  - Verified end-to-end with a jsdom simulation: `.is-revealed` absent at
    page load (invisible), no entrance fires before any scrolling, the
    actual first scroll into beat 0 both reveals her and fires the
    walk-in, `.is-walking` confirmed still present at t+300ms (would have
    been false with the walkTimeout bug), everything cleaned up by
    t+1800ms, `.is-revealed` still present afterward (permanent), the
    fallback (`revealLitigantPlainly()`) fires instead when the first
    scroll skips beat 0 and lands on a later beat directly, and the
    walk-in re-fires on scrolling back up into beat 0 later.

- **Clean jump past the story ("Collaborate"):** `<html>` has
  `scroll-behavior: smooth` globally, so a plain anchor link to a section
  that comes *after* the 8-screen-tall `.story` — namely `#collaborate` —
  used to make the browser natively smooth-scroll straight through the
  entire story to get there. Since every beat's background colour, the
  litigant's walk-cycle, and the count-up stat animations are all driven
  by live scroll position, that fast native scroll dragged the visible
  page through every beat in well under a second: a flickery, "fast-
  forwarded" flash rather than a clean jump. It could also trigger
  `playLateEntrance()` if the fast scroll passed through beat 0 mid-flight
  — run-in theatrics on a section the user is deliberately skipping past.
  (This used to be worse: the entrance once locked scroll, which could
  fight the browser's own scroll animation; the lock is gone now but the
  guard is still right.)
  - Fixed in js/script.js: every `a[href="#collaborate"]` (there are two —
    the intro hero's button and the nav link) gets a click handler that
    calls `preventDefault()` and does `cleanJumpTo("collaborate")` instead,
    which calls `scrollIntoView({ behavior: "instant", block: "start" })`.
    **`"instant"`, not `"auto"`** — the first version of this used `"auto"`,
    which per spec means "defer to the element's computed CSS
    `scroll-behavior`," not "skip the animation." Since `html` has
    `scroll-behavior: smooth` set globally, `"auto"` was silently
    inheriting that and *still* smooth-scrolling the whole way through —
    the exact bug this fix was supposed to remove, just not caught until
    it was tested in a real browser (a jsdom check only confirms *that*
    `scrollIntoView` gets called with some options object, not what a real
    browser does with a given `behavior` value). `"instant"` unconditionally
    overrides the CSS and jumps in one step, with no intermediate mid-story
    frame ever rendering.
  - `isJumpingToSection` is set `true` for 300ms around that jump (long
    enough for the jump and any resulting scroll/resize events to settle)
    and checked at the top of `playLateEntrance()`, which now bails out
    immediately if it's set — closing off the scroll-lock-fighting-a-jump
    risk entirely, not just making it rarer.
  - Scoped deliberately to only the two `#collaborate` links. The nav bar
    also has `#initiatives` and `#cta` (`Get in touch`), which point *into*
    the story (beats 6 and 7) rather than past it — clicking those from the
    top would cause the same flash-through for the beats before them, but
    that's arguably more defensible since those sections *are* part of the
    story. Left as native smooth-scroll for now; revisit if that turns out
    to feel just as wrong.
  - Verified with a jsdom simulation that clicking either `#collaborate`
    link calls `preventDefault()` and `scrollIntoView` with
    `behavior:"instant"`. Worth flagging for next time: this check only
    confirms the *call*, not what a real browser does with a given
    `behavior` value — that's exactly how the `"auto"` bug above shipped
    without the automated check catching it. Actually confirming scroll
    behaviour end-to-end needs a real browser, not jsdom.
- **Occasional "dread" head-shake:** `showSpeechBubble()` calls
  `maybeShakeHead()` every time a bubble appears, which only actually
  triggers `DREAD_CHANCE = 0.25` of the time (~1 in 4 bubbles) — deliberately
  infrequent, per the brief ("don't make it too often"), so it reads as an
  occasional flourish rather than a tic. When it fires, `.is-dreading` is
  added to `#pin` for `DREAD_MS = 950` ms, which runs `@keyframes headShake`
  (style.css, right after `headLook`) on the same two `.head` groups the
  idle look-around uses — a few quick side-to-side rotations that damp down
  to rest, as though she's dreading whatever the bubble just said. The
  `.pin.is-dreading .litigant .head` selector has identical specificity to
  `.pin.is-idle .litigant .head` (4 classes each) and is declared later in
  the stylesheet, so it wins outright while `.is-dreading` is present, then
  yields back to the looping `headLook` the instant the class is removed —
  no animation-priority hacks needed. `stopBubbles()` also clears the dread
  timer and force-removes `.is-dreading`, so a scroll mid-shake cancels it
  immediately, same as it does the bubble itself.

## 5. The litigant figure (SVG anatomy + animations)

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
in grid column 1 and slides to viewport centre from beat 2 onward, now via
`transform: translate(25vw, -9vh)` (desktop only; disabled on mobile ≤860px,
single column) — the `-9vh` lift was added because the text used to sit
vertically centred in grid-column 2, which put it right where she now
stands once centred. From beat 2 on (desktop, `min-width: 861px`), `.beats`
itself switches to `grid-column: 1 / -1; align-items: flex-end;
justify-content: flex-start;` — spanning the full row and pinning to the
bottom-left — so it stays clear of her raised, centred position instead of
overlapping it. Grid items are allowed to overlap in CSS Grid; this relies
on spatial separation (her up top, text at the bottom-left) rather than
z-index to avoid collision, so if either the lift or the text's
bottom-padding (`9vh`) changes, sanity-check they still clear each other at
common viewport heights.

`prefers-reduced-motion` disables every figure/layer animation.

### 3.x Logo assets, the header swap, and favicon

Real PUCAR marks live in `assets/` (uploaded directly by Varun into the
project folder, not through chat — pasted chat images never arrive as
readable files here, only actual attachments/uploads do):
- `pucar-normal-expanded.png` — full green wordmark + tagline, for light
  backgrounds, desktop.
- `logo-pucar-green.avif` — green "PUCAR" only (no tagline), for light
  backgrounds, mobile.
- `pucar-white-expanded.avif` — full white wordmark + tagline, for dark
  backgrounds, desktop. Also the footer logo everywhere (footer is always
  navy) at `.footer-top .logo-long`, capped at 22px tall.
- `pucar-white-short.png` — white "PUCAR" only, cropped via PIL off the full
  white asset's alpha channel (found the gap between the wordmark and the
  tagline programmatically rather than eyeballing pixel coordinates), for
  dark backgrounds, mobile. Also `.footer-top .logo-short` below 640px.
- `pucar-new-favicon.png` — 500×500, THE favicon (single `rel=icon` +
  `apple-touch-icon` in index.html and pageShell). The old set
  (pucar-favicon-dp / favicon-32 / favicon-16 / favicon-apple-touch) was
  deleted in July 2026.

The header logo (`.site-header .logo`) has no pill/background — it sits
directly over whatever's scrolled underneath the fixed header. Four `<img>`s
sit stacked in the DOM (`.logo-light-long`, `.logo-light-short`,
`.logo-dark-long`, `.logo-dark-short`), and two independent, orthogonal CSS
mechanisms decide which one shows:
- **Colour** (light vs dark mark): `body:has(.pin[data-beat="5"])` /
  `[data-beat="7"]` (the two dark story beats) toggles `.logo-light` opacity
  to 0 and `.logo-dark` to 1, transitioning over .6s to match `.pin`'s own
  background-color transition. Pure CSS, no JS. Job/contributor pages never
  match those selectors (their background is cream throughout), so they
  always stay on the light colourway.
- **Length** (long vs short): a `@media (max-width: 640px)` query (the same
  breakpoint `.site-nav` collapses at) hides the `-long` variants and shows
  the `-short` ones, independent of which colourway is active. Same pattern
  in the footer, just without the colour axis since it's always dark there.

**Specificity gotcha, already hit once:** the toggle selectors for length
must be `.site-header .logo img.logo-light-short` (2 classes + `img`), not
just `.site-header .logo-light-short` (2 classes, no `img`) — the base rule
`.site-header .logo img{ display:block }` is itself 2 classes + `img`, so a
toggle selector without `img` loses the specificity fight and `display:none`
never applies, showing both lengths stacked side by side at once. If you add
a fifth logo variant or touch this again, keep the `img` in every toggle
selector that needs to beat that base rule.

If any of these five files are ever regenerated, keep the pipeline in mind:
ImageMagick's AVIF decoder on this box silently drops the alpha channel
(reports `Type: TrueColor`, not `TrueColorMatte`) — use `pillow-heif` +
Pillow instead (`register_heif_opener()`) if you need to inspect or
recompose any `.avif` here.

Favicon links (`<link rel="icon">` ×2 + `apple-touch-icon`) are in both
`index.html`'s `<head>` and the `pageShell()` template in
`scripts/build-jobs.js`, plus manually patched into the already-generated
`/collaborate/*/` and `/contributors/*/` pages (build script still can't run
cleanly in this sandbox — see §6.4).

## 6. Collaborate board

### 6.1 Why it's built this way (decision log)

Requirement: job cards on the homepage opening a modal, where each job has a
**crawlable deeplink** (link-preview bots and most crawlers don't run JS), on
Netlify free tier. Options considered: Supabase+Functions (rejected: extra
moving parts, free-tier pausing, client-side fetches aren't crawlable),
plain JSON+build (chosen as the base), Decap CMS on top (chosen: user wanted
an editing UI). Everything is pre-rendered static HTML; the modal is pure
progressive enhancement over real pages.

### 6.2 Content model — content/jobs/*.json

**Title convention: every card title is a "How might we …" statement
relating to DRISTI 2.0** (explicit instruction, Jul 2026) — e.g. "How might
we make DRISTI 2.0 work for a litigant on a 2G phone?". Keep new postings
in that form; the role/deliverable itself lives in `summary` and `body`.

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

### 6.3 Content model — content/contributors/*.json

Filename = slug = URL (`/contributors/<slug>/`). Fields: `name`, `role`,
`organisation` (affiliation shown after role with a `·`; also intended as the
filter key for the upcoming contributors page), `photo` (optional; empty →
initials avatar, background hue hashed from the name), `email`, `links[]`
({label,url}), `published`, `body` (bio markdown).

In July 2026 every contributor's LinkedIn profile was visited and used to
fill `role` (current designation) and `body` (a 3-4 sentence bio). Three
profiles 404'd (aishwariya-dixit, madhav-pudipeddi, shreyashi-soni) and carry
short org-only bios flagged as intentionally brief. Names were corrected to
LinkedIn spellings where pucar.org differed (Nandalike, Roongta, Bharat Chugh,
Susmita Behera, and others).

77 real contributors were scraped from https://pucar.org/about (July 2026)
via `scripts/import-pucar-contributors.js` (one-off, safe to re-run; data is
inlined in the script). For those entries `role` and `body` are empty,
`organisation` carries whatever the pucar.org card showed (mostly org names,
sometimes a role like "Lawyer" or "Technology Architect"; Sarfraz Alam has
neither), `links` has their LinkedIn, `source` is "pucar.org/about", and
`photo` points at `/assets/contributors/<slug>.<ext>` once
`scripts/mirror-contributor-photos.js` has been run locally (needs internet;
the sandbox cannot reach framerusercontent.com). Until then it hotlinks
framerusercontent.com.

### Header nav: dropdowns, glass pill, gliders, dark-half flip

The homepage nav is now: The Journey · About (dropdown) · Community
(dropdown, renamed from "Collaborate" July 2026; trigger still jumps to
#collaborate), plus the Get in touch CTA. Both dropdowns use `.nav-drop` +
`.nav-menu` (hover / focus-within, opening is pure CSS) with a caret SVG
(`.nav-caret`) that rotates 180° when open. A ::before bridge covers the 8px
gap so the menu survives the mouse travelling to it. Nav is display:none
under 640px as before.

- Collaborate menu: "Active Collaborations" (Advance the DRISTI 2.0 stack →
  /contributors/#dristi, Explore the Supreme Court's AI policy →
  /contributors/#policy) and "More" (About Contributing → /contributors/,
  Meet the Contributors → /contributors/#contributors). See §6.3c below —
  this whole section was consolidated into one page in July 2026.
- About menu: About PUCAR → /about/, Meet the Team → /about/#team.

Styling: the nav container is a frosted-glass pill (blur+saturate backdrop,
hairline border, inset top highlight). js/script.js (homepage only) injects
`.nav-glider` -- a pill that SLIDES between top-level links on hover/focus
(nav gets `.has-glider`; the CSS :hover background stays as the fallback for
generated pages, which don't load script.js). Each dropdown menu gets its own
`.menu-glider` doing the same between menu items. Gotcha encountered: the
has-glider "background:transparent on hover" override must be scoped to
TOP-LEVEL pills (`> a`, `> .nav-drop > a`) or it kills the menu items' hover
background.

Dark-half flip: over story beats 4-9 (`body:has(.pin:is([data-beat=...]))`,
same mechanism as the logo/CTA swaps) the pill turns dark glass with light
text, gliders/hovers switch to brand green with dark (--forest) text, and the
dropdown panels flip to a dark panel (#0E1B21) with light text. All colour
rules are scoped with child combinators so panel items never inherit the
pill's light-on-dark colours.

### About + Team pages

`aboutPage()` and `teamPage()` in the build script generate /about/ (content
adapted from pucar.org/about: What we do, Why PUCAR, How we work, How we
organise) and /team/ (REAL team as of Jul 2026, see below). Both in the
sitemap; homepage footer About link points to /about/.

**About page visual pass (Jul 2026):** the page was a single unbroken prose
column top to bottom (user feedback with a screenshot of the live page: "can
use a better layout that looks more visual"). Restructured around three
visual beats, `aboutPage()` in build-jobs.js, without inventing or dropping
any copy:
- **`.about-stats`**, right under the title: three big serif numbers pulled
  out of the prose below rather than left buried in sentences -- "100+"
  contributors and "2023" founded are literals matching the existing prose
  claim (NOT `contributors.length`, which is only 77 -- how many of PUCAR's
  100+ people have a profile built out on this site so far, see §6.3; using
  it here would understate the real, sourced number). The third stat, open
  roles, IS computed live from `boardJobs.length` -- the exact same list the
  homepage board renders, so it can never drift out of sync with what's
  actually posted, and simply omits itself (`openRoles ? ... : ""`) if the
  board is ever empty rather than showing a hollow "0".
- **`.about-steps`**, replacing "How we work"'s three bold-lead-in
  paragraphs: a numbered 3-card grid (`01/02/03` in an outlined display
  numeral, `-webkit-text-stroke` with a `@supports` fallback to a solid
  colour where that's unsupported). The section heading reuses
  `.job-body.prose`'s h2 styling (display face + green rule) via a wrapper
  div carrying the same classes but zero `<p>` children -- purely to dodge
  the drop-cap rule, which is scoped to `.prose p:first-of-type` and has
  nothing to attach to when there's no paragraph in the block.
- **`.about-strip`**, right before the CTAs: the homepage's `.collab-strip`
  photo-stack component, reused wholesale but as a single clickable `<a>`
  card with rounded corners (the homepage version is a full-bleed div,
  appropriate for a page-width bridge; here it sits inside the contained
  `.job-main` column, so `.strip-btn` becomes a `<span>` -- an `<a>` can't
  nest inside another `<a>` -- and lifts on hover of the whole card via
  `.about-strip:hover .strip-btn` instead of its own hover). Unlike the
  homepage (JS-populated client-side, see "Waving contributor heads"
  below), the avatars here are picked and written at BUILD TIME: every
  published contributor with a photo, evenly sampled down to 6 (`stripStep
  = floor(withPhotos.length / 6)`), so the page stays fully crawlable and
  needs no extra client script.
- A second `.prose` block ("How we organise") sitting after the step grid
  would otherwise get its OWN drop cap (the rule is scoped per `<article>`,
  not per page) -- a giant dropcap on one short paragraph read as too much,
  so that block carries an extra `.no-cap` class,
  `.job-body.prose.no-cap p:first-of-type::first-letter{ all:unset; }`.
- **Regeneration note:** `build-jobs.js` can't run directly against this
  repo in this sandbox -- `fs.rmSync` on `about/` (and every other generated
  directory) hits the same FUSE-mount EPERM already documented for git's
  lock files (§7). Worked around by copying the whole repo to a scratch
  directory, monkey-patching `fs.rmSync` to a no-op (every subsequent write
  in the script is a plain overwrite of an existing file, which the FUSE
  mount does allow -- only *deleting* is blocked) and running the real
  script there, then diffing the copy against the real repo to confirm
  `about/index.html` was the only file that actually changed before copying
  it back by hand. If the script is ever run from a real machine, both will
  already match.

### Resources page

resourcesPage() in the build script generates /resources/: PLACEHOLDER
intro + three anchored sections (#blog, #data-resources, #learning-circles)
matching the Community nav dropdown's Resources group. All copy is
holding text to replace as the community publishes. In the sitemap.

### Beat 8 syncs with the bulletin board

Beat 8 ("Live right now / Work you can walk into today.") shows the SAME
items as the hero bulletin board. js/script.js rebuilds its
`.initiative-grid` from `.intro-board .board-note` at load (titles, subs with
trailing arrows stripped, hrefs, numbering), so the board is the single
source of truth; static markup mirrors the two current items as a
no-JS/SEO fallback. The old static "our initiatives" cards are gone.

### Film arrival scroll hold

Arriving at the film beat (either scroll direction) locks scroll for 700ms
(js/script.js, filmHoldTimer -- history: 2000ms -> 1000ms -> 700ms, all
explicit requests). Scoped by filmLockActive so releasing it can never
clobber a walk-in's own lock; skipped under reduced motion.

### Waving contributor heads (beats 7-9)

js/script.js (near the end) spawns circular contributor mugshots into
#hiStream (markup in index.html inside .pin). Current behaviour, in full:

- STARTS ON BEAT 7 ("All of this is possible because of collaborators like
  you" -- the heads ARE the collaborators arriving with that line; started
  at 9, moved to 8, then 7, all explicit requests) and runs through beat 9.
  On start it SEEDS 4 bubbles mid-flight (anim.currentTime advanced to
  15-70% of the duration) so the parade is already crossing when the CTA
  appears, then spawns another every 1.3s. A MutationObserver on #pin's
  data-beat drives start/stop; leaving beats 7-9 clears every bubble.
- Each bubble enters from the left TINY and grows to ~100px as it crosses
  (WAAPI: translateX -120px -> 105vw with scale .12 -> 1, linear, 9-17s);
  an inner .hi-bob adds the sine bob (randomised 2.1-3.7s), confined to
  top:66-86% (lower third of the section). Self-removes on finish.
- The 👋 sits to the LEFT of the head (the emoji's palm angle reads as a
  hand reaching out of the photo) and waves CONTINUOUSLY (hiWave: smooth
  -8deg..26deg swing, .9s, no rest phase -- the earlier version shook then
  paused, explicitly rejected). It scales with the head because the scale
  lives on the parent transform.
- Hover: paper tooltip (.hi-tip, name + organisation, arrow ::after) and
  the bubble slows to playbackRate .25 WITHOUT stopping; mouseleave
  restores 1. Each bubble is an <a> to that person's /contributors/<slug>/
  profile (photos.json carries url; aria-label on the link, and #hiStream
  is NOT aria-hidden for that reason). Hover/focus rings the photo green.
- GOTCHA that broke tooltips once: .beats spans the whole pin at z-index 6
  and swallowed hover meant for the heads at z 4. .beats is now
  pointer-events:none; .beat stays none and .beat.is-active restores auto,
  so the active beat's buttons/links still work. Don't undo this.
- Data: contributors/photos.json, emitted by the build script as
  [{src,name,org}] from published contributors with photos (script.js also
  tolerates the older plain-string arrays).
- Skipped under prefers-reduced-motion; no spawns while document.hidden.
  Layer z-index 4: over film curtains (3), under stages (5) and text (6).

### /sc-ai-policy/: CIVIS callout + live count

Below the intro CTAs sits .civis-callout (forest gradient panel with a green
glow) whose .civis-btn links to the CIVIS consultation
(civis.vote/consultations/1575/read). js/perspectives.js fetches the live
respondent count from https://api.civis.vote/graphql
(query: consultationProfile(id:1575){consultationResponsesCount} -- field
name verified against the open-source civis-vote/civis-frontend repo; the
API serves CORS to any origin) and fills #civisCount under the button
("N people have already responded on CIVIS", green dot ::before). Fails
silently; count line stays hidden if the API is down.

### Editorial "prose" treatment

.job-body.prose (About page + sc-ai-policy intro, class added in the build
script) = drop cap on the opening paragraph (Fraunces, forest), a larger
lede first paragraph, looser rhythm, and display-serif h2s with a short
green rule. Pages containing .prose widen via
`.job-main:has(.job-body.prose){max-width:880px}` (base .job-main is 720px).
The policy intro deliberately has NO bold spans (user: "I don't like the
random bolding"); the About page keeps its bold lead-ins on the How-we-work
points. Short bios/job pages are untouched (opt-in class).

### About page layout (v3, July 2026)

Structure: title -> stat panel -> "What we do" MISSION STATEMENT
(.about-what: eyebrow + display-type first paragraph with 'unstucks'
green-underlined, supporting second paragraph, NO drop cap -- "key
information about us, don't treat like other pages") ->
full-bleed PARALLAX band (assets/pucar-drawing.jpg) ->
FULL-BLEED dark "Why PUCAR?" band (no vertical margins: the parallax bands
sit flush above and below it) -> second PARALLAX band
(assets/pucar-group-shot.avif) -> How we work 3-card grid -> How we
organise -> photo strip -> CTAs. The stat panel is a forest gradient card
(paper numbers, green uppercase labels; open-roles count computed from
boardJobs). The Why band (.about-why) closes the page's <main> and reopens
a .job-main.about-lower div (same hidden-main swallow trick as sc-ai-policy)
so it can bleed edge to edge; its second paragraph is a display pull-quote
with "100+ contributors" in green. All copy is unchanged from pucar.org.

### About: funding contributors wall

Bottom of /about/: "Funding Contributors" static logo wall (.funder-grid,
NO animation by request). The 14 funders were identified visually from
pucar.org/about's funding ticker (list inlined as FUNDERS in the build
script). Logos are referenced at /assets/funders/<slug>.png -- run
`node scripts/mirror-funder-logos.js` LOCALLY once to download them
(the sandbox cannot reach framerusercontent.com); until then the images 404.

### About parallax bands

js/nav.js translates EVERY .about-parallax-img with scroll progress (the
layer has 20% vertical headroom, factor 0.16, rAF-throttled, skipped under
reduced motion, plain cover image without JS). Two bands currently:
pucar-drawing.jpg after What-we-do, pucar-group-shot.avif after the Why
band, both flush against the dark section.

### Participate event cards (sc-ai-policy)

The participate section is now a DARK .collaborate shell
(class="collaborate participate") and eventCard() renders each event as a
frosted .collab-card that is ONE BIG LINK (<a class="collab-card
event-card">): city in .collab-cat, date-time in .collab-status, title,
venue line, summary, divider + "Register interest" .collab-btn pinned
bottom-left. Two earlier designs were rejected (dark-header-band "not
clickable enough"; white glow cards "too different from existing cards") --
the instruction is match the COLLABORATE cards. The "Email the AI Committee"
suggestion card was removed; the two events carry realistic dummy details
(8 and 11 July 2026) to confirm before launch.

### Event card tags: pin/calendar icons + a real contrast fix

The sc-ai-policy participate section's event cards showed their city and
date/time as barely-visible pills (user report, with screenshot). Two
separate things were wrong:

- **`.collab-status` was never actually meant for a dark background.** Its
  base rule (`rgba(36,30,26,.12)` bg, `color:inherit`) is a *dark*-tinted
  pill, designed for the light job/contributor pages that also use it (they
  fine-tune the exact alpha via `.job-page .collab-status`/`.contrib-jobs
  .collab-status` overrides, but the base itself already assumes a light
  backdrop). `eventCard()`'s date/time pill uses the same class inside the
  dark `.collaborate.participate` section, where a near-black 12%-opacity
  background is close to invisible — same latent bug already existed for the
  homepage board's "Assigned/Completed" job-status badge, just rarely
  triggered since most listed jobs are Open. Fixed with `.collaborate
  .collab-status{ background:rgba(251,248,242,.14); color:rgba(251,248,242,.9); }`
  — the same light frosted treatment `.collab-cat` already uses by default —
  scoped to any `.collab-status` living inside a `.collaborate`-classed
  section (covers the homepage board, the participate event cards, and the
  perspectives cards' outlet pill, which shares the same section wrapper).
- **Icons added as a second, non-colour cue**, not just a contrast fix: a pin
  glyph before the city (`.collab-cat`) and a calendar glyph before the
  date/time (`.collab-status`), inline SVG in the same style as the existing
  `.nav-home` icon (16x16 viewBox, `stroke="currentColor"`, `aria-hidden` —
  no icon library on this site, see §9). `.tag-icon` + `display:inline-flex;
  gap:5px` were added to the base `.collab-cat`/`.collab-status` rules so the
  icon lines up with the text; harmless everywhere else those classes render
  text-only, since there's no icon child to lay out.
- `eventCard()` in `scripts/build-jobs.js` emits both icons now (`PIN_ICON`/
  `CALENDAR_ICON` constants, reused for both events). The build script can't
  run cleanly in this sandbox (EPERM on `rimraf` when it tries to clear
  `collaborate/`, same limitation noted in §6.4/§3.x for the favicon links),
  so the already-generated `sc-ai-policy/index.html` was hand-patched with
  the same markup the build script would now produce — if the script is ever
  rerun from a real machine, both should stay in sync.
- **Follow-up 1 (didn't fully fix it): tried switching `.collab-cat`'s text
  from a translucent `rgba(251,248,242,.9)` to a fully opaque
  `color:var(--paper)`, on the theory that the alpha version was reading dim/
  warm against varying dark backdrops.** Also bumped the pill background
  `.14`→`.18` opacity, added a `1px` border, and gave `.job-page`/
  `.job-modal-panel .collab-cat` (the real light-bg override, see below) an
  explicit `border-color` reset. This landed alongside the `.collab-status`
  fix but the city tag was still reported unchanged — because opacity was
  never the actual bug (see follow-up 2).
- **Follow-up 2 (the actual root cause): `sc-ai-policy`'s `<body>` carries
  the SAME shared `class="job-page"` wrapper every generated page uses for
  its nav/footer chrome** (`pageShell()` in the build script — the class
  name is generic "this is a generated static page," not literally "this
  page is a job listing"), **even though the page itself mixes a light
  section (the intro) with dark ones that reuse `.collaborate` wholesale**
  (`.persp-section`, `.participate` — see the event-cards note above).
  `.job-page .collab-cat` (2 classes) is a light-background override meant
  for real job detail pages, and it was silently winning over the plain,
  1-class, dark-intended base `.collab-cat` rule *purely on specificity* —
  it doesn't know or care that the actual backdrop here is dark, only that
  it's inside something classed `.job-page`. That's what painted the city
  tag in `--ink-soft` (a dark warm brown, `#55493F` — exactly the "off"
  colour reported), while the date/time pill escaped it because no
  equivalent `.job-page .collab-status` rule exists. Fixed with a 3-class
  re-override, `.job-page .collaborate .collab-cat, .job-modal-panel
  .collaborate .collab-cat`, which wins back the dark treatment specifically
  when a `.collab-cat` sits inside a `.collaborate` section, regardless of
  which body class wraps the page. **General lesson for this codebase: any
  future `.job-page .foo`-style override needs to be checked against every
  page that carries the `.job-page` body class, not just the literal job/
  contributor pages it was written for** — `sc-ai-policy` is the one
  generated page that mixes light and dark sections under that same wrapper.

### Header positioning: logo scrolls, nav stays

.site-header is position:ABSOLUTE (not fixed): the logo sits at the top and
scrolls away with the page (explicit request). The nav + CTA are pinned
separately -- .header-right on the homepage, `body.job-page .site-header >
.site-nav` on generated pages -- as position:fixed top-right. The
film-playing slide-away now targets .header-right (the logo has long
scrolled off by the film beat). The strip-stack heads are randomised on
every page load (Math.random no-repeat picks).

### Skip Journey + nav home icon

- The story progress rail (bottom-right) now has a "Skip Journey" text link
  to its LEFT (href="#collaborate"; it goes through the existing
  cleanJumpTo("collaborate") delegation in js/script.js, which binds to every
  a[href="#collaborate"], so the jump is instant and unlock-safe). The rail
  div lost its aria-hidden so the link is reachable; the track carries it
  instead.
- .nav-home: an icon-only button (inline SVG, no icon library on this site)
  as the FIRST child of the nav pill on every page. HOMEPAGE: an UP ARROW
  that scrolls to the top (JS preventDefault + scrollTo), hidden (width 0)
  until you scroll down 200px then eases in -- gating this one makes sense,
  there's nothing to scroll back up to on load. GENERATED PAGES: a HOUSE icon
  that is a plain link to "/", shown immediately on load (Jul 2026 fix: it
  used to copy the homepage's 200px-scroll gate, which made no sense here --
  a link back to the homepage is useful from the moment the page opens, not
  just after scrolling). Visibility toggling lives in js/script.js
  (homepage, still scroll-gated) and js/nav.js (generated pages, now just
  `nav.classList.add("show-home")` once at init, no scroll listener) via
  .site-nav.show-home.

### Collab strip (homepage, above the collaborate section)

.collab-strip is a thin gradient bridge (forest -> indigo) between the story
and the board: "Join 100+ collaborators helping shape India's courts", a
stack of 7 overlapping contributor heads (random no-repeat picks from
contributors/photos.json, filled by the last-but-one IIFE in js/script.js),
and a green .strip-btn ("Meet the collaborators ->") to /contributors/.
Layout: text LEFT, heads + button RIGHT (space-between). Hovering ANYWHERE
on the strip fans the stack out and raises a staggered continuously-waving
👋 on every head (shared hiWave keyframes); both ease back on mouseout.
The fan-out uses TRANSFORMS (translateX leftwards up to -78px, away from the button),
never margins, so the button doesn't shift when the heads spread. The
button is the only link.

### /resources/ page (v2, July 2026)

Data lives in content/resources/{blog,data,circles}.json; resourcesPage()
in the build script renders three dark .collaborate sections plus a video
modal. All content was scraped from pucar.org (blog, people-centric-courts,
court-performance, online-dispute-resolution) and the PUCAR Learning Circles
YouTube playlist in July 2026.

- BLOG (#blog): 8 external articles as .collab-card clones with local
  thumbnails (assets/blog/<slug>) and a topic pill filter (.res-tagbar).
  Whole card links out. NO list view (explicit).
- DATA, POLICY, RESEARCH AND MORE (#data-resources): 26 items tagged by
  initiative. The initiative switcher is styled as REAL TABS (.res-tabbar:
  shared baseline track, green underline marks the active tab) and swaps a
  description pulled from each initiative page's own hero copy. BELOW the
  description sits a second row of TYPE FILTERS (#dataTypebar, pill-styled,
  each with its type's icon); tab + type combine (AND) in js/resources.js.
  refreshTypePills() hides type pills that don't exist inside the current
  tab (a "Policy" pill under ODR could only give an empty grid) and falls
  back to "All types" if the active one vanishes -- note the
  .res-type-pill[hidden]{display:none} guard, the display:inline-flex vs
  [hidden] gotcha again. Cards carry the type as data-type and render it
  as an ICON + quiet uppercase green label (.res-type, same voice as the
  blog cards' .res-outlet) instead of the old pill; the chips row is GONE
  from data cards (tab covers the initiative, icon label + filter bar
  cover the type -- the pills were pure duplication). Icons are inline
  Lucide-style strokes in TYPE_ICONS (scripts/build-jobs.js), one per type
  (Policy/Dataset/Courts/Open Source/Code/Presentation/Article/Research/
  Dashboard/Handbook) plus a default file icon. Has the cards/list VIEW
  TOGGLE (dataGrid registered in js/view-toggle.js; the toggle mounts at
  the right end of the #dataTabs row, align-self:center + margin-bottom
  lift it off the underline track; .view-toggle also carries
  align-self:center generally, else flex-stretch in filter bars leaves a
  dead strip under the fixed-height buttons).
- LEARNING CIRCLES (#learning-circles): 9 videos (LC #5 is not in the
  playlist) as thumbnail cards (assets/circles/<id>.jpg, play overlay);
  clicking opens #videoModal -- job-modal chrome with ONLY a
  youtube-nocookie iframe (autoplay) and the description below. Closing
  resets the iframe src to stop playback. No list view. "Learning Circle
  #N" is NOT a pill: it's a video icon + uppercase label (.res-circle-type,
  gold to set it apart from the data cards' green type labels). The foot
  (divider + Watch) pins to the card bottom via .circle-card .collab-foot
  margin-top:auto -- placed AFTER the .res-card margin-top:0 rule, since
  circle cards are also .res-card.
- SORTING: everything renders newest-first at build time (blog by parsed
  date desc, circles by circle number desc).
- SHOW MORE: every section caps at 2 rows of cards (5 rows in list view);
  the rest of the current filter match hides behind a centered "Show N
  more" ghost button (.res-more, injected by js/resources.js after each
  grid; toggles to "Show less"). The cap tracks the grid's RESOLVED column
  count from getComputedStyle gridTemplateColumns (px track list; falls
  back to 3 when unresolved, e.g. "none"/repeat() in jsdom), re-applies on
  filter change, on resize (debounced), and on the cards/list toggle via a
  MutationObserver on the grid's class. Expansion reveals animate through
  the same FLIP filter. Note .res-more[hidden]{display:none} -- the
  display:flex vs [hidden] gotcha yet again.
- Nav: Collaborate dropdown is now titled "Community"; the Resources group
  links to the three anchors, and the middle item is titled "Data, Policy,
  Research and more".
- THUMBNAILS ARE NOT COMMITTED YET: run `node scripts/mirror-resource-thumbs.js`
  locally (downloads framer blog thumbs + i.ytimg video thumbs; sandbox
  cannot reach either CDN). Until then the cards show broken images.
- js/resources.js holds the page behaviour (pill filter, tabs, video modal,
  leave-site modal). BOTH filters (blog topic pills + data tabs) animate
  with the same FLIP recipe as collaborate.js's animateFilter: exiting
  cards pin absolute at their old spot and fade/shrink out (.card-exit --
  works because every resource card is also a .collab-card and every grid
  a position:relative .collab-grid), survivors slide to their new slot,
  entrants fade/scale in; prefers-reduced-motion falls back to instant.
  Also the ONE-LINE TAG CLAMP: every .res-section
  .collab-chips is clamped to a single line, overflow chips collapse behind
  a green "+N" chip that reveals the full set on hover and re-clamps on
  resize -- same offsetTop technique as collaborate.js clampChips).
- Blog cards: summaries line-clamp at 3 with an ellipsis; outlet is quiet
  uppercase green text (not a pill); date is plain text with a calendar
  glyph; tags sit pinned just above the bottom divider: margin-top:auto on
  the CHIPS and margin-top:0 on the foot (two auto margins would split the
  slack and float the chips mid-card -- this bit, and got fixed);
  clicking shows the LEAVE-SITE WARNING (#leaveModal: names the destination
  host, Continue opens a new tab, cmd/ctrl-click skips it). It deliberately
  does NOT use the house modal look: compact 430px panel, 6px amber left
  edge, warning-triangle + small uppercase "External link" header, no big
  serif title ("You're about to leave PUCAR" was rejected). Related fix:
  button.btn kills the UA button chrome + sets cursor:pointer (with a
  button.btn.btn-outline re-assert for the outline border, since button.btn
  outranks .btn-outline) -- .btn was designed for <a> and <button> uses had
  no pointer cursor and a stray native border.
- Card sheen: .res-shine sweeps a light band across the thumbnail on hover,
  and .res-thumb-glow is THE SAME IMAGE mirrored (scaleY(-1)), heavily
  blurred and saturated, stretched from under the photo to the card's TRUE
  bottom edge -- an ambient tint over the whole card that fades downward.
  The photo's own bottom edge is square and feathered out with a CSS mask
  (rounded bottoms were rejected). GOTCHA: the glow is an absolutely
  positioned <img>; with height:auto it resolves to intrinsic height and
  IGNORES bottom:0, clipping short on tall cards -- so its height is an
  explicit calc(100% - 110px). Card text sits above the glow via
  position:relative+z-index on non-thumb children; list view hides all of
  it (.res-grid.is-list hides .res-thumb-wrap).

### Cards <-> list view toggle

js/view-toggle.js adds a grid/list switch to every card grid: #collabGrid
(homepage board), #perspGrid (/sc-ai-policy/), #contribGrid (/contributors/).
It mounts into the section's filter bar when one exists (margin-left:auto
pushes it right), else into a .view-toggle-rail above the grid. List mode is
just `.is-list` on the grid; all reshaping is CSS (summary/chips/meta hidden,
title flexes, foot moves inline right; contributors become one row per
person). Preference persists per grid in localStorage (pucar-view-<gridId>).
Hidden under 640px, where rows don't fit and cards win.

### Contributors data notes

Placeholder people (aditi-rao, rohan-mehta, varun-h) are `published:false`,
kept in content/ for reference; jobs that referenced them as posters simply
render no "Posted by" block. Organisation names were consolidated (XKDR →
XKDR Forum, eGovernments → eGov Foundation, SAMA → Sama, Daksh → DAKSH, role
text like "Lawyer"/"L1 Engineer" replaced with real orgs or blanked) so the
org filter is a clean list. The three 404'd LinkedIn bios no longer carry the
"profile unavailable" note.

### 6.3b Contributors directory section (folded into /contributors/, see 6.3c)

`contributorsSection()` in the build script returns the person-directory
markup reused inside the consolidated hub: an alphabetical grid of person
cards (avatar, name, role, organisation) that link to each profile page. A
filter bar offers free-text search (name, role, org) and an organisation
dropdown built from the distinct `organisation` values. Filtering lives in
`js/contributors-page.js` (same custom `.dd` dropdown pattern as
collaborate; the bar is `hidden` until JS runs, so the no-JS page is a plain
crawlable list). Cards open a PROFILE MODAL (shared job-modal chrome, same
as the contact modal; data from contributors/profiles.json emitted by the
build) with pushState to the person's real URL and history-back on close,
so deep links and crawlable per-person pages are untouched; cmd/ctrl/
middle-clicks still open the full page. The role line skips the
organisation when the role already names it. The section reuses the
`.collaborate` dark-indigo shell with `.contrib-grid` / `.contrib-card`
styles in style.css.

### 6.3c Consolidated hub — /contributors/ (About Contributing)

July 2026: what used to be three separate destinations (a standalone
`/contributors/` directory, DRISTI 2.0 framing scattered across the
homepage bulletin board, and a copy of the Supreme Court AI policy story)
is now ONE page at `/contributors/`, built by `contributorsPage()`. It is
NOT a redirect — the URL resolves directly to the full hub, same pattern
`/about/` uses for its own sections, just without a separate old URL to
retire (contrast with `/team/`, which IS still a redirect stub into
`/about/#team`).

Three sections, each with its own anchor and listed in the page's
`navCluster` sub-nav (`#dristi`, `#policy`, `#contributors`):

- `#dristi` — a LIVE view of the open-work board: the exact same
  `card()`/`boardJobs` data and `#collabFilters`/`#collabGrid`/`#jobModal`
  ids the homepage board uses, so `js/collaborate.js` (id-driven, bails
  early if its ids are missing) runs here completely unmodified.
- `#policy` — a short summary of the Supreme Court AI policy draft plus a
  button through to the full `/sc-ai-policy/` page, which is UNCHANGED and
  still exists in full as its own destination — this section is a teaser,
  not a duplicate of its perspectives/participate grids.
- `#contributors` — `contributorsSection()` (6.3b above), verbatim.

Nav, footer, the homepage's `.collab-strip` CTA, and the about page's
contributors-strip CTA (inside `teamSection()`) all point here now:
"Advance the DRISTI 2.0 stack" → `/contributors/#dristi`, "Explore the
Supreme Court's AI policy" (nav copy only) → `/contributors/#policy`,
"About Contributing" / "Meet the Contributors" → `/contributors/` /
`/contributors/#contributors` (in that order in the nav's "More" group).
`sitemap.xml` already had `/contributors/` listed as a page-level URL, so
no sitemap change was needed beyond adding `robots.txt` (see below).

Every generated page now carries THE SAME navbar as the homepage: pageShell
injects a NAV constant extracted from index.html at build time (single
source, like FOOTER), with in-page anchors rewritten to /#anchors and the
homepage's animated up-arrow home swapped for a plain house link to "/"
(tooltip "Home"). The old Back / View-all-Collaborators pills are gone.

SUB-NAV SYSTEM: pageShell accepts opts.subnav = [{label, href}]. When set,
the header renders a .nav-cluster of two pills: the main nav boots
COLLAPSED behind a burger toggle labelled "Main Menu", and a .sub-nav pill
(same style, slightly green-tinted background, dark variant included) boots
EXPANDED with the page's section links. HOVERING "Main Menu" expands the
main nav and collapses the sub-nav to a "Page Menu" burger; hovering that
reverses it (140ms hover-intent delay so a cursor passing across the burger
doesn't swap; click still works for touch/keyboard). THE SWAP IS ANIMATED: swapNavs() in js/nav.js FLIPs both
pills' widths via WAAPI (160ms, cubic-bezier(.4,.1,.2,1)) -- measure old
width, toggle classes, measure new, animate between. overflow:hidden is set
only DURING the animation (permanently it would clip the main nav's
absolute dropdown menus); freshly expanded items fade in via the
navItemsIn keyframe with a 160ms delay, i.e. AFTER the width FLIP lands
(the GLIDER is excluded from that selector -- :not(.nav-glider): the
animation's backwards fill forced opacity:0 over the glider's inline
opacity whenever it restarted, which read as "hover pill vanishes on
click, lit text unreadable" on sub-nav pages). On top of that, gliders
now re-track on any nav-link CLICK and carry a FAIL-SAFE: after each
650ms ride, if the pill's computed opacity is still 0 while a link is
lit, clear() runs -- a lit link with no pill can never be stranded
unreadable, whatever hid the pill. swapNavs also force-releases
is-swapping after 400ms (onfinish never fires for cancelled animations,
and a stuck is-swapping hides gliders with !important). NOTE for future
debugging: browser-automation tabs in a hidden/occluded window FREEZE
document.timeline, so every CSS animation/transition reads as stuck at
currentTime 0 -- do not diagnose glider bugs from such a tab
(flex-wrap:nowrap/white-space:nowrap on .nav-cluster .site-nav stop the
labels wrapping mid-animation, which used to balloon the pill's height).
While the FLIP runs the cluster carries .is-swapping, which kills
pointer-events on both pills and hides the gliders -- no hover state can
fire until the links are in their final positions ("hover shows up before
things are in position" bug). The GLIDER is wired on every nav in the
cluster, sub-nav included, so its hover highlight slides between links
exactly like the main menu's.
A collapsed nav shows only its toggle; an expanded nav hides its own.

Every sub-nav also carries the homepage-style looping UP-ARROW as its first
item (.subnav-top): click scrolls to the top of the current page, hover
loops the arrow (shares the navArrowUp keyframes) and shows the "Back to
Top" tooltip. It is NOT always visible: js/nav.js toggles show-home on the
sub-nav only past 200px of scroll (same gate + width-reveal as the
homepage's arrow), so it appears only once there's somewhere to scroll
back up to.

/resources/ uses the sub-nav with Blog / Data, Policy & More / Learning
Circle anchors. js/nav.js also runs the dropdown menu-gliders (copied from
script.js) so inner-page dropdowns behave identically to the homepage.

### Mobile nav (≤640px, js/mobile-nav.js on EVERY page)

The pills never fit a phone (expanded menus ran over the logo), so below
640px: the wordmark collapses to the standalone green "P" mark
(assets/pacar-p-icon.png -- note the "pacar" typo in the uploaded
filename; the green works on both halves so there's no light/dark swap),
all .site-nav pills are display:none !important, and js/mobile-nav.js
injects a frosted "Main Menu" burger pill (dark variant flips with
body.nav-dark / story beats). Tapping it opens .mobile-nav-overlay: a
full-screen tint (blur + rgba(13,26,32,.93)) holding a VERTICAL list
built by WALKING THE REAL NAV DOM at runtime -- so it can never drift
from the actual menus. Hierarchy is preserved: dropdown names become
green uppercase headings, the Community menu's .nav-menu-label groups
become muted sub-labels, item .nav-menu-sub lines carry through, pages
with a sub-nav get an "On this page" section first, "Home" appears on
inner pages only, and the homepage's Get in touch CTA becomes a full
button that closes the overlay and opens the contact modal. Closes on ×,
Esc, or any link tap (needed for same-page anchors). The overlay markup
exists on desktop too; only its trigger is media-queried away.

### Core team section on /about/ (July 2026; /team/ is a redirect)

The team was FOLDED INTO /about/ ("move the whole team section to the
About page... just go to this anchor"): the #team band (Core team / The
anchors.) sits at the bottom of About, after How we organise, followed by
the single contributors strip, then the funders wall (the "See open work" button was removed too).
DE-DUPED: the old about-strip and the "Meet the contributors" outline
button were both removed (the team strip carries that CTA now -- one
contributors CTA on the page). Nav + footer "Meet the Team" point to
/about/#team; /team/ writes a noindex meta-refresh redirect stub and is
out of the sitemap. teamSection() in the build script renders the band;
the notes below still apply.

### Team wall details (formerly the /team/ page)

content/team/team.json holds the 10 anchors (slug, name, PUCAR role,
photo, linkedin, optional site, 3rd-person bio). Sources: five bios reuse
the contributors' LinkedIn-sourced copy; Varun/Ayushi/Sathyajith/Abhiram/
Garvita were scraped fresh from LinkedIn via the user's Chrome (roles:
Senior Curator / Co-lead / Program Associate / Design Researcher / Program
Team). Photos live in assets/team/: five copied from assets/contributors,
five pulled from LinkedIn through the user's Chrome (see TODO section
note on the download-button trick; all committed, no script needed).

Layout is modelled on opennyai.org/about's team wall, PUCAR-skinned:
.team-grid of 3:4 portrait .team-cards on the dark band; photos grayscale
-> colour on hover while name/role rise over a bottom gradient
(.team-veil/.team-meta). The mid-card LinkedIn chip was REMOVED (user:
"Remove this linkedin button from people's faces. Let it just open the
modal") -- the modal carries the LinkedIn/Website buttons instead.
@media (hover:none) shows colour + names permanently. Clicking a card
opens the shared job-modal with the bio (js/team.js; data inlined in a
#teamData JSON script tag at build time -- no fetch). Below the grid sits
the same .collab-strip contributors bridge as the homepage/about (heads
filled by js/team.js from /contributors/photos.json, hover waves): "The
anchor team leads the mission day to day, but none of it would be
possible without 100+ contributors across the ecosystem" + Meet the
contributors CTA. Its copy is capped at 44ch (.team-strip .strip-text)
so the fanned heads never crowd the text. Designation notes (explicit, Jul 2026): Ayushi is
"Curator" (NOT Co-lead), Atul is "Tech Consultant" (NOT CTO) -- team.json
and his contributor entry both say so.
varun-h's contributor entry was also upgraded from placeholder to real
(published:true, so contributor pages count went 77 -> 78).

### Ecosystem switcher (brand-switch) + Agami attribution

A small caret beside the PUCAR logo (every page; index.html and pageShell
carry identical markup) opens a dark forest panel titled ALSO VISIT with
the Agami and OpenNyAI logos linking out -- modelled on opennyai.org's
own switcher. Pure CSS (hover + :focus-within, an ::after bridge keeps
the pointer path alive between caret and panel); caret colour flips with
the dark-half selectors like the logo. display:none under 640px (explicit:
not needed on mobile). The logos are SELF-HOSTED SVGs
(assets/agami-logo.svg, assets/opennyai-logo.svg) extracted path-by-path
from opennyai.org's inline SVG sprite via the browser (the sites are
Framer; their image CDN is unreachable from the sandbox, but inline
sprite symbols are just text). The OpenNyAI sprite contained off-canvas
duplicate paths that were dropped during assembly.

The footer's copyright block now opens with .footer-legal: "PUCAR is a
collaborative mission anchored by Agami, the tradename of Vayam Forum for
Citizenship, a registered Section 8 non-profit advancing innovation in law
and justice" (wording sourced from agami.in's own footer).

### /dristi/ page (July 2026)

dristiPage() in the build script. Sources: the user-uploaded
AGAMI_CONTEXT.md + ARCHITECTURE.md (2.0), oncourts.kerala.gov.in (about
page + the public Metabase dashboard behind /dashboard -- iframe at
/pucar-dashboard/public/dashboard/<uuid>; numbers read 5 Jul 2026:
1,920 filed / 402 disposed / 1,440 pending / 851 advocates / 1,757
litigants / 80% of disposals withdrawn), egov.org.in/product/
dristi-by-pucar (name expansion, personas, testimonials, gitbook docs
link), github.com/pucardotorg/dristi (DIGIT, design principles; repo
dormant since Mar 2025). Structure: intro + about-stats strip -> five
levers (about-steps) -> dark band "From 1.0 to 2.0" (two collab-cards:
1.0 rules-based DPG on DIGIT, live in Kollam; 2.0 AI-native,
standards-compliant, lightweight, bespoke per court, per the user's
explicit framing) -> "Where it runs" (#deployments): STATE TABS via
.res-tabbar (Kerala active; Punjab / Haryana / Gujarat greyed .tab-soon
with a Coming-soon chip, disabled buttons) + DISTRICT sub-tab row
(Kollam active, "More districts" greyed) -> Kerala panel: live stat
grid + source line, the 600->140 before/after journey rows
(.dristi-journey), THE RACE, two voices (Asha G.V; Justice Raja
Vijayaraghavan), CTA links (ON Courts site / dashboard / gitbook).

THE RACE (.race, js/dristi.js): the user-supplied Kaplan-Meier
"oncourts_overtake.html" (Jan 2025 cohort, all 15 Kerala districts,
day 417) re-themed to the site palette: ON Court line --green #30CF8C,
Malappuram rival --pink #DA6EAA, Kerala combined #F0A28A, dim paper
for the rest; Fraunces numbers, Source Sans axes. Plotly 2.35 from CDN
on THIS PAGE ONLY (deferred; js/dristi.js polls for window.Plotly ~10s
and degrades to static copy if the CDN fails). Play button animates a
5s eased race with a rank-pip strip and a green overtake flash at ~day
359 (revised: annotations are xanchor:right so labels stay INSIDE the
plot; the per-frame update is ONE batched Plotly.restyle across all 16
traces, not 16 calls, which killed the jitter; and an
IntersectionObserver auto-plays the race once at 45% visibility, the
button becoming Replay). Data lives inline in js/dristi.js.

Later same day: stats grid became 2 HERO stats (1,920 filed; ~5 months
vs ~2 years, green aura, span-2) over 4 quiet ones; testimonials became
.dristi-voice cards (giant drawn quote glyph, display-serif pull-quote,
initial medallion via cite[data-initial], hover lift) with glowing
green primary + fill-on-hover ghost CTAs; the 1.0->2.0 band became
.ver-grid (giant translucent version numerals, live/in-build status
pills with the pulsing dot, ticked feature lists, 2.0 as the green-aura
hero, an arrow bridge between them on desktop). Kerala/Kollam tabs
carry the homepage's throbbing .board-live orb. The page ends with
#collaborate: "Citizen tools should be citizen-shaped." + THE SHARED
OPEN-WORK BOARD -- collabBoardHtml() in the build script now renders
the identical filters/grid/job-modal on /contributors/ AND /dristi/
from the same boardJobs as the homepage, so all three boards are in
sync by construction; the homepage and /contributors/ board intros link
back via .collab-dristi-link ("About the DRISTI platform ->"). NAV: the
Community dropdown's Active Collaborations first item is now "DRISTI"
-> /dristi/ (was Advance-the-stack -> /contributors/#dristi); the
footer's Active Collaborations column matches.

### Footer: single source of truth

The footer's right side is a categorised sitemap (.footer-map: Explore /
Active Collaborations / Resources / Community columns, green uppercase
titles); blurb sits left, copyright spans below (grid, stacks under 860px).
The sitemap MIRRORS THE MAIN NAV (every dropdown item appears, grouped the
same way, plus Participate/GitHub externals) and must NEVER include any
page's sub-nav links -- page navigation stays in the page's own sub-nav
pill only.

pageShell no longer carries its own footer markup: the build script extracts
<footer class="site-footer">...</footer> VERBATIM from index.html at build
time (const FOOTER) and injects it into every generated page. To change any
footer anywhere, edit index.html's footer and re-run the build.

### 6.4 The build script — scripts/build-jobs.js

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

### 6.5 Client behaviour — js/collaborate.js

- **Filters** (`#collabFilters`, hidden until JS runs): stream, category,
  difficulty selects; deadline-range select (due within 7/14/30/90 days,
  computed client-side against `data-deadline`); tag chips (toggle,
  AND-combined). Category options and tag chips are derived from the cards
  present — dynamically, at page load, from every open card's
  `data-category`/`data-tags` — never hardcoded. (Cards only exist for jobs
  with `status: Open`; a completed/assigned job like the sample one attached
  to Rohan's contributor page correctly never reaches the board or its tag
  list — that's the board rule in §6.4, not a bug.) Active filters show a
  result count + clear button.
- **`.collab-card[hidden]{ display:none; }`**: `.collab-card` sets
  `display:flex` for layout, and since author stylesheets always beat the
  browser's default `[hidden]{display:none}` rule regardless of selector
  specificity, that default silently loses unless it's re-declared explicitly
  for the hidden state. Without this line, toggling `.hidden` in JS computes
  the right filter state but nothing visually disappears. Same fix applied to
  `.collab-filters`. Any future `[hidden]`-toggled element needs the same
  treatment if it also has an unconditional `display` rule.
- **Tag row never shares a line with the dropdowns**: `.collab-tagbar` has
  `flex-basis:100%` inside `#collabFilters`, forcing it onto its own row.
  Without this, the tag chips lived in the same wrapping flex row as the four
  dropdown pills — so picking a shorter option (e.g. "Paid" instead of "All
  streams") changed that pill's rendered width, which reflowed the shared row
  and could visibly shift a tag chip from a wrapped second line up onto the
  first. Keeping tags on a dedicated row means their wrapping depends only on
  their own content, never on sibling dropdown state.
- **Filter changes animate instead of jumping** (`apply()`): rather than just
  flipping `hidden` on every card, it does a small FLIP (First-Last-Invert-
  Play): measures every visible card's rect, applies the new match state,
  pins newly-filtered-out cards with inline `position:absolute` at their old
  rect (`.card-exit` class fades/shrinks them in place — see CSS) while the
  grid reflows immediately under them, gives newly-matching cards a fade/
  scale-in at their real slot, and inverse-transforms cards that were already
  visible so they slide from their old position into the new one instead of
  snapping. Exiting cards are only actually `hidden` after the ~260ms fade
  (`EXIT_MS`), guarded by checking they still have `.card-exit` in case a
  fast second filter change re-matched them first. `.collab-grid` needs
  `position:relative` as the containing block for that absolute pin.
  `prefers-reduced-motion` skips all of this for a plain instant toggle.
- **Empty-filter placeholder** (`#collabEmpty`, `.collab-filter-empty` —
  deliberately *not* named `.collab-empty`, which is a different, unrelated
  element: the `<p class="collab-empty">` `build-jobs.js` writes between
  `COLLAB:START/END` when there are zero *open jobs at all*, a data
  condition, vs. this being a *filter* condition): a permanent, normally-
  `hidden` dashed-border card sitting just after `COLLAB:END` in the grid
  (outside the markers, so the build script never touches it). `reportCount()`
  shows it whenever a filter is active and `shown === 0`, so the grid keeps
  occupying a full row's height instead of collapsing to nothing when a
  filter combination matches no cards. Spans the full grid row via
  `grid-column: 1 / -1`.
- **Deadline/closes row is pinned to the card bottom** (CSS only, `.collab-
  meta{ margin-top:auto }`): cards are a flex column, and `.collab-foot`
  (posted-by + View button) already used `margin-top:auto` to sit at the
  very bottom regardless of card height. `.collab-meta` (the deadline +
  "Closes in N days" line) sat in normal flow just above it, so its vertical
  position depended on how much summary/chip content preceded it — a card
  with fewer tags showed its deadline higher up than a taller card in the
  same grid row. Giving `.collab-meta` the `margin-top:auto` instead (and
  removing it from `.collab-foot` — only one flex item along a given axis
  should claim the free space, or it splits between them) pins the meta+foot
  pair together at the bottom as a fixed-position group.
- **Chip rows clamp to one line**: individual chips are CSS-ellipsised at
  170px max-width (full text via native `title` tooltip — the build emits
  `title` attrs, and chips sit at z-index 2 above the card's cover link so
  hover reaches them). `clampChips()` then measures the row: any chip that
  wrapped to a second line is hidden behind a dashed "+N" pill; clicking it
  expands the row (pill becomes gold "×"), clicking again collapses.
  Re-measured on (debounced) resize and after every filter change, since
  hidden cards can't be measured.
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

### 6.6 Entrance transition (js/script.js + CSS)

The whole section — heading, filters, count line, job cards — fades/rises in
the first time `#collaborate` is actually seen, via a single
`IntersectionObserver` in `js/script.js` (`threshold: 0.15`) watching the
section element. It fires once (`unobserve` after the first hit) and covers
both ways a visitor can arrive: scrolling down into the section normally, or
landing there in one step via `cleanJumpTo()` (§4 above) — the jump still
ends with the section intersecting the viewport, it just gets there without
the intermediate scroll frames, so no special-casing was needed between the
two paths.

- **Progressive enhancement, not a hard dependency**: elements only get
  `opacity:0` while `.js-reveal` is present on `#collaborate`, and JS only
  adds `.js-reveal` in the same code path that also sets up the observer to
  remove it again (`.is-in`). A browser without `IntersectionObserver`
  support (or JS failing) never adds `.js-reveal` at all, so everything just
  renders visible immediately — there's no path where content can get stuck
  invisible with nothing left to reveal it.
- **`animation`, not `transition`, for the reveal**: `.collab-card` already
  owns a `transition` shorthand for its hover state (transform/background/
  border-color/opacity, `.25s`). A second rule declaring `transition` on the
  same elements would replace that whole shorthand for as long as the
  selector matched (shorthands don't merge per-property — whichever
  declaration wins by specificity wins wholly), which would have
  permanently slowed hover feedback after the entrance ran once. Using
  `@keyframes collabRiseIn` with `animation` avoids the collision:  it drives
  opacity/translate only while running, `forwards` fill keeps the end state,
  and once it finishes the element's own `transition` rule is untouched —
  same cascade behaviour already documented for the litigant's walk-in
  (§4 above).
- **Staggered cards**: each `.collab-card` gets a `--i` custom property set
  by JS at page load (its index, capped at 10 so a long job list doesn't
  push the last few cards' delay out to something sluggish);
  `animation-delay: calc(.16s + var(--i) * .06s)` cascades them in
  left-to-right, top-to-bottom instead of popping all at once. Heading
  animates first, filters/count follow at a fixed `.1s`, then cards cascade
  after that.
- **Replays on every arrival** (revised Jul 2026, explicit request:
  "always trigger, either when collaborate is clicked, or when scrolling
  there" — it originally revealed once and unobserved). `.is-in` is added
  at ≥15% visibility and removed only once the section has left the
  viewport *entirely* (threshold `[0, .15]` with hysteresis — removing at
  the same 15% line would visibly blank content still on screen while
  scrolling away). Re-adding the class restarts the entrance keyframes,
  so the stagger replays each visit, for both scroll arrivals and
  `cleanJumpTo()` clicks.
- **`prefers-reduced-motion`**: extends the existing reduced-motion block —
  `.js-reveal` elements render at `opacity:1` outright and the `.is-in`
  animations are disabled, so reduced-motion visitors see the section fully
  rendered with no entrance movement at all, rather than the animation
  simply running faster.

### 6.7 Decap CMS — admin/

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

## 7. Deployment & git state

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

## 8. Known placeholders / TODO before launch (updated July 2026)

- robots.txt is now generated at build time (allow-all + sitemap pointer);
  previously missing entirely.
- /team/ shows the real 10-person team (Jul 2026); all ten headshots are
  committed in assets/team/ (mirror script retired -- the LinkedIn photos
  were pulled through the user's Chrome instead: scripted a.click()
  downloads get silently dropped without user activation, so the working
  path was blob-URL download BUTTONS on a scratch page that the user
  clicked, landing files in ~/Downloads for pickup). Old note —
  swap in real people (teamPage() in the build script).
- The two sc-ai-policy events (content/sc-events/) carry REALISTIC DUMMY
  details (8 and 11 July 2026, BIC Domlur venue) — confirm or correct real
  dates/venues before promoting the page. The "Email the AI Committee"
  suggestion card was removed from the participate grid on request.
- All 5 work items are sample content. The placeholder contributors
  (aditi-rao, rohan-mehta, varun-h) are `published:false` in
  content/contributors/ — jobs referencing them as posters render no
  "Posted by" block until real slugs are set.
- Three contributor LinkedIn URLs 404'd during the bio pass
  (aishwariya-dixit, madhav-pudipeddi, shreyashi-soni): short org-only bios,
  fill in when new profile URLs are known.
- Story stats are approximations — verify against NJDG / Prison Statistics
  India before launch.
- Decap OAuth setup (section 6.6) not yet done.
- Sample job dates are relative to July 2026; re-check expiry behaviour when
  updating.
- PUSH WORKFLOW: the sandbox agents work in cannot push (no GitHub
  credentials). Every change session ends with a commented `git push`
  command for the user to run — keep doing that.

## 9. Conventions for future changes

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
