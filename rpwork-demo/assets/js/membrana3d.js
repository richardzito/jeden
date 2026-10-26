/* ==========================================================================
   Zajawka „Natrysk 3D” — dach płaski sterowany przewijaniem:
   stara papa → wybór podłoża (papa, blacha, PVC, beton) → natrysk płynnej
   membrany pas po pasie → biały dach, system i szacunek ceny, panele PV.
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
  const tagEls = [...stage.querySelectorAll('[data-tag]')];
  const subSwitch = document.getElementById('sub-switch');
  const subBtns = [...subSwitch.querySelectorAll('button')];
  const sysSwitch = document.getElementById('sys-switch');
  const sysBtns = [...sysSwitch.querySelectorAll('button')];
  const hudSub = document.getElementById('hud-sub');
  const hudPrep = document.getElementById('hud-prep');
  const hudCover = document.getElementById('hud-cover');
  const hudMeter = document.getElementById('hud-meter');
  const hudArea = document.getElementById('hud-area');
  const hudSys = document.getElementById('hud-sys');
  const hudK = [1, 2, 3].map((i) => document.getElementById(`hud-k${i}`));
  const hudV = [1, 2, 3].map((i) => document.getElementById(`hud-v${i}`));
  const hudPrice = document.getElementById('hud-price');

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ---------- Dane ----------
  const B = { L: 40, W: 22, H: 12, slab: 0.3, parapet: 1.0, wall: 0.3 };
  B.Li = B.L - 2 * B.wall;
  B.Wi = B.W - 2 * B.wall;
  B.top = B.H + B.slab;
  const area = Math.round((B.Li * B.Wi) / 10) * 10;
  hudArea.textContent = area;

  // Przygotowanie podłoża — wg kart technicznych systemu Neoproof
  const SUBS = [
    { name: 'Papa', prep: 'Myjemy, naprawiamy pęcherze i pęknięcia, gruntujemy.' },
    { name: 'Blacha', prep: 'Usuwamy rdzę, gruntujemy podkładem antykorozyjnym.' },
    { name: 'PVC', prep: 'Czyścimy i przygotowujemy chemicznie powierzchnię.' },
    { name: 'Beton', prep: 'Grunt dobrany do wilgotności betonu.' },
  ];
  // Systemy: parametry z kart technicznych, ceny poglądowe zł/m²
  const SYSTEMS = [
    { name: 'Neoproof Polyurea R', rows: [['Deszcz', 'po 1 h'], ['Trwałość', 'do 25 lat · W3'], ['Aplikacja', 'natrysk lub wałek']], lo: 120, hi: 170 },
    { name: 'Neoproof PU W-40', rows: [['Chłodny dach', 'Cool Material'], ['Skład', '1-składnikowa, na wodzie'], ['Aplikacja', 'wałek']], lo: 90, hi: 130 },
  ];

  const state = { progress: 0, step: -1, manualSub: null, sys: 0, visible: false, inView: false };

  // Podłoże w kroku 2 przewijane: papa → blacha → PVC → beton → znowu papa
  const scrollSub = (p) => {
    if (p < 0.25 || p >= 0.45) return 0;
    return Math.min(3, Math.floor((p - 0.25) / 0.05));
  };
  const currentSub = () => state.manualSub ?? scrollSub(state.progress);
  const coverAt = (p) => clamp01((p - 0.5) / 0.24);

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // Licznik ceny w kroku 4
  const shown = { lo: 0, hi: 0 };
  let priceAnim = 0;
  const animatePrice = () => {
    const s = SYSTEMS[state.sys];
    const goal = { lo: Math.round((area * s.lo) / 1000), hi: Math.round((area * s.hi) / 1000) };
    if (goal.lo === shown.lo && goal.hi === shown.hi) return;
    const from = { ...shown };
    const t0 = performance.now();
    const dur = reduceMotion ? 1 : 800;
    cancelAnimationFrame(priceAnim);
    const tick = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      shown.lo = from.lo + (goal.lo - from.lo) * e;
      shown.hi = from.hi + (goal.hi - from.hi) * e;
      hudPrice.textContent = `${fmt(shown.lo)}–${fmt(shown.hi)} tys. zł`;
      if (k < 1) priceAnim = requestAnimationFrame(tick);
    };
    priceAnim = requestAnimationFrame(tick);
  };

  const setSys = (i) => {
    state.sys = i;
    sysSwitch.style.setProperty('--i', i);
    sysBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const s = SYSTEMS[i];
    hudSys.textContent = s.name;
    s.rows.forEach(([k, v], j) => {
      hudK[j].textContent = k;
      hudV[j].textContent = v;
    });
    animatePrice();
  };

  let lastSub = -1;
  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    if (step === 0) state.manualSub = null;
    if (rail) rail.style.transform = `scaleY(${p})`;
    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', el.dataset.hud.split(',').map(Number).includes(step)));
      if (step === 3) animatePrice();
    }
    const sub = currentSub();
    if (sub !== lastSub) {
      lastSub = sub;
      subSwitch.style.setProperty('--i', sub);
      subBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === sub)));
      hudSub.textContent = SUBS[sub].name;
      hudPrep.textContent = SUBS[sub].prep;
    }
    const c = coverAt(p);
    hudCover.textContent = Math.round(c * 100);
    hudMeter.style.transform = `scaleX(${c.toFixed(3)})`;
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

  subBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.manualSub = Number(b.dataset.sub);
      syncUI();
    })
  );
  sysBtns.forEach((b) => b.addEventListener('click', () => setSys(Number(b.dataset.sys))));
  setSys(0);

  // ---------- WebGL ----------
  if (!THREE) {
    stage.classList.add('no-webgl');
    return;
  }
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

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 700);
  const target = new THREE.Vector3(0, 10, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#c9ccd0', 0.6));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.5);
  sun.position.set(-30, 55, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const rand = (() => {
    let s = 21;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const makeTex = (draw, w = 1024, h = w, repeat = true) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const grain = (g, s, rgb, spread, count) => {
    g.fillStyle = `rgb(${rgb.join(',')})`;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < count; i++) {
      const d = (rand() - 0.5) * spread;
      g.fillStyle = `rgb(${rgb.map((v) => Math.max(0, Math.min(255, v + d))).join(',')})`;
      g.fillRect(rand() * s, rand() * s, 1 + rand() * 1.8, 1 + rand() * 1.8);
    }
  };
  const crackLines = (g, s, n, color, width = 1.2) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    for (let i = 0; i < n; i++) {
      let x = rand() * s;
      let y = rand() * s;
      g.beginPath();
      g.moveTo(x, y);
      const steps = 4 + Math.floor(rand() * 6);
      for (let k = 0; k < steps; k++) {
        x += (rand() - 0.5) * 60;
        y += (rand() - 0.5) * 60;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  const TILE = 12.8; // metry na kafel tekstury
  // Papa: pasy co 1 m, łaty, pęknięcia, pęcherze
  const papaTex = makeTex((g, s) => {
    grain(g, s, [52, 52, 54], 36, 60000);
    const m = s / TILE;
    for (let y = 0; y < s; y += m) {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, y, s, 5);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, y + 5, s, 2);
    }
    for (let i = 0; i < 16; i++) {
      const w = m * (0.6 + rand() * 1.6);
      const h = m * (0.5 + rand() * 1.2);
      const v = rand() < 0.5 ? 30 : 74;
      g.fillStyle = `rgba(${v},${v},${v + 2},0.9)`;
      g.fillRect(rand() * s, rand() * s, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 2;
    }
    crackLines(g, s, 46, 'rgba(150,150,150,0.55)');
    for (let i = 0; i < 70; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 4 + rand() * 9;
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      gr.addColorStop(0, 'rgba(120,120,122,0.9)');
      gr.addColorStop(1, 'rgba(40,40,42,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  // Blacha trapezowa z ogniskami rdzy
  const metalTex = makeTex((g, s) => {
    const rib = s / TILE / 4;
    for (let x = 0; x < s; x += rib) {
      const gr = g.createLinearGradient(x, 0, x + rib, 0);
      gr.addColorStop(0, 'rgb(176,180,184)');
      gr.addColorStop(0.25, 'rgb(205,208,212)');
      gr.addColorStop(0.5, 'rgb(150,154,158)');
      gr.addColorStop(1, 'rgb(170,174,178)');
      g.fillStyle = gr;
      g.fillRect(x, 0, rib, s);
    }
    for (let i = 0; i < 34; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 10 + rand() * 40;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(140,70,30,0.75)');
      gr.addColorStop(1, 'rgba(140,70,30,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  // Membrana PVC: zgrzewy co 2 m, zabrudzenia
  const pvcTex = makeTex((g, s) => {
    grain(g, s, [186, 190, 192], 14, 30000);
    const m = s / TILE;
    for (let y = 0; y < s; y += 2 * m) {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(0, y, s, 7);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, y + 7, s, 2);
    }
    for (let i = 0; i < 22; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 40 + rand() * 120;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(90,92,88,0.28)');
      gr.addColorStop(1, 'rgba(90,92,88,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    crackLines(g, s, 8, 'rgba(60,60,60,0.6)', 2);
  });
  // Beton: szum, rysy, plamy
  const concreteTex = makeTex((g, s) => {
    grain(g, s, [156, 154, 148], 40, 70000);
    for (let i = 0; i < 26; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 30 + rand() * 90;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(90,88,82,0.3)');
      gr.addColorStop(1, 'rgba(90,88,82,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    crackLines(g, s, 36, 'rgba(60,58,54,0.7)', 1.4);
  });
  const subTex = [papaTex, metalTex, pvcTex, concreteTex];
  subTex.forEach((t) => t.repeat.set(B.Li / TILE, B.Wi / TILE));
  const SUB_LOOK = [
    { color: '#ffffff', rough: 0.88, metal: 0.05 },
    { color: '#ffffff', rough: 0.45, metal: 0.55 },
    { color: '#ffffff', rough: 0.7, metal: 0 },
    { color: '#ffffff', rough: 0.95, metal: 0 },
  ];
  // Panel PV: ogniwa
  const pvTex = makeTex((g, w, h) => {
    g.fillStyle = 'rgb(22,34,62)';
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 10;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i * w) / cols + 2;
        const y = (j * h) / rows + 2;
        const gr = g.createLinearGradient(x, y, x + w / cols, y + h / rows);
        gr.addColorStop(0, 'rgb(36,58,104)');
        gr.addColorStop(1, 'rgb(20,32,60)');
        g.fillStyle = gr;
        g.fillRect(x, y, w / cols - 4, h / rows - 4);
      }
    }
  }, 128, 220, false);

  // ---------- Materiały ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.92 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#e7c35a', roughness: 0.9 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#8a8580', roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33404b', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const copingMat = new THREE.MeshStandardMaterial({ color: '#7b2a20', roughness: 0.5, metalness: 0.4 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#c3beb6', roughness: 0.95 });
  const oldMat = new THREE.MeshStandardMaterial({ map: papaTex, bumpMap: papaTex, bumpScale: 1.2, roughness: 0.88, metalness: 0.05 });
  const fadeMat = new THREE.MeshStandardMaterial({ map: papaTex, roughness: 0.88, transparent: true, opacity: 0, depthWrite: false });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#3b3b3d', roughness: 0.55, metalness: 0.3 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.35, metalness: 0.8 });
  const domeMat = new THREE.MeshStandardMaterial({ color: '#dfe8ef', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.75 });
  const pondMat = new THREE.MeshStandardMaterial({ color: '#2f3a44', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.8, envMapIntensity: 0.7 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.4 });
  const pvMat = new THREE.MeshStandardMaterial({ map: pvTex, roughness: 0.18, metalness: 0.4, envMapIntensity: 1.2 });

  // Membrana: odsłaniana pasami (jak przejścia z lancą), mokra krawędź błyszczy
  const N_LANES = 7;
  const X0 = -B.Li / 2;
  const Z0 = -B.Wi / 2;
  const laneW = B.Wi / N_LANES;
  const uniforms = { uC: { value: 0 } };
  const memMat = new THREE.MeshStandardMaterial({ color: '#fbfbfa', roughness: 0.42, metalness: 0 });
  memMat.onBeforeCompile = (sh) => {
    sh.uniforms.uC = uniforms.uC;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMemW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMemW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMemW;
        uniform float uC;
        float memT() {
          float zi = clamp((vMemW.z - (${Z0.toFixed(3)})) / ${B.Wi.toFixed(3)}, 0.0, 0.9999) * ${N_LANES.toFixed(1)};
          float lane = floor(zi);
          float fx = clamp((vMemW.x - (${X0.toFixed(3)})) / ${B.Li.toFixed(3)}, 0.0, 1.0);
          float along = mod(lane, 2.0) < 0.5 ? fx : 1.0 - fx;
          return (lane + along) / ${N_LANES.toFixed(1)};
        }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float mT = memT();
        if (mT > uC) discard;
        float mWet = smoothstep(uC - 0.03, uC, mT);`
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.87, 0.93), mWet * 0.6);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, mWet);');
  };
  const memTAt = (x, z) => {
    const zi = Math.min(Math.max((z - Z0) / B.Wi, 0), 0.9999) * N_LANES;
    const lane = Math.floor(zi);
    const fx = clamp01((x - X0) / B.Li);
    const along = lane % 2 === 0 ? fx : 1 - fx;
    return (lane + along) / N_LANES;
  };

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Budynek ----------
  const building = new THREE.Group();
  scene.add(building);
  const body = box(B.L, B.H - 0.8, B.W, wallMat);
  body.position.y = 0.8 + (B.H - 0.8) / 2;
  const base = box(B.L + 0.12, 0.8, B.W + 0.12, baseMat);
  base.position.y = 0.4;
  building.add(body, base);
  // Pionowe pasy elewacji w kolorze (jak na zdjęciach z drona)
  for (const x of [-B.L / 2 + 0.01, B.L / 2 - 0.01]) {
    const s = box(0.02, B.H - 0.8, B.W * 0.36, accentMat);
    s.position.set(x + Math.sign(x) * 0.02, 0.8 + (B.H - 0.8) / 2, B.W * 0.18);
    building.add(s);
  }

  // Okna (InstancedMesh)
  const winSpots = [];
  const floors = [1.6, 4.4, 7.2, 10.0];
  const addRow = (side, count, len) => {
    for (const y of floors) {
      for (let i = 0; i < count; i++) winSpots.push({ side, a: -len / 2 + (len / count) * (i + 0.5), y });
    }
  };
  addRow('front', 12, B.L - 3);
  addRow('back', 12, B.L - 3);
  addRow('right', 6, B.W - 3);
  addRow('left', 6, B.W - 3);
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.6, 0.12), frameMat, winSpots.length);
  const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.26, 1.46), glassMat, winSpots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  winSpots.forEach((w, i) => {
    let x = 0;
    let z = 0;
    let rot = 0;
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
  // Wejście z daszkiem
  const canopy = box(5, 0.25, 2.2, copingMat);
  canopy.position.set(-6, 3.2, B.W / 2 + 1.1);
  const door = box(2.4, 2.6, 0.1, frameMat);
  door.position.set(-6, 0.8 + 1.3, B.W / 2 + 0.06);
  building.add(canopy, door);

  // Strop, attyka z obróbką
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
    const c = box(w + 0.12, 0.08, d + 0.12, copingMat);
    c.position.set(x, B.top + B.parapet + 0.04, z);
    building.add(m, c);
  }

  // Stare pokrycie (+ druga warstwa do płynnej zmiany podłoża)
  const roofGeo = new THREE.PlaneGeometry(B.Li, B.Wi);
  const oldRoof = new THREE.Mesh(roofGeo, oldMat);
  oldRoof.rotation.x = -Math.PI / 2;
  oldRoof.position.y = B.top + 0.01;
  oldRoof.receiveShadow = true;
  const fadeRoof = new THREE.Mesh(roofGeo, fadeMat);
  fadeRoof.rotation.x = -Math.PI / 2;
  fadeRoof.position.y = B.top + 0.015;
  building.add(oldRoof, fadeRoof);

  // Zastoiny wody (na papie i betonie)
  const PONDS = [[-11, 4.5, 2.6, 1.6], [6.5, -6.5, 3.2, 1.8], [-1, 6.8, 1.8, 1.1]];
  const ponds = PONDS.map(([x, z, sx, sz]) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), pondMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(sx, sz, 1);
    m.position.set(x, B.top + 0.02, z);
    building.add(m);
    return m;
  });

  // Membrana: na dachu i na wewnętrznych ścianach attyki
  const membrane = new THREE.Mesh(roofGeo, memMat);
  membrane.rotation.x = -Math.PI / 2;
  membrane.position.y = B.top + 0.03;
  membrane.receiveShadow = true;
  building.add(membrane);
  for (const [w, d, x, z] of [
    [B.Li, 0.04, 0, B.Wi / 2 - 0.02],
    [B.Li, 0.04, 0, -B.Wi / 2 + 0.02],
    [0.04, B.Wi, B.Li / 2 - 0.02, 0],
    [0.04, B.Wi, -B.Li / 2 + 0.02, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, B.parapet - 0.05, d), memMat);
    m.position.set(x, B.top + (B.parapet - 0.05) / 2, z);
    m.receiveShadow = true;
    building.add(m);
  }

  // Detale: kominki, wywietrzaki, świetliki, wyłaz — z kołnierzem, który dostaje membranę
  const details = [];
  const collarOld = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.8 });
  const addDetail = (x, z, build, collarW, collarD) => {
    const g = new THREE.Group();
    g.position.set(x, B.top, z);
    build(g);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(collarW, 0.16, collarD), collarOld);
    collar.position.y = 0.08;
    collar.receiveShadow = true;
    g.add(collar);
    building.add(g);
    details.push({ x, z, t: memTAt(x, z), collar });
  };
  const vent = (g) => {
    const pipe = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 16), darkMat));
    pipe.position.y = 0.55;
    const cap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.38, 16), darkMat));
    cap.position.y = 1.3;
    g.add(pipe, cap);
  };
  const turbine = (g) => {
    const pipe = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 18), darkMat));
    pipe.position.y = 0.3;
    const head = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 20), darkMat));
    head.position.y = 0.9;
    const top = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.25, 20), darkMat));
    top.position.y = 1.32;
    g.add(pipe, head, top);
  };
  const ventBox = (g) => {
    const b = box(2.4, 0.9, 1.1, steelMat);
    b.position.y = 0.6;
    const lid = box(2.6, 0.08, 1.3, darkMat);
    lid.position.y = 1.08;
    g.add(b, lid);
  };
  const skylight = (g) => {
    const b = box(1.6, 0.45, 1.6, whiteMat);
    b.position.y = 0.3;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.scale.y = 0.55;
    dome.position.y = 0.52;
    g.add(b, dome);
  };
  const hatch = (g) => {
    const b = box(1.4, 0.7, 1.4, whiteMat);
    b.position.y = 0.42;
    const lid = box(1.5, 0.08, 1.5, darkMat);
    lid.position.y = 0.8;
    g.add(b, lid);
  };
  [[-16, -7.5], [-13, 6.8], [-7, -8], [-3.5, 7.6], [3, -8.6], [9, 8.4], [16, -8.4], [18, 7.8]].forEach(([x, z], i) =>
    addDetail(x, z, i % 2 ? turbine : vent, 1.2, 1.2)
  );
  addDetail(-10, -1.5, ventBox, 2.9, 1.6);
  addDetail(-17, 2.5, ventBox, 2.9, 1.6);
  addDetail(-5, 2, skylight, 2.1, 2.1);
  addDetail(-5, -4, skylight, 2.1, 2.1);
  addDetail(-14, -3.4, hatch, 1.9, 1.9);

  // ---------- Dekarz z lancą i mgiełka natrysku ----------
  const worker = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: '#e31e24', roughness: 0.7 });
  const legsMat = new THREE.MeshStandardMaterial({ color: '#2b2a29', roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#e0b28e', roughness: 0.7 });
  const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), suitMat));
  torso.position.y = 1.25;
  const legs = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.6, 6, 10), legsMat));
  legs.position.y = 0.55;
  legs.scale.set(1.15, 1, 0.8);
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skinMat));
  head.position.y = 1.86;
  const helmet = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat));
  helmet.position.y = 1.9;
  const lance = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), darkMat));
  lance.rotation.x = Math.PI / 2 + 0.75;
  lance.position.set(0, 1.15, 0.5);
  const nozzle = new THREE.Object3D();
  nozzle.position.set(0, 0.7, 0.98);
  worker.add(torso, legs, head, helmet, lance, nozzle);
  worker.visible = false;
  worker.scale.setScalar(1.5);
  building.add(worker);

  const MIST = 260;
  const mistPos = new Float32Array(MIST * 3);
  const mist = Array.from({ length: MIST }, () => ({ t: Math.random(), jx: 0, jz: 0 }));
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3).setUsage(THREE.DynamicDrawUsage));
  const mistMat = new THREE.PointsMaterial({ color: '#cfd9e4', size: 0.16, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const mistPts = new THREE.Points(mistGeo, mistMat);
  mistPts.frustumCulled = false;
  building.add(mistPts);

  // ---------- Fotowoltaika (krok 4) ----------
  const pv = new THREE.Group();
  building.add(pv);
  const panels = [];
  const panelGeo = new THREE.BoxGeometry(1.05, 0.04, 1.9);
  const frameGeo = new THREE.BoxGeometry(1.1, 0.06, 1.95);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 12; c++) {
      const g = new THREE.Group();
      const fr = shadowed(new THREE.Mesh(frameGeo, steelMat));
      const pn = new THREE.Mesh(panelGeo, pvMat);
      pn.position.y = 0.02;
      const leg = box(0.9, 0.35, 0.08, steelMat);
      leg.position.set(0, -0.2, -0.85);
      g.add(fr, pn, leg);
      g.rotation.x = -0.21;
      const x = 1.6 + c * 1.35;
      const z = -6 + r * 3.4;
      g.userData = { x, z, delay: (c + r * 3) / 30 };
      g.position.set(x, B.top + 0.45, z);
      pv.add(g);
      panels.push(g);
    }
  }

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.15 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Kamera ----------
  const SHOTS = [
    { th: -0.75, ph: 0.62, r: 1, t: [0, 10, 0] },
    { th: -0.4, ph: 0.98, r: 0.86, t: [0, 12, 0] },
    { th: -0.35, ph: 0.72, r: 0.72, t: [0, 12.5, 0] },
    { th: -1.05, ph: 0.7, r: 1.04, t: [0, 10, 0] },
  ];
  const shotAt = (p, wx, wz) => {
    const k1 = smoothstep(0.21, 0.29, p);
    const k2 = smoothstep(0.46, 0.54, p);
    const k3 = smoothstep(0.73, 0.8, p);
    const mix = (f) => lerp(lerp(lerp(f(SHOTS[0]), f(SHOTS[1]), k1), f(SHOTS[2]), k2), f(SHOTS[3]), k3);
    const follow = k2 * (1 - k3) * 0.35;
    return {
      th: mix((s) => s.th),
      ph: mix((s) => s.ph),
      r: mix((s) => s.r),
      t: [mix((s) => s.t[0]) + wx * follow, mix((s) => s.t[1]), mix((s) => s.t[2]) + wz * follow],
    };
  };
  const anim = { th: SHOTS[0].th, ph: SHOTS[0].ph, r: 1, tx: 0, ty: 10, tz: 0, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0, wx: X0, wz: Z0 + laneW / 2, fade: 0, fadeSub: 0 };
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

  let radius = 100;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    radius = 100 * Math.pow(1.3 / Math.min(camera.aspect, 1.3), 0.55);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Etykiety (rzut 3D → 2D)
  const TAGS = {
    bubble: { pos: new THREE.Vector3(-15, B.top + 0.1, -2), steps: [0] },
    patch: { pos: new THREE.Vector3(10, B.top + 0.1, 3), steps: [0], wide: true },
    pond: { pos: new THREE.Vector3(PONDS[1][0] + 1.8, B.top + 0.1, PONDS[1][1]), steps: [0] },
    detail: { pos: new THREE.Vector3(-10, B.top + 1.2, -1.5), steps: [2] },
  };
  const tagState = tagEls.map(() => ({ a: 0, w: 0 }));
  const _v = new THREE.Vector3();
  const placeTags = (alphaOf, dt) => {
    tagEls.forEach((el, k) => {
      const key = el.dataset.tag;
      const t = TAGS[key];
      const st = tagState[k];
      const goal = alphaOf(key, t);
      st.a = goal + ease(st.a - goal, 10, dt);
      if (st.a < 0.01) {
        el.style.opacity = '0';
        return;
      }
      _v.copy(t.pos).applyMatrix4(building.matrixWorld).project(camera);
      let x = (_v.x * 0.5 + 0.5) * stageW + 6;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      if (!st.w) st.w = el.offsetWidth || 170;
      x = Math.min(x, stageW - st.w - 10);
      el.style.opacity = st.a.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  const applySub = (i) => {
    oldMat.map = subTex[i];
    oldMat.bumpMap = subTex[i];
    oldMat.bumpScale = i === 0 ? 1.2 : 0.6;
    oldMat.roughness = SUB_LOOK[i].rough;
    oldMat.metalness = SUB_LOOK[i].metal;
    oldMat.needsUpdate = true;
    ponds.forEach((m) => (m.visible = i === 0 || i === 3));
  };
  applySub(0);
  let shownSub = 0;

  // ---------- Pętla ----------
  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    const c = coverAt(p);
    uniforms.uC.value = c <= 0 ? -1 : c;

    // Wejście: budynek rośnie od ziemi
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1300, 1);
    }
    building.scale.y = Math.max(1 - Math.pow(1 - anim.intro, 3), 0.001);

    // Zmiana podłoża: stare pokrycie przenika się z nowym
    const sub = currentSub();
    if (sub !== shownSub) {
      fadeMat.map = subTex[shownSub];
      fadeMat.needsUpdate = true;
      anim.fade = 1;
      shownSub = sub;
      applySub(sub);
    }
    anim.fade = ease(anim.fade, reduceMotion ? 30 : 7, dt);
    fadeMat.opacity = anim.fade;
    fadeRoof.visible = anim.fade > 0.01;

    // Natrysk: dekarz idzie pasami, mgiełka leci na mokrą krawędź
    const spraying = c > 0.002 && c < 0.998;
    const lane = Math.min(Math.floor(c * N_LANES), N_LANES - 1);
    const frac = c * N_LANES - lane;
    const dir = lane % 2 === 0 ? 1 : -1;
    const edgeX = dir > 0 ? X0 + frac * B.Li : X0 + B.Li - frac * B.Li;
    const laneZ = Z0 + laneW * (lane + 0.5);
    const goalX = Math.min(Math.max(edgeX + dir * 1.4, X0 + 0.6), X0 + B.Li - 0.6);
    anim.wx = goalX + ease(anim.wx - goalX, 9, dt);
    anim.wz = laneZ + ease(anim.wz - laneZ, 6, dt);
    worker.visible = spraying || (step === 2 && c < 0.01);
    worker.position.set(anim.wx, B.top + 0.03, anim.wz);
    worker.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    torso.position.y = 1.25 + (reduceMotion ? 0 : Math.abs(Math.sin(now / 160)) * 0.04);
    mistMat.opacity = spraying ? 0.85 : 0;
    mistPts.visible = spraying && !reduceMotion;
    if (mistPts.visible) {
      worker.updateMatrixWorld();
      building.updateMatrixWorld();
      const n = nozzle.getWorldPosition(new THREE.Vector3());
      building.worldToLocal(n);
      const sweep = Math.sin(now / 140) * laneW * 0.42;
      for (let i = 0; i < MIST; i++) {
        const m = mist[i];
        m.t += dt * (1.6 + (i % 7) * 0.12);
        if (m.t >= 1) {
          m.t -= 1;
          m.jx = (Math.random() - 0.5) * 0.9;
          m.jz = (Math.random() - 0.5) * 1.0;
        }
        const t = m.t;
        const tx = edgeX - dir * 0.25 + m.jx;
        const tz = laneZ + sweep + m.jz;
        mistPos[i * 3] = lerp(n.x, tx, t);
        mistPos[i * 3 + 1] = lerp(n.y, B.top + 0.06, t) + Math.sin(t * Math.PI) * 0.15;
        mistPos[i * 3 + 2] = lerp(n.z, tz, t);
      }
      mistGeo.attributes.position.needsUpdate = true;
    }

    // Kołnierze detali dostają membranę, gdy dojdzie do nich natrysk
    details.forEach((d) => {
      const coated = c > d.t + 0.004;
      d.collar.material = coated ? memMat : collarOld;
      d.collar.scale.y = coated ? 1.6 : 1;
    });

    // Fotowoltaika spada na gotowy dach
    const pvK = smoothstep(0.84, 0.97, p);
    pv.visible = pvK > 0.001;
    panels.forEach((g) => {
      const k = smoothstep(g.userData.delay * 0.6, g.userData.delay * 0.6 + 0.4, pvK);
      const e = 1 - Math.pow(1 - k, 3);
      g.position.y = B.top + 0.45 + (1 - e) * 6;
      g.scale.setScalar(Math.max(e, 0.001));
    });

    // Kamera
    const shot = shotAt(p, anim.wx, anim.wz);
    const span = reduceMotion ? 0.3 : 1;
    const thGoal = lerp(SHOTS[0].th, shot.th, span) + anim.px * 0.06;
    const phGoal = shot.ph - anim.py * 0.03;
    anim.th = thGoal + ease(anim.th - thGoal, 4, dt);
    anim.ph = phGoal + ease(anim.ph - phGoal, 4, dt);
    anim.r = shot.r + ease(anim.r - shot.r, 4, dt);
    anim.tx = shot.t[0] + ease(anim.tx - shot.t[0], 4, dt);
    anim.ty = shot.t[1] + ease(anim.ty - shot.t[1], 4, dt);
    anim.tz = shot.t[2] + ease(anim.tz - shot.t[2], 4, dt);
    target.set(anim.tx, anim.ty, anim.tz);
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.th + anim.yawUser;
    const r = radius * anim.r;
    camera.position.set(
      target.x + Math.sin(th) * Math.cos(anim.ph) * r,
      target.y + Math.sin(anim.ph) * r,
      target.z + Math.cos(th) * Math.cos(anim.ph) * r
    );
    camera.lookAt(target);
    const narrow = stageW < 600;
    const offY = narrow ? -stageH * 0.2 * smoothstep(0.73, 0.8, p) : 0;
    camera.setViewOffset(stageW, stageH, 0, offY, stageW, stageH);
    camera.updateMatrixWorld();
    building.updateMatrixWorld();

    // Etykiety
    const introA = smoothstep(0.7, 1, anim.intro);
    placeTags((key, t) => {
      if (!t.steps.includes(step)) return 0;
      if (t.wide && stageW < 600) return 0;
      if (key === 'pond' && !(sub === 0 || sub === 3)) return 0;
      if (key === 'detail') return c > details[8].t + 0.01 ? introA : 0;
      return introA;
    }, dt);

    renderer.render(scene, camera);
    if (state.visible) raf = requestAnimationFrame(frame);
  };

  new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
      document.body.classList.toggle('in-wow', entry.isIntersecting);
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
