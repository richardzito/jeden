/* ==========================================================================
   Zajawka „Test szczelności 3D” — zadymianie dachu płaskiego.
   Sterowana przewijaniem: gaz pod pokrycie → dym z nieszczelności →
   lokalizacja → naprawa i raport.
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
  const tagEls = [...stage.querySelectorAll('.leak-tag')];
  const hudPressure = document.getElementById('hud-pressure');
  const hudLeaks = document.getElementById('hud-leaks');
  const hudArea = document.getElementById('hud-area');
  const hudPrice = document.getElementById('hud-price');

  // ---------- Model (jednostki lokalne; budynek skalowany do ~1200 m² dachu) ----------
  const SCALE = 2.7;
  const B = { L: 16, W: 11, H: 7.2, slab: 0.3, parapet: 0.8, wall: 0.25 };
  B.Li = B.L - 2 * B.wall;
  B.Wi = B.W - 2 * B.wall;
  B.top = B.H + B.slab + 0.08; // wierzch membrany
  const area = Math.round((B.Li * B.Wi * SCALE * SCALE) / 50) * 50;
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  hudArea.textContent = fmt(area);

  const LEAKS = [
    { x: -3.4, z: 1.6 }, // spaw membrany
    { x: -0.15, z: -0.85 }, // obróbka świetlika
    { x: 4.22, z: 2.58 }, // przejście wywiewki
    { x: B.Li / 2 - 0.25, z: -(B.Wi / 2 - 0.25) }, // narożnik attyki
  ];

  const state = { progress: 0, step: -1, visible: false, inView: false };
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  // Fazy próby z postępu przewijania
  const phases = (p) => {
    const fixed = smoothstep(0.78, 0.86, p);
    return {
      pressure: smoothstep(0.02, 0.24, p),
      leak: LEAKS.map((_, i) => smoothstep(0.27 + i * 0.05, 0.31 + i * 0.05, p)),
      marker: LEAKS.map((_, i) => smoothstep(0.5 + i * 0.03, 0.54 + i * 0.03, p)),
      fixed,
    };
  };

  const readProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // Cena próby: 3–5 zł/m² (wartości poglądowe)
  const quote = { lo: Math.round((area * 3) / 100) * 100, hi: Math.round((area * 5) / 100) * 100 };
  let priceShown = false;
  const animatePrice = () => {
    if (priceShown) return;
    priceShown = true;
    const t0 = performance.now();
    const dur = reduceMotion ? 1 : 900;
    const tick = (t) => {
      const k = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - k, 3);
      hudPrice.textContent = `${fmt(Math.round((quote.lo * e) / 100) * 100)} – ${fmt(Math.round((quote.hi * e) / 100) * 100)} zł`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
      hudEls.forEach((el) => el.classList.toggle('is-visible', Number(el.dataset.hud) === step));
      if (step === 3) animatePrice();
    }
    const f = phases(p);
    hudPressure.textContent = Math.round(f.pressure * 100);
    hudLeaks.textContent = f.leak.filter((v) => v > 0.5).length;
    tagEls.forEach((el) => el.classList.toggle('is-fixed', f.fixed > 0.5));
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

  const camera = new THREE.PerspectiveCamera(28, 1, 1, 800);
  const target = new THREE.Vector3(0, 14, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#3a3a40', 0.6));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
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
  // Membrana PCV: jasnoszara, zgrzewy pasów co ~2 m
  const pvcTex = makeTex((g, s) => {
    g.fillStyle = 'rgb(214,217,221)';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 205 + Math.random() * 22;
      g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1.4, 1.4);
    }
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, y, s, 10);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, y + 10, s, 1.5);
    }
  });
  pvcTex.repeat.set(B.Li / 3, B.Wi / 3);

  // ---------- Materiały ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#eceae6', roughness: 0.9 });
  const darkWallMat = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#2f3a44', roughness: 0.08, metalness: 0.65, envMapIntensity: 1.4 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
  const copingMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.7 });
  const pvcMat = new THREE.MeshStandardMaterial({ color: '#8f959c', roughness: 0.75, map: pvcTex, bumpMap: pvcTex, bumpScale: 1 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#7d8389', roughness: 0.4, metalness: 0.7 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.45 });
  const patchMat = new THREE.MeshStandardMaterial({ color: '#9ea3a8', roughness: 0.7 });

  const shadowed = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

  // ---------- Budynek ----------
  const building = new THREE.Group();
  building.scale.setScalar(SCALE);
  scene.add(building);

  const body = box(B.L, B.H - 0.4, B.W, wallMat);
  body.position.y = 0.4 + (B.H - 0.4) / 2;
  const base = box(B.L + 0.1, 0.4, B.W + 0.1, darkWallMat);
  base.position.y = 0.2;
  building.add(body, base);

  // Pasy okien na czterech kondygnacjach
  const ribbon = (side, len, y) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 1.02, 0.06), frameMat));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.92), glassMat);
    pane.position.z = 0.035;
    g.add(pane);
    const n = Math.round(len / 1.4);
    for (let i = 1; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.92, 0.04), frameMat);
      m.position.set(-len / 2 + (len / n) * i, 0, 0.05);
      g.add(m);
    }
    g.position.y = y;
    if (side === 'front') g.position.z = B.W / 2 + 0.01;
    if (side === 'back') { g.position.z = -B.W / 2 - 0.01; g.rotation.y = Math.PI; }
    if (side === 'right') { g.position.x = B.L / 2 + 0.01; g.rotation.y = Math.PI / 2; }
    if (side === 'left') { g.position.x = -B.L / 2 - 0.01; g.rotation.y = -Math.PI / 2; }
    building.add(g);
  };
  for (const y of [1.2, 2.85, 4.5, 6.15]) {
    ribbon('front', B.L - 1.6, y);
    ribbon('back', B.L - 1.6, y);
    ribbon('right', B.W - 1.6, y);
    ribbon('left', B.W - 1.6, y);
  }

  // Strop, attyka z obróbką, membrana
  const slab = box(B.L, B.slab, B.W, wallMat);
  slab.position.y = B.H + B.slab / 2;
  building.add(slab);
  const yA = B.H + B.slab;
  for (const [w, d, x, z] of [
    [B.L, B.wall, 0, B.W / 2 - B.wall / 2],
    [B.L, B.wall, 0, -B.W / 2 + B.wall / 2],
    [B.wall, B.Wi, B.L / 2 - B.wall / 2, 0],
    [B.wall, B.Wi, -B.L / 2 + B.wall / 2, 0],
  ]) {
    const m = box(w, B.parapet, d, wallMat);
    m.position.set(x, yA + B.parapet / 2, z);
    const c = box(w + 0.08, 0.05, d + 0.08, copingMat);
    c.position.set(x, yA + B.parapet + 0.025, z);
    building.add(m, c);
  }
  const membrane = box(B.Li, 0.08, B.Wi, pvcMat);
  membrane.position.y = yA + 0.04;
  building.add(membrane);

  // Świetliki, wywiewki, klimatyzator
  const addSkylight = (x, z) => {
    const curb = box(1.6, 0.4, 1.1, wallMat);
    curb.position.set(x, B.top + 0.2, z);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.0), glassMat);
    glass.position.set(x, B.top + 0.44, z);
    building.add(curb, glass);
  };
  addSkylight(-1, -1.5);
  addSkylight(2.6, -1.5);
  const addVent = (x, z) => {
    const v = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 16), metalMat));
    v.position.set(x, B.top + 0.35, z);
    const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), metalMat));
    cap.position.set(x, B.top + 0.73, z);
    building.add(v, cap);
  };
  addVent(4, 2.4);
  addVent(5.6, -2.9);
  addVent(-4.6, -3.2);
  const ac = box(1.4, 0.7, 0.8, metalMat);
  ac.position.set(5.8, B.top + 0.35, 3.2);
  building.add(ac);

  // Wytwornica dymu + wąż
  const machine = new THREE.Group();
  const mBody = box(0.7, 0.55, 0.45, yellowMat);
  mBody.position.y = 0.275;
  const mHandle = box(0.5, 0.06, 0.06, metalMat);
  mHandle.position.y = 0.62;
  machine.add(mBody, mHandle);
  machine.position.set(-6.2, B.top, 3.4);
  building.add(machine);
  const hosePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.85, B.top + 0.3, 3.4),
    new THREE.Vector3(-5.2, B.top + 0.12, 3.9),
    new THREE.Vector3(-5.6, B.top + 0.06, 4.6),
    new THREE.Vector3(-6.6, B.top + 0.04, 4.9),
  ]);
  const hose = shadowed(new THREE.Mesh(new THREE.TubeGeometry(hosePath, 40, 0.07, 10), yellowMat));
  building.add(hose);
  const hoseEnd = hosePath.getPoint(1);

  // Fale gazu pod membraną (krok 1)
  const hx = (B.Li / 2) * SCALE;
  const hz = (B.Wi / 2) * SCALE;
  const roofClip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), hx),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), hx),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), hz),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), hz),
  ];
  const ripples = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 64),
      new THREE.MeshBasicMaterial({ color: '#ff4a47', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: roofClip })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(hoseEnd.x, B.top + 0.02, hoseEnd.z);
    building.add(m);
    return m;
  });

  // Znaczniki nieszczelności + łaty naprawcze
  const markers = LEAKS.map((l) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 40),
      new THREE.MeshBasicMaterial({ color: '#ff2a26', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(l.x, B.top + 0.03, l.z);
    building.add(ring);
    const patch = box(0.7, 0.02, 0.7, patchMat);
    patch.position.set(l.x, B.top + 0.01, l.z);
    patch.scale.set(0.001, 1, 0.001);
    building.add(patch);
    return { ring, patch };
  });
  const green = new THREE.Color('#2f9e44');
  const red = new THREE.Color('#ff2a26');

  // ---------- Dym: cząsteczki ----------
  const PER_LEAK = 70;
  const N = PER_LEAK * LEAKS.length;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const alpha = new Float32Array(N);
  const life = new Float32Array(N).fill(2); // >1 = martwa
  const ttl = new Float32Array(N);
  const seed = new Float32Array(N);
  const spawnK = new Float32Array(N);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;
        vA = aAlpha;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.93, 0.93, 0.95), a * a * vA);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  building.add(smoke);

  const spawn = (i, leakIdx, k) => {
    const l = LEAKS[leakIdx];
    pos[i * 3] = l.x + (Math.random() - 0.5) * 0.15;
    pos[i * 3 + 1] = B.top + 0.05;
    pos[i * 3 + 2] = l.z + (Math.random() - 0.5) * 0.15;
    life[i] = 0;
    ttl[i] = 2.6 + Math.random() * 1.4;
    seed[i] = Math.random() * 100;
    spawnK[i] = k;
  };

  // ---------- Podłoże ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  ground.renderOrder = 2;
  scene.add(ground);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  {
    const g = cc.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.12)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.035)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(B.L * SCALE * 2.4, B.W * SCALE * 2.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  scene.add(glow);

  // ---------- Kamera i wskaźnik ----------
  const anim = { theta: -0.7, phi: 0.6, radius: 1, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0 };
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

  let radius = 120;
  let stageW = 1;
  let stageH = 1;
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    radius = 120 * Math.pow(1.3 / Math.min(camera.aspect, 1.3), 0.35);
    camera.updateProjectionMatrix();
    smokeMat.uniforms.uScale.value = (stageH * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // Etykiety pinezek (rzut 3D → 2D)
  const _v = new THREE.Vector3();
  const tagW = tagEls.map(() => 0);
  const placeTags = (f) => {
    tagEls.forEach((el, k) => {
      const l = LEAKS[k];
      _v.set(l.x, B.top + 0.25, l.z);
      building.localToWorld(_v).project(camera);
      if (!tagW[k]) tagW[k] = el.offsetWidth || 150;
      let x = (_v.x * 0.5 + 0.5) * stageW - 7;
      const y = (-_v.y * 0.5 + 0.5) * stageH - 7;
      x = Math.min(x, stageW - tagW[k] - 8);
      el.style.opacity = f.marker[k].toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.85 + 0.15 * f.marker[k]).toFixed(3)})`;
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
    const f = phases(p);

    // Wejście: budynek rośnie od ziemi
    if (anim.intro < 1 && state.inView) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = Math.min((now - anim.introStart) / 1300, 1);
    }
    building.scale.y = SCALE * Math.max(1 - Math.pow(1 - anim.intro, 3), 0.001);

    // Krok 1: fale gazu od węża
    const pumping = f.pressure > 0.01 && p < 0.5;
    ripples.forEach((r, i) => {
      const t = ((now / 1600 + i / 3) % 1);
      r.scale.setScalar(0.3 + t * 9);
      r.material.opacity = pumping ? (1 - t) * 0.55 * Math.min(f.pressure * 4, 1) * (1 - smoothstep(0.4, 0.5, p)) : 0;
    });

    // Krok 2–4: dym z nieszczelności
    for (let i = 0; i < N; i++) {
      const leakIdx = Math.floor(i / PER_LEAK);
      const strength = f.leak[leakIdx] * (1 - f.fixed);
      if (life[i] > 1) {
        // odradzanie: tym częściej, im silniejszy wypływ
        if (strength > 0.02 && Math.random() < dt * 9 * strength * (reduceMotion ? 0.4 : 1)) spawn(i, leakIdx, strength);
        else {
          alpha[i] = 0;
          continue;
        }
      }
      life[i] += dt / ttl[i];
      const lt = life[i];
      const s = seed[i];
      pos[i * 3] += (0.18 + Math.sin(s + lt * 5) * 0.12) * dt;
      pos[i * 3 + 1] += (0.8 + 0.3 * Math.sin(s)) * dt * (1 - lt * 0.35);
      pos[i * 3 + 2] += Math.cos(s * 1.3 + lt * 4) * 0.1 * dt;
      size[i] = (0.45 + lt * 2.1) * SCALE;
      alpha[i] = lt > 1 ? 0 : Math.sin(Math.PI * Math.min(lt, 1)) * 0.78 * spawnK[i];
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.aSize.needsUpdate = true;
    smokeGeo.attributes.aAlpha.needsUpdate = true;

    // Znaczniki i łaty
    markers.forEach((m, i) => {
      const k = f.marker[i];
      const pulse = 1 + Math.sin(now / 260 + i) * 0.12 * (1 - f.fixed);
      m.ring.scale.setScalar(Math.max(k * pulse, 0.001));
      m.ring.material.opacity = k * 0.95;
      m.ring.material.color.copy(red).lerp(green, f.fixed);
      const pk = f.fixed;
      m.patch.scale.set(Math.max(pk, 0.001), 1, Math.max(pk, 0.001));
    });

    // Kamera: z góry na cały dach, potem bliżej pinezek, na koniec oddech
    const span = reduceMotion ? 0.3 : 1.1;
    const thetaGoal = -0.7 + span * smoothstep(0, 1, p) + anim.px * 0.08;
    const phiGoal = 0.62 + 0.12 * smoothstep(0.45, 0.7, p) - 0.1 * smoothstep(0.8, 1, p) - anim.py * 0.04;
    const rGoal = 1 - 0.22 * smoothstep(0.45, 0.7, p) + 0.12 * smoothstep(0.8, 1, p);
    anim.theta = thetaGoal + ease(anim.theta - thetaGoal, 4, dt);
    anim.phi = phiGoal + ease(anim.phi - phiGoal, 4, dt);
    anim.radius = rGoal + ease(anim.radius - rGoal, 4, dt);
    if (!dragging) {
      anim.yawUser += anim.yawVel * dt;
      anim.yawVel *= Math.exp(-4 * dt);
    }
    const th = anim.theta + anim.yawUser;
    const r = radius * anim.radius;
    camera.position.set(
      Math.sin(th) * Math.cos(anim.phi) * r,
      target.y + Math.sin(anim.phi) * r,
      Math.cos(th) * Math.cos(anim.phi) * r
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();

    placeTags(f);
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
