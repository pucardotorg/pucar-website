# PUCAR website — agent notes

Read `README.md` for the full architecture. A few hard rules that must never
be broken, restated here because they have been violated before:

## Hard visual rules (client-stated)

1. **Never use single-edge coloured accent borders.** No `border-left`,
   `border-top`, `border-right`, or `border-bottom` used as a decorative
   coloured stripe on one edge of a card, callout, blockquote, list item, or
   nav/TOC active state. The client has rejected this "accent rail" look
   repeatedly. Acceptable alternatives: a soft filled background
   (`--green-soft`, `--cream`), a full uniform hairline border (`--line`) on
   all sides, a soft box-shadow to lift a card, a filled number/badge, or a
   decorative glyph (e.g. a large `“` for a pull-quote). Uniform all-round
   borders are fine — only one-edge coloured accents are banned.

2. **No em dashes ( — ) in any copy.** Use commas, colons, semicolons,
   parentheses, or split the sentence instead. En dashes for number ranges
   (e.g. `26–30`) are fine.

## Build / commit

- Site is a zero-dependency Node build: `node scripts/build-jobs.js`
  regenerates the generated pages. `index.html`, `/litigant-journey/`,
  `/cheque-journey/` are hand-authored (not generated).
- Content for the /sc-ai-policy/ submission section lives in
  `content/sc-comments.html` (a partial injected by the generator).
- The FUSE mount can `EPERM` on `.git/index.lock`; commit via a temp index +
  `git commit-tree` + `git update-ref` when a normal commit fails.
