# HANDOFF

Written 2026-09-10, when the redesign was promoted from `redesign/` to the
repository root and became the live site.

Status and quirks live here and are expected to rot. The code wins.

---

## 1. Orientation

Vyom Aggarwal's portfolio: a 15-year-old sophomore at River Islands High School,
dual-enrolled at San Joaquin Delta College, doing student research at MIT CSAIL
and the AIEA Lab at UC Santa Cruz, plus a Lumiere fellowship.

The audience is research mentors, lab PIs, internship reviewers and admissions
readers, and they are skeptical by default. **The site's credibility comes from
what it refuses to claim**, not from what it asserts. Both project write-ups
state plainly what is not built and what is not verified, and the fault-recovery
project keeps the paragraph explaining that every recovery figure predating a
criterion rebuild was discarded. Do not trim those to save space. They are the
most persuasive thing on the page.

The positioning is aerospace-directed: control that has to hold after something
breaks. The word "aerospace" does not appear anywhere in the copy, deliberately.
Every truthful sentence available says fault tolerance, control or simulation;
the word itself would require claiming a role, a course or an affiliation that
does not exist. The headline carries the direction instead.

---

## 2. Ground rules that shaped the build

- **No invented facts.** Every number on the page traces to something real: the
  research repository's CSVs, the Codon Lab README, or a structure file. Where a
  figure could only be obtained by inventing it, there is no figure.
- **No build step.** Static files, served as-is. `tools/stamp.py` writes cache
  busters into the source and its output is committed; the site never needs it
  run to serve correctly.
- **One accent.** Three blues sampled from Earth from orbit, plus a single warm
  fault colour and the photographic warmth of city lights. No fourth hue.
- **Dark only.** No light variant, no toggle.

---

## 3. Current state

Working and verified in a browser: the hero scene, the two project overlays and
their simulations, the stepper, the role filter, deep links, focus management,
scroll locking and restoration, and the no-JavaScript path.

Measured, most recently before the hero became the Earth scene:

| | Desktop | Mobile, throttled 4G |
|---|---|---|
| Lighthouse performance | 97 | 98 |
| Accessibility | 100 | 96 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| Largest Contentful Paint | 1.2 s | 2.1 s |
| Cumulative Layout Shift | 0 | 0 |

**These numbers predate the Earth hero, the project launcher and both in-dialog
simulations. They need re-running.** That is the first thing to do.

The mobile accessibility 96 is one finding: the decorative pixel wordmark at
1.65:1. That contrast is deliberate, it carries no information, and WCAG exempts
incidental text. Do not "fix" it by raising the contrast.

---

## 4. Things that have bitten, more than once

**Cache staleness.** This cost hours across the build, twice producing a page
that appeared not to have changed at all. Two causes, both now handled: the dev
server sends no-store, and every asset URL carries a content hash. If something
looks stale, check the served bytes with `curl` before believing the browser.

**Find-and-replace against stamped URLs.** Editing a reference by plain string
match silently misses once `?v=` has been appended. It has produced a model
swapped but its poster left pointing at the old image, and an import line that
quietly failed. Always match the stamp optionally: `foo\.js(\?v=[0-9a-f]+)?`.

**Premultiplied alpha.** Three.js canvases are premultiplied, so additive
blending uses `blendSrc = ONE`. A shader writing `vec4(colour, a)` adds the full
colour regardless of alpha and blows out to white. Write `vec4(colour * a, a)`.
Both the atmosphere and the shared halo had this bug.

**`overflow: hidden` disables `position: sticky`** in every browser. The panel
holding a sticky stage must opt out; `.panel--stage` exists for that.

**Opacity on an ancestor removes descendants from Chrome's LCP candidate set.**
Fading the whole panel in on load suppressed the metric entirely on mobile. The
entrance is transform-only for that reason.

**The preview pane in the Claude Code desktop app runs `requestAnimationFrame`
at 1 fps.** Nothing animated can be judged there, and several apparent bugs were
that throttling. Verify motion in a real browser window.

**Headless Chrome barely runs rAF either.** Screenshots catch stale frames, and
a `toDataURL` a tick after a render returns an empty image because WebGL clears
the drawing buffer after compositing. Render and read in the same task; the
scene modules expose `snapshot()` for exactly this.

---

## 5. Open threads

1. **Re-run Lighthouse.** See §3.
2. **The Codon Lab repository is private.** The panel currently ends with a line
   saying it is available on request. Decide: link it, make it public, or drop
   the line.
3. **Safari is untested.** `backdrop-filter` on the glass and the masked wordmark
   layering are the two things most likely to differ.
4. **The quadruped is a stand-in.** It is geometry authored from primitives in
   Laikago proportions. The URDF the research actually trains on ships inside
   pybullet's own data directory, not in the project repository, so its
   redistribution licence was never cleared. Swapping it means replacing one
   function in `assets/js/kit.js`.
5. **The old site is gone from the root but lives in history.** If anything from
   it is wanted back, it is in the commits before this promotion.

---

## 6. Repository

The site is the root. `.claude/` holds local tooling and is gitignored, so
`devserver.py` will not be in a fresh clone — the README documents it, and
`python -m http.server` is a workable substitute if you remember the caching
caveat.
