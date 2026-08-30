# HANDOFF

Written 2026-08-30. Verified against the repo at commit `4f16e55`: working tree **clean**,
`main` in sync with `origin/main`, live site serving HTTP 200 with the current code deployed.

> **Read Open Thread #1 before touching the research section.** The upstream research data
> was re-run on 2026-08-30 and the site's numbers are now stale. This is the single most
> important thing in this document.

---

## 1. Orientation

This is **Vyom Aggarwal's personal portfolio website** — a static site deployed at
<https://vyom-aggarwal.github.io/> from the repo root via GitHub Pages. Vyom is a
15-year-old high-school sophomore (River Islands HS, class of 2029, dual-enrolled at
San Joaquin Delta College) doing machine-learning research at MIT CSAIL and the UC Santa
Cruz AIEA Lab. The audience is college admissions, research labs, and potential
collaborators, so **factual precision matters more than polish** — multiple sessions have
gone into making the reported research numbers match their source data exactly.

The site is **complete, live, and shipped**. It is not a work-in-progress build; it is a
finished artifact being iterated on. No build step, no bundler, no package manager, no
dependencies. Plain HTML, CSS, and ES modules.

---

## 2. Mission & scope

**Original ask (user's words):** *"take my current portfolio website and give it an
absolute rework from the ground-up, making it look so much cooler and cleaner than it was
before... take other revolutionary portfolios for people in my field as reference...
clean animations, a cool custom cursor effect, and potentially 3d objects... doesn't have
to be in just a single html file... keep it in a format that will allow it to still work
with github pages."*

**How it evolved, in order:**

1. Rebuilt the single 660-line `index.html` into a multi-file static site.
2. User rejected that first pass — *"all you have done is change the formatting but have
   kept the layout the same as before."* → full re-architecture to a fixed console sidebar
   plus a modular tile grid.
3. Logo: replaced a lone "V" mark with a **VA lettermark** (user chose from three
   candidates rendered at 16/20/24/48/96px).
4. Deleted the Capabilities/Skills section entirely, at the user's request.
5. Added the **scroll-driven research section** (section 02) with a WebGL quadruped rig,
   structurally modelled on <https://suhaslord.github.io/portfolio/>.
6. Fixed a real bug: both WebGL animation loops silently stalling (see §8).
7. Updated the research section twice — first from an updated project README, then
   corrected again from the authoritative CSV.
8. Replaced the cursor with a copy of the one at <https://adeia.xyz/>, then **reverted it
   in full** when the user said they preferred the original. Reverted state is live.

**Explicitly out of scope:**

- No build tooling, framework, or npm dependency. Hard constraint from the first message,
  never relaxed.
- No CMS or data file — all copy lives inline in `index.html` by design.
- No inertial/smooth-scroll hijacking (adeia.xyz has one; deliberately not copied).
- No sim-to-real or overstated research claims. The research section states what is *not
  yet built* as prominently as what is.

---

## 3. Current state

**Working end to end, verified this session:**

- All six sections render and navigate: `overview`, `research`, `work`, `education`,
  `awards`, `contact`.
- Console sidebar: live section index, scroll progress, Lathrop-time clock, theme toggle.
  Collapses to a top bar plus overlay menu below 1100px.
- Hero WebGL object (noise-displaced icosphere, point cloud + wireframe).
- Research scrollytelling stage: 6 beats, telemetry readout, quadruped rig.
- Custom cursor: hard accent dot tracking exactly, plus a ring easing behind at 0.16/frame
  that swells into a filled accent disc with an uppercase mono label over `[data-cursor]`
  elements, and a soft outlined ring over other interactive elements. States: `is-hot`,
  `is-soft`, `is-down`, `is-idle`.
- Light/dark theming across every component including both WebGL canvases.
- Role filter on the work deck (counts verified: all 10 / research 3 / robotics 2 /
  math 2 / leadership 5).
- Reduced-motion and touch fallbacks throughout.
- Structural checks pass: HTML tag balance, all `assets/` references resolve, all 9 JS
  modules parse as ESM.
- Deployed and current — `curl` confirms `index.html`, `main.js`, `cursor.js`, `base.css`
  all return 200, and the live `cursor.js` is the restored dot-ring implementation.

**STALE — the research section's numbers no longer match their source.** Not cosmetically
wrong; factually superseded. Full detail in Open Thread #1. Summary: the CSV was re-run
from 6 converged seeds to **10 seeds** and every figure changed. Two narrative claims on
the site are now **false**, not merely outdated.

**Half-built / inert:** nothing.

**Known imperfect, not broken:**

- The research results table has 6 columns and scrolls horizontally inside
  `.rtable__wrap` below roughly 950px viewport width. By design (`overflow-x: auto`), but
  the least elegant part of the layout.
- `post_fault_distance` exists in the source CSV but is not shown — deliberate, to hold
  the table to 6 columns.

**Broken:** nothing known.

---

## 4. Architecture map

**Stack:** static HTML + CSS + vanilla ES modules. Raw WebGL2 for both 3D objects (no
Three.js). Google Fonts via CDN (Archivo, Inter, Instrument Serif, JetBrains Mono).
Zero npm dependencies, zero build step.

**Data flow:** `index.html` loads 5 stylesheets and one module entry point
(`assets/js/main.js`), which imports and initialises 8 sibling modules. All page copy is
inline in `index.html`; nothing is injected from JS. Scroll position drives the research
stage: `scrolly.js` computes a 0→1 progress value from the sticky stage's bounding rect
and pushes it into `research-gl.js`.

| Path | Role | Why it matters |
|---|---|---|
| `index.html` | All markup and all copy, 658 lines | Single source of content. Every text edit happens here. |
| `assets/js/main.js` | Entry point, 49 lines | Wires all modules; holds reveal animations until the preloader lifts. |
| `assets/js/research-gl.js` | Quadruped rig, raw WebGL2, 516 lines | Most complex file. Gait IK, fault simulation, camera. Timing constants are hard-coded to measured data — see Open Thread #1. |
| `assets/js/scrolly.js` | Drives the research stage from scroll | Maps scroll → progress → rig state + beat panels + telemetry. `PHASES` array holds the readout copy. |
| `assets/js/hero-gl.js` | Hero icosphere, raw WebGL2, 548 lines | Largest file; shares the `shouldRun()`/`sync()` loop pattern with research-gl. |
| `assets/js/cursor.js` | Custom cursor, 82 lines | Drives the `.cursor` markup in `index.html`; reads `data-cursor` for label text. |
| `assets/js/shell.js` | Progress, section index, theme, menu, clock | `SECTIONS` array must stay in sync with section ids in `index.html`. |
| `assets/js/interact.js` | Magnetic buttons, tile tilt, spotlight, text scramble | Small effects; `[data-magnetic]`, `[data-scramble]`. |
| `assets/js/work.js` | Role filter, 47 lines | Reads `data-tags`; filter counts are hard-coded in the HTML. |
| `assets/js/reveal.js` | Split-text + scroll entrances | `[data-reveal]`, `[data-split]`, `[data-stagger]`. |
| `assets/css/tokens.css` | All design tokens + the light theme | Every colour/size/timing defined here first. Change colours here, nowhere else. |
| `assets/css/base.css` | Reset, atmosphere, cursor, buttons, reveal | Cursor CSS lives here, not in a separate file. |
| `assets/css/tiles.css` | The 12-col grid, `.deck`, and every tile | Layout system for everything except the research stage. |
| `assets/css/research.css` | The pinned stage + results tables | `.stage { height }` controls how long the pinned sequence lasts. |
| `README.md` | Developer docs for the site itself | Documents the grid system, the research stage timing, and editing conventions. **Read it — not redundant with this file.** |
| `.well-known/discord` | Discord domain verification, 45 bytes | Do not delete; it is why the domain verifies. |

---

## 5. Environment & runbook

Machine is **Windows 11 / PowerShell**. Verified tooling: Python 3.13.14, Node v24.18.1,
git 2.45.1.windows.1.

**Clean clone → running:**

```bash
git clone https://github.com/vyom-aggarwal/vyom-aggarwal.github.io.git
cd vyom-aggarwal.github.io
```

There is **nothing to install**. No `npm install`, no venv, no env vars, no services, no
database, no secrets. N/A for all of those.

**Run locally** — you must serve over HTTP. ES modules do not load over `file://`, so
double-clicking `index.html` yields a blank page:

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

**Tests:** no test suite. N/A. Verification is done by DOM measurement in a live browser
plus these static checks:

```bash
# every JS module parses as ESM
# (node --check treats bare .js as CJS and fails on `import`, hence the .mjs copies)
tmp=$(mktemp -d); for f in assets/js/*.js; do cp "$f" "$tmp/$(basename ${f%.js}).mjs"; done
for f in "$tmp"/*.mjs; do node --check "$f" || echo "SYNTAX ERROR: $f"; done; rm -rf "$tmp"

# HTML tag balance
python -c "
import re,pathlib
s=pathlib.Path('index.html').read_text(encoding='utf-8')
bad=[t for t in ['html','head','body','section','article','div','main','header','nav',
                 'table','tbody','thead','tr','ul','ol','dl','a','p','h1','h2','h3']
     if len(re.findall(r'<%s[\s>]'%t,s))!=len(re.findall(r'</%s>'%t,s))]
print('MISMATCH:',bad) if bad else print('all balanced')"

# every local asset reference resolves
grep -oE '(href|src)="assets/[^"]+"' index.html | sed 's/.*="//;s/"$//' | sort -u \
  | while read f; do [ -f "$f" ] || echo "MISSING $f"; done
```

**Build:** none. **Deploy:** `git push` to `main`; GitHub Pages serves the repo root.
`.nojekyll` is present so Jekyll does not process the tree.

**Windows gotchas actually hit:**

- Git reports `LF will be replaced by CRLF` on JS files. Cosmetic; ignore.
- Bash heredocs (`python - <<'PYEOF'`) **break** when the body contains large amounts of
  embedded HTML — real error: `unexpected EOF while looking for matching '`. Write the
  script to a file and run it. This cost a cycle; don't repeat it.
- `.claude/` exists locally (tooling config) and is gitignored. Leave it alone.

---

## 6. Decisions & rationale

**No framework, no build step, no dependencies.** Constraint from the user's first message
("keep it in a format that will allow it to still work with github pages"). Everything
downstream follows from this.

**Raw WebGL2 instead of Three.js.** A CDN script tag would have been simpler but adds a
network dependency that can fail and ~150KB. Both 3D objects are hand-written shaders plus
small mat4 helpers. *Rejected:* Three.js via CDN; a CSS-3D fallback.

**Console sidebar + tile grid, not stacked sections.** The first rebuild kept the original
vertical band-per-section structure and was rejected outright. Current architecture is a
fixed ~306px sidebar plus a scrolling canvas of modular tiles. Rationale: the content is
many small discrete facts (10 roles, 6 awards, 2 schools), which a tile grid serves far
better than full-width bands. *Rejected:* horizontal scroll; split-screen sticky; pure
bento with no sidebar.

**Two grid systems, deliberately.** `.grid` is 12 columns with per-tile spans (`.s12` …
`.s3`) where asymmetry is intentional (the awards bento). `.deck` is
`auto-fill minmax()` for uniform sets (roles, schools) so they reflow without spans.

**Role cards show their description outright — no accordion.** The original site made you
click each of 10 rows. Removing the interaction removed a barrier; the filter is the only
interaction left.

**The research scroll IS the experiment timeline, not just a trigger.** Scroll maps to the
500 control steps of one Baseline A trial. Injection lands at p=0.40 = **step 200** exactly
(matching the protocol). Recovery completes at p=0.66 = step 330 = **2.17 s post-fault**.
The velocity readout drops by `joint_lock`'s measured velocity drop and returns to within
15% of baseline — precisely what the scoring criterion calls *recovered*. The seized leg
stays seized throughout, because that is the project's actual claim.

Constants live in `research-gl.js`:

```js
state.fault    = smoothstep(0.38, 0.48, state.progress);
state.recovery = smoothstep(0.52, 0.66, state.progress);
state.speed    = 1 - 0.449 * state.fault * (1 - 0.82 * state.recovery);
//                   ^^^^^ joint_lock's measured velocity drop
```

**These are calibrated to the 6-seed data and are now stale — see Open Thread #1.**

**The stage is labelled `Mode: Schematic` in its telemetry.** The residual module does not
exist yet, so the animation depicts a *hypothesis*. The label stops it being read as data.

**CSV beats README when they disagree.** `logs/across_seed_summary.csv` in the research
repo is authoritative. The project README showed ± values on the *Degraded* and *Velocity
drop* columns that **do not exist in the CSV** (there are no `degradation_rate_sd` or
`velocity_drop_sd` columns). Those were removed; the caption reads "± is spread across
seeds, shown where the aggregation reports one."

**Decimal ROUND_HALF_UP, not float formatting.** Two values sat exactly on a rounding
boundary and float arithmetic rounded them in *opposite* directions for no principled
reason: `0.8675*100` is `86.75000000000001` in binary float, `0.1435*100` is
`14.349999999999998`. The table was generated with `decimal.Decimal` on the CSV's literal
strings. **Keep this approach when regenerating.**

**Table regenerated programmatically, not transcribed.** A throwaway Python script parsed
the CSV and emitted the `<tbody>` and per-seed range list. Hand-transcribing 30 cells was
too error-prone given the user's explicit "make no mistakes."

**Cursor: built, replaced, reverted — the original design won.** The site's cursor is a
dot plus trailing ring that morphs into a labelled accent disc over `[data-cursor]`
elements. It was replaced with a faithful copy of the square-ring cursor at
<https://adeia.xyz/>, then reverted in full when the user said *"I liked the old cursor
with it's previous designs. Revert it to that."* **Do not re-litigate this.** The revert
(`4f16e55`) was verified byte-identical to the pre-swap state via
`git diff 44c71c5~1 4f16e55 -- index.html assets/` returning empty.

Two things worth keeping from that detour:

- The user's written spec for the adeia cursor (dual-layer circles,
  `mix-blend-mode: difference`, `backdrop-filter: invert(100%)`, magnetic snap, elastic
  squish) **did not match that site at all.** The real implementation is a 6px square
  point plus a 34px square outline ring lerping at 0.18/frame, with none of those effects.
  Shown the discrepancy, the user said *"no, please just do whatever's on the website."*
  **Lesson: verify the artifact, not the description of it.**
- That implementation hid the native cursor only *after* the script ran (a `has-cursor`
  class added on first pointermove). The current cursor adds `cursor-on` at init. The
  deferred approach is more robust — a script failure or a visitor who never moves the
  mouse keeps a working pointer. Worth porting if the cursor is touched again.

**Preloader is pure CSS.** It lifts itself via a keyframe animation regardless of whether
JS runs, so a JS failure cannot leave a permanent curtain over the page.

**VA lettermark over the ligature.** Three candidates were built and rendered at
16/20/24/48/96px: a shared-diagonal ligature, a solid knockout tile, and a plain
side-by-side lettermark. The user picked the lettermark. Tradeoff accepted: more legible,
less distinctive — V and A adjacent leave a diagonal channel between them.

**Theme follows the OS until the toggle is used.** The system-derived value is deliberately
*not* persisted on load; only a click writes `va-theme` to `localStorage`. Persisting on
load would pin the theme and stop the site following the OS.

---

## 7. Conventions & working preferences

**Commits:** short imperative subject line, **no `Co-Authored-By: Claude` trailer and no
Anthropic attribution of any kind.** The user was explicit; it is stored in Claude Code
memory at
`~/.claude/projects/C--Users-aggar-Documents-Apps-and-Projects-vyom-aggarwal-github-io/memory/no-claude-coauthor-trailer.md`.
Reason: the commit history is part of how the work is presented to colleges. **The user
commits and pushes themselves** — stage nothing, push nothing unless asked; report the
suggested command and let them run it. (Observed repeatedly: they commit with their own
message wording shortly after each hand-off.)

**Code style:** the existing files are the spec. Notable habits: section banners with
`═══` box-drawing rules; comments explain *why*, not *what*, and often name the rejected
alternative; BEM-ish class naming (`.tile--job`, `.beat__title`, `.cursor__ring`); design
tokens in `tokens.css` and never hard-coded colours elsewhere; every interactive feature
has a reduced-motion and a touch fallback.

**The user's bar for correctness is high.** Multiple messages ended with *"Make no
mistakes."* Verify numbers against their source rather than transcribing, and label
anything unverified.

**Things the user pushed back on — do not repeat:**

- Restyling instead of re-architecting. *"all you have done is change the formatting but
  have kept the layout the same as before."*
- Following their written description over the actual artifact. *"no, please just do
  whatever's on the website."*
- Adding Claude as a contributor.

**Reporting style that worked:** lead with what changed; state bugs found and fixed
including self-inflicted ones; flag discrepancies rather than silently picking a side; end
with the suggested commit command.

---

## 8. Dead ends & known traps

**The IntersectionObserver `entries[0]` staleness bug — the most valuable item here.**
Symptom: the quadruped rendered perfectly but never animated on GitHub Pages. Cause: the
rAF loop was started *only* by an IntersectionObserver callback reading `entries[0]`. IO
delivers batched records **oldest-first**, so a fast scroll could deliver
`[false (stale), true (current)]` and the code acted on the stale `false` — stopping a
canvas already on screen, with nothing to restart it because IO only fires on threshold
*crossings*. Fixed in both `hero-gl.js` and `research-gl.js` by making geometry the source
of truth: a `shouldRun()` rect test plus a `sync()` called from IO, scroll, resize,
`visibilitychange`, ResizeObserver, and once at init. **If you add another canvas, copy
this pattern — never gate a loop on a single observer reading.** Shipped in `e68f620`.

**How that bug hid from verification:** the rig test harness instantiated the module with
`reducedMotion: true`, which **disables the animation loop by design**. It verified static
poses and never exercised motion. Before/after probe: `advanced: false` → `advanced: true`.

**The preview pane suspends `requestAnimationFrame` when not displayed.** Hit repeatedly:
screenshots return stale frames or time out with *"the Browser pane is not displayed, so
the page is not compositing frames"*; CSS transitions freeze mid-flight so
`getComputedStyle` returns interpolated values (a settled `is-hot` ring read as
`34x34 r4px rot:0deg` instead of `52x52 r6px rot:45deg`); any probe awaiting rAF hangs to
the 30s tool timeout. **Workaround that works:** inject `transition: none !important`,
toggle classes directly, and measure — or use `setTimeout` rather than rAF for waits.

**Screenshots at a resized viewport render scaled-down into a corner.** Measure the DOM
instead; several early conclusions drawn from scaled screenshots were wrong.

**Bash heredocs break on large embedded HTML.** `unexpected EOF while looking for matching
'`. Write the script to a file and execute it.

**Split-text creates intra-word break opportunities.** In `chars` mode each glyph is its
own inline-block, so the hero title wrapped mid-word as "AGGARW / AL". Fixed with
`white-space: nowrap` on `.split .word` — at the split level, so it cannot recur on any
heading. A too-narrow `max-width` in `ch` units was the compounding cause.

**Fragile areas, touch carefully:**

- `shell.js` `SECTIONS` array must match the section ids in `index.html` or sidebar index
  highlighting silently stops working. Currently
  `['overview','research','work','education','awards','contact']`.
- Work-filter counts in the `.filter` buttons are **hard-coded** in `index.html`. Adding a
  role means updating both `data-tags` and the count.
- The cursor markup lives in `index.html` (`.cursor > .cursor__dot + .cursor__ring >
  .cursor__label`) and `cursor.js` **bails out silently** if any of those three children is
  missing — removing markup disables the cursor rather than erroring.
- The research stage's beat count, the `smoothstep` ranges in `research-gl.js`, and the
  `PHASES` `at` values in `scrolly.js` are mutually calibrated. Changing the beat count
  re-times everything, because beats are spaced as `floor(p * beats.length)`.

---

## 9. Open threads

Ranked by priority.

### 1. The research data was re-run; the site is stale and two claims are now FALSE

`across_seed_summary.csv` was regenerated **2026-08-30 13:12** with **10 seeds** (was 6
converged of 10). Every figure changed. The site and the project README both still show
the old 6-seed numbers. The project README (`2026-08-22 14:40`) predates the new CSV, so
**it is stale too** — do not sync the site to the README.

Current CSV, ordered by recovery rate:

| Fault | Degraded | Vel. drop | Recovery | Falls | Rec. time |
|---|---|---|---|---|---|
| `actuation_delay` | 100.0% | 98.5% | 1.2% ± 1.4 | **78.5% ± 12.2** | 2.340 s ± 0.617 |
| `torque_limit` | 93.7% | 57.4% | 43.1% ± 8.4 | 31.1% ± 11.1 | 1.679 s ± 0.340 |
| `joint_lock` | 94.9% | 49.8% | 53.7% ± 8.2 | 4.2% ± 8.2 | 1.896 s ± 0.180 |
| `sensor_dropout` | 83.9% | 31.7% | 79.6% ± 7.5 | 2.6% ± 4.6 | 1.729 s ± 0.146 |
| `sensor_noise` | 84.7% | 29.3% | 82.3% ± 8.2 | 2.0% ± 4.6 | 1.622 s ± 0.141 |

New per-seed recovery ranges (n = 10): `actuation_delay` 0–4%, `torque_limit` 32–60%,
`joint_lock` 41–68%, `sensor_dropout` 68–88%, `sensor_noise` 64–94%.

**Two narrative claims are now factually wrong, not just outdated:**

- `index.html` line 353: *"the only fault that topples the robot"* about `torque_limit`.
  **False** — `actuation_delay` now falls **78.5%** vs `torque_limit`'s 31.1%. This is the
  most serious item: it is a wrong factual claim on a page shown to research labs.
- Beat 06 (`index.html` lines 310-311): *"runs from 0% on actuation_delay to 86.8% on
  sensor_noise."* Now **1.2% to 82.3%**. Also `actuation_delay` is no longer a clean 0%
  floor effect.

**Still true and safe to keep:** the physics/sensor separation with no overlap — max
physics-side is `joint_lock` 53.7%, min sensor-side is `sensor_dropout` 79.6%.

**Also needs updating if the site is resynced:**

- Caption: "6 converged seeds × 100 trials" → n is now 10.
- Beat 02: *"six converged to a usable gait, and only those six are allowed"*.
- Training-reliability tile: `Converged 6 / 10 · 60%`, `Excluded 1, 3, 5, 9`,
  `Forward speed 0.585 ± 0.053 m/s`, `Wall clock ~18.6 h` — **all UNVERIFIED against the
  new run**; the CSV does not carry these, they came from the project README. Ask Vyom or
  get a fresh manifest before trusting them.
- Rig constants in `research-gl.js`: hard-coded `0.449` velocity drop → CSV now `0.4978`;
  README/`README.md` cite 2.222 s recovery time → CSV now `1.8959`. Retiming the stage to
  1.896 s means recovery should complete near p ≈ 0.63 rather than 0.66.

**Question for Vyom before acting:** is this new CSV final, and are the training-reliability
figures (convergence count, excluded seeds, forward speed, wall clock) still accurate for
the 10-seed run? Regenerate the table programmatically with `Decimal`/`ROUND_HALF_UP`, not
by hand.

### 2. No Toolchain / Skills section

The Capabilities section was deleted at the user's request, but his GitHub profile README
has a detailed toolchain table (Python, TypeScript, PyTorch, PyBullet, WebGL, LaTeX, CAD…).
The site names no languages or tools anywhere — a real gap for a technical portfolio.
Worth asking whether he wants it back, and if so build it as tiles in the existing `.deck`
system rather than reviving the old layout.

### 3. No OG image

`og:title` and `og:description` are set; there is no `og:image`, so link previews are bare
text. UNVERIFIED whether he cares.

### 4. `post_fault_distance` is in the CSV but not on the site

Deliberate (column count), flagged only as available data if the table is ever reworked.

---

## 10. Immediate next steps

1. **Read `README.md` in this repo** — it documents the grid system, the research stage
   timing, and the content-editing conventions, and is not duplicated here.
2. **Raise Open Thread #1 with Vyom.** Lead with the false claim — `torque_limit` is
   described as "the only fault that topples the robot" and that is no longer true
   (`actuation_delay` now falls 78.5%). Ask whether the new 10-seed CSV is final and
   whether the training-reliability figures still hold.
3. **Once confirmed, regenerate the research section from the CSV** — table body, per-seed
   ranges, caption, beat 02 and beat 06 copy, and the training-reliability tile. Use a
   Python script with `decimal.Decimal` + `ROUND_HALF_UP` reading the CSV directly; do not
   transcribe by hand.
4. **Retime the rig** in `research-gl.js` to the new `joint_lock` figures (velocity drop
   0.4978, recovery time 1.896 s) and update the matching prose in `README.md`.
5. **Raise Open Thread #2** (Toolchain gap) once the data work is settled.

Serve locally with `python -m http.server 4173` before touching anything, and verify by DOM
measurement rather than screenshots (§8).

---

## 11. External references

| What | URL / path |
|---|---|
| Live site | <https://vyom-aggarwal.github.io/> |
| This repo | <https://github.com/vyom-aggarwal/vyom-aggarwal.github.io> |
| Research project repo | <https://github.com/vyom-aggarwal/fault-recovery-quadruped-rl> |
| Research data (authoritative) | `C:\Users\aggar\Documents\Research\UCSC AIEA\Research Project\fault-recovery-quadruped-rl\logs\across_seed_summary.csv` |
| Research project README (stale as of 2026-08-22) | `C:\Users\aggar\Documents\Research\UCSC AIEA\Research Project\fault-recovery-quadruped-rl\README.md` |
| Cursor design tried, then reverted | <https://adeia.xyz/> — real implementation is in its `motion.js`, not the description of it |
| Scrollytelling structure referenced | <https://suhaslord.github.io/portfolio/> (`.scroll-stage` / sticky-inner pattern) |
| Vyom's GitHub profile README | Source for the section 01 profile copy and the unused toolchain table |
| LinkedIn | <https://www.linkedin.com/in/vyom-aggarwal/> |
