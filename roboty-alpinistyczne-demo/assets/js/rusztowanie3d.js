/* ==========================================================================
   Zajawka „Liny czy rusztowanie?” — biurowiec w 3D sterowany przewijaniem:
   brudna elewacja → rusztowanie rośnie piętro po piętrze i zamyka chodnik
   → rusztowanie znika, z dachu spadają liny, alpiniści zjeżdżają i myją
   szkło pas po pasie → czysta elewacja i porównanie obu sposobów.
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
    // brak sieci / CDN — kroki i karta porównania działają dalej, zamiast 3D zdjęcie
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
  const vsCard = document.getElementById('vs-card');
  const vsEls = Object.fromEntries([...stage.querySelectorAll('[data-vs]')].map((el) => [el.dataset.vs, el]));

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const bump = (k) => Math.sin(Math.PI * clamp01(k));

  // ---------- Model (metry) ----------
  const BW = 14; // szerokość elewacji (oś x)
  const BD = 12; // głębokość budynku
  const BH = 36; // wysokość
  const GF = 4.4; // parter (wyższy, z wejściem)
  const LANES = [-5.25, -1.75, 1.75, 5.25]; // pasy zjazdu alpinistów
  const LV = 18; // poziomy rusztowania co 2 m
  const SW = 3.4; // szerokość chodnika

  // ---------- Oś czasu (p = postęp przewijania 0…1, cztery kroki po 0,25) ----------
  const growAt = (p) => smoothstep(0.27, 0.46, p) * (1 - smoothstep(0.5, 0.555, p)); // rusztowanie rośnie, potem znika
  const fenceAt = (p) => smoothstep(0.26, 0.3, p) * (1 - smoothstep(0.545, 0.58, p));
  const anchorAt = (p) => smoothstep(0.53, 0.56, p);
  const dropAt = (p) => smoothstep(0.555, 0.59, p); // liny spadają z dachu
  const crewAt = (p) => smoothstep(0.56, 0.58, p) * (1 - smoothstep(0.79, 0.84, p)); // ekipa widoczna
  const descentAt = (p, i) => smoothstep(0.585 + i * 0.012, 0.715 + i * 0.012, p);
  const glintAt = (p) => smoothstep(0.82, 0.96, p);
  const climberY = (p, i) => lerp(BH - 1.3, GF + 1.1, descentAt(p, i));

  const state = { progress: 0, step: -1, visible: false, inView: false, vs: {} };

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // Karta porównania: wartości dochodzą razem z animacją
  const setVs = (key, text, tone) => {
    const el = vsEls[key];
    if (!el || state.vs[key] === text) return;
    const wasEmpty = !state.vs[key] || state.vs[key] === '—';
    state.vs[key] = text;
    el.textContent = text;
    el.classList.toggle('is-empty', text === '—');
    el.classList.toggle('is-bad', tone === 'bad');
    el.classList.toggle('is-good', tone === 'good');
    if (wasEmpty && text !== '—' && !reduceMotion) {
      el.classList.remove('is-pop');
      void el.offsetWidth;
      el.classList.add('is-pop');
    }
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
    }
    const g = smoothstep(0.27, 0.46, p);
    setVs('s-start', p < 0.28 ? '—' : `za ${Math.max(1, Math.ceil(g * 6))} ${g * 6 > 1 ? 'dni' : 'dzień'}`, g > 0.99 ? 'bad' : '');
    setVs('s-walk', p < 0.3 ? '—' : 'zajęty', 'bad');
    setVs('s-days', p < 0.44 ? '—' : '11 dni');
    setVs('s-cost', p < 0.47 ? '—' : '100%');
    setVs('r-start', p < 0.56 ? '—' : 'jutro', 'good');
    setVs('r-walk', p < 0.6 ? '—' : 'wolny', 'good');
    setVs('r-days', p < 0.68 ? '—' : '4 dni', 'good');
    setVs('r-cost', p < 0.73 ? '—' : '≈ 55%', 'good');
    vsCard && vsCard.classList.toggle('is-final', step === 3);
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
  scene.fog = new THREE.Fog('#e9eef2', 110, 260);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
  const target = new THREE.Vector3(0, 17, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#c3ccd4', 0.75));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.4);
  sun.position.set(34, 62, 46);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -30, near: 10, far: 180 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeTex = (draw, w = 512, h = w, repeat = false) => {
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
  const rand = (() => {
    let s = 9;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // Ściana kurtynowa: szyby, słupki co 1,4 m, pasy międzykondygnacyjne, przeszklony parter
  const PX = 40; // pikseli na metr
  const facadeTex = (w, glassy) =>
    makeTex((g, cw, ch) => {
      const floorH = 3.6 * PX;
      const gfH = GF * PX;
      g.fillStyle = '#2c4456';
      g.fillRect(0, 0, cw, ch);
      for (let y = ch - gfH; y > 0; y -= floorH) {
        for (let x = 0; x < cw; x += 1.4 * PX) {
          const v = 0.85 + rand() * 0.3;
          const gr = g.createLinearGradient(x, y - floorH, x + 1.4 * PX, y);
          gr.addColorStop(0, `rgb(${70 * v},${108 * v},${132 * v})`);
          gr.addColorStop(1, `rgb(${46 * v},${74 * v},${96 * v})`);
          g.fillStyle = gr;
          g.fillRect(x, y - floorH, 1.4 * PX, floorH);
        }
        g.fillStyle = glassy ? '#1d2b36' : '#26323c';
        g.fillRect(0, y - 0.8 * PX, cw, 0.8 * PX); // pas stropu
      }
      g.fillStyle = '#cfd6dc';
      for (let x = 0; x <= cw; x += 1.4 * PX) g.fillRect(x - 2, 0, 4, ch - gfH); // słupki
      for (let y = ch - gfH; y > 0; y -= floorH) g.fillRect(0, y - 2, cw, 3);
      // parter: jasne przeszklenie i drzwi
      g.fillStyle = '#8fb0c6';
      g.fillRect(0, ch - gfH, cw, gfH);
      g.fillStyle = '#cfd6dc';
      for (let x = 0; x <= cw; x += 2.8 * PX) g.fillRect(x - 3, ch - gfH, 6, gfH);
      g.fillRect(0, ch - gfH, cw, 6);
      g.fillStyle = '#20303c';
      g.fillRect(cw / 2 - 1.2 * PX, ch - 2.6 * PX, 2.4 * PX, 2.6 * PX);
    }, w * PX, BH * PX);
  const frontTex = facadeTex(BW, true);
  const sideTex = facadeTex(BD, false);

  // Brud na szybie: zacieki spod pasów stropowych
  const dirtTex = makeTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(172,154,124,0.5)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(140,122,94,${0.08 + rand() * 0.16})`;
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 3 + rand() * 10, 3 + rand() * 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    const floors = (BH - GF) / 3.6;
    for (let f = 0; f < floors; f++) {
      const y0 = (f / floors) * h;
      for (let i = 0; i < 14; i++) {
        const x = rand() * w;
        const len = (h / floors) * (0.35 + rand() * 0.6);
        const gr = g.createLinearGradient(0, y0, 0, y0 + len);
        gr.addColorStop(0, 'rgba(92,76,54,0.7)');
        gr.addColorStop(1, 'rgba(92,76,54,0)');
        g.fillStyle = gr;
        g.fillRect(x, y0, 2 + rand() * 6, len);
      }
    }
  }, 128, 1024);

  const netTex = makeTex((g, w, h) => {
    g.fillStyle = 'rgba(232,242,238,0.55)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,180,0.9)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, 128, 128, true);
  netTex.repeat.set(10, 26);

  const stripeTex = makeTex((g, w, h) => {
    for (let i = -2; i < 10; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#e5484d';
      g.beginPath();
      g.moveTo(i * 32, h);
      g.lineTo(i * 32 + 32, h);
      g.lineTo(i * 32 + 64, 0);
      g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
  }, 256, 64);

  const glintTex = makeTex((g, w, h) => {
    const gr = g.createLinearGradient(0, h, w, 0);
    gr.addColorStop(0.38, 'rgba(255,255,255,0)');
    gr.addColorStop(0.47, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.53, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, 512, 512);

  const windowsTex = makeTex((g, w, h) => {
    g.fillStyle = '#ece8e1';
    g.fillRect(0, 0, w, h);
    for (let y = 18; y < h - 10; y += 40) {
      for (let x = 14; x < w - 10; x += 36) {
        g.fillStyle = rand() > 0.15 ? '#9fb3c2' : '#c9d6df';
        g.fillRect(x, y, 20, 24);
      }
    }
  }, 256, 512, true);

  // ---------- Materiały ----------
  const glassMat = new THREE.MeshStandardMaterial({ map: frontTex, metalness: 0.75, roughness: 0.14, envMapIntensity: 1.5 });
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, metalness: 0.7, roughness: 0.18, envMapIntensity: 1.3 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.9 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#cdd3d8', roughness: 0.85 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#a9b2ba', metalness: 0.7, roughness: 0.35 });
  const deckMat = new THREE.MeshStandardMaterial({ color: '#c8ad7f', roughness: 0.8 });
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, roughness: 1 });
  const fenceMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 });
  const dirtMat = new THREE.MeshBasicMaterial({ map: dirtTex, transparent: true, depthWrite: false });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#ff7a2e', roughness: 0.55, emissive: '#ff6a1a', emissiveIntensity: 0 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#ff7a2e', roughness: 0.7, transparent: true });
  const ropeMat2 = new THREE.MeshStandardMaterial({ color: '#2b6cb0', roughness: 0.7, transparent: true });
  const navyMat = new THREE.MeshStandardMaterial({ color: '#1f2d3a', roughness: 0.75, transparent: true });
  const vestMat = new THREE.MeshStandardMaterial({ color: '#ff7a2e', roughness: 0.6, transparent: true });
  const helmetMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, transparent: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d9a882', roughness: 0.7, transparent: true });
  const crewMats = [ropeMat, ropeMat2, navyMat, vestMat, helmetMat, skinMat];
  const asphaltMat = new THREE.MeshStandardMaterial({ color: '#5b636b', roughness: 0.95 });
  const pavementMat = new THREE.MeshStandardMaterial({ color: '#d6dbdf', roughness: 0.95 });
  const neighborMat = new THREE.MeshStandardMaterial({ map: windowsTex, roughness: 0.9 });
  const treeMat = new THREE.MeshStandardMaterial({ color: '#7fa36a', roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5c45', roughness: 1 });

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  const city = new THREE.Group();
  scene.add(city);

  // ---------- Ulica ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#e1e6ea', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.add(ground);
  const strip = (z0, z1, mat, y = 0.01) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(160, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    city.add(m);
  };
  strip(0, SW + 0.6, pavementMat);
  strip(SW + 0.6, SW + 10, asphaltMat);
  strip(SW + 10, SW + 13, pavementMat);
  for (let x = -78; x < 80; x += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.16), new THREE.MeshBasicMaterial({ color: '#e8ecef' }));
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.02, SW + 5.3);
    city.add(dash);
  }

  // ---------- Biurowiec ----------
  const tower = box(BW, BH, BD, [sideMat, sideMat, roofMat, roofMat, glassMat, sideMat]);
  tower.position.set(0, BH / 2, -BD / 2);
  city.add(tower);
  const parapet = new THREE.Group();
  for (const [w, d, x, z] of [[BW + 0.3, 0.3, 0, 0], [BW + 0.3, 0.3, 0, -BD], [0.3, BD, -BW / 2, -BD / 2], [0.3, BD, BW / 2, -BD / 2]]) {
    const b = box(w, 1.0, d, concreteMat);
    b.position.set(x, BH + 0.5, z);
    parapet.add(b);
  }
  const machine = box(5, 2.6, 4, concreteMat);
  machine.position.set(-2, BH + 1.3, -7);
  parapet.add(machine);
  city.add(parapet);
  const canopy = box(7, 0.25, 2.2, concreteMat);
  canopy.position.set(0, GF + 0.1, 1.1);
  city.add(canopy);

  // Sąsiednie budynki (jaśniejsze, w tle)
  const neighbor = (x0, x1, h) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, BD), [neighborMat, neighborMat, roofMat, roofMat, neighborMat, neighborMat]));
    m.position.set((x0 + x1) / 2, h / 2, -BD / 2 - 0.4);
    city.add(m);
  };
  neighbor(-26, -8.2, 14.4);
  neighbor(8.2, 22, 10.8);

  // Drzewa przy krawężniku
  for (const x of [-15, 13.5, 21]) {
    const trunk = box(0.35, 3, 0.35, trunkMat);
    trunk.position.set(x, 1.5, SW + 0.1);
    const crown = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), treeMat));
    crown.position.set(x, 4.6, SW + 0.1);
    crown.scale.set(1, 1.15, 1);
    city.add(trunk, crown);
  }

  // ---------- Brud na elewacji: osobny pas dla każdego alpinisty ----------
  const laneW = BW / LANES.length;
  const dirtH = BH - GF;
  const dirt = LANES.map((x) => {
    const geo = new THREE.PlaneGeometry(laneW, dirtH);
    geo.translate(0, dirtH / 2, 0);
    const tex = dirtTex.clone();
    tex.needsUpdate = true;
    tex.offset.x = (x + BW / 2 - laneW / 2) / BW;
    tex.repeat.x = laneW / BW;
    const mat = dirtMat.clone();
    mat.map = tex;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, GF, 0.03);
    city.add(m);
    return m;
  });
  dirtTex.repeat.set(1, 1);

  // Odblask słońca na czystym szkle (krok 4)
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(BW, dirtH), new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glint.position.set(0, GF + dirtH / 2, 0.05);
  glintTex.wrapS = THREE.ClampToEdgeWrapping;
  city.add(glint);

  // ---------- Rusztowanie ----------
  const ZI = 0.5;
  const ZO = 1.85;
  const COLS = [];
  for (let x = -7.5; x <= 7.51; x += 2.5) COLS.push(x);
  const tubes = []; // { lv, a, b }
  const decks = []; // { lv, x, y }
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let lv = 0; lv <= LV; lv++) {
    const y = lv * 2;
    if (lv < LV) {
      for (const x of COLS) {
        tubes.push({ lv, a: v(x, y, ZI), b: v(x, y + 2, ZI) }, { lv, a: v(x, y, ZO), b: v(x, y + 2, ZO) });
      }
    } else {
      for (const x of COLS) tubes.push({ lv, a: v(x, y, ZO), b: v(x, y + 1.1, ZO) });
    }
    if (lv === 0) continue;
    for (const x of COLS) tubes.push({ lv, a: v(x, y, ZI), b: v(x, y, ZO) });
    for (let c = 0; c < COLS.length - 1; c++) {
      const x0 = COLS[c];
      const x1 = COLS[c + 1];
      tubes.push({ lv, a: v(x0, y, ZO), b: v(x1, y, ZO) }, { lv, a: v(x0, y + 1, ZO), b: v(x1, y + 1, ZO) }, { lv, a: v(x0, y, ZI), b: v(x1, y, ZI) });
      if ((c + lv) % 2 === 0 && lv < LV) tubes.push({ lv, a: v(x0, y - 2, ZO + 0.06), b: v(x1, y, ZO + 0.06) });
      decks.push({ lv, x: (x0 + x1) / 2, y });
    }
  }
  const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
  const tubeMesh = new THREE.InstancedMesh(tubeGeo, steelMat, tubes.length);
  tubeMesh.castShadow = true;
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.06, ZO - ZI - 0.1), deckMat, decks.length);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  city.add(tubeMesh, deckMesh);
  const scaffoldTubes = tubes.map((t) => {
    const dir = new THREE.Vector3().subVectors(t.b, t.a);
    const len = dir.length();
    return { lv: t.lv, mid: new THREE.Vector3().addVectors(t.a, t.b).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), len };
  });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(BW + 1.2, 1), netMat);
  net.geometry.translate(0, 0.5, 0);
  net.position.set(0, 0, ZO + 0.1);
  city.add(net);

  // Barierki zamykające chodnik
  const fence = new THREE.Group();
  const panel = (x, z, rotY) => {
    const b = box(2.2, 1, 0.08, fenceMat);
    b.position.set(x, 0.5, z);
    b.rotation.y = rotY;
    const legs = box(2.1, 0.08, 0.5, steelMat);
    legs.position.set(x, 0.04, z);
    legs.rotation.y = rotY;
    fence.add(b, legs);
  };
  for (let x = -8.8; x <= 8.81; x += 2.2) panel(x, SW - 0.1, 0);
  for (const sx of [-1, 1]) {
    panel(sx * 9.9, 1.1, Math.PI / 2);
    panel(sx * 9.9, SW - 1.2, Math.PI / 2);
  }
  city.add(fence);

  // ---------- Przechodnie ----------
  const PEOPLE = 7;
  const personColors = ['#3f5a73', '#7a4e3a', '#4d6b4e', '#8c8f93', '#2f3b47', '#a4605a', '#5d4f7a'];
  const people = Array.from({ length: PEOPLE }, (_, i) => {
    const g = new THREE.Group();
    const body = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.95, 4, 10), new THREE.MeshStandardMaterial({ color: personColors[i], roughness: 0.8 })));
    body.position.y = 0.72;
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat.clone()));
    head.material.transparent = false;
    head.position.y = 1.55;
    g.add(body, head);
    city.add(g);
    const dir = i % 2 ? 1 : -1;
    return { g, x: -30 + rand() * 60, z: i % 2 ? 1.2 : 2.3, dir, v: 1.1 + rand() * 0.5, ph: rand() * 6 };
  });

  // ---------- Kotwy, liny, alpiniści ----------
  const anchors = LANES.map((x) => {
    const a = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), orangeMat));
    a.position.set(x, BH + 1.05, -0.2);
    a.rotation.x = Math.PI / 2;
    const guard = box(0.5, 0.12, 0.6, navyMat);
    guard.position.set(x, BH + 1.0, 0.2);
    city.add(a, guard);
    return a;
  });
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
  ropeGeo.translate(0, -0.5, 0);
  const ropes = LANES.flatMap((x) =>
    [[-0.09, ropeMat], [0.09, ropeMat2]].map(([dx, mat]) => {
      const r = new THREE.Mesh(ropeGeo, mat);
      r.position.set(x + dx, BH + 1.0, 0.62);
      r.castShadow = true;
      city.add(r);
      return r;
    })
  );

  const capsule = (r, len, mat) => shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat));
  const makeClimber = () => {
    const g = new THREE.Group();
    const seat = box(0.46, 0.05, 0.26, navyMat);
    seat.position.set(0, -0.06, 0);
    const torso = capsule(0.17, 0.36, vestMat);
    torso.position.set(0, 0.28, 0.04);
    torso.rotation.x = 0.18;
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skinMat));
    head.position.set(0, 0.66, 0.02);
    const helmet = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat));
    helmet.position.set(0, 0.69, 0.02);
    g.add(seat, torso, head, helmet);
    for (const sx of [-1, 1]) {
      const thigh = capsule(0.075, 0.32, navyMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(sx * 0.11, 0.0, -0.2);
      const shin = capsule(0.065, 0.34, navyMat);
      shin.rotation.x = 0.5;
      shin.position.set(sx * 0.12, -0.15, -0.44);
      g.add(thigh, shin);
    }
    const armPivot = new THREE.Group();
    armPivot.position.set(0.2, 0.44, 0.02);
    const arm = capsule(0.055, 0.42, vestMat);
    arm.rotation.x = -0.9;
    arm.position.set(0.02, 0.15, -0.2);
    const squeegee = box(0.42, 0.06, 0.05, orangeMat);
    squeegee.position.set(0.04, 0.32, -0.42);
    armPivot.add(arm, squeegee);
    const bucket = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 12), navyMat));
    bucket.position.set(-0.22, -0.42, 0.04);
    g.add(armPivot, bucket);
    g.scale.setScalar(1.25);
    g.userData.arm = armPivot;
    city.add(g);
    return g;
  };
  const climbers = LANES.map(() => makeClimber());

  // ---------- Kamera ----------
  // Ujęcia: elewacja z ukosa → nisko na chodnik i rusztowanie → przy alpinistach (kamera jedzie z nimi w dół) → z dołu, cały budynek
  const SHOTS = [
    { th: 0.52, ph: 0.12, r: 1, t: [0, 18, 0] },
    { th: 0.78, ph: 0.06, r: 0.92, t: [1, 15, 2] },
    { th: 0.42, ph: 0.06, r: 0.44, t: [2, 24, 0] },
    { th: 0.3, ph: -0.06, r: 0.98, t: [0, 19, 0] },
  ];
  const shotAt = (p) => {
    const k1 = smoothstep(0.22, 0.3, p);
    const k2 = smoothstep(0.5, 0.58, p);
    const k3 = smoothstep(0.75, 0.82, p);
    const mix = (key, i) => {
      const val = (s) => (i === undefined ? s[key] : s[key][i]);
      let x = lerp(val(SHOTS[0]), val(SHOTS[1]), k1);
      x = lerp(x, val(SHOTS[2]), k2);
      return lerp(x, val(SHOTS[3]), k3);
    };
    const shot = { th: mix('th'), ph: mix('ph'), r: mix('r'), t: [mix('t', 0), mix('t', 1), mix('t', 2)] };
    // w kroku 3 kamera zjeżdża razem z ekipą
    const follow = k2 * (1 - k3);
    const avgY = LANES.reduce((s, _, i) => s + climberY(p, i), 0) / LANES.length;
    shot.t[1] = lerp(shot.t[1], Math.max(avgY - 1, 9), follow);
    return shot;
  };

  const anim = { th: SHOTS[0].th, ph: SHOTS[0].ph, r: 1, tx: 0, ty: 18, tz: 0, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0 };
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

  let radius = 86;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    radius = 86 * Math.pow(1.2 / Math.min(camera.aspect, 1.2), 0.55);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- Etykiety (rzut 3D → 2D) ----------
  const TAGS = {
    facade: { steps: [0], pos: () => v(4.6, 27, 0.05), a: () => 1 },
    scaffold: { steps: [1], side: 'left', pos: (p) => v(-7.6, 2 + LV * 2 * growAt(p), ZO), a: (p) => smoothstep(0.3, 0.6, growAt(p)) },
    sidewalk: { steps: [1], pos: () => v(9.9, 1.2, SW - 0.6), a: (p) => fenceAt(p) },
    anchor: { steps: [2], side: 'left', pos: () => v(LANES[0] - 0.3, BH + 1.2, -0.2), a: (p) => anchorAt(p) * (1 - smoothstep(0.62, 0.66, p)) },
    ropes: { steps: [2], side: 'left', pos: (p) => v(LANES[0] - 0.2, lerp(BH, climberY(p, 0), 0.5), 0.62), a: (p) => smoothstep(0.58, 0.6, p) },
    climber: { steps: [2], pos: (p) => v(LANES[2] + 0.5, climberY(p, 2) + 0.6, 0.7), a: (p) => smoothstep(0.59, 0.61, p) },
    clean: { steps: [3], pos: () => v(3.6, 23, 0.05), a: (p) => smoothstep(0.82, 0.88, p) },
  };
  const tagState = tagEls.map(() => ({ a: 0, w: 0 }));
  const _v = new THREE.Vector3();
  const placeTags = (p, step, dt, introA) => {
    tagEls.forEach((el, k) => {
      const t = TAGS[el.dataset.tag];
      if (!t) return;
      const st = tagState[k];
      const goal = t.steps.includes(step) ? t.a(p) * introA : 0;
      st.a = goal + ease(st.a - goal, 10, dt);
      if (st.a < 0.01) {
        el.style.opacity = '0';
        return;
      }
      _v.copy(t.pos(p)).project(camera);
      if (!st.w) st.w = el.offsetWidth || 180;
      let x = (_v.x * 0.5 + 0.5) * stageW;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      x = t.side === 'left' ? Math.max(x - st.w - 4, 8) : Math.min(x + 4, stageW - st.w - 8);
      el.style.opacity = st.a.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  // ---------- Pętla ----------
  const m4 = new THREE.Matrix4();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const zero = new THREE.Vector3(0, 0, 0);
  const noRot = new THREE.Quaternion();
  let lastGrow = -1;
  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const t = now / 1000;
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));

    // Wejście: budynek „wyrasta” z ulicy
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1400, 1);
    }
    const intro = 1 - Math.pow(1 - anim.intro, 3);
    tower.scale.y = Math.max(intro, 0.001);
    tower.position.y = (BH / 2) * intro;
    parapet.position.y = (intro - 1) * BH;
    parapet.visible = intro > 0.98;
    dirt.forEach((d) => (d.visible = intro > 0.98));

    // Rusztowanie: poziomy pojawiają się od dołu i spadają na miejsce
    const grow = reduceMotion ? Math.round(growAt(p)) : growAt(p);
    if (Math.abs(grow - lastGrow) > 1e-4) {
      lastGrow = grow;
      const levelF = grow * (LV + 1.2);
      scaffoldTubes.forEach((tb, i) => {
        const k = clamp01(levelF - tb.lv);
        if (k <= 0) {
          tubeMesh.setMatrixAt(i, m4.compose(zero, tb.q, sc.set(0, 0, 0)));
          return;
        }
        pos.copy(tb.mid);
        pos.y += (1 - k) * 2.5;
        tubeMesh.setMatrixAt(i, m4.compose(pos, tb.q, sc.set(1, tb.len * (0.4 + 0.6 * k), 1)));
      });
      tubeMesh.instanceMatrix.needsUpdate = true;
      decks.forEach((d, i) => {
        const k = clamp01(levelF - d.lv - 0.2);
        deckMesh.setMatrixAt(i, m4.compose(pos.set(d.x, d.y + (1 - k) * 2.5, (ZI + ZO) / 2), noRot, sc.setScalar(k > 0 ? 1 : 0)));
      });
      deckMesh.instanceMatrix.needsUpdate = true;
      const netH = Math.max(levelF - 0.6, 0) * 2;
      net.visible = netH > 0.05;
      net.scale.y = Math.max(Math.min(netH, LV * 2 + 1), 0.001);
      netTex.repeat.y = Math.max(net.scale.y, 0.01) * 0.7;
    }
    tubeMesh.visible = deckMesh.visible = grow > 0.001;

    // Barierki i przechodnie, którzy muszą zejść na jezdnię
    const fk = fenceAt(p);
    fence.visible = fk > 0.01;
    fence.scale.y = Math.max(fk, 0.001);
    people.forEach((pp) => {
      if (!reduceMotion) pp.x += pp.dir * pp.v * dt;
      if (pp.x > 32) pp.x = -32;
      if (pp.x < -32) pp.x = 32;
      const around = fk * smoothstep(12.5, 10, Math.abs(pp.x));
      const z = lerp(pp.z, SW + 1.4 + (pp.z - 1.2) * 0.5, around);
      pp.g.position.set(pp.x, Math.abs(Math.sin(t * 6 + pp.ph)) * 0.05, z);
      pp.g.rotation.y = pp.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    });

    // Kotwy, liny i ekipa
    const ak = anchorAt(p);
    orangeMat.emissiveIntensity = bump(ak) * 0.9 + (step === 2 ? 0.15 : 0);
    anchors.forEach((a) => a.scale.setScalar(0.6 + 0.4 * ak));
    const drop = dropAt(p);
    const crew = crewAt(p);
    crewMats.forEach((m) => {
      m.opacity = crew;
      m.depthWrite = crew > 0.5;
    });
    ropes.forEach((r, i) => {
      const lane = Math.floor(i / 2);
      const end = lerp(BH + 1.0, 0.4, smoothstep(0, 1, drop - lane * 0.04));
      r.visible = crew > 0.01 && drop > 0.001;
      r.scale.y = Math.max(BH + 1.0 - end, 0.01);
      r.position.x = LANES[lane] + (i % 2 ? 0.09 : -0.09) + (reduceMotion ? 0 : Math.sin(t * 1.3 + lane) * 0.02);
    });
    climbers.forEach((c, i) => {
      const y = climberY(p, i);
      c.visible = crew > 0.01;
      c.position.set(LANES[i], y, 0.62);
      const scrub = descentAt(p, i) > 0 && descentAt(p, i) < 1 && !reduceMotion ? Math.sin(t * 5 + i) * 0.5 : 0;
      c.userData.arm.rotation.z = scrub * 0.6;
      c.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.3 + i) * 0.03;
    });

    // Brud znika nad każdym alpinistą
    dirt.forEach((d, i) => {
      const f = 1 - descentAt(p, i); // krawędź czystego szkła jedzie tuż nad alpinistą
      d.scale.y = Math.max(f, 0.0001);
      d.visible = intro > 0.98 && f > 0.002;
      d.material.map.repeat.y = Math.max(f, 0.0001);
    });

    // Odblask słońca na czystym szkle
    const gk = glintAt(p);
    glint.material.opacity = bump(gk) * 0.9;
    glint.visible = gk > 0.001 && gk < 0.999;
    glintTex.offset.x = lerp(0.75, -0.75, gk);

    // Kamera
    const shot = shotAt(p);
    const span = reduceMotion ? 0.3 : 1;
    const thGoal = lerp(SHOTS[0].th, shot.th, span) + anim.px * 0.05;
    const phGoal = shot.ph - anim.py * 0.025;
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
      anim.yawUser = Math.max(Math.min(anim.yawUser, 1.1), -1.4);
    }
    const th = anim.th + anim.yawUser;
    const r = radius * anim.r;
    camera.position.set(
      target.x + Math.sin(th) * Math.cos(anim.ph) * r,
      Math.max(target.y + Math.sin(anim.ph) * r, 1.6),
      target.z + Math.cos(th) * Math.cos(anim.ph) * r
    );
    camera.lookAt(target);
    // karta porównania stoi po prawej (na telefonie u góry) — kadr ustępuje jej miejsca
    const narrow = stageW < 600;
    const side = smoothstep(0.22, 0.28, p);
    anim.off = side + ease((anim.off || 0) - side, 5, dt);
    const offX = narrow ? 0 : stageW * 0.13 * anim.off;
    const offY = narrow ? -stageH * (0.08 + 0.08 * anim.off) : 0;
    camera.setViewOffset(stageW, stageH, offX, offY, stageW, stageH);
    camera.updateMatrixWorld();

    placeTags(p, step, dt, smoothstep(0.7, 1, anim.intro));

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
