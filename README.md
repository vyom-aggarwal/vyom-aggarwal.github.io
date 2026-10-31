# vyom-aggarwal.github.io

Personal portfolio for Vyom Aggarwal, served from this repository's root by
GitHub Pages at <https://vyom-aggarwal.github.io/>.

Static HTML, CSS and ES modules. No framework, no bundler, no package manager,
no dependency install. Open `index.html` and it runs.

---

## Running it locally

```bash
python .claude/devserver.py 4321
```

Then open <http://localhost:4321/>.

That is a plain static server with caching switched off. `python -m http.server`
also works, but it sends no cache headers, so browsers hold on to old scripts
and images across reloads and you end up looking at yesterday's build.

---

## Layout

```
index.html          The whole page. Every word of both project write-ups is in
                    here, including the content inside the dialogs, so a crawler
                    and a visitor without JavaScript both read all of it.
404.html

assets/css/         tokens · base · hero · sections · projects
assets/js/          hero      page chrome: theme, menu, ruler, ⌘K, G grid, entrances
                    cursor    the custom cursor (point, lagging ring, hover states)
                    terrain   the hero's potential-field map (raw WebGL)
                    demos     the two research demos in 3D: the quadruped, the flyby
                    sections  experience filter and the pinned research slides
                    projects · flyby   the write-up dialogs and the 2D flyby explorer
                    oberth.js   the Oberth atlas's flyby simulator, vendored
                    three.module.min.js   vendored, MIT
assets/fonts/       Geist, Geist Mono — SIL OFL
assets/img/         icons
tools/stamp.py      Cache-busting stamper. See below.
```

`assets/css/tokens.css` is the single source for every colour, size, space and
duration. Nothing downstream hardcodes a value, and the measured contrast of
every text pair is recorded in that file's header.

---

## After changing anything under `assets/`

```bash
python tools/stamp.py
```

Every stylesheet, module and image keeps the same filename for its whole life
while its contents change underneath, and both browsers and GitHub Pages cache
on the URL. Without a stamp, a returning visitor keeps the version they already
have and your update never reaches them. This appends `?v=<hash>` to every
reference and commits the result.

It also reports two things worth watching: an asset that is referenced but
missing from disk, and an asset on disk that nothing references. The second is
usually the tell that a rename only half landed.

Run it before committing. The output is part of the site, not a build artefact —
the site serves correctly without ever running it again.

---

## What the page is

Sections behind one set of anchors: `#overview`, `#profile`, `#research` (also
`#projects`), `#method`, `#work`, `#education`, `#awards`, `#contact`.

Dark by default with a light theme on the toggle, saved per visitor. The
simulation stages and figure panels stay dark in both themes; they carry
scoped tokens under `.instrument`.

The hero sits on a potential field drawn as contour lines (`terrain.js`). The
pointer is a softened point mass that bends the equipotentials; a click drops a
labelled mass that fades. It is decorative and aria-hidden, and without WebGL
the hero is just its type. Once per session the hero is shown as its own
wireframe for a moment (the compile intro). ⌘K / Ctrl K opens a command menu;
G toggles a 12-column grid.

The research section pins each project for three screens of scroll and plays
its live 3D demo through three states. The quadruped is a schematic of the
mechanism (nominal, fault at step 200, correction), labelled as such; the flyby
is the vendored simulator's own output for Π = 1, 10 and 100. Each project's button opens a native
`<dialog>` carrying the full write-up, deep-linkable at
`#project/fault-tolerant-control` and `#project/oberth-efficiency-atlas`, with the first also
addressable per step, `#project/fault-tolerant-control/3`.

---

## Credits

`assets/js/oberth.js` is `explorer/sim.js` from
[oberth-efficiency-atlas](https://github.com/vyom-aggarwal/oberth-efficiency-atlas),
with its commit recorded in the file header. It is vendored, not rewritten: to change
it, change it there and copy it over.
Font licences are in `assets/fonts/LICENSES.md`.
