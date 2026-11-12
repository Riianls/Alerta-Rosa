/* =========================================================
   ROTAS SEGURAS — MapLibre + satélite + dados reais do OpenStreetMap
   - Imagem de satélite (Esri World Imagery) com ruas e nomes por cima
   - Delegacias, Delegacias da Mulher e hospitais reais:
       1) dados-rotas.json  → Grande São Paulo (carrega na hora)
       2) Photon (OSM)      → busca ao vivo em outras cidades
   - Rotas a pé reais até o ponto seguro mais próximo (OSRM)
   ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const mapEl = $('#rotasMap');
  if (!mapEl) return;
  const statusEl = $('#rotasStatus');
  const resultsEl = $('#rotasResults');
  const L = window.lucide;

  const drawIcons = () => { try { L && L.createIcons(); } catch (e) {} };
  const icon = (name) => {
    try { if (L && L.icons && L.icons[name]) return L.createElement(L.icons[name]); } catch (e) {}
    const s = document.createElement('b'); s.textContent = '•'; return s;
  };
  const setStatus = (t, busy) => { statusEl.textContent = t; statusEl.classList.toggle('is-busy', !!busy); };
  drawIcons();

  if (!window.maplibregl) { setStatus('Não foi possível carregar o mapa. Verifique sua conexão.'); return; }

  /* fetch que nunca fica preso: desiste depois de ms */
  const fetchT = (url, opts = {}, ms = 10000) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
  };

  const KINDS = {
    ddm:      { label: 'Delegacia da Mulher', icon: 'ShieldAlert', color: '#e3336d' },
    police:   { label: 'Delegacia / Polícia', icon: 'ShieldCheck', color: '#5b3fd6' },
    hospital: { label: 'Hospital',            icon: 'Hospital',    color: '#0f9d77' },
  };
  const START = [-46.6339, -23.5505]; // Praça da Sé, São Paulo
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ---------- estilo satélite ---------- */
  const esri = (path) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/{z}/{y}/{x}`];
  const STYLE = {
    version: 8,
    sources: {
      sat:    { type: 'raster', tiles: esri('World_Imagery'), tileSize: 256, maxzoom: 19,
                attribution: 'Imagens © Esri, Maxar, Earthstar Geographics · Dados © colaboradores do OpenStreetMap' },
      street: { type: 'raster', tiles: esri('World_Street_Map'), tileSize: 256, maxzoom: 19 },
      roads:  { type: 'raster', tiles: esri('Reference/World_Transportation'), tileSize: 256, maxzoom: 19 },
      labels: { type: 'raster', tiles: esri('Reference/World_Boundaries_and_Places'), tileSize: 256, maxzoom: 19 },
    },
    layers: [
      { id: 'sat', type: 'raster', source: 'sat' },
      { id: 'street', type: 'raster', source: 'street', layout: { visibility: 'none' } },
      { id: 'roads', type: 'raster', source: 'roads', paint: { 'raster-opacity': 0.9 } },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  };

  const map = new maplibregl.Map({
    container: mapEl, style: STYLE,
    center: START, zoom: 14, minZoom: 3, maxZoom: 19,
    cooperativeGestures: coarse, // no celular: dois dedos movem o mapa, um dedo rola a página
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  const geo = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true }, showUserLocation: false, showAccuracyCircle: false,
    fitBoundsOptions: { maxZoom: 15 },
  });
  map.addControl(geo, 'top-right');
  map.addControl(new maplibregl.FullscreenControl({ container: mapEl.parentElement }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  /* botão Satélite / Mapa */
  class LayerSwitch {
    onAdd(m) {
      this.el = document.createElement('div');
      this.el.className = 'maplibregl-ctrl maplibregl-ctrl-group rswitch';
      const mk = (id, label) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = id;
        b.addEventListener('click', () => {
          const sat = id === 'sat';
          m.setLayoutProperty('sat', 'visibility', sat ? 'visible' : 'none');
          m.setLayoutProperty('roads', 'visibility', sat ? 'visible' : 'none');
          m.setLayoutProperty('labels', 'visibility', sat ? 'visible' : 'none');
          m.setLayoutProperty('street', 'visibility', sat ? 'none' : 'visible');
          this.el.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
        });
        return b;
      };
      const a = mk('sat', 'Satélite'); a.classList.add('is-on');
      this.el.append(a, mk('street', 'Mapa'));
      return this.el;
    }
    onRemove() { this.el.remove(); }
  }
  map.addControl(new LayerSwitch(), 'top-left');

  /* ---------- ponto de partida ---------- */
  const originEl = document.createElement('div');
  originEl.className = 'pin pin--origin';
  originEl.title = 'Ponto de partida — arraste para mover';
  originEl.append(icon('Navigation'));
  const origin = new maplibregl.Marker({ element: originEl, draggable: true }).setLngLat(START).addTo(map);

  let routed = false, lastTargets = null;
  const setOrigin = (ll) => { origin.setLngLat(ll); if (routed) traceRoutes(lastTargets); };
  origin.on('dragend', () => { if (routed) traceRoutes(lastTargets); });
  geo.on('geolocate', (p) => { lastTargets = null; origin.setLngLat([p.coords.longitude, p.coords.latitude]); traceRoutes(); });
  map.on('click', (e) => {
    if (e.originalEvent.target.closest('.pin, .maplibregl-popup')) return;
    setOrigin([e.lngLat.lng, e.lngLat.lat]);
  });

  /* ---------- dados reais ---------- */
  const places = new Map();   // id -> {id, kind, name, ll, addr, area, phone}
  const markers = new Map();  // id -> Marker
  const hidden = new Set();
  let localBox = null;        // área coberta pelo dados-rotas.json [w,s,e,n]
  const liveDone = new Set(); // células já buscadas ao vivo

  const kindOf = (osmValue, name) =>
    osmValue === 'hospital' ? 'hospital' : /mulher|\bddm\b|\bdeam\b/i.test(name || '') ? 'ddm' : 'police';
  const put = (p) => { if (!places.has(p.id)) places.set(p.id, p); };

  const localReady = fetchT('dados-rotas.json', {}, 15000)
    .then((r) => r.json())
    .then((d) => {
      localBox = d.bbox;
      d.places.forEach(([id, kind, name, lon, lat, addr, area]) =>
        put({ id, kind, name: name || KINDS[kind].label, ll: [lon, lat], addr, area }));
    })
    .catch((e) => console.warn('dados-rotas.json indisponível', e));

  const inLocal = (ll) => localBox && ll[0] >= localBox[0] && ll[0] <= localBox[2] && ll[1] >= localBox[1] && ll[1] <= localBox[3];

  /* busca ao vivo (fora da Grande SP) — Photon / OpenStreetMap */
  const LIVE_Q = [['amenity:police', 'delegacia'], ['amenity:police', 'policia'], ['amenity:police', 'mulher'], ['amenity:hospital', 'hospital']];
  async function photonBox(w, s, e, n) {
    const bbox = [w, s, e, n].map((v) => v.toFixed(4)).join(',');
    await Promise.all(LIVE_Q.map(async ([tag, q]) => {
      try {
        const r = await fetchT(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&osm_tag=${tag}&bbox=${bbox}&limit=50`);
        const j = await r.json();
        j.features.forEach((f) => {
          const p = f.properties;
          if (p.osm_key !== 'amenity' || !['police', 'hospital'].includes(p.osm_value)) return;
          const kind = kindOf(p.osm_value, p.name);
          put({
            id: p.osm_type.toLowerCase() + p.osm_id, kind, name: p.name || KINDS[kind].label,
            ll: f.geometry.coordinates,
            addr: [p.street, p.housenumber].filter(Boolean).join(', '), area: p.district || p.city || '',
          });
        });
      } catch (err) { /* um termo falhou: segue com os outros */ }
    }));
  }
  /* garante dados ao redor de um ponto (células de ~0,1°) */
  async function ensureAround(ll, r = 1) {
    const jobs = [];
    const cx = Math.floor(ll[0] * 10), cy = Math.floor(ll[1] * 10);
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      const key = x + ':' + y, c = [(x + 0.5) / 10, (y + 0.5) / 10];
      if (liveDone.has(key) || inLocal(c)) continue;
      liveDone.add(key);
      jobs.push(photonBox(x / 10, y / 10, (x + 1) / 10, (y + 1) / 10).catch(() => liveDone.delete(key)));
    }
    if (jobs.length) await Promise.all(jobs);
    return jobs.length;
  }

  /* ---------- marcadores ---------- */
  function popupContent(p, pop) {
    const d = document.createElement('div');
    d.className = 'rpop';
    const tag = document.createElement('span'); tag.className = `rpop__tag rpop__tag--${p.kind}`; tag.textContent = KINDS[p.kind].label;
    const h = document.createElement('strong'); h.textContent = p.name;
    d.append(tag, h);
    if (p.addr || p.area) { const a = document.createElement('p'); a.textContent = [p.addr, p.area].filter(Boolean).join(' — '); d.append(a); }
    const maps = document.createElement('a');
    maps.className = 'rpop__link'; maps.target = '_blank'; maps.rel = 'noopener';
    maps.href = `https://www.google.com/maps/dir/?api=1&destination=${p.ll[1]},${p.ll[0]}&travelmode=walking`;
    maps.textContent = 'Abrir no Google Maps ↗';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rpop__go';
    b.append(icon('Route'), document.createTextNode(' Rota segura até aqui'));
    b.addEventListener('click', () => { pop.remove(); lastTargets = [p]; traceRoutes(lastTargets); });
    d.append(b, maps);
    return d;
  }
  function makeMarker(p) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `pin pin--${p.kind}`;
    el.setAttribute('aria-label', `${KINDS[p.kind].label}: ${p.name}`);
    el.append(icon(KINDS[p.kind].icon));
    const pop = new maplibregl.Popup({ offset: 18, maxWidth: '270px' });
    pop.setDOMContent(popupContent(p, pop));
    return new maplibregl.Marker({ element: el }).setLngLat(p.ll).setPopup(pop).addTo(map);
  }
  function render() {
    const b = map.getBounds(), keep = new Set();
    let n = 0;
    for (const p of places.values()) {
      if (hidden.has(p.kind) || !b.contains(p.ll) || n >= 350) continue;
      n++; keep.add(p.id);
      if (!markers.has(p.id)) markers.set(p.id, makeMarker(p));
    }
    for (const [id, m] of markers) if (!keep.has(id)) { m.remove(); markers.delete(id); }
    return n;
  }
  const countStatus = () => {
    const n = render();
    setStatus(n ? `${n} locais reais nesta área · OpenStreetMap` : 'Nenhuma delegacia ou hospital nesta área');
  };

  let viewId = 0;
  async function loadView() {
    const id = ++viewId;
    await localReady;
    if (id !== viewId) return;
    if (map.getZoom() < 10) { render(); setStatus('Aproxime o mapa para ver delegacias e hospitais'); return; }
    const c = map.getCenter();
    if (!inLocal([c.lng, c.lat])) {
      setStatus('Buscando delegacias e hospitais desta região…', true);
      await ensureAround([c.lng, c.lat], map.getZoom() >= 12 ? 1 : 2);
      if (id !== viewId) return;
    }
    countStatus();
  }
  let deb;
  map.on('moveend', () => { clearTimeout(deb); deb = setTimeout(loadView, 350); });

  /* ---------- rotas ---------- */
  const dist = (a, b) => {
    const R = 6371e3, r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const nearest = (from, kinds) => {
    let best = null, bd = Infinity;
    for (const p of places.values()) {
      if (!kinds.includes(p.kind)) continue;
      const d = dist(from, p.ll);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  async function route(a, b) {
    const c = `${a[0]},${a[1]};${b[0]},${b[1]}`, qs = '?overview=full&geometries=geojson';
    for (const u of [
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${c}${qs}`,
      `https://router.project-osrm.org/route/v1/foot/${c}${qs}`,
    ]) {
      try {
        const j = await (await fetchT(u, {}, 12000)).json();
        if (j.code === 'Ok' && j.routes && j.routes[0]) return j.routes[0];
      } catch (e) {}
    }
    return null;
  }
  const fmtKm = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

  let traceId = 0;
  async function traceRoutes(targets) {
    routed = true;
    const id = ++traceId;
    const o = origin.getLngLat(), from = [o.lng, o.lat];
    setStatus('Procurando os pontos seguros mais próximos…', true);
    resultsEl.innerHTML = '';
    if (!targets) {
      await localReady;
      if (!inLocal(from)) await ensureAround(from, 1);
      if (id !== traceId) return;
      const police = nearest(from, ['ddm', 'police']);
      const ddm = nearest(from, ['ddm']);
      const hosp = nearest(from, ['hospital']);
      targets = [police, ddm && ddm !== police && dist(from, ddm.ll) < 15000 ? ddm : null, hosp].filter(Boolean);
    }
    if (!targets.length) { setStatus('Nenhum ponto seguro encontrado por perto.'); return; }
    setStatus('Calculando rotas a pé…', true);
    const res = await Promise.all(targets.map(async (t) => ({ t, r: await route(from, t.ll) })));
    if (id !== traceId) return;

    const feats = res.map(({ t, r }) => ({
      type: 'Feature', properties: { kind: t.kind },
      geometry: r ? r.geometry : { type: 'LineString', coordinates: [from, t.ll] },
    }));
    map.getSource('routes')?.setData({ type: 'FeatureCollection', features: feats });

    const bounds = new maplibregl.LngLatBounds(from, from);
    feats.forEach((f) => f.geometry.coordinates.forEach((c) => bounds.extend(c)));
    map.fitBounds(bounds, { padding: { top: 70, bottom: 50, left: 50, right: 70 }, maxZoom: 16, duration: 1400 });

    res.forEach(({ t, r }) => {
      const m = r ? r.distance : dist(from, t.ll);
      const min = Math.max(1, Math.round(m / 80)); // ~4,8 km/h a pé
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = `rres rres--${t.kind}`;
      const ic = document.createElement('span'); ic.className = 'rres__ic'; ic.append(icon(KINDS[t.kind].icon));
      const tx = document.createElement('span'); tx.className = 'rres__tx';
      const k = document.createElement('small'); k.className = 'mono'; k.textContent = KINDS[t.kind].label;
      const n = document.createElement('strong'); n.textContent = t.name;
      const d = document.createElement('small'); d.textContent = `${fmtKm(m)} · ~${min} min a pé${r ? '' : ' (linha reta)'}`;
      tx.append(k, n, d);
      b.append(ic, tx);
      b.addEventListener('click', () => {
        map.flyTo({ center: t.ll, zoom: Math.max(map.getZoom(), 16) });
        map.once('moveend', () => { render(); markers.get(t.id)?.togglePopup(); });
      });
      li.append(b); resultsEl.append(li);
    });
    setStatus('Rotas traçadas · arraste o ponto de partida para recalcular');
  }

  map.on('load', () => {
    map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 17, 13] } });
    map.addLayer({ id: 'routes-line', type: 'line', source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'ddm', KINDS.ddm.color, 'hospital', KINDS.hospital.color, KINDS.police.color],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 17, 7],
      } });
    setStatus('Carregando locais…', true);
    loadView();
  });

  /* ---------- painel ---------- */
  $('#rotasGo').addEventListener('click', () => { lastTargets = null; traceRoutes(); });
  document.querySelectorAll('.rotas__legend input').forEach((cb) =>
    cb.addEventListener('change', () => { cb.checked ? hidden.delete(cb.dataset.kind) : hidden.add(cb.dataset.kind); countStatus(); })
  );
  $('#rotasSearch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#rotasQ').value.trim();
    if (!q) return;
    setStatus('Procurando endereço…', true);
    try {
      const r = await fetchT('https://photon.komoot.io/api/?limit=1&lat=-15.8&lon=-47.9&q=' + encodeURIComponent(q));
      const j = await r.json();
      if (!j.features.length) return setStatus('Endereço não encontrado.');
      const ll = j.features[0].geometry.coordinates;
      lastTargets = null;
      origin.setLngLat(ll);
      map.flyTo({ center: ll, zoom: 15 });
      if (routed) traceRoutes();
    } catch (err) { setStatus('Busca indisponível no momento.'); }
  });
})();
