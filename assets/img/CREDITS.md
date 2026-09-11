# Image credits

`earth-2k.webp` — 2048×1024 RGBA composite, built from two NASA public-domain images:

| Channel | Source | File |
|---|---|---|
| RGB, day surface | NASA Visible Earth, Blue Marble | `land_shallow_topo_2048.jpg` |
| Alpha, night lights | NASA Earth Observatory, Black Marble 2012 | `dnb_land_ocean_ice.2012.3600x1800.jpg` |

Both are public domain as works of the US government. The night channel was
floored at value 26 and gamma-corrected at 1.35 to remove airglow and sensor
noise over the oceans, so only real settlement lights survive; 0.75% of the
frame carries visible light, which is the honest figure for Earth at night.

The two are packed into one file rather than two so the scene costs a single
texture fetch. The shader mixes them by sun angle at run time, which is why the
terminator moves with the rotation instead of being baked in.
