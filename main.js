(async () => {
let THREE = null, GLTFLoader = null;
try { THREE = await import('three'); } catch (e) { console.warn('three.js indisponível', e); }
try { ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); } catch (e) { console.warn('GLTFLoader indisponível', e); }

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const mq = (q) => window.matchMedia && matchMedia(q).matches;
const store = {
  pointer: { x: 0, y: 0, speed: 0 },
  activeLayer: -1,
  intro: { v: 0 },
  vprog: 0, // progresso do vídeo controlado pela rolagem (0..1)
  fprog: 0, // progresso do percurso da bolinha em Como funciona (0..1)
  reduced: mq('(prefers-reduced-motion: reduce)'),
  fine: mq('(hover: hover) and (pointer: fine)'),
};
const low = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || innerWidth < 760;

/* =========================================================
   THEME
   ========================================================= */
const root = document.documentElement;
let theme = 'branco';
try { theme = localStorage.getItem('ar-theme') || 'branco'; } catch (e) {}
root.dataset.theme = theme;

/* =========================================================
   SMOOTH SCROLL (Lenis + GSAP ticker)
   ========================================================= */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
let lenis = null;
if (!store.reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToTarget = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: store.reduced ? 'auto' : 'smooth' });
};
document.querySelectorAll('[data-link]').forEach((a) =>
  a.addEventListener('click', (e) => { e.preventDefault(); scrollToTarget(a.getAttribute('href')); })
);

addEventListener('pointermove', (ev) => {
  const p = store.pointer;
  const x = (ev.clientX / innerWidth) * 2 - 1;
  const y = -((ev.clientY / innerHeight) * 2 - 1);
  p.speed = Math.min(1.5, p.speed + Math.hypot(x - p.x, y - p.y) * 2.2);
  p.x = x; p.y = y;
}, { passive: true });


/* LOGO 3D (logo.glb, feito no Blender) — cada camada é uma parte do sino.
   Objetos no .glb: L0_Borda, L1_Corpo, L2_Silhueta + L2_Mechas, L3_Pegador, L4_Raios, Badalo */
const LOGO_URL = 'logo.glb';
const LOGO_SIZE = 2.5; // maior dimensão do logo em unidades da cena
const LOGO_MATS = {
  L0_Borda:    { color: '#b5144f', roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 },
  L1_Corpo:    { color: '#e8357a', roughness: 0.2,  metalness: 0.3,  clearcoat: 1, clearcoatRoughness: 0.08 },
  L2_Silhueta: { color: '#fff4f7', roughness: 0.18, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.1 },
  L2_Mechas:   { color: '#e8357a', roughness: 0.2,  metalness: 0.3,  clearcoat: 1 },
  L3_Pegador:  { color: '#e8357a', roughness: 0.15, metalness: 0.5,  clearcoat: 1 },
  L4_Raios:    { color: '#ff3d7f', roughness: 0.2,  metalness: 0.2,  clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6 },
};
const LOGO_MAX_TURN = 0.45; // rotação máxima (rad) que as poses de rolagem aplicam ao logo
const LOGO_SWAY = 0.35;    // amplitude do balanço contínuo (rad)
const LOGO_MAX_X = 0.66;   // posição horizontal máxima do logo (1 = borda direita)
const LOGO_TILT = 0.45;   // fração da inclinação (rx) das poses aplicada ao logo
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* =========================================================
   POSES per section (scroll-driven)
   video / lib / dock = modos especiais do sino (vídeo, biblioteca, mapa)
   flip = espelha o sino (o rosto olha para a esquerda)
   ========================================================= */
const DEF = { x: 0, y: 0, s: 1, rx: 0.4, ry: 0, rz: 0, presence: 1, spin: 1, video: 0, lib: 0, dock: 0, flip: 1, flow: 0, app: 0 };
const POSES = {
  home: (i, m) => m ? { x: 0.1, y: 0.42, s: 0.56, rx: 0.5, ry: -0.6, rz: 0.16 }
                    : { x: 0.62, y: 0.06, s: 0.8, rx: 0.46, ry: -0.6, rz: 0.16 },
  about: (i, m) => m ? { x: 0.9, y: 0.45, s: 0.5, rx: 1, ry: 1 + i }
                     : { x: 1.0, y: 0.05 - i * 0.1, s: 1, rx: 1.05, ry: 0.4 + i * 1.4, rz: -0.25, spin: 0.4 },
  expertise: (i, m) => m ? { x: 0.75, y: 0.4, s: 0.42, rx: 0.3, ry: -0.5 + i * 1.2, spin: 0.25 }
                         : { x: 0.56, y: -0.02, s: 0.78, rx: 0.3, ry: -0.6 + i * 1.1, spin: 0.25 },
  // durante o vídeo: pequeno, no canto, rachado (ver crack no tick)
  video: (i, m) => m ? { x: 0.58, y: -0.07, s: 0.26, rx: 0.3, ry: -0.4, spin: 0.2, video: 1 }
                     : { x: 0.66, y: -0.36, s: 0.34, rx: 0.3, ry: -0.5, spin: 0.2, video: 1 },
  // biblioteca: pousado no canto superior direito da capa em foco, olhando para ela (posição real no tick)
  work: () => ({ x: 0.6, y: 0.4, s: 0.4, rx: 0.15, ry: 0.25, rz: 0.2, spin: 0.08, lib: 1, flip: -1 }),
  // como funciona: o badalo sai e percorre os passos (ver flow no tick)
  approach: (i, m) => ({ x: m ? 0.55 : 0.62, y: m ? 0.45 : 0.05, s: m ? 0.44 : 0.8, rx: 0.36, ry: -0.6 + i * 1.2, spin: 0.2, flow: 1 }),
  // rotas: vira o ponto de partida do mapa (posição real calculada no tick)
  rotas: () => ({ x: 0.9, y: -0.3, s: 0.3, rx: 0.15, ry: 0, spin: 0.12, dock: 1 }),
  // contato: entra no celular que sobe da parte de baixo e toca dentro do app (posição real no tick)
  contact: (i, m) => m ? { x: 0.5, y: -0.6, s: 0.42, rx: 0.15, ry: 0, rz: 0, spin: 0.1, app: 1 }
                       : { x: 0.62, y: -0.6, s: 0.6, rx: 0.15, ry: 0, rz: 0, spin: 0.1, app: 1 },
};
let segs = [], vh = innerHeight, mobile = false;
function measure() {
  vh = innerHeight; mobile = innerWidth / innerHeight < 0.85;
  segs = [...document.querySelectorAll('[data-pose]')].map((el) => {
    // seção fixada (pin): mede o espaçador, que inclui o trecho em que ela fica parada
    const box = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    const r = box.getBoundingClientRect(), top = r.top + scrollY;
    let a = top - vh * 0.3, b = top + r.height - vh * 0.8;
    if (b < a) a = b = (a + b) / 2;
    return { id: el.dataset.pose, top, h: r.height, a, b };
  });
}
const poseOf = (sg, y) => {
  const p = { ...DEF, ...POSES[sg.id](clamp((y - sg.top) / Math.max(1, sg.h - vh)), mobile) };
  p.x = Math.min(p.x, LOGO_MAX_X); // logo nunca fica cortado na borda
  return p;
};
function poseAt(y) {
  if (!segs.length) return { ...DEF };
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k], n = segs[k + 1];
    if (y <= s.b || !n) return poseOf(s, y);
    if (y < n.a) {
      const t = smooth((y - s.b) / (n.a - s.b)), A = poseOf(s, y), B = poseOf(n, y), o = {};
      for (const key in A) o[key] = A[key] + (B[key] - A[key]) * t;
      return o;
    }
  }
  return { ...DEF };
}

/* =========================================================
   ONDA DE CHOQUE + TREMOR (quando o sino toca)
   ========================================================= */
function shockwave(x, y, k = 1, color = '#e3336d') {
  if (x < -200 || y < -200 || x > innerWidth + 200 || y > innerHeight + 200) return;
  [0, 0.12].forEach((d, j) => {
    const el = document.createElement('i');
    el.className = 'shock';
    el.style.cssText = `left:${x}px;top:${y}px;--k:${k};--c:${color};animation-delay:${d}s;opacity:${j ? 0.6 : 1}`;
    document.body.append(el);
    el.addEventListener('animationend', () => el.remove());
  });
}
function shake(k = 1) {
  if (store.reduced) return;
  const els = [...document.querySelectorAll('.big, .hero__title, .contact__title, .section-head, .cols i, .layers li, .step')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  els.forEach((el, i) => gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -7 * k, 6 * k, -3 * k, 1.5 * k, 0] }, duration: 0.55, ease: 'power2.out', delay: i * 0.012, overwrite: 'auto' }));
}

/* =========================================================
   TINTA ROSA (troca de tema): a tinta se espalha a partir do sino,
   o tema troca por baixo dela e ela escorre para fora da tela
   ========================================================= */
function inkWave(x, y, onCovered) {
  const el = document.createElement('div');
  el.className = 'ink';
  // escorridos irregulares na borda de cima (a tinta "agarra" na tela enquanto desce)
  let d = 'M0 40 L0 30';
  for (let i = 0, n = 26; i < n; i++) {
    const x0 = (i / n) * 100, w = 100 / n, h = 30 - (4 + Math.random() * 26) * (Math.random() < 0.55 ? 1 : 0.25);
    d += ` L${x0.toFixed(2)} 30 C${(x0 + w * 0.15).toFixed(2)} 30 ${(x0 + w * 0.2).toFixed(2)} ${h.toFixed(1)} ${(x0 + w * 0.5).toFixed(2)} ${h.toFixed(1)} C${(x0 + w * 0.8).toFixed(2)} ${h.toFixed(1)} ${(x0 + w * 0.85).toFixed(2)} 30 ${(x0 + w).toFixed(2)} 30`;
  }
  d += ' L100 40 Z';
  el.innerHTML = `<svg class="ink__drips" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  document.body.append(el);
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 60;
  gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(el, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 0.8, ease: 'power2.in' })
    .add(onCovered)
    .set(el, { clipPath: 'none' })
    .to(el, { y: () => innerHeight * 1.5, duration: 1.25, ease: 'power2.in' }, '+=0.2');
}

/* ponte com o resto do site (rolagem, tema e mapa chamam o sino por aqui) */
const bell = { ring() {}, screen: () => null, dive() {} };

/* =========================================================
   THREE SCENE
   ========================================================= */
const host = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }

/* rachaduras (Voronoi 3D) + brilho de cura + tinta, injetados no material do logo */
const FX = { uCrack: { value: 0 }, uHeal: { value: 0 }, uPaint: { value: 0 } };
function patchFx(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FX);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uCrack; uniform float uHeal; uniform float uPaint; varying vec3 vPosL;
vec3 ckHash(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
float ckEdge(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + ckHash(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
float ckMask(vec3 p){ return max(1.0 - smoothstep(0.0, 0.07, ckEdge(p * 3.0)), (1.0 - smoothstep(0.0, 0.04, ckEdge(p * 7.0 + 3.1))) * 0.55); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float ck = 0.0;
if (uCrack + uHeal > 0.001) ck = ckMask(vPosL);
float ckLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(ckLum) * 0.5, uCrack * 0.75);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.01, 0.03), ck * uCrack);
// tinta: escorre de cima para baixo conforme seca
float wet = uPaint * smoothstep(-1.4, 0.6, vPosL.y + (uPaint - 1.0) * 2.4);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.03, 0.14), wet * 0.9);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.3, 0.6) * (ck * uHeal * 4.0 + uHeal * 0.3);`);
  };
  mat.customProgramCacheKey = () => 'fx';
  return mat;
}

/* trilha dos passos (ideia 3): caminho SVG ligando Ouvir -> Informar -> Conectar -> Acompanhar */
const flow = { box: document.querySelector('.steps'), svg: null, path: null, len: 0, steps: [] };
function buildFlow() {
  const box = flow.box;
  if (!box) return;
  if (!flow.svg) {
    const NS = 'http://www.w3.org/2000/svg';
    flow.svg = document.createElementNS(NS, 'svg'); flow.svg.setAttribute('class', 'steps__trail'); flow.svg.setAttribute('aria-hidden', 'true');
    flow.path = document.createElementNS(NS, 'path'); flow.svg.append(flow.path); box.prepend(flow.svg);
    flow.steps = [...box.querySelectorAll('.step')];
  }
  const w = box.clientWidth, h = box.clientHeight;
  flow.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  flow.svg.style.width = w + 'px'; flow.svg.style.height = h + 'px';
  // posição de layout (sem as animações de entrada), para a trilha não nascer torta
  const pts = flow.steps.map((el) => [el.offsetLeft, el.offsetTop]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2, flat = Math.abs(y1 - y0) < 10;
    d += ` C${x0 + (x1 - x0) * 0.2} ${flat ? y0 - 46 : my} ${x1 - (x1 - x0) * 0.2} ${flat ? y1 - 46 : my} ${x1} ${y1}`;
  }
  flow.path.setAttribute('d', d);
  flow.len = flow.path.getTotalLength();
  flow.path.style.strokeDasharray = flow.len;
  // comprimento da trilha em que fica cada passo
  flow.anchors = pts.map(([ax, ay], i) => {
    if (i === 0) return 0;
    if (i === pts.length - 1) return flow.len;
    let best = 0, bd = Infinity;
    for (let L = 0; L <= flow.len; L += 2) { const q = flow.path.getPointAtLength(L); const d = (q.x - ax) ** 2 + (q.y - ay) ** 2; if (d < bd) { bd = d; best = L; } }
    return best;
  });
}

/* celular do final: o sino toca dentro do app */
const PHONE_TURN = -0.75; // giro do sino para combinar com o celular inclinado
const phone = {
  el: document.querySelector('.phone'),
  slot: document.querySelector('.phone__bell'),
  buzz() {
    if (!this.el) return;
    this.el.classList.remove('is-buzz'); void this.el.offsetWidth; this.el.classList.add('is-buzz'); // vibra
    const rp = document.createElement('i'); rp.className = 'phone__ripple'; // onda dentro do visor
    this.slot.append(rp); rp.addEventListener('animationend', () => rp.remove());
  },
};

/* roteiro do percurso da bolinha (proporções ao longo da rolagem) */
const JOURNEY = { exit: 1.6, hold: 0.6, move: 1.7, ret: 1.6 };
const journeyTotal = () => { const n = (flow.anchors || [0, 0]).length, J = JOURNEY; return J.exit + n * J.hold + (n - 1) * J.move + J.ret; };
function journeyAt(t) {
  const A = flow.anchors || [0, flow.len], n = A.length, { exit, hold, move, ret } = JOURNEY;
  if (t < exit) return { mode: 'exit', e: t / exit, len: 0, lit: -1 };
  t -= exit;
  for (let i = 0; i < n; i++) {
    if (t < hold) return { mode: 'hold', len: A[i], lit: i };
    t -= hold;
    if (i === n - 1) break;
    if (t < move) { const e = t / move, k = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2; return { mode: 'move', len: A[i] + (A[i + 1] - A[i]) * k, lit: i }; }
    t -= move;
  }
  if (t < ret) return { mode: 'return', e: t / ret, len: flow.len, lit: n - 1 };
  return { mode: 'done', len: flow.len, lit: n - 1 };
}

const sceneReady = new Promise(async (resolve) => {
  if (!renderer) return resolve();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(0, 0, 9);

  /* environment built from "lightformers" */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function buildEnv(t) {
    const light = t === 'branco';
    const env = new THREE.Scene();
    const bg = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshBasicMaterial({ color: light ? '#d9b8c3' : '#c9668a', side: THREE.BackSide }));
    bg.scale.setScalar(50); env.add(bg);
    const lf = (geo, color, intensity, pos, rot, scale) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos); if (rot) m.rotation.set(...rot); m.scale.set(...scale);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    const plane = new THREE.PlaneGeometry(1, 1), ring = new THREE.RingGeometry(0.5, 1, 64);
    lf(plane, '#ffffff', light ? 9 : 6, [0, 6, -1], null, light ? [11, 4, 1] : [9, 3, 1]);
    lf(plane, '#ffffff', light ? 5 : 4, [-7, 1, 3], null, [3, 9, 1]);
    lf(plane, '#ff3d7f', light ? 3 : 4, [7, -1, 2], null, [2.2, 7, 1]);
    lf(ring, '#ffffff', light ? 6 : 4, [1, -5, 4], null, [3.4, 3.4, 1]);
    lf(plane, light ? '#ffffff' : '#ffd6e3', 2, [3, 3, 8], null, [5, 0.8, 1]);
    lf(plane, '#ffffff', light ? 4 : 2.4, [-3, -2, 9], null, [1, 5, 1]);
    const rt = pmrem.fromScene(env, 0, 0.1, 100);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
    env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  buildEnv(theme);
  window.addEventListener('themechange', (e) => buildEnv(e.detail));

  const dl = new THREE.DirectionalLight('#ffffff', 1.4); dl.position.set(4, 6, 5); scene.add(dl);
  scene.add(new THREE.PointLight('#ff3d7f', 2.5, 3));

  // group (pose) → pivot (topo do sino, onde ele balança) → body (peças)
  const group = new THREE.Group(), pivot = new THREE.Group(), body = new THREE.Group();
  scene.add(group); group.add(pivot); pivot.add(body);

  /* logo do Blender */
  async function buildLogo() {
    const gltf = await new GLTFLoader().loadAsync(LOGO_URL);
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    gltf.scene.traverse((o) => { if (o.isMesh) parts.push({ name: o.name, geo: o.geometry.clone().applyMatrix4(o.matrixWorld) }); });
    if (!parts.length) throw new Error('logo.glb sem malhas');

    // centraliza e normaliza o tamanho
    const box = new THREE.Box3();
    parts.forEach((p) => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = LOGO_SIZE / Math.max(size.x, size.y, size.z);
    parts.forEach((p) => { p.geo.translate(-c.x, -c.y, -c.z); p.geo.scale(k, k, k); p.geo.computeBoundingBox(); });

    // ponto de balanço = topo do pegador; borda = base (de onde a tinta pinga)
    const peg = new THREE.Box3(), rim = new THREE.Box3();
    parts.filter((p) => p.name.startsWith('L3_')).forEach((p) => peg.union(p.geo.boundingBox));
    parts.filter((p) => p.name.startsWith('L0_')).forEach((p) => rim.union(p.geo.boundingBox));

    let clapper = null;
    const bad = parts.find((p) => p.name.startsWith('Badalo'));
    if (bad) { const bb = bad.geo.boundingBox; clapper = { pos: bb.getCenter(new THREE.Vector3()), r: (bb.max.x - bb.min.x) / 2 }; }

    const layers = [0, 1, 2, 3, 4].map((n) => {
      const g = new THREE.Group(), mats = [];
      parts.filter((p) => p.name.startsWith(`L${n}_`)).forEach((p) => {
        const key = Object.keys(LOGO_MATS).find((m) => p.name.startsWith(m));
        const mat = patchFx(new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.3, emissive: '#ff2f72', emissiveIntensity: 0, ...(LOGO_MATS[key] || LOGO_MATS.L1_Corpo) }));
        mats.push(mat); g.add(new THREE.Mesh(p.geo, mat));
      });
      body.add(g);
      return { g, mats };
    });
    return {
      layers, clapper,
      pivotY: peg.isEmpty() ? 0.5 : peg.max.y,
      rimY: rim.isEmpty() ? -1 : rim.min.y, rimR: rim.isEmpty() ? 0.8 : (rim.max.x - rim.min.x) / 2,
    };
  }

  let L = null;
  try { L = await buildLogo(); }
  catch (e) { console.warn('Não foi possível carregar logo.glb (abra o site por um servidor, não via file://)', e); return resolve(); }
  const { layers, clapper } = L;
  pivot.position.y = L.pivotY; body.position.y = -L.pivotY;

  // badalo = bolinha perolada
  const coreMat = new THREE.MeshPhysicalMaterial({ ...LOGO_MATS.L1_Corpo, envMapIntensity: 1.3, emissive: '#ff2f72', emissiveIntensity: 0.1 }); // mesmo material do sino
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.33, 40, 28), coreMat);
  const coreK = clapper ? clapper.r / 0.33 : 1;
  body.add(core);

  /* fragmentos de luz (mapa) e gotas de tinta (troca de tema) */
  const shardGeo = new THREE.CapsuleGeometry(0.035, 0.42, 3, 8);
  const dropGeo = new THREE.SphereGeometry(1, 12, 10);
  const dropMat = new THREE.MeshPhysicalMaterial({ color: '#d81b60', roughness: 0.08, clearcoat: 1, transparent: true });
  const shards = [], drops = [];
  /* no percurso dos passos a bolinha sai do sino um pouco mais brilhante */
  // incandescente: a própria bolinha emite luz — núcleo branco-quente, borda rosa, leve cintilação
  const ballMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uT; uniform float uK; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = clamp(dot(normalize(vN), normalize(-vV)), 0.0, 1.0);
        float flick = 0.93 + 0.07 * sin(uT * 17.0) * sin(uT * 7.3);
        vec3 edge = vec3(0.86, 0.13, 0.40), mid = vec3(1.0, 0.52, 0.70), hot = vec3(1.0, 0.97, 0.98);
        vec3 col = mix(edge, mid, smoothstep(0.0, 0.5, f));
        col = mix(col, hot, smoothstep(0.5, 0.95, f) * (0.55 + 0.45 * uK));
        gl_FragColor = vec4(col * (0.8 + 0.3 * uK) * flick, 1.0);
      }`,
  });
  const ball = new THREE.Mesh(core.geometry, ballMat);
  const ballLight = new THREE.PointLight('#ff8fb8', 0, 3); ball.add(ballLight); // a luz dela ilumina o sino de verdade
  ball.visible = false; scene.add(ball);

  const clapLocal = clapper ? clapper.pos.clone() : new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const cur = { ...DEF, presence: 1 };
  const st = { px: 0, py: 0, act: layers.map(() => 0), t: 0, energy: 0, flash: 0, healed: false, docked: false, front: false,
    focus: null, hop: 1, glow: new Map(), dive: 0, paint: 0, drip: 0, travel: false, flowRang: false, lit: -1,
    fSign: 1, appT: 0.8 };
  const sw = { A: 0, t: 9, prevV: 1, disp: 0, hits: 0 }; // balanço do sino
  const VH = 2 * 9 * Math.tan(THREE.MathUtils.degToRad(15));
  const tmp = new THREE.Vector3();
  const books = [...document.querySelectorAll('.book')];
  const bellScr = { x: -1e4, y: -1e4, r: 0 };
  let last = performance.now();

  const toScreen = (v) => { tmp.copy(v).project(camera); return { x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight }; };
  const toWorld = (sx, sy) => new THREE.Vector3((sx / innerWidth * 2 - 1) * VH * camera.aspect / 2, -(sy / innerHeight * 2 - 1) * VH / 2, 0);

  /* ---------- 1. o sino toca ---------- */
  bell.ring = (k = 1) => {
    if (cur.presence < 0.35 || store.intro.v < 0.5) return;
    sw.A = Math.max(sw.A * Math.exp(-sw.t * 1.5), (store.reduced ? 0.06 : 0.3) * k);
    sw.t = 0; sw.hits = 0;
    hit(k * 0.8);
  };
  function hit(k) {
    st.flash = Math.min(1.6, st.flash + 0.9 * k);
    if (cur.app > 0.5) { phone.buzz(); return; }
    const p = toScreen(group.getWorldPosition(tmp));
    shockwave(p.x, p.y, 0.45 + 0.6 * k);
    if (sw.hits++ === 0) shake(Math.min(1.2, k));
  }
  bell.screen = () => (cur.presence > 0.3 && bellScr.x > 0 && bellScr.x < innerWidth && bellScr.y > 0 && bellScr.y < innerHeight) ? { x: bellScr.x, y: bellScr.y } : null;

  /* ---------- 9. mergulho na tinta ---------- */
  bell.dive = () => {
    host.classList.add('is-ink');
    gsap.timeline({ onComplete: () => host.classList.remove('is-ink') })
      .to(st, { dive: 1, duration: 0.75, ease: 'power2.in' })
      .add(() => { st.paint = 1; st.drip = 2.4; })
      .to(st, { dive: 0, duration: 1.1, ease: 'back.out(1.6)' }, '+=0.2')
      .to({}, { duration: 1.2 });
  };

  /* clique no sino = tocar */
  const interactive = 'a, button, input, label, select, textarea, .rotas__frame, .pill, .toggle';
  addEventListener('pointerdown', (e) => {
    if (e.target.closest(interactive)) return;
    if (Math.hypot(e.clientX - bellScr.x, e.clientY - bellScr.y) < bellScr.r) bell.ring(1);
  });
  addEventListener('pointermove', (e) => {
    const over = !e.target.closest(interactive) && Math.hypot(e.clientX - bellScr.x, e.clientY - bellScr.y) < bellScr.r;
    document.body.classList.toggle('over-bell', over);
  }, { passive: true });

  /* ---------- 3. mapa: fragmentos de luz até os destinos ---------- */
  window.addEventListener('alerta:rays', (e) => {
    bell.ring(0.9);
    const from = body.localToWorld(new THREE.Vector3(0, 0.9, 0));
    (e.detail?.points || []).forEach((pt, j) => {
      const m = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: pt.color, toneMapped: false, transparent: true }));
      m.position.copy(from); m.visible = false;
      m.scale.setScalar(Math.max(0.6, group.scale.y * 2.2));
      scene.add(m);
      shards.push({ m, from: from.clone(), to: toWorld(pt.x, pt.y), t: -j * 0.08, dur: 0.7, pt });
    });
  });

  function tick() {
    const now = performance.now();
    const M = Math.min((now - last) / 1000, 0.05); last = now;
    if (!store.reduced) st.t += M;
    const vw = VH * camera.aspect;
    const D = Math.min(VH, vw * 1.2) * 0.3, I = store.intro.v;
    const pxPerUnit = innerHeight / VH;
    const T = poseAt(scrollY);

    /* ---------- 3. encaixa no ponto de partida do mapa ---------- */
    if (T.dock > 0.001) {
      const d = window.alertaRosa?.dock?.();
      if (d) {
        const pxH = mobile ? 62 : 76, k = T.dock;
        const nx = d.x / innerWidth * 2 - 1, ny = -((d.y - pxH * 0.4) / innerHeight * 2 - 1);
        T.x += (nx - T.x) * k; T.y += (ny - T.y) * k; T.s += (pxH / (LOGO_SIZE * D * pxPerUnit) - T.s) * k;
        T.presence *= d.visible ? 1 : 1 - k;
      } else T.presence *= 1 - T.dock;
    }

    /* ---------- 4. biblioteca: pousado no canto da capa em foco ---------- */
    if (T.lib > 0.001 && books.length) {
      let best = null, bd = Infinity;
      books.forEach((b) => { const r = b.getBoundingClientRect(); const dd = Math.abs(r.left + r.width / 2 - innerWidth * 0.5); if (dd < bd) { bd = dd; best = b; } });
      if (best !== st.focus) { st.focus = best; st.hop = 0; }
      const r = best.querySelector('.book__cover').getBoundingClientRect();
      const pxH = mobile ? 84 : clamp(r.height * 0.4, 100, 150), k = T.lib;
      const lift = Math.sin(Math.PI * st.hop) * pxH * 0.6; // pulinho ao trocar de livro
      const nx = Math.min(r.right - pxH * 0.08, innerWidth - pxH * 0.5) / innerWidth * 2 - 1; // nunca sai da tela
      const ny = -((r.top - pxH * 0.1 - lift) / innerHeight * 2 - 1);
      T.x += (nx - T.x) * k; T.y += (ny - T.y) * k; T.s += (pxH / (LOGO_SIZE * D * pxPerUnit) - T.s) * k;
    }
    st.hop = Math.min(1, st.hop + M / 0.55);

    /* ---------- final: dentro do app no celular ---------- */
    let inPhone = false;
    if (T.app > 0.001 && phone.slot) {
      const r = phone.slot.getBoundingClientRect(), k = T.app;
      inPhone = r.top < innerHeight - r.height * 0.4 && r.bottom > 0;
      const pxH = Math.min(r.height, r.width) * 0.95; // cabe inteiro no visor
      const nx = (r.left + r.width / 2) / innerWidth * 2 - 1, ny = -((r.top + r.height * 0.5) / innerHeight * 2 - 1);
      T.x += (nx - T.x) * k; T.y += (ny - T.y) * k; T.s += (pxH / (LOGO_SIZE * D * pxPerUnit) - T.s) * k;
      T.ry += (PHONE_TURN - T.ry) * k; // acompanha a perspectiva do celular
    }

    // suavização (no mapa e na capa o sino gruda no alvo; ao trocar de livro ele desliza)
    const E = store.reduced ? 1 : 1 - Math.exp(-M * 4.5), Ef = 1 - Math.exp(-M * 22), Eh = 1 - Math.exp(-M * 9);
    const stick = (T.dock > 0.9 && cur.dock > 0.85) || (T.lib > 0.9 && cur.lib > 0.85);
    const ePos = stick ? (st.hop < 1 ? Eh : Ef) : (T.app > 0.9 && cur.app > 0.8 ? Eh : E);
    for (const k in cur) cur[k] += (T[k] - cur[k]) * (k === 'x' || k === 'y' || k === 's' || k === 'presence' ? ePos : E);

    // por cima do conteúdo no vídeo, na biblioteca e no mapa; atrás do texto no resto
    const front = cur.video > 0.02 || cur.dock > 0.02 || cur.lib > 0.02 || st.travel || cur.app > 0.02;
    // dentro do app ele toca sozinho de tempos em tempos
    if (cur.app > 0.9 && inPhone && cur.presence > 0.5) { st.appT -= M; if (st.appT <= 0) { bell.ring(0.7); st.appT = 2.8; } } else st.appT = 0.9;
    if (front !== st.front) { st.front = front; host.classList.toggle('is-front', front); }
    const docked = cur.dock > 0.85 && cur.presence > 0.5;
    if (docked !== st.docked) { st.docked = docked; document.body.classList.toggle('bell-docked', docked); }

    // a capa em foco recebe a luz que sai do sino
    if (cur.lib > 0.01 || st.glow.size) {
      books.forEach((b) => {
        const target = b === st.focus ? cur.lib * cur.presence * (st.hop < 1 ? st.hop : 1) : 0;
        const g = (st.glow.get(b) || 0) + (target - (st.glow.get(b) || 0)) * (1 - Math.exp(-M * 6));
        if (g < 0.002 && target === 0) { if (st.glow.has(b)) { st.glow.delete(b); b.style.removeProperty('--glow'); } return; }
        st.glow.set(b, g); b.style.setProperty('--glow', g.toFixed(3));
      });
    }

    if (cur.presence < 0.002 && T.presence < 0.002 && !shards.length && !drops.length) { bellScr.r = 0; return; }

    const s = 1 - Math.exp(-M * 3);
    st.px += (store.pointer.x - st.px) * s;
    st.py += (store.pointer.y - st.py) * s;
    st.energy += (Math.min(store.pointer.speed, 1) - st.energy) * (1 - Math.exp(-M * 2));
    store.pointer.speed *= Math.exp(-M * 6);

    const dive = st.dive;
    group.position.set((cur.x * vw) / 2, (cur.y * VH) / 2 + (1 - I) * -0.6 - dive * 0.9, 0);
    const gs = Math.max(1e-4, D * cur.s * cur.presence * (0.6 + 0.4 * I) * (1 - dive * 0.25));
    // virar o rosto para a capa: o sino gira de verdade até ficar de perfil (90°), troca de lado
    // nesse instante (invisível, pois o corpo é simétrico) e termina o giro olhando para o outro lado
    if (Math.abs(cur.flip) > 0.02) st.fSign = Math.sign(cur.flip);
    const turn = (1 - Math.min(1, Math.abs(cur.flip))) * Math.PI / 2;
    group.scale.set(gs * st.fSign, gs, gs);
    const ry = Math.sin(cur.ry) * LOGO_MAX_TURN + Math.sin(st.t * 0.4) * LOGO_SWAY * cur.spin + turn
      - Math.atan2(group.position.x, camera.position.z) // frente sempre virada pra câmera
      + dive * Math.PI * 2; // gira ao mergulhar na tinta
    const parallax = 1 - Math.max(cur.dock, cur.lib) * 0.7;
    group.rotation.set(cur.rx * LOGO_TILT - st.py * 0.22 * parallax, ry + st.px * 0.45 * parallax + (1 - I) * 2.4, cur.rz + st.px * 0.05 * parallax);

    const ps = toScreen(group.position);
    bellScr.x = ps.x; bellScr.y = ps.y; bellScr.r = cur.presence > 0.3 ? LOGO_SIZE * gs * pxPerUnit * 0.42 : 0;

    /* ---------- 1. balanço de pêndulo + batidas do badalo ---------- */
    sw.t += M;
    const env = sw.A * Math.exp(-sw.t * 1.5);
    const th = env * Math.sin(sw.t * 9.5), v = Math.cos(sw.t * 9.5);
    if (env > 0.035 && (v > 0) !== (sw.prevV > 0) && sw.t > 0.08) hit(env / 0.3);
    sw.prevV = v;
    sw.disp += (th - sw.disp) * 0.5;
    pivot.rotation.z = sw.disp;
    st.flash *= Math.exp(-M * 3.5);

    /* ---------- 6. vídeo: rachado → cura ---------- */
    const p = store.vprog;
    const crackU = smooth(clamp(p / 0.06)) * (1 - smooth(clamp((p - 0.8) / 0.14))) * cur.video;
    FX.uCrack.value = crackU;
    FX.uHeal.value = smooth(clamp(1 - Math.abs(p - 0.91) / 0.09)) * cur.video;
    if (cur.video > 0.5 && p > 0.95 && !st.healed) { st.healed = true; bell.ring(1.1); }
    if (p < 0.7) st.healed = false;
    const tremble = crackU * (1 - FX.uHeal.value);

    /* ---------- 3. como funciona: a bolinha percorre os passos acompanhando a rolagem ----------
       a seção fica fixada na tela enquanto isso (ver pin em setupScroll), então rolar devagar = andar devagar */
    if (cur.flow > 0.02 && flow.box && !flow.len) buildFlow();
    const fp = store.fprog;
    let J = null;
    if (flow.len && cur.flow > 0.02) {
      J = journeyAt(fp * journeyTotal());
      flow.path.style.strokeDashoffset = flow.len * (1 - J.len / flow.len);
      const lit = fp > 0.001 ? J.lit : -1;
      if (lit !== st.lit) { st.lit = lit; flow.steps.forEach((el, k) => el.classList.toggle('is-lit', k <= lit)); }
    }
    if (fp >= 0.995 && !st.flowRang && cur.flow > 0.5) { st.flowRang = true; bell.ring(0.9); } // voltou para o sino: toca
    if (fp < 0.8) st.flowRang = false;
    st.travel = !!J && cur.flow > 0.3 && fp > 0.002 && J.mode !== 'done';
    if (st.travel) {
      const sb = flow.svg.getBoundingClientRect();
      const ptAt = (len) => { const q = flow.path.getPointAtLength(len); return toWorld(sb.left + q.x, sb.top + q.y); };
      const home = body.localToWorld(clapLocal.clone());
      // sai e volta sempre pela boca do sino (por baixo), nunca atravessando o corpo
      const below = body.localToWorld(new THREE.Vector3(clapLocal.x, L.rimY - 0.6, clapLocal.z));
      let pos, k = 1;
      if (J.mode === 'exit') {
        const e = J.e;
        if (e < 0.3) { pos = home.lerp(below, smooth(e / 0.3)); }
        else { const t2 = smooth((e - 0.3) / 0.7); pos = below.clone().lerp(ptAt(0), t2); pos.y -= Math.sin(Math.PI * t2) * 0.45; }
        k = smooth(clamp(e * 2));
      } else if (J.mode === 'return') {
        const e = J.e;
        if (e < 0.7) { const t2 = smooth(e / 0.7); pos = ptAt(flow.len).lerp(below, t2); pos.y -= Math.sin(Math.PI * t2) * 0.45; }
        else { pos = below.clone().lerp(home, smooth((e - 0.7) / 0.3)); }
        k = 1 - smooth(clamp((e - 0.7) / 0.3));
      } else pos = ptAt(J.len);
      ball.position.copy(pos);
      ball.scale.setScalar(coreK * gs * 0.62); // menor no percurso
      ballMat.uniforms.uK.value = k; ballMat.uniforms.uT.value = st.t;
      ballLight.intensity = 2.4 * k;
    }
    ball.visible = st.travel;
    core.visible = !st.travel;

    /* ---------- 9. tinta secando ---------- */
    st.paint = Math.max(0, st.paint - M / 3.2);
    FX.uPaint.value = st.paint;

    const act = store.activeLayer;
    layers.forEach((Ly, n) => {
      st.act[n] += ((act === n ? 1 : 0) - st.act[n]) * (1 - Math.exp(-M * 6));
      // só treme quando está rachado; as peças nunca se separam
      Ly.g.position.set(Math.sin(st.t * 41 + n * 7) * 0.012 * tremble, Math.sin(st.t * 37 + n * 3) * 0.009 * tremble, 0);
      Ly.g.rotation.z = Math.sin(st.t * 29 + n) * 0.015 * tremble;
      if (n === 4) Ly.g.scale.setScalar(1 + st.flash * 0.1);
      Ly.mats.forEach((m) => { m.emissiveIntensity = st.act[n] * 0.4 + (n === 4 ? st.flash * 1.1 : st.flash * 0.15); });
    });

    coreMat.emissiveIntensity = 0.1 + st.flash * 0.4;
    core.scale.setScalar(coreK);
    const swingX = -sw.disp * 1.1; // badalo atrasa e bate nas paredes
    if (clapper) core.position.set(clapper.pos.x + swingX, clapper.pos.y + Math.sin(st.t * 0.7) * 0.02, clapper.pos.z);
    else core.position.set(swingX, Math.sin(st.t * 0.7) * 0.02, 0);
    core.rotation.y = -st.t * 0.2;

    // gotas de tinta pingando da borda depois do mergulho
    if (st.drip > 0) {
      st.drip -= M;
      if (Math.random() < M * (low ? 7 : 12) * Math.min(1, st.drip)) {
        const a = Math.random() * Math.PI * 2;
        const m = new THREE.Mesh(dropGeo, dropMat.clone());
        m.position.copy(body.localToWorld(new THREE.Vector3(Math.cos(a) * L.rimR * 0.9, L.rimY, Math.sin(a) * L.rimR * 0.4)));
        const r0 = gs * (0.05 + Math.random() * 0.04);
        m.scale.set(r0, r0 * 1.4, r0);
        scene.add(m);
        drops.push({ m, vy: 0, life: 1.6 });
      }
    }
    for (let j = drops.length - 1; j >= 0; j--) {
      const dr = drops[j];
      dr.vy -= 6 * M; dr.life -= M;
      dr.m.position.y += dr.vy * M;
      dr.m.scale.y = dr.m.scale.x * (1.4 + Math.min(2, -dr.vy * 0.5));
      dr.m.material.opacity = clamp(dr.life / 0.6);
      if (dr.life <= 0) { scene.remove(dr.m); dr.m.material.dispose(); drops.splice(j, 1); }
    }

    // fragmentos de luz voando até os destinos do mapa
    for (let j = shards.length - 1; j >= 0; j--) {
      const sh = shards[j];
      sh.t += M;
      if (sh.t < 0) continue;
      const e = clamp(sh.t / sh.dur), ee = 1 - Math.pow(1 - e, 3);
      sh.m.visible = true;
      const pos = sh.from.clone().lerp(sh.to, ee); pos.y += Math.sin(Math.PI * ee) * 0.9;
      const dir = pos.clone().sub(sh.m.position);
      if (dir.lengthSq() > 1e-8) sh.m.quaternion.setFromUnitVectors(UP, dir.normalize());
      sh.m.position.copy(pos);
      sh.m.material.opacity = 1 - smooth(clamp((e - 0.85) / 0.15));
      if (e >= 1) {
        shockwave(sh.pt.x, sh.pt.y, 0.35, sh.pt.color);
        scene.remove(sh.m); sh.m.material.dispose(); shards.splice(j, 1);
      }
    }

    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // pré-compila todos os materiais (inclusive os escondidos), senão a primeira aparição trava
  const warm = [ball];
  warm.forEach((o) => { o.visible = true; });
  const tmpShard = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ transparent: true })), tmpDrop = new THREE.Mesh(dropGeo, dropMat);
  scene.add(tmpShard, tmpDrop);
  renderer.compile(scene, camera);
  scene.remove(tmpShard, tmpDrop);
  warm.forEach((o) => { o.visible = false; });
  gsap.ticker.add(tick);
  requestAnimationFrame(() => { host.classList.add('is-ready'); resolve(); });
});

/* =========================================================
   TEXT SPLITTING
   ========================================================= */
function splitChars(line) {
  const nodes = [...line.childNodes]; line.textContent = '';
  nodes.forEach((n) => {
    if (n.nodeType === 3) [...n.textContent].forEach((ch) => {
      const s = document.createElement('span'); s.className = 'char'; s.textContent = ch; line.append(s);
    });
    else { const s = document.createElement('span'); s.className = 'char'; s.append(n); line.append(s); }
  });
}
function splitWords(el) {
  const nodes = [...el.childNodes]; el.textContent = '';
  const wrap = (node) => { const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('span'); i.append(node); w.append(i); return w; };
  nodes.forEach((n) => {
    if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((p) => {
      if (!p) return;
      if (/^\s+$/.test(p)) el.append(' '); else el.append(wrap(document.createTextNode(p)));
    });
    else if (n.nodeName === 'BR') el.append(n);
    else el.append(wrap(n));
  });
}
document.querySelectorAll('.hero__line').forEach(splitChars);
document.querySelectorAll('.split').forEach(splitWords);

/* =========================================================
   THEME TOGGLE
   ========================================================= */
const applyTheme = () => {
  theme = theme === 'branco' ? 'rosa' : 'branco';
  root.dataset.theme = theme;
  try { localStorage.setItem('ar-theme', theme); } catch (e) {}
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
};
// ideia 9: a tinta sai do sino (ou do botão), cobre a tela, o tema troca por baixo e a tinta escorre
let inking = false;
const toggleBtn = document.getElementById('themeToggle');
toggleBtn.addEventListener('click', () => {
  if (store.reduced) return applyTheme();
  if (inking) return;
  inking = true;
  const b = toggleBtn.getBoundingClientRect();
  const o = bell.screen() || { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  bell.dive();
  inkWave(o.x, o.y, applyTheme);
  setTimeout(() => { inking = false; }, 2400);
});

/* layer hover */
document.querySelectorAll('.layers li').forEach((li) => {
  const n = Number(li.dataset.layer);
  li.addEventListener('mouseenter', () => { store.activeLayer = n; });
  li.addEventListener('mouseleave', () => { store.activeLayer = -1; });
  li.addEventListener('click', () => {
    const on = li.classList.toggle('is-on');
    document.querySelectorAll('.layers li').forEach((o) => o !== li && o.classList.remove('is-on'));
    store.activeLayer = on ? n : -1;
  });
});

/* =========================================================
   SCROLL ANIMATIONS
   ========================================================= */
function setupScroll() {
  const R = store.reduced;

  // biblioteca horizontal
  const track = document.getElementById('workTrack');
  const pin = document.querySelector('.work__pin');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: R ? true : 1, invalidateOnRefresh: true,
      onUpdate: (self) => gsap.set('#workBar', { scaleX: self.progress }),
      onToggle: (self) => document.body.classList.toggle('in-work', self.isActive),
    },
  });
  if (!R) {
    gsap.utils.toArray('.card__img').forEach((img) => {
      gsap.fromTo(img, { rotate: 3, y: 6 }, { rotate: -2, y: -16, ease: 'none',
        scrollTrigger: { trigger: '#work', start: 'top top', end: () => '+=' + dist(), scrub: 1 } });
    });
  }

  // split headings
  document.querySelectorAll('.split').forEach((el) => {
    if (R) return;
    gsap.from(el.querySelectorAll('.w > span'), {
      yPercent: 110, rotate: 4, duration: 1.3, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
  });

  // generic reveals
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (R) return;
    gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // counters
  document.querySelectorAll('.count').forEach((el) => {
    const to = Number(el.dataset.to), o = { v: 0 };
    const out = () => { el.textContent = Math.round(o.v).toLocaleString('pt-BR'); };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: to, duration: R ? 0 : 2.2, ease: 'power3.out', onUpdate: out }) });
  });

  // vídeo controlado pela rolagem (quadros num canvas): desce = avança, sobe = volta
  const cv = document.getElementById('vscrollCanvas');
  if (cv) {
    const ctx = cv.getContext('2d');
    const N = 144, frames = [];
    let vTarget = 0, vNow = 0, drawn = -1;
    // só baixa os quadros quando a seção se aproxima
    new IntersectionObserver((es, io) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      for (let i = 1; i <= N; i++) {
        const im = new Image(); im.decoding = 'async';
        im.onload = () => { drawn = -1; };
        im.src = `frames/f${String(i).padStart(3, '0')}.webp`; frames.push(im);
      }
    }, { rootMargin: '150% 0px' }).observe(cv);
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; drawn = -1;
    };
    const draw = (i) => {
      // usa o quadro mais próximo já carregado
      let im = frames[i];
      for (let k = 0; (!im.complete || !im.naturalWidth) && k < N; k++) im = frames[Math.max(0, i - k)];
      if (!im.complete || !im.naturalWidth) return;
      // quadro inteiro (sem corte), centralizado; laterais fundidas no preto
      const W = cv.width, H = cv.height, pad = 12 * W / cv.clientWidth; // a borda do vídeo fica escondida sob as ondas
      const s = Math.min(W / im.naturalWidth, (H - pad * 2) / im.naturalHeight);
      const w = im.naturalWidth * s, h = im.naturalHeight * s, x = (W - w) / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(im, x, (H - h) / 2, w, h);
      if (x > 1) {
        const f = w * 0.08;
        for (const [a, b] of [[x, x + f], [x + w, x + w - f]]) {
          const g = ctx.createLinearGradient(a, 0, b, 0);
          g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(Math.min(a, b), 0, f, H);
        }
      }
      drawn = i;
    };
    size(); addEventListener('resize', size);
    // a faixa fica presa no meio da tela enquanto o vídeo roda (rolagem mais longa = rosto vira devagar)
    ScrollTrigger.create({
      trigger: '.vscroll', start: 'top 65%', end: 'bottom bottom', invalidateOnRefresh: true,
      onUpdate: (self) => { vTarget = store.vprog = self.progress; },
    });
    gsap.ticker.add(() => {
      if (!frames.length) return;
      vNow += (vTarget - vNow) * (R ? 1 : 0.15);
      const i = Math.round(vNow * (N - 1));
      if (i !== drawn) draw(i);
    });
  }

  // borda rosa ondulada da faixa de vídeo (reage à rolagem)
  const band = document.querySelector('.vscroll__band');
  if (band) {
    const svgs = [...band.querySelectorAll('.vscroll__wave')];
    const H = 56, MID = 24, PTS = 120;
    let W = 0, ph = 0, amp = 5, vel = 0;
    // cursor: a borda mais próxima "puxa" em direção ao ponteiro
    let mx = -1e4, my = -1e4, hov = [0, 0];
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    const fit = () => { W = band.clientWidth; svgs.forEach((sv) => sv.setAttribute('viewBox', `0 0 ${W} ${H}`)); };
    fit(); addEventListener('resize', fit);
    const line = (off, a, k, hx = 0, hs = 0) => {
      let d = '';
      const sig = Math.max(90, W * 0.07);
      for (let i = 0; i <= PTS; i++) {
        const x = (i / PTS) * W, u = (i / PTS) * Math.PI * 2;
        const g = hs ? hs * Math.exp(-((x - hx) ** 2) / (2 * sig * sig)) : 0;
        const y = MID + off + a * (Math.sin(u * 2.5 + ph * k) + 0.35 * Math.sin(u * 5.5 - ph * 1.4 * k))
          + g * (22 + 4 * Math.sin(ph * 6 + x * 0.03));
        d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      return d;
    };
    gsap.ticker.add(() => {
      const r = band.getBoundingClientRect();
      if (r.bottom < -H || r.top > innerHeight + H || !W) return;
      const v = lenis ? lenis.velocity : 0;
      vel += (v - vel) * 0.08;
      ph += (R ? 0 : 0.015) + vel * 0.012;
      amp += ((R ? 4 : 5 + Math.min(10, Math.abs(vel) * 0.6)) - amp) * 0.08;
      const hx = mx - r.left, inX = hx >= 0 && hx <= r.width;
      svgs.forEach((sv, j) => {
        const edge = j === 0 ? r.top : r.bottom;
        const t = inX ? clamp(1 - Math.abs(my - edge) / (r.height * 0.55)) : 0;
        hov[j] += (smooth(t) - hov[j]) * 0.1;
        const main = line(0, amp, 1, hx, hov[j]);
        const [m, l2, l1] = sv.children;
        m.setAttribute('d', main + `L${W},-2L0,-2Z`);
        l1.setAttribute('d', main);
        l2.setAttribute('d', line(9, amp * 0.8, 0.8, hx, hov[j] * 0.8));
      });
    });
  }

  // como funciona: a seção fica fixada enquanto a bolinha percorre os passos (progresso = rolagem)
  const appr = document.getElementById('approach');
  if (appr) {
    ScrollTrigger.create({
      trigger: appr, pin: true, invalidateOnRefresh: true,
      start: () => (appr.offsetHeight > innerHeight ? 'bottom bottom' : 'center center'),
      end: () => '+=' + Math.round(innerHeight * 1.6),
      onUpdate: (self) => { store.fprog = self.progress; },
    });
  }

  // o celular sobe da parte de baixo da tela no final
  if (document.querySelector('.phone')) {
    gsap.fromTo('.phone', { yPercent: 118 }, { yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top 80%', end: 'bottom bottom', scrub: 1 } });
  }

  // hero parallax out
  if (!R) {
    gsap.to('.hero__title', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__foot', { opacity: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '.hero', start: '60% top', end: 'bottom top', scrub: true } });
    gsap.from('.contact__title', { scale: 0.92, transformOrigin: 'left bottom', ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top 20%', scrub: true } });
  }

  // marquee — velocity driven
  const mq = document.getElementById('marquee');
  let mx = 0, vel = 0;
  const half = () => mq.scrollWidth / 2;
  gsap.ticker.add(() => {
    if (R) return;
    const v = lenis ? lenis.velocity : 0;
    vel += (v - vel) * 0.1;
    mx -= 0.6 + Math.abs(vel) * 0.35;
    const h = half(); if (h && -mx > h) mx += h;
    mq.style.transform = `translate3d(${mx}px,0,0) skewX(${clamp(-vel * 0.25, -8, 8)}deg)`;
  });

  // nav active state
  const links = [...document.querySelectorAll('.pill a')];
  document.querySelectorAll('[data-nav]').forEach((sec) => {
    const i = Number(sec.dataset.nav);
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => { if (self.isActive) links.forEach((a, k) => a.classList.toggle('is-active', k === i)); } });
  });

  ScrollTrigger.addEventListener('refresh', () => { measure(); buildFlow(); });
  new ResizeObserver(() => ScrollTrigger.refresh()).observe(document.body);
  ScrollTrigger.refresh();
  measure();
}

/* =========================================================
   INTRO (loader → hero)
   ========================================================= */
function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to(store.intro, { v: 1, duration: 2.6, ease: 'expo.out' }, 0);
  if (store.reduced) { store.intro.v = 1; return; }
  tl.fromTo('.hero .char', { yPercent: 118, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.045 }, 0.05)
    .fromTo('.hero__dot', { scale: 0 }, { scale: 1, duration: 0.9, ease: 'back.out(3)' }, 0.85)
    .fromTo('[data-in]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.7)
    .fromTo('.hero__rule', { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.inOut' }, 0.4)
    .fromTo('.top', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.2 }, 0.6)
    .to('.pill, .toggle', { opacity: 1, duration: 1.2 }, 0.8)
    .add(() => bell.ring(1), 1.9); // o sino toca quando o site termina de entrar

  // variable-font hover on hero letters
  if (!store.fine) return;
  const chars = [...document.querySelectorAll('.hero .char')];
  let centers = [], px = -9999, py = -9999;
  const vals = chars.map(() => 0);
  const calc = () => { centers = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 + scrollY]; }); };
  setTimeout(calc, 1800); addEventListener('resize', calc);
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY + scrollY; }, { passive: true });
  gsap.ticker.add(() => {
    if (!centers.length || scrollY > innerHeight) return;
    const rad = Math.max(220, innerWidth * 0.2);
    chars.forEach((c, i) => {
      const d = Math.hypot(centers[i][0] - px, centers[i][1] - py), w = Math.max(0, 1 - d / rad) ** 2;
      vals[i] += (w - vals[i]) * 0.14;
      if (Math.abs(w - vals[i]) > 0.002 || vals[i] > 0.002)
        c.style.fontVariationSettings = `'wdth' ${(106 + 19 * vals[i]).toFixed(1)}, 'wght' ${(800 + 100 * vals[i]).toFixed(0)}`;
    });
  });
}

function runLoader() {
  const el = document.getElementById('loader');
  const finish = () => {
    setupScroll();
    if (lenis) lenis.start();
  };
  if (store.reduced) { el.remove(); finish(); heroIntro(); return; }
  // entrada: palavras sobem de dentro da máscara
  gsap.fromTo(el.querySelectorAll('.loader__w'), { yPercent: 110, rotate: 4 },
    { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
  gsap.fromTo(el.querySelector('.loader__dot'), { scale: 0 }, { scale: 1, duration: 0.7, ease: 'back.out(3)', delay: 0.7 });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  Promise.all([Promise.race([Promise.all([document.fonts.ready, sceneReady]), wait(4500)]), wait(1500)]).then(() => {
    gsap.timeline()
      .to(el.querySelectorAll('.loader__w, .loader__dot'), { yPercent: -110, duration: 0.6, ease: 'power3.in', stagger: 0.06 })
      .add(() => { finish(); heroIntro(); }, '-=0.1')
      // saída: cinco faixas rosa sobem em cascata, revelando o site
      .to(el.querySelectorAll('.loader__stripes i'), { yPercent: -100, duration: 1, ease: 'expo.inOut', stagger: 0.07 }, '-=0.1')
      .set(el, { pointerEvents: 'none' }, '-=0.6')
      .add(() => el.remove());
  });
}

gsap.set('.hero .char, [data-in], .hero__dot', { willChange: 'transform' });
if (!store.reduced) {
  gsap.set('.hero .char', { yPercent: 118 });
  gsap.set('[data-in], .top, .pill, .toggle', { opacity: 0 });
}
measure();
runLoader();
})();
