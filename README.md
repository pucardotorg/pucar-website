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
js/contributors-page.js  /contributors/ search + organisation filter.
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
contributors/          GENERATED: <slug>/index.html per contributor + index.html (filterable
                       list) + photos.json (waving-heads data).
about/ team/ sc-ai-policy/  GENERATED pages (aboutPage/teamPage/scPolicyPage in build script).
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
  curtain==1 on a FORWARD approach with a playable file (`canplay` sets
  `filmUsable`; missing file shows `.video-missing` and never traps),
  playback starts **with audio** and **NO scroll lock** (v3 revision:
  "don't lock scroll on the video. Let people scroll to move on" — the
  earlier skip button and bottom gradient are REMOVED). `updateFilm`
  toggles `filmActive` at curtain==1: entering the zone plays
  (`tryPlayFilm()` attempts unmuted first; if autoplay policy refuses —
  scroll isn't a click-grade gesture — it falls back to muted + a one-tap
  "Tap for sound" pill), **leaving the zone in either direction pauses
  the video** and restores the chrome; re-entering RESUMES (it only
  restarts from 0 after a completed watch, so a wobble at the zone edge
  doesn't restart it). Native `controls` are on. While the film is the
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
- `pucar-favicon-dp.png` — 500×500 green "P" mark, source for the generated
  `favicon-32.png` / `favicon-16.png` / `favicon-apple-touch.png`.

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

The homepage nav is now: The Journey · About (dropdown) · Collaborate
(dropdown), plus the Get in touch CTA. Both dropdowns use `.nav-drop` +
`.nav-menu` (hover / focus-within, opening is pure CSS) with a caret SVG
(`.nav-caret`) that rotates 180° when open. A ::before bridge covers the 8px
gap so the menu survives the mouse travelling to it. Nav is display:none
under 640px as before.

- Collaborate menu: "Active Collaborations" (Advance the DRISTI 2.0 stack →
  #collaborate, Explore the Supreme Court's AI policy → /sc-ai-policy/, same
  framing as the hero bulletin board) and "More" (Meet the Contributors →
  /contributors/, About Contributing → /about-contributing/ which DOES NOT
  EXIST YET, page is planned).
- About menu: About PUCAR → /about/, Meet the Team → /team/.

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
organise) and /team/ (PLACEHOLDER cards -- swap in real people). Both in the
sitemap; homepage footer About link points to /about/.

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
  data-beat drives start/stop; leaving beats 8-9 clears every bubble.
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

### 6.3b Contributors index page — /contributors/

`contributorsIndexPage()` in the build script generates `contributors/index.html`:
an alphabetical grid of person cards (avatar, name, role, organisation) that
link to each profile page. A filter bar offers free-text search (name, role,
org) and an organisation dropdown built from the distinct `organisation`
values. Filtering lives in `js/contributors-page.js` (same custom `.dd`
dropdown pattern as collaborate; the bar is `hidden` until JS runs, so the
no-JS page is a plain crawlable list). The section reuses the `.collaborate`
dark-indigo shell with `.contrib-grid` / `.contrib-card` styles in style.css.
Linked from the homepage footer; included in sitemap.xml.

Every generated page's header nav (pageShell) shows two pills: "← Back",
which calls history.back() when there is history (href falls back to the
page's backHref for crawlers/no-JS), and "View all Collaborators" linking to
/contributors/.

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

- /about-contributing/ DOES NOT EXIST yet but is linked from the Collaborate
  nav dropdown ("About Contributing") — build it next or the link 404s.
- /team/ is entirely placeholder cards ("Team Member · placeholder") —
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
