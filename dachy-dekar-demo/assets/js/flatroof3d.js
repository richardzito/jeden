/* ==========================================================================
   Zajawka „Przekrój Dachu 3D” — dach płaski rozkładany na warstwy.
   Sterowana przewijaniem: pomiar → warstwy → ocieplenie → cena.
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

  // ---------- Elementy UI ----------
  const stepEls = [...document.querySelectorAll('.wow__step')];
  const hudEls = [...stage.querySelectorAll('[data-hud]')];
  const rail = document.getElementById('wow-rail');
  const insSwitch = document.getElementById('ins-switch');
  const insBtns = [...insSwitch.querySelectorAll('button')];
  const tagEls = [...stage.querySelectorAll('.layer-tag')];
  const tagIns = document.getElementById('tag-ins');
  const hudArea = document.getElementById('hud-area');
  const hudU = document.getElementById('hud-u');
  const hudWt = document.getElementById('hud-wt');
  const hudPrice = document.getElementById('hud-price');
  const hudDays = document.getElementById('hud-days');

  // ---------- Model danych ----------
  // U = 1 / (Rsi + Rse + R stropu + d/λ); Rsi 0,10, Rse 0,04, strop żelbet 20 cm ≈ 0,12
  const INS = [
    { name: 'EPS 10 cm', d: 0.1, lambda: 0.036, color: '#efede6', price: 165, days: 4 },
    { name: 'EPS 20 cm', d: 0.2, lambda: 0.036, color: '#f2f0ea', price: 195, days: 4 },
    { name: 'PIR 16 cm', d: 0.16, lambda: 0.022, color: '#d9c48f', price: 240, days: 5 },
  ];
  const WT_LIMIT = 0.15;
  const uValue = (o) => 1 / (0.1 + 0.04 + 0.12 + o.d / o.lambda);

  const B = { L: 14, W: 10, H: 6.4, slab: 0.3, parapet: 0.9, wall: 0.25 };
  B.Li = B.L - 2 * B.wall;
  B.Wi = B.W - 2 * B.wall;
  B.top = B.H + B.slab;
  const INS_SCALE = 1.6; // grubości warstw lekko powiększone dla czytelności
  const T = { vapour: 0.05, under: 0.05, cap: 0.07 };
  const area = B.Li * B.Wi;
  hudArea.textContent = `${Math.round(area)} m² · spadek 2%`;

  const state = {
    progress: 0,
    step: -1,
    manualIns: null,
    insTarget: 0,
    visible: false,
    inView: false,
  };

  const smoothstep = (a, b, x) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };
  const fmtPLN = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmtU = (u) => u.toFixed(2).replace('.', ',');

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    return Math.min(Math.max(-r.top / total, 0), 1);
  };

  const quote = (i) => {
    const o = INS[i];
    const base = area * o.price;
    return {
      lo: Math.round((base * 0.92) / 100) * 100,
      hi: Math.round((base * 1.08) / 100) * 100,
      days: o.days,
    };
  };

  // Licznik ceny
  const shown = { lo: 0, hi: 0 };
  let priceAnim = 0;
  const animatePrice = () => {
    const q = quote(state.manualIns ?? state.insTarget);
    hudDays.textContent = `ok. ${q.days} dni`;
    if (q.lo === shown.lo && q.hi === shown.hi) return;
    const from = { ...shown };
    const t0 = performance.now();
    const dur = reduceMotion ? 1 : 800;
    cancelAnimationFrame(priceAnim);
    const tick = (t) => {
      const k = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      shown.lo = from.lo + (q.lo - from.lo) * e;
      shown.hi = from.hi + (q.hi - from.hi) * e;
      hudPrice.textContent = `${fmtPLN(Math.round(shown.lo / 100) * 100)} – ${fmtPLN(Math.round(shown.hi / 100) * 100)} zł`;
      if (k < 1) priceAnim = requestAnimationFrame(tick);
      else Object.assign(shown, q);
    };
    priceAnim = requestAnimationFrame(tick);
  };

  let lastIns = -1;
  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    state.insTarget = p < 0.585 ? 0 : p < 0.665 ? 1 : 2;
    if (step < 2) state.manualIns = null;

    if (rail) rail.style.transform = `scaleY(${p})`;

    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', Number(el.dataset.hud) === step));
    }

    const ins = state.manualIns ?? state.insTarget;
    if (ins !== lastIns) {
      lastIns = ins;
      insSwitch.style.setProperty('--i', ins);
      insBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === ins)));
      const u = uValue(INS[ins]);
      hudU.innerHTML = `${fmtU(u)} <small>W/m²K</small>`;
      const ok = u <= WT_LIMIT;
      hudWt.classList.toggle('is-ok', ok);
      hudWt.textContent = ok ? 'Spełnia WT 2021 (≤ 0,15)' : 'Powyżej limitu WT 2021 (0,15)';
      tagIns.textContent = `Ocieplenie ${INS[ins].name}`;
    }
    if (state.step === 3) animatePrice();
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

  insBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.manualIns = Number(b.dataset.ins);
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

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 300);
  const target = new THREE.Vector3(0, 4, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#cdbfb0', 0.55));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-12, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // ---------- Tekstury proceduralne ----------
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
  const grain = (g, s, base, spread, count) => {
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < count; i++) {
      const v = base + (Math.random() - 0.5) * spread;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
  };

  // Papa wierzchnia: posypka + zakłady pasów co 1 m (128 px)
  const papaTex = makeTex((g, s) => {
    grain(g, s, 205, 70, 26000);
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = 'rgba(0,0,0,0.10)';
      g.fillRect(0, y, s, 12);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, y + 12, s, 2);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, y + 14, s, 1);
    }
  });
  papaTex.repeat.set(B.Li / 4, B.Wi / 4);

  // Ocieplenie: płyty 1 × 0,5 m (128 × 64 px)
  const boardTex = makeTex((g, s) => {
    grain(g, s, 235, 22, 9000);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = 0; x < s; x += 128) g.fillRect(x, 0, 2, s);
    for (let y = 0; y < s; y += 64) g.fillRect(0, y, s, 2);
  });
  boardTex.repeat.set(B.Li / 4, B.Wi / 4);

  const fineTex = makeTex((g, s) => grain(g, s, 215, 40, 16000), 256);
  fineTex.repeat.set(B.Li / 3, B.Wi / 3);

  // ---------- Materiały ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.92 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#8f8780', roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33404b', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const copingMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#b9b4ac', roughness: 0.95, map: fineTex });
  const vapourMat = new THREE.MeshStandardMaterial({ color: '#3d4b5c', roughness: 0.35, metalness: 0.35, map: fineTex });
  const insMat = new THREE.MeshStandardMaterial({ color: INS[0].color, roughness: 0.9, map: boardTex, bumpMap: boardTex, bumpScale: 1.5 });
  const underMat = new THREE.MeshStandardMaterial({ color: '#2b2b2c', roughness: 0.75, map: fineTex });
  const papaMat = new THREE.MeshStandardMaterial({ color: '#5c6064', roughness: 0.9, map: papaTex, bumpMap: papaTex, bumpScale: 2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2f3134', roughness: 0.6, metalness: 0.2 });

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Budynek ----------
  const building = new THREE.Group();
  scene.add(building);

  const plinth = box(B.L + 0.1, 0.45, B.W + 0.1, plinthMat);
  plinth.position.y = 0.225;
  const body = box(B.L, B.H - 0.45, B.W, wallMat);
  body.position.y = 0.45 + (B.H - 0.45) / 2;
  building.add(plinth, body);

  // Pasy okien na dwóch kondygnacjach
  const ribbon = (side, len, y) => {
    const g = new THREE.Group();
    const frame = box(len + 0.12, 1.42, 0.08, frameMat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.3), glassMat);
    pane.position.z = 0.045;
    g.add(frame, pane);
    const n = Math.round(len / 1.6);
    for (let i = 1; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.04), frameMat);
      m.position.set(-len / 2 + (len / n) * i, 0, 0.06);
      g.add(m);
    }
    g.position.y = y;
    if (side === 'front') g.position.z = B.W / 2 + 0.01;
    if (side === 'back') {
      g.position.z = -B.W / 2 - 0.01;
      g.rotation.y = Math.PI;
    }
    if (side === 'right') {
      g.position.x = B.L / 2 + 0.01;
      g.rotation.y = Math.PI / 2;
    }
    if (side === 'left') {
      g.position.x = -B.L / 2 - 0.01;
      g.rotation.y = -Math.PI / 2;
    }
    building.add(g);
  };
  for (const y of [1.75, 4.75]) {
    ribbon('front', B.L - 2.4, y);
    ribbon('back', B.L - 2.4, y);
    ribbon('right', B.W - 2.4, y);
    ribbon('left', B.W - 2.4, y);
  }

  // Strop + attyka (zostają na miejscu)
  const slab = box(B.L, B.slab, B.W, slabMat);
  slab.position.y = B.H + B.slab / 2;
  building.add(slab);

  const attyka = new THREE.Group();
  const pH = B.parapet;
  const parts = [
    [B.L, pH, B.wall, 0, B.W / 2 - B.wall / 2],
    [B.L, pH, B.wall, 0, -B.W / 2 + B.wall / 2],
    [B.wall, pH, B.Wi, B.L / 2 - B.wall / 2, 0],
    [B.wall, pH, B.Wi, -B.L / 2 + B.wall / 2, 0],
  ];
  for (const [w, h, d, x, z] of parts) {
    const m = box(w, h, d, wallMat);
    m.position.set(x, B.top + h / 2, z);
    attyka.add(m);
    const c = box(w + 0.08, 0.05, d + 0.08, copingMat);
    c.position.set(x, B.top + h + 0.025, z);
    attyka.add(c);
  }
  building.add(attyka);

  // ---------- Warstwy dachu ----------
  const mkLayer = (mat, t) => {
    const g = new THREE.Group();
    const m = box(B.Li, 1, B.Wi, mat);
    m.scale.y = t;
    g.add(m);
    g.userData.mesh = m;
    building.add(g);
    return g;
  };
  const L1 = mkLayer(vapourMat, T.vapour);
  const L2 = mkLayer(insMat, INS[0].d * INS_SCALE);
  const L3 = mkLayer(underMat, T.under);
  const L4 = mkLayer(papaMat, T.cap);

  // Detale na wierzchu: świetliki i wywiewki (jadą razem z papą)
  const addSkylight = (x, z) => {
    const g = new THREE.Group();
    const curb = box(1.6, 0.35, 1.1, wallMat);
    curb.position.y = 0.175;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.0), glassMat);
    glass.position.y = 0.39;
    glass.castShadow = true;
    g.add(curb, glass);
    g.position.set(x, T.cap / 2, z);
    L4.add(g);
  };
  addSkylight(-3.2, 0.6);
  addSkylight(0.4, -1.2);
  const addVent = (x, z) => {
    const v = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), darkMat));
    v.position.set(x, T.cap / 2 + 0.3, z);
    const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), darkMat));
    cap.position.set(x, T.cap / 2 + 0.63, z);
    L4.add(v, cap);
  };
  addVent(3.6, 2.2);
  addVent(4.4, -2.6);
  addVent(-5.0, -2.8);

  // ---------- Pomiar (krok 1) ----------
  const measure = new THREE.Group();
  scene.add(measure);
  const yM = B.top + pH + 0.06;
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-B.L / 2, yM, B.W / 2),
      new THREE.Vector3(B.L / 2, yM, B.W / 2),
      new THREE.Vector3(B.L / 2, yM, -B.W / 2),
      new THREE.Vector3(-B.L / 2, yM, -B.W / 2),
      new THREE.Vector3(-B.L / 2, yM, B.W / 2),
    ]),
    new THREE.LineDashedMaterial({ color: '#7b4b2a', dashSize: 0.4, gapSize: 0.25, transparent: true, depthTest: false })
  );
  outline.computeLineDistances();
  outline.renderOrder = 10;
  measure.add(outline);
  const groundOutline = outline.clone();
  groundOutline.position.y = -yM + 0.02;
  measure.add(groundOutline);
  const scanH = yM + 1.2;
  const scanMat = new THREE.MeshBasicMaterial({ color: '#b07a4f', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(B.W + 1, scanH), scanMat);
  scan.rotation.y = Math.PI / 2;
  scan.position.y = scanH / 2;
  const scanEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, scanH, B.W + 1),
    new THREE.MeshBasicMaterial({ color: '#7b4b2a', transparent: true, opacity: 0.55, depthWrite: false })
  );
  scanEdge.position.y = scanH / 2;
  measure.add(scan, scanEdge);

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  {
    const g = cc.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(60,40,25,0.5)');
    grad.addColorStop(0.6, 'rgba(60,40,25,0.1)');
    grad.addColorStop(1, 'rgba(60,40,25,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(B.L * 1.7, B.W * 1.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.005;
  scene.add(contact);

  // ---------- Stan animacji ----------
  const anim = {
    explode: 0,
    insT: INS[0].d * INS_SCALE,
    insColor: new THREE.Color(INS[0].color),
    theta: -0.75,
    phi: 0.42,
    yawUser: 0,
    yawVel: 0,
    px: 0,
    py: 0,
    measure: 1,
    build: reduceMotion ? 1 : 0,
    buildStart: 0,
    targetY: 4,
  };
  const ease = (x, k, dt) => x * Math.exp(-k * dt);

  // Wskaźnik: parallax + przeciąganie z pędem
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

  // ---------- Rozmiar ----------
  let radius = 40;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    // wąska scena (telefon): bliżej, żeby budynek wypełniał kadr
    radius = 44 * Math.pow(1.3 / Math.min(camera.aspect, 1.3), 0.3);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- Etykiety warstw (rzut 3D → 2D) ----------
  const layerGroups = [slab, L1, L2, L3, L4];
  const _v = new THREE.Vector3();
  const tagW = tagEls.map(() => 0);
  const placeTags = (alpha) => {
    tagEls.forEach((el, k) => {
      const i = Number(el.dataset.layer);
      const obj = layerGroups[i];
      const yWorld = i === 0 ? slab.position.y : obj.position.y;
      _v.set(B.Li / 2, yWorld, B.Wi / 2).project(camera);
      let x = (_v.x * 0.5 + 0.5) * stageW + 10;
      const y = (-_v.y * 0.5 + 0.5) * stageH;
      if (!tagW[k]) tagW[k] = el.offsetWidth || 160;
      x = Math.min(x, stageW - tagW[k] - 10);
      const a = Math.min(Math.max(alpha * 1.4 - (4 - i) * 0.08, 0), 1);
      el.style.opacity = a.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
    });
  };

  // ---------- Pętla ----------
  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;

    // Wejście (raz): budynek rośnie od ziemi, dach „układa się” warstwami
    if (anim.build < 1 && state.inView) {
      if (!anim.buildStart) anim.buildStart = now;
      anim.build = Math.min((now - anim.buildStart) / 1600, 1);
    }
    const b = anim.build;
    building.scale.y = Math.max(1 - Math.pow(1 - Math.min(b / 0.55, 1), 3), 0.001);

    // Rozłożenie warstw: krok 2–3 otwarte, krok 4 składa z powrotem
    const exGoal = smoothstep(0.27, 0.42, p) * (1 - smoothstep(0.77, 0.87, p));
    anim.explode = exGoal + ease(anim.explode - exGoal, 6, dt);
    const ex = anim.explode;

    // Ocieplenie: grubość i kolor
    const ins = INS[state.manualIns ?? state.insTarget];
    const tGoal = ins.d * INS_SCALE;
    anim.insT = tGoal + ease(anim.insT - tGoal, 8, dt);
    anim.insColor.lerp(new THREE.Color(ins.color), 1 - Math.exp(-8 * dt));
    insMat.color.copy(anim.insColor);
    L2.userData.mesh.scale.y = anim.insT;

    // Układ pionowy warstw (+ wejście: warstwy opadają po kolei)
    const GAP = stageW < 600 ? 1.9 : 1.35; // na telefonie większe odstępy — etykiety się nie nakładają
    const thick = [T.vapour, anim.insT, T.under, T.cap];
    let y = B.top;
    [L1, L2, L3, L4].forEach((g, i) => {
      const t = thick[i];
      const drop = Math.min(Math.max((b - 0.45 - i * 0.1) / 0.3, 0), 1);
      const s = 1 - drop;
      g.visible = drop > 0;
      g.position.y = y + t / 2 + ex * GAP * (i + 1) + 4 * s * s * s;
      y += t;
    });

    // Pomiar
    const mGoal = p < 0.22 ? 1 : 0;
    anim.measure = mGoal + ease(anim.measure - mGoal, 6, dt);
    measure.visible = anim.measure > 0.01 && b >= 1;
    outline.material.opacity = anim.measure;
    groundOutline.material = outline.material;
    scanMat.opacity = 0.14 * anim.measure;
    scanEdge.material.opacity = 0.5 * anim.measure;
    scan.position.x = scanEdge.position.x = ((now / 2800) % 1) * (B.L + 3) - B.L / 2 - 1.5;

    // Kamera
    const span = reduceMotion ? 0.3 : 1.1;
    const thetaGoal = -0.75 + span * smoothstep(0, 1, p) + anim.px * 0.1;
    const phiGoal = 0.42 + 0.1 * ex - anim.py * 0.04;
    anim.theta = thetaGoal + ease(anim.theta - thetaGoal, 5, dt);
    anim.phi = phiGoal + ease(anim.phi - phiGoal, 5, dt);
    const tyGoal = 3.6 + ex * 3.2;
    anim.targetY = tyGoal + ease(anim.targetY - tyGoal, 5, dt);
    target.y = anim.targetY;
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.theta + anim.yawUser;
    const r = radius * (1 + 0.08 * ex);
    camera.position.set(
      Math.sin(th) * Math.cos(anim.phi) * r,
      target.y + Math.sin(anim.phi) * r,
      Math.cos(th) * Math.cos(anim.phi) * r
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    // przy rozłożeniu model ustępuje miejsca etykietom po prawej
    camera.setViewOffset(stageW, stageH, ex * stageW * 0.12, 0, stageW, stageH);

    placeTags(b >= 1 ? ex : 0);
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
