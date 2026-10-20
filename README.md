# NORD STAR · RUS 3635 — regatta tablet app

Offline browser app (PWA) for racing NORD STAR (Dufour 36 Performance) in the Fethiye–Göcek gulf and Marmaris:
start line and timer (time to burn), auto wind from tacks, laylines, course library from the clubs' sailing
instructions with routing around land, own vector chart with depth model, built-in hazards.

- Open over HTTPS (or localhost), then "Add to home screen" in Chrome on Android. After the first load it works
  with no network.
- Dev server (no caching): `python3 tools/serve.py 8640`
- After changing any app file: `python3 tools/build_sw.py` (regenerates the offline precache list `sw.js`).
- Depth/land model per venue: `tools/make_depth.py` (EMODnet grid + OSM coastline, see the script header).

## Android app (Capacitor)

The same code packed as an APK, plus a native TCP plugin that reads the boat instruments (wind sensor, log,
compass, echo sounder) from a Yacht Devices YDWG-02R gateway on the SeaTalkNG network
(Wi-Fi «YDWG», 192.168.4.1, TCP 1456, NMEA 0183). A web page cannot open raw sockets, hence the app.

- Build: `npm install` once, then `npm run apk` (copies the web app to `www/`, syncs, runs Gradle).
  Needs JDK 21 (`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`) and the Android SDK.
  Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Native plugin: `android/app/src/main/java/com/sfzorin/nordstar/NmeaTcpPlugin.java`; parser `js/nmea.js`,
  glue `js/instruments.js`.
- Gateway simulator: `python3 tools/nmea_sim.py` — NMEA on TCP 1456 and WebSocket 1457 (the browser version on
  localhost can connect to 127.0.0.1:1457; the Android emulator to 10.0.2.2:1456).
- Launcher icons: `python3 tools/make_android_icons.py`.

Data: map © OpenStreetMap contributors (ODbL); depths EMODnet Bathymetry / GEBCO 2024 (model, not for navigation);
polar from the ORC certificate of a sister ship; courses from Göcek Yacht Club and MIYC course cards.
