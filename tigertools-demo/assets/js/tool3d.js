/* ==========================================================================
   Tiger Tools — zaginadło do rąbka BDZ w 3D + konfigurator (hero i karta produktu)
   Model wg zdjęć z katalogu: dwie szlifowane płyty ze stali skręcone nitami,
   z dwiema szczelinami roboczymi (20/40 mm albo 15/30 mm), rzędem otworów
   montażowych i grawerem. Wersja BDZR ma czarną rękojeść pałąkową
   (24 cm przy 46 cm, 40 cm przy 61 cm). Długość 31 / 46 / 61 / 81 cm zmienia się płynnie.
   „Zobacz w akcji”: krawędź blachy wchodzi w szczelinę, zaginadło podnosi ją do 90°.
   Zwykły skrypt + dynamiczny import (import map w <head>) — działa też z dysku.
   ========================================================================== */
(() => {
  const DATA = window.TT_DATA || {};
  const B = DATA.bdz;
  if (!B) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Konfigurator (działa też bez WebGL) ----------
  const q = new URLSearchParams((window.TT_LOC || location).search);
  const cfg = {
    len: B.len.includes(+q.get('len')) ? +q.get('len') : 46,
    depth: q.get('d') === '15/30' ? '15/30' : '20/40',
    handle: q.get('h') === '1',
  };
  const canHandle = (len) => !!B.rprice[len];
  const info = (c = cfg) => {
    const h = c.handle && canHandle(c.len);
    const depth = h ? '20/40' : c.depth;
    const sym = `${h ? 'BDZR' : 'BDZ'} ${depth}/${c.len * 10}`;
    const price = h ? B.rprice[c.len] : B.price[c.len];
    const stock = h ? B.rstock[c.len] : B.stock[`${c.len}-${depth}`];
    const hl = B.handle[c.len] || 24;
    const name = `Zaginadło do rąbka blachy ${c.len} cm${h ? ` z rękojeścią ${hl} cm` : ''} ${sym}`;
    return { sym, price, stock, name, handle: h, depth, hl, img: h ? 'p/bdz-2.webp' : 'p/bdz.webp', key: `bdz-${c.len}-${depth}-${h ? 1 : 0}` };
  };
  const controllers = new Map();

  const render = () => {
    if (!canHandle(cfg.len)) cfg.handle = false;
    if (cfg.handle) cfg.depth = '20/40';
    const d = info();
    $$('.js-bdz-len').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === cfg.len)));
    $$('.js-bdz-depth').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.v === cfg.depth));
      b.disabled = cfg.handle && b.dataset.v === '15/30';
    });
    $$('.js-bdz-handle').forEach((b) => {
      b.setAttribute('aria-pressed', String((b.dataset.v === '1') === cfg.handle));
      if (b.dataset.v === '1') b.disabled = !canHandle(cfg.len);
    });
    $$('.js-bdz-hlen').forEach((el) => (el.textContent = canHandle(cfg.len) ? `${B.handle[cfg.len]} cm` : '46 i 61 cm'));
    $$('.js-bdz-note').forEach((el) => {
      el.textContent = !canHandle(cfg.len)
        ? 'Rękojeść (BDZR) jest dostępna dla długości 46 i 61 cm.'
        : cfg.handle
          ? `BDZR ma krawędzie 20 i 40 mm. Rękojeść ${d.hl} cm w komplecie.`
          : 'Każda blacha ma otwory do późniejszego montażu rękojeści.';
    });
    const [a, b] = d.depth.split('/');
    $$('.js-bdz-price').forEach((el) => (el.dataset.price = d.price));
    $$('.js-bdz-sym').forEach((el) => (el.textContent = d.sym));
    $$('.js-bdz-stock').forEach((el) => {
      el.textContent = `Na stanie: ${d.stock} szt.`;
      el.classList.toggle('stock--low', d.stock < 6);
    });
    $$('.js-bdz-ea').forEach((el) => (el.textContent = `Krawędź ${a} mm`));
    $$('.js-bdz-eb').forEach((el) => (el.textContent = `Krawędź ${b} mm`));
    $$('.js-bdz-ht').forEach((el) => (el.textContent = `Rękojeść ${d.hl} cm`));
    $$('.js-dim').forEach((el) => (el.textContent = `${cfg.len} cm`));
    $$('.js-bdz-link').forEach((el) => (el.href = `produkt.html?id=bdz&len=${cfg.len}&d=${encodeURIComponent(d.depth)}&h=${d.handle ? 1 : 0}`));
    $$('[data-tool3d]').forEach((r) => r.classList.toggle('has-handle', d.handle));
    window.TT && window.TT.renderPrices();
    controllers.forEach((c) => c.setConfig(cfg));
    dispatchEvent(new CustomEvent('tt:bdz', { detail: d }));
  };
  const set = (patch) => {
    Object.assign(cfg, patch);
    render();
  };
  $$('.js-bdz-len').forEach((b) => b.addEventListener('click', () => set({ len: +b.dataset.v })));
  $$('.js-bdz-depth').forEach((b) => b.addEventListener('click', () => !b.disabled && set({ depth: b.dataset.v })));
  $$('.js-bdz-handle').forEach((b) => b.addEventListener('click', () => !b.disabled && set({ handle: b.dataset.v === '1' })));
  const add = (qty = 1, from) => {
    const d = info();
    window.TT && window.TT.addToCart({ id: 'bdz', key: d.key, name: d.name, sym: d.sym, price: d.price, img: d.img, qty, from });
  };
  $$('.js-bdz-add').forEach((b) => b.addEventListener('click', () => add(1, b)));
  window.BDZ = { cfg, info, set, add };

  // Galeria karty produktu: zdjęcie ↔ model 3D
  const setGalleryMode = (main, mode) => {
    if (!main) return;
    main.classList.toggle('is-3d', mode === '3d');
    $$('.js-gmode', main).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === mode)));
  };
  window.BDZ.setGalleryMode = setGalleryMode;
  $$('.js-gmode').forEach((b) => b.addEventListener('click', () => setGalleryMode(b.closest('.gallery__main'), b.dataset.m)));
  $$('.js-play').forEach((b) =>
    b.addEventListener('click', () => {
      const roots = $$('[data-tool3d]').filter((r) => !r.hidden);
      const root = b.dataset.target ? document.getElementById(b.dataset.target) : roots[0];
      const main = root && root.closest('.gallery__main');
      const wasHidden = main && !main.classList.contains('is-3d');
      if (wasHidden) setGalleryMode(main, '3d');
      const go = () => controllers.get(root) && controllers.get(root).play();
      if (wasHidden) setTimeout(go, 400);
      else go();
    })
  );
  render();

  // ---------- Scena 3D ----------
  let THREE;
  let RoomEnvironment;
  const start = async () => {
    const roots = $$('[data-tool3d]').filter((r) => !r.hidden && !controllers.has(r));
    if (!roots.length) return;
    try {
      THREE = THREE || (await import('three'));
      RoomEnvironment = RoomEnvironment || (await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment;
    } catch {
      roots.forEach((r) => r.classList.add('no-webgl'));
      return;
    }
    roots.forEach((r) => {
      try {
        const c = mount(r);
        controllers.set(r, c);
        c.setConfig(cfg, true);
      } catch {
        r.classList.add('no-webgl');
      }
    });
  };
  window.BDZ.start = start;
  start();

  function mount(root) {
    const canvas = root.querySelector('canvas');
    const tags = $$('.tool-tag', root);
    const stepTag = root.querySelector('.js-step');
    const light = root.classList.contains('pdp3d');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    if (!renderer.getContext()) throw new Error('no webgl');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = light ? 1.0 : 1.12;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#ffffff', '#2a2a2a', light ? 0.9 : 0.55));
    const key = new THREE.DirectionalLight('#fff3e6', 2.4);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(light ? '#ffffff' : '#ffc79a', light ? 0.9 : 2.8);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const tex = (c) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      return t;
    };
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // szlif stali: drobne poziome rysy
    const brushed = (g, w, h, base = 196) => {
      g.fillStyle = `rgb(${base},${base + 3},${base + 7})`;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < h * 1.4; i++) {
        const y = rnd() * h;
        const v = base + (rnd() - 0.5) * 34;
        g.strokeStyle = `rgba(${v | 0},${(v + 3) | 0},${(v + 7) | 0},${0.25 + rnd() * 0.35})`;
        g.lineWidth = 0.6 + rnd() * 1.2;
        g.beginPath();
        const x = rnd() * w;
        g.moveTo(x - w * 0.6 * rnd(), y);
        g.lineTo(x + w * 0.6 * rnd(), y);
        g.stroke();
      }
    };
    const sideC = document.createElement('canvas');
    sideC.width = 512;
    sideC.height = 64;
    brushed(sideC.getContext('2d'), 512, 64, 176);
    const sideTex = tex(sideC);

    // Grawer na górnej płycie (rysowany od nowa przy zmianie długości / głębokości)
    const W = 1.1; // szerokość płyty: 110 mm (1 j. = 10 cm)
    const topC = document.createElement('canvas');
    const topTex = tex(topC);
    const logoImg = new Image();
    logoImg.src = window.TT_LOGO3D || (window.TT_IMG && window.TT_IMG['logo-tt.png']) || 'assets/img/logo-tt.png';
    logoImg.onload = () => drawTop();
    let drawn = { len: 0, depth: '' };
    function drawTop(len = drawn.len || 4.6, depth = drawn.depth || '20/40') {
      drawn = { len, depth };
      const Wpx = 2048;
      const Hpx = Math.round((Wpx * W) / len);
      topC.width = Wpx;
      topC.height = Hpx;
      const g = topC.getContext('2d');
      seed = 11;
      brushed(g, Wpx, Hpx, 200);
      const pxPerCm = Wpx / (len * 10);
      // otwory montażowe w osi (okrągłe i kwadratowe, jak na zdjęciach)
      const n = Math.max(3, Math.round(len * 1.3));
      for (let i = 0; i < n; i++) {
        const x = Wpx * ((i + 0.5) / n);
        const y = Hpx * 0.5;
        const r = 0.45 * pxPerCm;
        g.fillStyle = '#1b1d20';
        if (i % 3 === 1) g.fillRect(x - r, y - r, r * 2, r * 2);
        else {
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = 'rgba(255,255,255,.35)';
        g.lineWidth = 2;
        g.stroke();
      }
      // nity na końcach
      for (const fx of [0.035, 0.965]) {
        for (const fy of [0.25, 0.75]) {
          const x = Wpx * fx + (fx < 0.5 ? 1 : -1) * 1.2 * pxPerCm;
          const y = Hpx * fy;
          const r = 0.55 * pxPerCm;
          const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
          gr.addColorStop(0, '#f2f3f5');
          gr.addColorStop(1, '#8b9096');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        }
      }
      // grawer: logo, długość, krawędzie robocze
      const ink = 'rgba(40,36,32,.82)';
      if (logoImg.complete && logoImg.naturalWidth) {
        const lh = Hpx * 0.34;
        const lw = (lh * logoImg.naturalWidth) / logoImg.naturalHeight;
        g.save();
        g.globalAlpha = 0.85;
        g.filter = 'grayscale(1) contrast(1.2) brightness(.55)';
        g.drawImage(logoImg, Wpx * 0.08, Hpx * 0.08, lw, lh);
        g.restore();
      }
      g.fillStyle = ink;
      g.textBaseline = 'middle';
      g.font = `600 ${Math.round(Hpx * 0.11)}px "Inter Tight", Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillText(`${Math.round(len * 100)} mm`, Wpx * 0.62, Hpx * 0.27);
      const [a, b] = depth.split('/');
      g.font = `600 ${Math.round(Hpx * 0.085)}px "Inter Tight", Arial, sans-serif`;
      g.textAlign = 'left';
      g.fillText(`${a} mm`, Wpx * 0.2, Hpx * 0.86);
      g.fillText(`${b} mm`, Wpx * 0.2, Hpx * 0.14 + Hpx * 0.06);
      g.font = `500 ${Math.round(Hpx * 0.06)}px "Inter Tight", Arial, sans-serif`;
      g.fillText('DEKARSKI-SKLEP.PL', Wpx * 0.08, Hpx * 0.5);
      topTex.needsUpdate = true;
    }

    // ---------- Materiały ----------
    const steelTop = new THREE.MeshStandardMaterial({ map: topTex, metalness: 0.78, roughness: 0.34, envMapIntensity: 1.15 });
    const steel = new THREE.MeshStandardMaterial({ map: sideTex, color: '#d6d9dd', metalness: 0.82, roughness: 0.3, envMapIntensity: 1.1 });
    const steelDark = new THREE.MeshStandardMaterial({ color: '#4a4e53', metalness: 0.6, roughness: 0.55 });
    const black = new THREE.MeshPhysicalMaterial({ color: '#121314', roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.25 });
    const sheetMat = new THREE.MeshStandardMaterial({ color: '#59626b', metalness: 0.5, roughness: 0.48, envMapIntensity: 0.6, transparent: true, side: THREE.DoubleSide });
    const dimMat = new THREE.LineBasicMaterial({ color: light ? '#9a9a9a' : '#ffffff', transparent: true, opacity: 0.55 });
    const accent = new THREE.MeshStandardMaterial({ color: '#f26c14', emissive: '#f26c14', emissiveIntensity: 0.35, transparent: true, opacity: 0.0 });

    // ---------- Model ----------
    // y = 0: środek szczelin; szczelina A otwarta w stronę +z (przód), B w stronę −z
    const T = 0.025;
    const G = 0.022;
    const tool = new THREE.Group();
    const plate = new THREE.Group(); // skalowana wzdłuż x (długość)
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1, T, W), [steel, steel, steelTop, steel, steel, steel]);
    topPlate.position.y = G / 2 + T / 2;
    const botPlate = new THREE.Mesh(new THREE.BoxGeometry(1, T, W), steel);
    botPlate.position.y = -G / 2 - T / 2;
    const spacer = new THREE.Mesh(new THREE.BoxGeometry(1, G, 1), steelDark);
    // podświetlenie szczelin (miga przy zmianie głębokości)
    const glowA = new THREE.Mesh(new THREE.BoxGeometry(1, G * 0.9, 0.01), accent);
    const glowB = new THREE.Mesh(new THREE.BoxGeometry(1, G * 0.9, 0.01), accent);
    plate.add(topPlate, botPlate, spacer, glowA, glowB);
    tool.add(plate);

    // Rękojeść pałąkowa (BDZR)
    const handle = new THREE.Group();
    let handleMesh = null;
    const buildHandle = (span) => {
      if (handleMesh) {
        handle.remove(handleMesh);
        handleMesh.traverse((o) => o.geometry && o.geometry.dispose());
      }
      const R = 0.11; // promień rury
      const H = 0.62; // wysokość pałąka
      const rc = 0.22; // promień narożnika
      const hs = span / 2;
      const path = new THREE.CurvePath();
      const v = (x, y) => new THREE.Vector3(x, y, 0);
      path.add(new THREE.LineCurve3(v(-hs, 0), v(-hs, H - rc)));
      path.add(new THREE.QuadraticBezierCurve3(v(-hs, H - rc), v(-hs, H), v(-hs + rc, H)));
      path.add(new THREE.LineCurve3(v(-hs + rc, H), v(hs - rc, H)));
      path.add(new THREE.QuadraticBezierCurve3(v(hs - rc, H), v(hs, H), v(hs, H - rc)));
      path.add(new THREE.LineCurve3(v(hs, H - rc), v(hs, 0)));
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 90, R, 20, false), black));
      for (const x of [-hs, hs]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.35, 0.06, 24), black);
        foot.position.set(x, 0.03, 0);
        g.add(foot);
      }
      handleMesh = g;
      handle.add(g);
    };
    handle.position.y = G / 2 + T;
    tool.add(handle);

    // Wymiar długości przy przedniej krawędzi
    const dim = new THREE.Group();
    const dimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0)]), dimMat);
    const tickGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, 0.08, 0)]);
    const tickL = new THREE.Line(tickGeo, dimMat);
    const tickR = new THREE.Line(tickGeo, dimMat);
    dim.add(dimLine, tickL, tickR);
    dim.position.set(0, -0.3, W / 2 + 0.35);
    tool.add(dim);

    const pivot = new THREE.Group();
    pivot.add(tool);
    scene.add(pivot);

    const shC = document.createElement('canvas');
    shC.width = shC.height = 256;
    const sg = shC.getContext('2d');
    const gr = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, light ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 256, 256);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(shC), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.9;
    scene.add(shadow);

    // ---------- Blacha do pokazu ----------
    const SY = -0.55;
    const ZK = 0.25; // linia gięcia
    const SW = 9;
    const SD = 1.7;
    const sheet = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.012, SD), sheetMat);
    base.position.set(0, SY, ZK + SD / 2);
    const flangePivot = new THREE.Group();
    flangePivot.position.set(0, SY, ZK);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.012, 1), sheetMat);
    flangePivot.add(flange);
    const bendGeo = new THREE.CylinderGeometry(0.012, 0.012, SW, 8);
    bendGeo.rotateZ(Math.PI / 2);
    const bend = new THREE.Mesh(bendGeo, sheetMat);
    bend.position.set(0, SY, ZK);
    sheet.add(base, flangePivot, bend);
    sheet.visible = false;
    scene.add(sheet);

    // ---------- Stan ----------
    const state = {
      len: 4.6, lenGoal: 4.6, lenVel: 0,
      dA: 0.2, dB: 0.4, dGoalA: 0.2, dGoalB: 0.4,
      hand: 0, handGoal: 0, handVel: 0, span: 2.4,
      glow: 0,
      yaw: -0.55, pitch: 0.42, userYaw: 0, userPitch: 0, yawVel: 0,
      playing: false, t0: 0, sheetHold: 0, act: 0,
      hover: { x: 0, y: 0 }, visible: true,
      intro: reduceMotion ? 1 : 0, introT0: 0,
    };

    const setConfig = (c, instant) => {
      const d = info(c);
      const len = c.len / 10;
      const [a, b] = d.depth.split('/').map((x) => +x / 100);
      if (Math.abs(state.dGoalA - a) > 0.001) state.glow = 1;
      state.lenGoal = len;
      state.dGoalA = a;
      state.dGoalB = b;
      state.handGoal = d.handle ? 1 : 0;
      const span = (B.handle[c.len] || 24) / 10;
      if (!handleMesh || Math.abs(span - state.span) > 0.01) {
        state.span = span;
        buildHandle(span);
      }
      drawTop(len, d.depth);
      if (instant || reduceMotion) {
        state.len = len;
        state.dA = a;
        state.dB = b;
        state.hand = state.handGoal;
      }
    };

    const DUR = 4300;
    const play = () => {
      if (state.playing) return;
      flange.scale.z = state.dA;
      flange.position.z = -state.dA / 2;
      if (reduceMotion) {
        sheet.visible = true;
        flangePivot.rotation.x = Math.PI / 2;
        sheetMat.opacity = 1;
        state.sheetHold = performance.now() + 4000;
        showStep(`Rąbek ${Math.round(state.dA * 100)} mm zagięty do 90°`);
        return;
      }
      state.playing = true;
      state.t0 = performance.now();
      root.classList.add('is-playing');
      sheet.visible = true;
      sheetMat.opacity = 0;
      flangePivot.rotation.x = 0;
    };
    let stepText = '';
    const showStep = (text) => {
      if (!stepTag || text === stepText) return;
      stepText = text;
      stepTag.textContent = text;
      root.classList.toggle('has-step', !!text);
    };

    // ---------- Sterowanie ----------
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (state.playing) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = performance.now();
      state.yawVel = 0;
      canvas.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (e.pointerType === 'mouse') {
        state.hover.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        state.hover.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      }
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      state.userYaw += dx * 0.01;
      state.userPitch = Math.max(-0.35, Math.min(0.6, state.userPitch + dy * 0.006));
      state.yawVel = ((dx * 0.01) / Math.max(now - lastT, 1)) * 1000;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    });
    const end = () => {
      dragging = false;
      root.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => {
      state.hover.x = 0;
      state.hover.y = 0;
    });

    let CW = 1;
    let CH = 1;
    const resize = () => {
      CW = root.clientWidth;
      CH = root.clientHeight;
      if (!CW || !CH) return;
      renderer.setSize(CW, CH, false);
      camera.aspect = CW / CH;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(root);
    resize();

    // ---------- Etykiety ----------
    const tagW = new Map();
    const _v = new THREE.Vector3();
    const anchors = {
      edgeA: () => _v.set(state.len * 0.28, 0, W / 2),
      edgeB: () => _v.set(-state.len * 0.34, 0, -W / 2),
      handle: () => _v.set(state.span * 0.3, G / 2 + T + 0.62 * state.hand + 0.05, 0),
      dim: () => _v.set(0, -0.3, W / 2 + 0.35),
    };
    const placeTags = (alpha) => {
      tags.forEach((el) => {
        const k = el.dataset.tag;
        if (!anchors[k]) return;
        anchors[k]();
        tool.localToWorld(_v);
        _v.project(camera);
        const x = (_v.x * 0.5 + 0.5) * CW;
        const y = (-_v.y * 0.5 + 0.5) * CH;
        if (!tagW.has(el) || !tagW.get(el)) tagW.set(el, el.offsetWidth);
        const left = k === 'dim' ? x - tagW.get(el) / 2 : Math.min(Math.max(x + 10, 6), CW - tagW.get(el) - 8);
        el.style.transform = `translate(${left.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
        const a = k === 'handle' ? alpha * state.hand : alpha;
        el.style.opacity = a.toFixed(3);
      });
    };
    addEventListener('tt:bdz', () => tagW.clear());

    // ---------- Pętla ----------
    const qTmp = new THREE.Quaternion();
    const qBase = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const axisX = new THREE.Vector3(1, 0, 0);
    const pivotPt = new THREE.Vector3(0, SY, ZK);
    const spring = (val, vel, goal, k, dt) => {
      const c = 2 * Math.sqrt(k);
      vel += (-(val - goal) * k - vel * c) * dt;
      return [val + vel * dt, vel];
    };
    let last = performance.now();
    let raf = 0;
    const frame = (now) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      if (state.intro < 1 && state.visible) {
        if (!state.introT0) state.introT0 = now;
        state.intro = Math.min((now - state.introT0) / 1400, 1);
      }
      const intro = 1 - Math.pow(1 - state.intro, 3);

      [state.len, state.lenVel] = spring(state.len, state.lenVel, state.lenGoal, 120, dt);
      // rękojeść: lekko sprężysta (bounce), bo to „wyskakuje” na model
      const kh = 160;
      state.handVel += (-(state.hand - state.handGoal) * kh - state.handVel * 2 * Math.sqrt(kh) * 0.72) * dt;
      state.hand += state.handVel * dt;
      const k2 = 1 - Math.exp(-10 * dt);
      state.dA += (state.dGoalA - state.dA) * k2;
      state.dB += (state.dGoalB - state.dB) * k2;
      state.glow = Math.max(0, state.glow - dt * 0.9);

      plate.scale.x = state.len;
      dim.scale.x = state.len;
      tickL.position.x = -0.5;
      tickR.position.x = 0.5;
      tickL.scale.x = tickR.scale.x = 1 / Math.max(state.len, 0.01);
      // przekładka między płytami wyznacza głębokość obu szczelin
      const zf = W / 2 - state.dA;
      const zb = -W / 2 + state.dB;
      spacer.scale.z = Math.max(zf - zb, 0.01);
      spacer.position.z = (zf + zb) / 2;
      glowA.position.z = zf + 0.006;
      glowB.position.z = zb - 0.006;
      accent.opacity = 0.9 * Math.sin(Math.min(state.glow, 1) * Math.PI);
      const hv = Math.max(state.hand, 0);
      handle.visible = hv > 0.01;
      handle.scale.set(1, hv, 1);
      handle.position.z = 0;

      const actGoal = state.playing || sheet.visible ? 1 : 0;
      state.act = actGoal + (state.act - actGoal) * Math.exp(-3.2 * dt);
      const act = reduceMotion ? actGoal : state.act;
      const fit = (light ? 9.6 : 8.4) + (state.len - 4.6) * 1.05 + hv * 0.4;
      const aspectFix = Math.max(1, 1.3 / camera.aspect);
      camera.position.set(lerp(1.4, 6.4, act) * aspectFix, lerp(2.6, 2.8, act), lerp(fit, 6.4 + (state.len - 4.6) * 0.6, act) * aspectFix);
      camera.lookAt(lerp(0, -0.2, act), lerp(0.05, -0.1, act), lerp(-0.3, -0.4, act));

      if (!dragging) {
        state.userYaw += state.yawVel * dt;
        state.yawVel *= Math.exp(-3 * dt);
        if (!state.playing && Math.abs(state.yawVel) < 0.05) state.userYaw *= Math.exp(-0.25 * dt);
      }
      const idleSwing = reduceMotion ? 0 : Math.sin(t * 0.45) * 0.26;
      const idleBob = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.05;
      eul.set(state.pitch + state.userPitch + state.hover.y * 0.05, state.yaw + idleSwing + state.userYaw + state.hover.x * 0.12, 0, 'YXZ');
      qBase.setFromEuler(eul);
      const idlePos = new THREE.Vector3(0, idleBob + (1 - intro) * -0.6, 0);

      if (state.playing) {
        const p = clamp01((now - state.t0) / DUR);
        const posPre = new THREE.Vector3(0, SY, ZK - W / 2 - 1.0);
        const posIn = new THREE.Vector3(0, SY, ZK - W / 2);
        const a = smooth(0, 0.2, p);
        const b = smooth(0.2, 0.34, p);
        const bendK = smooth(0.38, 0.64, p);
        const off = smooth(0.76, 0.88, p);
        const back = smooth(0.88, 1, p);
        sheetMat.opacity = smooth(0.02, 0.16, p);
        const theta = (Math.PI / 2) * bendK;
        flangePivot.rotation.x = theta;
        const pos = new THREE.Vector3().lerpVectors(idlePos, posPre, a).lerp(posIn, b);
        const qq = new THREE.Quaternion().slerpQuaternions(qBase, new THREE.Quaternion(), a);
        qTmp.setFromAxisAngle(axisX, theta);
        pos.sub(pivotPt).applyQuaternion(qTmp).add(pivotPt);
        qq.premultiply(qTmp);
        pos.y += off * 1.1;
        pos.lerp(idlePos, back);
        qq.slerp(qBase, back);
        pivot.position.copy(pos);
        pivot.quaternion.copy(qq);
        const mm = Math.round(state.dA * 100);
        if (p < 0.2) showStep('1. Podejdź zaginadłem do krawędzi blachy');
        else if (p < 0.38) showStep(`2. Wsuń krawędź w szczelinę ${mm} mm`);
        else if (p < 0.72) showStep('3. Unieś zaginadło do 90°');
        else showStep(`Rąbek ${mm} mm gotowy`);
        if (p >= 1) {
          state.playing = false;
          state.sheetHold = now + 2600;
          root.classList.remove('is-playing');
        }
      } else {
        pivot.position.copy(idlePos);
        pivot.quaternion.copy(qBase);
        if (sheet.visible && state.sheetHold && now > state.sheetHold) {
          sheetMat.opacity = Math.max(sheetMat.opacity - dt * 1.5, 0);
          if (sheetMat.opacity <= 0) {
            sheet.visible = false;
            flangePivot.rotation.x = 0;
            state.sheetHold = 0;
            showStep('');
          }
        }
      }
      tool.scale.setScalar(0.92 + 0.08 * intro);
      const sh = state.len + 1.6;
      shadow.scale.set(sh, sh * 0.42, 1);
      shadow.position.x = pivot.position.x;
      shadow.material.opacity = (sheet.visible ? 0.5 : 1) * intro;

      camera.updateMatrixWorld();
      pivot.updateMatrixWorld();
      placeTags(state.playing || sheet.visible ? 0 : smooth(0.6, 1, intro));
      renderer.render(scene, camera);
      if (state.visible) raf = requestAnimationFrame(frame);
    };
    new IntersectionObserver(([en]) => {
      state.visible = en.isIntersecting;
      if (state.visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }).observe(root);
    root.classList.add('is-ready');
    root._seek = (p) => {
      if (!state.playing) play();
      state.t0 = performance.now() - p * DUR;
      state.act = 1;
      frame(performance.now());
    };
    return { setConfig, play };
  }
})();
