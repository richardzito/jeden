/* ==========================================================================
   Zajawka „Ogrodowe SPA w 3D” — ogród na makiecie sterowany przewijaniem:
   sauna ogrodowa składa się deska po desce i nagrzewa do 90 °C → taras
   układa się deska po desce, wjeżdża jacuzzi, woda nalewa się i paruje
   (38 °C) → wanna lodowa z kostkami lodu i zimną mgłą (4 °C) → zmierzch,
   kominek ogrodowy, światła i rytuał gorąco–zimno w karcie termometru.
   Model sauny (Kopenhaga / Hanko / Bergen) zmienia bryłę, przeszklenie
   i wymiar. Zwykły skrypt + dynamiczny import (import map w <head>),
   żeby strona działała też otwarta prosto z dysku (file://).
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
    // brak sieci / CDN — kroki i termometr działają dalej, zamiast 3D zdjęcie
  }
  init();
}

function init() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- UI ----------
  const stepEls = [...document.querySelectorAll('.wow__step')];
  const hudEls = [...stage.querySelectorAll('[data-hud]')];
  const rail = document.getElementById('wow-rail');
  const tagEls = [...stage.querySelectorAll('.layer-tag')];
  const modelWrap = document.getElementById('sauna-model');
  const modelBtns = modelWrap ? [...modelWrap.querySelectorAll('button')] : [];
  const card = document.getElementById('temp-card');
  const tEl = card ? Object.fromEntries([...card.querySelectorAll('[data-t]')].map((el) => [el.dataset.t, el])) : {};
  const zoneRows = card ? [...card.querySelectorAll('.spec[data-zone]')] : [];
  const mark = document.getElementById('temp-mark');
  const frontB = document.getElementById('tag-front-b');
  const frontS = document.getElementById('tag-front-s');

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (x, k, dt) => x * Math.exp(-k * dt);
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const fmtDec = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---------- Modele saun (wymiary poglądowe) ----------
  const MODELS = [
    { name: 'Kopenhaga', W: 2.2, D: 2.0, H: 2.3, front: ['Przeszklony front', 'widok na ogród z ławy'] },
    { name: 'Hanko', W: 2.0, D: 2.0, H: 2.3, front: ['Drzwi z okiem-bulajem', 'klasyka, więcej prywatności'] },
    { name: 'Bergen', W: 2.6, D: 2.2, H: 2.35, front: ['Szkło z dwóch stron', 'narożnik jak z katalogu'] },
  ];

  // ---------- Oś czasu (p = postęp przewijania 0…1, cztery kroki po 0,25) ----------
  const boardsAt = (p) => smoothstep(0.0, 0.13, p);
  const roofAt = (p) => smoothstep(0.115, 0.155, p);
  const glassAt = (p) => smoothstep(0.145, 0.18, p);
  const heatAt = (p) => smoothstep(0.16, 0.245, p);
  const deckAt = (p) => smoothstep(0.255, 0.34, p);
  const tubAt = (p) => smoothstep(0.32, 0.385, p);
  const fillAt = (p) => smoothstep(0.375, 0.455, p);
  const tubHotAt = (p) => smoothstep(0.4, 0.49, p);
  const iceAt = (p) => smoothstep(0.52, 0.585, p);
  const coldAt = (p) => smoothstep(0.58, 0.68, p);
  const duskAt = (p) => smoothstep(0.76, 0.9, p);
  const fireAt = (p) => smoothstep(0.8, 0.88, p);
  const lightsAt = (p) => smoothstep(0.82, 0.92, p);

  const state = { progress: 0, step: -1, visible: false, inView: false, model: 0, override: null };

  const readProgress = () => {
    if (state.override !== null) return state.override;
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // ---------- Termometr ----------
  const temp = { shown: 20, label: '', now: -1 };
  const RITUAL = [
    { zone: 0, label: 'Rytuał: sauna · 12 min', t: 90 },
    { zone: 2, label: 'Rytuał: wanna lodowa · 1 min', t: 4 },
    { zone: 1, label: 'Rytuał: jacuzzi · 15 min', t: 38 },
  ];
  const tempGoal = (p, time) => {
    const m = MODELS[state.model];
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    if (step === 0) return { zone: 0, label: `Sauna ${m.name}`, t: 20 + 70 * heatAt(p) };
    if (step === 1) return { zone: 1, label: 'Jacuzzi', t: 14 + 24 * tubHotAt(p) };
    if (step === 2) return { zone: 2, label: 'Wanna lodowa', t: 16 - 12 * coldAt(p) };
    const r = RITUAL[Math.floor((reduceMotion ? 0 : time) / 2.6) % RITUAL.length];
    return r;
  };
  const tempColor = (t) => (t >= 60 ? '#d81b4c' : t >= 30 ? '#c8641a' : t <= 10 ? '#2a93ad' : 'var(--ink)');
  const setTemp = (p, time, dt) => {
    const g = tempGoal(p, time);
    temp.shown = reduceMotion || dt === 0 ? g.t : g.t + ease(temp.shown - g.t, 7, dt);
    if (Math.abs(temp.shown - g.t) < 0.05) temp.shown = g.t;
    const shown = Math.round(temp.shown);
    if (tEl.num && tEl.num.textContent !== String(shown)) tEl.num.textContent = String(shown);
    if (tEl.label && temp.label !== g.label) {
      temp.label = g.label;
      tEl.label.textContent = g.label;
    }
    if (card) card.style.setProperty('--temp-c', tempColor(temp.shown));
    if (mark) mark.style.left = `${clamp01(temp.shown / 100) * 100}%`;
    if (temp.now !== g.zone) {
      temp.now = g.zone;
      zoneRows.forEach((r) => r.classList.toggle('is-now', r.dataset.zone === String(g.zone)));
    }
  };
  const ZONES = [
    { on: (p) => heatAt(p) > 0.5, text: '90 °C' },
    { on: (p) => p >= 0.42, text: '38 °C' },
    { on: (p) => p >= 0.62, text: '4 °C' },
  ];
  const zoneState = [null, null, null];
  const syncZones = (p) => {
    ZONES.forEach((z, i) => {
      const on = z.on(p);
      if (zoneState[i] === on) return;
      zoneState[i] = on;
      const row = zoneRows.find((r) => r.dataset.zone === String(i));
      if (!row) return;
      row.classList.toggle('is-on', on);
      row.classList.toggle('is-locked', !on);
      const b = row.querySelector('b');
      b.textContent = on ? z.text : '—';
      if (on && !reduceMotion) {
        b.classList.remove('is-pop');
        void b.offsetWidth;
        b.classList.add('is-pop');
      }
    });
  };

  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    if (rail) rail.style.transform = `scaleY(${p})`;
    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', el.dataset.hud.split(',').map(Number).includes(step)));
      stage.classList.toggle('is-final', step === 3);
    }
    syncZones(p);
    const d = duskAt(p);
    stage.style.setProperty('--dusk', d.toFixed(3));
    stage.classList.toggle('is-dusk', d > 0.5);
  };

  let scrollQueued = false;
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      state.progress = readProgress();
      syncUI();
      if (!THREE || stage.classList.contains('no-webgl')) setTemp(state.progress, performance.now() / 1000, 0);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  let onModel = null;
  const setModel = (i) => {
    state.model = i;
    modelBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    modelWrap && modelWrap.style.setProperty('--i', i);
    const m = MODELS[i];
    if (frontB) frontB.textContent = m.front[0];
    if (frontS) frontS.textContent = m.front[1];
    if (tEl.size) tEl.size.textContent = `${fmtDec(m.W)} × ${fmtDec(m.D)} m`;
    temp.label = '';
    onModel && onModel(i);
  };
  modelBtns.forEach((b, i) => b.addEventListener('click', () => setModel(i)));
  setModel(0);
  state.progress = readProgress();
  syncUI();
  setTemp(state.progress, 0, 0);

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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.3, 200);
  const target = new THREE.Vector3();

  const hemi = new THREE.HemisphereLight('#fff4e4', '#6d7f52', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd9a8', 2.4);
  sun.position.set(9, 11, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const saunaLight = new THREE.PointLight('#ffae5c', 0, 6, 1.6);
  const tubLight = new THREE.PointLight('#5fd6ff', 0, 5, 1.6);
  const fireLight = new THREE.PointLight('#ff8a2a', 0, 7, 1.6);
  scene.add(saunaLight, tubLight, fireLight);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeCanvas = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  };
  const toTex = (c, repeat = true) => {
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const rand = (() => {
    let s = 11;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // Słoje drewna (pionowe deski sauny i poziome deski tarasu)
  const grain = (base, dark, w, h, vertical) =>
    makeCanvas(w, h, (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `${dark}${(0.08 + rand() * 0.14).toFixed(2)})`;
        g.lineWidth = 0.6 + rand() * 1.6;
        g.beginPath();
        const o = rand() * (vertical ? w : h);
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const wob = Math.sin(t * 6 + o) * 1.6 + Math.sin(t * 17 + o * 3) * 0.6;
          if (vertical) {
            const x = o + wob;
            k ? g.lineTo(x, t * h) : g.moveTo(x, 0);
          } else {
            const y = o + wob;
            k ? g.lineTo(t * w, y) : g.moveTo(0, y);
          }
        }
        g.stroke();
      }
      for (let i = 0; i < 3; i++) {
        g.fillStyle = `${dark}0.25)`;
        g.beginPath();
        g.ellipse(rand() * w, rand() * h, 2 + rand() * 3, 4 + rand() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
  const boardTex = toTex(grain('#ddb98c', 'rgba(120,78,40,', 64, 512, true));
  const deckTex = toTex(grain('#8b5d3d', 'rgba(50,28,14,', 512, 64, false));
  const benchTex = toTex(grain('#e9cfa6', 'rgba(140,96,50,', 512, 64, false));

  // Trawa
  const lawnTex = toTex(
    makeCanvas(256, 256, (g, w, h) => {
      g.fillStyle = '#6f9a4c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        const v = rand();
        g.fillStyle = v > 0.6 ? 'rgba(150,190,96,0.35)' : v > 0.3 ? 'rgba(70,110,50,0.35)' : 'rgba(120,150,70,0.3)';
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 2 + rand() * 3);
      }
    })
  );
  lawnTex.repeat.set(6, 4);

  // Przekrój gruntu pod trawą
  const soilTex = toTex(
    makeCanvas(256, 128, (g, w, h) => {
      g.fillStyle = '#5c7f3c';
      g.fillRect(0, 0, w, h * 0.12);
      g.fillStyle = '#6a5038';
      g.fillRect(0, h * 0.12, w, h * 0.38);
      g.fillStyle = '#8c6a48';
      g.fillRect(0, h * 0.5, w, h * 0.5);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${rand() > 0.5 ? '255,240,220' : '40,25,12'},${0.08 + rand() * 0.15})`;
        g.beginPath();
        g.arc(rand() * w, h * 0.15 + rand() * h * 0.85, 0.5 + rand() * 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }),
    false
  );

  // Żwir pod kominkiem
  const gravelTex = toTex(
    makeCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#c9c3b8';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const v = 150 + rand() * 90;
        g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        g.beginPath();
        g.arc(rand() * w, rand() * h, 0.6 + rand() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
    })
  );
  gravelTex.repeat.set(2, 2);

  // Panele obudowy jacuzzi
  const cabinetTex = toTex(
    makeCanvas(256, 64, (g, w, h) => {
      g.fillStyle = '#6f7275';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x, 0, 2, h);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(x + 2, 0, 2, h);
      }
    })
  );
  cabinetTex.repeat.set(3, 1);

  // Kratka agregatu wanny lodowej
  const ventTex = toTex(
    makeCanvas(64, 64, (g, w, h) => {
      g.fillStyle = '#1e2124';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#34393d';
      for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) g.fillRect(x, y, 4, 4);
    })
  );
  ventTex.repeat.set(3, 3);

  // Miękki kłąb pary / mgły i płomień
  const puffTex = toTex(
    makeCanvas(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    false
  );
  const flameTex = toTex(
    makeCanvas(64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.55);
      gr.addColorStop(0, 'rgba(255,250,210,1)');
      gr.addColorStop(0.25, 'rgba(255,200,90,0.95)');
      gr.addColorStop(0.6, 'rgba(255,110,30,0.55)');
      gr.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.bezierCurveTo(w * 0.95, h * 0.45, w, h * 0.8, w / 2, h);
      g.bezierCurveTo(0, h * 0.8, w * 0.05, h * 0.45, w / 2, 0);
      g.fill();
    }),
    false
  );
  const blobTex = toTex(
    makeCanvas(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(60,40,20,0.36)');
      gr.addColorStop(0.55, 'rgba(60,40,20,0.14)');
      gr.addColorStop(1, 'rgba(60,40,20,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    false
  );

  // ---------- Materiały ----------
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const boardMat = std({ map: boardTex, roughness: 0.78 });
  const benchMat = std({ map: benchTex, roughness: 0.7 });
  const deckMat = std({ map: deckTex, roughness: 0.82 });
  const roofMat = std({ color: '#2d2c2b', roughness: 0.6, metalness: 0.2 });
  const frameMat = std({ color: '#1f1f1f', roughness: 0.45, metalness: 0.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#c7d6dc', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false });
  const stoneMat = std({ color: '#55524f', roughness: 0.9, flatShading: true, emissive: '#ff5a1a', emissiveIntensity: 0 });
  const heaterMat = std({ color: '#26282a', roughness: 0.5, metalness: 0.5 });
  const lawnMat = std({ map: lawnTex, roughness: 1 });
  const soilMat = std({ map: soilTex, roughness: 1 });
  const hedgeMat = std({ color: '#4d7a44', roughness: 1, flatShading: true });
  const leafMat = std({ color: '#8fb35a', roughness: 1, flatShading: true });
  const pineMat = std({ color: '#2f5a37', roughness: 1, flatShading: true });
  const birchMat = std({ color: '#efece6', roughness: 0.8 });
  const trunkMat = std({ color: '#6a4c35', roughness: 1 });
  const stoneSlabMat = std({ color: '#b9b4ab', roughness: 0.9 });
  const gravelMat = std({ map: gravelTex, roughness: 1 });
  const cabinetMat = std({ map: cabinetTex, roughness: 0.7 });
  const shellMat = std({ color: '#f4f6f7', roughness: 0.25, metalness: 0.05 });
  const basinMat = std({ color: '#bfe8f3', roughness: 0.3 });
  const waterMat = std({ color: '#3fc6ea', transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.05, emissive: '#1fb4e8', emissiveIntensity: 0, depthWrite: false });
  const iceBodyMat = std({ color: '#1d1f22', roughness: 0.35, metalness: 0.6 });
  const iceWaterMat = std({ color: '#2b6f7c', transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.2, emissive: '#3fadc7', emissiveIntensity: 0, depthWrite: false });
  const cubeMat = std({ color: '#eaf8fc', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
  const ventMat = std({ map: ventTex, roughness: 0.8 });
  const bowlMat = std({ color: '#1b1b1b', roughness: 0.5, metalness: 0.6 });
  const bollardMat = std({ color: '#2a2a2a', roughness: 0.6 });
  const bollardLampMat = std({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 0, roughness: 0.4 });
  const chairMat = std({ color: '#efe9e0', roughness: 0.8 });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const steamMat = new THREE.SpriteMaterial({ map: puffTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const mistMat = new THREE.SpriteMaterial({ map: puffTex, color: '#cfeff7', transparent: true, opacity: 0, depthWrite: false });
  const flameMat = new THREE.SpriteMaterial({ map: flameTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });

  const shadowed = (m, cast = true, recv = true) => {
    m.castShadow = cast;
    m.receiveShadow = recv;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  const cyl = (rt, rb, h, mat, seg = 24) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
  const place = (m, x, y, z) => {
    m.position.set(x, y, z);
    return m;
  };
  const C = (h) => new THREE.Color(h);

  const site = new THREE.Group();
  scene.add(site);

  // ---------- Ogród ----------
  const GX = 8; // połowa szerokości działki
  const GZ = 5.4; // połowa głębokości
  const lawn = place(shadowed(new THREE.Mesh(new THREE.BoxGeometry(GX * 2, 0.12, GZ * 2), [soilMat, soilMat, lawnMat, soilMat, soilMat, soilMat]), false, true), 0, -0.06, 0);
  const base = place(shadowed(new THREE.Mesh(new THREE.BoxGeometry(GX * 2, 1.0, GZ * 2), soilMat), false, true), 0, -0.62, 0);
  site.add(lawn, base);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(GX * 2.9, GZ * 3.1), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -1.13;
  site.add(blob);

  // Żywopłot z tyłu działki
  const hedgeGeo = new THREE.IcosahedronGeometry(0.62, 1);
  const HEDGE = 34;
  const hedge = shadowed(new THREE.InstancedMesh(hedgeGeo, hedgeMat, HEDGE));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const hedgeCol = new THREE.Color();
  for (let i = 0; i < HEDGE; i++) {
    const row = i % 2;
    const x = -GX + 0.5 + (i / (HEDGE - 1)) * (GX * 2 - 1);
    pos.set(x, 0.85 + row * 0.55 + rand() * 0.2, -GZ + 0.55 + row * 0.12);
    sc.set(1.05 + rand() * 0.2, 1.25 + rand() * 0.25, 0.9);
    q.setFromEuler(new THREE.Euler(rand(), rand() * 3, rand()));
    hedge.setMatrixAt(i, m4.compose(pos, q, sc));
    hedgeCol.set('#4d7a44').offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
    hedge.setColorAt(i, hedgeCol);
  }
  site.add(hedge);

  // Drzewa: dwie brzozy i świerk
  const makeBirch = (s) => {
    const g = new THREE.Group();
    const trunk = cyl(0.09 * s, 0.13 * s, 3.4 * s, birchMat, 10);
    trunk.position.y = 1.7 * s;
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const mark = place(box(0.2 * s, 0.035, 0.2 * s, std({ color: '#2b2b2b', roughness: 1 })), 0, (0.6 + i * 0.55) * s, 0);
      mark.scale.set(1.02, 1, 1.02);
      g.add(mark);
    }
    [[0, 3.7, 0, 1.1], [0.55, 3.2, 0.25, 0.8], [-0.5, 3.0, -0.2, 0.75], [0.15, 4.25, -0.15, 0.7]].forEach(([x, y, z, r]) => {
      const c = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leafMat));
      c.position.set(x * s, y * s, z * s);
      g.add(c);
    });
    return g;
  };
  const makePine = (s) => {
    const g = new THREE.Group();
    const trunk = place(cyl(0.1 * s, 0.14 * s, 0.8 * s, trunkMat, 8), 0, 0.4 * s, 0);
    g.add(trunk);
    [[1.3, 1.8, 1.2], [1.05, 1.6, 2.1], [0.75, 1.3, 2.9]].forEach(([r, h, y]) => {
      const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), pineMat));
      c.position.y = y * s;
      g.add(c);
    });
    return g;
  };
  const birchA = makeBirch(1);
  birchA.position.set(6.6, 0, -3.7);
  const birchB = makeBirch(0.85);
  birchB.position.set(-7.1, 0, 3.7);
  const pine = makePine(1.05);
  pine.position.set(-7.0, 0, -3.9);
  site.add(birchA, birchB, pine);

  // Ścieżka z płyt i oprawy
  const slabs = [];
  [[1.6, 4.9], [1.25, 4.15], [0.85, 3.4]].forEach(([x, z], i) => {
    const s = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), stoneSlabMat), false, true);
    s.scale.set(1.35, 1, 0.9);
    s.rotation.y = i * 0.4;
    s.position.set(x, 0.02, z);
    site.add(s);
    slabs.push(s);
  });
  const bollards = [[2.4, 4.6], [0.1, 3.9], [5.2, 2.4], [-1.9, 2.0]].map(([x, z]) => {
    const b = place(cyl(0.06, 0.06, 0.55, bollardMat, 10), x, 0.275, z);
    const lamp = place(cyl(0.065, 0.065, 0.1, bollardLampMat, 10), 0, 0.22, 0);
    b.add(lamp);
    site.add(b);
    return b;
  });

  // ---------- Sauna ----------
  const SX = -3.7;
  const SZ = -1.6;
  const sauna = new THREE.Group();
  sauna.position.set(SX, 0, SZ);
  site.add(sauna);
  const plinth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), frameMat));
  const floor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), benchMat));
  sauna.add(plinth, floor);

  const BOARDS = 130;
  const boardGeo = new THREE.BoxGeometry(1, 1, 1);
  const boards = shadowed(new THREE.InstancedMesh(boardGeo, boardMat, BOARDS));
  boards.count = 0;
  const boardCol = new THREE.Color();
  for (let i = 0; i < BOARDS; i++) {
    boardCol.setRGB(1, 1, 1).multiplyScalar(0.9 + rand() * 0.16);
    boards.setColorAt(i, boardCol);
  }
  sauna.add(boards);
  const boardList = []; // { x, z, w, d, h, delay }

  const roof = new THREE.Group();
  const roofSlab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), roofMat));
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), benchMat);
  ceiling.rotation.x = Math.PI / 2;
  roof.add(roofSlab, ceiling);
  sauna.add(roof);

  // szkło i ramy (Kopenhaga / Bergen), drzwi z bulajem (Hanko)
  const glassGroup = new THREE.Group();
  sauna.add(glassGroup);
  const doorGroup = new THREE.Group();
  sauna.add(doorGroup);

  // wnętrze: ławy, LED, piec
  const interior = new THREE.Group();
  sauna.add(interior);
  const benchLow = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), benchMat));
  const benchHigh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), benchMat));
  const ledLow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ledMat);
  const ledHigh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ledMat);
  const backrest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), benchMat));
  const heater = new THREE.Group();
  const heaterBody = box(0.42, 0.62, 0.36, heaterMat);
  heaterBody.position.y = 0.31;
  heater.add(heaterBody);
  const STONES = 26;
  const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), stoneMat, STONES);
  for (let i = 0; i < STONES; i++) {
    pos.set((rand() - 0.5) * 0.34, 0.66 + rand() * 0.12, (rand() - 0.5) * 0.28);
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    stones.setMatrixAt(i, m4.compose(pos, q, sc.setScalar(0.8 + rand() * 0.6)));
  }
  heater.add(stones);
  interior.add(benchLow, benchHigh, ledLow, ledHigh, backrest, heater);

  const buildSauna = (m) => {
    const { W, D, H } = m;
    const T = 0.06; // grubość ściany
    plinth.scale.set(W + 0.1, 0.16, D + 0.1);
    plinth.position.set(0, 0.08, 0);
    floor.scale.set(W - 0.02, 0.05, D - 0.02);
    floor.position.set(0, 0.185, 0);
    const y0 = 0.16;
    // deski: tył, boki, przód (bez przeszkleń i drzwi)
    boardList.length = 0;
    const bw = 0.125;
    const run = (x0, x1, z, alongX, skip) => {
      const len = Math.abs(x1 - x0);
      const n = Math.round(len / bw);
      const step = len / n;
      for (let i = 0; i < n; i++) {
        const c = Math.min(x0, x1) + step * (i + 0.5);
        if (skip && skip(c)) continue;
        boardList.push(alongX ? { x: c, z, w: step * 0.97, d: T, h: H - y0 } : { x: z, z: c, w: T, d: step * 0.97, h: H - y0 });
      }
    };
    run(-W / 2, W / 2, -D / 2 + T / 2, true); // tył
    run(-D / 2, D / 2, -W / 2 + T / 2, false); // lewy bok
    if (state.model !== 2) run(-D / 2, D / 2, W / 2 - T / 2, false); // prawy bok (Bergen: szkło)
    if (state.model === 0) run(-W / 2, W / 2, D / 2 - T / 2, true, (x) => x < W / 2 - 0.5); // Kopenhaga: drewno tylko po prawej
    if (state.model === 1) run(-W / 2, W / 2, D / 2 - T / 2, true, (x) => Math.abs(x) < 0.38); // Hanko: otwór na drzwi
    boardList.forEach((b, i) => (b.delay = i / boardList.length));
    boards.count = boardList.length;
    lastBoards = -1;

    roofSlab.scale.set(W + 0.42, 0.16, D + 0.5);
    roofSlab.position.set(0, 0.08, 0.12);
    ceiling.scale.set(W - 0.1, D - 0.1, 1);
    ceiling.position.set(0, -0.005, 0);
    roof.userData.y = H;

    // szkło
    glassGroup.clear();
    doorGroup.clear();
    const pane = (w, h, x, y, z, rotY = 0) => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), glassMat);
      p.renderOrder = 6;
      g.add(p);
      const fw = 0.035;
      g.add(place(box(w, fw, 0.05, frameMat), 0, h / 2, 0), place(box(w, fw, 0.05, frameMat), 0, -h / 2, 0));
      g.add(place(box(fw, h, 0.05, frameMat), -w / 2, 0, 0), place(box(fw, h, 0.05, frameMat), w / 2, 0, 0));
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      glassGroup.add(g);
      return g;
    };
    const gh = H - y0 - 0.02;
    const gy = y0 + gh / 2;
    if (state.model === 0) {
      const gw = W - 0.5;
      pane(gw * 0.48, gh, -W / 2 + gw * 0.24, gy, D / 2 - 0.03);
      const door = pane(gw * 0.5, gh, -W / 2 + gw * 0.75, gy, D / 2 - 0.01);
      door.add(place(box(0.03, 0.7, 0.06, frameMat), gw * 0.2, 0, 0.05));
    } else if (state.model === 2) {
      pane(W * 0.5, gh, -W / 4, gy, D / 2 - 0.03);
      const door = pane(W * 0.48, gh, W / 4, gy, D / 2 - 0.01);
      door.add(place(box(0.03, 0.7, 0.06, frameMat), -W * 0.18, 0, 0.05));
      pane(D - 0.06, gh, W / 2 - 0.03, gy, 0, Math.PI / 2);
    } else {
      // Hanko: drewniane drzwi z okrągłym oknem
      const door = new THREE.Group();
      const dw = 0.76;
      for (let i = 0; i < 6; i++) door.add(place(shadowed(new THREE.Mesh(new THREE.BoxGeometry(dw / 6 - 0.006, gh, 0.05), boardMat)), -dw / 2 + (i + 0.5) * (dw / 6), 0, 0));
      const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 10, 32), frameMat));
      ring.position.set(0, 0.32, 0.03);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), glassMat);
      hole.position.set(0, 0.32, 0.031);
      door.add(ring, hole, place(box(0.03, 0.5, 0.06, frameMat), dw / 2 - 0.1, -0.1, 0.05));
      door.position.set(0, gy, D / 2 - 0.02);
      doorGroup.add(door);
      // małe okno w boku
      pane(0.5, 0.8, W / 2 - 0.02, 1.45, -0.2, Math.PI / 2);
    }

    // wnętrze
    const bd = 0.5;
    benchHigh.scale.set(W - 0.16, 0.05, bd);
    benchHigh.position.set(0, 1.05, -D / 2 + 0.08 + bd / 2);
    benchLow.scale.set(W - 0.7, 0.05, 0.42);
    benchLow.position.set(0.25, 0.6, -D / 2 + 0.08 + bd + 0.21);
    ledHigh.scale.set(W - 0.2, 0.015, 0.015);
    ledHigh.position.set(0, 1.015, -D / 2 + 0.08 + bd - 0.03);
    ledLow.scale.set(W - 0.74, 0.015, 0.015);
    ledLow.position.set(0.25, 0.565, -D / 2 + 0.08 + bd + 0.39);
    backrest.scale.set(W - 0.16, 0.08, 0.04);
    backrest.position.set(0, 1.45, -D / 2 + 0.1);
    heater.position.set(-W / 2 + 0.36, 0.2, D / 2 - 0.42);
    saunaLight.userData.local = new THREE.Vector3(0, 1.4, 0);
  };

  // ---------- Taras ----------
  const DX0 = -1.5;
  const DX1 = 5.0;
  const DZ0 = -3.0;
  const DZ1 = 1.9;
  const PLANK = 0.15;
  const PLANKS = Math.round((DZ1 - DZ0) / PLANK);
  const planks = shadowed(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), deckMat, PLANKS));
  const plankCol = new THREE.Color();
  for (let i = 0; i < PLANKS; i++) {
    plankCol.setRGB(1, 1, 1).multiplyScalar(0.86 + rand() * 0.22);
    planks.setColorAt(i, plankCol);
  }
  site.add(planks);
  const deckFrame = place(box(DX1 - DX0, 0.1, DZ1 - DZ0, std({ color: '#4a3527', roughness: 0.9 })), (DX0 + DX1) / 2, 0.05, (DZ0 + DZ1) / 2);
  site.add(deckFrame);
  const DECK_Y = 0.13;

  // ---------- Jacuzzi ----------
  const TUB = { x: 1.55, z: -0.7, s: 2.2, h: 0.92 };
  const tub = new THREE.Group();
  const cabinet = place(box(TUB.s, TUB.h, TUB.s, cabinetMat), 0, TUB.h / 2, 0);
  const rimW = 0.22;
  const rims = [
    place(box(TUB.s + 0.04, 0.08, rimW, shellMat), 0, TUB.h + 0.04, -TUB.s / 2 + rimW / 2),
    place(box(TUB.s + 0.04, 0.08, rimW, shellMat), 0, TUB.h + 0.04, TUB.s / 2 - rimW / 2),
    place(box(rimW, 0.08, TUB.s - rimW * 2, shellMat), -TUB.s / 2 + rimW / 2, TUB.h + 0.04, 0),
    place(box(rimW, 0.08, TUB.s - rimW * 2, shellMat), TUB.s / 2 - rimW / 2, TUB.h + 0.04, 0),
  ];
  const basin = place(new THREE.Mesh(new THREE.BoxGeometry(TUB.s - rimW * 2, 0.02, TUB.s - rimW * 2), basinMat), 0, TUB.h - 0.62, 0);
  const tubWater = new THREE.Mesh(new THREE.BoxGeometry(TUB.s - rimW * 2, 1, TUB.s - rimW * 2), waterMat);
  tubWater.renderOrder = 5;
  const headrests = [-1, 1].map((sx) => place(box(0.32, 0.1, 0.16, std({ color: '#3b3f44', roughness: 0.6 })), sx * 0.5, TUB.h + 0.1, -TUB.s / 2 + 0.16));
  const steps = place(box(0.9, 0.3, 0.5, cabinetMat), 0.2, 0.15, TUB.s / 2 + 0.25);
  tub.add(cabinet, ...rims, basin, tubWater, ...headrests, steps);
  tub.position.set(TUB.x, DECK_Y, TUB.z);
  site.add(tub);
  const BUB = 60;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), std({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.2 }), BUB);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 7;
  tub.add(bubbles);
  const bubSeed = Array.from({ length: BUB }, () => [rand() - 0.5, rand() - 0.5, rand(), 0.015 + rand() * 0.025]);

  // ---------- Wanna lodowa ----------
  const ICE = { x: 4.0, z: 1.05, l: 1.6, w: 0.72, h: 0.74 };
  const ice = new THREE.Group();
  const iceBody = new THREE.Group();
  const wall = (w, h, d, x, y, z) => iceBody.add(place(box(w, h, d, iceBodyMat), x, y, z));
  wall(ICE.l, ICE.h, 0.05, 0, ICE.h / 2, -ICE.w / 2 + 0.025);
  wall(ICE.l, ICE.h, 0.05, 0, ICE.h / 2, ICE.w / 2 - 0.025);
  wall(0.05, ICE.h, ICE.w, -ICE.l / 2 + 0.025, ICE.h / 2, 0);
  wall(0.05, ICE.h, ICE.w, ICE.l / 2 - 0.025, ICE.h / 2, 0);
  wall(ICE.l, 0.05, ICE.w, 0, 0.025, 0);
  const chiller = place(box(0.42, 0.62, ICE.w, ventMat), ICE.l / 2 + 0.24, 0.31, 0);
  const iceWater = new THREE.Mesh(new THREE.BoxGeometry(ICE.l - 0.1, 1, ICE.w - 0.1), iceWaterMat);
  iceWater.renderOrder = 5;
  ice.add(iceBody, chiller, iceWater);
  ice.position.set(ICE.x, DECK_Y, ICE.z);
  site.add(ice);
  const CUBES = 16;
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cubeMat, CUBES);
  cubes.frustumCulled = false;
  cubes.renderOrder = 7;
  ice.add(cubes);
  const cubeSeed = Array.from({ length: CUBES }, () => [(rand() - 0.5) * (ICE.l - 0.3), (rand() - 0.5) * (ICE.w - 0.25), rand() * 6, 0.08 + rand() * 0.06, rand() * 3]);

  // ---------- Kominek ogrodowy na żwirze ----------
  const FIRE = { x: -0.6, z: 3.2 };
  const fire = new THREE.Group();
  const gravel = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.04, 40), gravelMat), false, true);
  gravel.position.y = 0.02;
  const leg = place(cyl(0.05, 0.08, 0.5, bowlMat, 12), 0, 0.27, 0);
  const bowl = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat));
  bowl.position.y = 0.95;
  bowl.material = bowlMat.clone();
  bowl.material.side = THREE.DoubleSide;
  const logs = [0, 1, 2].map((i) => {
    const l = cyl(0.05, 0.05, 0.55, trunkMat, 8);
    l.rotation.set(Math.PI / 2, 0, (i / 3) * Math.PI);
    l.position.y = 0.66;
    return l;
  });
  fire.add(gravel, leg, bowl, ...logs);
  const flames = Array.from({ length: 7 }, (_, i) => {
    const f = new THREE.Sprite(flameMat);
    f.userData.ph = i * 1.7;
    f.userData.ox = (rand() - 0.5) * 0.32;
    f.userData.oz = (rand() - 0.5) * 0.32;
    fire.add(f);
    return f;
  });
  const chairs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.add(place(box(0.62, 0.12, 0.62, chairMat), 0, 0.36, 0));
    const back = place(box(0.62, 0.62, 0.1, chairMat), 0, 0.68, -0.28);
    back.rotation.x = -0.25;
    g.add(back);
    [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]].forEach(([x, z]) => g.add(place(box(0.05, 0.36, 0.05, bollardMat), x, 0.18, z)));
    g.position.set(sx * 1.2, 0, 0.35);
    g.rotation.y = -sx * 1.2;
    fire.add(g);
    return g;
  });
  void chairs;
  fire.position.set(FIRE.x, 0, FIRE.z);
  site.add(fire);

  // ---------- Para i mgła (sprite'y) ----------
  const makePuffs = (n, mat, group) =>
    Array.from({ length: n }, () => {
      const s = new THREE.Sprite(mat.clone());
      s.userData = { life: rand(), dur: 3 + rand() * 3, ox: 0, oz: 0 };
      s.renderOrder = 9;
      group.add(s);
      return s;
    });
  const steamGroup = new THREE.Group();
  site.add(steamGroup);
  const steam = makePuffs(16, steamMat, steamGroup);
  const mist = makePuffs(12, mistMat, steamGroup);
  const saunaSteam = makePuffs(8, steamMat, steamGroup);

  // ---------- Model sauny: przebudowa + pojawianie ----------
  let lastBoards = -1;
  let modelPop = 1;
  onModel = () => {
    buildSauna(MODELS[state.model]);
    modelPop = reduceMotion ? 1 : 0;
    tagState.forEach((st) => (st.w = 0));
    kick();
  };

  // ---------- Kamera ----------
  const SHOTS = [
    { th: 0.5, ph: 0.24, r: 9.6, t: [SX + 0.3, 1.55, SZ + 0.2] },
    { th: 0.22, ph: 0.46, r: 11, t: [1.3, 0.5, -0.2] },
    { th: 0.5, ph: 0.4, r: 9.2, t: [3.1, 0.5, 0.5] },
    { th: 0.36, ph: 0.4, r: 19.5, t: [-0.2, 0.2, 0.2] },
  ];
  const shotAt = (p) => {
    const k1 = smoothstep(0.24, 0.32, p);
    const k2 = smoothstep(0.49, 0.56, p);
    const k3 = smoothstep(0.73, 0.83, p);
    const mix = (get) => lerp(lerp(lerp(get(SHOTS[0]), get(SHOTS[1]), k1), get(SHOTS[2]), k2), get(SHOTS[3]), k3);
    return { th: mix((s) => s.th), ph: mix((s) => s.ph), r: mix((s) => s.r), t: [0, 1, 2].map((i) => mix((s) => s.t[i])) };
  };
  const anim = { th: 0.5, ph: 0.26, r: 10.5, tx: SX, ty: 1, tz: SZ, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0 };
  let settle = false;
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
      anim.yawUser -= dx * 0.006;
      anim.yawVel = ((-dx * 0.006) / Math.max(now - lastT, 1)) * 1000;
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

  let stageW = 1;
  let stageH = 1;
  let aspectK = 1;

  // ---------- Etykiety (rzut 3D → 2D) z omijaniem karty ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const TAGS = {
    front: { steps: [0], pos: () => V(SX + MODELS[state.model].W / 2, 1.5, SZ + MODELS[state.model].D / 2), a: (p) => smoothstep(0.15, 0.19, p) },
    heater: { steps: [0], side: 'left', pos: () => V(SX - MODELS[state.model].W / 2 + 0.36, 0.95, SZ + MODELS[state.model].D / 2 - 0.42), a: (p) => smoothstep(0.17, 0.21, p) },
    deck: { steps: [1], side: 'left', pos: () => V(DX0 + 0.2, DECK_Y, DZ1), a: (p) => smoothstep(0.3, 0.34, p) },
    tub: { steps: [1], pos: () => V(TUB.x + TUB.s / 2, DECK_Y + TUB.h + 0.1, TUB.z), a: (p) => smoothstep(0.39, 0.43, p) },
    ice: { steps: [2], pos: () => V(ICE.x + ICE.l / 2 + 0.45, DECK_Y + ICE.h, ICE.z), a: (p) => smoothstep(0.57, 0.61, p) },
    fire: { steps: [3], side: 'left', pos: () => V(FIRE.x - 0.4, 1.0, FIRE.z), a: (p) => fireAt(p) },
  };
  const tagState = tagEls.map(() => ({ a: 0, w: 0 }));
  const _v = new THREE.Vector3();
  let cardBox = null;
  const measureCard = () => {
    tagState.forEach((st) => (st.w = 0));
    if (!card) return;
    const a = stage.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    cardBox = { l: b.left - a.left - 8, r: b.right - a.left + 8, t: b.top - a.top - 8, b: b.bottom - a.top + 8 };
  };
  const hitsCard = (x, y, w) => cardBox && x + w > cardBox.l && x < cardBox.r && y + 16 > cardBox.t && y - 16 < cardBox.b;
  const placeTags = (p, step, dt, introA) => {
    tagEls.forEach((el, k) => {
      const t = TAGS[el.dataset.tag];
      if (!t) return;
      const st = tagState[k];
      const goal = t.steps.includes(step) ? t.a(p) * introA : 0;
      st.a = settle ? goal : goal + ease(st.a - goal, 10, dt);
      if (st.a < 0.01) {
        el.style.opacity = '0';
        return;
      }
      _v.copy(t.pos()).applyMatrix4(site.matrixWorld).project(camera);
      if (!st.w) st.w = el.offsetWidth || 180;
      const ax = (_v.x * 0.5 + 0.5) * stageW;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      const put = (side) => (side === 'left' ? Math.max(ax - st.w - 4, 8) : Math.min(ax + 4, stageW - st.w - 8));
      let side = t.side || 'right';
      let x = put(side);
      if (hitsCard(x, y, st.w)) {
        const other = side === 'left' ? 'right' : 'left';
        const x2 = put(other);
        if (!hitsCard(x2, y, st.w)) {
          side = other;
          x = x2;
        }
      }
      el.classList.toggle('layer-tag--left', side === 'left');
      el.style.opacity = st.a.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    aspectK = Math.pow(1.25 / Math.min(camera.aspect, 1.25), 0.8);
    camera.updateProjectionMatrix();
    measureCard();
    kick();
  };

  // ---------- Pętla ----------
  const cDayHemi = C('#fff4e4');
  const cDuskHemi = C('#6c6fa8');
  const cDaySun = C('#ffd9a8');
  const cDuskSun = C('#ff9a6a');
  let last = performance.now();
  let raf = 0;

  const updatePuffs = (list, dt, k, src, opts) => {
    list.forEach((s) => {
      const u = s.userData;
      if (!reduceMotion) u.life += dt / u.dur;
      if (u.life >= 1) {
        u.life -= 1;
        u.ox = (rand() - 0.5) * src.sx;
        u.oz = (rand() - 0.5) * src.sz;
      }
      const l = u.life;
      const a = Math.sin(Math.PI * l) * opts.alpha * k;
      s.visible = a > 0.005;
      if (!s.visible) return;
      s.material.opacity = a;
      const sz = opts.size * (0.6 + l * opts.grow);
      s.scale.set(sz, sz, 1);
      s.position.set(src.x + u.ox + l * opts.drift, src.y + l * opts.rise, src.z + u.oz + l * opts.driftZ);
    });
  };

  const frame = (now) => {
    raf = 0;
    const dt = settle ? 10 : Math.min((now - last) / 1000, 0.1);
    last = now;
    const t = now / 1000;
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    const m = MODELS[state.model];

    // Wejście: makieta wyjeżdża z dołu
    if (anim.intro < 1 && (state.inView || settle)) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = settle ? 1 : Math.min((now - anim.introStart) / 1500, 1);
    }
    const intro = easeOut(anim.intro);
    site.position.y = (1 - intro) * -3;
    site.scale.setScalar(lerp(0.92, 1, intro));

    // Sauna: deski spadają na miejsce jedna po drugiej
    modelPop = settle ? 1 : Math.min(modelPop + dt * 3, 1);
    const bk = reduceMotion ? Math.round(boardsAt(p)) : boardsAt(p);
    if (Math.abs(bk - lastBoards) > 1e-4) {
      lastBoards = bk;
      boardList.forEach((b, i) => {
        const k = easeOut((bk * 1.25 - b.delay) / 0.25);
        if (k <= 0) {
          boards.setMatrixAt(i, m4.compose(pos.set(0, -50, 0), q.identity(), sc.set(0.001, 0.001, 0.001)));
          return;
        }
        pos.set(b.x, 0.16 + b.h / 2 + (1 - k) * 2.2, b.z);
        boards.setMatrixAt(i, m4.compose(pos, q.identity(), sc.set(b.w, b.h, b.d)));
      });
      boards.instanceMatrix.needsUpdate = true;
    }
    sauna.scale.setScalar(lerp(0.96, 1, easeOut(modelPop)));
    const rk = easeOut(roofAt(p));
    roof.visible = rk > 0.001;
    roof.position.y = roof.userData.y + (1 - rk) * 1.6;
    const gk = glassAt(p);
    glassMat.opacity = 0.22 * gk;
    glassGroup.visible = gk > 0.01;
    doorGroup.visible = gk > 0.01;
    doorGroup.scale.y = Math.max(gk, 0.001);
    interior.visible = bk > 0.3;
    plinth.visible = floor.visible = bk > 0.001 || p > 0;

    // Ciepło sauny: kamienie, LED, światło w środku
    const heat = heatAt(p);
    const dusk = duskAt(p);
    stoneMat.emissiveIntensity = heat * (0.55 + (reduceMotion ? 0 : Math.sin(t * 3) * 0.12));
    ledMat.color.setRGB(1, 0.81, 0.54).multiplyScalar(0.35 + 0.65 * Math.max(heat, dusk));
    ledHigh.visible = ledLow.visible = heat > 0.02;
    _v.set(SX, 1.4, SZ);
    saunaLight.position.copy(_v).applyMatrix4(site.matrixWorld);
    saunaLight.intensity = (heat * 2.2 + dusk * 3) * (rk > 0.5 ? 1 : 0.4);

    // Taras: deski wsuwają się od lewej
    const dk = reduceMotion ? Math.round(deckAt(p)) : deckAt(p);
    planks.visible = dk > 0.001;
    deckFrame.visible = dk > 0.02;
    deckFrame.scale.y = Math.max(dk, 0.01);
    for (let i = 0; i < PLANKS; i++) {
      const k = easeOut((dk * 1.3 - i / PLANKS) / 0.3);
      const len = (DX1 - DX0) * Math.max(k, 0.001);
      pos.set(DX0 + len / 2, 0.115, DZ0 + (i + 0.5) * PLANK);
      planks.setMatrixAt(i, m4.compose(pos, q.identity(), sc.set(len, 0.035, PLANK * 0.93)));
    }
    planks.instanceMatrix.needsUpdate = true;

    // Jacuzzi: wjeżdża z góry, nalewa się, paruje
    const tk = tubAt(p);
    tub.visible = tk > 0.001;
    tub.position.y = DECK_Y + (1 - easeOut(tk)) * 2.6;
    tub.scale.setScalar(lerp(0.9, 1, easeOut(tk)));
    const fill = reduceMotion ? Math.round(fillAt(p)) : fillAt(p);
    const wh = Math.max(0.58 * fill, 0.001);
    tubWater.visible = fill > 0.01;
    tubWater.scale.y = wh;
    tubWater.position.y = TUB.h - 0.62 + wh / 2;
    const hot = tubHotAt(p);
    const lights = lightsAt(p);
    waterMat.emissiveIntensity = lights * 1.4 + fill * 0.28;
    _v.set(TUB.x, DECK_Y + 0.6, TUB.z);
    tubLight.position.copy(_v).applyMatrix4(site.matrixWorld);
    tubLight.intensity = lights * 6;
    bubbles.visible = hot > 0.05 && !reduceMotion;
    if (bubbles.visible) {
      const inner = TUB.s - rimW * 2 - 0.2;
      for (let i = 0; i < BUB; i++) {
        const [bx, bz, ph, r] = bubSeed[i];
        const u = (ph + t * 0.6) % 1;
        pos.set(bx * inner, TUB.h - 0.6 + u * wh, bz * inner);
        bubbles.setMatrixAt(i, m4.compose(pos, q.identity(), sc.setScalar(r * hot)));
      }
      bubbles.instanceMatrix.needsUpdate = true;
    }
    const tubTop = tub.position.y + TUB.h - 0.04;
    updatePuffs(steam, dt, hot * fill * (1 + dusk * 0.6), { x: TUB.x, y: tubTop, z: TUB.z, sx: 1.4, sz: 1.4 }, { alpha: 0.32, size: 0.9, grow: 1.6, rise: 1.6, drift: 0.4, driftZ: -0.2 });

    // Wanna lodowa: kostki lodu, zimna mgła
    const ik = iceAt(p);
    ice.visible = ik > 0.001;
    ice.position.y = DECK_Y + (1 - easeOut(ik)) * 2.4;
    const cold = coldAt(p);
    const iwh = Math.max((ICE.h - 0.16) * Math.min(ik * 1.2, 1), 0.001);
    iceWater.scale.y = iwh;
    iceWater.position.y = 0.05 + iwh / 2;
    iceWaterMat.emissiveIntensity = lights * 0.9;
    for (let i = 0; i < CUBES; i++) {
      const [cx, cz, ph, s, rot] = cubeSeed[i];
      const bob = reduceMotion ? 0 : Math.sin(t * 1.4 + ph) * 0.012;
      pos.set(cx, 0.05 + iwh + bob, cz);
      q.setFromEuler(new THREE.Euler(0.2 * Math.sin(ph), rot + (reduceMotion ? 0 : t * 0.05), 0.15));
      cubes.setMatrixAt(i, m4.compose(pos, q, sc.setScalar(s * cold)));
    }
    cubes.instanceMatrix.needsUpdate = true;
    cubes.visible = cold > 0.01;
    q.identity();
    updatePuffs(mist, dt, cold * ik, { x: ICE.x, y: ice.position.y + ICE.h - 0.05, z: ICE.z, sx: ICE.l * 0.8, sz: ICE.w * 0.6 }, { alpha: 0.4, size: 0.7, grow: 1.8, rise: -0.15, drift: -0.5, driftZ: 0.35 });

    // Para z sauny przez uchylone drzwi wieczorem
    updatePuffs(saunaSteam, dt, dusk * 0.6, { x: SX + m.W * 0.15, y: 2.0, z: SZ + m.D / 2 + 0.1, sx: 0.6, sz: 0.2 }, { alpha: 0.18, size: 0.6, grow: 1.4, rise: 1.2, drift: 0.3, driftZ: 0.3 });

    // Kominek i zmierzch
    const fk = fireAt(p);
    fire.visible = p > 0.74;
    fire.scale.setScalar(lerp(0.85, 1, easeOut(smoothstep(0.74, 0.8, p))));
    flameMat.opacity = fk;
    flames.forEach((f, i) => {
      const fl = reduceMotion ? 1 : 0.8 + Math.sin(t * 9 + f.userData.ph) * 0.15 + Math.sin(t * 13.7 + i) * 0.08;
      f.scale.set(0.34 * fl, 0.62 * fl * fk, 1);
      f.position.set(f.userData.ox, 0.8 + 0.3 * fl * fk, f.userData.oz);
      f.visible = fk > 0.01;
    });
    _v.set(FIRE.x, 1.2, FIRE.z);
    fireLight.position.copy(_v).applyMatrix4(site.matrixWorld);
    fireLight.intensity = fk * (5 + (reduceMotion ? 0 : Math.sin(t * 11) * 0.8));
    bollardLampMat.emissiveIntensity = lights * 5;
    renderer.toneMappingExposure = lerp(1.05, 0.5, dusk);
    hemi.intensity = lerp(0.9, 0.32, dusk);
    hemi.color.copy(cDayHemi).lerp(cDuskHemi, dusk);
    sun.intensity = lerp(2.4, 0.25, dusk);
    sun.color.copy(cDaySun).lerp(cDuskSun, dusk);

    // Termometr
    setTemp(p, t, settle ? 0 : dt);

    // Kamera
    const shot = shotAt(p);
    const k = settle ? 0 : 1;
    const r0 = shot.r * aspectK;
    const thGoal = shot.th + (1 - intro) * 0.6 + anim.px * 0.06;
    const phGoal = shot.ph - anim.py * 0.03;
    anim.th = thGoal + ease(anim.th - thGoal, 4, dt) * k;
    anim.ph = phGoal + ease(anim.ph - phGoal, 4, dt) * k;
    anim.r = r0 + ease(anim.r - r0, 4, dt) * k;
    anim.tx = shot.t[0] + ease(anim.tx - shot.t[0], 4, dt) * k;
    anim.ty = shot.t[1] + ease(anim.ty - shot.t[1], 4, dt) * k;
    anim.tz = shot.t[2] + ease(anim.tz - shot.t[2], 4, dt) * k;
    target.set(anim.tx, anim.ty, anim.tz);
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
      anim.yawUser = Math.max(Math.min(anim.yawUser, 1.2), -1.2);
    }
    const th = anim.th + anim.yawUser;
    camera.position.set(target.x + Math.sin(th) * Math.cos(anim.ph) * anim.r, target.y + Math.sin(anim.ph) * anim.r, target.z + Math.cos(th) * Math.cos(anim.ph) * anim.r);
    camera.lookAt(target);
    const narrow = stageW < 600 || stageW / stageH < 0.9;
    camera.setViewOffset(stageW, stageH, narrow ? 0 : stageW * 0.1, narrow ? stageH * 0.05 : 0, stageW, stageH);
    camera.updateMatrixWorld();
    site.updateMatrixWorld();

    placeTags(p, step, dt, smoothstep(0.7, 1, anim.intro));

    renderer.render(scene, camera);
    if (state.visible && !settle && (!reduceMotion || dragging || Math.abs(anim.yawVel) > 1e-3)) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (state.visible && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  window.addEventListener('scroll', kick, { passive: true });

  buildSauna(MODELS[state.model]);
  new ResizeObserver(resize).observe(stage);
  resize();

  new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
      document.body.classList.toggle('in-wow', entry.isIntersecting);
      kick();
    },
    { rootMargin: '200px 0px' }
  ).observe(stage);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) state.inView = true;
  }, { threshold: 0.35 }).observe(stage);

  // Uchwyt do testów i zrzutów: ustawia postęp i model, renderuje gotową klatkę
  stage._seek = (p, modelIndex) => {
    if (typeof modelIndex === 'number' && modelIndex !== state.model) setModel(modelIndex);
    state.override = p;
    state.progress = p;
    syncUI();
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    settle = true;
    frame(performance.now());
    settle = false;
  };
  stage._release = () => {
    state.override = null;
    onScroll();
  };
}
})();
