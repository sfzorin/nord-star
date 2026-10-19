// Leaflet map: chart layers, start line, marks, boat, laylines.
/* global L */
import { VENUES } from './venues.js?v=8';

const toLL = (p) => [p.lat, p.lon];
// Start → finish: teal, blue, violet, magenta, orange.
const STOPS = [[0, 179, 164], [47, 123, 255], [138, 63, 252], [224, 41, 143], [255, 106, 0]];
function routeColor(t) {
  const x = Math.min(0.9999, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.floor(x), f = x - i;
  const c = STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}
const fromLL = (ll) => ({ lat: ll.lat, lon: ll.lng });
const icon = (html, cls, size, anchor) => L.divIcon({ html, className: `mk ${cls}`, iconSize: size, iconAnchor: anchor });

export class RaceMap {
  constructor(el, center, h) {
    this.h = h;
    const map = (this.map = L.map(el, { zoomControl: false, center: toLL(center), zoom: 15, attributionControl: true, preferCanvas: true }));
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank">© OSM</a>');

    // Own offline chart (tools/make_depth.py → data/<venue>/depth_vec.json): land + depth bands + isobaths.
    // Works with no network; online tile layers below are optional extras.
    map.createPane('land').style.zIndex = 250;
    map.createPane('depth').style.zIndex = 260;
    map.createPane('labels').style.zIndex = 450;
    const landR = L.canvas({ pane: 'land', padding: 0.3 }), depthR = L.canvas({ pane: 'depth', padding: 0.3 });
    const chart = L.layerGroup(), depth = L.layerGroup(), labels = L.layerGroup();
    for (const venue of Object.values(VENUES)) fetch(`${venue.data}/depth_vec.json`).then((r) => r.json()).then((v) => {
      if (v.land?.length) L.polygon(v.land, { renderer: landR, color: '#b9a774', weight: 1, fillColor: '#efe4bd', fillOpacity: 1, interactive: false }).addTo(chart);
      for (const b of v.bands) {
        if (b.rings.length) L.polygon(b.rings, { renderer: depthR, stroke: false, fillColor: b.color, fillOpacity: 1, interactive: false }).addTo(depth);
      }
      for (const iso of v.isobaths) {
        const deep = iso.depth >= 20;
        for (const line of iso.lines) {
          L.polyline(line, { renderer: depthR, color: deep ? '#7aa7cf' : '#2f78c0', weight: deep ? 0.8 : 1, opacity: 0.9, interactive: false }).addTo(depth);
        }
      }
    }).catch(() => {});
    for (const venue of Object.values(VENUES)) {
      for (const [name, lat, lon, kind] of venue.labels || []) {
        L.marker([lat, lon], { pane: 'labels', interactive: false, icon: L.divIcon({ className: `chartLabel ${kind}`, html: name, iconSize: null }) }).addTo(labels);
      }
    }
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    const sea = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18 });
    chart.addTo(map);
    depth.addTo(map);
    labels.addTo(map);
    L.control.layers(
      { 'Своя карта (офлайн)': chart, 'OSM (онлайн)': osm, 'Спутник (онлайн)': sat },
      { 'Глубины': depth, 'Подписи': labels, 'Морские знаки (онлайн)': sea },
      { position: 'topleft' },
    ).addTo(map);
    // Online base layers replace the offline land; depth stays on top of them.
    map.on('baselayerchange', (e) => { if (e.layer !== chart && map.hasLayer(chart)) map.removeLayer(chart); });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    this.lineExt = L.polyline([], { color: '#ffb020', weight: 1.5, dashArray: '6 8', opacity: 0.8, interactive: false }).addTo(map);
    this.line = L.polyline([], { color: '#ffb020', weight: 5, interactive: false }).addTo(map);
    this.lay = [0, 1, 2, 3].map(() => L.polyline([], { weight: 2.5, opacity: 0.9, interactive: false }).addTo(map));
    this.track = L.polyline([], { color: '#4fc3f7', weight: 2, opacity: 0.7, interactive: false }).addTo(map);
    this.vector = L.polyline([], { color: '#ffffff', weight: 2, dashArray: '4 5', interactive: false }).addTo(map);
    this.toMark = L.polyline([], { color: '#9cff57', weight: 1.5, dashArray: '2 7', interactive: false }).addTo(map);
    this.crossPt = L.circleMarker([0, 0], { radius: 7, color: '#9cff57', weight: 3, fill: false, interactive: false });
    this.route = L.layerGroup().addTo(map);
    this.routeSig = '';
    this.islandsLayer = L.layerGroup().addTo(map);
    this.islandsSig = '';
    this.hazLayer = L.layerGroup().addTo(map);
    this.hazSig = '';
    this.marksLayer = L.layerGroup().addTo(map);
    this.marksSig = '';
    this.dragging = false;

    this.boat = L.marker(toLL(center), {
      icon: icon('<div class="boatRot"><svg viewBox="0 0 20 40" width="20" height="40"><path d="M10 1 C16 11 17 24 15 39 L5 39 C3 24 4 11 10 1Z"/></svg></div>', 'boatIcon', [20, 40], [10, 20]),
      interactive: false, zIndexOffset: 1000,
    });

    map.on('click', (e) => h.onClick(fromLL(e.latlng)));
    map.on('dragstart', () => h.onUserPan());
  }

  endMarker(key, p, html, cls) {
    if (!this[key]) {
      const m = L.marker(toLL(p), { draggable: true, icon: icon(html, cls, [28, 28], [14, 14]), zIndexOffset: 500 }).addTo(this.map);
      m.on('dragstart', () => (this.dragging = true));
      m.on('drag', (e) => this.h.onDrag(key, fromLL(e.target.getLatLng())));
      m.on('dragend', () => (this.dragging = false));
      this[key] = m;
    } else if (!this.dragging) {
      this[key].setLatLng(toLL(p));
    }
  }

  setLine(pin, rc, ext) {
    if (!pin || !rc) { this.line.setLatLngs([]); this.lineExt.setLatLngs([]); return; }
    this.endMarker('pin', pin, '<div class="pinDot"></div><b>ПИН</b>', 'pinIcon');
    this.endMarker('rc', rc, '<div class="rcFlag"></div><b>КОМИТЕТ</b>', 'rcIcon');
    this.line.setLatLngs([toLL(pin), toLL(rc)]);
    this.lineExt.setLatLngs(ext ? ext.map(toLL) : []);
  }

  setMarks(marks, activeId, courseIds) {
    const sig = JSON.stringify([marks.map((m) => [m.id, m.name, m.lat.toFixed(6), m.lon.toFixed(6), m.approx]), activeId, courseIds]);
    if (sig === this.marksSig || this.dragging) return;
    this.marksSig = sig;
    this.marksLayer.clearLayers();
    for (const m of marks) {
      if (m.via) continue;
      const cls = ['markIcon', m.id === activeId ? 'active' : '', courseIds.includes(m.id) ? '' : 'unused', m.approx ? 'approx' : ''].join(' ');
      const mk = m.wp
        ? L.marker(toLL(m), { draggable: true, icon: icon(`<div class="wpDot"></div>`, cls + ' wpIcon', [14, 14], [7, 7]), title: m.name })
        : L.marker(toLL(m), { draggable: true, icon: icon(`<div class="markDot"></div><b>${m.name}</b>`, cls, [26, 26], [13, 13]) });
      mk.on('dragstart', () => (this.dragging = true));
      mk.on('dragend', (e) => { this.dragging = false; this.h.onDrag('mark', fromLL(e.target.getLatLng()), m.id); });
      mk.addTo(this.marksLayer);
    }
  }

  setBoat(fix, follow) {
    if (!fix) { this.boat.remove(); return; }
    if (!this.map.hasLayer(this.boat)) this.boat.addTo(this.map);
    this.boat.setLatLng(toLL(fix));
    const el = this.boat.getElement()?.querySelector('.boatRot');
    if (el) el.style.transform = `rotate(${fix.cog}deg)`;
    if (follow) this.map.panTo(toLL(fix), { animate: false });
  }

  // Course line coloured start → finish along a gradient, so legs running side by side differ in colour.
  setRoute(pts, islands) {
    const rsig = JSON.stringify(pts.map((p) => [p.lat.toFixed(5), p.lon.toFixed(5)]));
    if (rsig !== this.routeSig) {
      this.routeSig = rsig;
      this.route.clearLayers();
      const d = [0];
      for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + this.map.distance(toLL(pts[i - 1]), toLL(pts[i])));
      const total = d[d.length - 1] || 1;
      const STEP = 120; // m per colour step
      for (let i = 1; i < pts.length; i++) {
        const n = Math.max(1, Math.ceil((d[i] - d[i - 1]) / STEP));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const a = [pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * t0, pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * t0];
          const b = [pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * t1, pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * t1];
          const t = (d[i - 1] + (d[i] - d[i - 1]) * (k + 0.5) / n) / total;
          L.polyline([a, b], { color: routeColor(t), weight: 4, opacity: 0.95, lineCap: 'butt', interactive: false }).addTo(this.route);
        }
      }
    }
    const sig = JSON.stringify(islands.map((i) => [i.hull[0], i.side]));
    if (sig === this.islandsSig) return;
    this.islandsSig = sig;
    this.islandsLayer.clearLayers();
    for (const i of islands) {
      if (i.hull.length < 3) continue;
      L.polygon(i.hull, { color: i.side === 'S' ? '#34e27a' : '#ff4f4f', weight: 3, fillOpacity: 0.12, interactive: false }).addTo(this.islandsLayer);
    }
  }

  setHazards(list) {
    const sig = JSON.stringify(list.map((h) => [h.id, h.lat, h.lon, h.r]));
    if (sig === this.hazSig) return;
    this.hazSig = sig;
    this.hazLayer.clearLayers();
    for (const h of list) {
      L.circle(toLL(h), { radius: h.r, color: '#ff2d2d', weight: 2, dashArray: '6 4', fillColor: '#ff2d2d', fillOpacity: 0.35, interactive: false }).addTo(this.hazLayer);
      L.marker(toLL(h), { icon: icon(`<div class="hazX">✕</div><b>${h.name}${h.depth != null ? ` · ${h.depth} м` : ''}</b>`, 'hazIcon', [22, 22], [11, 11]), interactive: false }).addTo(this.hazLayer);
      if (h.buoy) {
        // North cardinal: black over yellow, two cones pointing up.
        const svg = '<svg viewBox="0 0 20 34" width="20" height="34"><path d="M10 0 L16 8 H4Z M10 8 L16 16 H4Z" fill="#111"/><rect x="5" y="17" width="10" height="8" fill="#111"/><rect x="5" y="25" width="10" height="8" fill="#ffd200" stroke="#111" stroke-width="1"/></svg>';
        L.marker(toLL(h.buoy), { icon: icon(svg, 'cardIcon', [20, 34], [10, 33]), interactive: false, zIndexOffset: 400 }).addTo(this.hazLayer);
      }
    }
  }

  setVector(pts) { this.vector.setLatLngs(pts ? pts.map(toLL) : []); }
  setToMark(pts) { this.toMark.setLatLngs(pts ? pts.map(toLL) : []); }

  setCross(p) {
    if (!p) { this.crossPt.remove(); return; }
    this.crossPt.setLatLng(toLL(p));
    if (!this.map.hasLayer(this.crossPt)) this.crossPt.addTo(this.map);
  }

  // lines: [{a, b, color}]
  setLaylines(lines) {
    this.lay.forEach((pl, i) => {
      const l = lines[i];
      if (!l) { pl.setLatLngs([]); return; }
      pl.setLatLngs([toLL(l.a), toLL(l.b)]);
      pl.setStyle({ color: l.color, dashArray: l.dash || null });
    });
  }

  popup(p, html) { L.popup({ closeButton: false, className: 'depthPop' }).setLatLng(toLL(p)).setContent(html).openOn(this.map); }

  addTrack(p) { this.track.addLatLng(toLL(p)); }
  clearTrack() { this.track.setLatLngs([]); }
  center(p, zoom) { this.map.setView(toLL(p), zoom ?? this.map.getZoom()); }
  invalidate() { this.map.invalidateSize(); }
}
