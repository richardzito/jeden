/* ==========================================================================
   Zajawka „Zamień dach w ogród” — dach zielony w 3D sterowany przewijaniem:
   rozgrzana papa → warstwy dachu zielonego → roślinność (ekstensywny,
   taras, intensywny) → deszcz i korzyści.
   Zwykły skrypt + dynamiczny import (import map w <head>), żeby strona
   działała też otwarta prosto z dysku (file://).
   ========================================================================== */
(() => {
const stage = document.getElementById('wow-stage');
const canvas = document.getElementById('wow-canvas');
const track = document.getElementById('wow-track');
let THREE;
let RoomEnvironment;

if (stage && canvas && track) load();

async function load() {
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch {
    // brak sieci / CDN — kroki i nakładki działają dalej, zamiast 3D zdjęcie
  }
  init();
}

function init() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- UI ----------
  const stepEls = [...document.querySelectorAll('.wow__step')];
  const hudEls = [...stage.querySelectorAll('[data-hud]')];
  const rail = document.getElementById('wow-rail');
  const typeSwitch = document.getElementById('type-switch');
  const typeBtns = [...typeSwitch.querySelectorAll('button')];
  const tagEls = [...stage.querySelectorAll('.layer-tag')];
  const hudArea = document.getElementById('hud-area');
  const hudLayers = document.getElementById('hud-layers');
  const hudType = document.getElementById('hud-type');
  const hudPrice = document.getElementById('hud-price');
  const hudWater = document.getElementById('hud-water');
  const hudTemp = document.getElementById('hud-temp');

  // ---------- Model (metry; grubości warstw powiększone dla czytelności) ----------
  const B = { L: 30, W: 20, H: 12, slab: 0.3, parapet: 1.4, wall: 0.3 };
  B.Li = B.L - 2 * B.wall;
  B.Wi = B.W - 2 * B.wall;
  B.top = B.H + B.slab;
  const PAPA = 0.08;
  const T = { membrane: 0.12, drain: 0.26, geo: 0.08 };
  const SUB = [0.45, 0.45, 0.85]; // substrat: ekstensywny, taras, intensywny
  const area = Math.round((B.Li * B.Wi) / 10) * 10;
  hudArea.textContent = area;

  // Dane poglądowe: retencja (udział opadu ~550 mm/rok), temperatura dachu latem, cena zł/m²
  const TYPES = [
    { label: 'Rozchodniki · 8–12 cm substratu', ret: 0.5, temp: 35, lo: 250, hi: 380 },
    { label: 'Taras z deską i donicami', ret: 0.3, temp: 40, lo: 550, hi: 900 },
    { label: 'Trawy, krzewy, drzewka · 30+ cm', ret: 0.75, temp: 28, lo: 450, hi: 750 },
  ];
  const DECK_EDGE = 1.5; // taras: deska po lewej, rozchodniki po prawej

  const state = { progress: 0, step: -1, manualType: null, visible: false, inView: false };
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const scrollType = (p) => (p < 0.6 ? 0 : p < 0.68 ? 1 : 2);
  const currentType = () => state.manualType ?? scrollType(state.progress);

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // Liczniki kroku 4
  const shown = { lo: 0, hi: 0, water: 0, temp: 70 };
  let metricsAnim = 0;
  const animateMetrics = () => {
    const t = TYPES[currentType()];
    const goal = {
      lo: Math.round((area * t.lo) / 1000) * 1000,
      hi: Math.round((area * t.hi) / 1000) * 1000,
      water: Math.round(area * 0.55 * t.ret),
      temp: t.temp,
    };
    if (Object.keys(goal).every((k) => goal[k] === shown[k])) return;
    const from = { ...shown };
    const t0 = performance.now();
    const dur = reduceMotion ? 1 : 900;
    cancelAnimationFrame(metricsAnim);
    const tick = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      for (const key of Object.keys(goal)) shown[key] = from[key] + (goal[key] - from[key]) * e;
      hudPrice.textContent = `${fmt(Math.round(shown.lo / 1000) * 1000)} – ${fmt(Math.round(shown.hi / 1000) * 1000)} zł`;
      hudWater.textContent = fmt(shown.water);
      hudTemp.textContent = Math.round(shown.temp);
      if (k < 1) metricsAnim = requestAnimationFrame(tick);
      else Object.assign(shown, goal);
    };
    metricsAnim = requestAnimationFrame(tick);
  };

  const layerDrop = (p, i) => smoothstep(0.27 + i * 0.04, 0.31 + i * 0.04, p);

  let lastType = -1;
  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    if (step < 2) state.manualType = null;
    if (rail) rail.style.transform = `scaleY(${p})`;
    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', Number(el.dataset.hud) === step));
    }
    hudLayers.textContent = [0, 1, 2, 3].filter((i) => layerDrop(p, i) > 0.95).length;
    const type = currentType();
    if (type !== lastType) {
      lastType = type;
      typeSwitch.style.setProperty('--i', type);
      typeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === type)));
      hudType.textContent = TYPES[type].label;
    }
    if (step === 3) animateMetrics();
  };

  let scrollQueued = false;
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      state.progress = readProgress();
      syncUI();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  typeBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.manualType = Number(b.dataset.type);
      syncUI();
    })
  );

  // ---------- WebGL ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    stage.classList.add('no-webgl');
    return;
  }
  if (!renderer.getContext()) {
    stage.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 600);
  const target = new THREE.Vector3(0, 9, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#c9cfc2', 0.6));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.5);
  sun.position.set(-30, 50, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeTex = (draw, size = 512) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const grain = (g, s, rgb, spread, count) => {
    g.fillStyle = `rgb(${rgb.join(',')})`;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < count; i++) {
      const d = (Math.random() - 0.5) * spread;
      g.fillStyle = `rgb(${rgb.map((v) => Math.max(0, Math.min(255, v + d))).join(',')})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.8, 1 + Math.random() * 1.8);
    }
  };
  const papaTex = makeTex((g, s) => {
    grain(g, s, [200, 200, 200], 70, 22000);
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, y, s, 12);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, y + 12, s, 2);
    }
  });
  papaTex.repeat.set(B.Li / 4, B.Wi / 4);
  const drainTex = makeTex((g, s) => {
    g.fillStyle = 'rgb(40,40,42)';
    g.fillRect(0, 0, s, s);
    for (let y = 16; y < s; y += 32) {
      for (let x = 16 + ((y / 32) % 2) * 16; x < s; x += 32) {
        const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
        gr.addColorStop(0, 'rgb(110,110,112)');
        gr.addColorStop(1, 'rgb(32,32,34)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, 10, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, 256);
  drainTex.repeat.set(B.Li / 1.5, B.Wi / 1.5);
  const geoTex = makeTex((g, s) => {
    grain(g, s, [236, 236, 232], 26, 9000);
    g.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 400; i++) {
      g.beginPath();
      const x = Math.random() * s, y = Math.random() * s;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.random() * 30 - 15, y + Math.random() * 30 - 15, x + Math.random() * 40 - 20, y + Math.random() * 40 - 20);
      g.stroke();
    }
  }, 256);
  geoTex.repeat.set(B.Li / 4, B.Wi / 4);
  const soilTex = makeTex((g, s) => {
    grain(g, s, [112, 80, 56], 60, 26000);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${170 + Math.random() * 60},${150 + Math.random() * 50},${120 + Math.random() * 40},0.8)`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  soilTex.repeat.set(B.Li / 3, B.Wi / 3);
  const woodTex = makeTex((g, s) => {
    const plank = s / 8;
    for (let i = 0; i < 8; i++) {
      const v = 150 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v * 0.68},${v * 0.45})`;
      g.fillRect(0, i * plank, s, plank);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(80,45,20,${0.05 + Math.random() * 0.08})`;
        g.fillRect(0, i * plank + Math.random() * plank, s, 1);
      }
      g.fillStyle = 'rgba(40,20,10,0.5)';
      g.fillRect(0, i * plank + plank - 2, s, 2);
    }
  });
  woodTex.repeat.set(4, 6);

  // ---------- Materiały ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f1ede7', roughness: 0.92 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#8f8a84', roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33404b', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const copingMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#c3beb6', roughness: 0.95 });
  const papaMat = new THREE.MeshStandardMaterial({ color: '#4d5053', roughness: 0.9, map: papaTex, bumpMap: papaTex, bumpScale: 2, emissive: '#ff6a1a', emissiveIntensity: 0 });
  const membraneMat = new THREE.MeshStandardMaterial({ color: '#2f3d36', roughness: 0.45, metalness: 0.1 });
  const drainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, map: drainTex, bumpMap: drainTex, bumpScale: 3 });
  const geoMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, map: geoTex });
  const soilMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: soilTex, bumpMap: soilTex, bumpScale: 2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, map: woodTex });
  const greyMat = new THREE.MeshStandardMaterial({ color: '#b8b4ac', roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.6 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#d20028', roughness: 0.6, side: THREE.DoubleSide });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.7 });

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Budynek mieszkalny ----------
  const building = new THREE.Group();
  scene.add(building);
  const body = box(B.L, B.H - 0.6, B.W, wallMat);
  body.position.y = 0.6 + (B.H - 0.6) / 2;
  const base = box(B.L + 0.12, 0.6, B.W + 0.12, baseMat);
  base.position.y = 0.3;
  building.add(body, base);

  // Okna: jedna geometria na wszystkie (InstancedMesh)
  const winSpots = [];
  const floors = [1.4, 4.2, 7.0, 9.8];
  const addRow = (side, count, len) => {
    for (const y of floors) {
      for (let i = 0; i < count; i++) {
        const a = -len / 2 + (len / count) * (i + 0.5);
        winSpots.push({ side, a, y });
      }
    }
  };
  addRow('front', 9, B.L - 2);
  addRow('back', 9, B.L - 2);
  addRow('right', 6, B.W - 2);
  addRow('left', 6, B.W - 2);
  const winGeo = new THREE.BoxGeometry(1.5, 1.6, 0.12);
  const frames = new THREE.InstancedMesh(winGeo, frameMat, winSpots.length);
  const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.36, 1.46), glassMat, winSpots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  winSpots.forEach((w, i) => {
    let x = 0, z = 0, rot = 0;
    if (w.side === 'front') { x = w.a; z = B.W / 2 + 0.02; rot = 0; }
    if (w.side === 'back') { x = w.a; z = -B.W / 2 - 0.02; rot = Math.PI; }
    if (w.side === 'right') { x = B.L / 2 + 0.02; z = w.a; rot = Math.PI / 2; }
    if (w.side === 'left') { x = -B.L / 2 - 0.02; z = w.a; rot = -Math.PI / 2; }
    q.setFromAxisAngle(up, rot);
    frames.setMatrixAt(i, m4.compose(v3.set(x, w.y + 0.8, z), q, one));
    const off = new THREE.Vector3(0, 0, 0.065).applyQuaternion(q);
    panes.setMatrixAt(i, m4.compose(v3.set(x + off.x, w.y + 0.8, z + off.z), q, one));
  });
  frames.castShadow = true;
  building.add(frames, panes);

  // Balkony na froncie
  for (const y of floors.slice(1)) {
    for (const a of [-10, -3.3, 3.3, 10]) {
      const slabB = box(3.2, 0.18, 1.3, whiteMat);
      slabB.position.set(a, y - 0.1, B.W / 2 + 0.65);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.04), new THREE.MeshStandardMaterial({ color: '#9fb3bf', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45 }));
      rail.position.set(a, y + 0.5, B.W / 2 + 1.28);
      building.add(slabB, rail);
    }
  }

  // Strop, attyka, papa
  const slab = box(B.L, B.slab, B.W, slabMat);
  slab.position.y = B.H + B.slab / 2;
  building.add(slab);
  for (const [w, d, x, z] of [
    [B.L, B.wall, 0, B.W / 2 - B.wall / 2],
    [B.L, B.wall, 0, -B.W / 2 + B.wall / 2],
    [B.wall, B.Wi, B.L / 2 - B.wall / 2, 0],
    [B.wall, B.Wi, -B.L / 2 + B.wall / 2, 0],
  ]) {
    const m = box(w, B.parapet, d, wallMat);
    m.position.set(x, B.top + B.parapet / 2, z);
    const c = box(w + 0.1, 0.06, d + 0.1, copingMat);
    c.position.set(x, B.top + B.parapet + 0.03, z);
    building.add(m, c);
  }
  const papa = box(B.Li, PAPA, B.Wi, papaMat);
  papa.position.y = B.top + PAPA / 2;
  building.add(papa);
  // Wyjście na dach
  const hatch = box(2.2, 1.6, 2.2, wallMat);
  hatch.position.set(-B.Li / 2 + 2.4, B.top + 0.8, -B.Wi / 2 + 2.4);
  building.add(hatch);

  // Warstwy dachu zielonego
  const mkLayer = (mat, t) => {
    const g = new THREE.Group();
    const m = box(B.Li, 1, B.Wi, mat);
    m.scale.y = t;
    g.add(m);
    g.userData.mesh = m;
    g.visible = false;
    building.add(g);
    return g;
  };
  const layers = [mkLayer(membraneMat, T.membrane), mkLayer(drainMat, T.drain), mkLayer(geoMat, T.geo), mkLayer(soilMat, SUB[0])];

  // ---------- Roślinność ----------
  // Pozycje w obrysie dachu, z marginesem przy attyce i wyjściu na dach
  const inRoof = (x, z, m = 0.5) => Math.abs(x) < B.Li / 2 - m && Math.abs(z) < B.Wi / 2 - m;
  const nearHatch = (x, z) => Math.abs(x - (-B.Li / 2 + 2.4)) < 1.8 && Math.abs(z - (-B.Wi / 2 + 2.4)) < 1.8;
  const corner = new THREE.Vector2(-B.Li / 2, B.Wi / 2);
  const maxD = Math.hypot(B.Li, B.Wi);
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // Rozchodniki (ekstensywny + część tarasu)
  const sedumPts = [];
  for (let x = -B.Li / 2 + 0.7; x < B.Li / 2 - 0.5; x += 0.62) {
    for (let z = -B.Wi / 2 + 0.7; z < B.Wi / 2 - 0.5; z += 0.62) {
      const px = x + (rand() - 0.5) * 0.45;
      const pz = z + (rand() - 0.5) * 0.45;
      if (!inRoof(px, pz) || nearHatch(px, pz)) continue;
      sedumPts.push({ x: px, z: pz, s: 0.75 + rand() * 0.6, r: rand() * Math.PI, d: Math.hypot(px - corner.x, pz - corner.y) / maxD });
    }
  }
  const sedumGeo = new THREE.IcosahedronGeometry(0.34, 0);
  sedumGeo.scale(1, 0.55, 1);
  const sedum = new THREE.InstancedMesh(sedumGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), sedumPts.length);
  const sedumColors = ['#6aa84f', '#7fb24a', '#93c05a', '#5c9a45', '#a9b84d', '#b4553f', '#c56a43', '#d8c254'];
  sedumPts.forEach((p, i) => sedum.setColorAt(i, new THREE.Color(sedumColors[Math.floor(rand() * sedumColors.length)]).multiplyScalar(0.9 + rand() * 0.2)));
  sedum.castShadow = true;
  sedum.receiveShadow = true;
  building.add(sedum);

  // Intensywny: trawy, krzewy, drzewka, ścieżka
  const grassPts = [];
  for (let i = 0; i < 520; i++) {
    const px = (rand() - 0.5) * (B.Li - 1.4);
    const pz = (rand() - 0.5) * (B.Wi - 1.4);
    if (nearHatch(px, pz) || Math.abs(pz - 1.2) < 1.1) continue;
    grassPts.push({ x: px, z: pz, s: 0.7 + rand() * 0.7, r: rand() * Math.PI, d: Math.hypot(px - corner.x, pz - corner.y) / maxD });
  }
  const grassGeo = new THREE.ConeGeometry(0.26, 1.1, 5);
  grassGeo.translate(0, 0.55, 0);
  const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), grassPts.length);
  const grassColors = ['#6f9e3c', '#87ad4a', '#5d8a35', '#9fb85a', '#7aa04a'];
  grassPts.forEach((p, i) => grass.setColorAt(i, new THREE.Color(grassColors[Math.floor(rand() * grassColors.length)])));
  grass.castShadow = true;
  building.add(grass);

  const shrubPts = [];
  for (let i = 0; i < 46; i++) {
    const px = (rand() - 0.5) * (B.Li - 2.4);
    const pz = (rand() - 0.5) * (B.Wi - 2.4);
    if (nearHatch(px, pz) || Math.abs(pz - 1.2) < 1.6) continue;
    shrubPts.push({ x: px, z: pz, s: 0.7 + rand() * 0.6, r: 0, d: Math.hypot(px - corner.x, pz - corner.y) / maxD });
  }
  const shrubGeo = new THREE.IcosahedronGeometry(0.9, 1);
  shrubGeo.scale(1, 0.8, 1);
  shrubGeo.translate(0, 0.6, 0);
  const shrubs = new THREE.InstancedMesh(shrubGeo, new THREE.MeshStandardMaterial({ color: '#3f7a35', roughness: 0.85, flatShading: true }), shrubPts.length);
  shrubs.castShadow = true;
  building.add(shrubs);

  const trees = new THREE.Group();
  const treeSpots = [[-8, -5], [6, -5.5], [10, 5.5], [-11, 5]];
  treeSpots.forEach(([x, z]) => {
    const t = new THREE.Group();
    const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#6b4a33', roughness: 0.9 })));
    trunk.position.y = 1.1;
    const crown = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: '#4f8a3c', roughness: 0.85, flatShading: true })));
    crown.position.y = 3;
    t.add(trunk, crown);
    t.position.set(x, 0, z);
    t.userData.d = Math.hypot(x - corner.x, z - corner.y) / maxD;
    trees.add(t);
  });
  const path = box(B.Li - 3, 0.06, 1.4, greyMat);
  path.position.set(0.8, 0, 1.2);
  trees.add(path);
  building.add(trees);

  // Taras: deska, donice, leżaki, stół z parasolem
  const terrace = new THREE.Group();
  const deckW = DECK_EDGE + B.Li / 2 - 0.6;
  const deck = box(deckW, 0.14, B.Wi - 1.2, woodMat);
  deck.position.set(-B.Li / 2 + 0.6 + deckW / 2, 0.07, 0);
  terrace.add(deck);
  const planters = [];
  for (let i = 0; i < 5; i++) {
    const pl = new THREE.Group();
    const bx = box(0.9, 0.7, 2.4, darkMat);
    bx.position.y = 0.35;
    const bush = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshStandardMaterial({ color: '#4f8a3c', roughness: 0.85, flatShading: true })));
    bush.scale.set(0.9, 0.8, 1.9);
    bush.position.y = 1.05;
    pl.add(bx, bush);
    pl.position.set(DECK_EDGE - 0.4, 0.14, -B.Wi / 2 + 2.6 + i * 3.7);
    terrace.add(pl);
    planters.push(pl);
  }
  const furniture = new THREE.Group();
  for (const [x, z] of [[-6, 4.5], [-3.6, 4.5]]) {
    const l = box(0.8, 0.35, 2, whiteMat);
    l.position.set(x, 0.32, z);
    const back = box(0.8, 0.12, 0.8, whiteMat);
    back.position.set(x, 0.62, z - 0.9);
    back.rotation.x = -0.6;
    furniture.add(l, back);
  }
  const table = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 24), whiteMat));
  table.position.set(-8, 0.9, -2.5);
  const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), darkMat));
  leg.position.set(-8, 0.45, -2.5);
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), darkMat));
  pole.position.set(-8, 1.4, -2.5);
  const umbrella = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.6, 8, 1, true), redMat));
  umbrella.position.set(-8, 2.75, -2.5);
  furniture.add(table, leg, pole, umbrella);
  for (const [dx, dz] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) {
    const ch = box(0.5, 0.5, 0.5, darkMat);
    ch.position.set(-8 + dx, 0.25, -2.5 + dz);
    furniture.add(ch);
  }
  terrace.add(furniture);
  building.add(terrace);

  // ---------- Deszcz ----------
  const RAIN = 700;
  const rainPos = new Float32Array(RAIN * 6);
  const drops = Array.from({ length: RAIN }, () => ({ x: 0, y: 0, z: 0, v: 0 }));
  const spread = 6;
  const respawn = (d, top = true) => {
    d.x = (Math.random() - 0.5) * (B.L + spread * 2);
    d.z = (Math.random() - 0.5) * (B.W + spread * 2);
    d.y = top ? B.top + 14 + Math.random() * 6 : B.top + Math.random() * 20;
    d.v = 20 + Math.random() * 8;
  };
  drops.forEach((d) => respawn(d, false));
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: '#5f86b3', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  {
    const g = cc.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(50,60,40,0.5)');
    grad.addColorStop(0.6, 'rgba(50,60,40,0.1)');
    grad.addColorStop(1, 'rgba(50,60,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(B.L * 1.8, B.W * 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.01;
  scene.add(contact);

  // ---------- Kamera i wskaźnik ----------
  const anim = {
    theta: -0.7, phi: 0.62, yawUser: 0, yawVel: 0, px: 0, py: 0,
    intro: reduceMotion ? 1 : 0, introStart: 0, ex: 0, sub: SUB[0],
    g: [0, 0, 0], targetY: 9,
  };
  const ease = (x, k, dt) => x * Math.exp(-k * dt);
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    if (e.pointerType === 'mouse' && !reduceMotion) {
      anim.px = ((e.clientX - r.left) / r.width) * 2 - 1;
      anim.py = ((e.clientY - r.top) / r.height) * 2 - 1;
    }
    if (dragging) {
      const now = performance.now();
      const dx = e.clientX - lastX;
      anim.yawUser -= dx * 0.008;
      anim.yawVel = ((-dx * 0.008) / Math.max(now - lastT, 1)) * 1000;
      lastX = e.clientX;
      lastT = now;
    }
  });
  stage.addEventListener('pointerleave', () => {
    anim.px = 0;
    anim.py = 0;
  });
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastT = performance.now();
    anim.yawVel = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  const endDrag = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.style.cursor = 'grab';

  let radius = 88;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    radius = 88 * Math.pow(1.3 / Math.min(camera.aspect, 1.3), 0.4);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Etykiety warstw (rzut 3D → 2D)
  const _v = new THREE.Vector3();
  const tagW = tagEls.map(() => 0);
  const placeTags = (alphas) => {
    tagEls.forEach((el, k) => {
      const i = Number(el.dataset.layer);
      _v.set(B.Li / 2, layers[i].position.y, B.Wi / 2).project(camera);
      let x = (_v.x * 0.5 + 0.5) * stageW + 10;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      if (!tagW[k]) tagW[k] = el.offsetWidth || 170;
      x = Math.min(x, stageW - tagW[k] - 10);
      el.style.opacity = alphas[i].toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  // Wzrost roślin: fala od narożnika, lekkie „dobicie” na końcu
  const grow = (g, d) => {
    const t = clamp01((g * 1.6 - d * 0.6) / 1);
    if (t <= 0) return 0;
    const c = 1.5;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  const sc = new THREE.Vector3();
  const setInst = (mesh, pts, k, yBase, heightScale = 1) => {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const s = Math.max(grow(k(p), p.d) * p.s, 0.0001);
      q.setFromAxisAngle(up, p.r);
      mesh.setMatrixAt(i, m4.compose(v3.set(p.x, yBase, p.z), q, sc.set(s, s * heightScale, s)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // ---------- Pętla ----------
  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;
    const type = currentType();

    // Wejście: budynek rośnie od ziemi
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1300, 1);
    }
    building.scale.y = Math.max(1 - Math.pow(1 - anim.intro, 3), 0.001);

    // Krok 1: papa nagrzana (pulsujący żar)
    const heat = 1 - smoothstep(0.2, 0.3, p);
    papaMat.emissiveIntensity = heat * (0.055 + 0.03 * Math.sin(now / 420));

    // Krok 2: warstwy spadają po kolei i rozsuwają się dla etykiet, potem zwierają
    const exGoal = 1 - smoothstep(0.45, 0.5, p);
    anim.ex = exGoal + ease(anim.ex - exGoal, 6, dt);
    const subGoal = SUB[type];
    anim.sub = subGoal + ease(anim.sub - subGoal, 6, dt);
    layers[3].userData.mesh.scale.y = anim.sub;
    const GAP = stageW < 600 ? 5.6 : 3.2; // odstęp warstw w rozłożeniu — etykiety się nie nakładają
    const thick = [T.membrane, T.drain, T.geo, anim.sub];
    const tagAlpha = [0, 0, 0, 0];
    let y = B.top + PAPA;
    layers.forEach((g, i) => {
      const drop = layerDrop(p, i);
      const s = 1 - drop;
      g.visible = drop > 0.001;
      g.position.y = y + thick[i] / 2 + anim.ex * GAP * (i + 1) * drop + 10 * s * s * s;
      tagAlpha[i] = drop * anim.ex * (p < 0.5 ? 1 : 0);
      y += thick[i];
    });
    const surface = y;

    // Krok 3: roślinność wybranego typu (scroll steruje pierwszym wzrostem)
    const growGate = smoothstep(0.5, 0.58, p);
    const goals = [type === 0 ? 1 : 0, type === 1 ? 1 : 0, type === 2 ? 1 : 0].map((v) => v * growGate);
    anim.g = anim.g.map((g, i) => {
      if (state.manualType === null && growGate < 1 && i === type) return goals[i]; // pierwszy wzrost: scrub przewijaniem
      return goals[i] + ease(g - goals[i], 3.2, dt);
    });
    const [gE, gT, gI] = anim.g;
    const sedumK = (pt) => Math.max(gE, pt.x > DECK_EDGE + 0.9 ? gT : 0);
    setInst(sedum, sedumPts, sedumK, surface);
    setInst(grass, grassPts, () => gI, surface);
    setInst(shrubs, shrubPts, () => gI, surface);
    trees.position.y = surface;
    trees.children.forEach((t) => {
      const s = Math.max(grow(gI, t.userData.d ?? 0.3), 0.0001);
      t.scale.setScalar(s);
    });
    terrace.position.y = surface;
    const deckK = clamp01(gT * 1.4);
    deck.scale.set(Math.max(deckK, 0.0001), 1, 1);
    deck.position.x = -B.Li / 2 + 0.6 + (deckW * deckK) / 2;
    planters.forEach((pl, i) => pl.scale.setScalar(Math.max(grow(gT, 0.2 + i * 0.12), 0.0001)));
    furniture.scale.setScalar(Math.max(grow(gT, 0.5), 0.0001));

    // Krok 4: deszcz — woda wsiąka w dach zielony, poza dachem spada na ziemię
    const rainK = reduceMotion ? 0 : smoothstep(0.78, 0.84, p);
    rainMat.opacity = rainK * 0.55;
    rain.visible = rainK > 0.01;
    if (rain.visible) {
      for (let i = 0; i < RAIN; i++) {
        const d = drops[i];
        d.y -= d.v * dt;
        const onRoof = Math.abs(d.x) < B.Li / 2 && Math.abs(d.z) < B.Wi / 2;
        if ((onRoof && d.y < surface + 0.2) || d.y < 0) respawn(d);
        rainPos.set([d.x, d.y, d.z, d.x - 0.04, d.y + 0.9, d.z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Kamera
    const span = reduceMotion ? 0.3 : 1.05;
    const thetaGoal = -0.7 + span * smoothstep(0, 1, p) + anim.px * 0.08;
    const phiGoal = 0.62 - 0.12 * smoothstep(0.5, 0.75, p) - anim.py * 0.04;
    anim.theta = thetaGoal + ease(anim.theta - thetaGoal, 4, dt);
    anim.phi = phiGoal + ease(anim.phi - phiGoal, 4, dt);
    const tyGoal = 8.5 + anim.ex * 5 * smoothstep(0.27, 0.35, p);
    anim.targetY = tyGoal + ease(anim.targetY - tyGoal, 4, dt);
    target.y = anim.targetY;
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.theta + anim.yawUser;
    const r = radius * (1 - 0.1 * smoothstep(0.5, 0.75, p));
    camera.position.set(
      Math.sin(th) * Math.cos(anim.phi) * r,
      target.y + Math.sin(anim.phi) * r,
      Math.cos(th) * Math.cos(anim.phi) * r
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const exView = anim.ex * smoothstep(0.27, 0.33, p);
    camera.setViewOffset(stageW, stageH, exView * stageW * 0.1, 0, stageW, stageH);

    placeTags(tagAlpha);
    renderer.render(scene, camera);
    if (state.visible) raf = requestAnimationFrame(frame);
  };

  new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
      if (state.visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    { rootMargin: '200px 0px' }
  ).observe(stage);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) state.inView = true;
  }, { threshold: 0.35 }).observe(stage);

  syncUI();
}
})();
