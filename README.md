# vyom-aggarwal.github.io

Personal portfolio. Plain static files — no build step, no bundler, no
dependencies. GitHub Pages serves the repo root as-is.

## Layout

A fixed **console** on the left holds identity, live status, the section
index, and contact links. Beside it a **canvas** scrolls through modular
tiles rather than full-width bands, so density can vary: the masthead is a
panel, metrics are small cards, roles are a deck, awards are a bento of
mixed spans.

Below 1100px the console folds into a top bar with an overlay menu.

## Structure

```
index.html              all page content lives here
404.html                styled not-found page
.nojekyll               skip Jekyll processing
assets/
  favicon.svg
  css/
    tokens.css          colour / type / space / motion variables + light theme
    base.css            reset, atmosphere, cursor, buttons, chips, reveal
    shell.css           console sidebar, mobile bar, overlay menu, footer
    tiles.css           the grids and every tile that sits in them
    research.css        the pinned research stage + results tables
  js/
    main.js             entry point, wires everything together
    hero-gl.js          the hero object (raw WebGL2, no library)
    research-gl.js      the quadruped rig (raw WebGL2, no library)
    scrolly.js          drives the research stage from scroll position
    cursor.js           custom cursor
    reveal.js           split-text + scroll entrances
    shell.js            progress, section index, theme, menu, clock
    work.js             role filter
    interact.js         magnetic buttons, tile tilt, spotlight, text scramble
```

## The research stage

Section 02 is a scrollytelling block: `.stage` is a tall scroll track whose
`.stage__pin` child sticks for the duration. Scroll position through it
becomes a 0→1 value that cross-fades the six `.beat` panels, updates the
telemetry readout, and drives the quadruped.

The rig is not decoration — the scroll *is* one Baseline A trial, mapped to
its 500 control steps. A healthy trot runs until p = 0.40, i.e. **step 200**,
where a leg seizes (`joint_lock`) and the body lists toward the dead corner.
Recovery completes at p = 0.66 — step 330, **2.17 s post-fault**, against the
measured `joint_lock` recovery time of 2.222 s. The velocity readout drops by
`joint_lock`'s measured 44.9% and returns to within 15% of baseline, which is
exactly what the scoring criterion calls *recovered*.

**The locked leg stays locked** throughout. That is the claim: the residual
corrects *around* a fault, it does not repair it.

The readout on the stage is a schematic of the mechanism. The measured
numbers live in the tiles underneath it.

To retime the beats, edit the `smoothstep` ranges in `research-gl.js`
(`setProgress`) and the `at` values in `scrolly.js` (`PHASES`); to change how
long the sequence lasts, edit `.stage { height }` in `research.css`.

## Editing content

All copy is in `index.html` — there is no CMS or data file, so a section
reads the same in the source as it does on the page.

**Grids.** `.grid` is 12 columns and each tile declares its own span
(`.s12`, `.s8`, `.s6`, `.s4`, `.s3`) — use it where the asymmetry is
deliberate, like the awards bento. `.deck` auto-fills equal columns and
needs no spans — use it for uniform sets like the roles.

**Adding a role:** copy an existing `<li class="tile tile--job">`. Two
things must stay in sync:

1. `data-tags` on the `<li>` — any of `research robotics math leadership`
2. the counts in the `.filter` buttons above the deck

Add `is-lead` to a role tile to give it the accent treatment.

## Local preview

ES modules do not load over `file://`, so open it through a server rather
than double-clicking `index.html`:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Notes

- **Progressive enhancement.** With JavaScript disabled the page still
  renders, reads, and navigates; it just loses the animation and the 3D
  object. Nothing is injected from JS.
- **The 3D object** is a noise-displaced icosphere drawn as a wireframe plus
  a point cloud, written directly against WebGL2. If the context is
  unavailable it falls back to the CSS gradient behind it.
- **Reduced motion** is honoured throughout: no preloader, no cursor, no
  entrance animations, and the object renders a single static frame.
- **Theme** follows the OS until the toggle is used, after which the choice
  is remembered in `localStorage` under `va-theme`.
- Press <kbd>G</kbd> to outline the tiles while adjusting layout.
