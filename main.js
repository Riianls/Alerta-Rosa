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
  target: null,
  activeLayer: -1,
  intro: { v: 0 },
  presenceNow: 1,
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

/* =========================================================
   GEOMETRY — superelliptic machined rings
   ========================================================= */
const SE = (a, n) => Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), -1 / n);

function ringGeometry({ r = 1, n = 4, hole = 0.55, h = 0.3, bevel = 0.05, segU = 180, corner = 6 }) {
  const R = r, Z = r * hole, f = h / 2;
  const hb = Math.min(bevel, f * 0.92, ((R - Z) / 2) * 0.92);
  const pts = [];
  const arc = (cx, cy, a0, a1) => { for (let p = 0; p <= corner; p++) { const t = a0 + ((a1 - a0) * p) / corner; pts.push([cx + Math.cos(t) * hb, cy + Math.sin(t) * hb]); } };
  const line = (x, y0, y1, d = 3) => { for (let p = 1; p < d; p++) pts.push([x, y0 + ((y1 - y0) * p) / d]); };
  arc(R - hb, f - hb, Math.PI / 2, 0); line(R, f - hb, -f + hb);
  arc(R - hb, -f + hb, 0, -Math.PI / 2); arc(Z + hb, -f + hb, -Math.PI / 2, -Math.PI);
  line(Z, -f + hb, f - hb); arc(Z + hb, f - hb, Math.PI, Math.PI / 2);

  const e = pts.length;
  const len = [0];
  for (let s = 1; s < e; s++) len.push(len[s - 1] + Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]));
  const tan = pts.map((_, i) => {
    const a = pts[(i + e - 1) % e], b = pts[(i + 1) % e];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  });
  const pos = new Float32Array(segU * e * 3), aS = new Float32Array(segU * e), aT = new Float32Array(segU * e * 3);
  for (let s = 0; s < segU; s++) {
    const u = (s / segU) * Math.PI * 2, m = SE(u, n), cx = Math.cos(u) * m, cz = Math.sin(u) * m;
    for (let k = 0; k < e; k++) {
      const g = s * e + k;
      pos.set([cx * pts[k][0], pts[k][1], cz * pts[k][0]], g * 3);
      aS[g] = len[k];
      aT.set([Math.cos(u) * tan[k][0], tan[k][1], Math.sin(u) * tan[k][0]], g * 3);
    }
  }
  const idx = [];
  for (let s = 0; s < segU; s++) {
    const s1 = (s + 1) % segU;
    for (let k = 0; k < e; k++) {
      const k1 = (k + 1) % e, a = s * e + k, b = s1 * e + k, c = s * e + k1, d = s1 * e + k1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  geo.setAttribute('aTan', new THREE.BufferAttribute(aT, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function outlineGeometry({ r = 1, n = 4, h = 0.3, seg = 120 }) {
  const v = [];
  for (const y of [h / 2, -h / 2]) for (let s = 0; s < seg; s++) {
    const a = (s / seg) * Math.PI * 2, b = ((s + 1) / seg) * Math.PI * 2;
    v.push(Math.cos(a) * SE(a, n) * r, y, Math.sin(a) * SE(a, n) * r);
    v.push(Math.cos(b) * SE(b, n) * r, y, Math.sin(b) * SE(b, n) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/* machined grooves via normal perturbation */
function machinedMaterial({ freq = 150, amp = 0.5, top = 0.25, ...opts }) {
  const m = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.2, envMapIntensity: 1.25, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFreq = { value: freq }; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uTop = { value: top };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aS; attribute vec3 aTan; varying float vS; varying vec3 vTanV; varying float vSide;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vS = aS; vTanV = normalMatrix * aTan; vSide = abs(aTan.y);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uFreq; uniform float uAmp; uniform float uTop; varying float vS; varying vec3 vTanV; varying float vSide;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float ph = vS * uFreq;
  float fade = 1.0 - smoothstep(0.7, 2.4, fwidth(ph));
  float g = cos(ph) * uAmp * fade * mix(uTop, 1.0, smoothstep(0.3, 0.9, vSide));
  normal = normalize(normal + normalize(vTanV) * g);
}`);
  };
  m.customProgramCacheKey = () => 'machined';
  return m;
}

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* liquid core */
function liquidMaterial(opts) {
  const u = { uTime: { value: 0 }, uAmp: { value: 0.12 } };
  const m = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.12, envMapIntensity: 1.5, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime; sh.uniforms.uAmp = u.uAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uAmp;
${NOISE}
vec3 liquid(vec3 p){
  vec3 d = normalize(p);
  float n = snoise(d * 1.25 + uTime * 0.32) + 0.45 * snoise(d * 2.7 - uTime * 0.45);
  return p + d * n * uAmp;
}`)
      .replace('#include <beginnormal_vertex>', `vec3 lt = normalize(cross(normal, vec3(0.0, 1.0, 0.0) + normal.zxy * 0.31));
vec3 lb = normalize(cross(normal, lt));
vec3 lp0 = liquid(position);
vec3 lp1 = liquid(position + lt * 0.03);
vec3 lp2 = liquid(position + lb * 0.03);
vec3 objectNormal = normalize(cross(lp1 - lp0, lp2 - lp0));
if (dot(objectNormal, normal) < 0.0) objectNormal = -objectNormal;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = lp0;');
  };
  m.customProgramCacheKey = () => 'liquid';
  m.userData.uniforms = u;
  return m;
}

/* =========================================================
   LAYERS — paleta rosa & branco
   ========================================================= */
const LAYERS = [
  { r: 1.05, n: 4,   hole: 0.58, h: 0.36, bevel: 0.06,  mat: { color: '#9c1f4f', roughness: 0.32, freq: 120, amp: 0.55 } },
  { r: 0.95, n: 3,   hole: 0.5,  h: 0.2,  bevel: 0.05,  mat: { color: '#ff6f9c', roughness: 0.24, freq: 190, amp: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 } },
  { r: 1.13, n: 5,   hole: 0.66, h: 0.13, bevel: 0.045, mat: { color: '#fff4f7', roughness: 0.07, freq: 220, amp: 0.22, top: 0.5 } },
  { r: 0.84, n: 4,   hole: 0.52, h: 0.3,  bevel: 0.06,  mat: { color: '#d81b60', roughness: 0.16, metalness: 0.85, freq: 90, amp: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 } },
  { r: 0.66, n: 2.4, hole: 0.56, h: 0.22, bevel: 0.07,  mat: { color: '#ffe1ea', roughness: 0.18, freq: 260, amp: 0.35, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [120, 620] } },
];
const GAP = 0.055;
const TOTAL = LAYERS.reduce((a, l) => a + l.h, 0) + GAP * (LAYERS.length - 1);
const BASE_Y = (() => { let y = -TOTAL / 2; return LAYERS.map((l) => { const c = y + l.h / 2; y += l.h + GAP; return c; }); })();
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
// deslocamento de cada camada quando o logo "explode" (borda desce, silhueta sai pra frente, raios sobem)
const LOGO_DIR = [[0, -0.7, 0], [0, 0, 0], [0, 0, 0.75], [0, 0.35, 0], [0, 0.55, 0]];
const CORE_DIR = [0, -1.0, 0];
const LOGO_MAX_TURN = 0.45; // rotação máxima (rad) que as poses de rolagem aplicam ao logo
const LOGO_SWAY = 0.35;    // amplitude do balanço contínuo (rad)
const LOGO_MAX_X = 0.66;   // posição horizontal máxima do logo (1 = borda direita)
const LOGO_TILT = 0.45;   // fração da inclinação (rx) das poses aplicada ao logo
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* =========================================================
   POSES per section (scroll-driven)
   ========================================================= */
const DEF = { x: 0, y: 0, s: 1, rx: 0.4, ry: 0, rz: 0, explode: 0, twist: 0.4, assemble: 1.2, ghost: 0, presence: 1, spin: 1 };
const POSES = {
  home: (i, m) => m ? { x: 0.1, y: 0.42, s: 0.56, rx: 0.5, ry: -0.6, rz: 0.16, explode: 0.1, twist: 0.6 }
                    : { x: 0.62, y: 0.06, s: 0.8, rx: 0.46, ry: -0.6, rz: 0.16, explode: 0.1, twist: 0.6 },
  about: (i, m) => m ? { x: 0.9, y: 0.45, s: 0.5, rx: 1, ry: 1 + i, explode: 0.2 }
                     : { x: 1.0, y: 0.05 - i * 0.1, s: 1, rx: 1.05, ry: 0.4 + i * 1.4, rz: -0.25, explode: 0.3, twist: 0.25, spin: 0.4 },
  expertise: (i, m) => m ? { x: 0.75, y: 0.4, s: 0.42, rx: 0.3, ry: -0.5 + i * 1.2, explode: 1, twist: 0.12, ghost: 0.7, spin: 0.25 }
                         : { x: 0.56, y: -0.02, s: 0.78, rx: 0.3, ry: -0.6 + i * 1.1, explode: 0.9, twist: 0.12, ghost: 0.75, spin: 0.25 },
  work: () => ({ x: 1.3, y: 0.9, s: 0.4, rx: 1.2, ry: 2, presence: 0 }),
  approach: (i, m) => ({ x: m ? 0.55 : 0.6, y: m ? 0.45 : 0, s: m ? 0.44 : 0.84, rx: 0.36, ry: -0.8 + i * 2.4,
    explode: 0.75 - 0.7 * smooth(clamp(i * 1.25 - 0.25)), twist: 0.05 + 0.6 * smooth(clamp(i * 1.4 - 0.4)),
    assemble: i * 1.3, ghost: 1 - 0.85 * smooth(clamp(i * 1.5 - 0.5)), spin: 0.2 }),
  rotas: () => ({ x: 1.3, y: -0.9, s: 0.4, rx: 1.2, ry: -2, presence: 0 }),
  contact: (i, m) => m ? { x: 0.5, y: 0.5, s: 0.42, rx: 0.6, ry: 0.8, rz: 0.12, explode: 0.06, twist: 0.9 }
                       : { x: 0.62, y: -0.1, s: 0.8, rx: 0.52, ry: 0.9, rz: 0.12, explode: 0.06, twist: 0.9 },
};
let segs = [], vh = innerHeight, mobile = false;
function measure() {
  vh = innerHeight; mobile = innerWidth / innerHeight < 0.85;
  segs = [...document.querySelectorAll('[data-pose]')].map((el) => {
    const r = el.getBoundingClientRect(), top = r.top + scrollY;
    let a = top - vh * 0.3, b = top + r.height - vh * 0.8;
    if (b < a) a = b = (a + b) / 2;
    return { id: el.dataset.pose, top, h: r.height, a, b };
  });
}
const poseOf = (sg, y) => {
  const p = { ...DEF, ...POSES[sg.id](clamp((y - sg.top) / Math.max(1, sg.h - vh)), mobile) };
  if (store.isLogo) p.x = Math.min(p.x, LOGO_MAX_X); // logo nunca fica cortado na borda
  return p;
};
function poseAt(y) {
  if (!segs.length) return DEF;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k], n = segs[k + 1];
    if (y <= s.b || !n) return poseOf(s, y);
    if (y < n.a) {
      const t = smooth((y - s.b) / (n.a - s.b)), A = poseOf(s, y), B = poseOf(n, y), o = {};
      for (const key in A) o[key] = A[key] + (B[key] - A[key]) * t;
      return o;
    }
  }
  return DEF;
}

/* =========================================================
   THREE SCENE
   ========================================================= */
const host = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }

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

  const dl = new THREE.DirectionalLight('#ffffff', 1.4); dl.position.set(4, 6, 5); scene.add(dl);
  const pl = new THREE.PointLight('#ff3d7f', 2.5, 3); scene.add(pl);

  const group = new THREE.Group(); scene.add(group);
  const newLineMat = () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  /* fallback: anéis originais */
  function buildRings() {
    const segU = low ? 110 : 200;
    return LAYERS.map((L, n) => {
      const g = new THREE.Group();
      const mat = machinedMaterial({ emissive: '#ff2f72', emissiveIntensity: 0, ...L.mat });
      const mesh = new THREE.Mesh(ringGeometry({ ...L, segU, corner: low ? 4 : 7 }), mat);
      const lineMat = newLineMat();
      const lines = new THREE.LineSegments(outlineGeometry({ ...L, seg: low ? 72 : 128 }), lineMat);
      g.add(mesh, lines); group.add(g);
      return { g, mesh, mats: [mat], lineMat, base: new THREE.Vector3(0, BASE_Y[n], 0), dir: new THREE.Vector3(0, (n - 2) * 0.46, 0) };
    });
  }

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

    // badalo vira o núcleo líquido
    let clapper = null;
    const bad = parts.find((p) => p.name.startsWith('Badalo'));
    if (bad) {
      const bb = bad.geo.boundingBox;
      clapper = { pos: bb.getCenter(new THREE.Vector3()), r: (bb.max.x - bb.min.x) / 2 };
    }

    const layers = LOGO_DIR.map((dir, n) => {
      const mine = parts.filter((p) => p.name.startsWith(`L${n}_`));
      const lb = new THREE.Box3(); mine.forEach((p) => lb.union(p.geo.boundingBox));
      const cy = mine.length ? (lb.min.y + lb.max.y) / 2 : 0;
      const g = new THREE.Group(), inner = new THREE.Group(), lineMat = newLineMat(), mats = [];
      mine.forEach((p) => {
        p.geo.translate(0, -cy, 0); // pivô no eixo do sino, na altura da peça
        const key = Object.keys(LOGO_MATS).find((m) => p.name.startsWith(m));
        const mat = new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.3, emissive: '#ff2f72', emissiveIntensity: 0, ...(LOGO_MATS[key] || LOGO_MATS.L1_Corpo) });
        mats.push(mat);
        inner.add(new THREE.Mesh(p.geo, mat));
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(p.geo, 20), lineMat));
      });
      g.add(inner); group.add(g);
      return { g, mesh: inner, mats, lineMat, base: new THREE.Vector3(0, cy, 0), dir: new THREE.Vector3(...dir) };
    });
    return { layers, clapper };
  }

  let layers = null, clapper = null, isLogo = false;
  if (GLTFLoader) {
    try { ({ layers, clapper } = await buildLogo()); isLogo = store.isLogo = true; }
    catch (e) { console.warn('Não foi possível carregar logo.glb — usando os anéis. (Abra o site por um servidor local, não via file://)', e); }
  }
  if (!layers) layers = buildRings();

  const coreMat = liquidMaterial({ color: '#ff4f8b', roughness: 0.1, iridescence: 0.7, iridescenceIOR: 1.5, clearcoat: 1, emissive: '#6a0030', emissiveIntensity: 0.55 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, low ? 14 : 30), coreMat);
  const coreK = clapper ? clapper.r / 0.33 : 1;
  group.add(core);
  const axisMat = new THREE.LineDashedMaterial({ transparent: true, opacity: 0, dashSize: 0.05, gapSize: 0.05, depthWrite: false });
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.9, 0), new THREE.Vector3(0, 1.9, 0)]), axisMat);
  axis.computeLineDistances(); group.add(axis);

  const cBase = new THREE.Color(), cHot = new THREE.Color();
  const setLineColors = (t) => { cBase.set(t === 'branco' ? '#2b0d19' : '#ffffff'); cHot.set(t === 'branco' ? '#e3336d' : '#b3124a'); };
  setLineColors(theme);
  window.addEventListener('themechange', (e) => { buildEnv(e.detail); setLineColors(e.detail); });

  const cur = { ...DEF, presence: 1 };
  const st = { px: 0, py: 0, lag: LAYERS.map(() => 0), act: LAYERS.map(() => 0), t: 0, energy: 0 };
  const VH = 2 * 9 * Math.tan(THREE.MathUtils.degToRad(15));
  let last = performance.now();

  function tick() {
    const now = performance.now();
    const M = Math.min((now - last) / 1000, 0.05); last = now;
    store.target = poseAt(scrollY);
    const T = store.target, E = store.reduced ? 1 : 1 - Math.exp(-M * 4.5);
    for (const k in cur) cur[k] += (T[k] - cur[k]) * E;
    if (!store.reduced) st.t += M;
    store.presenceNow = cur.presence;
    if (cur.presence < 0.002 && T.presence < 0.002) return;

    const vw = VH * camera.aspect;
    const D = Math.min(VH, vw * 1.2) * 0.3, I = store.intro.v, s = 1 - Math.exp(-M * 3);
    st.px += (store.pointer.x - st.px) * s;
    st.py += (store.pointer.y - st.py) * s;
    st.energy += (Math.min(store.pointer.speed, 1) - st.energy) * (1 - Math.exp(-M * 2));
    store.pointer.speed *= Math.exp(-M * 6);

    group.position.set((cur.x * vw) / 2, (cur.y * VH) / 2 + (1 - I) * -0.6, 0);
    group.scale.setScalar(Math.max(1e-4, D * cur.s * cur.presence * (0.6 + 0.4 * I)));
    // anéis: giro contínuo. logo: balança em torno da frente, sem nunca ficar de costas
    const ry = isLogo
      ? Math.sin(cur.ry) * LOGO_MAX_TURN + Math.sin(st.t * 0.4) * LOGO_SWAY * cur.spin
        - Math.atan2(group.position.x, camera.position.z) // compensa a perspectiva: frente sempre virada pra câmera
      : cur.ry + st.t * 0.11 * cur.spin;
    const rx = isLogo ? cur.rx * LOGO_TILT : cur.rx;
    group.rotation.set(rx - st.py * 0.22, ry + st.px * 0.45 + (1 - I) * 2.4, cur.rz + st.px * 0.05);

    const act = store.activeLayer;
    // no logo o "twist" só aparece quando as peças estão separadas, para a marca ficar alinhada em repouso
    const tw = isLogo ? cur.twist * smooth(clamp(cur.explode * 1.6)) : cur.twist;
    layers.forEach((L, n) => {
      st.lag[n] += (store.pointer.x - st.lag[n]) * (1 - Math.exp(-M * (1.2 + n * 0.9)));
      st.act[n] += ((act === n ? 1 : 0) - st.act[n]) * (1 - Math.exp(-M * 6));
      const q = smooth(clamp(cur.assemble * LAYERS.length - n - 0.6));
      const wob = Math.sin(st.t * 0.9 + n * 1.7) * 0.012 * (1 + cur.explode * 3);
      L.g.position.set(
        L.base.x + L.dir.x * cur.explode + st.act[n] * 0.16,
        L.base.y + L.dir.y * cur.explode + wob,
        L.base.z + L.dir.z * cur.explode + st.act[n] * 0.16);
      L.g.rotation.y = n * tw * 0.42 + (st.lag[n] - st.px) * 1.5 + Math.sin(st.t * 0.35 + n) * 0.05;
      L.g.rotation.z = Math.sin(st.t * 0.5 + n * 2.1) * 0.012 * cur.explode;
      L.mesh.position.y = (1 - q) * 1.5;
      L.mesh.rotation.y = (1 - q) * 1.2;
      L.mesh.scale.setScalar(Math.max(1e-4, q) * (1 + st.act[n] * 0.05));
      L.mats.forEach((m) => { m.emissiveIntensity = st.act[n] * 0.35; });
      const dimF = act >= 0 ? 0.35 + 0.65 * st.act[n] : 1;
      L.lineMat.opacity = cur.ghost * (0.28 + 0.72 * Math.max(st.act[n], 1 - q)) * dimF;
      L.lineMat.color.copy(cBase).lerp(cHot, Math.max(st.act[n], (1 - q) * 0.8));
    });
    const u = coreMat.userData.uniforms;
    u.uTime.value = st.t + st.energy * 0.6;
    u.uAmp.value = 0.07 + cur.explode * 0.05 + st.energy * 0.1;
    core.scale.setScalar(coreK * (1 + cur.explode * 0.35));
    if (clapper) {
      core.position.set(clapper.pos.x + CORE_DIR[0] * cur.explode, clapper.pos.y + CORE_DIR[1] * cur.explode + Math.sin(st.t * 0.7) * 0.02, clapper.pos.z + CORE_DIR[2] * cur.explode);
    } else core.position.y = Math.sin(st.t * 0.7) * 0.02;
    core.rotation.y = -st.t * 0.2;
    axisMat.opacity = cur.ghost * 0.5;
    axisMat.color.copy(cBase);

    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  renderer.compile(scene, camera);
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
   CLOCK + THEME TOGGLE
   ========================================================= */
const clock = document.getElementById('clock');
const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const setClock = () => { clock.textContent = fmt.format(new Date()); };
setClock(); setInterval(setClock, 15000);

document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'branco' ? 'rosa' : 'branco';
  root.dataset.theme = theme;
  try { localStorage.setItem('ar-theme', theme); } catch (e) {}
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
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

  // horizontal projects
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
      gsap.fromTo(img, { rotate: 3, y: 40 }, { rotate: -2, y: -20, ease: 'none',
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
    const V_FOCUS_Y = 0.02; // enquadramento vertical: 0 = topo do vídeo, 0.5 = centro, 1 = base
    for (let i = 1; i <= N; i++) { const im = new Image(); im.src = `frames/f${String(i).padStart(3, '0')}.jpg`; frames.push(im); }
    let vTarget = 0, vNow = 0, drawn = -1;
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; drawn = -1;
    };
    const draw = (i) => {
      // usa o quadro mais próximo já carregado
      let im = frames[i];
      for (let k = 0; (!im.complete || !im.naturalWidth) && k < N; k++) im = frames[Math.max(0, i - k)];
      if (!im.complete || !im.naturalWidth) return;
      const s = Math.max(cv.width / im.naturalWidth, cv.height / im.naturalHeight);
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.drawImage(im, (cv.width - w) / 2, (cv.height - h) * V_FOCUS_Y, w, h);
      drawn = i;
    };
    size(); addEventListener('resize', size);
    frames[0].onload = () => { drawn = -1; };
    ScrollTrigger.create({
      trigger: '.vscroll__band', start: 'top bottom', end: 'top 15%', invalidateOnRefresh: true,
      onUpdate: (self) => { vTarget = self.progress; },
    });
    gsap.ticker.add(() => {
      vNow += (vTarget - vNow) * (R ? 1 : 0.2);
      const i = Math.round(vNow * (N - 1));
      if (i !== drawn) draw(i);
    });
  }

  // borda rosa ondulada da faixa de vídeo (reage à rolagem)
  const band = document.querySelector('.vscroll__band');
  if (band) {
    const svgs = [...band.querySelectorAll('.vscroll__wave')];
    const H = 56, MID = 18, PTS = 120;
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

  ScrollTrigger.addEventListener('refresh', measure);
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
    .to('.pill, .toggle', { opacity: 1, duration: 1.2 }, 0.8);

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
