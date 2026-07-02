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
| `--forest` | `#123726` | Dark background *and* the light-background stand-in for `--green` (see rule below). Also replaces the old navy-blue dark background (beat 5, nav hover). |
| `--forest-deep` | `#0B2417` | Darkest background. Replaces the old navy-deep (beat 7, footer). |
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
    contrast. Hover darkens further to `#184A33`, a lighter tint of
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
- Beats 0–7: intro → pendency stat → narrative → 10-yr wait → undertrials
  (pink-tinted) → PUCAR turn (dark forest-green) → initiatives grid → CTA
  (darkest forest-green). All stats are marked `[placeholder — verify]` in
  the markup. See [§2 Design system](#2-design-system-colour-type-buttons)
  for what `--forest`/`--forest-deep`/`--pink-soft` actually resolve to.
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
`photo` (optional; empty → initials avatar, background hue hashed from the
name), `email`, `links[]` ({label,url}), `published`, `body` (bio markdown).

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

### 6.6 Decap CMS — admin/

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

## 8. Known placeholders / TODO before launch

- All story stats (5.5 Cr pending, 10+ yr, 75% undertrials) are
  approximations marked `[placeholder — verify]` — check NJDG / Prison
  Statistics India and cite.
- Beat-2 narrative is a stand-in; initiative cards (beat 6) and CTA buttons
  (beat 7) link to `#`.
- All 5 work items and contributors "Aditi Rao" and "Rohan Mehta" are sample
  content marked `[placeholder]`; "Varun H" bio is placeholder. Add real
  photos via Decap (media goes to `assets/uploads/`).
- Decap OAuth setup (section 6.6) not yet done.
- Sample job dates are relative to July 2026; re-check expiry behaviour when
  updating.

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
