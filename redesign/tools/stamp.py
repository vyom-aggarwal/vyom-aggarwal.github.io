"""Stamp every asset URL with a hash of the build.

The site has no bundler, so every stylesheet, module and image keeps the
same filename for its whole life while its contents change underneath.
Browsers and GitHub Pages both cache on the URL, so a returning visitor
keeps the version they already have and the update never reaches them.
That is not hypothetical: it happened during development, twice, and the
symptom was a scene that still showed objects the code no longer built.

This appends `?v=<hash>` to every asset reference. Run it after changing
anything under assets/, and commit the result -- the output is part of
the site, not a build artefact that has to be regenerated to serve.

    python redesign/tools/stamp.py

One stamp is shared by every JavaScript URL on purpose. Two modules that
import the same file under different query strings are two different
module instances to the browser, which would load Three.js twice.
"""

import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = ROOT / "assets" / "js"
CSS = ROOT / "assets" / "css"
IMG = ROOT / "assets" / "img"


def digest(paths):
    h = hashlib.sha256()
    for p in sorted(paths):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:8]


def sub(text, pattern, replacement):
    out, n = re.subn(pattern, replacement, text)
    return out, n


def main():
    code = digest(list(JS.glob("*.js")) + list(CSS.glob("*.css")))
    changed = []

    # ── index.html: stylesheets, module entry points, and the poster ──
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    html, _ = sub(html, r'(href="assets/css/[a-z]+\.css)(\?v=[0-9a-f]+)?"', r'\1?v=%s"' % code)
    html, _ = sub(html, r'(src="assets/js/[a-z]+\.js)(\?v=[0-9a-f]+)?"', r'\1?v=%s"' % code)
    for img in IMG.glob("*.webp"):
        stamp = digest([img])
        html, _ = sub(
            html,
            r"(assets/img/%s)(\?v=[0-9a-f]+)?" % re.escape(img.name),
            r"\1?v=%s" % stamp,
        )
    html_path.write_text(html, encoding="utf-8", newline="")
    changed.append("index.html")

    # ── modules: both static and dynamic imports of sibling files ──
    for js in JS.glob("*.js"):
        if js.name == "three.module.min.js":
            continue
        text = js.read_text(encoding="utf-8")
        before = text
        text, _ = sub(
            text,
            r"(from '\./[a-z.]+\.js)(\?v=[0-9a-f]+)?'",
            r"\1?v=%s'" % code,
        )
        text, _ = sub(
            text,
            r"(import\('\./[a-z.]+\.js)(\?v=[0-9a-f]+)?'\)",
            r"\1?v=%s')" % code,
        )
        # the Earth texture is loaded from JS, so it carries its own stamp
        for img in IMG.glob("*.webp"):
            s = digest([img])
            text, _ = sub(
                text,
                r"(assets/img/%s)(\?v=[0-9a-f]+)?" % re.escape(img.name),
                r"\1?v=%s" % s,
            )
        if text != before:
            js.write_text(text, encoding="utf-8", newline="")
            changed.append(js.name)

    print("build stamp %s" % code)
    for name in changed:
        print("  stamped", name)

    # An image nothing points at is usually the tell that a rename half
    # landed: the new file was written, the reference still names the
    # old one. That shipped once, as a screenshot of an interface on a
    # card whose model had already been replaced.
    sources = [html]
    sources += [j.read_text(encoding="utf-8") for j in JS.glob("*.js")]
    sources += [c.read_text(encoding="utf-8") for c in CSS.glob("*.css")]
    blob = "\n".join(sources)
    orphans = [img.name for img in sorted(IMG.iterdir())
               if img.suffix in (".webp", ".png", ".jpg", ".svg") and img.name not in blob]
    missing = [m for m in set(re.findall(r"assets/img/([A-Za-z0-9._-]+\.(?:webp|png|jpg|svg))", blob))
               if not (IMG / m).exists()]

    for m in missing:
        print("  MISSING  %s is referenced but not on disk" % m)
    for o in orphans:
        print("  ORPHAN   %s is on disk but nothing references it" % o)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
