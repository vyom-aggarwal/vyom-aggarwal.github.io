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

assets/css/         tokens · base · hero · projects · sections
assets/js/          hero · earth · projects · cards · rig · sections · kit
                    lipase.js   baked alpha-carbon trace of the seeded target
                    three.module.min.js   vendored, MIT
assets/fonts/       Archivo, JetBrains Mono, Departure Mono — all SIL OFL
assets/img/         Earth texture and poster, card posters, grain, icons
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

Six sections behind one set of anchors: `#overview`, `#research` (also
`#projects`), `#work`, `#education`, `#awards`, `#contact`.

The hero is a window onto Earth at night, rendered in WebGL with a static poster
as the LCP element. The poster ships in the HTML and the 3D loads after first
paint; on a narrow viewport or under `prefers-reduced-motion` the poster is all
that is used.

The research section is a launcher for two projects. Each card opens a native
`<dialog>` carrying the full write-up, deep-linkable at
`#project/fault-tolerant-control` and `#project/codon-lab`, with the first also
addressable per step, `#project/fault-tolerant-control/3`.

---

## Credits

Earth imagery is NASA public domain; provenance and the exact processing are in
`assets/img/CREDITS.md`. The alpha-carbon trace in `assets/js/lipase.js` is the
AlphaFold DB model for UniProt P37957, with its source recorded in the file.
Font licences are in `assets/fonts/LICENSES.md`.
