/* ==========================================================================
   Zajawka „Zobacz, jak powstaje Twój dach” — budowa dachu w 3D
   sterowana przewijaniem: więźba → membrana i łaty → pokrycie → kolor i cena.
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
  const matBtns = [...document.querySelectorAll('#mat-switch button')];
  const hudRafters = document.getElementById('hud-rafters');
  const hudBattens = document.getElementById('hud-battens');
  const hudCover = document.getElementById('hud-cover');
  const hudPrice = document.getElementById('hud-price');
  const hudDays = document.getElementById('hud-days');

  // ---------- Model ----------
  const MATS = [
    { color: '#3b4045', rough: 0.55, metal: 0.05, bump: 2.2, scale: 1, price: 290, days: 9 },
    { color: '#5a3326', rough: 0.38, metal: 0.45, bump: 1.4, scale: 1.6, price: 190, days: 6 },
    { color: '#a44a2c', rough: 0.6, metal: 0.0, bump: 2.2, scale: 1, price: 300, days: 9 },
  ];

  const D = { L: 10, W: 8, H: 3.0, R: 3.3, o: 0.5, og: 0.4, plinth: 0.42 };
  D.xe = D.L / 2 + D.og;
  D.ze = D.W / 2 + D.o;
  D.He = D.H - (D.R * D.o) / (D.W / 2);
  D.Hr = D.H + D.R;
  D.S = Math.hypot(D.ze, D.Hr - D.He); // długość połaci
  const RAFTER_STEP = 0.9;
  const RAFTERS_PER_SIDE = Math.floor(D.L / RAFTER_STEP) + 1;
  const BATTEN_STEP = 0.35;
  const BATTEN_ROWS = Math.floor((D.S - 0.15) / BATTEN_STEP);
  const area = 2 * (2 * D.xe) * D.S;

  const state = { progress: 0, step: -1, manualMat: null, matTarget: 0, visible: false, inView: false };

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const fmtPLN = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Fazy budowy (wartości 0..1 z postępu przewijania)
  const phases = (p) => ({
    rafters: smoothstep(0.03, 0.21, p),
    membrane: smoothstep(0.27, 0.36, p),
    battens: smoothstep(0.36, 0.47, p),
    cover: clamp01((p - 0.52) / 0.2),
  });

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    return clamp01(-r.top / total);
  };

  const quote = (i) => {
    const m = MATS[i];
    const base = area * m.price;
    return { lo: Math.round((base * 0.93) / 100) * 100, hi: Math.round((base * 1.07) / 100) * 100, days: m.days };
  };

  const shown = { lo: 0, hi: 0 };
  let priceAnim = 0;
  const animatePrice = () => {
    const q = quote(state.manualMat ?? state.matTarget);
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

  const syncUI = () => {
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    state.matTarget = p < 0.83 ? 0 : p < 0.91 ? 1 : 2;
    if (step < 3) state.manualMat = null;
    if (rail) rail.style.transform = `scaleY(${p})`;

    if (step !== state.step) {
      state.step = step;
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === step);
        el.classList.toggle('is-done', i < step);
      });
      hudEls.forEach((el) => el.classList.toggle('is-visible', Number(el.dataset.hud) === step));
    }

    // Liczniki postępu budowy
    const f = phases(p);
    hudRafters.textContent = Math.round(f.rafters * RAFTERS_PER_SIDE * 2);
    hudBattens.textContent = Math.round(f.battens * BATTEN_ROWS * 2);
    hudCover.textContent = Math.round(f.cover * 100);

    const mat = state.manualMat ?? state.matTarget;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 200);
  const target = new THREE.Vector3(0, 3.2, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#cdbfb0', 0.55));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-9, 15, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
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

  // Dachówka: 8 rzędów × 8 kolumn (2,4 × 2,8 m na powtórzenie)
  const tileTex = makeTex((g) => {
    const rh = 64, cw = 64;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = c * cw, y = r * rh;
        const v = 0.9 + Math.random() * 0.12;
        const grad = g.createLinearGradient(0, y, 0, y + rh);
        grad.addColorStop(0, `rgb(${235 * v},${235 * v},${235 * v})`);
        grad.addColorStop(0.75, `rgb(${200 * v},${200 * v},${200 * v})`);
        grad.addColorStop(1, `rgb(${150 * v},${150 * v},${150 * v})`);
        g.fillStyle = grad;
        g.fillRect(x, y, cw, rh);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x + cw - 3, y, 3, rh);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, 1.5, rh);
      }
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

  // Membrana: jasna folia z nadrukiem pasów zakładu
  const membraneTex = makeTex((g, s) => {
    g.fillStyle = 'rgb(222,228,233)';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = 'rgba(70,90,110,0.35)';
      g.fillRect(0, y + 6, s, 3);
      g.fillStyle = 'rgba(70,90,110,0.15)';
      for (let x = 20; x < s; x += 120) g.fillRect(x, y + 40, 60, 10);
    }
  }, 256);

  // Drewno: delikatne słoje
  const woodTex = makeTex((g, s) => {
    g.fillStyle = 'rgb(214,178,134)';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(120,80,40,${0.05 + Math.random() * 0.1})`;
      g.fillRect(0, Math.random() * s, s, 1 + Math.random() * 2);
    }
  }, 128);

  // ---------- Materiały ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.92, side: THREE.DoubleSide });
  const plinthMat = new THREE.MeshStandardMaterial({ color: '#8f8780', roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#33404b', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#e0b98c', roughness: 0.8, map: woodTex });
  const battenMat = new THREE.MeshStandardMaterial({ color: '#cfa477', roughness: 0.8, map: woodTex });
  const membraneMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, map: membraneTex, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.5, metalness: 0.3 });
  const brickMat = new THREE.MeshStandardMaterial({ color: '#3d3734', roughness: 0.85 });

  // Pokrycie: dwie warstwy (stara/nowa) do „przekrywania” przy zmianie koloru
  const revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), D.He - 0.2); // widać y ≤ h
  const clipOld = new THREE.Plane(new THREE.Vector3(1, 0, 0), 100);
  const clipNew = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -100);
  const coverMat = (m) => {
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clipShadows: true, envMapIntensity: 0.8 });
    applyMat(mat, m);
    return mat;
  };
  function applyMat(mat, m) {
    mat.color.set(m.color);
    mat.map = mat.bumpMap = tileTex;
    mat.bumpScale = m.bump;
    mat.roughness = m.rough;
    mat.metalness = m.metal;
    mat.needsUpdate = true;
  }
  const coverA = coverMat(MATS[0]);
  const coverB = coverMat(MATS[0]);
  coverA.clippingPlanes = [revealPlane, clipOld];
  coverB.clippingPlanes = [revealPlane, clipNew];
  trimMat.clippingPlanes = [revealPlane];

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Dom ----------
  const house = new THREE.Group();
  scene.add(house);
  const walls = new THREE.Group();
  house.add(walls);

  const wallH = D.H - D.plinth;
  const body = box(D.L, wallH, D.W, wallMat);
  body.position.y = D.plinth + wallH / 2;
  const plinth = box(D.L + 0.08, D.plinth, D.W + 0.08, plinthMat);
  plinth.position.y = D.plinth / 2;
  walls.add(body, plinth);
  // Strop betonowy — dach powstaje na gotowym stropie
  const slab = box(D.L + 0.02, 0.14, D.W + 0.02, new THREE.MeshStandardMaterial({ color: '#b9b4ac', roughness: 0.95 }));
  slab.position.y = D.H - 0.07;
  walls.add(slab);

  const addOpening = (side, along, w, h, bottom, mat = glassMat) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.08), frameMat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    pane.position.z = 0.045;
    g.add(frame, pane);
    g.position.y = bottom + h / 2;
    if (side === 'front') g.position.set(along, g.position.y, D.W / 2 + 0.01);
    if (side === 'back') { g.position.set(along, g.position.y, -D.W / 2 - 0.01); g.rotation.y = Math.PI; }
    if (side === 'right') { g.position.set(D.L / 2 + 0.01, g.position.y, along); g.rotation.y = Math.PI / 2; }
    if (side === 'left') { g.position.set(-D.L / 2 - 0.01, g.position.y, along); g.rotation.y = -Math.PI / 2; }
    walls.add(g);
  };
  addOpening('front', -3.0, 1.3, 1.45, 1.05);
  addOpening('front', 0.1, 2.6, 2.15, 0.45);
  addOpening('front', 3.3, 1.3, 1.45, 1.05);
  addOpening('right', 1.2, 1.0, 2.15, 0.45, new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.7 }));
  addOpening('right', 0, 0.9, 0.9, 4.0); // okno w szczycie
  addOpening('left', 0, 0.9, 0.9, 4.0);
  addOpening('left', -1.6, 1.3, 1.45, 1.05);
  addOpening('back', -2.2, 1.3, 1.45, 1.05);
  addOpening('back', 2.2, 1.3, 1.45, 1.05);

  // Szczyty (stoją od początku — dach powstaje na gotowych ścianach)
  {
    const gp = [];
    const apex = D.Hr - 0.2;
    for (const s of [1, -1]) {
      const x = (s * D.L) / 2;
      gp.push(x, D.H - 0.01, D.W / 2, x, D.H - 0.01, -D.W / 2, x, apex, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    geo.computeVertexNormals();
    walls.add(shadowed(new THREE.Mesh(geo, wallMat)));
  }

  // Komin (murowany przed dachem)
  const chimney = new THREE.Group();
  const stack = box(0.62, 3.6, 0.62, brickMat);
  stack.position.y = D.Hr + 0.75 - 1.8;
  const cap = box(0.78, 0.1, 0.78, new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.5, metalness: 0.3 }));
  cap.position.y = D.Hr + 0.8;
  chimney.add(stack, cap);
  chimney.position.set(-2.0, 0, -1.2);
  house.add(chimney);

  // ---------- Geometria połaci ----------
  // Dla połaci s = +1 (przód) i -1 (tył): punkt na połaci w odległości t od okapu (0..S) i x
  const up = new THREE.Vector3(0, 1, 0);
  const slopeFrame = (s) => {
    const eave = new THREE.Vector3(0, D.He, s * D.ze);
    const dir = new THREE.Vector3(0, D.Hr - D.He, -s * D.ze).normalize(); // w górę połaci
    const normal = new THREE.Vector3(0, D.ze, s * (D.Hr - D.He)).normalize(); // na zewnątrz
    return { eave, dir, normal };
  };
  const SLOPES = [slopeFrame(1), slopeFrame(-1)];
  const orient = (obj, f) => {
    // lokalne Y = w górę połaci, lokalne Z = normalna połaci
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f.dir, f.normal), f.dir, f.normal);
    obj.quaternion.setFromRotationMatrix(m);
  };

  // Krokwie: każda rośnie od okapu do kalenicy
  const rafters = [];
  const rafterGeo = new THREE.BoxGeometry(0.08, 1, 0.18);
  rafterGeo.translate(0, 0.5, -0.09); // pivot przy okapie, wierzch na płaszczyźnie połaci
  SLOPES.forEach((f) => {
    for (let i = 0; i < RAFTERS_PER_SIDE; i++) {
      const x = -D.L / 2 + 0.2 + i * ((D.L - 0.4) / (RAFTERS_PER_SIDE - 1));
      const g = shadowed(new THREE.Mesh(rafterGeo, woodMat));
      g.position.copy(f.eave).setX(x);
      orient(g, f);
      g.userData.order = i / (RAFTERS_PER_SIDE - 1);
      g.scale.y = 0.001;
      house.add(g);
      rafters.push(g);
    }
  });
  const ridgeBeam = box(D.L + 0.2, 0.22, 0.08, woodMat);
  ridgeBeam.position.set(0, D.Hr - 0.14, 0);
  ridgeBeam.scale.x = 0.001;
  house.add(ridgeBeam);

  // Membrana: rozwija się od okapu
  const membranes = SLOPES.map((f) => {
    const geo = new THREE.PlaneGeometry(D.L + 0.3, 1);
    geo.translate(0, 0.5, 0.012);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 3);
    const m = shadowed(new THREE.Mesh(geo, membraneMat));
    m.position.copy(f.eave);
    orient(m, f);
    m.scale.y = 0.001;
    house.add(m);
    return m;
  });

  // Kontrłaty (wzdłuż krokwi) i łaty (poziomo, rząd po rzędzie)
  const counters = [];
  const counterGeo = new THREE.BoxGeometry(0.05, 1, 0.03);
  counterGeo.translate(0, 0.5, 0.03);
  const battens = [];
  SLOPES.forEach((f, si) => {
    for (let i = 0; i < RAFTERS_PER_SIDE; i++) {
      const x = -D.L / 2 + 0.2 + i * ((D.L - 0.4) / (RAFTERS_PER_SIDE - 1));
      const c = shadowed(new THREE.Mesh(counterGeo, battenMat));
      c.position.copy(f.eave).setX(x);
      orient(c, f);
      c.scale.y = 0.001;
      house.add(c);
      counters.push(c);
    }
    for (let r = 0; r < BATTEN_ROWS; r++) {
      const b = box(D.xe * 2, 0.04, 0.06, battenMat);
      const pos = f.eave.clone().addScaledVector(f.dir, 0.15 + r * BATTEN_STEP).addScaledVector(f.normal, 0.075);
      b.position.copy(pos);
      orient(b, f);
      b.userData.row = r;
      b.userData.side = si;
      b.scale.set(0.001, 1, 1);
      house.add(b);
      battens.push(b);
    }
  });

  // Pokrycie: dwie połacie, UV w metrach
  const TU = 2.4, TV = 2.8;
  const coverGeo = new THREE.BufferGeometry();
  {
    const { xe, ze, He, Hr, S } = D;
    const off = 0.12; // nad łatami
    const lift = (y, z, s) => [y + off * (ze / S), z + s * off * ((Hr - He) / S)];
    const pos = [];
    const uv = [];
    const quad = (a, b, c, d, ta, tb, tc, td) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      uv.push(...ta, ...tb, ...tc, ...ta, ...tc, ...td);
    };
    for (const s of [1, -1]) {
      const [ye, zeOff] = lift(He, s * ze, s);
      const [yr, zr] = lift(Hr, 0, s);
      const A = [s > 0 ? -xe : xe, ye, zeOff];
      const B = [s > 0 ? xe : -xe, ye, zeOff];
      const C = [s > 0 ? xe : -xe, yr, zr];
      const Dd = [s > 0 ? -xe : xe, yr, zr];
      const u = (x) => (x + xe) / TU;
      quad(A, B, C, Dd, [u(A[0]), 0], [u(B[0]), 0], [u(C[0]), S / TV], [u(Dd[0]), S / TV]);
    }
    coverGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    coverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    coverGeo.computeVertexNormals();
  }
  const coverMeshA = shadowed(new THREE.Mesh(coverGeo, coverA));
  const coverMeshB = shadowed(new THREE.Mesh(coverGeo, coverB));
  house.add(coverMeshA, coverMeshB);

  // Gąsiory, wiatrownice, rynny (pojawiają się razem z pokryciem)
  const ridgeCap = box(D.xe * 2 + 0.1, 0.16, 0.3, trimMat);
  ridgeCap.position.set(0, D.Hr + 0.16, 0);
  ridgeCap.visible = false;
  house.add(ridgeCap);
  const verge = (x, s) => {
    const a = new THREE.Vector3(x, D.He + 0.14, s * D.ze);
    const b = new THREE.Vector3(x, D.Hr + 0.14, 0);
    const m = box(0.12, 1, 0.08, trimMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    m.scale.y = dir.length() + 0.1;
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    house.add(m);
  };
  for (const x of [D.xe, -D.xe]) for (const s of [1, -1]) verge(x, s);
  for (const s of [1, -1]) {
    const gt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, D.xe * 2 + 0.1, 12), trimMat));
    gt.rotation.z = Math.PI / 2;
    gt.position.set(0, D.He + 0.02, s * (D.ze + 0.05));
    house.add(gt);
  }

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  {
    const g = cc.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(60,40,25,0.55)');
    grad.addColorStop(0.6, 'rgba(60,40,25,0.12)');
    grad.addColorStop(1, 'rgba(60,40,25,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(D.L * 1.7, D.W * 1.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.005;
  scene.add(contact);

  // ---------- Stan animacji ----------
  const anim = { theta: -0.75, phi: 0.5, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0, cover: 0 };
  const ease = (x, k, dt) => x * Math.exp(-k * dt);
  let matShown = 0;
  let wipe = null;
  const finishWipe = () => {
    applyMat(coverA, MATS[wipe.to]);
    matShown = wipe.to;
    wipe = null;
    clipOld.constant = 100;
    clipNew.constant = -100;
  };
  const startWipe = (to) => {
    applyMat(coverB, MATS[to]);
    wipe = { to, t0: performance.now() };
    if (reduceMotion) finishWipe();
  };

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
  let radius = 31;
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    radius = 31 * Math.pow(1.25 / Math.min(camera.aspect, 1.25), 0.55);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- Pętla ----------
  const grow = (f, order, span = 0.35) => clamp01((f - order * (1 - span)) / span);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  let last = performance.now();
  let raf = 0;

  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const p = state.progress;
    const f = phases(p);

    // Ściany rosną przy pierwszym wejściu sceny w kadr
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1200, 1);
    }
    walls.scale.y = Math.max(easeOut(anim.intro), 0.001);
    chimney.scale.y = walls.scale.y;

    // 1. Więźba: krokwie po kolei, od lewej
    rafters.forEach((r) => {
      r.scale.y = Math.max(easeOut(grow(f.rafters, r.userData.order)) * D.S, 0.001);
    });
    ridgeBeam.scale.x = Math.max(easeOut(clamp01((f.rafters - 0.7) / 0.3)), 0.001);

    // 2. Membrana, kontrłaty, łaty
    const mem = easeOut(f.membrane);
    membranes.forEach((m) => {
      m.scale.y = Math.max(mem * D.S, 0.001);
    });
    counters.forEach((c) => {
      c.scale.y = Math.max(mem * D.S, 0.001);
    });
    battens.forEach((b) => {
      const k = easeOut(grow(f.battens, b.userData.row / (BATTEN_ROWS - 1), 0.2));
      b.scale.x = Math.max(k, 0.001);
    });

    // 3. Pokrycie: rząd po rzędzie (płaszczyzna cięcia wspina się skokami)
    const rowsTotal = Math.ceil(D.S / BATTEN_STEP);
    const rowStepY = (BATTEN_STEP * (D.Hr - D.He)) / D.S;
    const rowsDone = f.cover >= 1 ? rowsTotal + 2 : Math.floor(f.cover * rowsTotal);
    const hGoal = f.cover >= 1 ? D.Hr + 1 : D.He - 0.25 + rowsDone * rowStepY;
    anim.cover = hGoal + ease(anim.cover - hGoal, 14, dt);
    revealPlane.constant = anim.cover + 0.12;
    ridgeCap.visible = f.cover >= 0.98;

    // 4. Kolor: nowe pokrycie przykrywa dach od lewej
    const matGoal = state.manualMat ?? state.matTarget;
    if (!wipe && matGoal !== matShown) startWipe(matGoal);
    if (wipe) {
      const k = Math.min((now - wipe.t0) / 1100, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const x = -D.xe - 0.3 + (D.xe * 2 + 0.6) * e;
      clipOld.constant = -x;
      clipNew.constant = x;
      if (k >= 1) finishWipe();
    }

    // Kamera: z góry na więźbę, potem niżej i dookoła
    const span = reduceMotion ? 0.35 : 1.3;
    const thetaGoal = -0.75 + span * smoothstep(0, 1, p) + anim.px * 0.1;
    const phiGoal = 0.5 - 0.18 * smoothstep(0.2, 0.8, p) - anim.py * 0.04;
    anim.theta = thetaGoal + ease(anim.theta - thetaGoal, 5, dt);
    anim.phi = phiGoal + ease(anim.phi - phiGoal, 5, dt);
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.theta + anim.yawUser;
    camera.position.set(
      Math.sin(th) * Math.cos(anim.phi) * radius,
      target.y + Math.sin(anim.phi) * radius,
      Math.cos(th) * Math.cos(anim.phi) * radius
    );
    camera.lookAt(target);

    renderer.render(scene, camera);
    if (state.visible) raf = requestAnimationFrame(frame);
  };
  anim.cover = D.He - 0.3;

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
