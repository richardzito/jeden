/* ==========================================================================
   Zajawka „Twój dach za 5 lat” — dom w 3D sterowany przewijaniem:
   drobna usterka dziś → przelewająca się rynna i mech → przeciek do pokoju
   → przegląd, który cofa szkody. Licznik lat i kosztu naprawy rośnie razem
   z przewijaniem.
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
    // brak sieci / CDN — kroki i liczniki działają dalej, zamiast 3D zdjęcie
  }
  init();
}

function init() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- UI ----------
  const stepEls = [...document.querySelectorAll('.wow__step')];
  const hudEls = [...stage.querySelectorAll('[data-hud]')];
  const rail = document.getElementById('wow-rail');
  const tagEls = [...stage.querySelectorAll('.dmg-tag')];
  const hudYear = document.getElementById('hud-year');
  const hudCost = document.getElementById('hud-cost');
  const hudMeter = document.getElementById('hud-meter');
  const fixEls = [...stage.querySelectorAll('[data-fix]')];

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ---------- Oś czasu (p = postęp przewijania 0…1) ----------
  // Lata: dziś → 2 lata → 5 lat, potem przegląd.
  const yearsAt = (p) => 0.4 * smoothstep(0.12, 0.25, p) + 2 * smoothstep(0.25, 0.47, p) + 2.6 * smoothstep(0.5, 0.72, p);
  // Koszt naprawy (poglądowo, dom jednorodzinny)
  const COST = [[0, 600], [1, 900], [2, 2400], [3, 4800], [4, 9800], [5, 14800]];
  const costAt = (y) => {
    for (let i = 1; i < COST.length; i++) {
      if (y <= COST[i][0]) {
        const [x0, c0] = COST[i - 1];
        const [x1, c1] = COST[i];
        return lerp(c0, c1, (y - x0) / (x1 - x0));
      }
    }
    return COST[COST.length - 1][1];
  };
  const rainAt = (p) => (reduceMotion ? 0 : smoothstep(0.27, 0.33, p) * (0.45 + 0.55 * smoothstep(0.5, 0.56, p)) * (1 - smoothstep(0.75, 0.79, p)));
  const scanAt = (p) => smoothstep(0.79, 0.93, p);

  // Szkody w funkcji lat
  const damage = (y) => ({
    crack: 0.35 + 0.65 * smoothstep(0, 3, y),
    clog: 0.12 + 0.88 * smoothstep(0.2, 2.2, y),
    moss: smoothstep(0.7, 4.2, y),
    wall: smoothstep(1.0, 2.4, y),
    leak: smoothstep(3, 4, y),
    ceiling: smoothstep(3.2, 5, y),
    aging: smoothstep(1.5, 5, y),
  });

  // ---------- Model (metry) ----------
  const L = 12; // długość (oś x)
  const W = 9; // szerokość (oś z)
  const H = 5.2; // wysokość ścian
  const FLOOR = 2.75; // podłoga piętra
  const CEIL = 4.95; // sufit piętra (spód stropu)
  const A = (38 * Math.PI) / 180;
  const tanA = Math.tan(A);
  const OV = 0.6; // okap
  const OVX = 0.45; // wysunięcie przy szczycie
  const RT = 0.16; // grubość dachu
  const roofTop = (z) => H + 0.25 + (W / 2 - Math.abs(z)) * tanA;
  const RIDGE = roofTop(0);
  const EAVE = roofTop(W / 2 + OV);
  const SLOPE = (W / 2 + OV) / Math.cos(A);
  const CH = { x: 2.6, z: 1.5, s: 0.85 }; // komin na przedniej połaci, bliżej prawego szczytu
  const CH_S = CH.z / Math.cos(A); // odległość komina od kalenicy wzdłuż połaci
  const LEAK = { x: CH.x + 0.15, z: CH.z + 0.95 }; // plama i wiadro przy kominie
  const GUTTER_Y = EAVE - 0.13;
  const GUTTER_Z = W / 2 + OV - 0.06;

  // Wysokości, na których skan „naprawia” elementy
  const FIX_H = { wall: 2.4, gutter: GUTTER_Y, ceiling: CEIL, moss: 6.6, aging: 6.6, crack: roofTop(CH.z) + 0.2 };
  const FIX_OF = { clog: 'gutter', leak: 'ceiling' };

  const state = { progress: 0, step: -1, visible: false, inView: false };

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // Skan: ile danego elementu już naprawiono (0…1)
  const ringY = (p) => lerp(-0.6, RIDGE + 1.6, scanAt(p));
  const fixedAt = (h, p) => smoothstep(h - 0.5, h + 0.5, ringY(p));

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
    const y = yearsAt(p);
    const cost = Math.round(costAt(y) / 100) * 100;
    hudYear.textContent = 2026 + Math.floor(y + 0.0001);
    hudCost.textContent = `${fmt(cost)} zł`;
    hudCost.classList.toggle('is-high', cost > 4000);
    hudMeter.style.transform = `scaleX(${Math.max(cost / 14800, 0.04).toFixed(3)})`;
    const fixed = [fixedAt(FIX_H.crack, p), fixedAt(FIX_H.gutter, p), fixedAt(FIX_H.moss, p), fixedAt(FIX_H.ceiling, p)];
    fixEls.forEach((el, i) => el.classList.toggle('is-done', fixed[i] > 0.9));
    stage.style.setProperty('--storm', (rainAt(p) * 0.9).toFixed(3));
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
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  const target = new THREE.Vector3(0, 4.4, 0);

  const hemi = new THREE.HemisphereLight('#ffffff', '#c7d0d8', 0.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.4);
  sun.position.set(14, 26, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const roomLight = new THREE.PointLight('#ffe7c4', 0, 9, 1.6);
  roomLight.position.set(3.2, 4.2, 0.5);
  scene.add(roomLight);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeTex = (draw, w = 512, h = w, repeat = true) => {
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
    let s = 11;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // Blachodachówka: moduły z przetłoczeniem i falą
  const roofTex = makeTex((g, w, h) => {
    g.fillStyle = 'rgb(205,208,212)';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const gr = g.createLinearGradient(x, 0, x + 32, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.18)');
      gr.addColorStop(0.5, 'rgba(0,0,0,0.0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = gr;
      g.fillRect(x, 0, 32, h);
    }
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(0, y + 58, w, 6);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(0, y + 55, w, 3);
    }
  });
  roofTex.repeat.set((L + 2 * OVX) / 2.4, SLOPE / 2.2);
  const woodTex = makeTex((g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const v = 176 + rand() * 30;
      g.fillStyle = `rgb(${v},${v * 0.78},${v * 0.56})`;
      g.fillRect(0, (i * h) / n, w, h / n);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = `rgba(90,55,25,${0.04 + rand() * 0.07})`;
        g.fillRect(0, (i * h) / n + rand() * (h / n), w, 1);
      }
      g.fillStyle = 'rgba(60,35,15,0.45)';
      g.fillRect(0, ((i + 1) * h) / n - 2, w, 2);
    }
  }, 256);
  woodTex.repeat.set(4, 3);
  const brickTex = makeTex((g, w, h) => {
    g.fillStyle = 'rgb(200,196,190)';
    g.fillRect(0, 0, w, h);
    const bw = 64;
    const bh = 24;
    for (let r = 0; r < h / bh; r++) {
      for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + (r % 2) * (bw / 2);
        const v = 140 + rand() * 30;
        g.fillStyle = `rgb(${v},${v * 0.52},${v * 0.42})`;
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
  }, 256);
  brickTex.repeat.set(1, 3);
  // Zaciek na elewacji: smugi od rynny w dół
  const streakTex = makeTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const x = rand() * w;
      const len = h * (0.35 + rand() * 0.65);
      const wd = 6 + rand() * 18;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, 'rgba(62,66,64,0.72)');
      gr.addColorStop(1, 'rgba(70,74,70,0)');
      g.fillStyle = gr;
      g.fillRect(x - wd / 2, 0, wd, len);
    }
    const top = g.createLinearGradient(0, 0, 0, h * 0.25);
    top.addColorStop(0, 'rgba(60,64,60,0.6)');
    top.addColorStop(1, 'rgba(60,64,60,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, w, h * 0.25);
  }, 256, 512, false);
  // Plama na suficie: zaciek z ciemniejszym brzegiem
  const stainTex = makeTex((g, w) => {
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = c * (0.78 + 0.16 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7));
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(150,120,70,0.55)');
    gr.addColorStop(0.75, 'rgba(140,105,55,0.7)');
    gr.addColorStop(0.95, 'rgba(110,80,40,0.9)');
    gr.addColorStop(1, 'rgba(110,80,40,0)');
    g.fillStyle = gr;
    g.fill();
  }, 256, 256, false);
  // Skan: prostokątna poświata
  const scanTex = makeTex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    const fill = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    fill.addColorStop(0, 'rgba(40,114,250,0.05)');
    fill.addColorStop(1, 'rgba(40,114,250,0.22)');
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,170,255,0.95)';
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.strokeStyle = 'rgba(40,114,250,0.5)';
    g.lineWidth = 18;
    g.strokeRect(14, 14, w - 28, h - 28);
  }, 512, 384, false);

  // ---------- Materiały ----------
  const ROOF_NEW = new THREE.Color('#3b434c');
  const ROOF_OLD = new THREE.Color('#5d5a50');
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_NEW.clone(), map: roofTex, bumpMap: roofTex, bumpScale: 1.4, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.9 });
  const boardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTex, roughness: 0.85 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.6, metalness: 0.4 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: '#f4f2ed', roughness: 0.92 });
  const ghostMat = new THREE.MeshStandardMaterial({ color: '#f4f2ed', roughness: 0.92, transparent: true, opacity: 1 });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#ece6dc', roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#6d747c', roughness: 0.95 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2e3540', roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33465a', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const brickMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: brickTex, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#5b646e', roughness: 0.5, metalness: 0.5 });
  const flashMat = new THREE.MeshStandardMaterial({ color: '#a7b3bf', roughness: 0.35, metalness: 0.75, emissive: '#2872fa', emissiveIntensity: 0 });
  const crackMat = new THREE.MeshStandardMaterial({ color: '#2a1410', emissive: '#e5484d', emissiveIntensity: 0.9, roughness: 0.6 });
  const gutterMat = new THREE.MeshStandardMaterial({ color: '#8f9aa5', roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide, emissive: '#2872fa', emissiveIntensity: 0 });
  const insulMat = new THREE.MeshStandardMaterial({ color: '#e9cf6a', roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTex, roughness: 0.7 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.95, side: THREE.DoubleSide });
  const stainMat = new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const streakMat = new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const waterMat = new THREE.MeshStandardMaterial({ color: '#5d8fd6', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 });
  const bucketMat = new THREE.MeshStandardMaterial({ color: '#3b6fd8', roughness: 0.45, side: THREE.DoubleSide });

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Dom ----------
  const house = new THREE.Group();
  scene.add(house);

  // Ściany: przód, tył, lewy szczyt (pełny), prawy szczyt (dół pełny, góra „przezierna”)
  const front = box(L, H, 0.3, plasterMat);
  front.position.set(0, H / 2, W / 2 - 0.15);
  const back = box(L, H, 0.3, plasterMat);
  back.position.set(0, H / 2, -W / 2 + 0.15);
  house.add(front, back);
  const plinth = box(L + 0.06, 0.45, W + 0.06, baseMat);
  plinth.position.y = 0.225;
  house.add(plinth);

  const gableShape = (y0) => {
    const s = new THREE.Shape();
    const zTop = (z) => roofTop(z) - RT - 0.03;
    s.moveTo(-W / 2, y0);
    s.lineTo(W / 2, y0);
    s.lineTo(W / 2, zTop(W / 2));
    s.lineTo(0, zTop(0));
    s.lineTo(-W / 2, zTop(W / 2));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    return g;
  };
  const leftGable = shadowed(new THREE.Mesh(gableShape(0), plasterMat));
  leftGable.position.x = -L / 2;
  const rightLow = box(0.3, FLOOR, W, plasterMat);
  rightLow.position.set(L / 2 - 0.15, FLOOR / 2, 0);
  const rightGeo = gableShape(FLOOR);
  const rightUp = shadowed(new THREE.Mesh(rightGeo, ghostMat));
  rightUp.position.x = L / 2 - 0.3;
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(rightGeo), new THREE.LineBasicMaterial({ color: '#2872fa', transparent: true, opacity: 0 }));
  ghostEdges.position.copy(rightUp.position);
  house.add(leftGable, rightLow, rightUp, ghostEdges);

  // Stropy, ścianka działowa, ocieplenie na stropie
  const floorSlab = box(L - 0.6, 0.2, W - 0.6, innerMat);
  floorSlab.position.y = FLOOR - 0.1;
  const ceilSlab = box(L - 0.6, H - CEIL, W - 0.6, innerMat);
  ceilSlab.position.y = (H + CEIL) / 2;
  const partition = box(0.15, CEIL - FLOOR, W - 0.6, innerMat);
  partition.position.set(0.2, (FLOOR + CEIL) / 2, 0);
  const insulation = box(L - 0.6, 0.22, W - 0.6, insulMat);
  insulation.position.y = H + 0.11;
  house.add(floorSlab, ceilSlab, partition, insulation);
  // Pokój na piętrze: podłoga i sufit
  const roomW = L / 2 - 0.3 - 0.28;
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, W - 0.6), floorMat);
  roomFloor.rotation.x = -Math.PI / 2;
  roomFloor.position.set(0.28 + roomW / 2, FLOOR + 0.005, 0);
  roomFloor.receiveShadow = true;
  const roomCeil = new THREE.Mesh(new THREE.PlaneGeometry(roomW, W - 0.6), ceilMat);
  roomCeil.rotation.x = Math.PI / 2;
  roomCeil.position.set(0.28 + roomW / 2, CEIL - 0.005, 0);
  house.add(roomFloor, roomCeil);

  // Okna i drzwi na froncie
  const winGeo = new THREE.BoxGeometry(1.3, 1.45, 0.1);
  const paneGeo = new THREE.PlaneGeometry(1.14, 1.29);
  const addWindow = (x, y, z, rot = 0) => {
    const f = shadowed(new THREE.Mesh(winGeo, frameMat));
    f.position.set(x, y, z);
    f.rotation.y = rot;
    const pane = new THREE.Mesh(paneGeo, glassMat);
    const off = new THREE.Vector3(0, 0, 0.055).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    pane.position.set(x + off.x, y, z + off.z);
    pane.rotation.y = rot;
    const sill = box(1.45, 0.06, 0.2, capMat);
    const so = new THREE.Vector3(0, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    sill.position.set(x + so.x, y - 0.75, z + so.z);
    sill.rotation.y = rot;
    house.add(f, pane, sill);
  };
  for (const x of [-3.6, 0, 3.8]) {
    addWindow(x, 1.55, W / 2 + 0.02);
    addWindow(x, 3.95, W / 2 + 0.02);
    addWindow(x, 1.55, -W / 2 - 0.02, Math.PI);
    addWindow(x, 3.95, -W / 2 - 0.02, Math.PI);
  }
  addWindow(-L / 2 - 0.02, 1.55, -1.6, -Math.PI / 2);
  addWindow(-L / 2 - 0.02, 1.55, 1.6, -Math.PI / 2);
  addWindow(-L / 2 - 0.02, 3.95, 0, -Math.PI / 2);
  addWindow(L / 2 + 0.02, 1.4, -1.8, Math.PI / 2);
  addWindow(L / 2 + 0.02, 1.4, 1.8, Math.PI / 2);
  const door = box(1.05, 2.2, 0.12, frameMat);
  door.position.set(-1.8, 1.1 + 0.2, W / 2 + 0.04);
  const canopy = box(1.8, 0.1, 1.0, capMat);
  canopy.position.set(-1.8, 2.7, W / 2 + 0.5);
  house.add(door, canopy);

  // Dach: dwie połacie obracane wokół kalenicy (góra: blacha, spód: deskowanie)
  const slopeGeo = new THREE.BoxGeometry(L + 2 * OVX, RT, SLOPE);
  const slopeMats = [edgeMat, edgeMat, roofMat, boardMat, edgeMat, edgeMat];
  const makeSlope = (dir) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, RIDGE, 0);
    pivot.rotation.x = dir * A;
    const m = shadowed(new THREE.Mesh(slopeGeo, slopeMats));
    m.position.set(0, -RT / 2, (dir * SLOPE) / 2);
    pivot.add(m);
    house.add(pivot);
    return pivot;
  };
  const frontSlope = makeSlope(1);
  makeSlope(-1);
  const ridgeCap = box(L + 2 * OVX + 0.05, 0.12, 0.32, capMat);
  ridgeCap.position.y = RIDGE + 0.03;
  house.add(ridgeCap);

  // Komin z obróbką (przy obróbce — pęknięcie)
  const chTop = RIDGE + 1.0;
  const chimney = box(CH.s, chTop - FLOOR, CH.s, brickMat);
  chimney.position.set(CH.x, (chTop + FLOOR) / 2, CH.z);
  const chCap = box(CH.s + 0.2, 0.12, CH.s + 0.2, capMat);
  chCap.position.set(CH.x, chTop + 0.06, CH.z);
  house.add(chimney, chCap);
  const flashing = box(CH.s + 0.42, 0.05, CH.s / Math.cos(A) + 0.46, flashMat);
  flashing.position.set(CH.x, 0.03, CH_S);
  frontSlope.add(flashing);
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.05), crackMat);
  crack.position.set(CH.x + 0.05, 0.065, CH_S - CH.s / Math.cos(A) / 2 - 0.12);
  crack.rotation.y = 0.12;
  frontSlope.add(crack);
  const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.04), crackMat);
  crack2.position.set(CH.x + 0.46, 0.065, CH_S - CH.s / Math.cos(A) / 2 - 0.02);
  crack2.rotation.y = -0.7;
  frontSlope.add(crack2);

  // Mech na przedniej połaci (w układzie połaci: x, s = odległość od kalenicy)
  // Mech rośnie skupiskami: od kilku ognisk przy okapie i w zacienionych miejscach
  const mossPts = [];
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const seeds = Array.from({ length: 9 }, (_, i) => ({
    x: (rand() - 0.5) * (L - 1),
    s: SLOPE * (0.45 + rand() * 0.5),
    delay: i / 9 * 0.4,
    rx: 0.8 + rand() * 1.1,
  }));
  for (let i = 0; i < 380; i++) {
    const c = seeds[i % seeds.length];
    const ox = gauss() * c.rx * 1.6;
    const os = gauss() * 0.9;
    const x = c.x + ox;
    const s = Math.min(Math.max(c.s + os, 0.4), SLOPE - 0.3);
    if (Math.abs(x) > (L + 2 * OVX) / 2 - 0.3) continue;
    if (Math.abs(x - CH.x) < 0.9 && Math.abs(s - CH_S) < 0.9) continue;
    const dist = Math.hypot(ox / (c.rx * 1.6), os / 0.9);
    const th = 0.05 + c.delay + dist * 0.35 + rand() * 0.15;
    mossPts.push({ x, s, th, sc: 0.5 + rand() * 0.55, r: rand() * Math.PI });
  }
  const mossGeo = new THREE.IcosahedronGeometry(0.17, 0);
  mossGeo.scale(1.4, 0.3, 1);
  const moss = new THREE.InstancedMesh(mossGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), mossPts.length);
  const mossColors = ['#56692f', '#64773a', '#6f7f3f', '#4a5c2a', '#7a8446'];
  mossPts.forEach((pt, i) => moss.setColorAt(i, new THREE.Color(mossColors[Math.floor(rand() * mossColors.length)])));
  moss.receiveShadow = true;
  frontSlope.add(moss);

  // Rynny i rura spustowa
  const gutterGeo = new THREE.CylinderGeometry(0.15, 0.15, L + 2 * OVX, 18, 1, true, 0, Math.PI);
  const mkGutter = (z) => {
    const g = shadowed(new THREE.Mesh(gutterGeo, gutterMat));
    g.rotation.z = -Math.PI / 2;
    g.position.set(0, GUTTER_Y, z);
    house.add(g);
    return g;
  };
  mkGutter(GUTTER_Z);
  mkGutter(-GUTTER_Z);
  const pipeMat = gutterMat;
  const pipeX = L / 2 - 0.35;
  const pipeTop = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 12), pipeMat));
  pipeTop.position.set(pipeX, GUTTER_Y - 0.3, (GUTTER_Z + W / 2 + 0.12) / 2);
  pipeTop.rotation.x = 0.95;
  const pipe = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GUTTER_Y - 0.55, 12), pipeMat));
  pipe.position.set(pipeX, (GUTTER_Y - 0.55) / 2, W / 2 + 0.12);
  house.add(pipeTop, pipe);

  // Liście w rynnie
  const leafPts = [];
  for (let i = 0; i < 70; i++) {
    leafPts.push({ x: (rand() - 0.5) * (L + 2 * OVX - 0.4), z: (rand() - 0.5) * 0.12, th: rand() * 0.85, sc: 0.7 + rand() * 0.7, r: rand() * Math.PI });
  }
  const leafGeo = new THREE.IcosahedronGeometry(0.1, 0);
  leafGeo.scale(1.7, 0.45, 1);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), leafPts.length);
  const leafColors = ['#9b5a2a', '#c27a33', '#d9a441', '#7d4a22', '#8b8a3a'];
  leafPts.forEach((pt, i) => leaves.setColorAt(i, new THREE.Color(leafColors[Math.floor(rand() * leafColors.length)])));
  house.add(leaves);

  // Zaciek na elewacji pod przelewem
  const OVER = { x0: 1.0, x1: 2.8 };
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(OVER.x1 - OVER.x0 + 0.8, H - 0.6), streakMat);
  streak.position.set((OVER.x0 + OVER.x1) / 2, 0.45 + (H - 0.6) / 2, W / 2 + 0.012);
  house.add(streak);

  // Przeciek w pokoju: plama na suficie, wiadro, kałuża, krople
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), stainMat);
  stain.rotation.x = Math.PI / 2;
  stain.position.set(LEAK.x, CEIL - 0.012, LEAK.z);
  house.add(stain);
  // Mokry zaciek na kominie (ściana komina od strony prawego szczytu)
  const chimWetMat = new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const chimWet = new THREE.Mesh(new THREE.PlaneGeometry(CH.s - 0.04, CEIL - FLOOR - 0.1), chimWetMat);
  chimWet.rotation.y = Math.PI / 2;
  chimWet.position.set(CH.x + CH.s / 2 + 0.006, (CEIL + FLOOR) / 2 + 0.05, CH.z);
  house.add(chimWet);
  const bucket = new THREE.Group();
  const bucketBody = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.44, 20, 1, true), bucketMat));
  bucketBody.position.y = 0.22;
  const bucketBottom = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), bucketMat);
  bucketBottom.rotation.x = -Math.PI / 2;
  bucketBottom.position.y = 0.01;
  const bucketWater = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), waterMat);
  bucketWater.rotation.x = -Math.PI / 2;
  bucket.add(bucketBody, bucketBottom, bucketWater);
  bucket.position.set(LEAK.x, FLOOR, LEAK.z);
  house.add(bucket);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), waterMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(LEAK.x + 0.45, FLOOR + 0.012, LEAK.z + 0.25);
  puddle.scale.set(1.3, 0.8, 1);
  house.add(puddle);
  const DROPS = 5;
  const dropGeo = new THREE.SphereGeometry(0.045, 10, 8);
  dropGeo.scale(1, 1.6, 1);
  const drops = Array.from({ length: DROPS }, (_, i) => {
    const d = new THREE.Mesh(dropGeo, waterMat);
    d.userData.t = i / DROPS;
    house.add(d);
    return d;
  });

  // ---------- Deszcz i przelew z rynny ----------
  const RAIN = 650;
  const rainPos = new Float32Array(RAIN * 6);
  const rainDrops = Array.from({ length: RAIN }, () => ({ x: 0, y: 0, z: 0, v: 0 }));
  const respawn = (d, top = true) => {
    d.x = (Math.random() - 0.5) * 26;
    d.z = (Math.random() - 0.5) * 22;
    d.y = top ? 16 + Math.random() * 6 : Math.random() * 22;
    d.v = 18 + Math.random() * 7;
  };
  rainDrops.forEach((d) => respawn(d, false));
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMat = new THREE.LineBasicMaterial({ color: '#6c8fb8', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);
  const surfaceAt = (x, z) => {
    if (Math.abs(x) <= L / 2 + OVX && Math.abs(z) <= W / 2 + OV) return roofTop(z);
    return 0;
  };

  const OVF = 280;
  const ovfPos = new Float32Array(OVF * 6);
  const ovfDrops = Array.from({ length: OVF }, () => ({ x: 0, y: 0, z: 0, vy: 0, vz: 0 }));
  const ovfSpawn = (d, spread = true) => {
    d.x = lerp(OVER.x0, OVER.x1, Math.random());
    d.y = spread ? Math.random() * GUTTER_Y : GUTTER_Y + 0.12;
    d.z = GUTTER_Z + 0.16;
    d.vy = -(2 + Math.random() * 2);
    d.vz = 0.25 + Math.random() * 0.3;
  };
  ovfDrops.forEach((d) => ovfSpawn(d));
  const ovfGeo = new THREE.BufferGeometry();
  ovfGeo.setAttribute('position', new THREE.BufferAttribute(ovfPos, 3).setUsage(THREE.DynamicDrawUsage));
  const ovfMat = new THREE.LineBasicMaterial({ color: '#2f6fd6', transparent: true, opacity: 0, depthWrite: false });
  const overflow = new THREE.LineSegments(ovfGeo, ovfMat);
  overflow.frustumCulled = false;
  house.add(overflow);

  // ---------- Skan przeglądu ----------
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(L + 3.4, W + 3.6),
    new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  scan.rotation.x = -Math.PI / 2;
  scene.add(scan);

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const lawnTex = makeTex((g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, w * 0.1, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(203,216,196,0.9)');
    grad.addColorStop(0.7, 'rgba(214,224,208,0.55)');
    grad.addColorStop(1, 'rgba(225,233,241,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, w);
  }, 256, 256, false);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), new THREE.MeshBasicMaterial({ map: lawnTex, transparent: true, depthWrite: false }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.005;
  scene.add(lawn);

  // ---------- Kamera ----------
  // Ujęcia: front z ukosa → front (rynna, elewacja) → przy prawym szczycie, na wysokości pokoju → widok ogólny
  const SHOTS = [
    { th: 0.62, ph: 0.3, r: 1, t: [0.4, 4.3, 0] },
    { th: 0.34, ph: 0.2, r: 0.9, t: [1.2, 3.7, 1.2] },
    { th: 1.28, ph: -0.01, r: 0.5, t: [2.5, 3.85, 1.3] },
    { th: 0.78, ph: 0.36, r: 1.06, t: [0, 4.7, 0] },
  ];
  const shotAt = (p) => {
    const k1 = smoothstep(0.21, 0.3, p);
    const k2 = smoothstep(0.47, 0.57, p);
    const k3 = smoothstep(0.73, 0.8, p);
    const mix = (key, i) => {
      const v = (s) => (i === undefined ? s[key] : s[key][i]);
      let x = lerp(v(SHOTS[0]), v(SHOTS[1]), k1);
      x = lerp(x, v(SHOTS[2]), k2);
      return lerp(x, v(SHOTS[3]), k3);
    };
    return { th: mix('th'), ph: mix('ph'), r: mix('r'), t: [mix('t', 0), mix('t', 1), mix('t', 2)] };
  };

  const anim = { th: SHOTS[0].th, ph: SHOTS[0].ph, r: 1, tx: 0.4, ty: 4.3, tz: 0, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0 };
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

  let radius = 34;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    radius = 34 * Math.pow(1.35 / Math.min(camera.aspect, 1.35), 0.75);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Etykiety usterek (rzut 3D → 2D)
  const TAGS = {
    flash: { pos: new THREE.Vector3(CH.x + 0.6, roofTop(CH.z + 0.6) + 0.15, CH.z + 0.6), steps: [0] },
    gutter: { pos: new THREE.Vector3(4.6, GUTTER_Y, GUTTER_Z + 0.1), steps: [1] },
    moss: { pos: new THREE.Vector3(-3.4, roofTop(3.1) + 0.1, 3.1), steps: [1] },
    wall: { pos: new THREE.Vector3(OVER.x1 + 0.1, 2.0, W / 2), steps: [1] },
    ceiling: { pos: new THREE.Vector3(LEAK.x + 0.2, CEIL - 0.05, LEAK.z + 0.7), steps: [2] },
  };
  const tagState = tagEls.map(() => ({ a: 0, w: 0 }));
  const _v = new THREE.Vector3();
  const placeTags = (alphaOf, dt) => {
    tagEls.forEach((el, k) => {
      const key = el.dataset.dmg;
      const t = TAGS[key];
      const st = tagState[k];
      const goal = alphaOf(key, t);
      st.a = goal + ease(st.a - goal, 10, dt);
      if (st.a < 0.01) {
        el.style.opacity = '0';
        return;
      }
      _v.copy(t.pos).applyMatrix4(house.matrixWorld).project(camera);
      let x = (_v.x * 0.5 + 0.5) * stageW + 6;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      if (!st.w) st.w = el.offsetWidth || 180;
      x = Math.min(x, stageW - st.w - 10);
      el.style.opacity = st.a.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  // ---------- Pętla ----------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const bump = (k) => Math.sin(Math.PI * clamp01(k));
  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    const yrs = yearsAt(p);
    const d = damage(yrs);
    const R = rainAt(p);
    const fx = {};
    for (const key of Object.keys(FIX_H)) fx[key] = fixedAt(FIX_H[key], p);
    const eff = (key) => d[key] * (1 - fx[FIX_OF[key] || key]);

    // Wejście: dom rośnie od ziemi
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1300, 1);
    }
    house.scale.y = Math.max(1 - Math.pow(1 - anim.intro, 3), 0.001);

    // Pokrycie się starzeje, mech rośnie
    const aging = eff('aging');
    roofMat.color.copy(ROOF_NEW).lerp(ROOF_OLD, aging * 0.7);
    roofMat.roughness = 0.5 + aging * 0.35;
    const mossK = eff('moss');
    for (let i = 0; i < mossPts.length; i++) {
      const pt = mossPts[i];
      const s = Math.max(smoothstep(pt.th, pt.th + 0.2, mossK) * pt.sc, 0.0001);
      q.setFromAxisAngle(up, pt.r);
      moss.setMatrixAt(i, m4.compose(v3.set(pt.x, 0.02, pt.s), q, sc.set(s, s, s)));
    }
    moss.instanceMatrix.needsUpdate = true;

    // Pęknięcie obróbki; po naprawie krótki błysk
    const crackK = eff('crack');
    crack.visible = crack2.visible = crackK > 0.01;
    crack.scale.x = Math.max(crackK, 0.01);
    crack2.scale.x = Math.max(smoothstep(0.45, 1, crackK), 0.01);
    crackMat.emissiveIntensity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now / 300));
    flashMat.emissiveIntensity = bump(fx.crack) * 0.9;
    gutterMat.emissiveIntensity = bump(fx.gutter) * 0.9;

    // Liście w rynnie
    const clogK = eff('clog');
    for (let i = 0; i < leafPts.length; i++) {
      const pt = leafPts[i];
      const s = Math.max(smoothstep(pt.th, pt.th + 0.15, clogK) * pt.sc, 0.0001);
      q.setFromAxisAngle(up, pt.r);
      leaves.setMatrixAt(i, m4.compose(v3.set(pt.x, GUTTER_Y - 0.03, GUTTER_Z + pt.z), q, sc.set(s, s, s)));
    }
    leaves.instanceMatrix.needsUpdate = true;

    // Zaciek na elewacji
    streakMat.opacity = eff('wall');

    // Przeciek do pokoju
    const ceilK = eff('ceiling');
    stainMat.opacity = smoothstep(0, 0.2, ceilK);
    stain.scale.setScalar(Math.max(0.25 + 0.75 * ceilK, 0.01));
    chimWetMat.opacity = smoothstep(0.1, 0.8, ceilK);
    const leakK = eff('leak') * (R > 0.05 ? 1 : 0.35);
    bucket.visible = ceilK > 0.02;
    bucket.scale.setScalar(Math.max(smoothstep(0, 0.25, ceilK), 0.001));
    bucketWater.position.y = 0.04 + 0.34 * ceilK;
    puddle.visible = ceilK > 0.3;
    puddle.scale.set(1.3 * smoothstep(0.3, 1, ceilK) + 0.001, 0.8 * smoothstep(0.3, 1, ceilK) + 0.001, 1);
    drops.forEach((dr) => {
      dr.visible = leakK > 0.05 && !reduceMotion;
      if (!dr.visible) return;
      dr.userData.t = (dr.userData.t + dt * 0.9) % 1;
      const t = dr.userData.t;
      dr.position.set(LEAK.x, lerp(CEIL - 0.05, FLOOR + 0.3, t * t), LEAK.z);
    });

    // Prawy szczyt staje się przezierny — widać pokój pod przeciekiem
    const ghost = smoothstep(0.5, 0.58, p) * (1 - smoothstep(0.93, 0.99, p));
    ghostMat.opacity = 1 - 0.9 * ghost;
    ghostMat.depthWrite = ghostMat.opacity > 0.95;
    rightUp.castShadow = ghost < 0.5;
    ghostEdges.material.opacity = ghost * 0.7;
    roomLight.intensity = ghost * 7;

    // Deszcz i przelew z rynny
    rainMat.opacity = R * 0.5;
    rain.visible = R > 0.01;
    if (rain.visible) {
      for (let i = 0; i < RAIN; i++) {
        const dr = rainDrops[i];
        dr.y -= dr.v * dt;
        if (dr.y < surfaceAt(dr.x, dr.z)) respawn(dr);
        rainPos.set([dr.x, dr.y, dr.z, dr.x - 0.03, dr.y + 0.8, dr.z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    const ovfK = R * smoothstep(0.55, 0.85, clogK) * (1 - fx.gutter);
    ovfMat.opacity = ovfK * 0.95;
    overflow.visible = ovfK > 0.01;
    if (overflow.visible) {
      for (let i = 0; i < OVF; i++) {
        const dr = ovfDrops[i];
        dr.vy -= 9.8 * dt;
        dr.y += dr.vy * dt;
        dr.z += dr.vz * dt;
        if (dr.y < 0.05) ovfSpawn(dr, false);
        ovfPos.set([dr.x, dr.y, dr.z, dr.x, dr.y + 0.22, dr.z - 0.02], i * 6);
      }
      ovfGeo.attributes.position.needsUpdate = true;
    }

    // Skan przeglądu: płaszczyzna przesuwa się od ziemi po kalenicę
    const sk = scanAt(p);
    scan.visible = sk > 0.001 && sk < 0.999;
    scan.material.opacity = bump(sk) * 0.95 + 0.05;
    scan.position.y = ringY(p);

    // Kamera
    const shot = shotAt(p);
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
      // ujęcie z pokoju trzyma kadr — powoli wraca do osi
      if (step === 2) anim.yawUser *= Math.exp(-1.5 * dt);
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
    const offY = narrow ? -stageH * 0.17 * smoothstep(0.73, 0.8, p) : 0;
    camera.setViewOffset(stageW, stageH, 0, offY, stageW, stageH);
    camera.updateMatrixWorld();
    house.updateMatrixWorld();

    // Etykiety: tylko usterki z bieżącego kroku, znikają po naprawie
    const introA = smoothstep(0.7, 1, anim.intro);
    placeTags((key, t) => {
      if (!t.steps.includes(step)) return 0;
      const v = key === 'flash' ? eff('crack') : key === 'gutter' ? eff('clog') : key === 'moss' ? eff('moss') : key === 'wall' ? eff('wall') : eff('ceiling');
      return smoothstep(0.15, 0.4, v) * introA;
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
