# Self-hosted faces

All four are SIL Open Font License 1.1. Latin subsets only.

| File | Family | Source | Bytes |
|---|---|---|---|
| `Archivo-var.woff2` | Archivo, wght 400-700 | Google Fonts | 34,928 |
| `JetBrainsMono-var.woff2` | JetBrains Mono, wght 400-500 | Google Fonts | 31,432 |
| `DepartureMono-Regular.woff2` | Departure Mono | departuremono.com | 22,496 |
| `Silkscreen-Regular.woff2` | Silkscreen | Google Fonts | 8,404 |

Both pixel faces are loaded with a `unicode-range` covering only
`A G L M O R V W Y`, the nine glyphs the wordmark uses, so whichever one
is not selected costs nothing and the selected one downloads a fraction
of its outlines.

Only one pixel face ships in the final build. The other gets deleted
once the choice is made.
