# NORD STAR · RUS 3635 — regatta tablet app

Offline browser app (PWA) for racing NORD STAR (Dufour 36 Performance) in the Fethiye–Göcek gulf and Marmaris:
start line and timer (time to burn), auto wind from tacks, laylines, course library from the clubs' sailing
instructions with routing around land, own vector chart with depth model, built-in hazards.

- Open over HTTPS (or localhost), then "Add to home screen" in Chrome on Android. After the first load it works
  with no network.
- Dev server (no caching): `python3 tools/serve.py 8640`
- After changing any app file: `python3 tools/build_sw.py` (regenerates the offline precache list `sw.js`).
- Depth/land model per venue: `tools/make_depth.py` (EMODnet grid + OSM coastline, see the script header).

Data: map © OpenStreetMap contributors (ODbL); depths EMODnet Bathymetry / GEBCO 2024 (model, not for navigation);
polar from the ORC certificate of a sister ship; courses from Göcek Yacht Club and MIYC course cards.
