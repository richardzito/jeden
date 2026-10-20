/* ==========================================================================
   Zajawka „Konfigurator Dachu 3D”
   Scena Three.js sterowana przewijaniem: pomiar → kształt → pokrycie → cena.
   Zwykły skrypt + dynamiczny import (import map w <head>), dzięki czemu
   strona działa też otwarta prosto z dysku (file://).
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
  const shapeSwitch = document.getElementById('shape-switch');
  const shapeBtns = [...shapeSwitch.querySelectorAll('button')];
  const matBtns = [...document.querySelectorAll('#mat-switch button')];
  const hudArea = document.getElementById('hud-area');
  const hudPrice = document.getElementById('hud-price');
  const hudDays = document.getElementById('hud-days');

  // ---------- Model danych ----------
  const MATS = [
    { name: 'Ceramika grafit', color: '#3b4045', tex: 'tile', rough: 0.55, metal: 0.05, price: 290, days: 9 },
    { name: 'Blacha na rąbek', color: '#4a372c', tex: 'seam', rough: 0.38, metal: 0.45, price: 210, days: 6 },
    { name: 'Ceramika ceglasta', color: '#a44a2c', tex: 'tile', rough: 0.6, metal: 0.0, price: 300, days: 9 },
  ];

  const D = { L: 10, W: 7.6, H: 3.0, R: 3.1, o: 0.55, plinth: 0.42 };
  D.xe = D.L / 2 + D.o;
  D.ze = D.W / 2 + D.o;
  D.He = D.H - (D.R * D.o) / (D.W / 2);
  D.Hr = D.H + D.R;
  const RL_GABLE = D.xe;
  const RL_HIP = D.xe - D.ze;
  const TU = 2.4; // metry na jedno powtórzenie tekstury (poziomo)
  const TV = 2.8; // metry na jedno powtórzenie tekstury (wzdłuż spadku)

  const state = {
    progress: 0,
    step: -1,
    manualShape: null,
    manualMat: null,
    shapeTarget: 0,
    matTarget: 0,
    visible: false,
    built: false,
  };

  // ---------- Postęp przewijania (działa też bez WebGL) ----------
  const readProgress = () => {
    const r = track.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    return Math.min(Math.max(-r.top / total, 0), 1);
  };

  const smoothstep = (a, b, x) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };

  const fmtPLN = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Cena — widełki liczone z realnej powierzchni modelu
  const pitchDeg = Math.round((Math.atan((D.Hr - D.He) / D.ze) * 180) / Math.PI);
  const roofArea = 2 * (2 * D.xe) * Math.hypot(D.ze, D.Hr - D.He); // przy stałym kącie rzut × 1/cos — tyle samo dla obu kształtów
  hudArea.textContent = `${Math.round(roofArea)} m² · kąt ${pitchDeg}°`;

  const quote = (shape, mat) => {
    const m = MATS[mat];
    const base = roofArea * m.price * (1 + 0.09 * shape);
    return {
      lo: Math.round((base * 0.93) / 100) * 100,
      hi: Math.round((base * 1.07) / 100) * 100,
      days: m.days + (shape > 0.5 ? 1 : 0),
    };
  };

  const shown = { lo: 0, hi: 0 };
  let priceAnim = null;
  const animatePrice = () => {
    const shape = state.manualShape ?? state.shapeTarget;
    const mat = state.manualMat ?? state.matTarget;
    const q = quote(shape, mat);
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
      else {
        shown.lo = q.lo;
        shown.hi = q.hi;
      }
    };
    priceAnim = requestAnimationFrame(tick);
  };

  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));

    // Cele sterowane scrollem
    state.shapeTarget = smoothstep(0.3, 0.44, p) > 0.5 ? 1 : 0;
    state.shapeScroll = smoothstep(0.3, 0.44, p);
    state.matTarget = p < 0.585 ? 0 : p < 0.665 ? 1 : 2;
    if (step === 0) {
      state.manualShape = null;
      state.manualMat = null;
    }

    if (rail) rail.style.transform = `scaleY(${p})`;

    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', Number(el.dataset.hud) === step));
      if (step === 3) animatePrice();
    }

    const shape = state.manualShape ?? state.shapeTarget;
    const mat = state.manualMat ?? state.matTarget;
    shapeSwitch.style.setProperty('--i', shape);
    shapeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === shape)));
    matBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === mat)));
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

  shapeBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.manualShape = Number(b.dataset.shape);
      syncUI();
    })
  );
  matBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.manualMat = Number(b.dataset.mat);
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
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 200);
  const target = new THREE.Vector3(0, 2.7, 0);

  // Światło
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdbfb0', 0.55));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-9, 15, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);

  // ---------- Tekstury proceduralne ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeTex = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // Dachówka: 8 rzędów × 8 kolumn, cień pod każdym rzędem, rowki między dachówkami
  const tileTex = makeTex((g) => {
    const rows = 8, cols = 8, rh = 64, cw = 64;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * rh;
        const v = 0.9 + Math.random() * 0.12; // delikatna różnica odcieni
        const grad = g.createLinearGradient(0, y, 0, y + rh);
        grad.addColorStop(0, `rgb(${235 * v},${235 * v},${235 * v})`);
        grad.addColorStop(0.75, `rgb(${200 * v},${200 * v},${200 * v})`);
        grad.addColorStop(1, `rgb(${150 * v},${150 * v},${150 * v})`);
        g.fillStyle = grad;
        g.fillRect(x, y, cw, rh);
        // przetłoczenie dachówki
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(x + cw * 0.18, y + 6, 3, rh - 18);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + cw * 0.18 + 3, y + 6, 2, rh - 18);
        // rowek pionowy
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x + cw - 3, y, 3, rh);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, 1.5, rh);
      }
      // cień rzędu powyżej (nakładka dachówek)
      const sy = r * rh + rh - 9;
      const sg = g.createLinearGradient(0, sy, 0, sy + 9);
      sg.addColorStop(0, 'rgba(0,0,0,0.15)');
      sg.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = sg;
      g.fillRect(0, sy, 512, 9);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, r * rh, 512, 2);
    }
  });

  // Blacha na rąbek: panele z wyraźnym zamkiem co 1/4 szerokości
  const seamTex = makeTex((g) => {
    g.fillStyle = 'rgb(214,214,214)';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      const pg = g.createLinearGradient(x, 0, x + 128, 0);
      pg.addColorStop(0, 'rgb(205,205,205)');
      pg.addColorStop(0.5, 'rgb(226,226,226)');
      pg.addColorStop(1, 'rgb(200,200,200)');
      g.fillStyle = pg;
      g.fillRect(x, 0, 128, 512);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x + 122, 0, 3, 512);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x + 125, 0, 3, 512);
    }
  });

  const texFor = (m) => (m.tex === 'tile' ? tileTex : seamTex);

  const makeRoofMat = (m) =>
    new THREE.MeshStandardMaterial({
      color: m.color,
      map: texFor(m),
      bumpMap: texFor(m),
      bumpScale: m.tex === 'tile' ? 2.2 : 1.2,
      roughness: m.rough,
      metalness: m.metal,
      side: THREE.DoubleSide,
      clipShadows: true,
      envMapIntensity: 0.8,
    });

  const applyMat = (material, m) => {
    material.color.set(m.color);
    material.map = texFor(m);
    material.bumpMap = texFor(m);
    material.bumpScale = m.tex === 'tile' ? 2.2 : 1.2;
    material.roughness = m.rough;
    material.metalness = m.metal;
    material.needsUpdate = true;
  };

  // Płaszczyzny cięcia dla „przekrywania” dachu nowym materiałem
  const clipOld = new THREE.Plane(new THREE.Vector3(1, 0, 0), 100);
  const clipNew = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -100);
  const roofMatA = makeRoofMat(MATS[0]);
  const roofMatB = makeRoofMat(MATS[0]);
  roofMatA.clippingPlanes = [clipOld];
  roofMatB.clippingPlanes = [clipNew];

  // ---------- Materiały budynku ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.92, side: THREE.DoubleSide });
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#8f8780', roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.5, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33404b', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.7 });
  const brickMat = new THREE.MeshStandardMaterial({ color: '#3d3734', roughness: 0.85 });

  const house = new THREE.Group();
  scene.add(house);

  // Ściany (grupa rośnie od ziemi przy wejściu)
  const walls = new THREE.Group();
  house.add(walls);

  const wallH = D.H - D.plinth;
  const body = new THREE.Mesh(new THREE.BoxGeometry(D.L, wallH, D.W), wallMat);
  body.position.y = D.plinth + wallH / 2;
  body.castShadow = body.receiveShadow = true;
  walls.add(body);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(D.L + 0.08, D.plinth, D.W + 0.08), plinthMat);
  plinth.position.y = D.plinth / 2;
  plinth.castShadow = plinth.receiveShadow = true;
  walls.add(plinth);

  // Okna: [oś, pozycja wzdłuż ściany, szerokość, wysokość, dół]
  const addOpening = (side, along, w, h, bottom, mat = glassMat) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.08), frameMat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    pane.position.z = 0.045;
    g.add(frame, pane);
    if (mat === glassMat && w > 1.6) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.04), frameMat);
      mullion.position.z = 0.06;
      g.add(mullion);
    }
    g.position.y = bottom + h / 2;
    if (side === 'front') g.position.set(along, g.position.y, D.W / 2 + 0.01);
    if (side === 'back') {
      g.position.set(along, g.position.y, -D.W / 2 - 0.01);
      g.rotation.y = Math.PI;
    }
    if (side === 'right') {
      g.position.set(D.L / 2 + 0.01, g.position.y, along);
      g.rotation.y = Math.PI / 2;
    }
    if (side === 'left') {
      g.position.set(-D.L / 2 - 0.01, g.position.y, along);
      g.rotation.y = -Math.PI / 2;
    }
    walls.add(g);
  };
  addOpening('front', -3.0, 1.3, 1.45, 1.05);
  addOpening('front', 0.1, 2.6, 2.15, 0.45);
  addOpening('front', 3.3, 1.3, 1.45, 1.05);
  addOpening('right', 1.6, 1.0, 2.15, 0.45, doorMat);
  addOpening('right', -1.6, 1.3, 1.45, 1.05);
  addOpening('left', 0, 1.3, 1.45, 1.05);
  addOpening('back', -2.2, 1.3, 1.45, 1.05);
  addOpening('back', 2.2, 1.3, 1.45, 1.05);

  // Szczyty ścian (wypełnienie pod dachem dwuspadowym)
  const gableGeo = new THREE.BufferGeometry();
  const gable = new THREE.Mesh(gableGeo, wallMat);
  gable.castShadow = gable.receiveShadow = true;
  walls.add(gable);

  // Dach (grupa opada na miejsce przy wejściu)
  const roof = new THREE.Group();
  house.add(roof);
  const roofGeo = new THREE.BufferGeometry();
  const roofA = new THREE.Mesh(roofGeo, roofMatA);
  const roofB = new THREE.Mesh(roofGeo, roofMatB);
  roofA.castShadow = roofB.castShadow = true;
  roofA.receiveShadow = roofB.receiveShadow = true;
  roof.add(roofA, roofB);

  const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 0.26), trimMat);
  ridgeCap.castShadow = true;
  roof.add(ridgeCap);

  const edgeTrims = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.1), trimMat);
    m.castShadow = true;
    roof.add(m);
    return m;
  });

  const gutterGeo = new THREE.CylinderGeometry(0.075, 0.075, D.xe * 2 + 0.1, 12);
  [-1, 1].forEach((s) => {
    const gt = new THREE.Mesh(gutterGeo, trimMat);
    gt.rotation.z = Math.PI / 2;
    gt.position.set(0, D.He - 0.06, s * (D.ze + 0.03));
    gt.castShadow = true;
    roof.add(gt);
  });

  const chimney = new THREE.Group();
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 3.2, 0.62), brickMat);
  stack.position.y = D.Hr + 0.75 - 1.6;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.78), trimMat);
  cap.position.y = D.Hr + 0.8;
  stack.castShadow = cap.castShadow = true;
  chimney.add(stack, cap);
  chimney.position.set(-1.9, 0, -1.0);
  roof.add(chimney);

  // Pomiar (krok 1): przerywany obrys okapu + skanująca płaszczyzna
  const measure = new THREE.Group();
  scene.add(measure);
  const outlinePts = [
    new THREE.Vector3(-D.xe, D.He, D.ze),
    new THREE.Vector3(D.xe, D.He, D.ze),
    new THREE.Vector3(D.xe, D.He, -D.ze),
    new THREE.Vector3(-D.xe, D.He, -D.ze),
    new THREE.Vector3(-D.xe, D.He, D.ze),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePts),
    new THREE.LineDashedMaterial({ color: '#7b4b2a', dashSize: 0.35, gapSize: 0.22, transparent: true, depthTest: false })
  );
  outline.computeLineDistances();
  outline.renderOrder = 10;
  measure.add(outline);

  const groundOutline = outline.clone();
  groundOutline.position.y = -D.He + 0.02;
  measure.add(groundOutline);

  const scanMat = new THREE.MeshBasicMaterial({
    color: '#b07a4f',
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(D.ze * 2 + 0.6, D.Hr + 1.2), scanMat);
  scan.rotation.y = Math.PI / 2;
  scan.position.y = (D.Hr + 1.2) / 2;
  measure.add(scan);
  const scanEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, D.Hr + 1.2, D.ze * 2 + 0.6),
    new THREE.MeshBasicMaterial({ color: '#7b4b2a', transparent: true, opacity: 0.6, depthWrite: false })
  );
  scanEdge.position.y = scan.position.y;
  measure.add(scanEdge);

  // Podłoże: cień rzucany + miękki cień kontaktowy
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 256;
  {
    const g = contactCanvas.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(60,40,25,0.55)');
    grad.addColorStop(0.6, 'rgba(60,40,25,0.12)');
    grad.addColorStop(1, 'rgba(60,40,25,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(D.L * 1.7, D.W * 1.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(contactCanvas), transparent: true, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.005;
  scene.add(contact);

  // ---------- Geometria dachu zależna od długości kalenicy ----------
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const placeBetween = (mesh, a, b) => {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    const dir = _b.copy(b).sub(a);
    mesh.scale.set(1, dir.length() + 0.12, 1);
    mesh.quaternion.setFromUnitVectors(_up, dir.normalize());
  };

  // Bufory alokowane raz — morfing tylko nadpisuje wartości (bez nowych buforów GPU)
  const ROOF_VERTS = 18;
  const roofPos = new THREE.BufferAttribute(new Float32Array(ROOF_VERTS * 3), 3);
  const roofUv = new THREE.BufferAttribute(new Float32Array(ROOF_VERTS * 2), 2);
  roofPos.setUsage(THREE.DynamicDrawUsage);
  roofUv.setUsage(THREE.DynamicDrawUsage);
  roofGeo.setAttribute('position', roofPos);
  roofGeo.setAttribute('uv', roofUv);
  const gablePos = new THREE.BufferAttribute(new Float32Array(12 * 3), 3);
  gablePos.setUsage(THREE.DynamicDrawUsage);
  gableGeo.setAttribute('position', gablePos);
  const tip = new THREE.Vector3();

  let lastRl = null;
  const buildRoof = (rl) => {
    if (lastRl !== null && Math.abs(rl - lastRl) < 0.0005) return;
    lastRl = rl;
    const { xe, ze, He, Hr, L, W, H, R, o } = D;
    const pos = [];
    const uv = [];
    const slant = Math.hypot(ze, Hr - He);
    const tri = (p, t) => {
      pos.push(...p[0], ...p[1], ...p[2]);
      uv.push(...t[0], ...t[1], ...t[2]);
    };
    const quad = (a, b, c, d, ta, tb, tc, td) => {
      tri([a, b, c], [ta, tb, tc]);
      tri([a, c, d], [ta, tc, td]);
    };
    const u = (x) => (x + xe) / TU;
    // połać przednia i tylna
    quad(
      [-xe, He, ze], [xe, He, ze], [rl, Hr, 0], [-rl, Hr, 0],
      [u(-xe), 0], [u(xe), 0], [u(rl), slant / TV], [u(-rl), slant / TV]
    );
    quad(
      [xe, He, -ze], [-xe, He, -ze], [-rl, Hr, 0], [rl, Hr, 0],
      [u(-xe), 0], [u(xe), 0], [u(rl), slant / TV], [u(-rl), slant / TV]
    );
    // połacie boczne (kopertowe) — znikają przy dachu dwuspadowym
    const run = xe - rl;
    if (run > 0.02) {
      const endSlant = Math.hypot(run, Hr - He) / TV;
      const w = (z) => (z + ze) / TU;
      tri([[xe, He, ze], [xe, He, -ze], [rl, Hr, 0]], [[w(-ze), 0], [w(ze), 0], [w(0), endSlant]]);
      tri([[-xe, He, -ze], [-xe, He, ze], [-rl, Hr, 0]], [[w(-ze), 0], [w(ze), 0], [w(0), endSlant]]);
    }
    roofPos.array.fill(0);
    roofUv.array.fill(0);
    roofPos.array.set(pos);
    roofUv.array.set(uv);
    roofPos.needsUpdate = true;
    roofUv.needsUpdate = true;
    roofGeo.computeVertexNormals();
    roofGeo.computeBoundingSphere();

    // Szczyt ściany: wysokość połaci bocznej nad linią ściany
    const gp = [];
    let hHip = Hr;
    if (rl < L / 2) hHip = He + ((Hr - He) * o) / (xe - rl);
    const top = Math.min(hHip, Hr) - 0.03;
    if (top > H + 0.02) {
      const z1 = (W / 2) * (1 - (top - H) / R);
      for (const s of [1, -1]) {
        const x = (s * L) / 2;
        const A = [x, H - 0.01, W / 2], B = [x, H - 0.01, -W / 2], C = [x, top, -z1], Dd = [x, top, z1];
        gp.push(...A, ...B, ...C, ...A, ...C, ...Dd);
      }
    }
    gablePos.array.fill(0);
    gablePos.array.set(gp);
    gablePos.needsUpdate = true;
    gableGeo.computeVertexNormals();
    gableGeo.computeBoundingSphere();

    // Kalenica i obróbki krawędzi (narożne / wiatrownice)
    ridgeCap.scale.x = rl * 2 + 0.16;
    ridgeCap.position.set(0, Hr + 0.04, 0);
    CORNERS.forEach(([cx, cz], i) => {
      _a.set(cx, He + 0.03, cz);
      tip.set(Math.sign(cx) * rl, Hr + 0.03, 0);
      placeBetween(edgeTrims[i], _a, tip);
    });
  };
  const CORNERS = [[D.xe, D.ze], [D.xe, -D.ze], [-D.xe, D.ze], [-D.xe, -D.ze]];

  // ---------- Stan animacji ----------
  const anim = {
    rl: RL_GABLE,
    theta: -0.8,
    phi: 0.3,
    yawUser: 0,
    yawVel: 0,
    px: 0,
    py: 0,
    measure: 1,
    build: reduceMotion ? 1 : 0,
    buildStart: 0,
  };
  let matShown = 0;
  let wipe = null; // { to, t0 }

  const startWipe = (to) => {
    applyMat(roofMatB, MATS[to]);
    wipe = { to, t0: performance.now() };
    if (reduceMotion) finishWipe();
  };
  const finishWipe = () => {
    applyMat(roofMatA, MATS[wipe.to]);
    matShown = wipe.to;
    wipe = null;
    clipOld.constant = 100;
    clipNew.constant = -100;
  };

  // Wskaźnik: delikatny „parallax” sprężynowy + przeciąganie z pędem
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
      anim.yawVel = (-dx * 0.008) / Math.max(now - lastT, 1) * 1000;
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
  let radius = 30;
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // dopasuj odległość kamery, żeby dom mieścił się w kadrze
    const fit = 1.25 / Math.min(camera.aspect, 1.25);
    radius = 31 * Math.pow(fit, 0.85);
    target.y = camera.aspect < 1 ? 2.3 : 2.7;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- Pętla ----------
  const ease = (x, k, dt) => x * Math.exp(-k * dt); // pozostała różnica po dt
  let last = performance.now();
  let raf = 0;

  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;

    // Wejście domu (raz, gdy scena jest naprawdę w kadrze): ściany rosną, dach opada
    if (anim.build < 1 && state.inView) {
      if (!anim.buildStart) anim.buildStart = now;
      anim.build = Math.min((now - anim.buildStart) / 1500, 1);
    }
    const b = anim.build;
    const wallsK = 1 - Math.pow(1 - Math.min(b / 0.5, 1), 3);
    walls.scale.y = Math.max(wallsK, 0.001);
    const roofT = Math.min(Math.max((b - 0.35) / 0.65, 0), 1);
    // lekkie dobicie — dach „siada” na ścianach
    const s = 1 - roofT;
    roof.position.y = 6 * s * s * s - Math.sin(roofT * Math.PI) * 0.08 * (1 - roofT);
    roof.visible = roofT > 0;

    // Kształt: scroll płynnie, klik — szybciej
    const shapeGoal =
      state.manualShape !== null ? state.manualShape : (state.shapeScroll ?? 0);
    const rlGoal = RL_GABLE + (RL_HIP - RL_GABLE) * shapeGoal;
    anim.rl = rlGoal + ease(anim.rl - rlGoal, 7, dt);
    buildRoof(anim.rl);

    // Materiał: kolejka „przekrywania”
    const matGoal = state.manualMat ?? state.matTarget;
    if (!wipe && matGoal !== matShown) startWipe(matGoal);
    if (wipe) {
      const k = Math.min((now - wipe.t0) / 1100, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const x = -D.xe - 0.3 + (D.xe * 2 + 0.6) * e;
      clipOld.constant = -x; // stary materiał zostaje po prawej
      clipNew.constant = x; // nowy pojawia się od lewej
      if (k >= 1) finishWipe();
    }

    // Pomiar widoczny w kroku 1
    const mGoal = p < 0.22 ? 1 : 0;
    anim.measure = mGoal + ease(anim.measure - mGoal, 6, dt);
    measure.visible = anim.measure > 0.01 && b >= 1;
    outline.material.opacity = anim.measure;
    scanMat.opacity = 0.16 * anim.measure;
    scanEdge.material.opacity = 0.55 * anim.measure;
    const sweep = ((now / 2600) % 1) * (D.xe * 2 + 2) - D.xe - 1;
    scan.position.x = scanEdge.position.x = sweep;

    // Kamera: orbita sterowana scrollem + wskaźnik + przeciąganie
    const span = reduceMotion ? 0.35 : 1.35;
    const thetaGoal = -0.8 + span * smoothstep(0, 1, p) + anim.px * 0.1;
    const phiGoal = 0.28 + 0.14 * p - anim.py * 0.04;
    anim.theta = thetaGoal + ease(anim.theta - thetaGoal, 5, dt);
    anim.phi = phiGoal + ease(anim.phi - phiGoal, 5, dt);
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.theta + anim.yawUser;
    const r = radius * (1 - 0.06 * smoothstep(0.75, 1, p));
    camera.position.set(
      Math.sin(th) * Math.cos(anim.phi) * r,
      target.y + Math.sin(anim.phi) * r,
      Math.cos(th) * Math.cos(anim.phi) * r
    );
    camera.lookAt(target);

    renderer.render(scene, camera);

    if (state.visible) raf = requestAnimationFrame(frame);
  };

  // Renderuj tylko gdy scena jest na ekranie
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

  buildRoof(RL_GABLE);
  syncUI();
}
})();
