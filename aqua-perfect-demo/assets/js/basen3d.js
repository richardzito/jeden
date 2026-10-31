/* ==========================================================================
   Zajawka „Konfigurator basenu 3D” — przekrój basenu sterowany przewijaniem:
   niecka ze stali napełnia się wodą → ziemia odsuwa się, rura z rynny
   przelewowej prowadzi mętną wodę do maszynowni → pompy, filtry, lampa UV
   i dezynfekcja oddają krystaliczną wodę dyszami w dnie → zmierzch,
   podświetlenie LED i atrakcja zależna od typu basenu.
   Typ basenu (prywatny / hotelowy / sportowy) zmienia wymiary, wyposażenie,
   maszynownię i dane w karcie. Zwykły skrypt + dynamiczny import (import map
   w <head>), żeby strona działała też otwarta prosto z dysku (file://).
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
    // brak sieci / CDN — kroki i karta danych działają dalej, zamiast 3D zdjęcie
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
  const presetWrap = document.getElementById('pool-preset');
  const presetBtns = presetWrap ? [...presetWrap.querySelectorAll('button')] : [];
  const specCard = document.getElementById('spec-card');
  const specEls = specCard ? Object.fromEntries([...specCard.querySelectorAll('[data-spec]')].map((el) => [el.dataset.spec, el])) : {};
  const specRows = specCard ? [...specCard.querySelectorAll('.spec')] : [];
  const extraB = document.getElementById('tag-extra-b');
  const extraS = document.getElementById('tag-extra-s');

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (x, k, dt) => x * Math.exp(-k * dt);
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmtDec = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---------- Typy basenu (dane poglądowe) ----------
  const PRESETS = [
    { name: 'Basen prywatny', L: 8, W: 4, D: 1.4, T: 4, filters: 1, fd: 900, fr: 0.46, fh: 1.55, pumps: 1, pumpsTxt: '1', k: 1, extra: ['Przeciwprąd', 'pływanie w miejscu'] },
    { name: 'Basen hotelowy', L: 15, W: 7, D: 1.35, T: 2.5, filters: 2, fd: 1200, fr: 0.56, fh: 1.75, pumps: 3, pumpsTxt: '2 + 1 rez.', k: 1.18, extra: ['Kaskada', 'masaż karku i pleców'] },
    { name: 'Basen sportowy', L: 25, W: 12.5, D: 1.8, T: 4, filters: 3, fd: 2000, fr: 0.62, fh: 1.95, pumps: 4, pumpsTxt: '3 + 1 rez.', k: 1.45, extra: ['Pomiar czasu ALGE', 'płyty dotykowe na ścianie'] },
  ];
  PRESETS.forEach((s) => {
    s.vol = s.L * s.W * s.D;
    s.flow = s.vol / s.T;
  });

  // ---------- Oś czasu (p = postęp przewijania 0…1, cztery kroki po 0,25) ----------
  const fillAt = (p) => smoothstep(0.02, 0.2, p);
  const cutAt = (p) => smoothstep(0.26, 0.36, p) * (1 - smoothstep(0.76, 0.84, p));
  const pipesAt = (p) => smoothstep(0.29, 0.37, p) * (1 - smoothstep(0.77, 0.83, p));
  const flowAt = (p) => smoothstep(0.33, 0.4, p) * (1 - smoothstep(0.77, 0.82, p));
  const murkAt = (p) => smoothstep(0.27, 0.36, p) * (1 - smoothstep(0.56, 0.72, p));
  const roomAt = (p) => smoothstep(0.5, 0.57, p);
  const cleanAt = (p) => smoothstep(0.53, 0.64, p);
  const duskAt = (p) => smoothstep(0.76, 0.9, p);
  const ledAt = (p) => smoothstep(0.82, 0.92, p);
  const extraAt = (p) => smoothstep(0.86, 0.95, p);

  const state = { progress: 0, step: -1, visible: false, inView: false, preset: 0, override: null, spec: {} };

  const readProgress = () => {
    if (state.override !== null) return state.override;
    const r = track.getBoundingClientRect();
    return clamp01(-r.top / (r.height - window.innerHeight));
  };

  // ---------- Karta danych ----------
  const shownVol = { v: 0 };
  const setSpec = (key, text, locked) => {
    const el = specEls[key];
    if (!el) return;
    const prev = state.spec[key];
    if (prev === text) return;
    state.spec[key] = text;
    el.textContent = text;
    const row = el.closest('.spec');
    if (row) row.classList.toggle('is-locked', !!locked);
    if (prev !== undefined && !locked && key !== 'vol' && !reduceMotion) {
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
      stage.classList.toggle('is-final', step === 3);
    }
    const s = PRESETS[state.preset];
    setSpec('name', s.name);
    setSpec('dim', `${fmtDec(s.L)} × ${fmtDec(s.W)} m`);
    setSpec('vol', `${fmt(shownVol.v)} m³`);
    const flowOn = p >= 0.3;
    const roomOn = p >= 0.53;
    setSpec('flow', flowOn ? `${fmt(s.flow)} m³/h` : '—', !flowOn);
    setSpec('turn', flowOn ? `co ${fmtDec(s.T)} h` : '—', !flowOn);
    setSpec('filters', roomOn ? `${s.filters} × Ø ${s.fd}` : '—', !roomOn);
    setSpec('pumps', roomOn ? s.pumpsTxt : '—', !roomOn);
    stage.style.setProperty('--dusk', duskAt(p).toFixed(3));
    stage.classList.toggle('is-dusk', duskAt(p) > 0.5);
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

  // Przełącznik typu basenu
  const setPreset = (i) => {
    state.preset = i;
    presetBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    presetWrap && presetWrap.style.setProperty('--i', i);
    if (extraB) extraB.textContent = PRESETS[i].extra[0];
    if (extraS) extraS.textContent = PRESETS[i].extra[1];
    syncUI();
    onPreset && onPreset(i);
  };
  let onPreset = null;
  presetBtns.forEach((b, i) => b.addEventListener('click', () => setPreset(i)));

  // Licznik pojemności: w kroku 1 rośnie z wodą, potem płynnie przechodzi między typami
  let volRaf = 0;
  let volT = 0;
  const tickVol = (now) => {
    volRaf = 0;
    const dt = Math.min((now - (volT || now)) / 1000, 0.25);
    volT = now;
    const s = PRESETS[state.preset];
    const goal = s.vol * fillAt(state.progress);
    const d = goal - shownVol.v;
    shownVol.v = Math.abs(d) < 0.5 || reduceMotion ? goal : shownVol.v + d * (1 - Math.exp(-9 * dt));
    syncUI();
    if (shownVol.v !== goal) volRaf = requestAnimationFrame(tickVol);
    else volT = 0;
  };
  const kickVol = () => {
    if (!volRaf) volRaf = requestAnimationFrame(tickVol);
  };
  window.addEventListener('scroll', kickVol, { passive: true });
  presetBtns.forEach((b) => b.addEventListener('click', kickVol));

  setPreset(0);
  state.progress = readProgress();
  shownVol.v = PRESETS[0].vol * fillAt(state.progress);
  syncUI();

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

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  const target = new THREE.Vector3();

  const hemi = new THREE.HemisphereLight('#ffffff', '#b8c7d4', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6ea', 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const poolLight = new THREE.PointLight('#53d4ff', 0, 30, 1.6);
  scene.add(poolLight);

  // ---------- Tekstury ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const makeCanvas = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  };
  const toTex = (c, repeat = true, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  // Płyty tarasu (jedna tekstura = 1,2 × 1,2 m, cztery płyty 60 × 60)
  const tileCanvas = makeCanvas(256, 256, (g, w, h) => {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const v = 232 + Math.floor(rand() * 10);
        g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
        g.fillRect(x * 128, y * 128, 128, 128);
        for (let i = 0; i < 160; i++) {
          g.fillStyle = `rgba(${150 + rand() * 60},${140 + rand() * 50},${120 + rand() * 40},${0.05 + rand() * 0.07})`;
          g.fillRect(x * 128 + rand() * 128, y * 128 + rand() * 128, 1 + rand() * 3, 1 + rand() * 3);
        }
      }
    }
    g.fillStyle = 'rgba(128,124,118,0.7)';
    g.fillRect(0, 0, w, 2);
    g.fillRect(0, 128, w, 2);
    g.fillRect(0, 0, 2, h);
    g.fillRect(128, 0, 2, h);
  });
  const deckTex = (w, d) => {
    const t = toTex(tileCanvas);
    t.repeat.set(w / 1.2, d / 1.2);
    return t;
  };

  // Ruszt rynny przelewowej: białe żeberka
  const grateCanvas = makeCanvas(64, 64, (g, w, h) => {
    g.fillStyle = '#5d6b76';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f6f7';
    for (let x = 0; x < w; x += 8) g.fillRect(x + 2, 0, 5, h);
    g.fillRect(0, 0, w, 4);
    g.fillRect(0, h - 4, w, 4);
  });

  // Przekrój gruntu: humus, piasek, glina
  const soilCanvas = makeCanvas(256, 512, (g, w, h) => {
    const bands = [
      [0, 0.1, '#6b5442'],
      [0.1, 0.42, '#c9ad85'],
      [0.42, 0.7, '#b8946a'],
      [0.7, 1, '#9e7b58'],
    ];
    bands.forEach(([a, b, c]) => {
      g.fillStyle = c;
      g.fillRect(0, a * h, w, (b - a) * h + 1);
    });
    for (let i = 0; i < 1600; i++) {
      const y = rand() * h;
      g.fillStyle = `rgba(${rand() > 0.5 ? '255,250,240' : '60,40,25'},${0.08 + rand() * 0.14})`;
      g.beginPath();
      g.arc(rand() * w, y, 0.6 + rand() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  });

  // Kaustyki: komórki Voronoi (F2 − F1) na siatce 5 × 5, bez szwu
  const causticCanvas = makeCanvas(256, 256, (g, w, h) => {
    const G = 5;
    const pts = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) pts.push([(x + 0.15 + rand() * 0.7) / G, (y + 0.15 + rand() * 0.7) / G]);
    const img = g.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const v = py / h;
        const cx = Math.floor(u * G);
        const cy = Math.floor(v * G);
        let f1 = 9;
        let f2 = 9;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const gx = (cx + ox + G) % G;
            const gy = (cy + oy + G) % G;
            const pt = pts[gy * G + gx];
            const qx = pt[0] + (cx + ox - gx) / G - u;
            const qy = pt[1] + (cy + oy - gy) / G - v;
            const d = Math.sqrt(qx * qx + qy * qy);
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) f2 = d;
          }
        }
        const e = f2 - f1;
        const a = Math.pow(clamp01(1 - e * 9), 3.2);
        const i = (py * w + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
  });
  const causticA = toTex(causticCanvas);
  const causticB = toTex(causticCanvas);

  // Normalne tafli: suma fal o całkowitych częstotliwościach (bez szwu)
  const waveNormal = (() => {
    const N = 128;
    const c = makeCanvas(N, N, (g) => {
      const waves = [];
      for (let i = 0; i < 9; i++) waves.push([1 + Math.floor(rand() * 4), Math.floor(rand() * 7) - 3, rand() * 6.28, 0.5 + rand()]);
      const hgt = (x, y) => waves.reduce((s, [a, b, ph, amp]) => s + amp * Math.sin(2 * Math.PI * (a * x + b * y) + ph), 0);
      const img = g.createImageData(N, N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const e = 1 / N;
          const dx = hgt((x + 1) / N, y / N) - hgt((x - 1) / N, y / N);
          const dy = hgt(x / N, (y + 1) / N) - hgt(x / N, (y - 1) / N);
          const nx = -dx * 0.16;
          const ny = -dy * 0.16;
          const l = Math.hypot(nx, ny, 1);
          const i = (y * N + x) * 4;
          img.data[i] = (nx / l * 0.5 + 0.5) * 255;
          img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
          img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
          img.data[i + 3] = 255;
          void e;
        }
      }
      g.putImageData(img, 0, 0);
    });
    return toTex(c, true, false);
  })();

  // Lina torowa: czerwono-biało-niebieskie pływaki
  const ropeCanvas = makeCanvas(256, 8, (g, w, h) => {
    const cols = ['#d6283c', '#d6283c', '#ffffff', '#1b5fae', '#1b5fae', '#ffffff'];
    const seg = w / 24;
    for (let i = 0; i < 24; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(i * seg, 0, seg - 1, h);
    }
  });

  // Strumień kaskady
  const cascadeCanvas = makeCanvas(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rand() * w;
      const gr = g.createLinearGradient(0, 0, 0, h);
      const a = 0.25 + rand() * 0.5;
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.5, `rgba(220,245,255,${a * 0.6})`);
      gr.addColorStop(1, `rgba(255,255,255,${a})`);
      g.fillStyle = gr;
      g.fillRect(x, 0, 1 + rand() * 2.5, h);
    }
  });
  const cascadeTex = toTex(cascadeCanvas);

  // Miękki cień pod całą makietą
  const blobTex = toTex(
    makeCanvas(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(10,40,70,0.34)');
      gr.addColorStop(0.55, 'rgba(10,40,70,0.14)');
      gr.addColorStop(1, 'rgba(10,40,70,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    false
  );

  // ---------- Materiały ----------
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const steelMat = std({ color: '#e4eaef', metalness: 0.62, roughness: 0.3, envMapIntensity: 1.1 });
  const steelFloorMat = std({ color: '#dfe7ed', metalness: 0.55, roughness: 0.34, envMapIntensity: 1 });
  const steelWallMat = std({ color: '#e4eaef', metalness: 0.62, roughness: 0.3, envMapIntensity: 1.1, transparent: true });
  const soilMat = std({ map: toTex(soilCanvas, false), roughness: 1, transparent: true });
  const soilFrontMat = soilMat.clone();
  const concreteMat = std({ color: '#cfd5da', roughness: 0.92 });
  const grateMat = std({ map: toTex(grateCanvas), roughness: 0.5 });
  const waterMat = std({ color: '#36b3e6', transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0, envMapIntensity: 0.6, depthWrite: false, emissive: '#0aa0dc', emissiveIntensity: 0 });
  const surfaceMat = std({ color: '#7fd3f3', transparent: true, opacity: 0.42, roughness: 0.04, metalness: 0.15, normalMap: waveNormal, envMapIntensity: 1.6, depthWrite: false, emissive: '#2bc6ff', emissiveIntensity: 0 });
  surfaceMat.normalScale.set(0.6, 0.6);
  const causticMatA = new THREE.MeshBasicMaterial({ map: causticA, color: '#ffffff', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const causticMatB = new THREE.MeshBasicMaterial({ map: causticB, color: '#c9f1ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const pipeMat = std({ color: '#dfe7ec', roughness: 0.18, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.2 });
  const pipeEdgeMat = std({ color: '#8b98a3', roughness: 0.5 });
  const filterMat = std({ color: '#2a9fd0', roughness: 0.28, metalness: 0.05, envMapIntensity: 1.1 });
  const pumpMat = std({ color: '#f26a1b', roughness: 0.4, metalness: 0.1 });
  const darkMat = std({ color: '#2b343c', roughness: 0.6, metalness: 0.2 });
  const whiteMat = std({ color: '#f3f5f6', roughness: 0.5 });
  const peMat = std({ color: '#dfe5ea', roughness: 0.75 });
  const ledMat = new THREE.MeshBasicMaterial({ color: '#28d17c', toneMapped: false });
  const screenMat = std({ color: '#0b2a44', emissive: '#2ea8ff', emissiveIntensity: 0, roughness: 0.3 });
  const uvGlowMat = new THREE.MeshBasicMaterial({ color: '#a77bff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const poolLedMat = std({ color: '#e9f8ff', emissive: '#6fe0ff', emissiveIntensity: 0, roughness: 0.2 });
  const bollardMat = std({ color: '#fff2d6', emissive: '#ffcf7a', emissiveIntensity: 0, roughness: 0.4 });
  const cushionMat = std({ color: '#ffffff', roughness: 0.85 });
  const frameMat = std({ color: '#3a4550', roughness: 0.55, metalness: 0.3 });
  const plantMat = std({ color: '#79a96b', roughness: 1, flatShading: true });
  const ropeMat = std({ map: toTex(ropeCanvas), roughness: 0.6 });
  const laneMat = std({ color: '#0f3d6e', roughness: 0.5, metalness: 0.2 });
  const blockMat = std({ color: '#ffffff', roughness: 0.6 });
  const padMat = std({ color: '#20262c', emissive: '#ffd24a', emissiveIntensity: 0, roughness: 0.4 });
  const cascadeMat = new THREE.MeshBasicMaterial({ map: cascadeTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const bubbleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const particleMat = new THREE.MeshBasicMaterial({ toneMapped: false });

  const shadowed = (m, cast = true, recv = true) => {
    m.castShadow = cast;
    m.receiveShadow = recv;
    return m;
  };
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const ubox = (mat, cast = true) => shadowed(new THREE.Mesh(unitBox, mat), cast, true);
  const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  const cyl = (rt, rb, h, mat, seg = 24) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
  const place = (m, x, y, z) => {
    m.position.set(x, y, z);
    return m;
  };

  const site = new THREE.Group();
  scene.add(site);

  // ---------- Stałe makiety (metry) ----------
  const M = 2.4; // margines tarasu wokół niecki
  const GAP = 1.4; // od niecki do maszynowni
  const RW = 6.4; // maszynownia: długość (x)
  const RZ = 5; // szerokość (z)
  const FLOOR = -3.3; // posadzka maszynowni
  const BOT = -3.8; // spód makiety
  const SLAB = 0.25; // płyta tarasu

  // ---------- Grunt i taras (bloki skalowane z jednostkowego sześcianu) ----------
  const deckTexs = [];
  const mkDeck = () => {
    const t = deckTex(1, 1);
    deckTexs.push(t);
    return ubox(std({ map: t, roughness: 0.82, transparent: true }));
  };
  const deck = { n: mkDeck(), s: mkDeck(), w: mkDeck(), e: mkDeck() };
  const earth = { n: ubox(soilMat, false), s: ubox(soilFrontMat, false), w: ubox(soilMat, false), e: ubox(soilMat, false), b: ubox(soilMat, false) };
  Object.values(earth).forEach((m) => {
    m.renderOrder = 3;
    site.add(m);
  });
  Object.values(deck).forEach((m) => site.add(m));

  // Ruszt rynny dookoła niecki
  const grates = [0, 1, 2, 3].map((i) => {
    const mat = grateMat.clone();
    mat.map = grateMat.map.clone();
    mat.map.center.set(0.5, 0.5);
    if (i > 1) mat.map.rotation = Math.PI / 2;
    const m = ubox(mat, false);
    site.add(m);
    return m;
  });

  // Niecka ze stali
  const poolFloor = ubox(steelFloorMat, false);
  const walls = { n: ubox(steelMat), s: ubox(steelWallMat), w: ubox(steelMat), e: ubox(steelMat) };
  walls.s.renderOrder = 4;
  site.add(poolFloor, ...Object.values(walls));

  // Linie torów na dnie (basen sportowy)
  const laneLines = new THREE.Group();
  site.add(laneLines);

  // Woda: bryła + tafla + kaustyki na dnie
  const water = new THREE.Mesh(unitBox, waterMat);
  water.renderOrder = 5;
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 6;
  const causticA1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), causticMatA);
  const causticB1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), causticMatB);
  [causticA1, causticB1].forEach((m) => {
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
  });
  site.add(water, surface, causticA1, causticB1);

  // Cień pod makietą
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
  blob.rotation.x = -Math.PI / 2;
  site.add(blob);

  // ---------- Maszynownia (pozycje lokalne, x od ściany przy basenie) ----------
  const room = new THREE.Group();
  site.add(room);
  const roomFloor = place(box(RW, 0.2, RZ, concreteMat), RW / 2, FLOOR - 0.1, 0);
  const roomBack = place(box(RW, -FLOOR - SLAB, 0.2, concreteMat), RW / 2, (FLOOR - SLAB) / 2, -RZ / 2 - 0.1);
  const roomRight = place(box(0.2, -FLOOR - SLAB, RZ, concreteMat), RW + 0.1, (FLOOR - SLAB) / 2, 0);
  room.add(roomFloor, roomBack, roomRight);

  // Zbiornik przelewowy
  const TANK = { x: 1.0, z: -1.35, w: 1.6, h: 1.9, d: 1.75 };
  const tank = place(box(TANK.w, TANK.h, TANK.d, peMat), TANK.x, FLOOR + TANK.h / 2, TANK.z);
  room.add(tank);
  for (let i = 0; i < 4; i++) room.add(place(box(TANK.w + 0.04, 0.05, TANK.d + 0.04, pipeEdgeMat), TANK.x, FLOOR + 0.35 + i * 0.45, TANK.z));
  const tankWin = place(box(0.08, 1.2, 0.02, std({ color: '#7fb6cc', roughness: 0.2 })), TANK.x + 0.5, FLOOR + 0.95, TANK.z + TANK.d / 2 + 0.01);
  room.add(tankWin);

  // Pompy (korpus + silnik + kosz)
  const PUMP_Z = 1.25;
  const PUMP_X0 = 2.0;
  const makePump = () => {
    const g = new THREE.Group();
    const base = place(box(0.8, 0.08, 0.42, darkMat), 0, 0.04, 0);
    const motor = cyl(0.17, 0.17, 0.46, pumpMat);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(0.2, 0.3, 0);
    const fan = cyl(0.18, 0.18, 0.06, darkMat);
    fan.rotation.z = Math.PI / 2;
    fan.position.set(0.45, 0.3, 0);
    const volute = cyl(0.2, 0.2, 0.16, pumpMat);
    volute.rotation.z = Math.PI / 2;
    volute.position.set(-0.12, 0.3, 0);
    const basket = cyl(0.14, 0.14, 0.3, std({ color: '#cfe7f2', roughness: 0.15, transparent: true, opacity: 0.65 }));
    basket.position.set(-0.36, 0.3, 0);
    const lid = cyl(0.16, 0.16, 0.05, darkMat);
    lid.position.set(-0.36, 0.47, 0);
    const led = place(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), ledMat), 0.2, 0.49, 0.1);
    g.add(base, motor, fan, volute, basket, lid, led);
    g.userData.led = led;
    return g;
  };
  const pumps = [0, 1, 2, 3].map((i) => {
    const pmp = makePump();
    pmp.position.set(PUMP_X0 + i * 0.86, FLOOR, PUMP_Z);
    room.add(pmp);
    return pmp;
  });

  // Filtry (zbiorniki z dennicami, manometr, nogi)
  const makeFilter = () => {
    const g = new THREE.Group();
    const body = cyl(1, 1, 1, filterMat, 40);
    const top = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), filterMat));
    const bot = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), filterMat));
    const legs = [0, 1, 2].map(() => cyl(0.03, 0.03, 1, darkMat, 8));
    const gauge = cyl(0.06, 0.06, 0.03, whiteMat, 16);
    gauge.rotation.x = Math.PI / 2;
    const valve = cyl(0.07, 0.07, 0.18, darkMat, 12);
    const band = cyl(1.01, 1.01, 0.04, std({ color: '#e9eef2', roughness: 0.4 }), 40);
    g.add(body, top, bot, ...legs, gauge, valve, band);
    g.userData = { body, top, bot, legs, gauge, valve, band, s: 0 };
    return g;
  };
  const filters = [0, 1, 2].map(() => {
    const f = makeFilter();
    room.add(f);
    return f;
  });
  const FILTER_Z = -1.15;
  const layoutFilter = (f, r, h) => {
    const u = f.userData;
    const legH = 0.32;
    const y0 = FLOOR + legH + r * 0.45;
    u.body.scale.set(r, h, r);
    u.body.position.y = y0 + h / 2;
    u.top.scale.set(r, r * 0.45, r);
    u.top.position.y = y0 + h;
    u.bot.scale.set(r, r * 0.45, r);
    u.bot.position.y = y0;
    u.band.scale.set(r, 1, r);
    u.band.position.y = y0 + h * 0.62;
    u.legs.forEach((l, i) => {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      l.scale.y = legH + r * 0.3;
      l.position.set(Math.cos(a) * r * 0.62, FLOOR + (legH + r * 0.3) / 2, Math.sin(a) * r * 0.62);
    });
    u.gauge.position.set(0, y0 + h * 0.8, r + 0.02);
    u.valve.position.set(0, y0 + h + r * 0.45 + 0.05, 0);
    u.topY = y0 + h + r * 0.45;
  };
  const filterXs = (n, r) => {
    const xa = 2.55 + r;
    const xb = RW - 0.55 - r;
    if (n === 1) return [(xa + xb) / 2 - 0.4];
    return Array.from({ length: n }, (_, i) => lerp(xa, xb, i / (n - 1)));
  };

  // Lampa UV
  const UV = { x0: 4.75, x1: 5.85, y: FLOOR + 1.05, z: 1.75 };
  const uvBody = cyl(0.15, 0.15, UV.x1 - UV.x0, steelMat, 24);
  uvBody.rotation.z = Math.PI / 2;
  uvBody.position.set((UV.x0 + UV.x1) / 2, UV.y, UV.z);
  const uvCapA = cyl(0.17, 0.17, 0.06, darkMat);
  uvCapA.rotation.z = Math.PI / 2;
  uvCapA.position.set(UV.x0, UV.y, UV.z);
  const uvCapB = uvCapA.clone();
  uvCapB.position.x = UV.x1;
  const uvGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, UV.x1 - UV.x0 - 0.1, 24, 1, true), uvGlowMat);
  uvGlow.rotation.z = Math.PI / 2;
  uvGlow.position.copy(uvBody.position);
  const uvBox = place(box(0.36, 0.5, 0.18, whiteMat), 5.3, UV.y + 0.75, RZ / 2 - 0.2);
  const uvStand = [UV.x0 + 0.2, UV.x1 - 0.2].map((x) => place(box(0.06, UV.y - FLOOR, 0.06, darkMat), x, (UV.y + FLOOR) / 2, UV.z));
  room.add(uvBody, uvCapA, uvCapB, uvGlow, uvBox, ...uvStand);

  // Dezynfekcja ProMinent: szafka na ścianie + kanistry
  const DOS = { x: RW - 0.12, z: -0.35 };
  const dosPanel = place(box(0.08, 1.0, 1.1, whiteMat), DOS.x, FLOOR + 1.75, DOS.z);
  const dosScreen = place(box(0.02, 0.22, 0.34, screenMat), DOS.x - 0.05, FLOOR + 2.0, DOS.z - 0.2);
  const dosPumpA = place(box(0.16, 0.22, 0.2, std({ color: '#1f6fd0', roughness: 0.4 })), DOS.x - 0.12, FLOOR + 1.45, DOS.z + 0.2);
  const dosPumpB = dosPumpA.clone();
  dosPumpB.position.z = DOS.z + 0.45;
  const canA = place(cyl(0.16, 0.18, 0.55, whiteMat, 16), DOS.x - 0.35, FLOOR + 0.28, DOS.z + 0.05);
  const canB = place(cyl(0.16, 0.18, 0.55, std({ color: '#e7eef4', roughness: 0.5 }), 16), DOS.x - 0.35, FLOOR + 0.28, DOS.z + 0.5);
  const capA = place(cyl(0.06, 0.06, 0.06, std({ color: '#c20018', roughness: 0.4 }), 12), DOS.x - 0.35, FLOOR + 0.58, DOS.z + 0.05);
  const capB = place(cyl(0.06, 0.06, 0.06, std({ color: '#1f6fd0', roughness: 0.4 }), 12), DOS.x - 0.35, FLOOR + 0.58, DOS.z + 0.5);
  const dosLed = place(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), ledMat), DOS.x - 0.05, FLOOR + 2.18, DOS.z + 0.2);
  room.add(dosPanel, dosScreen, dosPumpA, dosPumpB, canA, canB, capA, capB, dosLed);

  // Właz na tarasie nad maszynownią
  const hatch = place(box(1.4, 0.03, 1.0, std({ color: '#9aa6b0', roughness: 0.5, metalness: 0.5 })), 1.0, 0.015, 1.4);
  room.add(hatch);

  // ---------- Wyposażenie tarasu ----------
  const props = new THREE.Group();
  site.add(props);
  const makeLounger = () => {
    const g = new THREE.Group();
    const frame = place(box(0.7, 0.08, 1.9, frameMat), 0, 0.3, 0);
    const cushion = place(box(0.64, 0.08, 1.35, cushionMat), 0, 0.38, 0.25);
    const back = place(box(0.64, 0.08, 0.62, cushionMat), 0, 0.58, -0.62);
    back.rotation.x = -0.7;
    const legs = [-0.28, 0.28].flatMap((x) => [-0.8, 0.8].map((z) => place(box(0.05, 0.3, 0.05, frameMat), x, 0.15, z)));
    g.add(frame, cushion, back, ...legs);
    return g;
  };
  const loungers = [0, 1, 2, 3].map(() => {
    const l = makeLounger();
    props.add(l);
    return l;
  });
  const makePlant = (s) => {
    const g = new THREE.Group();
    const pot = place(cyl(0.32 * s, 0.26 * s, 0.6 * s, std({ color: '#3f4a54', roughness: 0.7 }), 16), 0, 0.3 * s, 0);
    const bush = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), plantMat));
    bush.position.y = 0.95 * s;
    bush.scale.y = 1.25;
    g.add(pot, bush);
    return g;
  };
  const plants = [makePlant(1), makePlant(0.85)];
  plants.forEach((pl) => props.add(pl));
  const bollards = [0, 1, 2, 3].map(() => {
    const b = cyl(0.07, 0.07, 0.5, frameMat, 12);
    const cap = place(cyl(0.075, 0.075, 0.08, bollardMat, 12), 0, 0.2, 0);
    b.add(cap);
    props.add(b);
    return b;
  });

  // Drabinka ze stali (dwa łuki poręczy)
  const makeLadder = () => {
    const g = new THREE.Group();
    [-0.25, 0.25].forEach((x) => {
      const arc = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 20, Math.PI), steelMat));
      arc.rotation.y = Math.PI / 2;
      arc.position.set(x, 0.62, 0.0);
      const down = place(cyl(0.025, 0.025, 0.9, steelMat, 8), x, 0.17, 0.28);
      const inner = place(cyl(0.025, 0.025, 1.1, steelMat, 8), x, 0.07, -0.28);
      g.add(arc, down, inner);
    });
    return g;
  };
  const ladder = makeLadder();
  props.add(ladder);

  // Prywatny: schody narożne + przeciwprąd (pęcherzyki)
  const extrasPriv = new THREE.Group();
  const stepsMeshes = [0, 1, 2].map(() => ubox(steelMat));
  stepsMeshes.forEach((s) => extrasPriv.add(s));
  const jetPlate = box(0.06, 0.4, 0.7, steelMat);
  const jetNozzles = [-0.18, 0.18].map((z) => {
    const n = cyl(0.05, 0.05, 0.05, darkMat, 12);
    n.rotation.z = Math.PI / 2;
    n.position.z = z;
    return n;
  });
  const jet = new THREE.Group();
  jet.add(jetPlate, ...jetNozzles);
  extrasPriv.add(jet);
  const BUBBLES = 70;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), bubbleMat, BUBBLES);
  bubbles.frustumCulled = false;
  bubbles.renderOrder = 8;
  extrasPriv.add(bubbles);
  const bubbleSeed = Array.from({ length: BUBBLES }, () => [rand(), rand() * 2 - 1, rand() * 2 - 1, 0.02 + rand() * 0.03]);

  // Hotelowy: ławka masażowa + kaskada ze ściany
  const extrasHotel = new THREE.Group();
  const bench = ubox(steelMat);
  const cascadePost = box(0.5, 1.3, 0.22, steelMat);
  const cascadeSpout = box(0.5, 0.06, 0.5, steelMat);
  const cascadeSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1), cascadeMat);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), bubbleMat.clone());
  foam.rotation.x = -Math.PI / 2;
  extrasHotel.add(bench, cascadePost, cascadeSpout, cascadeSheet, foam);

  // Sportowy: liny torowe, słupki startowe, płyty dotykowe
  const extrasSport = new THREE.Group();
  const LANES = 6;
  const ropes = Array.from({ length: LANES - 1 }, () => {
    const r = cyl(0.045, 0.045, 1, ropeMat, 8);
    r.rotation.z = Math.PI / 2;
    r.castShadow = false;
    extrasSport.add(r);
    return r;
  });
  const blocks = Array.from({ length: LANES }, () => {
    const g = new THREE.Group();
    const post = place(box(0.5, 0.7, 0.5, blockMat), 0, 0.35, 0);
    const top = place(box(0.52, 0.06, 0.6, laneMat), 0.04, 0.72, 0);
    top.rotation.z = -0.12;
    g.add(post, top);
    extrasSport.add(g);
    return g;
  });
  const pads = Array.from({ length: LANES }, () => {
    const pd = box(0.02, 0.9, 1.4, padMat);
    extrasSport.add(pd);
    return pd;
  });
  const laneStripes = Array.from({ length: LANES }, () => {
    const st = ubox(laneMat, false);
    laneLines.add(st);
    return st;
  });

  site.add(extrasPriv, extrasHotel, extrasSport);

  // Diody LED w ścianach niecki
  const leds = Array.from({ length: 8 }, () => {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), poolLedMat);
    site.add(l);
    return l;
  });

  // ---------- Rury i przepływ ----------
  const pipesGroup = new THREE.Group();
  site.add(pipesGroup);
  let pipeMesh = null;
  const manifolds = [];
  const PCOUNT = 220;
  const particles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), particleMat, PCOUNT);
  particles.frustumCulled = false;
  particles.renderOrder = 1;
  site.add(particles);
  const pColor = new THREE.Color();
  const cMurky = new THREE.Color('#a39f4f');
  const cClean = new THREE.Color('#2fd2ff');
  const cUv = new THREE.Color('#c39bff');
  for (let i = 0; i < PCOUNT; i++) particles.setColorAt(i, cMurky);
  const C = (h) => new THREE.Color(h);
  const cWater = C('#36b3e6');
  const cCaust = C('#ffffff');
  const cCaustLed = C('#6fe3ff');
  const cSky = C('#ffffff');
  const cSkyDusk = C('#5a7fb0');
  const cSun = C('#fff6ea');
  const cSunDusk = C('#ffb27a');

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const roundedPath = (pts, r) => {
    const clean = pts.filter((pt, i) => i === 0 || pt.distanceTo(pts[i - 1]) > 1e-3);
    const path = new THREE.CurvePath();
    let prev = clean[0].clone();
    for (let i = 1; i < clean.length - 1; i++) {
      const a = clean[i - 1];
      const b = clean[i];
      const c = clean[i + 1];
      const d1 = b.clone().sub(a);
      const d2 = c.clone().sub(b);
      const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
      const p1 = b.clone().addScaledVector(d1.normalize(), -rr);
      const p2 = b.clone().addScaledVector(d2.normalize(), rr);
      if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      prev = p2;
    }
    path.add(new THREE.LineCurve3(prev, clean[clean.length - 1].clone()));
    return path;
  };

  const loop = { samples: [], uFilter: 0.5, uUv: 0.6, uIn: 0.8 };
  const SAMPLES = 900;

  const buildPipes = (dims, preset) => {
    const { L, W, D } = dims;
    const k = preset.k;
    const rx = L / 2 + GAP; // ściana maszynowni (x)
    const fxs = filterXs(preset.filters, preset.fr).map((x) => rx + x);
    const fTop = filters[0].userData.topY;
    const pumpX = rx + PUMP_X0;
    const yIn = -D - 0.55;
    const zR = -0.2;
    const pts = [];
    const mark = {};
    const add = (v, name) => {
      if (name) mark[name] = pts.length;
      pts.push(v);
    };
    const yS = FLOOR + 0.42; // ssanie z dna zbiornika
    add(V(-L / 2 + 0.3, -0.38, W / 2 + 0.2)); // rura pod rynną, lewy narożnik
    add(V(L / 2 + 0.2, -0.38, W / 2 + 0.2));
    add(V(L / 2 + 0.2, -0.38, 0.55));
    add(V(L / 2 + 0.2, -1.0, 0.55));
    add(V(rx + TANK.x, -1.0, 0.55));
    add(V(rx + TANK.x, -1.0, TANK.z));
    add(V(rx + TANK.x, yS, TANK.z), 'tank'); // zbiornik przelewowy
    add(V(rx + TANK.x, yS, PUMP_Z));
    add(V(pumpX + 0.1, yS, PUMP_Z), 'pump'); // przez kosz i pompę
    add(V(pumpX + 0.1, -0.8, PUMP_Z));
    add(V(pumpX + 0.1, -0.8, FILTER_Z));
    add(V(fxs[0], -0.8, FILTER_Z));
    add(V(fxs[0], fTop - 0.3, FILTER_Z), 'filterTop'); // filtr
    add(V(fxs[0], FLOOR + 0.5, FILTER_Z), 'filterBot');
    add(V(fxs[0], FLOOR + 0.2, FILTER_Z));
    add(V(fxs[0], FLOOR + 0.2, 0.15));
    add(V(rx + UV.x0 - 0.35, FLOOR + 0.2, 0.15));
    add(V(rx + UV.x0 - 0.35, UV.y, 0.15));
    add(V(rx + UV.x0 - 0.35, UV.y, UV.z), 'uvIn');
    add(V(rx + UV.x1 + 0.25, UV.y, UV.z), 'uvOut'); // lampa UV
    add(V(rx + UV.x1 + 0.25, UV.y, zR)); // wtrysk dezynfekcji przy szafce
    add(V(rx + UV.x1 + 0.25, FLOOR + 0.12, zR));
    add(V(L / 2 + 0.5, FLOOR + 0.12, zR));
    add(V(L / 2 + 0.5, yIn, zR));
    add(V(-L / 4, yIn, zR));
    add(V(-L / 4, -D + 0.03, zR), 'nozzle'); // dysza w dnie
    // w wodzie: od dyszy do rynny
    const inWater = [V(-L / 4 - 0.4, -D * 0.45, W * 0.12), V(-L / 2 + 0.3, -0.08, W / 2 - 0.25), V(-L / 2 + 0.3, -0.08, W / 2 + 0.2)];
    const all = [...pts, ...inWater, pts[0].clone()];

    // długości odcinków (bez zaokrągleń) → miejsca filtra, UV i dyszy na pętli
    const cum = [0];
    for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + all[i].distanceTo(all[i - 1]));
    const total = cum[cum.length - 1];
    loop.uFilter = (cum[mark.filterTop] + cum[mark.filterBot]) / 2 / total;
    loop.uUv = cum[mark.uvIn] / total;
    loop.uUvEnd = cum[mark.uvOut] / total;
    loop.uIn = cum[mark.nozzle] / total;
    const loopPath = roundedPath(all, 0.28);
    loop.samples = loopPath.getSpacedPoints(SAMPLES);

    // Rura (przezroczysta) — cała droga od rynny do dyszy
    const pipePath = roundedPath(pts, 0.28);
    const geo = new THREE.TubeGeometry(pipePath, 420, 0.11 * k, 10, false);
    if (pipeMesh) {
      pipeMesh.geometry.dispose();
      pipeMesh.geometry = geo;
    } else {
      pipeMesh = new THREE.Mesh(geo, pipeMat);
      pipeMesh.renderOrder = 7;
      pipesGroup.add(pipeMesh);
    }

    // Kolektory nad i pod filtrami (pozostałe filtry)
    manifolds.forEach((m) => {
      m.geometry.dispose();
      pipesGroup.remove(m);
    });
    manifolds.length = 0;
    if (fxs.length > 1) {
      const xa = fxs[0];
      const xb = fxs[fxs.length - 1];
      const mk = (ps) => {
        const m = new THREE.Mesh(new THREE.TubeGeometry(roundedPath(ps, 0.2), 60, 0.09 * k, 8, false), pipeMat);
        m.renderOrder = 7;
        pipesGroup.add(m);
        manifolds.push(m);
      };
      mk([V(xa, -0.8, FILTER_Z), V(xb, -0.8, FILTER_Z), V(xb, fTop - 0.2, FILTER_Z)]);
      mk([V(xa, FLOOR + 0.2, FILTER_Z), V(xb, FLOOR + 0.2, FILTER_Z), V(xb, FLOOR + 0.5, FILTER_Z)]);
    }
    loop.scale = k;
  };

  // ---------- Układ makiety dla bieżących wymiarów ----------
  const dims = { L: PRESETS[0].L, W: PRESETS[0].W, D: PRESETS[0].D };
  const dimsVel = { L: 0, W: 0, D: 0 };
  let presetMix = [1, 0, 0]; // płynne pojawianie się wyposażenia
  const filterScale = [1, 0, 0];
  const pumpScale = [1, 0, 0, 0];

  const setBox = (m, x0, x1, y0, y1, z0, z1) => {
    m.scale.set(Math.max(x1 - x0, 1e-3), Math.max(y1 - y0, 1e-3), Math.max(z1 - z0, 1e-3));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };

  const ext = {};
  const layout = () => {
    const { L, W, D } = dims;
    const x0 = -L / 2 - M;
    const x1 = L / 2 + GAP + RW + 0.6;
    const z0 = -W / 2 - M;
    const z1 = W / 2 + M;
    const gw = 0.3; // szerokość rynny
    Object.assign(ext, { x0, x1, z0, z1, L, W, D });

    // taras (płyta) z otworem na nieckę i rynnę
    setBox(deck.n, x0, x1, -SLAB, 0, z0, -W / 2 - gw);
    setBox(deck.s, x0, x1, -SLAB, 0, W / 2 + gw, z1);
    setBox(deck.w, x0, -L / 2 - gw, -SLAB, 0, -W / 2 - gw, W / 2 + gw);
    setBox(deck.e, L / 2 + gw, x1, -SLAB, 0, -W / 2 - gw, W / 2 + gw);
    [
      [deck.n, x1 - x0, M],
      [deck.s, x1 - x0, M],
      [deck.w, M, W + 2 * gw],
      [deck.e, x1 - L / 2 - gw, W + 2 * gw],
    ].forEach(([m, a, b]) => m.material.map.repeat.set(a / 1.2, b / 1.2));

    // rynna
    setBox(grates[0], -L / 2 - gw, L / 2 + gw, -0.06, -0.01, W / 2, W / 2 + gw);
    setBox(grates[1], -L / 2 - gw, L / 2 + gw, -0.06, -0.01, -W / 2 - gw, -W / 2);
    setBox(grates[2], -L / 2 - gw, -L / 2, -0.06, -0.01, -W / 2, W / 2);
    setBox(grates[3], L / 2, L / 2 + gw, -0.06, -0.01, -W / 2, W / 2);
    grates[0].material.map.repeat.set((L + 2 * gw) / 0.32, 1);
    grates[1].material.map.repeat.set((L + 2 * gw) / 0.32, 1);
    grates[2].material.map.repeat.set(W / 0.32, 1);
    grates[3].material.map.repeat.set(W / 0.32, 1);

    // grunt (przód osobno — odsuwa się w przekroju)
    setBox(earth.n, x0, x1, BOT, -SLAB, z0, -W / 2 - gw);
    setBox(earth.s, x0, x1, BOT, -SLAB, W / 2 + gw, z1);
    setBox(earth.w, x0, -L / 2 - gw, BOT, -SLAB, -W / 2 - gw, W / 2 + gw);
    setBox(earth.e, L / 2 + gw, x1, BOT, -SLAB, -W / 2 - gw, W / 2 + gw);
    setBox(earth.b, -L / 2 - gw, L / 2 + gw, BOT, -D - 0.12, -W / 2 - gw, W / 2 + gw);

    // niecka
    const t = 0.08;
    setBox(poolFloor, -L / 2 - t, L / 2 + t, -D - 0.12, -D, -W / 2 - t, W / 2 + t);
    setBox(walls.n, -L / 2 - t, L / 2 + t, -D, -0.02, -W / 2 - t, -W / 2);
    setBox(walls.s, -L / 2 - t, L / 2 + t, -D, -0.02, W / 2, W / 2 + t);
    setBox(walls.w, -L / 2 - t, -L / 2, -D, -0.02, -W / 2, W / 2);
    setBox(walls.e, L / 2, L / 2 + t, -D, -0.02, -W / 2, W / 2);

    causticA1.scale.set(L, W, 1);
    causticB1.scale.set(L, W, 1);
    causticA1.position.set(0, -D + 0.012, 0);
    causticB1.position.set(0, -D + 0.016, 0);
    causticA.repeat.set(L / 2.2, W / 2.2);
    causticB.repeat.set(L / 3.1, W / 3.1);
    surface.scale.set(L, W, 1);
    waveNormal.repeat.set(L / 3, W / 3);

    blob.scale.set((x1 - x0) * 1.35, (z1 - z0) * 1.6, 1);
    blob.position.set((x0 + x1) / 2, BOT - 0.02, 0);

    room.position.set(L / 2 + GAP, 0, 0);
    earth.s.userData.z = earth.s.position.z;
    deck.s.userData.z = deck.s.position.z;

    // taras: leżaki, rośliny, oprawy, drabinka
    const back = -W / 2 - gw - 1.25;
    loungers.forEach((l, i) => {
      l.position.set(-L / 2 + 1.0 + i * 1.15, 0, back);
    });
    plants[0].position.set(x0 + 0.75, 0, z0 + 0.75);
    plants[1].position.set(x1 - 0.8, 0, z0 + 0.8);
    [
      [x0 + 0.4, W / 2 + gw + 1.4],
      [L / 2 + gw + 0.7, z1 - 0.4],
      [x0 + 0.4, -W / 2 - gw - 0.3],
      [x1 - 0.4, z0 + 0.4],
    ].forEach(([x, z], i) => bollards[i].position.set(x, 0.25, z));
    ladder.position.set(L / 2 - 0.9, 0, -W / 2 + 0.02);
    ladder.rotation.y = 0;

    // diody: po dwie na długich ścianach, po jednej na krótkich
    const ly = -D * 0.55;
    const ledPos = [
      [-L / 4, ly, -W / 2 + 0.005, 0],
      [L / 4, ly, -W / 2 + 0.005, 0],
      [-L / 4, ly, W / 2 - 0.005, Math.PI],
      [L / 4, ly, W / 2 - 0.005, Math.PI],
      [-L / 2 + 0.005, ly, -W / 4, Math.PI / 2],
      [-L / 2 + 0.005, ly, W / 4, Math.PI / 2],
      [L / 2 - 0.005, ly, -W / 4, -Math.PI / 2],
      [L / 2 - 0.005, ly, W / 4, -Math.PI / 2],
    ];
    leds.forEach((l, i) => {
      const [x, y, z, ry] = ledPos[i];
      l.position.set(x, y, z);
      l.rotation.set(0, ry, 0);
    });
    poolLight.position.set(0, -D * 0.5, 0);
    poolLight.distance = Math.max(L, W) * 1.6;

    // prywatny: schody w narożniku, przeciwprąd na krótkiej ścianie
    const sw = Math.min(1.6, W * 0.4);
    stepsMeshes.forEach((s, i) => {
      const h = (D / 4) * (i + 1);
      setBox(s, -L / 2, -L / 2 + 0.38 * (3 - i), -D, -D + h, W / 2 - sw, W / 2);
    });
    jet.position.set(-L / 2 + 0.03, -0.42, -W / 4);

    // hotelowy: ławka wzdłuż tylnej ściany, kaskada
    setBox(bench, -L / 4 - 2, -L / 4 + 2, -D, -0.62, -W / 2, -W / 2 + 0.45);
    cascadePost.position.set(-L / 8, 0.65, -W / 2 - gw - 0.25);
    cascadeSpout.position.set(-L / 8, 1.25, -W / 2 - gw - 0.05);
    cascadeSheet.position.set(-L / 8, 0.62, -W / 2 + 0.12);
    cascadeSheet.scale.y = 1.25;
    cascadeSheet.rotation.x = 0.12;
    foam.position.set(-L / 8, -0.015, -W / 2 + 0.45);

    // sportowy: tory
    const lw = W / LANES;
    ropes.forEach((r, i) => {
      r.scale.y = L;
      r.position.set(0, -0.03, -W / 2 + lw * (i + 1));
    });
    blocks.forEach((b, i) => {
      b.position.set(-L / 2 - gw - 0.45, 0, -W / 2 + lw * (i + 0.5));
    });
    pads.forEach((pd, i) => {
      pd.position.set(-L / 2 + 0.012, -0.5, -W / 2 + lw * (i + 0.5));
      pd.scale.z = Math.min(1, (lw - 0.3) / 1.4);
    });
    laneStripes.forEach((st, i) => {
      setBox(st, -L / 2 + 2, L / 2 - 2, -D, -D + 0.006, -W / 2 + lw * (i + 0.5) - 0.12, -W / 2 + lw * (i + 0.5) + 0.12);
    });

    // cień słońca obejmuje całą makietę
    const span = Math.max(x1 - x0, z1 - z0) * 0.62 + 2;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: span * 5 });
    sun.shadow.camera.updateProjectionMatrix();
    const cx = (x0 + x1) / 2;
    sun.target.position.set(cx, -1, 0);
    sun.position.set(cx + span * 0.9, span * 2.1, span * 1.3);
  };

  const applyPresetGear = (preset) => {
    const fxs = filterXs(preset.filters, preset.fr);
    filters.forEach((f, i) => {
      layoutFilter(f, preset.fr, preset.fh);
      if (fxs[i] !== undefined) f.position.set(fxs[i], 0, FILTER_Z);
    });
  };

  // ---------- Kamera ----------
  // Ujęcia: makieta z góry → przekrój z przodu → maszynownia → nisko nad wodą o zmierzchu
  let radius0 = 30;
  const sizeOf = () => Math.max(ext.x1 - ext.x0, (ext.z1 - ext.z0) * 1.25);
  const SHOTS = [
    () => ({ th: 0.62, ph: 0.52, r: radius0, t: [(ext.x0 + ext.x1) / 2 - 0.4, -0.5, 0.3] }),
    () => ({ th: 0.3, ph: 0.32, r: radius0 * 0.7, t: [(ext.x0 + ext.x1) / 2 + 0.8, -0.2, 0] }),
    () => ({ th: -0.3, ph: 0.5, r: 17 + (radius0 - 40) * 0.12, t: [ext.L / 2 + GAP + 3.2, -2.1, -0.3] }),
    () => ({ th: -0.45, ph: 0.56, r: radius0 * 0.5, t: [-ext.L * 0.05, -0.4, 0] }),
  ];
  const shotAt = (p) => {
    const k1 = smoothstep(0.22, 0.32, p);
    const k2 = smoothstep(0.47, 0.56, p);
    const k3 = smoothstep(0.73, 0.84, p);
    const s = SHOTS.map((f) => f());
    const mix = (get) => lerp(lerp(lerp(get(s[0]), get(s[1]), k1), get(s[2]), k2), get(s[3]), k3);
    return { th: mix((x) => x.th), ph: mix((x) => x.ph), r: mix((x) => x.r), t: [0, 1, 2].map((i) => mix((x) => x.t[i])) };
  };

  const anim = { th: 0.6, ph: 0.6, r: 30, tx: 3, ty: -1.2, tz: 0, yawUser: 0, yawVel: 0, px: 0, py: 0, intro: reduceMotion ? 1 : 0, introStart: 0, off: 0, offY: 0 };
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
  const resize = () => {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    aspectK = Math.pow(1.25 / Math.min(camera.aspect, 1.25), 0.75);
    camera.updateProjectionMatrix();
    measureCard();
    kick();
  };

  // ---------- Etykiety (rzut 3D → 2D) ----------
  const rxOf = () => ext.L / 2 + GAP;
  const TAGS = {
    basin: { steps: [0], side: 'left', pos: () => V(-ext.L / 2 - 0.1, 0.05, -ext.W / 2 - 0.1), a: (p) => smoothstep(0.04, 0.12, p) },
    gutter: { steps: [0, 1], side: 'left', pos: () => V(-ext.L / 2 - 0.15, 0, ext.W / 2 + 0.15), a: (p) => smoothstep(0.12, 0.2, p) * (1 - smoothstep(0.4, 0.46, p)) },
    tank: { steps: [1], pos: () => V(rxOf() + TANK.x + 0.4, FLOOR + TANK.h, TANK.z), a: (p) => smoothstep(0.36, 0.42, p) },
    inlets: { steps: [1], side: 'left', pos: () => V(-ext.L / 4, -ext.D, -0.2), a: (p) => smoothstep(0.4, 0.46, p) },
    pumps: { steps: [2], side: 'left', pos: () => V(rxOf() + PUMP_X0 - 0.36, FLOOR + 0.5, PUMP_Z), a: (p) => smoothstep(0.55, 0.59, p) },
    filters: { steps: [2], side: 'left', pos: () => V(rxOf() + filters[0].position.x - PRESETS[state.preset].fr, FLOOR + 1.1, FILTER_Z), a: (p) => smoothstep(0.56, 0.6, p) },
    uv: { steps: [2], pos: () => V(rxOf() + UV.x1, UV.y + 0.1, UV.z), a: (p) => smoothstep(0.58, 0.62, p) },
    dosing: { steps: [2], side: 'left', pos: () => V(rxOf() + DOS.x - 0.06, FLOOR + 2.25, DOS.z - 0.3), a: (p) => smoothstep(0.6, 0.64, p) },
    led: { steps: [3], pos: () => V(ext.L / 4, -ext.D * 0.55, -ext.W / 2), a: (p) => ledAt(p) },
    extra: { steps: [3], side: 'left', pos: () => extraAnchor(), a: (p) => extraAt(p) },
  };
  const extraAnchor = () => {
    if (state.preset === 0) return V(-ext.L / 2 + 0.2, -0.2, -ext.W / 4);
    if (state.preset === 1) return V(-ext.L / 8 - 0.25, 1.3, -ext.W / 2 - 0.4);
    return V(-ext.L / 2, 0, -ext.W / 2 + ext.W / LANES / 2);
  };
  const tagState = tagEls.map(() => ({ a: 0, w: 0 }));
  const _v = new THREE.Vector3();
  let cardBox = null;
  const measureCard = () => {
    tagState.forEach((st) => (st.w = 0));
    if (!specCard) return;
    const a = stage.getBoundingClientRect();
    const b = specCard.getBoundingClientRect();
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

  // ---------- Zmiana typu basenu ----------
  let rebuildPipes = true;
  onPreset = () => {
    rebuildPipes = true;
    requestAnimationFrame(measureCard);
    if (reduceMotion) {
      const s = PRESETS[state.preset];
      dims.L = s.L;
      dims.W = s.W;
      dims.D = s.D;
    }
    kick();
  };

  // ---------- Pętla ----------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  let last = performance.now();
  let raf = 0;
  let lastDimsKey = '';
  const springStep = (key, goal, dt) => {
    // sprężyna krytycznie tłumiona (odpowiedź ≈ 0,55 s)
    const w = 2 * Math.PI / 0.55;
    const x = dims[key] - goal;
    const v = dimsVel[key];
    const e = Math.exp(-w * dt);
    const nx = (x + (v + w * x) * dt) * e;
    const nv = (v - w * (v + w * x) * dt) * e;
    dims[key] = goal + nx;
    dimsVel[key] = nv;
    if (Math.abs(nx) < 1e-3 && Math.abs(nv) < 1e-3) {
      dims[key] = goal;
      dimsVel[key] = 0;
    }
  };

  const frame = (now) => {
    raf = 0;
    const dt = settle ? 10 : Math.min((now - last) / 1000, 0.1);
    last = now;
    const t = now / 1000;
    const p = state.progress;
    const step = Math.min(3, Math.floor(p * 4 + 0.0001));
    const preset = PRESETS[state.preset];

    // Wejście: makieta wyjeżdża z dołu i obraca się do ujęcia
    if (anim.intro < 1 && (state.inView || settle)) {
      if (!anim.introStart) anim.introStart = now;
      anim.intro = settle ? 1 : Math.min((now - anim.introStart) / 1500, 1);
    }
    const intro = 1 - Math.pow(1 - anim.intro, 3);
    site.position.y = (1 - intro) * -4;
    site.scale.setScalar(lerp(0.9, 1, intro));

    // Wymiary niecki: sprężyna do celu
    if (settle) {
      dims.L = preset.L;
      dims.W = preset.W;
      dims.D = preset.D;
    } else {
      springStep('L', preset.L, dt);
      springStep('W', preset.W, dt);
      springStep('D', preset.D, dt);
    }
    const key = `${dims.L.toFixed(3)}|${dims.W.toFixed(3)}|${dims.D.toFixed(3)}`;
    if (key !== lastDimsKey) {
      lastDimsKey = key;
      applyPresetGear(preset);
      layout();
      buildPipes(dims, preset);
      rebuildPipes = false;
      radius0 = sizeOf() * 1.85 + 3;
    } else if (rebuildPipes) {
      applyPresetGear(preset);
      buildPipes(dims, preset);
      rebuildPipes = false;
    }

    // Wyposażenie zależne od typu: płynnie się pojawia
    presetMix = presetMix.map((v, i) => {
      const g = i === state.preset ? 1 : 0;
      return settle ? g : g + ease(v - g, 9, dt);
    });
    const popIn = (grp, v) => {
      grp.visible = v > 0.01;
      grp.scale.setScalar(lerp(0.92, 1, v));
    };
    popIn(extrasPriv, presetMix[0]);
    popIn(extrasHotel, presetMix[1]);
    popIn(extrasSport, presetMix[2]);
    laneLines.visible = presetMix[2] > 0.5;
    loungers.forEach((l, i) => {
      const n = state.preset === 0 ? 2 : state.preset === 1 ? 4 : 0;
      const g = i < n ? 1 : 0;
      l.userData.s = settle ? g : g + ease((l.userData.s ?? g) - g, 9, dt);
      l.visible = l.userData.s > 0.01;
      l.scale.setScalar(Math.max(l.userData.s, 0.001));
    });
    filters.forEach((f, i) => {
      const g = i < preset.filters ? 1 : 0;
      filterScale[i] = settle ? g : g + ease(filterScale[i] - g, 9, dt);
      f.visible = filterScale[i] > 0.01;
      f.scale.set(1, Math.max(filterScale[i], 0.001), 1);
    });
    pumps.forEach((pm, i) => {
      const g = i < preset.pumps ? 1 : 0;
      pumpScale[i] = settle ? g : g + ease(pumpScale[i] - g, 9, dt);
      pm.visible = pumpScale[i] > 0.01;
      pm.scale.setScalar(Math.max(pumpScale[i], 0.001));
    });

    // Woda: napełnianie i przejrzystość
    const fill = reduceMotion ? Math.round(fillAt(p)) : fillAt(p);
    const D = dims.D;
    const h = Math.max(D * fill - 0.03, 0.001);
    water.visible = fill > 0.005;
    setBox(water, -dims.L / 2, dims.L / 2, -D, -D + h, -dims.W / 2, dims.W / 2);
    surface.visible = water.visible;
    surface.position.set(0, -D + h + 0.002, 0);
    const murk = murkAt(p);
    const dusk = duskAt(p);
    const led = ledAt(p);
    waterMat.color.copy(cWater).lerp(cMurky, murk * 0.75);
    waterMat.opacity = lerp(0.48, 0.8, murk) - dusk * 0.06;
    waterMat.emissiveIntensity = led * 1.9;
    surfaceMat.emissiveIntensity = led * 0.9;
    surfaceMat.opacity = lerp(0.42, 0.62, murk);
    const caus = fill * (1 - murk) * (reduceMotion ? 0.6 : 1);
    causticMatA.opacity = caus * lerp(0.3, 0.75, led);
    causticMatB.opacity = caus * lerp(0.2, 0.55, led);
    causticMatA.color.copy(cCaust).lerp(cCaustLed, led);
    causticA1.visible = causticB1.visible = caus > 0.01;
    if (!reduceMotion) {
      causticA.offset.set(t * 0.03, t * 0.017);
      causticB.offset.set(-t * 0.021, t * 0.026);
      waveNormal.offset.set(t * 0.02, t * 0.013);
    }

    // Przekrój: przód gruntu i tarasu odjeżdża, reszta staje się szklana
    const cut = reduceMotion ? Math.round(cutAt(p)) : cutAt(p);
    const ghost = lerp(1, 0.2, cut);
    [soilMat].forEach((m) => {
      m.opacity = ghost;
      m.depthWrite = ghost > 0.95;
    });
    soilFrontMat.opacity = 1 - cut;
    soilFrontMat.depthWrite = cut < 0.05;
    earth.s.visible = cut < 0.99;
    earth.s.position.z = earth.s.userData.z + cut * 3.2;
    deck.s.material.opacity = 1 - cut;
    deck.s.material.depthWrite = cut < 0.05;
    deck.s.visible = cut < 0.99;
    deck.s.position.z = deck.s.userData.z + cut * 3.2;
    deck.e.material.opacity = lerp(1, 0.18, cut);
    deck.e.material.depthWrite = cut < 0.05;
    deck.e.castShadow = cut < 0.3;
    plants.forEach((pl) => (pl.visible = cut < 0.5));
    hatch.visible = cut < 0.5;
    steelWallMat.opacity = lerp(1, 0.22, cut);
    steelWallMat.depthWrite = cut < 0.05;
    grates[0].visible = cut < 0.6;
    bollards[0].visible = cut < 0.5;
    room.visible = cut > 0.01 || step === 2;

    // Rury i cząstki
    const pk = pipesAt(p);
    pipesGroup.visible = pk > 0.01;
    pipeMat.opacity = 0.32 * pk;
    const fk = flowAt(p);
    particles.visible = fk > 0.01 && loop.samples.length > 0;
    const clean = cleanAt(p);
    const roomOn = roomAt(p);
    if (particles.visible) {
      const S = loop.samples;
      const n = S.length - 1;
      const speed = reduceMotion ? 0 : 0.055;
      const ps = 0.062 * loop.scale * fk;
      for (let i = 0; i < PCOUNT; i++) {
        const u = (i / PCOUNT + t * speed) % 1;
        const fi = u * n;
        const i0 = Math.floor(fi);
        const a = S[i0];
        const b = S[Math.min(i0 + 1, n)];
        pos.lerpVectors(a, b, fi - i0);
        const jitter = 1 + Math.sin(i * 12.9898 + t * 3) * 0.12;
        m4.compose(pos, q, sc.setScalar(ps * jitter));
        particles.setMatrixAt(i, m4);
        // kolor: mętna przed filtrem, czysta za nim (gdy maszynownia pracuje), fiolet w lampie UV
        const after = u > loop.uFilter;
        let dirt = after ? 1 - clean : 1 - clean * 0.35;
        if (u > loop.uIn) dirt = lerp(dirt, 1 - clean, 0.5);
        pColor.copy(cClean).lerp(cMurky, clamp01(dirt));
        if (u > loop.uUv && u < loop.uUvEnd) pColor.lerp(cUv, roomOn * 0.8);
        particles.setColorAt(i, pColor);
      }
      particles.instanceMatrix.needsUpdate = true;
      particles.instanceColor.needsUpdate = true;
    }

    // Maszynownia: kontrolki, ekran, UV
    const on = roomOn;
    ledMat.color.set(on > 0.5 ? '#28d17c' : '#3a4a3f');
    screenMat.emissiveIntensity = on * 1.4;
    uvGlowMat.opacity = on * (0.35 + (reduceMotion ? 0 : Math.sin(t * 7) * 0.05)) * (1 - dusk);
    pumps.forEach((pm, i) => {
      pm.userData.led.visible = on > 0.5;
      pm.children[2].rotation.x = reduceMotion ? 0 : t * 14 * on + i;
    });

    // Zmierzch i światło
    renderer.toneMappingExposure = lerp(1.05, 0.42, dusk);
    hemi.intensity = lerp(0.85, 0.3, dusk);
    hemi.color.copy(cSky).lerp(cSkyDusk, dusk);
    sun.intensity = lerp(2.3, 0.35, dusk);
    sun.color.copy(cSun).lerp(cSunDusk, dusk);
    poolLight.intensity = led * 40 * loop.scale * loop.scale;
    poolLedMat.emissiveIntensity = led * 8;
    bollardMat.emissiveIntensity = dusk * 7;

    // Atrakcje w kroku 4
    const ex = extraAt(p);
    // przeciwprąd: pęcherzyki od dysz
    bubbleMat.opacity = ex * 0.85 * presetMix[0];
    if (presetMix[0] > 0.01) {
      for (let i = 0; i < BUBBLES; i++) {
        const [s0, oy, oz, r] = bubbleSeed[i];
        const u = (s0 + t * 0.35) % 1;
        const x = -dims.L / 2 + 0.1 + u * Math.min(3.2, dims.L * 0.45);
        pos.set(x, -0.42 + oy * u * 0.35 + u * 0.25, -dims.W / 4 + oz * (0.15 + u * 0.6));
        m4.compose(pos, q, sc.setScalar(r * 1.5 * (1 - u * 0.5) * (ex > 0.01 ? 1 : 0)));
        bubbles.setMatrixAt(i, m4);
      }
      bubbles.instanceMatrix.needsUpdate = true;
    }
    // kaskada
    cascadeMat.opacity = ex * 0.9;
    cascadeSheet.visible = ex > 0.01;
    if (!reduceMotion) cascadeTex.offset.y = (t * 1.6) % 1;
    foam.material.opacity = ex * 0.55;
    foam.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
    // płyty dotykowe
    padMat.emissiveIntensity = ex * (0.8 + (reduceMotion ? 0 : Math.sin(t * 3) * 0.3));

    // Kamera
    const shot = shotAt(p);
    const r0 = shot.r * aspectK;
    const k = settle ? 0 : 1;
    const introTh = (1 - intro) * 0.7;
    const thGoal = shot.th + introTh + anim.px * 0.06;
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
    // karta danych stoi po prawej (na telefonie na dole) — kadr ustępuje jej miejsca
    const narrow = stageW < 600 || stageW / stageH < 0.9;
    const offX = narrow ? 0 : stageW * 0.11;
    const offY = narrow ? stageH * 0.06 : 0;
    camera.setViewOffset(stageW, stageH, offX, offY, stageW, stageH);
    camera.updateMatrixWorld();
    site.updateMatrixWorld();

    placeTags(p, step, dt, smoothstep(0.7, 1, anim.intro));

    renderer.render(scene, camera);
    const moving = dragging || Math.abs(anim.yawVel) > 1e-3 || !reduceMotion;
    if (state.visible && moving && !settle) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (state.visible && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  window.addEventListener('scroll', kick, { passive: true });

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

  // Uchwyt do testów i zrzutów: ustawia postęp i typ basenu, renderuje gotową klatkę
  stage._seek = (p, presetIndex) => {
    if (typeof presetIndex === 'number') setPreset(presetIndex);
    state.override = p;
    state.progress = p;
    shownVol.v = PRESETS[state.preset].vol * fillAt(p);
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
