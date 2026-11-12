/* =========================================================
   ROTAS SEGURAS — Município de Maricá (RJ)
   - O mapa só funciona dentro do limite oficial de Maricá
     (fora dele fica coberto e não aceita cliques, buscas ou rotas)
   - dados-marica.json: limite do município + rede de proteção à mulher,
     delegacias, hospitais/UPAs, unidades de saúde e assistência social
   - Rotas a pé reais até o ponto seguro mais próximo (OSRM)
   ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const mapEl = $('#rotasMap');
  if (!mapEl) return;
  const statusEl = $('#rotasStatus');
  const resultsEl = $('#rotasResults');
  const setStatus = (t, busy) => { statusEl.textContent = t; statusEl.classList.toggle('is-busy', !!busy); };

  /* ícones (Lucide, ISC) — só os usados, sem carregar a biblioteca inteira */
  const ICONS = {
    ShieldAlert: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    ShieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    Hospital: '<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
    Stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    HeartHandshake: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/>',
    Route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    Navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  };
  const icon = (name) => {
    const t = document.createElement('template');
    t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
    return t.content.firstChild;
  };

  /* MapLibre (~800 KB) só é baixado quando a seção do mapa se aproxima */
  const ML = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
  new IntersectionObserver((es, io) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const load = (el) => new Promise((ok, fail) => { el.onload = ok; el.onerror = fail; document.head.append(el); });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = ML + '.css';
    const js = document.createElement('script'); js.src = ML + '.js';
    // o mapa só é criado depois do CSS e do JS (sem o CSS o canvas nasce com tamanho errado)
    Promise.all([load(css), load(js)]).then(init, () => setStatus('Não foi possível carregar o mapa. Verifique sua conexão.'));
  }, { rootMargin: '120% 0px' }).observe(mapEl);

  function init() {

  const fetchT = (url, opts = {}, ms = 10000) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
  };

  const KINDS = {
    mulher:   { label: 'Atendimento à Mulher', icon: 'ShieldAlert', color: '#e3336d' },
    police:   { label: 'Delegacia / Polícia',  icon: 'ShieldCheck', color: '#5b3fd6' },
    hospital: { label: 'Hospital / UPA',       icon: 'Hospital',    color: '#0f9d77' },
    saude:    { label: 'Unidade de Saúde',     icon: 'Stethoscope', color: '#1d8fd1' },
    apoio:    { label: 'Assistência & Apoio',  icon: 'HeartHandshake', color: '#d98a00' },
  };

  /* limites de Maricá (substituídos pelos dados oficiais ao carregar) */
  let BBOX = [-43.0251, -23.0253, -42.6342, -22.8408]; // [w, s, e, n]
  const START = [-42.8186, -22.9194];                  // Centro de Maricá
  const pad = (b, k) => [[b[0] - k, b[1] - k], [b[2] + k, b[3] + k]];
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ---------- estilo satélite ---------- */
  const esri = (path) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/{z}/{y}/{x}`];
  const STYLE = {
    version: 8,
    sources: {
      sat:    { type: 'raster', tiles: esri('World_Imagery'), tileSize: 256, maxzoom: 19,
                attribution: 'Imagens © Esri, Maxar, Earthstar Geographics · Dados © colaboradores do OpenStreetMap · Prefeitura de Maricá' },
      roads:  { type: 'raster', tiles: esri('Reference/World_Transportation'), tileSize: 256, maxzoom: 19 },
      labels: { type: 'raster', tiles: esri('Reference/World_Boundaries_and_Places'), tileSize: 256, maxzoom: 19 },
    },
    layers: [
      { id: 'sat', type: 'raster', source: 'sat' },
      { id: 'roads', type: 'raster', source: 'roads', paint: { 'raster-opacity': 0.9 } },
      { id: 'labels', type: 'raster', source: 'labels' },
    ],
  };

  const map = new maplibregl.Map({
    container: mapEl, style: STYLE,
    center: START, zoom: 12.4, minZoom: 10, maxZoom: 19,
    maxBounds: pad(BBOX, 0.06),
    cooperativeGestures: coarse,
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  // créditos (exigidos pelas licenças) ficam recolhidos no botão ⓘ
  map.once('load', () => mapEl.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  const geo = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true }, showUserLocation: false, showAccuracyCircle: false,
    fitBoundsOptions: { maxZoom: 15 }, trackUserLocation: false,
  });
  map.addControl(geo, 'top-right');
  map.addControl(new maplibregl.FullscreenControl({ container: mapEl.parentElement }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  /* ---------- limite do município ---------- */
  let BOUNDARY = null; // MultiPolygon
  const inRing = (pt, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const inMarica = (pt) => {
    if (pt[0] < BBOX[0] || pt[0] > BBOX[2] || pt[1] < BBOX[1] || pt[1] > BBOX[3]) return false;
    if (!BOUNDARY) return true;
    return BOUNDARY.coordinates.some((poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h)));
  };
  const OUTSIDE = 'Fora de Maricá — o mapa atende apenas o município de Maricá (RJ).';

  /* ---------- ponto de partida ---------- */
  const originEl = document.createElement('div');
  originEl.className = 'pin pin--origin';
  originEl.title = 'Ponto de partida — arraste para mover';
  originEl.append(icon('Navigation'));
  const origin = new maplibregl.Marker({ element: originEl, draggable: true }).setLngLat(START).addTo(map);

  /* o sino 3D (main.js) pergunta aqui onde pousar: no ponto de partida, se ele estiver visível no mapa */
  window.alertaRosa = window.alertaRosa || {};
  window.alertaRosa.dock = () => {
    const fr = mapEl.getBoundingClientRect(), p = map.project(origin.getLngLat());
    const x = fr.left + p.x, y = fr.top + p.y;
    const visible = x > fr.left + 12 && x < fr.right - 12 && y > fr.top + 60 && y < fr.bottom - 12 && fr.bottom > 0 && fr.top < innerHeight;
    return { x, y, visible };
  };

  let routed = false, lastTargets = null, lastGood = START;
  const setOrigin = (ll) => {
    if (!inMarica(ll)) { setStatus(OUTSIDE); return false; }
    origin.setLngLat(ll); lastGood = ll;
    if (routed) traceRoutes(lastTargets);
    return true;
  };
  origin.on('dragend', () => {
    const o = origin.getLngLat(), ll = [o.lng, o.lat];
    if (!inMarica(ll)) { origin.setLngLat(lastGood); setStatus(OUTSIDE); return; }
    lastGood = ll;
    if (routed) traceRoutes(lastTargets);
  });
  geo.on('geolocate', (p) => {
    const ll = [p.coords.longitude, p.coords.latitude];
    if (!inMarica(ll)) {
      setStatus('Sua localização está fora de Maricá. Clique no mapa para escolher um ponto dentro do município.');
      map.fitBounds(pad(BBOX, 0), { padding: 30, duration: 900 });
      return;
    }
    lastTargets = null; origin.setLngLat(ll); lastGood = ll; traceRoutes();
  });
  map.on('click', (e) => {
    if (e.originalEvent.target.closest('.pin, .maplibregl-popup')) return;
    setOrigin([e.lngLat.lng, e.lngLat.lat]);
  });

  /* ---------- dados ---------- */
  const places = new Map();
  const markers = new Map();
  const hidden = new Set();

  const ready = fetchT('dados-marica.json', {}, 15000)
    .then((r) => r.json())
    .then((d) => {
      BBOX = d.bbox;
      BOUNDARY = d.boundary;
      map.setMaxBounds(pad(BBOX, 0.06));
      d.places.forEach(([id, kind, name, lon, lat, addr, area, phone, note]) => {
        if (!KINDS[kind]) return;
        places.set(id, { id, kind, name: name || KINDS[kind].label, ll: [lon, lat], addr, area, phone, note });
      });
      return d;
    })
    .catch((e) => { console.warn('dados-marica.json indisponível', e); return null; });

  /* máscara: tudo fora de Maricá fica coberto */
  function addBoundaryLayers() {
    if (!BOUNDARY || map.getSource('marica')) return;
    const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const holes = BOUNDARY.coordinates.map((poly) => poly[0]);
    map.addSource('marica-mask', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } } });
    map.addSource('marica', { type: 'geojson', data: { type: 'Feature', geometry: BOUNDARY } });
    map.addLayer({ id: 'marica-mask', type: 'fill', source: 'marica-mask', paint: { 'fill-color': '#1a0710', 'fill-opacity': 0.78 } }, 'routes-casing');
    map.addLayer({ id: 'marica-line-glow', type: 'line', source: 'marica',
      paint: { 'line-color': '#ff8fb1', 'line-width': 7, 'line-opacity': 0.35, 'line-blur': 3 } }, 'routes-casing');
    map.addLayer({ id: 'marica-line', type: 'line', source: 'marica',
      paint: { 'line-color': '#e3336d', 'line-width': 2.5, 'line-dasharray': [3, 1.5] } }, 'routes-casing');
  }

  /* ---------- marcadores ---------- */
  function popupContent(p, pop) {
    const d = document.createElement('div');
    d.className = 'rpop';
    const tag = document.createElement('span'); tag.className = `rpop__tag rpop__tag--${p.kind}`; tag.textContent = KINDS[p.kind].label;
    const h = document.createElement('strong'); h.textContent = p.name;
    d.append(tag, h);
    if (p.addr || p.area) { const a = document.createElement('p'); a.textContent = [p.addr, p.area].filter(Boolean).join(' — '); d.append(a); }
    if (p.note) { const n = document.createElement('p'); n.className = 'rpop__note'; n.textContent = p.note; d.append(n); }
    if (p.phone) {
      const t = document.createElement('a'); t.className = 'rpop__tel';
      t.href = 'tel:' + p.phone.split('·')[0].replace(/[^\d+]/g, '');
      t.textContent = '☎ ' + p.phone; d.append(t);
    }
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
    const pop = new maplibregl.Popup({ offset: 18, maxWidth: '280px' });
    pop.setDOMContent(popupContent(p, pop));
    return new maplibregl.Marker({ element: el }).setLngLat(p.ll).setPopup(pop).addTo(map);
  }
  function render() {
    const b = map.getBounds(), keep = new Set();
    let n = 0;
    for (const p of places.values()) {
      if (hidden.has(p.kind) || !b.contains(p.ll)) continue;
      n++; keep.add(p.id);
      if (!markers.has(p.id)) markers.set(p.id, makeMarker(p));
    }
    for (const [id, m] of markers) if (!keep.has(id)) { m.remove(); markers.delete(id); }
    return n;
  }
  const countStatus = () => {
    const n = render();
    setStatus(n ? `${n} pontos seguros nesta área · Maricá (RJ)` : 'Nenhum ponto seguro visível — afaste o mapa');
  };
  let deb;
  map.on('moveend', () => { clearTimeout(deb); deb = setTimeout(countStatus, 200); });

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
      if (!kinds.includes(p.kind) || hidden.has(p.kind)) continue;
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
    resultsEl.innerHTML = '';
    if (!inMarica(from)) { setStatus(OUTSIDE); return; }
    setStatus('Procurando os pontos seguros mais próximos…', true);
    if (!targets) {
      await ready;
      if (id !== traceId) return;
      targets = [nearest(from, ['mulher']), nearest(from, ['police']), nearest(from, ['hospital'])]
        .filter((t, i, a) => t && a.indexOf(t) === i);
    }
    if (!targets.length) { setStatus('Nenhum ponto seguro encontrado — reative as categorias na legenda.'); return; }
    setStatus('Calculando rotas a pé…', true);
    const res = await Promise.all(targets.map(async (t) => ({ t, r: await route(from, t.ll) })));
    if (id !== traceId) return;

    const feats = res.map(({ t, r }) => ({
      type: 'Feature', properties: { kind: t.kind },
      geometry: r ? r.geometry : { type: 'LineString', coordinates: [from, t.ll] },
    }));
    map.getSource('routes')?.setData({ type: 'FeatureCollection', features: [] });

    const bounds = new maplibregl.LngLatBounds(from, from);
    feats.forEach((f) => f.geometry.coordinates.forEach((c) => bounds.extend(c)));
    map.fitBounds(bounds, { padding: { top: 90, bottom: 50, left: 50, right: 70 }, maxZoom: 16, duration: 1400 });

    res.forEach(({ t, r }) => {
      const m = r ? r.distance : dist(from, t.ll);
      const min = Math.max(1, Math.round(m / 80));
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

    // espera o mapa enquadrar, o sino toca e solta um raio até cada destino; as rotas se desenham a partir dele
    await new Promise((ok) => { const to = setTimeout(ok, 1700); map.once('moveend', () => { clearTimeout(to); ok(); }); });
    if (id !== traceId) return;
    const fr = mapEl.getBoundingClientRect();
    const points = res.map(({ t }) => { const p = map.project(t.ll); return { x: fr.left + p.x, y: fr.top + p.y, color: KINDS[t.kind].color }; });
    const docked = document.body.classList.contains('bell-docked');
    window.dispatchEvent(new CustomEvent('alerta:rays', { detail: { points } }));
    setTimeout(() => growRoutes(feats, id), docked ? 550 : 0);
  }

  /* desenha as rotas progressivamente, do ponto de partida até cada destino */
  function growRoutes(feats, id) {
    const src = map.getSource('routes');
    if (!src) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { src.setData({ type: 'FeatureCollection', features: feats }); return; }
    const acc = feats.map((f) => {
      const c = f.geometry.coordinates, a = [0];
      for (let i = 1; i < c.length; i++) a.push(a[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
      return a;
    });
    const t0 = performance.now(), dur = 1300;
    const step = (now) => {
      if (id !== traceId) return;
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      src.setData({ type: 'FeatureCollection', features: feats.map((f, j) => {
        const c = f.geometry.coordinates, a = acc[j], L = a[a.length - 1] * e;
        let k = 1; while (k < c.length && a[k] < L) k++;
        const pts = c.slice(0, k);
        if (k < c.length) { const A = c[k - 1], B = c[k], r = (L - a[k - 1]) / ((a[k] - a[k - 1]) || 1); pts.push([A[0] + (B[0] - A[0]) * r, A[1] + (B[1] - A[1]) * r]); }
        return { ...f, geometry: { type: 'LineString', coordinates: pts.length > 1 ? pts : [c[0], c[0]] } };
      }) });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  map.on('load', async () => {
    map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 17, 13] } });
    map.addLayer({ id: 'routes-line', type: 'line', source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'kind'],
          'mulher', KINDS.mulher.color, 'hospital', KINDS.hospital.color,
          'saude', KINDS.saude.color, 'apoio', KINDS.apoio.color, KINDS.police.color],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 17, 7],
      } });
    setStatus('Carregando pontos de Maricá…', true);
    await ready;
    addBoundaryLayers();
    countStatus();
  });

  /* ---------- painel ---------- */
  $('#rotasGo').addEventListener('click', () => { lastTargets = null; traceRoutes(); });
  document.querySelectorAll('.rotas__legend input').forEach((cb) => {
    if (!cb.checked) hidden.add(cb.dataset.kind);
    cb.addEventListener('change', () => { cb.checked ? hidden.delete(cb.dataset.kind) : hidden.add(cb.dataset.kind); countStatus(); });
  });
  $('#rotasSearch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#rotasQ').value.trim();
    if (!q) return;
    setStatus('Procurando endereço em Maricá…', true);
    try {
      const bb = BBOX.map((v) => v.toFixed(4)).join(',');
      const r = await fetchT(`https://photon.komoot.io/api/?limit=8&bbox=${bb}&lat=${START[1]}&lon=${START[0]}&q=` + encodeURIComponent(q + ' Maricá'));
      const j = await r.json();
      const f = j.features.find((x) => inMarica(x.geometry.coordinates));
      if (!f) return setStatus('Endereço não encontrado em Maricá.');
      const ll = f.geometry.coordinates;
      lastTargets = null;
      origin.setLngLat(ll); lastGood = ll;
      map.flyTo({ center: ll, zoom: 15 });
      if (routed) traceRoutes(); else setStatus('Ponto de partida definido · clique em “Traçar rotas seguras”');
    } catch (err) { setStatus('Busca indisponível no momento.'); }
  });
  }
})();
