# PUCAR — The Litigant's Journey

A scroll-driven storytelling page: a **top-down** litigant figure walks "up" the
screen while the world scrolls past, moving through stat and narrative beats
about the Indian justice system, ending with PUCAR's initiatives and a call to
action. The litigant starts to one side during the intro, then slides to the
centre once the journey begins.

Static site — plain HTML/CSS/JS, no build step, no dependencies.

## Litigant figure (second uploaded asset — Jul 2026)

The figure is the **second user-supplied flat illustration** ("Untitled
design.svg", 810×810): a top-down person facing **down-screen** — dark bun,
purple coat, grey skirt, pink bag strap, one leg mid-stride. It replaced the
earlier asset (and its `ligA…ligD` gradient version) after the first walk
animation didn't work. Cleaned copy lives in `assets/litigant-source.svg`.

Cleanup done when embedding it in `index.html` (`svg.litigant`):

- Removed the tiny green icon in the bottom-left corner (3 paths + 2 clipPaths
  at `0,799 → 20,810`).
- Prefixed the clipPath ids (`ligShoe/ligHandR/ligSlvL/ligBun`).
- Cropped the viewBox to the figure: `viewBox="90 140 620 530"`.
- Removed the small static knee-blob path (`M 401.97 519…`) that peeked from
  under the skirt — it's replaced by a real second leg.
- Removed the 3 stray paths behind the head's upper-left (a shoe + skin blob
  at `~283–330, 225–338` plus a skin ellipse under the hair) that read as a
  disembodied leg next to the bun.
- Animatable groups, **z-order preserved**, all inside `.fig`:
  - `.leg-front` — the drawn right leg (thigh, skin lower leg, shoe; drawn
    *before* the skirt so its top is hidden under the hem).
  - `.leg-back` — a clone of the same three paths inside
    `transform="translate(-92 0)"` = the left leg (offset sets the stance
    width).
  - `.arm-left` / `.arm-right` — the two forearm + hand clusters (the coat is
    drawn after them, hiding the pivots).
  - `.head` ×2 — the face-skin path and the hair+bun pair, wrapped as two
    separate groups (other paths sit between them in z-order) that share the
    same class, pivot and animation, so they turn as one head.

The walk (in `css/style.css`) — subtle, scroll-driven:

- `legFront`/`legBack` alternate `scaleY(1.02 ↔ .62)` about hip pivots hidden
  under the skirt (`455,508` / `363,508`): each leg extends down-screen, then
  foreshortens back under the body — a top-down stride.
- `figWalk` scales the whole body `1 ↔ 1.016` twice per stride (the bob /
  expand-contract) with a faint `±.7°` rock, about `400,430`.
- `armLeft`/`armRight` counter-sway `±2.4°` from the elbows (`150,430` /
  `592,330`).
- All animated groups set `transform-box: view-box` so the px
  `transform-origin` values resolve in viewBox units (this was the likely
  cause of the earlier animation not working).
- All figure animations are `paused` at rest and run (1s cycle) only while
  `.pin.is-walking` is set — the scroll engine adds it on scroll and clears
  it 180ms after scrolling stops, so the walk freezes mid-pose with the
  page. Same pattern as the ground/path/shadow layers. Side→centre movement
  is unchanged.
- **Idle look-around**: after 10s without scrolling (`IDLE_DELAY` in
  `js/script.js`) the pin gets `.is-idle` and `headLook` turns the `.head`
  groups ±16° about the head centre (`379,372`) — glance left, glance right,
  rest — on a 5.5s loop. Any scroll clears it instantly.
- The dashed `.path` is `200vh` tall, centred on the stage, so it spans the
  full viewport at any screen size.

To adjust: stride depth = the `.62` in `legFront`/`legBack`; bob = the `1.016`
scale in `figWalk`; arm sway in `armLeft`/`armRight`; pivots are the
`transform-origin` values (asset user-space units).

### Side → centre movement

`.litigant-stage` sits in grid column 1 (the left half) and defaults to
`translateX(0)`. Per-beat rules in `css/style.css` move it to the viewport
centre from beat 2 onward:

```
.pin[data-beat="2".."7"] .litigant-stage{ transform:translateX(25vw); }
```

The `.pin[data-beat]` attribute is set by `js/script.js` as you scroll, and the
`.9s` transition on `.litigant-stage` animates the slide. A dashed `.path`
inside the stage (behind the figure) tracks it, so the walking path follows the
litigant from side to centre. On mobile (single-column) the slide is disabled
and the figure stays put. To retune when it centres, change which `data-beat`
values carry the `translateX`; to change how far, adjust the `25vw`.

## Collaborate section (Decap CMS + static job pages)

Jobs live as one JSON file each in `content/jobs/`. On every deploy, Netlify
runs `node scripts/build-jobs.js` (dependency-free), which generates:

- `collaborate/<slug>/index.html` — a **crawlable page per role** (canonical
  URL, OG tags, schema.org JobPosting JSON-LD). The filename is the slug.
- static cards injected into `index.html` between the `<!-- COLLAB:START -->`
  / `<!-- COLLAB:END -->` markers (real `<a>` links — crawlable without JS)
- `collaborate/jobs.json` — index consumed by the modal
- `sitemap.xml`

On the homepage, `js/collaborate.js` intercepts card clicks: opens the detail
modal and `pushState`s the job's real URL, so browsing feels instant but every
deeplink is a real, shareable, indexable page. Back button / Escape / backdrop
close the modal. Without JS, cards are plain links to the pages.

`collaborate/` and `sitemap.xml` are build artifacts — Netlify regenerates
them; run the script locally after editing jobs so local preview matches.

### Editing jobs

- **By hand**: add/edit a JSON file in `content/jobs/` (see existing ones for
  the fields), run `node scripts/build-jobs.js`, push.
- **Via Decap CMS** at `/admin/` — one-time setup:
  1. In `admin/config.yml`, set `repo:` to your GitHub `owner/repo`.
  2. Create a GitHub OAuth app (github.com → Settings → Developer settings):
     homepage = your site URL, callback = `https://api.netlify.com/auth/done`.
  3. In Netlify: Site configuration → Access & security → OAuth → Install
     provider → GitHub, paste the app's Client ID/Secret.
  4. Anyone with write access to the repo can now log in at
     `yoursite.netlify.app/admin/` and publish roles; each publish commits to
     git and triggers a deploy.
  - Local editing without auth: uncomment `local_backend: true` in the
    config and run `npx decap-server` next to your static server.
- Unpublish a role by toggling its `published` field off (or deleting it).

## Structure

```
index.html          markup + all 8 scroll "beats" + collaborate section/modal
css/style.css       palette, layout, walk-cycle, collaborate + modal styles
js/script.js        scroll-progress engine (beat switching, counters, walk state)
js/collaborate.js   job modal + pushState deeplinks
content/jobs/       one JSON per role (edited by Decap CMS or by hand)
scripts/build-jobs.js  build step: job pages, cards, jobs.json, sitemap
admin/              Decap CMS (config.yml needs your repo + OAuth setup)
collaborate/        GENERATED — one crawlable page per role + jobs.json
netlify.toml        publish config; runs the build step on deploy
```

## Run locally

```
python3 -m http.server 8000
```
then open http://localhost:8000

(Any static server works — no build step needed.)

## Deploy

### GitHub
```
git init
git add .
git commit -m "Initial PUCAR storytelling page"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Netlify
1. New site from Git → pick this repo.
2. Build command: leave blank. Publish directory: `.` (repo root).
   `netlify.toml` already sets this, so the defaults should just work.
3. Deploy.

## Known placeholders to replace before launch

- All stats (5.5 Crore pending cases, 10+ yr pendency, 75% undertrials) are
  commonly-cited approximations marked `[placeholder — verify]` in
  `index.html`. Confirm against current NJDG / Prison Statistics India data
  and cite sources.
- The narrative beat (beat 2) is a stand-in — swap in a real or composite
  litigant account.
- Initiative cards (beat 6) link to `#` — point them at the live pucar.org
  pages.
- "Get in touch" / "Learn about the PUCAR way" CTAs (beat 7) link to `#`.
- The 3 roles in `content/jobs/` are sample content marked `[placeholder]` —
  replace with real openings. `admin/config.yml` still has `repo: CHANGE_ME`,
  and the sitemap domain defaults to a placeholder until deployed (it uses
  Netlify's `URL` env var on real builds).
- Litigant illustration, palette, and copy are all first-pass — happy to
  iterate on any of it.
