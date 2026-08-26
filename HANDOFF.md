# HANDOFF

Written 2026-08-13. Verified against the repo at commit `44c71c5` plus **one uncommitted
change in the working tree**: a full revert of `44c71c5` (the cursor replacement), applied
at the user's request. `main` is in sync with `origin/main`; the live site is still serving
the reverted-away cursor until that revert is committed and pushed.

---

## 1. Orientation

This is **Vyom Aggarwal's personal portfolio website** — a static site deployed at
<https://vyom-aggarwal.github.io/> from the repo root via GitHub Pages. Vyom is a
15-year-old high-school sophomore (River Islands HS, class of 2029, dual-enrolled at
San Joaquin Delta College) doing machine-learning research at MIT CSAIL and the UC Santa
Cruz AIEA Lab. The site's audience is college admissions, research labs, and potential
collaborators, so **factual precision matters more than polish** — several sessions of
work have gone into making the reported research numbers exactly match their source data.

The site is **complete and live**. It is not a work-in-progress build; it is a shipped
artifact being iterated on. There is no build step, no bundler, no package manager, and
no dependencies. Plain HTML, CSS, and ES modules.

---

## 2. Mission & scope

**Original ask (user's words):** *"take my current portfolio website and give it an
absolute rework from the ground-up, making it look so much cooler and cleaner than it was
before... take other revolutionary portfolios for people in my field as reference...
clean animations, a cool custom cursor effect, and potentially 3d objects... doesn't have
to be in just a single html file... keep it in a format that will allow it to still work
with github pages."*

**How it evolved over the session, in order:**

1. Rebuilt the single 660-line `index.html` into a multi-file static site.
2. User rejected the first pass: *"all you have done is change the formatting but have
   kept the layout the same as before."* → full layout re-architecture to a fixed console
   sidebar + modular tile grid.
3. Logo: replaced a "V" mark with a **VA lettermark** (user picked from three candidates).
4. Deleted the Capabilities/Skills section entirely.
5. Added a **scroll-driven research section** (section 02) with a WebGL quadruped rig,
   modelled on the scrollytelling block at <https://suhaslord.github.io/portfolio/>.
6. Fixed a real bug: WebGL animation loops silently stalling.
7. Updated the research section twice — first from an updated project README, then
   corrected again from the authoritative CSV.
8. Replaced the custom cursor with a copy of the one at <https://adeia.xyz/> — then
   **reverted it** when the user said they preferred the original. The original
   dot-ring-and-label cursor is what is in the tree now.

**Explicitly out of scope / deliberately not done:**

- No build tooling, framework, or npm dependency. This was a hard constraint from the
  first message and has never been relaxed.
- No CMS or data file — all copy lives inline in `index.html` by design.
- No inertial/smooth-scroll hijacking (adeia.xyz has one; it was not copied).
- No sim-to-real or overstated research claims. The research section states what is
  *not yet built* as prominently as what is.

---

## 3. Current state

**Working end to end, verified:**

- All six sections render and navigate: `overview`, `research`, `work`, `education`,
  `awards`, `contact`.
- Console sidebar with live section index, scroll progress, Lathrop-time clock,
  theme toggle. Collapses to a top bar + overlay menu below 1100px.
- Hero WebGL object (noise-displaced icosphere, point cloud + wireframe).
- Research scrollytelling stage: 6 beats, telemetry readout, quadruped rig whose gait,
  fault, and recovery are quantitatively tied to the measured `joint_lock` data.
- Custom cursor: a hard accent dot tracking the pointer exactly, plus a ring easing
  behind it at 0.16/frame that swells into a filled accent disc with an uppercase mono
  label over `[data-cursor]` elements, and into a soft outlined ring over other
  interactive elements. States: `is-hot`, `is-soft`, `is-down`, `is-idle`.
- Light/dark theming across every component including both WebGL canvases.
- Role filter on the work deck (counts verified: all 10 / research 3 / robotics 2 /
  math 2 / leadership 5).
- Reduced-motion and touch fallbacks throughout.
- Deployed and live — `curl` confirms `index.html`, `main.js`, and `cursor.js` all
  return 200, and the deployed `cursor.js` contains the new implementation.

**Half-built / inert:** nothing. (The cursor revert removed the two items that were
listed here — an untriggered `is-cold` state and 10 dead `data-cursor` attributes. Under
the restored cursor those attributes are load-bearing again: they supply the label text.)

**Known imperfect, not broken:**

- The research results table has 6 columns and scrolls horizontally inside
  `.rtable__wrap` below roughly 950px viewport width. This is by design
  (`overflow-x: auto`), not a bug, but it is the least elegant part of the layout.
- `post_fault_distance` exists in the source CSV but is **not shown** on the site — a
  deliberate omission to keep the table to 6 columns.

**Broken:** nothing known.

---

## 4. Architecture map

**Stack:** static HTML + CSS + vanilla ES modules. Raw WebGL2 for both 3D objects (no
Three.js). Google Fonts via CDN (Archivo, Inter, Instrument Serif, JetBrains Mono).
Zero npm dependencies, zero build step.

**Data flow:** `index.html` loads 5 stylesheets and one module entry point
(`assets/js/main.js`), which imports and initialises 8 sibling modules. All page copy is
inline in `index.html`; nothing is injected from JS except the two cursor elements.
Scroll position drives the research stage: `scrolly.js` computes a 0→1 progress value
from the sticky stage's bounding rect and pushes it into `research-gl.js`.

| Path | Role | Why it matters |
|---|---|---|
| `index.html` | All markup and all copy, 653 lines | Single source of content. Every text edit happens here. |
| `assets/js/main.js` | Entry point, 49 lines | Wires all modules; holds reveal animations until the preloader lifts. |
| `assets/js/research-gl.js` | Quadruped rig, raw WebGL2, 516 lines | Most complex file. Gait IK, fault simulation, camera. Timing constants are tied to real measured data. |
| `assets/js/scrolly.js` | Drives the research stage from scroll | Maps scroll → progress → rig state + beat panels + telemetry. |
| `assets/js/hero-gl.js` | Hero icosphere, raw WebGL2, 548 lines | Largest file; shares the `shouldRun()`/`sync()` loop pattern with research-gl. |
| `assets/js/cursor.js` | Custom cursor, 82 lines | Drives the `.cursor` markup in `index.html`; reads `data-cursor` for label text. |
| `assets/js/shell.js` | Progress, section index, theme, menu, clock | `SECTIONS` array must stay in sync with section ids in `index.html`. |
| `assets/css/tokens.css` | All design tokens + the light theme | Every colour/size/timing is defined here first. Change colours here, nowhere else. |
| `assets/css/base.css` | Reset, atmosphere, cursor, buttons, reveal | Cursor CSS lives here (not a separate file). |
| `assets/css/tiles.css` | The 12-col grid, `.deck`, and every tile | Layout system for everything except the research stage. |
| `assets/css/research.css` | The pinned stage + results tables | `.stage { height }` controls how long the pinned sequence lasts. |
| `README.md` | Developer docs for the site itself | Already documents the grid system, the research stage, and editing conventions. **Read it — it is not redundant with this file.** |
| `.well-known/discord` | Discord domain verification | Do not delete; it is why the domain verifies. |

---

## 5. Environment & runbook

Machine is **Windows 11 / PowerShell**. Verified tooling: Python 3.13.14, Node v24.18.1,
git 2.45.1.windows.1.

**Clean clone → running:**

```bash
git clone https://github.com/vyom-aggarwal/vyom-aggarwal.github.io.git
cd vyom-aggarwal.github.io
```

There is **nothing to install**. No `npm install`, no venv, no env vars, no services,
no database. N/A for all of those.

**Run locally** — you must serve over HTTP; ES modules do not load over `file://`, so
double-clicking `index.html` gives a blank page:

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

**Tests:** there is no test suite. N/A. Verification during this session was done by
DOM measurement in a live browser plus these static checks:

```bash
# every JS module parses as ESM (node --check treats .js as CJS and will fail on import)
tmp=$(mktemp -d); for f in assets/js/*.js; do cp "$f" "$tmp/$(basename ${f%.js}).mjs"; done
for f in "$tmp"/*.mjs; do node --check "$f" || echo "SYNTAX ERROR: $f"; done; rm -rf "$tmp"
```

**Build:** none. **Deploy:** `git push` to `main`. GitHub Pages serves the repo root.
`.nojekyll` is present so Jekyll does not process the tree.

**Windows gotchas actually hit this session:**

- Git reports `LF will be replaced by CRLF` on JS files. Cosmetic; ignore.
- Bash heredocs (`python - <<'PYEOF'`) **break** when the body contains large amounts of
  embedded HTML — got `unexpected EOF while looking for matching '`. Write the script to
  a file and run it instead. This wasted a cycle; don't repeat it.
- `.claude/` exists locally (editor/tooling config) and is gitignored. Leave it alone.

---

## 6. Decisions & rationale

**No framework, no build step, no dependencies.** Constraint from the user's first
message ("keep it in a format that will allow it to still work with github pages").
Everything downstream follows from this.

**Raw WebGL2 instead of Three.js.** A CDN script tag would have been simpler, but it adds
a network dependency that can fail and ~150KB. Both 3D objects are hand-written shaders
plus small mat4 helpers. *Rejected:* Three.js via CDN, and a CSS-3D fallback.

**Console sidebar + tile grid, not stacked sections.** The first rebuild kept the
original vertical band-per-section structure and the user rejected it outright. The
current architecture is a fixed 306px sidebar plus a scrolling canvas of modular tiles.
Rationale: the content is many small discrete facts (10 roles, 6 awards, 2 schools), which
a tile grid serves far better than full-width bands. *Rejected:* horizontal scroll,
split-screen sticky, pure bento with no sidebar.

**Two grid systems, deliberately.** `.grid` is 12 columns with per-tile spans (`.s12`
… `.s3`) for places where asymmetry is intentional (the awards bento). `.deck` is
`auto-fill minmax()` for uniform sets (roles, schools) so they reflow without spans.

**Role cards show their description outright — no accordion.** The original site made you
click each of 10 rows to read them. Removing the interaction removed a barrier; the
filter is the only interaction left.

**The research scroll IS the experiment timeline, not just a trigger.** Scroll maps to
the 500 control steps of one Baseline A trial. Injection lands at p=0.40 = **step 200**
exactly (matching the protocol). Recovery completes at p=0.66 = step 330 = **2.17 s
post-fault**, against the measured `joint_lock` recovery time of **2.222 s**. The velocity
readout drops by `joint_lock`'s measured **44.9%** and returns to within 15% of baseline
— which is precisely what the scoring criterion calls *recovered*. The seized leg stays
seized the whole time, because that is the project's actual claim. These constants are in
`research-gl.js` (`setProgress`, and `state.speed = 1 - 0.449 * fault * (1 - 0.82 * recovery)`).
**If the research data changes, these numbers must change with it.**

**The stage is labelled `Mode: Schematic` in its telemetry.** The residual module does not
exist yet, so the animation depicts a *hypothesis*. The label stops it being read as data.

**CSV beats README when they disagree.** `logs/across_seed_summary.csv` in the research
repo is the authoritative source. The project README showed ± values on the *Degraded*
and *Velocity drop* columns that **do not exist in the CSV** (there are no
`degradation_rate_sd` or `velocity_drop_sd` columns). Those ± figures were removed from
the site; the caption now reads "± is spread across seeds, shown where the aggregation
reports one."

**Decimal ROUND_HALF_UP, not float formatting.** Two values sit exactly on a rounding
boundary and float arithmetic rounds them in *opposite* directions for no principled
reason: `0.8675*100` is `86.75000000000001` in binary float, `0.1435*100` is
`14.349999999999998`. The table was generated with `decimal.Decimal` on the CSV's literal
strings. This makes two cells differ from the project README by 0.1 — see Open Threads.

**Table regenerated programmatically, not transcribed.** A throwaway Python script parsed
the CSV and emitted the `<tbody>` and the per-seed range list. Hand-transcribing 30 cells
was too error-prone given the user's "make no mistakes" instruction.

**Cursor: built, replaced, and reverted — the original design won.** The site's original
cursor is a dot + trailing ring that morphs into a labelled accent disc over elements
carrying `data-cursor`. It was replaced with a faithful copy of the square-ring cursor at
<https://adeia.xyz/>, then reverted in full when the user said *"I liked the old cursor
with it's previous designs. Revert it to that."* **Do not re-litigate this** — the
labelled-disc cursor is the chosen design.

Two things worth keeping from that detour:

- The user's written spec for the adeia cursor (dual-layer circles,
  `mix-blend-mode: difference`, `backdrop-filter: invert(100%)`, magnetic snap, elastic
  squish) **did not match that site at all.** The real implementation is a 6px square
  point plus a 34px square outline ring lerping at 0.18/frame, with none of those
  effects. When shown the discrepancy the user said *"no, please just do whatever's on
  the website."* **Lesson: verify the artifact, not the description of it.**
- That implementation hid the native cursor only *after* the script ran (a `has-cursor`
  class added on first pointermove). The current cursor instead adds `cursor-on` at init.
  The deferred approach is more robust — a script failure or a visitor who never moves
  the mouse keeps a working pointer. Worth porting if the cursor is touched again.

**Preloader is pure CSS.** It lifts itself via a keyframe animation regardless of whether
JS runs, so a JS failure cannot leave a permanent curtain over the page.

**VA lettermark over the ligature.** Three candidates were built and rendered at 16/20/
24/48/96px: a shared-diagonal ligature, a solid knockout tile, and a plain side-by-side
lettermark. The user picked the lettermark. Tradeoff accepted: more legible, less
distinctive — V and A adjacent leave a diagonal channel between them.

**Theme follows the OS until the toggle is used.** The system-derived value is
deliberately *not* persisted on load; only a click writes `va-theme` to `localStorage`.
Persisting on load would pin the theme and stop the site following the OS.

---

## 7. Conventions & working preferences

**Commits:** short imperative subject line, no body, **no `Co-Authored-By: Claude`
trailer and no Anthropic attribution of any kind.** The user was explicit about this and
it is stored in Claude Code memory at
`~/.claude/projects/C--Users-aggar-Documents-Apps-and-Projects-vyom-aggarwal-github-io/memory/no-claude-coauthor-trailer.md`.
Reason: the commit history is part of how the work is presented to colleges. The user
generally commits themselves — stage nothing and push nothing unless asked; just report
the suggested command.

**Code style:** the existing files are the spec. Notable habits: section banners with
`═══` box-drawing rules; comments explain *why*, not *what*, and often name the thing
that was rejected; BEM-ish class naming (`.tile--job`, `.beat__title`,
`.cursor__ring`); design tokens in `tokens.css` and never hard-coded colours
elsewhere; every interactive feature has a reduced-motion and a touch fallback.

**The user's bar for correctness is high.** Two separate messages ended with *"Make no
mistakes."* Verify numbers against their source rather than transcribing, and say plainly
when something is unverified.

**Things the user pushed back on this session — do not repeat:**

- Restyling instead of re-architecting. *"all you have done is change the formatting but
  have kept the layout the same as before."*
- Following their written description over the actual artifact. *"no, please just do
  whatever's on the website."*
- Adding Claude as a contributor.

**Reporting style that worked:** lead with what changed, state bugs found and fixed
including ones I introduced, flag discrepancies rather than silently picking a side, and
end with the suggested commit command.

---

## 8. Dead ends & known traps

**The IntersectionObserver `entries[0]` staleness bug — the most valuable thing here.**
Symptom: the quadruped rendered perfectly but never animated on GitHub Pages. Cause: the
rAF loop was started *only* by an IntersectionObserver callback that read `entries[0]`.
IO delivers batched records **oldest-first**, so a fast scroll into the section could
deliver `[false (stale), true (current)]` and the code acted on the stale `false` —
stopping a canvas already on screen, with nothing to restart it because IO only fires on
threshold *crossings*. Fixed in both `hero-gl.js` and `research-gl.js` by making geometry
the source of truth: a `shouldRun()` rect test plus a `sync()` called from IO, scroll,
resize, `visibilitychange`, ResizeObserver, and once at init. **If you add another
canvas, copy this pattern — do not gate a loop on a single observer reading.**

**How that bug hid from verification:** the rig test harness instantiated the module with
`reducedMotion: true`, which **disables the animation loop by design**. It verified static
poses and never once exercised motion. Before/after probe results: `advanced: false` →
`advanced: true`.

**The preview pane suspends `requestAnimationFrame` when not displayed.** Consequences hit
repeatedly: screenshots return stale frames or time out with *"the Browser pane is not
displayed, so the page is not compositing frames"*; CSS transitions freeze mid-flight so
`getComputedStyle` returns interpolated values (a settled `is-hot` ring read as
`34x34 r4px rot:0deg` instead of `52x52 r6px rot:45deg`); and any probe that awaits rAF
hangs until the 30s tool timeout. **Workaround that works:** inject
`transition: none !important`, toggle classes directly, and measure — or use `setTimeout`
rather than rAF for waits.

**Screenshots at a resized viewport render scaled-down into a corner.** Measure the DOM
instead of eyeballing scaled screenshots; several early conclusions from screenshots were
wrong.

**Bash heredocs break on large embedded HTML.** `unexpected EOF while looking for
matching '`. Write the script to a file and execute it.

**Split-text creates intra-word break opportunities.** In `chars` mode each glyph is its
own inline-block, so the hero title wrapped mid-word as "AGGARW / AL". Fixed with
`white-space: nowrap` on `.split .word` — fixed at the split level so it cannot recur on
any heading. A too-narrow `max-width` in `ch` units was the compounding cause.

**Fragile areas, touch carefully:**

- `shell.js` `SECTIONS` array must match the section ids in `index.html` or the sidebar
  index highlighting silently stops working.
- The work-filter counts in the `.filter` buttons are **hard-coded** in `index.html`.
  Adding a role means updating both `data-tags` and the count.
- The cursor markup lives in `index.html` (`.cursor > .cursor__dot + .cursor__ring >
  .cursor__label`) and `cursor.js` bails out if any of those three children is missing.
  Removing the markup silently disables the cursor rather than erroring.
- The research stage's beat count, the `smoothstep` ranges in `research-gl.js`, and the
  `PHASES` `at` values in `scrolly.js` are mutually calibrated. Changing the number of
  beats re-times everything, because beats are spaced as `floor(p * beats.length)`.

---

## 9. Open threads

Ranked by priority.

1. **Two site numbers differ from the project README by 0.1.** The site (from CSV, with
   `ROUND_HALF_UP`) shows `sensor_noise` recovery **86.8%** and `sensor_dropout` sd
   **± 14.4**. The project README says **86.7%** and **± 14.3**. The README also rounds
   `1.8635 → 1.864` (up) but `0.8675 → 86.7` (down) — inconsistent directions, which
   suggests the README was written from full-precision values *before* the CSV rounded
   them to 4dp. **If so the README is closer to truth and the CSV is a double-rounding
   hazard.** This is a question for Vyom: which should the site show? Both are defensible;
   the site currently follows the CSV because he said to use it.
2. **Commit and push the cursor revert.** It is sitting uncommitted in the working tree.
   Until it ships, the live site shows the square-ring cursor the user rejected.
3. **No Toolchain / Skills section on the site.** The Capabilities section was deleted at
   the user's request, but his GitHub profile README has a detailed toolchain table
   (Python, TypeScript, PyTorch, PyBullet, WebGL, LaTeX, CAD…). The site currently names
   no languages or tools anywhere. Worth asking whether he wants that back in some form —
   it is a real gap for a technical portfolio.
4. **No OG image.** `og:title`/`og:description` are set but there is no `og:image`, so
   link previews are bare text. UNVERIFIED whether he cares.
5. **`post_fault_distance` is in the CSV but not on the site.** Deliberate (column count),
   but flagging it as available data if the table is ever reworked.

---

## 10. Immediate next steps

1. **Read `README.md` in this repo** — it documents the grid system, the research stage
   timing, and the content-editing conventions, and is not duplicated here.
2. **Ask Vyom the Open Thread #1 question** (86.7 vs 86.8 — CSV or README?). It is a
   one-line fix either way, but it should not be guessed at, and it blocks nothing else.
3. **Commit and push the pending cursor revert** so the live site matches the tree:
   `git add -A && git commit -m "Restore previous cursor design" && git push`.
4. **Raise the Toolchain gap (#3)** and, if he wants it, design it as tiles in the
   existing `.deck` system rather than reviving the old Capabilities layout.

Serve locally with `python -m http.server 4173` before touching anything, and re-verify
by DOM measurement rather than screenshots.

---

## 11. External references

| What | URL |
|---|---|
| Live site | <https://vyom-aggarwal.github.io/> |
| This repo | <https://github.com/vyom-aggarwal/vyom-aggarwal.github.io> |
| Research project repo | <https://github.com/vyom-aggarwal/fault-recovery-quadruped-rl> |
| Research data (authoritative) | `C:\Users\aggar\Documents\Research\UCSC AIEA\Research Project\fault-recovery-quadruped-rl\logs\across_seed_summary.csv` |
| Research project README | `C:\Users\aggar\Documents\Research\UCSC AIEA\Research Project\fault-recovery-quadruped-rl\README.md` |
| Cursor design (tried, then reverted) | <https://adeia.xyz/> — real implementation is in its `motion.js`, not the description of it |
| Scrollytelling structure referenced | <https://suhaslord.github.io/portfolio/> (`.scroll-stage` / sticky inner pattern) |
| Vyom's GitHub profile README | source for the section 01 profile copy and the unused toolchain table |
| LinkedIn | <https://www.linkedin.com/in/vyom-aggarwal/> |
