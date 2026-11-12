/*
  Spacer 3D z konfiguratorem i wyburzaniem ścian — ul. Jana Kazimierza 28 (Żybura Nieruchomości).
  Klasyczny skrypt + dynamiczny import three.js (import map w <head>), działa też z file://.
  Układ według rzutu z oferty (100 px = 1 m, wysokość 2,60 m). Materiały, fronty kuchni, drzwi i meble według zdjęć
  mieszkania; wariant „po odświeżeniu” jako pełny projekt z przejściem i porównaniem „przed / po”.
  API: window.TOUR.set({styl, sciany, podloga, kuchnia}), .wall(id, on), .mode(m), .go(room), .snapshot()
*/
(() => {
  'use strict';
  const root = document.querySelector('[data-tour]');
  if (!root) return;
  const PH = window.ZB;
  const $ = (s) => root.querySelector(s);
  const stage = $('.tour__stage');
  const host = $('.tour__canvas');
  const labelsHost = $('.tour__labels');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const cfg = { styl: 'obecny', sciany: 'bez', podloga: 'panele', kuchnia: 'braz', walls: {}, time: 'day' };
  let impl = null;
  const api = {
    cfg,
    set(p) { Object.assign(cfg, p); if (impl) impl.apply(p); },
    wall(id, on) { cfg.walls[id] = on; if (impl) impl.wall(id, on); else emit({ walls: { ...cfg.walls } }); },
    mode(m) { if (impl) impl.setMode(m); else pendingMode = m; },
    go(id) { if (impl) impl.go(id); else pendingRoom = id; },
    snapshot() { return impl ? impl.snapshot() : null; },
    compare(on, u) { if (impl) impl.compare(on, u); },
    get busy() { return !impl || impl.busy(); },
    get ready() { return !!impl; },
  };
  let pendingMode = null;
  let pendingRoom = null;
  window.TOUR = api;
  const emit = (detail) => root.dispatchEvent(new CustomEvent('tour:change', { detail }));

  // Pomieszczenia: przyciski pod widokiem
  const roomsBar = $('.tour__rooms');
  if (roomsBar) {
    roomsBar.innerHTML = PH.rooms.filter((r) => r.id !== 'loggia2').map((r) => `<button type="button" data-room="${r.id}">${r.short}</button>`).join('');
    roomsBar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]');
      if (b) api.go(b.dataset.room);
    });
  }

  // Minimapa (SVG rzutu)
  const mini = $('.tour__mini');
  if (mini) {
    const rects = PH.rooms.map((r) => r.rects.map((q) => `<rect data-room="${r.id}" class="${r.outdoor ? 'is-out' : ''}" x="${q[0]}" y="${q[1]}" width="${q[2] - q[0]}" height="${q[3] - q[1]}"/>`).join('')).join('');
    mini.setAttribute('viewBox', '-40 -40 1560 680');
    mini.innerHTML = `<g class="mini__rooms">${rects}</g><g class="mini__me"><path d="M0 0 L-90 -160 A180 180 0 0 1 90 -160 Z" class="mini__cone"/><circle r="24" class="mini__dot"/></g>`;
    mini.addEventListener('click', (e) => {
      const r = e.target.closest('[data-room]');
      if (r) api.go(r.dataset.room);
    });
  }

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => api.mode(b.dataset.mode)));

  // Pełny ekran
  const fsBtn = $('.js-tour-fs');
  const setFs = (on) => {
    root.classList.toggle('is-fs', on);
    document.documentElement.classList.toggle('tour-fs-open', on);
    if (fsBtn) fsBtn.setAttribute('aria-pressed', String(on));
    if (impl) impl.resize();
  };
  fsBtn && fsBtn.addEventListener('click', () => setFs(!root.classList.contains('is-fs')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('is-fs')) setFs(false); });
  api.fullscreen = setFs;

  // three.js ładuje się od razu (spacer jest w hero)
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const HQ = !coarse;
    const mods = [
      import('three'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
    ];
    if (HQ) {
      mods.push(
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/GTAOPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      );
    }
    Promise.all(mods).then(([THREE, envMod, rbMod, raMod, ecMod, rpMod, gtMod, opMod]) => {
      try {
        impl = build(THREE, {
          RoomEnvironment: envMod.RoomEnvironment,
          RoundedBoxGeometry: rbMod.RoundedBoxGeometry,
          RectAreaLightUniformsLib: raMod.RectAreaLightUniformsLib,
          EffectComposer: ecMod && ecMod.EffectComposer,
          RenderPass: rpMod && rpMod.RenderPass,
          GTAOPass: gtMod && gtMod.GTAOPass,
          OutputPass: opMod && opMod.OutputPass,
        });
        if (pendingMode) impl.setMode(pendingMode);
        if (pendingRoom) impl.go(pendingRoom);
      } catch (err) {
        console.warn('Spacer 3D:', err);
        root.classList.add('is-fallback');
      }
    }).catch((err) => {
      console.warn('Spacer 3D: brak three.js', err);
      root.classList.add('is-fallback');
    });
  };
  start();

  // =====================================================================
  function build(THREE, MOD) {
    const { RoomEnvironment, RoundedBoxGeometry, RectAreaLightUniformsLib } = MOD;
    const HQ = !!MOD.EffectComposer;
    const S = 1 / 100;
    const CX = 700;
    const CY = 290;
    const H = 2.6;
    const EYE = 1.6;
    const X = (px) => (px - CX) * S;
    const Z = (py) => (py - CY) * S;
    const PX = (x) => x / S + CX;
    const PY = (z) => z / S + CY;
    let dirty = true;
    let idle = 0;


    // ---------- renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: !HQ, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, HQ ? 1.5 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // cienie liczone tylko po zmianie światła/wnętrza
    const shadowsDirty = () => { renderer.shadowMap.needsUpdate = true; };
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Model 3D mieszkania');
    RectAreaLightUniformsLib.init();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const studioEnv = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = studioEnv;

    // =================================================================
    // TEKSTURY (proceduralne, kolory próbkowane ze zdjęć oferty)
    // =================================================================
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const TS = HQ ? 1024 : 512; // bazowa rozdzielczość tekstur
    const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const tex = (c, color = true) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = aniso;
      return t;
    };
    const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
    // kafelkowalny szum wartości (fbm), 0..1
    const noise = (w, h, cells, oct = 4, gain = 0.5) => {
      const out = new Float32Array(w * h);
      let amp = 1;
      let tot = 0;
      for (let o = 0; o < oct; o++) {
        const P = cells << o;
        const Q = Math.max(1, Math.round((P * h) / w));
        const lat = new Float32Array(P * Q);
        for (let i = 0; i < lat.length; i++) lat[i] = rnd();
        for (let y = 0; y < h; y++) {
          const fy = (y / h) * Q;
          const y0 = Math.floor(fy);
          let ty = fy - y0;
          ty = ty * ty * (3 - 2 * ty);
          const r0 = (y0 % Q) * P;
          const r1 = ((y0 + 1) % Q) * P;
          for (let x = 0; x < w; x++) {
            const fx = (x / w) * P;
            const x0 = Math.floor(fx);
            let tx = fx - x0;
            tx = tx * tx * (3 - 2 * tx);
            const c0 = x0 % P;
            const c1 = (x0 + 1) % P;
            const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * tx;
            const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * tx;
            out[y * w + x] += amp * (a + (b - a) * ty);
          }
        }
        tot += amp;
        amp *= gain;
      }
      for (let i = 0; i < out.length; i++) out[i] /= tot;
      return out;
    };
    // obraz z szumu: mieszanie dwóch kolorów (+ kontrast)
    const paintNoise = (c, n, c1, c2, contrast = 1) => {
      const g = c.getContext('2d');
      const im = g.createImageData(c.width, c.height);
      for (let i = 0; i < n.length; i++) {
        const t = Math.min(1, Math.max(0, (n[i] - 0.5) * contrast + 0.5));
        im.data[i * 4] = c1[0] + (c2[0] - c1[0]) * t;
        im.data[i * 4 + 1] = c1[1] + (c2[1] - c1[1]) * t;
        im.data[i * 4 + 2] = c1[2] + (c2[2] - c1[2]) * t;
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return g;
    };
    const grain = (g, x, y, w, h, hue, sat, l, n, vertical = true, alpha = 1) => {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      for (let k = 0; k < n; k++) {
        g.globalAlpha = (0.05 + rnd() * 0.14) * alpha;
        g.strokeStyle = rnd() < 0.6 ? hsl(hue, sat, l - 8 - rnd() * 10) : hsl(hue, sat, l + 5 + rnd() * 7);
        g.lineWidth = 0.5 + rnd() * 1.4;
        const o = rnd();
        const amp = (vertical ? w : h) * (0.01 + rnd() * 0.04);
        const ph = rnd() * 6;
        const fr = 2 + rnd() * 5;
        g.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.04) {
          if (vertical) {
            const xx = x + o * w + Math.sin(t * fr + ph) * amp;
            t === 0 ? g.moveTo(xx, y + t * h) : g.lineTo(xx, y + t * h);
          } else {
            const yy = y + o * h + Math.sin(t * fr + ph) * amp;
            t === 0 ? g.moveTo(x + t * w, yy) : g.lineTo(x + t * w, yy);
          }
        }
        g.stroke();
      }
      // „katedry” (łuki słojów)
      const arcs = 1 + Math.floor(rnd() * 2);
      for (let a = 0; a < arcs; a++) {
        const cx = vertical ? x + w * (0.3 + rnd() * 0.4) : x + w * rnd();
        const cy = vertical ? y + h * rnd() : y + h * (0.3 + rnd() * 0.4);
        for (let r = 0; r < 7; r++) {
          g.globalAlpha = (0.05 + rnd() * 0.08) * alpha;
          g.strokeStyle = hsl(hue, sat, l - 12);
          g.lineWidth = 1;
          g.beginPath();
          if (vertical) g.ellipse(cx, cy, w * (0.05 + r * 0.045), h * (0.08 + r * 0.05), 0, Math.PI * 0.05, Math.PI * 0.95);
          else g.ellipse(cx, cy, w * (0.08 + r * 0.05), h * (0.05 + r * 0.045), Math.PI / 2, Math.PI * 0.05, Math.PI * 0.95);
          g.stroke();
        }
      }
      g.restore();
      g.globalAlpha = 1;
    };

    // podłoga: 3 kanwy (kolor, wysokość, szorstkość) dla desek 20 × 120 cm; 1 tekstura = 2,4 × 2,4 m
    const planks = (palette, opts = {}) => {
      const N = HQ ? 2048 : 1024;
      const c = cnv(N, N);
      const hC = cnv(N, N);
      const rC = cnv(N, N);
      const g = c.getContext('2d');
      const gh = hC.getContext('2d');
      const gr = rC.getContext('2d');
      gh.fillStyle = '#fff';
      gh.fillRect(0, 0, N, N);
      const cols = 12;
      const pw = N / cols;
      const ph = N / 2;
      const j = Math.max(2, N / 700);
      for (let col = 0; col < cols; col++) {
        const off = rnd() * ph;
        for (let r = -1; r < 2; r++) {
          const y = r * ph + off;
          const base = palette[Math.floor(rnd() * palette.length)];
          const l = base[2] + (rnd() - 0.5) * (opts.vary || 8);
          const hh = base[0] + (rnd() - 0.5) * 4;
          const s = base[1];
          const gd = g.createLinearGradient(0, y, 0, y + ph);
          gd.addColorStop(0, hsl(hh, s, l + (rnd() - 0.5) * 4));
          gd.addColorStop(0.5, hsl(hh, s, l));
          gd.addColorStop(1, hsl(hh, s, l + (rnd() - 0.5) * 4));
          g.fillStyle = gd;
          g.fillRect(col * pw, y, pw, ph);
          grain(g, col * pw, y, pw, ph, hh, s, l, opts.lines || 34, true, opts.grain || 1);
          if (rnd() < (opts.knots ?? 0.25)) {
            const kx = col * pw + pw * (0.2 + rnd() * 0.6);
            const ky = y + ph * rnd();
            for (let q = 0; q < 4; q++) {
              g.globalAlpha = 0.25 - q * 0.05;
              g.strokeStyle = hsl(hh, s, l - 22);
              g.lineWidth = 1.2;
              g.beginPath();
              g.ellipse(kx, ky, 3 + q * 4, 6 + q * 9, 0, 0, Math.PI * 2);
              g.stroke();
            }
            g.globalAlpha = 1;
          }
          { const v = Math.round((opts.rough || 150) + (rnd() - 0.5) * 30); gr.fillStyle = `rgb(${v},${v},${v})`; }
          gr.fillRect(col * pw, y, pw, ph);
          // fugi
          g.fillStyle = opts.joint || 'rgba(35,30,26,.55)';
          g.fillRect(col * pw, y, j, ph);
          g.fillRect(col * pw, y, pw, j);
          g.fillStyle = 'rgba(255,255,255,.07)';
          g.fillRect(col * pw + j, y + j, 1, ph);
          gh.fillStyle = '#000';
          gh.fillRect(col * pw, y, j * 1.6, ph);
          gh.fillRect(col * pw, y, pw, j * 1.6);
          gr.fillStyle = 'rgb(235,235,235)';
          gr.fillRect(col * pw, y, j * 1.6, ph);
          gr.fillRect(col * pw, y, pw, j * 1.6);
        }
      }
      const rough = tex(rC, false);
      return { map: tex(c), bump: tex(hC, false), rough };
    };
    // gres drewnopodobny jak na zdjęciach: szaro-brązowy, różne odcienie desek
    const T = {};
    T.jodelka = (() => {
      const N = HQ ? 2048 : 1024;
      const c = cnv(N, N);
      const g = c.getContext('2d');
      const hC = cnv(N, N);
      const gh = hC.getContext('2d');
      gh.fillStyle = '#fff';
      gh.fillRect(0, 0, N, N);
      const cols = 8;
      const cw = N / cols;
      const ph = cw * 0.42;
      for (let col = 0; col < cols; col++) {
        const dir = col % 2 ? 1 : -1;
        for (let y = -cw * 2; y < N + cw * 2; y += ph) {
          const l = 56 + (rnd() - 0.5) * 12;
          const hh = 31 + (rnd() - 0.5) * 5;
          const x0 = col * cw;
          const y0 = y + (dir > 0 ? 0 : cw * 0.5);
          const path = () => {
            const p = new Path2D();
            p.moveTo(x0, y0);
            p.lineTo(x0 + cw, y0 + dir * cw * 0.5);
            p.lineTo(x0 + cw, y0 + dir * cw * 0.5 + ph);
            p.lineTo(x0, y0 + ph);
            p.closePath();
            return p;
          };
          const p = path();
          g.fillStyle = hsl(hh, 38, l);
          g.fill(p);
          g.save();
          g.clip(p);
          g.translate(x0, y0);
          g.rotate(Math.atan2(dir * cw * 0.5, cw));
          grain(g, 0, -ph, cw * 1.2, ph * 3, hh, 38, l, 14, false);
          g.restore();
          g.strokeStyle = 'rgba(70,45,22,.5)';
          g.lineWidth = 2;
          g.stroke(p);
          gh.strokeStyle = '#000';
          gh.lineWidth = 3;
          gh.stroke(p);
        }
      }
      const rC = cnv(8, 8);
      const rg = rC.getContext('2d');
      rg.fillStyle = 'rgb(150,150,150)';
      rg.fillRect(0, 0, 8, 8);
      return { map: tex(c), bump: tex(hC, false), rough: tex(rC, false) };
    })();
    T.paintBump = (() => { const c = cnv(512, 512); paintNoise(c, noise(512, 512, 96, 2), [150, 150, 150], [255, 255, 255]); return tex(c, false); })();
    const wood = (hue, sat, l, n = 8, contrast = 1) => {
      const c = cnv(TS, TS);
      const g = c.getContext('2d');
      g.fillStyle = hsl(hue, sat, l);
      g.fillRect(0, 0, TS, TS);
      for (let i = 0; i < n; i++) {
        const ll = l + (rnd() - 0.5) * 6 * contrast;
        g.fillStyle = hsl(hue, sat, ll);
        g.fillRect((i * TS) / n, 0, TS / n + 1, TS);
        grain(g, (i * TS) / n, 0, TS / n, TS, hue, sat, ll, 30, true, contrast);
      }
      return tex(c);
    };
    const mottled = (c1, c2, cells = 4, contrast = 1.6, size = TS) => { const c = cnv(size, size); paintNoise(c, noise(size, size, cells, 5, 0.55), c1, c2, contrast); return tex(c); };
    T.leatherBump = (() => { const c = cnv(256, 256); paintNoise(c, noise(256, 256, 20, 3), [80, 80, 80], [255, 255, 255], 1.4); return tex(c, false); })();
    T.fabricBump = (() => { const c = cnv(128, 128); const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 2) { g.fillStyle = y % 4 ? '#aaa' : '#666'; g.fillRect(0, y, 128, 1); } for (let x = 0; x < 128; x += 2) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, 0, 1, 128); } return tex(c, false); })();
    const tiles = (c1, c2, tw, th, size, grout, cells = 4) => {
      const c = cnv(size, size);
      const g = paintNoise(c, noise(size, size, cells, 5, 0.6), c1, c2, 1.5);
      const hC = cnv(size, size);
      const gh = hC.getContext('2d');
      gh.fillStyle = '#fff';
      gh.fillRect(0, 0, size, size);
      for (let x = 0; x <= size; x += tw) {
        g.fillStyle = grout;
        g.fillRect(x - 1, 0, 2, size);
        gh.fillStyle = '#000';
        gh.fillRect(x - 2, 0, 4, size);
      }
      for (let y = 0; y <= size; y += th) {
        g.fillStyle = grout;
        g.fillRect(0, y - 1, size, 2);
        gh.fillStyle = '#000';
        gh.fillRect(0, y - 2, size, 4);
      }
      return { map: tex(c), bump: tex(hC, false) };
    };
    T.shadow = (() => {
      const c = cnv(256, 256);
      const g = c.getContext('2d');
      const gd = g.createRadialGradient(128, 128, 30, 128, 128, 128);
      gd.addColorStop(0, 'rgba(0,0,0,.42)');
      gd.addColorStop(0.55, 'rgba(0,0,0,.2)');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gd;
      g.fillRect(0, 0, 256, 256);
      const t = tex(c);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    })();
    // ---------- tekstury z plików (generowane ze zdjęć mieszkania i skalibrowane do ich kolorów) ----------
    const texLoader = new THREE.TextureLoader();
    let texPending = 0;
    const LT = (name, o = {}) => {
      const src = (window.ZB_TEX && window.ZB_TEX[name]) || `assets/img/tex/${name}.webp`;
      texPending++;
      const done = () => { texPending--; dirty = true; envDirty = true; shadowsDirty(); };
      const t = texLoader.load(src, done, undefined, done);
      t.colorSpace = o.color === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.anisotropy = aniso;
      if (o.rep) t.repeat.set(o.rep[0], o.rep[1]);
      if (o.rot) t.rotation = o.rot;
      return t;
    };
    const LN = (name, o = {}) => LT(name, { ...o, color: false });
    const TX = {
      // podłogi: UV w metrach, powtórzenie = 1 / rozmiar tekstury
      lam: LT('lam', { rep: [1 / 2.76, 1 / 2.76] }), laml: LT('laml', { rep: [1 / 2.76, 1 / 2.76] }), lamN: LN('lam_n', { rep: [1 / 2.76, 1 / 2.76] }), lamR: LN('lam_r', { rep: [1 / 2.76, 1 / 2.76] }),
      terra: LT('terra', { rep: [1 / 1.2, 1 / 1.2] }), terraN: LN('terra_n', { rep: [1 / 1.2, 1 / 1.2] }), terraR: LN('terra_r', { rep: [1 / 1.2, 1 / 1.2] }),
      jod: LT('jod', { rot: Math.PI / 4, rep: [1 / 1.2, 1 / 1.2] }), jodN: LN('jod_n', { rot: Math.PI / 4, rep: [1 / 1.2, 1 / 1.2] }), jodR: LN('jod_r', { rot: Math.PI / 4, rep: [1 / 1.2, 1 / 1.2] }),
      stone: LT('stone', { rep: [1 / 1.2, 1 / 1.2] }), stoneN: LN('stone_n', { rep: [1 / 1.2, 1 / 1.2] }),
      stoneW: LT('stone'), stoneWN: LN('stone_n'),
      // płytki ścienne: ściany mają UV co 0,6 m
      btile: LT('btile', { rep: [0.6, 0.5] }), btileN: LN('btile_n', { rep: [0.6, 0.5] }),
      btile2: LT('btile2', { rep: [0.6, 0.5] }), btile2N: LN('btile2_n', { rep: [0.6, 0.5] }),
      zel: LT('zel'), zelN: LN('zel_n'),
      wenge: LT('wenge'), walnut: LT('walnut'), pine: LT('pine'), oakl: LT('oakl'),
      paintN: LN('paint_n', { rep: [0.3, 0.3] }), fluteN: LN('flute_n'),
      sofa: LT('sofa'), sofaN: LN('sofa_n'), linen: LT('linen'), linenN: LN('linen_n'),
      boucle: LT('boucle'), boucleN: LN('boucle_n'), knit: LT('knit'), knitN: LN('knit_n'),
      plush: LT('plush'), plushN: LN('plush_n'), leaf: LT('leaf'), rug: LT('rug'), rugN: LN('rug_n'),
      trav: LT('trav'), conc: LT('conc'), lime: LT('lime'),
      kDoor: LT('k_door', { clamp: true }), kOven: LT('k_oven', { clamp: true }), kGlass: LT('k_glass', { clamp: true }), kBack: LT('k_back', { clamp: true }),
      doorEnt: LT('door_ent', { clamp: true }), doorInt: LT('door_int', { clamp: true }),
      artPier: LT('art_pier', { clamp: true }), artRed: LT('art_red', { clamp: true }), art1: LT('art1', { clamp: true }), art2: LT('art2', { clamp: true }),
    };

    // =================================================================
    // MATERIAŁY
    // =================================================================
    const mats = [];
    const M = (p, env = 1, Cls = THREE.MeshStandardMaterial) => {
      const m = new Cls(p);
      m.userData.env = env;
      mats.push(m);
      return m;
    };
    const v2 = (a, b = a) => new THREE.Vector2(a, b);
    // farba: kolor stanu obecnego, a w shaderze kolor „po” po drugiej stronie płaszczyzny przejścia
    const cut = { plane: new THREE.Vector4(0, 0, 0, 1) };
    const paintMat = (hex) => {
      const m = M({ color: hex, roughness: 0.94, normalMap: TX.paintN, normalScale: v2(0.1) }, 0.75);
      m.userData.colB = new THREE.Color(0xefe9e0);
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uCut = { value: cut.plane };
        sh.uniforms.uColB = { value: m.userData.colB };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec4 uCut;\nuniform vec3 uColB;')
          .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( (dot(uCut.xyz, vWPos) + uCut.w < 0.0) ? uColB : diffuse, opacity );');
      };
      return m;
    };
    const ROOM_PAINT = { salon: 0xd9c8ad, sypialnia: 0xdcc5a8, kuchnia: 0xe4ddd2, przedpokoj: 0xd5c8b3 };
    const mat = {
      paintL: paintMat(ROOM_PAINT.salon),
      paintB: paintMat(ROOM_PAINT.sypialnia),
      paintK: paintMat(ROOM_PAINT.kuchnia),
      paintH: paintMat(ROOM_PAINT.przedpokoj),
      render: M({ map: TX.conc, color: 0xf4efe8, roughness: 0.95 }, 0.6),
      cut: M({ color: 0x2b2a28, roughness: 1 }, 0.3),
      ceiling: M({ color: 0xf6f4f0, roughness: 0.96 }, 0.8),
      // podłogi
      floorO: M({ map: TX.lam, normalMap: TX.lamN, normalScale: v2(0.55), roughnessMap: TX.lamR, roughness: 1 }, 1.15),
      tileO: M({ map: TX.terra, normalMap: TX.terraN, normalScale: v2(0.7), roughnessMap: TX.terraR, roughness: 1 }, 1.05),
      floorR: M({ map: TX.jod, normalMap: TX.jodN, normalScale: v2(0.5), roughnessMap: TX.jodR, roughness: 1 }, 0.9),
      tileR: M({ map: TX.stone, normalMap: TX.stoneN, normalScale: v2(0.6), roughness: 0.42 }, 1),
      terrace: M({ map: TX.conc, roughness: 0.9 }, 0.6),
      slab: M({ color: 0xd7d4ce, roughness: 0.95 }, 0.5),
      // ściany łazienki
      wallTile: M({ map: TX.btile, normalMap: TX.btileN, normalScale: v2(0.6), roughness: 0.24 }, 1.15),
      wallTile2: M({ map: TX.btile2, normalMap: TX.btile2N, normalScale: v2(0.6), roughness: 0.28 }, 1.1),
      stoneWall: M({ map: TX.stoneW, normalMap: TX.stoneWN, normalScale: v2(0.5), roughness: 0.3 }, 1.1),
      // szkło
      glass: M({ color: 0xdfe9ec, roughness: 0.03, transparent: true, opacity: 0.08, depthWrite: false }, 1.6),
      frosted: M({ color: 0xf3f1ec, roughness: 0.35, transparent: true, opacity: 0.85 }, 0.9),
      showerGlass: M({ color: 0x4a4e52, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.5, depthWrite: false }, 1.6),
      clearGlass: M({ color: 0xe8f0f0, roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false }, 1.8),
      // drewno
      frame: M({ map: TX.pine, color: 0xd9b48a, roughness: 0.5 }, 0.8), // okna: złoty dąb jak na zdjęciach
      pine: M({ map: TX.pine, roughness: 0.55 }, 0.8),
      wenge: M({ map: TX.wenge, roughness: 0.42 }, 0.9),
      wengeMatt: M({ map: TX.wenge, roughness: 0.65 }, 0.7),
      walnut: M({ map: TX.walnut, roughness: 0.45 }, 0.9),
      oakl: M({ map: TX.oakl, roughness: 0.55 }, 0.85),
      oakFlute: M({ map: TX.oakl, normalMap: TX.fluteN, normalScale: v2(1.4), roughness: 0.55 }, 0.85),
      skirtO: M({ map: TX.walnut, color: 0x9a7a66, roughness: 0.5 }, 0.8),
      // zdjęcia (fronty kuchni, drzwi, obrazy)
      kDoor: M({ map: TX.kDoor, roughness: 0.42 }, 0.9),
      kOven: M({ map: TX.kOven, roughness: 0.25, metalness: 0.15 }, 1.3),
      kGlass: M({ map: TX.kGlass, roughness: 0.12 }, 1.3),
      kBack: M({ map: TX.kBack, roughness: 0.2 }, 1.1),
      doorEnt: M({ map: TX.doorEnt, roughness: 0.4 }, 0.9),
      doorInt: M({ map: TX.doorInt, roughness: 0.4 }, 0.9),
      artPier: M({ map: TX.artPier, roughness: 0.75 }, 0.6),
      artRed: M({ map: TX.artRed, roughness: 0.8 }, 0.6),
      art1: M({ map: TX.art1, roughness: 0.85 }, 0.6),
      art2: M({ map: TX.art2, roughness: 0.85 }, 0.6),
      // kuchnia po odświeżeniu (kolor frontów z konfiguratora)
      front: M({ color: 0x97a38e, roughness: 0.55 }, 0.8),
      zel: M({ map: TX.zel, normalMap: TX.zelN, normalScale: v2(0.8), roughness: 0.12 }, 1.3),
      lime: M({ map: TX.lime, roughness: 0.96, normalMap: TX.paintN, normalScale: v2(0.25) }, 0.6),
      // metale, ceramika
      black: M({ color: 0x1b1b1c, roughness: 0.5, metalness: 0.2 }, 0.8),
      blackMatt: M({ color: 0x1e1e1f, roughness: 0.72 }, 0.6),
      blackGloss: M({ color: 0x08090a, roughness: 0.06, metalness: 0.1 }, 1.6),
      inox: M({ color: 0xc8cbcf, roughness: 0.3, metalness: 1 }, 1.4),
      alu: M({ color: 0xb9bcc0, roughness: 0.35, metalness: 1 }, 1.2),
      chrome: M({ color: 0xe2e4e6, roughness: 0.08, metalness: 1 }, 1.5),
      white: M({ color: 0xf1f0ec, roughness: 0.42 }, 0.9),
      whiteMatt: M({ color: 0xeeebe5, roughness: 0.75 }, 0.8),
      ceramic: M({ color: 0xf7f7f5, roughness: 0.1 }, 1.3),
      counter: M({ color: 0xcfc2ab, roughness: 0.45 }, 0.9),
      trav: M({ map: TX.trav, roughness: 0.5 }, 0.9),
      // tkaniny
      sofa: M({ map: TX.sofa, normalMap: TX.sofaN, normalScale: v2(0.8), roughness: 0.95 }, 0.5),
      leather: M({ color: 0x2c1f19, roughness: 0.55 }, 0.8),
      leaf: M({ map: TX.leaf, normalMap: TX.sofaN, normalScale: v2(0.5), roughness: 0.95 }, 0.5),
      pillowBrown: M({ color: 0x6a4a35, normalMap: TX.sofaN, roughness: 0.95 }, 0.5),
      plush: M({ map: TX.plush, normalMap: TX.plushN, normalScale: v2(0.8), roughness: 0.92 }, 0.5),
      teal: M({ color: 0x1f5e66, normalMap: TX.plushN, normalScale: v2(0.4), roughness: 0.75 }, 0.6),
      beigePlush: M({ color: 0xcdbca6, normalMap: TX.plushN, normalScale: v2(0.5), roughness: 0.95 }, 0.5),
      fur: M({ color: 0xd9c7ae, normalMap: TX.boucleN, normalScale: v2(1.2), roughness: 1 }, 0.4),
      linen: M({ map: TX.linen, normalMap: TX.linenN, normalScale: v2(0.6), roughness: 1, side: THREE.DoubleSide }, 0.5),
      sheer: M({ color: 0xf6f3ee, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }, 0.4),
      boucle: M({ map: TX.boucle, normalMap: TX.boucleN, normalScale: v2(1), roughness: 1 }, 0.4),
      knit: M({ map: TX.knit, normalMap: TX.knitN, normalScale: v2(1.2), roughness: 1 }, 0.4),
      rust: M({ color: 0xa4593a, normalMap: TX.linenN, roughness: 0.95 }, 0.5),
      greige: M({ color: 0xbfb3a1, normalMap: TX.linenN, roughness: 0.95 }, 0.5),
      rug: M({ map: TX.rug, normalMap: TX.rugN, normalScale: v2(0.8), roughness: 1 }, 0.4),
      blind: M({ color: 0xe6dcc8, normalMap: TX.linenN, roughness: 1, side: THREE.DoubleSide }, 0.5),
      blindPat: M({ color: 0xcfb592, roughness: 1 }, 0.5),
      // rośliny i dekoracje
      pampas: M({ color: 0xc9b9a6, roughness: 1 }, 0.5),
      pampasDark: M({ color: 0x7c6a74, roughness: 1 }, 0.5),
      plant: M({ color: 0x3f6a3a, roughness: 0.7, side: THREE.DoubleSide }, 0.6),
      plantLight: M({ color: 0x6f9a52, roughness: 0.7, side: THREE.DoubleSide }, 0.6),
      olive: M({ color: 0x7d8a63, roughness: 0.8, side: THREE.DoubleSide }, 0.6),
      stem: M({ color: 0x4f6b35, roughness: 0.8 }, 0.5),
      bark: M({ color: 0x6e5a44, roughness: 0.95 }, 0.5),
      orchid: M({ color: 0xfbf8f4, roughness: 0.6, side: THREE.DoubleSide }, 0.6),
      tulip: M({ color: 0xf2efe0, roughness: 0.6, side: THREE.DoubleSide }, 0.6),
      pot: M({ color: 0xf1eee9, roughness: 0.35 }, 0.9),
      vase: M({ color: 0x8f8b80, roughness: 0.55, normalMap: TX.boucleN, normalScale: v2(0.6) }, 0.8),
      vaseWhite: M({ color: 0xe6e0d6, roughness: 0.6 }, 0.8),
      terracottaPot: M({ color: 0xb97a56, roughness: 0.85 }, 0.6),
      basket: M({ color: 0xb79a72, normalMap: TX.knitN, normalScale: v2(1.2), roughness: 1 }, 0.5),
      soil: M({ color: 0x3a2c22, roughness: 1 }, 0.3),
      book1: M({ color: 0x8c7b64, roughness: 0.8 }, 0.5),
      book2: M({ color: 0x3e4b45, roughness: 0.8 }, 0.5),
      // światło
      bulb: M({ color: 0xfff1d8, emissive: 0xffc678, emissiveIntensity: 0.15, roughness: 0.3 }, 0.4),
      led: M({ color: 0xffffff, emissive: 0xffe2b8, emissiveIntensity: 0.5 }, 0),
      fire: M({ color: 0x2a1408, emissive: 0xff7a2e, emissiveIntensity: 0 }, 0),
      shade: M({ color: 0xf2ebdf, emissive: 0xffd9a8, emissiveIntensity: 0.12, roughness: 1, side: THREE.DoubleSide }, 0.4),
      tv: M({ color: 0x050607, roughness: 0.05, metalness: 0.3 }, 1.6),
      mirror: M({ color: 0xcfd3d6, roughness: 0.02, metalness: 1 }, 1.7),
      art: M({ color: 0xe8e1d4, roughness: 0.8 }, 0.7),
      passe: M({ color: 0xf4f1ea, roughness: 0.9 }, 0.6),
      shadowDecal: new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false }),
    };
    mat.paint = mat.paintL; // zgodność z resztą silnika
    mat.floor = mat.floorO;
    mat.tileFloor = mat.tileO;
    const paints = [mat.paintL, mat.paintB, mat.paintK, mat.paintH];

    // =================================================================
    // GEOMETRIA — narzędzia (współrzędne rzutu w px, wysokości w m)
    // =================================================================
    const worldUV = (g, tile = 1, rot = false) => {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const ax = Math.abs(n.getX(i));
        const ay = Math.abs(n.getY(i));
        let u;
        let v;
        if (ay > 0.5) { u = x; v = -z; if (rot) { const t = u; u = v; v = -t; } }
        else if (ax > 0.5) { u = z; v = y; }
        else { u = x; v = y; }
        uv.setXY(i, u / tile, v / tile);
      }
      uv.needsUpdate = true;
      return g;
    };
    const shadowOpts = (m, o) => { m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; if (o.noAO) m.userData.noAO = true; };
    // prostopadłościan z rzutu
    const pb = (parent, x1, y1, x2, y2, yb, yt, m, o = {}) => {
      const g = new THREE.BoxGeometry(Math.max(0.001, (x2 - x1) * S), Math.max(0.001, yt - yb), Math.max(0.001, (y2 - y1) * S));
      g.translate(X((x1 + x2) / 2), (yb + yt) / 2, Z((y1 + y2) / 2));
      worldUV(g, o.uv || 1, o.rot);
      const mesh = new THREE.Mesh(g, m);
      shadowOpts(mesh, o);
      parent.add(mesh);
      return mesh;
    };
    // zaokrąglony prostopadłościan z rzutu
    const prb = (parent, x1, y1, x2, y2, yb, yt, m, r = 0.03, o = {}) => {
      const w = (x2 - x1) * S;
      const h = yt - yb;
      const d = (y2 - y1) * S;
      const g = new RoundedBoxGeometry(w, h, d, o.seg || 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      g.translate(X((x1 + x2) / 2), (yb + yt) / 2, Z((y1 + y2) / 2));
      worldUV(g, o.uv || 1, o.rot);
      const mesh = new THREE.Mesh(g, m);
      shadowOpts(mesh, o);
      parent.add(mesh);
      return mesh;
    };
    // dowolna geometria w metrach
    const put = (parent, g, m, x, y, z, o = {}) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      if (o.rx) mesh.rotation.x = o.rx;
      if (o.ry) mesh.rotation.y = o.ry;
      if (o.rz) mesh.rotation.z = o.rz;
      if (o.s) mesh.scale.set(...o.s);
      shadowOpts(mesh, o);
      parent.add(mesh);
      return mesh;
    };
    const cyl = (r1, r2, h, seg = 20, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
    const RB = (w, h, d, r = 0.03, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    // pręt między dwoma punktami (m)
    const rod = (parent, a, b, r, m, o = {}) => {
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const mesh = new THREE.Mesh(cyl(r, r, len, 8), m);
      mesh.position.copy(va).add(vb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      shadowOpts(mesh, o);
      parent.add(mesh);
      return mesh;
    };
    const floorGeo = (rects, y, tile) => {
      const pos = [];
      const uv = [];
      const idx = [];
      rects.forEach(([x1, y1, x2, y2]) => {
        const a = [X(x1), Z(y1)];
        const b = [X(x2), Z(y2)];
        const base = pos.length / 3;
        [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].forEach(([x, z]) => { pos.push(x, y, z); uv.push(x / tile, -z / tile); });
        idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const roomAtPx = (px, py) => PH.rooms.find((r) => r.rects.some((q) => px >= q[0] && px <= q[2] && py >= q[1] && py <= q[3]));

    // ---------- grupy ----------
    const world = new THREE.Group(); // płyta, loggie
    const shell = new THREE.Group(); // ściany, okna (wspólne dla obu wariantów)
    const ceiling = new THREE.Group(); // sufit (tylko w spacerze)
    const fixed = new THREE.Group(); // wspólne: grzejniki, szachty
    const outside = new THREE.Group(); // widok za oknami (tylko w spacerze)
    const styles = { obecny: new THREE.Group(), odswiezony: new THREE.Group() };
    const demo = { kuchnia: new THREE.Group(), hol: new THREE.Group() }; // ściany do wyburzenia
    // to, co wisi/stoi na ścianie do wyburzenia, znika razem z nią (osobno dla każdego wariantu)
    const onWall = {
      kuchnia: { obecny: new THREE.Group(), odswiezony: new THREE.Group() },
      hol: { obecny: new THREE.Group(), odswiezony: new THREE.Group() },
    };
    Object.keys(onWall).forEach((k) => demo[k].add(onWall[k].obecny, onWall[k].odswiezony));
    const island = new THREE.Group(); // wyspa kuchenna: po odświeżeniu, gdy ściana kuchni wyburzona
    scene.add(world, shell, ceiling, fixed, outside, styles.obecny, styles.odswiezony, demo.kuchnia, demo.hol, island);
    const loose = styles.obecny;
    const O = styles.obecny;
    const R = styles.odswiezony;

    // ---------- pomocnicze ----------
    const B = (p, x1, y1, x2, y2, z1, z2, m, o = {}) => pb(p, Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), z1, z2, m, o);
    const RX = (p, x1, y1, x2, y2, z1, z2, m, r = 0.006, o = {}) => prb(p, x1, y1, x2, y2, z1, z2, m, r, { seg: 2, ...o });
    // płaszczyzna (UV 0..1) zwrócona w stronę: S (+y rzutu), N (−y), E (+x), W (−x)
    const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
    const plane = (p, a1, a2, at, z1, z2, m, face, o = {}) => {
      const horiz = face === 'N' || face === 'S';
      const w = Math.abs(a2 - a1) * S;
      const g = new THREE.PlaneGeometry(w, z2 - z1);
      if (o.tile) {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / o.tile), uv.getY(i) * ((z2 - z1) / o.tile) + z1 / o.tile);
      }
      const cx = horiz ? X((a1 + a2) / 2) : X(at);
      const cz = horiz ? Z(at) : Z((a1 + a2) / 2);
      return put(p, g, m, cx, (z1 + z2) / 2, cz, { ry: ROT[face], cast: false, ...o });
    };
    const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    const P = (x, y) => [X(x), Z(y)];

    // =================================================================
    // PODŁOGI (osobno dla każdego wariantu), PŁYTA, SUFIT
    // =================================================================
    const R_WOOD_O = [[0, 0, 570, 299], [868, 0, 1387, 299]];
    const R_TILE_O = [[137, 314, 423, 574], [435, 314, 669, 574], [582, 203, 856, 314], [582, 0, 856, 190], [570, 206, 582, 292], [675, 190, 755, 203], [856, 212, 868, 292], [198, 299, 288, 314], [423, 414, 435, 514]];
    const R_WOOD_R = [[0, 0, 570, 299], [868, 0, 1387, 299], [435, 314, 669, 574], [582, 203, 856, 314], [570, 206, 582, 292], [856, 212, 868, 292]];
    const R_TILE_R = [[137, 314, 423, 574], [582, 0, 856, 190], [675, 190, 755, 203], [198, 299, 288, 314], [423, 414, 435, 514]];
    const fWoodO = put(O, floorGeo(R_WOOD_O, 0.002, 1), mat.floorO, 0, 0, 0, { cast: false });
    const fTileO = put(O, floorGeo(R_TILE_O, 0.002, 1), mat.tileO, 0, 0, 0, { cast: false });
    const fWoodR = put(R, floorGeo(R_WOOD_R, 0.002, 1), mat.floorR, 0, 0, 0, { cast: false });
    const fTileR = put(R, floorGeo(R_TILE_R, 0.002, 1), mat.tileR, 0, 0, 0, { cast: false });
    // pod ścianami do wyburzenia też jest podłoga (widać ją po wyburzeniu)
    const fDemoO = put(O, floorGeo([[137, 299, 198, 314], [288, 299, 435, 314], [435, 299, 570, 314]], 0.0015, 1), mat.floorO, 0, 0, 0, { cast: false });
    const fDemoR = put(R, floorGeo([[137, 299, 198, 314], [288, 299, 435, 314], [435, 299, 570, 314]], 0.0015, 1), mat.floorR, 0, 0, 0, { cast: false });
    const fTer = put(world, floorGeo([[-25, 314, 122, 574], [1412, -10, 1492, 300]], 0.002, 0.6), mat.terrace, 0, 0, 0, { cast: false });
    const floorMeshes = [fWoodO, fTileO, fWoodR, fTileR, fDemoO, fDemoR, fTer];
    // płyta stropowa (przekrój makiety)
    pb(world, -25, -25, 1412, 324, -0.3, -0.001, mat.slab, { cast: false, noAO: true });
    pb(world, -25, 324, 694, 599, -0.3, -0.001, mat.slab, { cast: false, noAO: true });
    pb(world, 1412, -14, 1496, 304, -0.3, -0.001, mat.slab, { cast: false, noAO: true });
    put(world, new THREE.PlaneGeometry(24, 12), mat.shadowDecal, X(700), -0.32, Z(290), { rx: -Math.PI / 2, cast: false, receive: false, noAO: true });
    // sufit
    pb(ceiling, -25, -25, 1412, 324, H, H + 0.3, [mat.render, mat.render, mat.render, mat.ceiling, mat.render, mat.render], { uv: 2 });
    pb(ceiling, -25, 324, 694, 599, H, H + 0.3, [mat.render, mat.render, mat.render, mat.ceiling, mat.render, mat.render], { uv: 2 });
    pb(ceiling, -25, 314, 122, 574, H, H + 0.25, mat.render, { uv: 2 });
    pb(ceiling, 1412, -14, 1496, 304, H, H + 0.25, mat.render, { uv: 2 });
    ceiling.visible = false;

    // =================================================================
    // ŚCIANY (materiał strony zależy od pomieszczenia za nią)
    // =================================================================
    const PAINT_OF = { salon: mat.paintL, sypialnia: mat.paintB, kuchnia: mat.paintK, przedpokoj: mat.paintH };
    const faceMat = (px, py) => {
      const r = roomAtPx(px, py);
      if (!r || r.outdoor) return mat.render;
      if (r.id === 'lazienka') return mat.wallTile;
      return PAINT_OF[r.id] || mat.paintL;
    };
    const baseboards = [];
    const wall = (x1, y1, x2, y2, yb = 0, yt = H, parent = shell) => {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const e = 4;
      const mArr = [faceMat(x2 + e, my), faceMat(x1 - e, my), mat.cut, mat.ceiling, faceMat(mx, y2 + e), faceMat(mx, y1 - e)];
      const m = pb(parent, x1, y1, x2, y2, yb, yt, mArr, { uv: 0.6 });
      if (yb === 0) baseboards.push([x1, y1, x2, y2, parent]);
      return m;
    };
    const LINTEL = 2.05;
    // zewnętrzne
    [[-25, -25, 1412, 0], [-25, 0, 0, 100], [-25, 290, 0, 314], [-25, 574, 495, 599], [585, 574, 694, 599], [669, 299, 694, 574],
      [856, 299, 1412, 324], [669, 299, 856, 324], [1387, 0, 1412, 140], [1387, 232, 1412, 299]].forEach((r) => wall(...r));
    // ściana pokoju nad loggią
    wall(-25, 299, 137, 314);
    // ściana kuchni z oknem na loggię
    wall(122, 314, 137, 410); wall(122, 505, 137, 574);
    // wewnętrzne
    [[423, 299, 435, 414], [423, 514, 435, 574], [371, 514, 423, 574], [570, 0, 582, 206], [570, 292, 582, 299], [570, 299, 582, 314],
      [582, 190, 675, 203], [755, 190, 856, 203], [856, 0, 868, 212], [856, 292, 868, 299], [582, 0, 621, 71]].forEach((r) => wall(...r));
    // nadproża
    [[570, 206, 582, 292], [675, 190, 755, 203], [856, 212, 868, 292], [495, 574, 585, 599]].forEach((r) => wall(r[0], r[1], r[2], r[3], LINTEL, H));
    wall(198, 299, 288, 314, 2.1, H, demo.kuchnia); // nadproże otworu kuchnia–pokój
    wall(423, 414, 435, 514, LINTEL, H);
    // do wyburzenia
    wall(137, 299, 198, 314, 0, H, demo.kuchnia);
    wall(288, 299, 423, 314, 0, H, demo.kuchnia);
    wall(435, 299, 570, 314, 0, H, demo.hol);

    // ---------- okna (rama złoty dąb, jak na zdjęciach) ----------
    const windowLights = [];
    const glassMeshes = [];
    const winProf = (vertical, len, along, w, h, a, b, d, out, m = mat.frame) => {
      const g = vertical ? new THREE.BoxGeometry(d, h, w) : new THREE.BoxGeometry(w, h, d);
      const p = along(a, b);
      put(shell, g, m, p[0], p[1], p[2]);
    };
    const makeWindow = (x1, y1, x2, y2, side, sill, top, cols, transom, opts = {}) => {
      if (sill > 0) wall(x1, y1, x2, y2, 0, sill);
      wall(x1, y1, x2, y2, top, H);
      const vertical = side === 'W' || side === 'E';
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const th = (vertical ? x2 - x1 : y2 - y1) * S;
      const cx = X((x1 + x2) / 2);
      const cz = Z((y1 + y2) / 2);
      const out = side === 'W' || side === 'N' ? -1 : 1; // na zewnątrz
      const fx = vertical ? cx + out * th * 0.15 : cx;
      const fz = vertical ? cz : cz + out * th * 0.15;
      const hgt = top - sill;
      const along = (a, b) => (vertical ? [fx, b, fz + a] : [fx + a, b, fz]);
      const F = 0.068;
      winProf(vertical, len, along, len, F, 0, top - F / 2, 0.075, out);
      winProf(vertical, len, along, len, F, 0, sill + F / 2, 0.075, out);
      winProf(vertical, len, along, F, hgt, -len / 2 + F / 2, sill + hgt / 2, 0.075, out);
      winProf(vertical, len, along, F, hgt, len / 2 - F / 2, sill + hgt / 2, 0.075, out);
      for (let i = 1; i < cols; i++) winProf(vertical, len, along, 0.11, hgt, -len / 2 + (len * i) / cols, sill + hgt / 2, 0.085, out);
      if (transom) winProf(vertical, len, along, len, 0.1, 0, transom, 0.085, out);
      // skrzydła: wewnętrzne ramki i klamki
      for (let i = 0; i < cols; i++) {
        const a = -len / 2 + (len * (i + 0.5)) / cols;
        const sw = len / cols - 0.12;
        const segs = transom ? [[sill + 0.05, transom - 0.05], [transom + 0.05, top - 0.05]] : [[sill + 0.05, top - 0.05]];
        segs.forEach(([b0, b1]) => {
          winProf(vertical, len, along, sw, 0.055, a, b1 - 0.028, 0.06, out);
          winProf(vertical, len, along, sw, 0.055, a, b0 + 0.028, 0.06, out);
          winProf(vertical, len, along, 0.055, b1 - b0, a - sw / 2 + 0.028, (b0 + b1) / 2, 0.06, out);
          winProf(vertical, len, along, 0.055, b1 - b0, a + sw / 2 - 0.028, (b0 + b1) / 2, 0.06, out);
        });
        if (opts.handles !== false) {
          const hb = transom ? Math.min(transom - 0.25, sill + 1.05) : sill + Math.min(1.05, hgt * 0.5);
          const hp = along(a + (i % 2 ? -1 : 1) * (sw / 2 - 0.02), hb);
          const io = -out * 0.06;
          put(shell, RB(vertical ? 0.025 : 0.02, 0.14, vertical ? 0.02 : 0.025, 0.006), mat.alu, hp[0] + (vertical ? io : 0), hp[1], hp[2] + (vertical ? 0 : io), { cast: false });
        }
      }
      const gm = put(shell, vertical ? new THREE.BoxGeometry(0.01, hgt - 0.12, len - 0.1) : new THREE.BoxGeometry(len - 0.1, hgt - 0.12, 0.01), mat.glass, fx, sill + hgt / 2, fz, { cast: false, receive: false, noAO: true });
      glassMeshes.push(gm);
      // ościeża wewnętrzne (tynk) + parapet
      const inX = vertical ? cx - out * th * 0.5 : cx;
      const inZ = vertical ? cz : cz - out * th * 0.5;
      if (opts.sillBoard) {
        const d = th * 0.6 + 0.06;
        const m = opts.sillBoard;
        put(shell, vertical ? new THREE.BoxGeometry(d, 0.03, len + 0.1) : new THREE.BoxGeometry(len + 0.1, 0.03, d), m, inX + (vertical ? out * (th * 0.5 - d / 2) - out * 0.0 : 0), sill + 0.015, inZ + (vertical ? 0 : out * (th * 0.5 - d / 2)));
      }
      windowLights.push({ cx: inX, cz: inZ, len, sill, top, vertical, out });
      return { inX, inZ, len, vertical, out, th };
    };
    // salon: okno 2 × 2 na drewnianym podeście (zachód)
    const winL = makeWindow(-25, 100, 0, 290, 'W', 0.24, 2.36, 2, 1.32, {});
    // kuchnia: okno uchylne na loggię
    const winK = makeWindow(122, 410, 137, 505, 'W', 0.92, 2.22, 1, 0, { sillBoard: mat.walnut });
    // sypialnia: drzwi balkonowe (wschód)
    const winB = makeWindow(1387, 140, 1412, 232, 'E', 0.0, 2.3, 1, 0, { handles: true });
    // próg drzwi balkonowych
    B(shell, 1387, 140, 1412, 232, 0, 0.03, mat.frame);

    // ---------- listwy przypodłogowe (osobno dla wariantów) ----------
    const skirtMatR = mat.whiteMatt;
    baseboards.forEach(([x1, y1, x2, y2, parent]) => {
      const sides = [[x1 - 1.2, y1, x1, y2, (x1 - 3)], [x2, y1, x2 + 1.2, y2, (x2 + 3)]].map(([a, b, c, d, px]) => ({ r: [a, b, c, d], px, py: (y1 + y2) / 2 }));
      const sidesY = [[x1, y1 - 1.2, x2, y1, (y1 - 3)], [x1, y2, x2, y2 + 1.2, (y2 + 3)]].map(([a, b, c, d, py]) => ({ r: [a, b, c, d], px: (x1 + x2) / 2, py }));
      const isOut = (px, py) => { const r = roomAtPx(px, py); return !r || r.outdoor || r.id === 'lazienka'; };
      [...sides, ...sidesY].forEach(({ r, px, py }) => {
        if (isOut(px, py)) return;
        if (r[2] - r[0] < 0.5 && r[3] - r[1] < 0.5) return;
        const tgt = parent === shell ? null : parent;
        const pO = tgt ? (tgt === demo.kuchnia ? onWall.kuchnia.obecny : onWall.hol.obecny) : O;
        const pR = tgt ? (tgt === demo.kuchnia ? onWall.kuchnia.odswiezony : onWall.hol.odswiezony) : R;
        B(pO, r[0], r[1], r[2], r[3], 0, 0.07, mat.skirtO, { cast: false });
        B(pR, r[0], r[1], r[2], r[3], 0, 0.09, skirtMatR, { cast: false });
      });
    });

    // =================================================================
    // DRZWI
    // =================================================================
    // skrzydło: płyta z teksturą zdjęcia po obu stronach (obecnie) albo biała płyta z czarną klamką (po odświeżeniu)
    const leaf = (parent, w, faceMatA, edgeMat, handleMat, opts = {}) => {
      const g = new THREE.Group();
      const t = 0.04;
      put(g, new THREE.BoxGeometry(w, 2.0, t), edgeMat, w / 2, 1.0, 0);
      if (faceMatA) {
        put(g, new THREE.PlaneGeometry(w, 2.0), faceMatA, w / 2, 1.0, t / 2 + 0.0008, { cast: false });
        put(g, new THREE.PlaneGeometry(w, 2.0), faceMatA, w / 2, 1.0, -t / 2 - 0.0008, { ry: Math.PI, cast: false });
      }
      if (opts.frosted) {
        for (let i = 0; i < 4; i++) put(g, new THREE.BoxGeometry(w * 0.48, 0.27, t + 0.004), mat.frosted, w / 2, 0.42 + i * 0.4 + 0.135, 0, { cast: false, noAO: true });
      }
      // klamka po obu stronach
      [1, -1].forEach((sd) => {
        put(g, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), handleMat, w - 0.07, 1.02, sd * (t / 2 + 0.006), { rx: Math.PI / 2, cast: false });
        put(g, RB(0.12, 0.018, 0.018, 0.008), handleMat, w - 0.115, 1.02, sd * (t / 2 + 0.03), { cast: false });
      });
      parent.add(g);
      return g;
    };
    // ościeżnica: okładziny ościeża + opaski po obu stronach (a = szerokość otworu, b = grubość ściany)
    const jamb = (parent, x1, y1, x2, y2, m, alongX) => {
      const add = (a1, b1, a2, b2, z1, z2) => (alongX ? B(parent, a1, b1, a2, b2, z1, z2, m, { cast: false }) : B(parent, b1, a1, b2, a2, z1, z2, m, { cast: false }));
      const [a1, a2, b1, b2] = alongX ? [x1, x2, y1, y2] : [y1, y2, x1, x2];
      const T = 1;
      const W = 6;
      add(a1, b1 - T, a1 + 2, b2 + T, 0, LINTEL);
      add(a2 - 2, b1 - T, a2, b2 + T, 0, LINTEL);
      add(a1, b1 - T, a2, b2 + T, LINTEL - 0.02, LINTEL);
      [[b1 - T, b1], [b2, b2 + T]].forEach(([c1, c2]) => {
        add(a1 - W, c1, a1 + 2, c2, 0, LINTEL + 0.06);
        add(a2 - 2, c1, a2 + W, c2, 0, LINTEL + 0.06);
        add(a1 - W, c1, a2 + W, c2, LINTEL, LINTEL + 0.06);
      });
    };
    // łazienka: zawias przy x=675, otwiera się do korytarza
    // sypialnia: zawias przy y=292, otwiera się do pokoju
    [['O', mat.walnut, mat.doorInt, mat.alu, true], ['R', mat.white, null, mat.black, false]].forEach(([k, edge, face, handle, frosted]) => {
      const par = k === 'O' ? O : R;
      jamb(par, 675, 190, 755, 203, edge, true);
      const d1 = leaf(par, 0.78, face, edge, handle, { frosted });
      d1.position.set(X(677), 0, Z(201));
      d1.rotation.y = -1.2;
      jamb(par, 856, 212, 868, 292, edge, false);
      const d2 = leaf(par, 0.78, face, edge, handle, { frosted });
      d2.position.set(X(866), 0, Z(290));
      d2.rotation.y = Math.PI / 2 - 1.35;
      // salon: przejście z opaską
      jamb(par, 570, 206, 582, 292, edge, false);
    });
    // drzwi wejściowe (zdjęcie), ościeżnica wiśnia
    B(shell, 487, 568, 495, 599, 0, 2.12, mat.walnut);
    B(shell, 585, 568, 593, 599, 0, 2.12, mat.walnut);
    B(shell, 487, 568, 593, 599, LINTEL, 2.12, mat.walnut);
    B(shell, 495, 582, 585, 588, 0, LINTEL, mat.walnut);
    plane(shell, 495, 585, 581.9, 0.0, LINTEL, mat.doorEnt, 'N');
    put(shell, RB(0.13, 0.02, 0.02, 0.008), mat.alu, X(510), 1.0, Z(580.4), { cast: false });

    // =================================================================
    // DETALE WSPÓLNE
    // =================================================================
    const radiator = (p, x1, y1, x2, y2, z1, z2) => {
      const g = B(p, x1, y1, x2, y2, z1, z2, mat.white);
      const horiz = x2 - x1 > y2 - y1;
      const n = Math.round(((horiz ? x2 - x1 : y2 - y1) * S) / 0.05);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (horiz) B(p, x1 + (x2 - x1) * t - 0.4, y1 - 0.6, x1 + (x2 - x1) * t + 0.4, y2 + 0.6, z1 + 0.03, z2 - 0.03, mat.white, { cast: false });
        else B(p, x1 - 0.6, y1 + (y2 - y1) * t - 0.4, x2 + 0.6, y1 + (y2 - y1) * t + 0.4, z1 + 0.03, z2 - 0.03, mat.white, { cast: false });
      }
      return g;
    };
    radiator(fixed, 1, 12, 9, 84, 0.16, 0.76); // salon
    radiator(fixed, 138, 425, 146, 492, 0.16, 0.7); // kuchnia
    radiator(fixed, 1378, 56, 1386, 126, 0.12, 0.72); // sypialnia
    // gniazdka i włączniki
    const socket = (p, x, y, face, z = 0.3) => {
      const horiz = face === 'N' || face === 'S';
      const g = new THREE.BoxGeometry(horiz ? 0.075 : 0.012, 0.075, horiz ? 0.012 : 0.075);
      const off = { N: -0.006, S: 0.006, E: 0.006, W: -0.006 }[face];
      put(p, g, mat.white, X(x) + (horiz ? 0 : off), z, Z(y) + (horiz ? off : 0), { cast: false });
    };
    [[560, 0.006, 'S', 1.05], [585, 205, 'S', 1.05], [870, 205, 'E', 1.05], [500, 573.9, 'N', 1.05], [138, 380, 'E', 1.05], [230, 0.006, 'S', 0.3], [1000, 0.006, 'S', 0.3], [1386.9, 260, 'W', 0.3], [571, 140, 'W', 0.3]].forEach(([x, y, f, z]) => socket(shell, x, y, f, z));
    // skrzynka bezpieczników nad drzwiami, domofon
    B(shell, 518, 560, 562, 574, 2.12, 2.45, mat.white);
    B(shell, 476, 571, 488, 574, 1.35, 1.58, mat.white);

    // ---------- loggie: balustrady stalowe z siatką ----------
    const meshMat = M({ color: 0x8d9094, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }, 0.8);
    const steel = M({ color: 0x8a8d90, roughness: 0.45, metalness: 0.7 }, 1);
    const rail = (x1, y1, x2, y2) => {
      const vertical = x2 - x1 < y2 - y1;
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const cx = X((x1 + x2) / 2);
      const cz = Z((y1 + y2) / 2);
      put(world, new THREE.PlaneGeometry(len, 0.9), meshMat, cx, 0.55, cz, { ry: vertical ? Math.PI / 2 : 0, cast: false, receive: false, noAO: true });
      put(world, new THREE.BoxGeometry(vertical ? 0.04 : len, 0.04, vertical ? len : 0.04), steel, cx, 1.06, cz);
      put(world, new THREE.BoxGeometry(vertical ? 0.03 : len, 0.03, vertical ? len : 0.03), steel, cx, 0.1, cz);
      const n = Math.max(1, Math.round(len / 1.0));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        put(world, new THREE.BoxGeometry(0.04, 1.06, 0.04), steel, vertical ? cx : X(x1 + (x2 - x1) * t), 0.53, vertical ? Z(y1 + (y2 - y1) * t) : cz);
      }
    };
    rail(-25, 314, -21, 574);
    rail(1488, -10, 1492, 300);
    rail(1412, -10, 1492, -6);
    rail(1412, 296, 1492, 300);

    // =================================================================
    // DEKORACJE: rośliny, wazony, lampy
    // =================================================================
    const leafGeo = (() => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.quadraticCurveTo(0.5, 0.42, 1, 0);
      s.quadraticCurveTo(0.5, -0.42, 0, 0);
      const g = new THREE.ShapeGeometry(s, 6);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const leaves = (p, pts, size, m) => {
      const im = new THREE.InstancedMesh(leafGeo, m, pts.length);
      const o = new THREE.Object3D();
      pts.forEach(([x, y, z, yaw, pitch, s], i) => {
        o.position.set(x, y, z);
        o.rotation.set(0, yaw, 0);
        o.rotateZ(pitch);
        o.scale.setScalar(size * (s || 1));
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      p.add(im);
      return im;
    };
    // pampasy w wazonie
    const pampas = (p, x, y, z, h = 0.9, m = mat.pampas, vm = mat.vase) => {
      const cx = X(x);
      const cz = Z(y);
      put(p, lathe([[0, 0], [0.07, 0.005], [0.1, 0.08], [0.11, 0.17], [0.085, 0.27], [0.05, 0.32], [0.055, 0.34], [0.045, 0.345]]), vm, cx, z, cz);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rnd();
        const lean = 0.12 + rnd() * 0.22;
        const len = h * (0.75 + rnd() * 0.3);
        const tip = [cx + Math.cos(a) * lean * len, z + 0.3 + len, cz + Math.sin(a) * lean * len];
        rod(p, [cx, z + 0.3, cz], tip, 0.004, mat.bark, { cast: false });
        const plume = put(p, new THREE.CapsuleGeometry(0.035, 0.24, 4, 8), m, tip[0], tip[1] - 0.06, tip[2], { cast: true });
        plume.lookAt(cx, z + 0.3, cz);
        plume.rotateX(Math.PI / 2);
      }
    };
    // storczyk w białej osłonce
    const orchid = (p, x, y, z) => {
      const cx = X(x);
      const cz = Z(y);
      put(p, lathe([[0, 0], [0.06, 0], [0.075, 0.13], [0.07, 0.135], [0, 0.135]]), mat.pot, cx, z, cz);
      leaves(p, [[cx, z + 0.13, cz, 0.3, 0.3], [cx, z + 0.13, cz, 2.4, 0.25], [cx, z + 0.13, cz, 4.4, 0.3]], 0.16, mat.plant);
      [[0.06, 0.05], [-0.07, 0.03]].forEach(([dx, dz]) => {
        const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(cx, z + 0.13, cz), new THREE.Vector3(cx + dx * 0.5, z + 0.55, cz + dz * 0.5), new THREE.Vector3(cx + dx * 2.2, z + 0.5, cz + dz * 2));
        put(p, new THREE.TubeGeometry(c, 10, 0.003, 4), mat.stem, 0, 0, 0, { cast: false });
        for (let i = 0; i < 6; i++) {
          const q = c.getPoint(0.45 + i * 0.1);
          put(p, new THREE.CircleGeometry(0.03, 5), mat.orchid, q.x, q.y - 0.02, q.z, { ry: rnd() * 6, rx: -0.4, cast: false });
        }
      });
    };
    // zieleń w wazonie (gałązki)
    const greens = (p, x, y, z, h = 0.45, vm = mat.vaseWhite, lm = mat.plant) => {
      const cx = X(x);
      const cz = Z(y);
      put(p, lathe([[0, 0], [0.06, 0.003], [0.09, 0.08], [0.085, 0.18], [0.045, 0.28], [0.04, 0.3]]), vm, cx, z, cz);
      const pts = [];
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * Math.PI * 2 + rnd();
        const lean = 0.35 + rnd() * 0.4;
        for (let i = 0; i < 9; i++) {
          const t = (i + 1) / 9;
          pts.push([cx + Math.cos(a) * lean * h * t, z + 0.28 + h * t * (1 - lean * 0.3), cz + Math.sin(a) * lean * h * t, a + (rnd() - 0.5) * 2, -0.4 + rnd() * 0.8, 0.8 + rnd() * 0.5]);
        }
      }
      leaves(p, pts, 0.06, lm);
    };
    // drzewko oliwne w donicy (po odświeżeniu)
    const oliveTree = (p, x, y, h = 1.7) => {
      const cx = X(x);
      const cz = Z(y);
      put(p, lathe([[0, 0], [0.2, 0], [0.22, 0.38], [0.21, 0.4], [0, 0.4]]), mat.terracottaPot, cx, 0, cz);
      put(p, new THREE.CylinderGeometry(0.2, 0.2, 0.01, 24), mat.soil, cx, 0.38, cz, { cast: false });
      rod(p, [cx, 0.38, cz], [cx + 0.04, 1.1, cz + 0.02], 0.025, mat.bark);
      const pts = [];
      for (let b = 0; b < 7; b++) {
        const a = (b / 7) * Math.PI * 2;
        const bx = cx + 0.04 + Math.cos(a) * 0.22;
        const bz = cz + 0.02 + Math.sin(a) * 0.22;
        const by = 1.15 + rnd() * 0.4;
        rod(p, [cx + 0.04, 1.05, cz + 0.02], [bx, by, bz], 0.01, mat.bark, { cast: false });
        for (let i = 0; i < 40; i++) {
          const r = 0.12 + rnd() * 0.28;
          const t = rnd() * Math.PI * 2;
          pts.push([bx + Math.cos(t) * r * 0.8, by + (rnd() - 0.3) * 0.35, bz + Math.sin(t) * r * 0.8, rnd() * 6.3, -0.6 + rnd() * 1.2, 0.8 + rnd() * 0.5]);
        }
      }
      leaves(p, pts.filter((q) => q[1] < h + 0.3), 0.07, mat.olive);
    };
    // monstera w koszu
    const monstera = (p, x, y) => {
      const cx = X(x);
      const cz = Z(y);
      put(p, lathe([[0, 0], [0.17, 0], [0.2, 0.32], [0.19, 0.33], [0, 0.33]]), mat.basket, cx, 0, cz);
      const pts = [];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rnd() * 0.4;
        const r = 0.15 + rnd() * 0.25;
        const y0 = 0.6 + rnd() * 0.6;
        rod(p, [cx, 0.3, cz], [cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r], 0.006, mat.stem, { cast: false });
        pts.push([cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r, -a, -0.3 - rnd() * 0.5, 0.9 + rnd() * 0.4]);
      }
      leaves(p, pts, 0.36, mat.plant);
    };
    // reflektorki na listwie (stan obecny)
    const track = (p, x, y, n = 3, alongX = true) => {
      const cx = X(x);
      const cz = Z(y);
      const L = 0.22 * n;
      put(p, new THREE.BoxGeometry(alongX ? L : 0.04, 0.025, alongX ? 0.04 : L), mat.chrome, cx, H - 0.03, cz, { cast: false });
      put(p, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), mat.chrome, cx, H - 0.012, cz, { cast: false });
      for (let i = 0; i < n; i++) {
        const t = -L / 2 + 0.11 + i * 0.22;
        const px = cx + (alongX ? t : 0);
        const pz = cz + (alongX ? 0 : t);
        const g = new THREE.Group();
        g.position.set(px, H - 0.08, pz);
        g.rotation.set((i - 1) * 0.5 + 0.3, i * 1.7, 0);
        put(g, new THREE.CylinderGeometry(0.03, 0.026, 0.08, 16), mat.chrome, 0, -0.03, 0, { cast: false });
        put(g, new THREE.CircleGeometry(0.022, 16), mat.bulb, 0, -0.071, 0, { rx: Math.PI / 2, cast: false });
        p.add(g);
        rod(p, [px, H - 0.04, pz], [px, H - 0.06, pz], 0.006, mat.chrome, { cast: false });
      }
    };
    // oczko w suficie (po odświeżeniu / łazienka)
    const downlight = (p, x, y, m = mat.led) => {
      put(p, new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), mat.whiteMatt, X(x), H - 0.003, Z(y), { cast: false });
      put(p, new THREE.CircleGeometry(0.032, 20), m, X(x), H - 0.007, Z(y), { rx: Math.PI / 2, cast: false });
    };
    // rama obrazu z passe-partout
    const artFrame = (p, a1, a2, at, z1, z2, artM, face, fm = mat.blackMatt, depth = 0.025, pp = 0.0) => {
      const horiz = face === 'N' || face === 'S';
      const off = { N: -1, S: 1, E: 1, W: -1 }[face];
      const d = depth * 100;
      if (horiz) B(p, a1, at, a2, at + off * d, z1, z2, fm, { cast: false });
      else B(p, at, a1, at + off * d, a2, z1, z2, fm, { cast: false });
      const at2 = at + off * (d + 0.05);
      if (pp > 0) {
        plane(p, a1 + 1.5, a2 - 1.5, at2, z1 + 0.015, z2 - 0.015, mat.passe, face);
        plane(p, a1 + 1.5 + pp * 100, a2 - 1.5 - pp * 100, at2 + off * 0.05, z1 + 0.015 + pp, z2 - 0.015 - pp, artM, face);
      } else plane(p, a1 + 1.2, a2 - 1.2, at2, z1 + 0.012, z2 - 0.012, artM, face);
    };
    // zasłona (falująca tkanina)
    const curtain = (p, a1, a2, at, z1, z2, m, face, folds = 8, amp = 0.035) => {
      const horiz = face === 'N' || face === 'S';
      const w = Math.abs(a2 - a1) * S;
      const g = new THREE.PlaneGeometry(w, z2 - z1, folds * 6, 1);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const u = (pa.getX(i) / w + 0.5) * folds * Math.PI * 2;
        pa.setZ(i, Math.sin(u) * amp);
      }
      g.computeVertexNormals();
      const off = { N: -1, S: 1, E: 1, W: -1 }[face] * (amp + 0.02);
      const cx = horiz ? X((a1 + a2) / 2) : X(at) + off;
      const cz = horiz ? Z(at) + off : Z((a1 + a2) / 2);
      return put(p, g, m, cx, (z1 + z2) / 2, cz, { ry: ROT[face], cast: false });
    };

    // meble stanu obecnego (ukrywane w wariancie „puste”)
    const furnFrom = () => O.children.length;
    const markFurn = (i0) => O.children.slice(i0).forEach((c) => { c.userData.furniture = true; });
    // =================================================================
    // SALON — STAN OBECNY (wg zdjęć)
    // =================================================================
    const fSalon = furnFrom();
    // drewniany podest pod oknem
    B(O, 0, 95, 32, 299, 0, 0.22, mat.pine, { uv: 1 });
    // klimatyzator i brązowy kanał pod sufitem
    RX(fixed, 12, 279, 92, 299, 2.2, 2.47, mat.white, 0.03);
    B(fixed, 0, 60, 7, 292, 2.48, 2.55, mat.walnut);
    B(fixed, 0, 292, 12, 299, 2.48, 2.55, mat.walnut);
    // rolety rzymskie (zwinięte, beżowe w brązowe kwadraty)
    const blindRoll = (p, a1, a2, at, face, z) => {
      const horiz = face === 'N' || face === 'S';
      const off = { N: -1, S: 1, E: 1, W: -1 }[face];
      if (horiz) B(p, a1, at, a2, at + off * 6, z, z + 0.16, mat.blind, { cast: false });
      else B(p, at, a1, at + off * 6, a2, z, z + 0.16, mat.blind, { cast: false });
      for (let i = 0; i < Math.floor((a2 - a1) / 16); i++) {
        const a = a1 + 8 + i * 16;
        if (horiz) B(p, a - 1.5, at + off * 6, a + 1.5, at + off * 6.2, z + 0.05, z + 0.08, mat.blindPat, { cast: false });
        else B(p, at + off * 6, a - 1.5, at + off * 6.2, a + 1.5, z + 0.05, z + 0.08, mat.blindPat, { cast: false });
      }
    };
    blindRoll(O, 106, 191, 2, 'E', 2.14);
    blindRoll(O, 200, 285, 2, 'E', 2.14);
    blindRoll(O, 413, 502, 139, 'E', 1.98);
    // szafka RTV + telewizor
    RX(O, 36, 30, 80, 150, 0.06, 0.42, mat.wenge, 0.01);
    [[36, 30, 80, 150]].forEach(() => {
      B(O, 80, 40, 80.6, 88, 0.12, 0.3, mat.blackGloss, { cast: false });
      B(O, 80, 92, 80.6, 140, 0.12, 0.3, mat.blackGloss, { cast: false });
      put(O, RB(0.012, 0.012, 0.1, 0.004), mat.alu, X(81.2), 0.21, Z(64), { cast: false });
      put(O, RB(0.012, 0.012, 0.1, 0.004), mat.alu, X(81.2), 0.21, Z(116), { cast: false });
    });
    put(O, RB(0.2, 0.012, 0.22, 0.004), mat.blackGloss, X(56), 0.428, Z(90));
    put(O, new THREE.BoxGeometry(0.03, 0.06, 0.05), mat.black, X(56), 0.46, Z(90));
    RX(O, 52, 42, 58, 138, 0.48, 1.07, mat.black, 0.006);
    plane(O, 43, 137, 58.05, 0.5, 1.05, mat.tv, 'E');
    // czarna szafka z lampką
    RX(O, 92, 4, 140, 50, 0.04, 0.5, mat.wenge, 0.008);
    put(O, lathe([[0, 0], [0.06, 0], [0.06, 0.01], [0.015, 0.02], [0.02, 0.2], [0.012, 0.32]]), mat.chrome, X(116), 0.5, Z(27));
    put(O, new THREE.CylinderGeometry(0.08, 0.11, 0.16, 24, 1, true), mat.shade, X(116), 0.86, Z(27), { cast: false });
    // kuty świecznik podłogowy
    rod(O, [X(160), 0, Z(26)], [X(160), 1.12, Z(26)], 0.008, mat.black);
    put(O, new THREE.CylinderGeometry(0.1, 0.12, 0.012, 16), mat.black, X(160), 0.006, Z(26));
    [0, 2.1, 4.2].forEach((a, i) => {
      const tx = X(160) + Math.cos(a) * 0.09;
      const tz = Z(26) + Math.sin(a) * 0.09;
      rod(O, [X(160), 0.85 + i * 0.08, Z(26)], [tx, 0.95 + i * 0.08, tz], 0.005, mat.black, { cast: false });
      put(O, new THREE.CylinderGeometry(0.025, 0.02, 0.03, 12), mat.black, tx, 0.97 + i * 0.08, tz, { cast: false });
    });
    // stolik (konsola) przy ścianie z pampasami
    B(O, 175, 6, 287, 54, 0.43, 0.47, mat.wenge);
    B(O, 177, 8, 285, 52, 0.39, 0.43, mat.white);
    [[177, 8], [281, 8], [177, 48], [281, 48]].forEach(([x, y]) => B(O, x, y, x + 4, y + 4, 0, 0.39, mat.wenge));
    pampas(O, 231, 30, 0.47, 0.75, mat.pampasDark);
    // półka nad konsolą
    B(O, 185, 0, 290, 20, 1.52, 1.55, mat.wenge);
    // sofa narożna (brąz + ciemna ekoskóra)
    RX(O, 292, 3, 562, 98, 0.04, 0.26, mat.leather, 0.02);
    RX(O, 466, 98, 562, 196, 0.04, 0.26, mat.leather, 0.02);
    RX(O, 292, 3, 316, 98, 0.26, 0.62, mat.leather, 0.03);
    RX(O, 316, 3, 562, 26, 0.26, 0.66, mat.sofa, 0.04);
    RX(O, 316, 24, 466, 98, 0.26, 0.45, mat.sofa, 0.05);
    RX(O, 466, 24, 562, 194, 0.26, 0.45, mat.sofa, 0.05);
    [[318, 368], [370, 420], [422, 472], [474, 524], [508, 560]].forEach(([a, b], i) => {
      const cush = RX(O, a, 22, b, 42, 0.44, 0.92, i % 2 ? mat.leaf : mat.leaf, 0.07);
    });
    RX(O, 330, 40, 372, 54, 0.44, 0.74, mat.pillowBrown, 0.06);
    RX(O, 500, 40, 542, 54, 0.44, 0.74, mat.pillowBrown, 0.06);
    // obraz z pomostem nad sofą
    artFrame(O, 392, 482, 0, 1.28, 1.8, mat.artPier, 'S', mat.blackMatt, 0.02);
    // witryna i szafka (wenge) na ścianie przy holu
    const vit = onWall.hol.obecny;
    RX(vit, 476, 254, 566, 299, 0.02, 2.0, mat.wenge, 0.008);
    B(vit, 480, 252.5, 562, 254, 0.98, 1.94, mat.blackGloss, { cast: false });
    B(vit, 482, 251.5, 560, 252.6, 1.0, 1.92, mat.clearGlass, { cast: false, noAO: true });
    [1.32, 1.64].forEach((z) => B(vit, 480, 256, 562, 297, z, z + 0.015, mat.clearGlass, { cast: false, noAO: true }));
    B(vit, 480, 252.6, 521, 254, 0.08, 0.92, mat.wengeMatt, { cast: false });
    B(vit, 522, 252.6, 562, 254, 0.08, 0.92, mat.wengeMatt, { cast: false });
    [[516, 0.6], [526, 0.6], [516, 1.45]].forEach(([x, z]) => put(vit, RB(0.016, 0.12, 0.02, 0.005), mat.alu, X(x), z, Z(251.8), { cast: false }));
    RX(vit, 436, 258, 474, 299, 0.02, 1.45, mat.wenge, 0.008);
    B(vit, 438, 256.6, 472, 258, 0.06, 0.7, mat.wengeMatt, { cast: false });
    B(vit, 438, 256.6, 472, 258, 0.74, 1.4, mat.blackGloss, { cast: false });
    put(vit, RB(0.1, 0.016, 0.02, 0.005), mat.alu, X(455), 0.78, Z(256), { cast: false });
    greens(vit, 455, 278, 1.45, 0.3, mat.vase, mat.plantLight);
    // obraz z czerwonymi kwiatami przy oknie
    artFrame(O, 18, 66, 299, 1.15, 2.05, mat.artRed, 'N', mat.blackMatt, 0.025);
    // storczyk na podeście
    orchid(O, 16, 150, 0.22);
    // lampy: dwie listwy z reflektorkami
    markFurn(fSalon);
    onWall.hol.obecny.children.forEach((c) => { c.userData.furniture = true; });
    track(O, 200, 150);
    track(O, 430, 150);

    // =================================================================
    // SALON — PO ODŚWIEŻENIU
    // =================================================================
    // ściana z tynkiem wapiennym za sofą
    plane(R, 2, 568, 0.25, 0.09, H - 0.002, mat.lime, 'S', { tile: 2.4 });
    // ławka pod oknem (biała zabudowa, dębowy blat, lniana poducha)
    B(R, 0, 98, 46, 297, 0, 0.42, mat.whiteMatt);
    B(R, 0, 96, 49, 299, 0.42, 0.46, mat.oakl);
    RX(R, 2, 100, 44, 295, 0.46, 0.55, mat.linen, 0.03);
    RX(R, 4, 112, 16, 158, 0.52, 0.86, mat.knit, 0.06);
    RX(R, 4, 230, 16, 280, 0.52, 0.84, mat.rust, 0.06);
    // zasłony lniane + firana na szynie sufitowej
    put(R, new THREE.BoxGeometry(0.03, 0.02, 2.95), mat.whiteMatt, X(56), H - 0.02, Z(150), { cast: false });
    curtain(R, 2, 70, 56, 0.06, H - 0.04, mat.linen, 'E', 6, 0.04);
    curtain(R, 230, 298, 56, 0.06, H - 0.04, mat.linen, 'E', 6, 0.04);
    curtain(R, 70, 230, 60, 0.06, H - 0.04, mat.sheer, 'E', 10, 0.025);
    // drzewko oliwne w rogu
    oliveTree(R, 34, 40, 1.75);
    // jadalnia przy oknie: okrągły stół dębowy, 3 krzesła, lampa wisząca
    const table = (p, x, y, r, h, top, leg) => {
      put(p, new THREE.CylinderGeometry(r, r, 0.035, 48), top, X(x), h - 0.018, Z(y));
      put(p, new THREE.CylinderGeometry(0.05, 0.05, h - 0.06, 20), leg, X(x), (h - 0.06) / 2 + 0.03, Z(y));
      put(p, new THREE.CylinderGeometry(0.24, 0.26, 0.03, 32), leg, X(x), 0.015, Z(y));
    };
    table(R, 182, 196, 0.45, 0.75, mat.oakl, mat.oakl);
    const chair = (p, x, y, yaw, seatM = mat.basket, frameM = mat.oakl) => {
      const g = new THREE.Group();
      g.position.set(X(x), 0, Z(y));
      g.rotation.y = yaw;
      [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([a, b]) => put(g, new THREE.CylinderGeometry(0.016, 0.014, 0.45, 10), frameM, a, 0.225, b));
      put(g, RB(0.46, 0.04, 0.44, 0.012), seatM, 0, 0.47, 0);
      put(g, new THREE.TorusGeometry(0.22, 0.014, 8, 24, Math.PI), frameM, 0, 0.78, 0.2, { rz: 0, rx: 0 });
      rod(g, [-0.22, 0.47, 0.2], [-0.22, 0.78, 0.2], 0.014, frameM);
      rod(g, [0.22, 0.47, 0.2], [0.22, 0.78, 0.2], 0.014, frameM);
      p.add(g);
      return g;
    };
    chair(R, 182, 134, Math.PI);
    chair(R, 236, 228, -2.1);
    chair(R, 128, 228, 2.1);
    greens(R, 182, 196, 0.75, 0.35, mat.vaseWhite, mat.olive);
    const pendant = (p, x, y, z, r = 0.25, h = 0.28) => {
      rod(p, [X(x), H, Z(y)], [X(x), z + h / 2, Z(y)], 0.003, mat.black, { cast: false });
      put(p, new THREE.CylinderGeometry(r * 0.92, r, h, 40, 1, true), mat.shade, X(x), z, Z(y), { cast: false });
      put(p, new THREE.SphereGeometry(0.05, 16, 8), mat.bulb, X(x), z - 0.02, Z(y), { cast: false });
    };
    pendant(R, 182, 196, 1.55, 0.26, 0.3);
    // sofa bouclé + poduchy + pled
    RX(R, 290, 4, 552, 102, 0.05, 0.12, mat.oakl, 0.01);
    RX(R, 292, 6, 550, 100, 0.12, 0.44, mat.boucle, 0.05);
    RX(R, 292, 6, 550, 30, 0.44, 0.82, mat.boucle, 0.07);
    RX(R, 292, 6, 318, 100, 0.44, 0.64, mat.boucle, 0.06);
    RX(R, 524, 6, 550, 100, 0.44, 0.64, mat.boucle, 0.06);
    [[320, 390], [392, 462], [464, 522]].forEach(([a, b]) => RX(R, a, 30, b, 98, 0.44, 0.52, mat.boucle, 0.045));
    RX(R, 326, 28, 372, 42, 0.5, 0.88, mat.knit, 0.06);
    RX(R, 380, 30, 420, 44, 0.5, 0.82, mat.greige, 0.06);
    RX(R, 470, 28, 516, 42, 0.5, 0.88, mat.rust, 0.06);
    RX(R, 520, 30, 552, 96, 0.64, 0.68, mat.knit, 0.02);
    RX(R, 538, 30, 552, 96, 0.38, 0.66, mat.knit, 0.01);
    // dywan wełniany i trawertynowy stolik
    B(R, 300, 108, 548, 268, 0.002, 0.014, mat.rug, { cast: false, uv: 1.2 });
    put(R, new THREE.CylinderGeometry(0.42, 0.42, 0.06, 64), mat.trav, X(421), 0.33, Z(178));
    put(R, new THREE.CylinderGeometry(0.3, 0.32, 0.3, 48), mat.trav, X(421), 0.15, Z(178));
    put(R, lathe([[0, 0], [0.05, 0], [0.06, 0.06], [0.03, 0.14], [0.035, 0.16]]), mat.vaseWhite, X(408), 0.36, Z(170));
    [0, 1, 2].forEach((i) => B(R, 426, 172 + i * 0.1, 450, 188, 0.36 + i * 0.022, 0.38 + i * 0.022, i % 2 ? mat.book1 : mat.book2, { cast: false }));
    // lampa podłogowa przy sofie
    put(R, new THREE.CylinderGeometry(0.13, 0.15, 0.02, 24), mat.black, X(276), 0.01, Z(26));
    rod(R, [X(276), 0.02, Z(26)], [X(276), 1.45, Z(26)], 0.009, mat.black);
    put(R, new THREE.CylinderGeometry(0.17, 0.2, 0.26, 32, 1, true), mat.shade, X(276), 1.52, Z(26), { cast: false });
    // grafiki w dębowych ramach nad sofą
    artFrame(R, 352, 414, 0.3, 1.18, 1.98, mat.art1, 'S', mat.oakl, 0.025, 0.05);
    artFrame(R, 428, 490, 0.3, 1.18, 1.98, mat.art2, 'S', mat.oakl, 0.025, 0.05);
    // ściana TV z lamelami (na ścianie do wyburzenia przy holu)
    const tvw = onWall.hol.odswiezony;
    B(tvw, 440, 296, 566, 299, 0.09, H - 0.002, mat.oakFlute, { uv: 1 });
    B(tvw, 446, 276, 560, 296, 0.34, 0.5, mat.oakl);
    B(tvw, 447, 296, 559, 296.5, 0.3, 0.32, mat.led, { cast: false });
    RX(tvw, 449, 293, 557, 295.5, 0.9, 1.52, mat.black, 0.006);
    plane(tvw, 450, 556, 292.9, 0.92, 1.5, mat.tv, 'N');
    greens(tvw, 548, 286, 0.5, 0.25, mat.vaseWhite, mat.plantLight);
    // oczka w suficie
    [[120, 80], [120, 220], [420, 80], [420, 220]].forEach(([x, y]) => downlight(R, x, y));

    // =================================================================
    // KUCHNIA — STAN OBECNY (fronty i płytki ze zdjęcia)
    // =================================================================
    // korpus dolny + cokół + blat
    B(O, 137, 516, 371, 574, 0, 0.1, mat.wengeMatt);
    B(O, 137, 516, 271, 574, 0.1, 0.86, mat.walnut);
    B(O, 331, 516, 371, 574, 0.1, 0.86, mat.walnut);
    B(O, 137, 512, 271, 574, 0.86, 0.89, mat.counter);
    B(O, 331, 512, 371, 574, 0.86, 0.89, mat.counter);
    // drzwiczki (słoje ze zdjęcia) i uchwyty
    const kd = (p, x1, x2, z1, z2, handleSide) => {
      plane(p, x1 + 0.2, x2 - 0.2, 515.9, z1, z2, mat.kDoor, 'N');
      B(p, x1 + 0.2, 515.9, x2 - 0.2, 516, z1, z2, mat.walnut, { cast: false });
      if (handleSide) {
        const hx = handleSide === 'r' ? x2 - 3.5 : x1 + 3.5;
        put(p, RB(0.012, 0.11, 0.018, 0.004), mat.alu, X(hx), z2 - 0.1, Z(514.6), { cast: false });
      }
    };
    kd(O, 137, 164, 0.12, 0.84, 'r'); kd(O, 164, 191, 0.12, 0.84, 'l');
    kd(O, 191, 231, 0.12, 0.84, 'r'); kd(O, 231, 271, 0.12, 0.84, 'l');
    kd(O, 331, 371, 0.12, 0.64, 'l');
    plane(O, 331.2, 370.8, 515.9, 0.66, 0.84, mat.kDoor, 'N');
    put(O, RB(0.1, 0.012, 0.018, 0.004), mat.alu, X(351), 0.78, Z(514.6), { cast: false });
    // kuchenka wolnostojąca (front ze zdjęcia)
    B(O, 272, 516, 330, 574, 0, 0.86, mat.inox);
    plane(O, 272, 330, 515.9, 0.02, 0.86, mat.kOven, 'N');
    B(O, 272, 516, 330, 574, 0.86, 0.9, mat.blackGloss);
    // zlewozmywak + bateria
    B(O, 198, 518, 264, 568, 0.889, 0.895, mat.inox, { cast: false });
    B(O, 230, 524, 260, 562, 0.81, 0.89, mat.inox, { cast: false });
    B(O, 231, 525, 259, 561, 0.8, 0.893, mat.blackMatt, { cast: false });
    rod(O, [X(246), 0.895, Z(568)], [X(246), 1.08, Z(568)], 0.012, mat.chrome);
    rod(O, [X(246), 1.07, Z(568)], [X(246), 1.07, Z(546)], 0.009, mat.chrome);
    rod(O, [X(246), 1.07, Z(546)], [X(246), 1.03, Z(544)], 0.008, mat.chrome);
    // płytki nad blatem (zdjęcie) + róg na ścianie okna
    plane(O, 137, 371, 573.9, 0.89, 1.45, mat.kBack, 'N');
    // szafki górne: korpus orzech, drzwiczki ze zdjęcia, witryna ze zdjęcia, okap
    B(O, 137, 542, 371, 574, 1.45, 2.06, mat.walnut);
    const ud = (x1, x2) => { plane(O, x1 + 0.2, x2 - 0.2, 541.9, 1.46, 2.05, mat.kDoor, 'N'); };
    ud(137, 165); ud(165, 193); ud(269, 300); ud(300, 332); ud(332, 371);
    plane(O, 193.2, 268.8, 541.9, 1.46, 2.05, mat.kGlass, 'N');
    [[160, 1.52], [170, 1.52], [264, 1.52], [274, 1.52]].forEach(([x, z]) => put(O, RB(0.012, 0.09, 0.018, 0.004), mat.alu, X(x), z, Z(540.6), { cast: false }));
    put(O, RB(0.1, 0.012, 0.018, 0.004), mat.alu, X(300), 1.5, Z(540.6), { cast: false });
    B(O, 270, 532, 331, 574, 1.38, 1.45, mat.inox);
    // lodówka + mikrofalówka
    RX(O, 363, 318, 423, 380, 0, 1.75, mat.inox, 0.012);
    B(O, 362.6, 320, 363, 378, 1.18, 1.19, mat.blackMatt, { cast: false });
    put(O, RB(0.02, 0.36, 0.02, 0.008), mat.chrome, X(361.5), 1.0, Z(372), { cast: false });
    put(O, RB(0.02, 0.2, 0.02, 0.008), mat.chrome, X(361.5), 1.42, Z(372), { cast: false });
    RX(O, 366, 322, 420, 370, 1.75, 2.02, mat.inox, 0.01);
    B(O, 365.6, 324, 366, 356, 1.78, 1.99, mat.blackGloss, { cast: false });
    // stolik barowy przy oknie + hokery
    put(O, new THREE.CylinderGeometry(0.5, 0.5, 0.025, 48), mat.oakl, X(178), 0.92, Z(458), { s: [0.55, 1, 1] });
    [[160, 425], [160, 491], [196, 425], [196, 491]].forEach(([x, y]) => rod(O, [X(x), 0, Z(y)], [X(x), 0.91, Z(y)], 0.012, mat.chrome));
    rod(O, [X(160), 0.25, Z(425)], [X(160), 0.25, Z(491)], 0.008, mat.chrome);
    rod(O, [X(196), 0.25, Z(425)], [X(196), 0.25, Z(491)], 0.008, mat.chrome);
    [[230, 432], [230, 486]].forEach(([x, y]) => {
      put(O, new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32), mat.oakl, X(x), 0.62, Z(y));
      [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([a, b]) => rod(O, [X(x) + a * 1.2, 0, Z(y) + b * 1.2], [X(x) + a * 0.7, 0.61, Z(y) + b * 0.7], 0.009, mat.chrome));
      rod(O, [X(x) + 0.17, 0.62, Z(y) - 0.1], [X(x) + 0.17, 0.95, Z(y) - 0.1], 0.009, mat.chrome);
      rod(O, [X(x) + 0.17, 0.62, Z(y) + 0.1], [X(x) + 0.17, 0.95, Z(y) + 0.1], 0.009, mat.chrome);
      rod(O, [X(x) + 0.17, 0.95, Z(y) - 0.1], [X(x) + 0.17, 0.95, Z(y) + 0.1], 0.012, mat.chrome);
    });
    // tulipany w szklanym wazonie na parapecie
    put(O, new THREE.BoxGeometry(0.09, 0.22, 0.09), mat.clearGlass, X(150), 1.045, Z(470), { cast: false });
    leaves(O, [0, 1, 2, 3, 4, 5, 6].map((i) => [X(150) + (rnd() - 0.5) * 0.08, 1.12 + rnd() * 0.2, Z(470) + (rnd() - 0.5) * 0.08, rnd() * 6, -1 + rnd() * 0.5, 1]), 0.13, mat.plantLight);
    [0, 1, 2, 3, 4].forEach((i) => put(O, new THREE.SphereGeometry(0.022, 10, 8), mat.tulip, X(150) + Math.cos(i * 1.3) * 0.05, 1.36 + rnd() * 0.06, Z(470) + Math.sin(i * 1.3) * 0.05, { s: [1, 1.5, 1], cast: false }));
    // kratka wentylacyjna i plafon
    put(O, new THREE.CylinderGeometry(0.07, 0.07, 0.015, 24), mat.white, X(360), 2.4, Z(573.5), { rx: Math.PI / 2, cast: false });
    put(O, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 32), mat.shade, X(290), H - 0.03, Z(440), { cast: false });

    // =================================================================
    // KUCHNIA — PO ODŚWIEŻENIU (fronty bezuchwytowe, dąb, zellige)
    // =================================================================
    B(R, 137, 518, 371, 574, 0, 0.1, mat.blackMatt);
    B(R, 137, 518, 371, 574, 0.1, 0.87, mat.front);
    [164, 191, 231, 271, 331].forEach((x) => B(R, x - 0.15, 517.6, x + 0.15, 518, 0.1, 0.87, mat.blackMatt, { cast: false }));
    B(R, 137, 517.6, 371, 518, 0.71, 0.715, mat.blackMatt, { cast: false });
    B(R, 135, 512, 371, 574, 0.87, 0.91, mat.oakl);
    // płyta indukcyjna, piekarnik w zabudowie, zlew podblatowy + czarna bateria
    B(R, 278, 520, 326, 566, 0.91, 0.915, mat.blackGloss, { cast: false });
    B(R, 272, 517.5, 330, 518, 0.12, 0.7, mat.blackGloss, { cast: false });
    B(R, 276, 517.2, 326, 517.6, 0.62, 0.65, mat.inox, { cast: false });
    B(R, 205, 524, 255, 562, 0.83, 0.911, mat.blackMatt, { cast: false });
    rod(R, [X(230), 0.91, Z(570)], [X(230), 1.15, Z(570)], 0.013, mat.black);
    rod(R, [X(230), 1.14, Z(570)], [X(230), 1.12, Z(546)], 0.01, mat.black);
    // zellige do sufitu nad blatem
    plane(R, 137, 371, 573.9, 0.91, H - 0.002, mat.zel, 'N', { tile: 0.6 });
    // szafki górne w kolorze frontów + otwarte półki dębowe + LED
    B(R, 137, 540, 252, 574, 1.5, H - 0.002, mat.front);
    B(R, 310, 540, 371, 574, 1.5, H - 0.002, mat.front);
    B(R, 194, 539.6, 195, 540, 1.5, H, mat.blackMatt, { cast: false });
    B(R, 340, 539.6, 341, 540, 1.5, H, mat.blackMatt, { cast: false });
    B(R, 137, 541, 371, 541.5, 1.49, 1.5, mat.led, { cast: false });
    [1.62, 1.96].forEach((z) => B(R, 252, 548, 310, 574, z, z + 0.035, mat.oakl));
    put(R, lathe([[0, 0], [0.05, 0], [0.055, 0.1], [0.05, 0.11]]), mat.vaseWhite, X(265), 1.655, Z(560));
    put(R, lathe([[0, 0], [0.04, 0], [0.045, 0.08]]), mat.vase, X(290), 1.655, Z(560));
    [0, 1, 2].forEach((i) => put(R, new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), mat.ceramic, X(280), 1.997 + i * 0.013, Z(558), { cast: false }));
    // wysoka zabudowa z lodówką
    B(R, 363, 316, 423, 378, 0, H - 0.002, mat.front);
    B(R, 362.6, 318, 363, 376, 1.6, 1.605, mat.blackMatt, { cast: false });
    // blat śniadaniowy pod oknem + 2 hokery
    B(R, 137, 392, 175, 520, 0.9, 0.94, mat.oakl);
    B(R, 172, 396, 175, 400, 0, 0.9, mat.black);
    B(R, 172, 512, 175, 516, 0, 0.9, mat.black);
    [[205, 425], [205, 485]].forEach(([x, y]) => {
      put(R, new THREE.CylinderGeometry(0.18, 0.18, 0.04, 32), mat.boucle, X(x), 0.68, Z(y));
      [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([a, b]) => rod(R, [X(x) + a * 1.1, 0, Z(y) + b * 1.1], [X(x) + a * 0.7, 0.66, Z(y) + b * 0.7], 0.01, mat.oakl));
    });
    greens(R, 150, 470, 0.94, 0.3, mat.vaseWhite, mat.olive);
    // roleta lniana w oknie
    plane(R, 412, 503, 139.5, 1.82, 2.2, mat.linen, 'E');
    [[260, 440], [330, 440]].forEach(([x, y]) => downlight(R, x, y));
    // wyspa (gdy ściana kuchni wyburzona)
    B(island, 198, 338, 372, 404, 0, 0.08, mat.blackMatt);
    B(island, 198, 338, 372, 404, 0.08, 0.9, mat.front);
    B(island, 190, 322, 380, 406, 0.9, 0.94, mat.oakl);
    [[230, 312], [290, 312], [345, 312]].forEach(([x, y]) => {
      put(island, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 32), mat.boucle, X(x), 0.66, Z(y));
      [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(([a, b]) => rod(island, [X(x) + a * 1.1, 0, Z(y) + b * 1.1], [X(x) + a * 0.7, 0.64, Z(y) + b * 0.7], 0.01, mat.oakl));
    });
    pendant(island, 245, 370, 1.65, 0.14, 0.2);
    pendant(island, 325, 370, 1.65, 0.14, 0.2);
    island.visible = false;

    // =================================================================
    // HOL I KORYTARZ
    // =================================================================
    // obecnie: wieszak z lustrem i szafką, szafa wenge
    B(O, 662, 468, 669, 514, 0.02, 1.95, mat.wenge);
    B(O, 642, 466, 669, 516, 1.82, 1.85, mat.wenge);
    [478, 492, 506].forEach((y) => put(O, RB(0.05, 0.015, 0.015, 0.006), mat.alu, X(659), 1.55, Z(y), { cast: false }));
    B(O, 666, 518, 669, 562, 0.86, 1.95, mat.mirror);
    RX(O, 633, 518, 669, 562, 0.02, 0.82, mat.wenge, 0.006);
    put(O, RB(0.012, 0.012, 0.12, 0.004), mat.alu, X(632), 0.7, Z(540), { cast: false });
    RX(O, 437, 318, 497, 410, 0, 2.1, mat.wenge, 0.008);
    B(O, 497, 364, 497.4, 364.4, 0.05, 2.05, mat.blackMatt, { cast: false });
    put(O, RB(0.018, 0.4, 0.018, 0.006), mat.alu, X(498.4), 1.05, Z(358), { cast: false });
    put(O, RB(0.018, 0.4, 0.018, 0.006), mat.alu, X(498.4), 1.05, Z(370), { cast: false });
    track(O, 552, 470, 2, false);
    track(O, 720, 250, 1);
    // po odświeżeniu: biała zabudowa do sufitu, dębowa ławka, okrągłe lustro, wieszaki
    B(R, 437, 316, 499, 412, 0, H - 0.002, mat.whiteMatt);
    B(R, 499, 364, 499.4, 364.4, 0.02, H, mat.blackMatt, { cast: false });
    B(R, 499, 340, 500.5, 341, 0.9, 1.3, mat.black, { cast: false });
    B(R, 499, 387, 500.5, 388, 0.9, 1.3, mat.black, { cast: false });
    B(R, 632, 448, 669, 566, 0.42, 0.46, mat.oakl);
    B(R, 634, 450, 667, 564, 0.06, 0.42, mat.whiteMatt);
    B(R, 666, 448, 669, 566, 1.62, 1.7, mat.oakl);
    [462, 486, 510, 534, 558].forEach((y) => put(R, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), mat.black, X(663), 1.66, Z(y), { rz: Math.PI / 2, cast: false }));
    put(R, new THREE.CylinderGeometry(0.31, 0.31, 0.02, 48), mat.blackMatt, X(667), 1.95, Z(507), { rz: Math.PI / 2 });
    put(R, new THREE.CylinderGeometry(0.29, 0.29, 0.022, 48), mat.mirror, X(667), 1.95, Z(507), { rz: Math.PI / 2, cast: false });
    [[552, 380], [552, 520], [650, 250], [780, 250]].forEach(([x, y]) => downlight(R, x, y));

    // =================================================================
    // ŁAZIENKA
    // =================================================================
    // obecnie: zabudowa WC w akcentowych płytkach, umywalka z szafką wenge, kabina z hydromasażem, pralka
    B(O, 621, 0, 700, 22, 0, 1.2, mat.wallTile2, { uv: 0.6 });
    plane(O, 621, 700, 0.15, 1.2, 2.1, mat.wallTile2, 'S', { tile: 0.6 });
    B(O, 621, 0, 700, 24, 1.2, 1.215, mat.wallTile2, { uv: 0.6 });
    B(O, 652, 22, 668, 22.4, 0.9, 1.0, mat.inox, { cast: false });
    const wc = (p, x, y, ceramicM) => {
      RX(p, x - 18, y, x + 18, y + 54, 0.3, 0.42, ceramicM, 0.06);
      RX(p, x - 17.5, y + 2, x + 17.5, y + 53, 0.42, 0.44, ceramicM, 0.04);
    };
    wc(O, 660, 22, mat.ceramic);
    orchid(O, 645, 12, 1.215);
    RX(O, 706, 2, 766, 44, 0.14, 0.8, mat.wenge, 0.008);
    [[708, 735], [736, 764]].forEach(([a, b]) => B(O, a, 43.8, b, 44.2, 0.17, 0.76, mat.wengeMatt, { cast: false }));
    [[729, 0.7], [743, 0.7]].forEach(([x, z]) => put(O, RB(0.06, 0.012, 0.018, 0.004), mat.alu, X(x), z, Z(45.2), { cast: false }));
    [[708, 4], [764, 4], [708, 40], [764, 40]].forEach(([x, y]) => B(O, x - 1, y - 1, x + 1, y + 1, 0, 0.14, mat.alu));
    RX(O, 703, 0, 769, 47, 0.8, 0.87, mat.ceramic, 0.03);
    rod(O, [X(736), 0.87, Z(8)], [X(736), 0.99, Z(8)], 0.012, mat.chrome);
    rod(O, [X(736), 0.98, Z(8)], [X(736), 0.97, Z(20)], 0.008, mat.chrome);
    B(O, 711, 0, 761, 2.5, 1.15, 1.82, mat.wenge);
    B(O, 714, 2.5, 758, 2.7, 1.18, 1.79, mat.mirror, { cast: false });
    rod(O, [X(736), 1.88, Z(0)], [X(736), 1.88, Z(8)], 0.01, mat.chrome);
    put(O, new THREE.SphereGeometry(0.03, 12, 8), mat.bulb, X(736), 1.86, Z(8), { cast: false });
    // kabina półokrągła 90 × 90
    const sh = new THREE.Group();
    sh.position.set(X(856), 0, Z(0));
    O.add(sh);
    const tray = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 40, 1, false, -Math.PI / 2, Math.PI / 2);
    put(sh, tray, mat.ceramic, 0, 0.11, 0);
    put(sh, new THREE.CylinderGeometry(0.87, 0.87, 1.95, 40, 1, true, -Math.PI / 2, Math.PI / 2), mat.showerGlass, 0, 1.2, 0, { cast: false, noAO: true });
    put(sh, new THREE.TorusGeometry(0.87, 0.012, 6, 40, Math.PI / 2), mat.alu, 0, 2.17, 0, { rx: Math.PI / 2, rz: Math.PI / 2, cast: false });
    put(sh, new THREE.TorusGeometry(0.87, 0.012, 6, 40, Math.PI / 2), mat.alu, 0, 0.23, 0, { rx: Math.PI / 2, rz: Math.PI / 2, cast: false });
    [0.25, 0.75].forEach((t) => {
      const a = Math.PI + t * (Math.PI / 2);
      put(sh, new THREE.BoxGeometry(0.03, 1.95, 0.03), mat.alu, Math.cos(a) * 0.87, 1.2, -Math.sin(a) * 0.87, { cast: false });
    });
    B(O, 766, 0.2, 856, 1.5, 0.22, 2.18, mat.blackGloss);
    B(O, 854.5, 0, 856, 90, 0.22, 2.18, mat.blackGloss);
    put(O, new THREE.CylinderGeometry(0.9, 0.9, 0.02, 40, 1, false, -Math.PI / 2, Math.PI / 2), mat.whiteMatt, X(856), 2.19, Z(0), { cast: false });
    put(O, new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), mat.blackGloss, X(822), 2.175, Z(34), { cast: false });
    [1.0, 1.15, 1.3, 1.45].forEach((z) => put(O, new THREE.CylinderGeometry(0.02, 0.02, 0.01, 14), mat.chrome, X(820), z, Z(1.6), { rx: Math.PI / 2, cast: false }));
    rod(O, [X(840), 0.9, Z(1.6)], [X(840), 1.7, Z(1.6)], 0.01, mat.chrome);
    put(O, new THREE.CylinderGeometry(0.045, 0.035, 0.03, 16), mat.chrome, X(840), 1.72, Z(6), { rx: 1.0, cast: false });
    // pralka (front w stronę drzwi) + szafka nad nią
    RX(O, 582, 118, 640, 178, 0, 0.85, mat.white, 0.015);
    put(O, new THREE.TorusGeometry(0.17, 0.035, 12, 32), mat.white, X(640.5), 0.42, Z(148), { ry: Math.PI / 2, cast: false });
    put(O, new THREE.CircleGeometry(0.15, 32), mat.blackGloss, X(640.4), 0.42, Z(148), { ry: Math.PI / 2, cast: false });
    B(O, 640, 122, 640.5, 174, 0.7, 0.82, mat.ceramic, { cast: false });
    put(O, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), mat.alu, X(641), 0.76, Z(132), { rz: Math.PI / 2, cast: false });
    RX(O, 582, 112, 614, 172, 1.45, 2.05, mat.wenge, 0.008);
    put(O, RB(0.018, 0.016, 0.12, 0.004), mat.alu, X(615), 1.52, Z(142), { cast: false });
    // grzejnik drabinkowy, kosz na pranie
    [0.95, 1.15, 1.35, 1.55, 1.75].forEach((z) => rod(O, [X(600), z, Z(187)], [X(650), z, Z(187)], 0.012, mat.white));
    rod(O, [X(600), 0.9, Z(187)], [X(600), 1.85, Z(187)], 0.015, mat.white);
    rod(O, [X(650), 0.9, Z(187)], [X(650), 1.85, Z(187)], 0.015, mat.white);
    RX(O, 800, 140, 846, 186, 0, 0.55, mat.whiteMatt, 0.03);
    [[650, 95], [720, 95], [790, 95]].forEach(([x, y]) => downlight(fixed, x, y, mat.bulb));

    // po odświeżeniu: spiek na ścianach (nakładki), prysznic walk-in, szafka dębowa wisząca, lustro LED
    const bw = [[582, 0.2, 856, 'S', 0], [582, 189.8, 856, 'N', 0]];
    plane(R, 621.2, 855.8, 0.25, 0.0, H - 0.002, mat.stoneWall, 'S', { tile: 1.2 });
    plane(R, 582.2, 674.8, 189.75, 0.0, H - 0.002, mat.stoneWall, 'N', { tile: 1.2 });
    plane(R, 755.2, 855.8, 189.75, 0.0, H - 0.002, mat.stoneWall, 'N', { tile: 1.2 });
    plane(R, 0.2, 189.8, 582.25, 0.0, H - 0.002, mat.stoneWall, 'E', { tile: 1.2 });
    plane(R, 0.2, 189.8, 855.75, 0.0, H - 0.002, mat.stoneWall, 'W', { tile: 1.2 });
    void bw;
    B(R, 582, 0, 621.2, 71.2, 0, H - 0.002, mat.stoneWall, { uv: 1.2 });
    B(R, 621, 0, 700, 22.5, 0, 1.2, mat.stoneWall, { uv: 1.2 });
    B(R, 621, 0, 700, 24, 1.2, 1.23, mat.oakl);
    B(R, 652, 22.5, 668, 22.9, 0.9, 1.0, mat.black, { cast: false });
    wc(R, 660, 22.5, mat.ceramic);
    greens(R, 640, 12, 1.23, 0.25, mat.vaseWhite, mat.plantLight);
    B(R, 704, 0.25, 792, 48, 0.44, 0.78, mat.oakl);
    B(R, 704, 0.25, 792, 48, 0.78, 0.8, mat.stoneWall);
    RX(R, 728, 8, 768, 40, 0.8, 0.94, mat.ceramic, 0.02);
    B(R, 744, 0.25, 752, 4, 1.02, 1.05, mat.black, { cast: false });
    rod(R, [X(748), 1.035, Z(3)], [X(748), 1.035, Z(16)], 0.008, mat.black);
    put(R, new THREE.CylinderGeometry(0.36, 0.36, 0.02, 64), mat.led, X(748), 1.55, Z(0.6), { rx: Math.PI / 2, cast: false });
    put(R, new THREE.CylinderGeometry(0.34, 0.34, 0.024, 64), mat.mirror, X(748), 1.55, Z(1.2), { rx: Math.PI / 2, cast: false });
    // walk-in: szyba z czarnym profilem, deszczownica
    B(R, 798, 2, 799.2, 110, 0.0, 2.0, mat.clearGlass, { cast: false, noAO: true });
    B(R, 797.5, 2, 799.7, 110, 1.99, 2.01, mat.black, { cast: false });
    B(R, 797.5, 108.5, 799.7, 110, 0.0, 2.0, mat.black, { cast: false });
    rod(R, [X(855.5), 2.1, Z(55)], [X(830), 2.1, Z(55)], 0.01, mat.black);
    B(R, 818, 43, 842, 67, 2.08, 2.095, mat.black, { cast: false });
    B(R, 855.4, 45, 855.7, 65, 1.0, 1.2, mat.black, { cast: false });
    B(R, 830, 100, 852, 104, 0.004, 0.008, mat.inox, { cast: false });
    // pralka pod dębowym blatem, półka z ręcznikami
    RX(R, 582, 118, 640, 178, 0, 0.85, mat.white, 0.015);
    put(R, new THREE.TorusGeometry(0.17, 0.035, 12, 32), mat.white, X(640.5), 0.42, Z(148), { ry: Math.PI / 2, cast: false });
    put(R, new THREE.CircleGeometry(0.15, 32), mat.blackGloss, X(640.4), 0.42, Z(148), { ry: Math.PI / 2, cast: false });
    B(R, 582, 112, 646, 186, 0.86, 0.9, mat.oakl);
    B(R, 582, 112, 612, 186, 1.5, 1.53, mat.oakl);
    [[588, 1.53], [588, 1.6]].forEach(([x, z], i) => RX(R, x, 122 + i * 2, x + 22, 176 - i * 2, z, z + 0.065, i ? mat.linen : mat.greige, 0.02));
    [0.9, 1.1, 1.3, 1.5, 1.7].forEach((z) => rod(R, [X(605), z, Z(187)], [X(655), z, Z(187)], 0.01, mat.black));
    rod(R, [X(605), 0.85, Z(187)], [X(605), 1.8, Z(187)], 0.013, mat.black);
    rod(R, [X(655), 0.85, Z(187)], [X(655), 1.8, Z(187)], 0.013, mat.black);
    put(R, lathe([[0, 0], [0.2, 0], [0.23, 0.5], [0.22, 0.52], [0, 0.52]]), mat.basket, X(822), 0, Z(160));

    // =================================================================
    // SYPIALNIA — STAN OBECNY (wg zdjęć)
    // =================================================================
    const fBed = furnFrom();
    // łóżko: rama wenge, szaro-niebieski koc, poduszki (turkus, beż), futrzany pled
    RX(O, 871, 4, 1076, 168, 0.08, 0.3, mat.wenge, 0.01);
    B(O, 868, 4, 875, 168, 0.08, 0.62, mat.wenge);
    RX(O, 874, 7, 1074, 165, 0.3, 0.5, mat.plush, 0.05);
    RX(O, 1000, 4, 1080, 168, 0.36, 0.52, mat.plush, 0.03);
    RX(O, 878, 12, 914, 74, 0.48, 0.72, mat.beigePlush, 0.07);
    RX(O, 878, 92, 914, 156, 0.48, 0.72, mat.beigePlush, 0.07);
    RX(O, 900, 22, 932, 70, 0.48, 0.66, mat.teal, 0.06);
    RX(O, 900, 100, 932, 148, 0.48, 0.66, mat.teal, 0.06);
    RX(O, 880, 40, 960, 130, 0.5, 0.56, mat.fur, 0.03);
    // półka nad łóżkiem
    B(O, 985, 0, 1088, 22, 1.56, 1.59, mat.wenge);
    [1005, 1068].forEach((x) => {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(X(x), 1.4, Z(0)), new THREE.Vector3(X(x), 1.45, Z(18)), new THREE.Vector3(X(x), 1.56, Z(20)));
      put(O, new THREE.TubeGeometry(c, 10, 0.006, 6), mat.chrome, 0, 0, 0, { cast: false });
    });
    // stolik Singer przy grzejniku
    B(O, 1296, 4, 1372, 44, 0.72, 0.75, mat.walnut);
    [1300, 1366].forEach((x) => {
      B(O, x, 8, x + 3, 40, 0.06, 0.72, mat.black);
      put(O, new THREE.TorusGeometry(0.12, 0.012, 8, 24), mat.black, X(x + 1.5), 0.3, Z(24), { ry: Math.PI / 2, cast: false });
    });
    B(O, 1302, 10, 1366, 38, 0.06, 0.08, mat.black);
    pampas(O, 1334, 24, 0.75, 0.75, mat.pampasDark);
    // szafa w narożniku i komoda (wenge z aluminiową listwą)
    RX(O, 1290, 240, 1385, 298, 0, 1.95, mat.wenge, 0.02);
    B(O, 1337, 239.6, 1338, 240, 0.05, 1.9, mat.blackMatt, { cast: false });
    [1333, 1342].forEach((x) => put(O, RB(0.016, 0.22, 0.02, 0.006), mat.alu, X(x), 1.05, Z(238.8), { cast: false }));
    B(O, 1290, 239, 1385, 240, 1.93, 1.95, mat.alu, { cast: false });
    RX(O, 1110, 256, 1262, 298, 0, 0.84, mat.wenge, 0.02);
    B(O, 1110, 255, 1262, 256, 0.82, 0.84, mat.alu, { cast: false });
    [0.16, 0.33, 0.5, 0.67].forEach((z) => {
      B(O, 1152, 255.4, 1220, 256, z - 0.002, z + 0.002, mat.blackMatt, { cast: false });
      put(O, RB(0.14, 0.012, 0.016, 0.004), mat.alu, X(1186), z + 0.07, Z(254.8), { cast: false });
    });
    [1150, 1222].forEach((x) => put(O, RB(0.014, 0.18, 0.016, 0.004), mat.alu, X(x + (x < 1186 ? -6 : 6)), 0.5, Z(254.8), { cast: false }));
    greens(O, 1140, 277, 0.84, 0.45, mat.vaseWhite, mat.plant);
    put(O, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 20, 1, true), mat.clearGlass, X(1235), 0.99, Z(277), { cast: false });
    put(O, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), mat.whiteMatt, X(1235), 0.88, Z(277));
    artFrame(O, 1150, 1215, 299, 1.4, 2.0, mat.art, 'N', mat.alu, 0.02, 0.08);
    markFurn(fBed);
    track(O, 1130, 150);

    // =================================================================
    // SYPIALNIA — PO ODŚWIEŻENIU
    // =================================================================
    // lamele dębowe za zagłówkiem
    B(R, 868, 0.2, 872, 205, 0.09, H - 0.002, mat.oakFlute, { uv: 1 });
    // łóżko tapicerowane, pościel lniana, oliwkowy pled
    RX(R, 872, 4, 1082, 168, 0.06, 0.32, mat.greige, 0.03);
    RX(R, 872, 2, 886, 170, 0.06, 1.12, mat.boucle, 0.04);
    RX(R, 884, 8, 1078, 164, 0.32, 0.52, mat.linen, 0.06);
    RX(R, 1010, 4, 1084, 168, 0.4, 0.55, mat.knit, 0.03);
    RX(R, 888, 14, 922, 78, 0.5, 0.76, mat.linen, 0.07);
    RX(R, 888, 92, 922, 156, 0.5, 0.76, mat.linen, 0.07);
    RX(R, 912, 30, 940, 72, 0.5, 0.68, mat.knit, 0.06);
    RX(R, 912, 100, 940, 142, 0.5, 0.68, mat.rust, 0.06);
    // stolik nocny, kinkiet
    B(R, 874, 172, 912, 206, 0.42, 0.45, mat.oakl);
    B(R, 874, 172, 912, 206, 0.3, 0.42, mat.whiteMatt);
    rod(R, [X(872.5), 1.3, Z(196)], [X(890), 1.3, Z(196)], 0.006, mat.black);
    put(R, new THREE.CylinderGeometry(0.08, 0.1, 0.14, 24, 1, true), mat.shade, X(892), 1.25, Z(196), { cast: false });
    // dywan, fotel bouclé, monstera, lampa
    B(R, 960, 18, 1210, 232, 0.002, 0.014, mat.rug, { cast: false, uv: 1.2 });
    RX(R, 1290, 30, 1358, 98, 0.02, 0.42, mat.boucle, 0.12);
    RX(R, 1290, 30, 1358, 46, 0.42, 0.78, mat.boucle, 0.08);
    RX(R, 1290, 46, 1304, 98, 0.42, 0.62, mat.boucle, 0.07);
    RX(R, 1344, 46, 1358, 98, 0.42, 0.62, mat.boucle, 0.07);
    monstera(R, 1366, 128);
    // zasłony na szynie
    put(R, new THREE.BoxGeometry(0.03, 0.02, 2.95), mat.whiteMatt, X(1364), H - 0.02, Z(150), { cast: false });
    curtain(R, 2, 70, 1364, 0.06, H - 0.04, mat.linen, 'W', 6, 0.04);
    curtain(R, 236, 298, 1364, 0.06, H - 0.04, mat.linen, 'W', 6, 0.04);
    curtain(R, 70, 236, 1360, 0.06, H - 0.04, mat.sheer, 'W', 10, 0.025);
    // zabudowa szafy do sufitu z lamelami
    B(R, 1060, 237, 1290, 299, 0, H - 0.002, mat.oakFlute, { uv: 1 });
    [1117, 1175, 1233].forEach((x) => B(R, x - 0.2, 236.6, x + 0.2, 237, 0.02, H - 0.02, mat.blackMatt, { cast: false }));
    // półka z grafikami nad łóżkiem
    B(R, 930, 0, 1060, 9, 1.42, 1.45, mat.oakl);
    const leanArt = (x, w, h, m) => {
      const a = RX(R, x, 2, x + w, 4, 1.45, 1.45 + h, mat.oakl, 0.004);
      plane(R, x + 1.5, x + w - 1.5, 4.05, 1.465, 1.435 + h, m, 'S');
      return a;
    };
    leanArt(942, 42, 0.52, mat.art1);
    leanArt(992, 34, 0.42, mat.art2);
    greens(R, 1046, 5, 1.45, 0.22, mat.vaseWhite, mat.olive);
    pendant(R, 1130, 140, 1.95, 0.3, 0.18);
    [[960, 80], [1250, 230]].forEach(([x, y]) => downlight(R, x, y));

    // =================================================================
    // NA ZEWNĄTRZ: widok za oknami (zdjęcie podwórka osiedla), niebo / tło makiety
    // =================================================================
    const skyU = {
      top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
      sTop: { value: new THREE.Color() }, sBot: { value: new THREE.Color() }, walk: { value: 0 },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sTop; uniform vec3 sBot; uniform float walk; varying vec3 vP; void main(){ float h = vP.y; vec3 s = h > 0.0 ? mix(mid, top, pow(clamp(h*1.7,0.0,1.0), 0.7)) : mix(mid, bot, clamp(-h*6.0,0.0,1.0)); vec3 st = mix(sBot, sTop, smoothstep(-0.6, 0.7, h)); gl_FragColor = vec4(mix(st, s, walk), 1.0); }',
    }));
    sky.renderOrder = -2;
    sky.userData.noAO = true;
    scene.add(sky);
    const pano = window.ZB_PANO;
    const PR = 600;
    const panoMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.BackSide });
    const panoLights = new THREE.Group();
    if (pano) {
      const t = new THREE.TextureLoader().load(pano.src, () => { dirty = true; envDirty = true; });
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.MirroredRepeatWrapping;
      t.anisotropy = aniso;
      panoMat.map = t;
      const segs = Math.max(2, Math.round((Math.PI * 2) / pano.span / 2) * 2);
      const segSpan = (Math.PI * 2) / segs;
      t.repeat.set(segs, 1);
      t.offset.set(1 - pano.phiCenter - Math.PI / segSpan, 0);
      const hgt = PR * (pano.tTop - pano.tBot);
      const m = put(outside, new THREE.CylinderGeometry(PR, PR, hgt, 96, 1, true), panoMat, 0, EYE + (PR * (pano.tTop + pano.tBot)) / 2, 0, { cast: false, receive: false, noAO: true });
      m.renderOrder = -1;
    }
    // elewacja budynku pod mieszkaniem (widoczna przy spojrzeniu w dół)
    put(outside, new THREE.BoxGeometry(15.4, 9, 6.6), mat.render, X(694), -4.8, Z(287), { cast: false, noAO: true });
    outside.visible = false;

    // =================================================================
    // ŚWIATŁA
    // =================================================================
    const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x7b6e62, 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1de, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(HQ ? 4096 : 2048, HQ ? 4096 : 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 80 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    sun.target.position.set(X(700), 0, Z(290));
    scene.add(sun, sun.target);
    // światło z okien (prostokątne)
    // telefon: tylko 5 największych okien i 4 lampy (mniej obliczeń na piksel)
    const winForLight = HQ ? windowLights : [...windowLights].sort((p, q) => q.len * (q.top - q.sill) - p.len * (p.top - p.sill)).slice(0, 5);
    const rectLights = winForLight.map((w) => {
      const l = new THREE.RectAreaLight(0xe9f0ff, 0, w.len, w.top - w.sill);
      l.position.set(w.cx, (w.sill + w.top) / 2, w.cz);
      if (w.vertical) l.lookAt(w.cx - w.out, (w.sill + w.top) / 2, w.cz);
      else l.lookAt(w.cx, (w.sill + w.top) / 2, w.cz - w.out);
      scene.add(l);
      return l;
    });
    // lampy (wieczór/noc)
    const lampDefs = [[200, 150, 2.32, 0.8], [430, 150, 2.32, 0.8], [1130, 150, 2.32, 0.9], [290, 440, 2.4, 0.6], [552, 470, 2.4, 0.5], [720, 250, 2.4, 0.35], [720, 95, 2.45, 0.5]];
    const lamps = lampDefs.map(([x, y, h, k]) => {
      const l = new THREE.PointLight(0xffc988, 0, 7.5, 2);
      l.position.set(X(x), h, Z(y));
      l.userData.k = k;
      scene.add(l);
      return l;
    });

    // pory dnia: [stan dla makiety, stan dla spaceru]
    const sunDir = (bearing, elev) => new THREE.Vector3(Math.sin(bearing) * Math.cos(elev), Math.sin(elev), -Math.cos(bearing) * Math.cos(elev));
    const C = (v) => new THREE.Color(v);
    const dayLight = {
      sun: C(0xfff0d8), sunI: 4.2, dir: sunDir(1.95, 0.52), hemiS: C(0xe4ecf4), hemiG: C(0x8a7a68), hemiDoll: 1.25, hemiWalk: 0.45, rect: 2.6, rectC: C(0xeef3ff), env: 0.95, envWalk: 0.8,
      lamp: 4, bulb: 0.9, fire: 0, led: 0.6, city: 0, exp: 1.12, top: C(0x8fb6e0), mid: C(window.ZB_PANO ? window.ZB_PANO.top : 0xc8dbe9), bot: C(window.ZB_PANO ? window.ZB_PANO.bot : 0x8e8a80), sTop: C(0xffffff), sBot: C(0xebe8e3), pano: C(0xffffff),
    };
    const TIMES = { day: dayLight, sunset: dayLight, night: dayLight };
    let litFrom = null;
    let litTo = TIMES.day;
    let litT = 1;
    let walkMix = 0; // 0 = makieta, 1 = spacer
    const lerpC = (a, b, t) => a.clone().lerp(b, t);
    const L2 = (a, b, t) => a + (b - a) * t;
    const mixTimes = (a, b, t) => {
      const o = {};
      for (const k in b) o[k] = b[k] instanceof THREE.Color ? lerpC(a[k], b[k], t) : b[k] instanceof THREE.Vector3 ? a[k].clone().lerp(b[k], t).normalize() : L2(a[k], b[k], t);
      return o;
    };
    let envScale = 1;
    function applyLight() {
      const s = litFrom ? mixTimes(litFrom, litTo, ease(litT)) : litTo;
      const w = walkMix;
      sun.color.copy(s.sun);
      sun.intensity = s.sunI;
      sun.position.copy(sun.target.position).addScaledVector(s.dir, 40);
      hemi.color.copy(s.hemiS);
      hemi.groundColor.copy(s.hemiG);
      hemi.intensity = L2(s.hemiDoll, s.hemiWalk, w);
      rectLights.forEach((l) => { l.intensity = s.rect * L2(0.35, 1, w); l.color.copy(s.rectC); });
      envScale = L2(s.env, s.envWalk, w);
      mats.forEach((m) => (m.envMapIntensity = envScale * m.userData.env));
      lamps.forEach((l) => (l.intensity = s.lamp * l.userData.k));
      mat.bulb.emissiveIntensity = s.bulb;
      mat.fire.emissiveIntensity = s.fire;
      mat.led.emissiveIntensity = s.led;
      renderer.toneMappingExposure = s.exp;
      skyU.top.value.copy(s.top);
      skyU.mid.value.copy(s.mid);
      skyU.bot.value.copy(s.bot);
      skyU.sTop.value.copy(s.sTop);
      skyU.sBot.value.copy(s.sBot);
      skyU.walk.value = w;
      panoMat.opacity = w;
      panoMat.color.copy(s.pano);
      if (panoLights.children[0]) panoLights.children[0].material.opacity = s.city * w;
      outside.visible = w > 0.01;
      mat.shadowDecal.opacity = 1 - w;
      shadowsDirty();
      dirty = true;
    }
    const setTime = (id, instant) => {
      const target = TIMES[id] || TIMES.day;
      if (instant || reduce) { litFrom = null; litTo = target; litT = 1; }
      else { litFrom = litFrom ? mixTimes(litFrom, litTo, ease(litT)) : litTo; litTo = target; litT = 0; }
      applyLight();
      envDirty = true;
    };

    // ---------- odbicia i światło odbite z wnętrza (CubeCamera → PMREM) ----------
    const cubeRT = new THREE.WebGLCubeRenderTarget(HQ ? 256 : 128, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(0.05, 2000, cubeRT);
    cubeCam.position.set(X(300), 1.4, Z(150));
    let envTex = null;
    let envDirty = true;
    function captureEnv() {
      envDirty = false;
      const keep = { c: ceiling.visible, o: outside.visible, sp: spotsGroup.visible, w: walkMix };
      ceiling.visible = true;
      spotsGroup.visible = false;
      walkMix = 1;
      applyLight();
      outside.visible = true;
      const prev = scene.environment;
      scene.environment = studioEnv;
      cubeCam.update(renderer, scene);
      const t = pmrem.fromCubemap(cubeRT.texture).texture;
      if (envTex) envTex.dispose();
      envTex = t;
      scene.environment = envTex;
      void prev;
      ceiling.visible = keep.c;
      spotsGroup.visible = keep.sp;
      walkMix = keep.w;
      applyLight();
      outside.visible = keep.o && walkMix > 0.01;
      dirty = true;
    }

    // ---------- konfiguracja ----------
    // Każdy wariant wnętrza ma własne kopie materiałów z płaszczyzną cięcia: dzięki temu można pokazać
    // przejście „przed → po” (fala przemiany) i porównanie suwakiem bez przebudowy sceny.
    renderer.localClippingEnabled = true;
    const planeO = new THREE.Plane(new THREE.Vector3(0, 0, 0), 1);
    const planeR = new THREE.Plane(new THREE.Vector3(0, 0, 0), 1);
    const variants = new Map();
    const clipGroup = (g, pl) => {
      const local = new Map();
      const one = (m) => {
        if (!m || m.isShaderMaterial || m === mat.shadowDecal) return m;
        if (!local.has(m)) {
          const c = m.clone();
          c.clippingPlanes = [pl];
          c.clipShadows = true;
          c.userData = { ...m.userData };
          mats.push(c);
          if (!variants.has(m)) variants.set(m, []);
          variants.get(m).push(c);
          local.set(m, c);
        }
        return local.get(m);
      };
      g.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); });
    };
    clipGroup(styles.obecny, planeO);
    clipGroup(onWall.kuchnia.obecny, planeO);
    clipGroup(onWall.hol.obecny, planeO);
    clipGroup(styles.odswiezony, planeR);
    clipGroup(onWall.kuchnia.odswiezony, planeR);
    clipGroup(onWall.hol.odswiezony, planeR);
    clipGroup(island, planeR);
    const upd = (m, fn) => { fn(m); (variants.get(m) || []).forEach(fn); };

    // podłogi drewniane: ta sama geometria (UV w metrach), różne tekstury
    const FLOORS = {
      panele: { map: TX.lam, n: TX.lamN, r: TX.lamR, ns: 0.55 },
      jasny: { map: TX.laml, n: TX.lamN, r: TX.lamR, ns: 0.45 },
      jodelka: { map: TX.jod, n: TX.jodN, r: TX.jodR, ns: 0.5 },
    };
    const setFloor = (m, id) => {
      const f = FLOORS[id] || FLOORS.panele;
      upd(m, (x) => { x.map = f.map; x.normalMap = f.n; x.roughnessMap = f.r; x.normalScale.set(f.ns, f.ns); x.needsUpdate = true; });
    };
    const wallColor = (id, room) => {
      if (!id || id === 'bez') return ROOM_PAINT[room];
      return (PH.config.sciany.find((w) => w.id === id) || PH.config.sciany[0]).color;
    };
    const PAINT_ROOMS = [[mat.paintL, 'salon'], [mat.paintB, 'sypialnia'], [mat.paintK, 'kuchnia'], [mat.paintH, 'przedpokoj']];
    const setFronts = (id) => {
      const k = PH.config.kuchnia.find((w) => w.id === id) || PH.config.kuchnia[0];
      // stan obecny: fronty ze zdjęcia albo nowe fronty w kolorze; po odświeżeniu: zawsze kolor
      upd(mat.kDoor, (x) => { if (k.id === 'braz') { x.map = TX.kDoor; x.color.set(0xffffff); x.roughness = 0.42; } else { x.map = null; x.color.set(k.color); x.roughness = k.id === 'biel' ? 0.35 : 0.5; } x.needsUpdate = true; });
      upd(mat.front, (x) => { x.color.set(k.id === 'braz' ? 0x7a4a33 : k.color); x.roughness = k.id === 'biel' ? 0.35 : 0.55; });
    };
    // stan wizualny każdego wariantu
    const looks = { obecny: { sciany: 'bez', podloga: 'panele' }, odswiezony: { sciany: 'biel', podloga: 'jodelka' } };
    let shownStyle = 'obecny';
    const applyLooks = () => {
      PAINT_ROOMS.forEach(([m, room]) => {
        m.color.set(wallColor(looks.obecny.sciany, room));
        m.userData.colB.set(wallColor(looks.odswiezony.sciany, room));
      });
      setFloor(mat.floorO, looks.obecny.podloga);
      setFloor(mat.floorR, looks.odswiezony.podloga);
    };

    // ---------- przejście i porównanie ----------
    const trans = { active: false, t: 0, dur: 2.2, to: 'odswiezony', walk: false, f: new THREE.Vector3(), c: new THREE.Vector3(), a: 0, b: 1 };
    const cmp = { on: false, u: 0.5 };
    const tv = new THREE.Vector3();
    const tUp = new THREE.Vector3();
    const tDir = new THREE.Vector3();
    const passAll = (pl) => { pl.normal.set(0, 0, 0); pl.constant = 1; };
    const setPlanes = (n, c) => {
      planeO.normal.copy(n);
      planeO.constant = c;
      planeR.normal.copy(n).negate();
      planeR.constant = -c;
      cut.plane.set(n.x, n.y, n.z, c);
    };
    const restPlanes = () => {
      passAll(planeO);
      passAll(planeR);
      cut.plane.set(0, 0, 0, shownStyle === 'odswiezony' ? -1 : 1);
    };
    const stylesVisible = () => {
      const both = trans.active || cmp.on;
      styles.obecny.visible = both || shownStyle === 'obecny';
      styles.odswiezony.visible = both || shownStyle === 'odswiezony';
      Object.values(onWall).forEach((w) => { w.obecny.visible = styles.obecny.visible; w.odswiezony.visible = styles.odswiezony.visible; });
      const st = wallState.kuchnia;
      island.visible = styles.odswiezony.visible && st && st.v < 0.995;
    };
    const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const CORNERS = [[-25, -25], [1496, -25], [-25, 599], [1496, 599]].map(([x, y]) => new THREE.Vector3(X(x), 0, Z(y)));
    function startSweep(to) {
      trans.to = to;
      trans.t = 0;
      trans.walk = mode === 'walk';
      camera.getWorldDirection(tv);
      tv.y = 0;
      if (tv.lengthSq() < 1e-6) tv.set(0, 0, -1);
      tv.normalize();
      if (trans.walk) {
        trans.f.copy(tv);
        trans.c.copy(camera.position);
        trans.a = -0.4;
        trans.b = 13;
      } else {
        // od lewej do prawej krawędzi ekranu
        trans.f.set(-tv.z, 0, tv.x);
        trans.c.set(0, 0, 0);
        const d = CORNERS.map((p) => p.dot(trans.f));
        trans.a = Math.min(...d) - 0.3;
        trans.b = Math.max(...d) + 0.3;
      }
      trans.active = true;
      stylesVisible();
    }
    function updateCut(dt) {
      if (trans.active) {
        trans.t = Math.min(1, trans.t + dt / trans.dur);
        const s = trans.a + (trans.b - trans.a) * easeIO(trans.t);
        const base = trans.f.dot(trans.c);
        // strona „obecnie” ma d ≥ 0
        if (trans.to === 'odswiezony') setPlanes(trans.f, -base - s);
        else { tv.copy(trans.f).negate(); setPlanes(tv, base + s); }
        shadowsDirty();
        if (trans.t >= 1) {
          trans.active = false;
          restPlanes();
          stylesVisible();
          envDirty = true;
          emit({ sweep: false });
        }
        return true;
      }
      if (cmp.on) {
        // płaszczyzna przez kamerę i pionową linię ekranu x = u: po lewej „przed”, po prawej „po”
        tDir.set(cmp.u * 2 - 1, 0, 0.5).unproject(camera).sub(camera.position).normalize();
        tUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        tv.crossVectors(tUp, tDir).normalize();
        setPlanes(tv, -tv.dot(camera.position));
        return true;
      }
      return false;
    }
    function setCompare(on, u) {
      if (typeof u === 'number') cmp.u = Math.max(0, Math.min(1, u));
      if (on !== undefined && on !== cmp.on) {
        cmp.on = !!on;
        if (cmp.on) trans.active = false;
        if (!cmp.on) restPlanes();
        stylesVisible();
        shadowsDirty();
        envDirty = !cmp.on;
      }
      dirty = true;
    }

    const applyCfg = (p) => {
      const prevStyle = shownStyle;
      if (p.styl) {
        const st = p.styl === 'puste' ? 'obecny' : p.styl;
        styles.obecny.userData.empty = p.styl === 'puste';
        shownStyle = st;
      }
      if (p.sciany) looks[shownStyle].sciany = p.sciany;
      if (p.podloga) looks[shownStyle].podloga = p.podloga;
      if (p.kuchnia) setFronts(p.kuchnia);
      applyLooks();
      // „puste”: bez mebli (zostaje kuchnia, łazienka i podłogi)
      const empty = !!styles.obecny.userData.empty;
      styles.obecny.children.forEach((c) => { if (c.userData.furniture) c.visible = !empty; });
      onWall.hol.obecny.children.forEach((c) => { if (c.userData.furniture) c.visible = !empty; });
      if (shownStyle !== prevStyle && !reduce && !cmp.on) startSweep(shownStyle);
      else if (!trans.active) restPlanes();
      stylesVisible();
      if (p.time) setTime(p.time);
      envDirty = true;
      shadowsDirty();
      dirty = true;
    };

    // ---------- wyburzanie ścian: sprężyna (ściana zapada się w podłogę) + pył ----------
    const wallState = {};
    Object.keys(demo).forEach((id) => { wallState[id] = { v: 1, vel: 0, target: 1 }; });
    const dust = new THREE.Group();
    scene.add(dust);
    const bursts = [];
    function burst(id) {
      const box = new THREE.Box3();
      demo[id].children.filter((c) => c.isMesh).forEach((c) => box.expandByObject(c));
      const n = 260;
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = box.min.x + rnd() * (box.max.x - box.min.x);
        pos[i * 3 + 1] = rnd() * H * 0.9;
        pos[i * 3 + 2] = box.min.z + rnd() * (box.max.z - box.min.z);
        vel[i * 3] = (rnd() - 0.5) * 0.9;
        vel[i * 3 + 1] = 0.1 + rnd() * 0.5;
        vel[i * 3 + 2] = (rnd() - 0.5) * 0.9;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xe2dbcf, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false });
      const pts = new THREE.Points(g, m);
      dust.add(pts);
      bursts.push({ pts, vel, t: 0 });
    }
    function applyWallScale(id) {
      const st = wallState[id];
      const g = demo[id];
      g.scale.y = Math.max(0.001, st.v);
      g.visible = st.v > 0.004 || st.target > 0;
      if (id === 'kuchnia') {
        island.scale.y = Math.max(0.001, 1 - st.v);
        stylesVisible();
      }
      shadowsDirty();
    }
    function setWall(id, on) {
      const st = wallState[id];
      if (!st) return;
      st.target = on ? 0 : 1;
      demo[id].visible = true;
      if (on && !reduce) burst(id);
      if (reduce) { st.v = st.target; st.vel = 0; applyWallScale(id); }
      cfg.walls[id] = on;
      updatePins();
      emit({ walls: { ...cfg.walls } });
      idle = 0;
      dirty = true;
    }
    function stepWalls(dt) {
      let active = false;
      Object.keys(wallState).forEach((id) => {
        const st = wallState[id];
        if (Math.abs(st.v - st.target) < 0.0015 && Math.abs(st.vel) < 0.002) {
          if (st.v !== st.target) { st.v = st.target; st.vel = 0; applyWallScale(id); }
          return;
        }
        // sprężyna krytycznie tłumiona, response ≈ 0,5 s (bez przestrzelenia)
        const k = (2 * Math.PI / 0.5) ** 2;
        const c = 2 * Math.sqrt(k);
        st.vel += (-(st.v - st.target) * k - st.vel * c) * dt;
        st.v = Math.max(0, Math.min(1, st.v + st.vel * dt));
        applyWallScale(id);
        active = true;
      });
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.t += dt;
        const pa = b.pts.geometry.attributes.position;
        for (let k = 0; k < pa.count; k++) {
          pa.array[k * 3] += b.vel[k * 3] * dt;
          pa.array[k * 3 + 1] = Math.max(0.02, pa.array[k * 3 + 1] + (b.vel[k * 3 + 1] - b.t * 0.6) * dt);
          pa.array[k * 3 + 2] += b.vel[k * 3 + 2] * dt;
        }
        pa.needsUpdate = true;
        b.pts.material.opacity = 0.7 * Math.max(0, 1 - b.t / 1.3);
        if (b.t > 1.3) { dust.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
        active = true;
      }
      return active;
    }
    const wallsAnimating = () => bursts.length > 0 || Object.values(wallState).some((st) => Math.abs(st.v - st.target) > 0.0015);
    // pinezki „Wyburz” na makiecie i rzucie
    const pins = PH.walls.map((w) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tpin';
      el.innerHTML = '<i aria-hidden="true"></i><span></span>';
      el.addEventListener('click', () => setWall(w.id, !cfg.walls[w.id]));
      labelsHost.appendChild(el);
      return { el, w, pos: new THREE.Vector3(X(w.pin[0]), H * 0.95, Z(w.pin[1])) };
    });
    // szerokości etykiet mierzymy po wczytaniu czcionek
    if (document.fonts) document.fonts.ready.then(() => { [...pins].forEach((pn) => { pn.el._w = 0; pn.el._h = 0; }); labelsHost.querySelectorAll('.tlabel').forEach((el) => { el._w = 0; el._h = 0; }); dirty = true; });
    function updatePins() {
      pins.forEach((pn) => {
        const on = !!cfg.walls[pn.w.id];
        pn.el.classList.toggle('is-down', on);
        pn.el._w = 0;
        pn.el.setAttribute('aria-pressed', String(on));
        pn.el.querySelector('span').textContent = on ? 'Przywróć ścianę' : 'Wyburz ścianę';
        pn.el.setAttribute('aria-label', `${on ? 'Przywróć' : 'Wyburz'} ścianę: ${pn.w.name}`);
      });
    }

    // ---------- etykiety pokoi ----------
    const labels = PH.rooms.map((r) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tlabel';
      el.innerHTML = `<b>${r.short || r.name}</b><span>${String(r.area).replace('.', ',')} m²</span>`;
      el.addEventListener('click', () => go(r.id));
      labelsHost.appendChild(el);
      return { el, room: r, pos: new THREE.Vector3(X(r.label[0]), 1.2, Z(r.label[1])) };
    });

    // ---------- punkty spaceru (koła na podłodze) ----------
    const spotsGroup = new THREE.Group();
    scene.add(spotsGroup);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const spotFill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false });
    PH.rooms.forEach((r) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.23, 40), spotMat);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.19, 40), spotFill);
      ring.rotation.x = disc.rotation.x = -Math.PI / 2;
      g.add(ring, disc);
      g.position.set(X(r.spot[0]), 0.012, Z(r.spot[1]));
      ring.userData.room = disc.userData.room = r.id;
      ring.userData.noAO = disc.userData.noAO = true;
      spotsGroup.add(g);
    });
    spotsGroup.visible = false;

    applyCfg({ ...cfg });
    setTime(cfg.time, true);

    // =================================================================
    // RENDER (komputer: GTAO — cienie kontaktowe)
    // =================================================================
    let composer = null;
    let gtao = null;
    if (HQ) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new MOD.EffectComposer(renderer, rt);
      composer.addPass(new MOD.RenderPass(scene, camera));
      gtao = new MOD.GTAOPass(scene, camera, 1, 1);
      gtao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      gtao.blendIntensity = 0.9;
      const ov = gtao.overrideVisibility.bind(gtao);
      gtao.overrideVisibility = function () {
        ov();
        scene.traverse((o) => { if (o.userData.noAO || (o.material && o.material.transparent)) o.visible = false; });
      };
      composer.addPass(gtao);
      composer.addPass(new MOD.OutputPass());
    }
    const draw = () => { if (composer) composer.render(); else renderer.render(scene, camera); };
    captureEnv();

    // =================================================================
    // KAMERA I STEROWANIE
    // =================================================================
    const orbit = { theta: 0.42, phi: 0.78, radius: 16.5, target: new THREE.Vector3(X(700), 0, Z(270)) };
    const walk = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.05 };
    let mode = 'doll';
    let current = null;
    const look = new THREE.Vector3();
    let aspect = 1.6;
    const orbitPose = (o = orbit) => ({
      pos: new THREE.Vector3(o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta), o.target.y + o.radius * Math.cos(o.phi), o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)),
      look: o.target.clone(),
      fov: aspect < 1 ? 50 : 38,
    });
    const walkPose = (w = walk) => {
      const dir = new THREE.Vector3(Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch));
      return { pos: w.pos.clone(), look: w.pos.clone().add(dir), fov: (w.fov || 72) + (aspect < 1 ? 8 : 0) };
    };
    let tween = null;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    const shellTarget = { doll: 0.56, walk: 1, plan: 0.4 };
    let shellY = 0.9;
    const setShell = (v) => { if (v !== shellY) shadowsDirty(); shellY = v; shell.scale.y = v; };
    setShell(0.56);
    const poseNow = () => ({ pos: camera.position.clone(), look: look.clone(), fov: camera.fov });
    const flyTo = (to, dur, done) => {
      if (reduce) dur = Math.min(dur, 0.25);
      tween = { from: poseNow(), to, t: 0, dur, done, shellFrom: shellY, shellTo: shellTarget[mode], walkFrom: walkMix, walkTo: mode === 'walk' ? 1 : 0 };
      dirty = true;
    };
    const roomAt = (x, z) => {
      const px = PX(x);
      const py = PY(z);
      return PH.rooms.find((r) => r.rects.some((q) => px >= q[0] - 2 && px <= q[2] + 2 && py >= q[1] - 2 && py <= q[3] + 2));
    };
    const setCurrent = (r) => {
      if (r && current && r.id === current.id) return;
      current = r;
      emit({ mode, room: r ? r.id : null });
      root.querySelectorAll('.tour__rooms [data-room]').forEach((b) => b.setAttribute('aria-pressed', String(!!r && b.dataset.room === r.id)));
      const nameEl = $('.tour__room');
      if (nameEl) nameEl.innerHTML = r ? `<b>${r.name}</b> <span>${String(r.area).replace('.', ',')} m²</span>` : '';
      const ph = $('.js-tour-photo');
      if (ph) { ph.hidden = !(r && r.photos.length); ph.dataset.photo = r && r.photos[0] ? r.photos[0] : ''; }
      if (mini) mini.querySelectorAll('[data-room]').forEach((el) => el.classList.toggle('is-on', !!r && el.dataset.room === r.id));
    };
    const updateModeUi = () => {
      root.dataset.mode = mode;
      root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      spotsGroup.visible = mode === 'walk';
      ceiling.visible = mode === 'walk' && !tween;
      shadowsDirty();
    };
    function go(id, opts = {}) {
      const r = PH.rooms.find((x) => x.id === id);
      if (!r) return;
      const wasWalk = mode === 'walk';
      mode = 'walk';
      updateModeUi();
      ceiling.visible = wasWalk;
      walk.pos.set(X(r.spot[0]), EYE, Z(r.spot[1]));
      walk.yaw = (r.spot[2] * Math.PI) / 180;
      walk.pitch = r.spot[3] !== undefined ? r.spot[3] : -0.08;
      walk.fov = r.spot[4] || 72;
      setCurrent(r);
      flyTo(walkPose(), opts.instant ? 0.01 : wasWalk ? 0.9 : 1.6, () => { ceiling.visible = mode === 'walk'; });
      idle = 0;
    }
    function moveTo(x, z) {
      const r = roomAt(x, z);
      if (!r) return;
      const dx = x - walk.pos.x;
      const dz = z - walk.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) return;
      walk.pos.set(x, EYE, z);
      if (dist > 0.8) walk.yaw = Math.atan2(dx, -dz);
      setCurrent(r);
      flyTo(walkPose(), Math.min(1.1, 0.45 + dist * 0.12), () => {});
    }
    function setMode(m) {
      if (m === mode && !tween) return;
      if (m === 'walk') { go(current ? current.id : 'salon'); return; }
      mode = m;
      updateModeUi();
      ceiling.visible = false;
      if (m === 'plan') {
        orbit.theta = Math.round(orbit.theta / (Math.PI * 2)) * Math.PI * 2;
        orbit.phi = 0.001;
        orbit.radius = aspect < 1 ? 26 : 17;
      } else { orbit.phi = aspect < 1 ? 0.7 : 0.78; orbit.radius = aspect < 1 ? 29 : 16.5; }
      setCurrent(null);
      flyTo(orbitPose(), 1.2, () => {});
      idle = 0;
    }

    const el = renderer.domElement;
    const pointers = new Map();
    let drag = null;
    let pinch0 = 0;
    let vel = 0;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const pick = (cx, cy) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (mode === 'walk') {
        const hs = ray.intersectObjects(spotsGroup.children, true).filter((h) => shown(h.object));
        if (hs.length) { go(hs[0].object.userData.room); return; }
        const hf = ray.intersectObjects(floorMeshes, false);
        const hw = ray.intersectObjects([shell, fixed, styles.obecny, styles.odswiezony, demo.kuchnia, demo.hol], true).filter((h) => h.object.material !== mat.glass && h.object.material !== mat.frosted && shown(h.object));
        if (hf.length && (!hw.length || hw[0].distance > hf[0].distance - 0.05)) moveTo(hf[0].point.x, hf[0].point.z);
      } else {
        const hf = ray.intersectObjects(floorMeshes, false);
        if (hf.length) { const r = roomAt(hf[0].point.x, hf[0].point.z); if (r) go(r.id); }
      }
    };
    el.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        drag = null;
        return;
      }
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      vel = 0;
      idle = 0;
      root.classList.add('is-touched');
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) zoom(pinch0 / d);
        pinch0 = d;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (tween) return;
      if (mode === 'walk') {
        walk.yaw -= dx * 0.0042;
        walk.pitch = Math.max(-0.75, Math.min(0.6, walk.pitch + dy * 0.0034));
      } else {
        orbit.theta -= dx * 0.0055;
        vel = -dx * 0.0055;
        if (mode === 'doll') orbit.phi = Math.max(0.28, Math.min(1.25, orbit.phi - dy * 0.004));
      }
      dirty = true;
    });
    const up = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = 0;
      if (drag && drag.moved < 8 && performance.now() - drag.t < 450) pick(e.clientX, e.clientY);
      drag = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    function zoom(f) {
      if (mode === 'walk') camera.fov = Math.max(42, Math.min(88, camera.fov * f));
      else orbit.radius = Math.max(6, Math.min(36, orbit.radius * f));
      camera.updateProjectionMatrix();
      dirty = true;
    }
    el.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey || root.classList.contains('is-fs'))) return;
      e.preventDefault();
      zoom(1 + Math.sign(e.deltaY) * Math.min(0.12, Math.abs(e.deltaY) * 0.0015));
    }, { passive: false });
    root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => zoom(b.dataset.zoom === 'in' ? 0.85 : 1.18)));
    el.tabIndex = 0;
    el.addEventListener('keydown', (e) => {
      const k = e.key;
      if (mode === 'walk') {
        if (k === 'ArrowLeft') walk.yaw -= 0.12;
        else if (k === 'ArrowRight') walk.yaw += 0.12;
        else if (k === 'ArrowUp' || k === 'ArrowDown') {
          const s = k === 'ArrowUp' ? 0.6 : -0.6;
          const nx = walk.pos.x + Math.sin(walk.yaw) * s;
          const nz = walk.pos.z - Math.cos(walk.yaw) * s;
          if (roomAt(nx, nz)) { walk.pos.x = nx; walk.pos.z = nz; setCurrent(roomAt(nx, nz)); }
        } else return;
      } else if (k === 'ArrowLeft') orbit.theta -= 0.12;
      else if (k === 'ArrowRight') orbit.theta += 0.12;
      else return;
      e.preventDefault();
      dirty = true;
    });
    const photoBtn = $('.js-tour-photo');
    photoBtn && photoBtn.addEventListener('click', () => root.dispatchEvent(new CustomEvent('tour:photo', { detail: { photo: photoBtn.dataset.photo, room: current && current.id } })));

    // ---------- rozmiar i pętla ----------
    let W = 0;
    let Hh = 0;
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      Hh = Math.max(1, Math.round(r.height));
      aspect = W / Hh;
      renderer.setSize(W, Hh, false);
      if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, Hh); }
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    new ResizeObserver(resize).observe(stage);
    resize();

    orbit.radius = aspect < 1 ? 29 : 16.5;
    if (aspect < 1) { orbit.phi = 0.72; orbit.theta = 0.35; }
    const startPose = orbitPose();
    const intro = { ...orbit, theta: orbit.theta + 0.9, phi: 0.62, radius: orbit.radius * 1.5, target: orbit.target.clone() };
    const p0 = orbitPose(intro);
    camera.position.copy(p0.pos);
    look.copy(p0.look);
    camera.fov = p0.fov;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    updateModeUi();

    let visible = true;
    let introDone = false;
    new IntersectionObserver((en) => {
      visible = en.some((x) => x.isIntersecting);
      if (visible && !introDone) {
        introDone = true;
        flyTo(startPose, reduce ? 0.01 : 2.2, () => {});
      }
      if (visible) loop();
    }, { threshold: 0.15 }).observe(stage);

    const v3 = new THREE.Vector3();
    const miniMe = mini && mini.querySelector('.mini__me');
    let last = performance.now();
    let raf = 0;
    let firstFrame = true;
    let lastCeil = ceiling.visible;
    function loop() {
      if (raf || !visible) return;
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      idle += dt;
      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        const e = ease(tween.t);
        camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
        look.lerpVectors(tween.from.look, tween.to.look, e);
        camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e;
        setShell(tween.shellFrom + (tween.shellTo - tween.shellFrom) * e);
        // tło: studio → miasto dopiero w drugiej połowie przelotu
        const wt = tween.walkTo > tween.walkFrom ? Math.max(0, (tween.t - 0.45) / 0.55) : Math.min(1, tween.t / 0.5);
        walkMix = tween.walkFrom + (tween.walkTo - tween.walkFrom) * wt;
        applyLight();
        if (tween.t >= 1) {
          const d = tween.done;
          tween = null;
          updateModeUi();
          d && d();
        }
        dirty = true;
      } else if (mode === 'walk') {
        const p = walkPose();
        camera.position.copy(p.pos);
        look.copy(p.look);
      } else {
        if (!drag && Math.abs(vel) > 0.0001) { orbit.theta += vel; vel *= 0.92; dirty = true; }
        if (mode === 'doll' && !reduce && idle > 5 && !drag) { orbit.theta += dt * 0.05; dirty = true; }
        const p = orbitPose();
        camera.position.copy(p.pos);
        look.copy(p.look);
      }
      if (litFrom && litT < 1) {
        litT = Math.min(1, litT + dt / 0.9);
        applyLight();
        if (litT >= 1) litFrom = null;
        dirty = true;
      }
      if (stepWalls(dt)) dirty = true;
      if (trans.active || cmp.on) dirty = true;
      if (envDirty && !tween && !litFrom && !wallsAnimating() && !trans.active && !cmp.on) captureEnv();
      if (ceiling.visible !== lastCeil) { lastCeil = ceiling.visible; shadowsDirty(); dirty = true; }
      // w ruchu bez GTAO (płynność), po zatrzymaniu jedna klatka z cieniami kontaktowymi
      const moving = !!tween || (drag && drag.moved > 2) || Math.abs(vel) > 0.0005 || trans.active || cmp.on;
      if (gtao) {
        if (moving && gtao.enabled) gtao.enabled = false;
        else if (!moving && !gtao.enabled) { gtao.enabled = true; dirty = true; }
      }
      if (dirty || drag) {
        camera.lookAt(look);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        updateCut(dt);
        draw();
        dirty = false;
        if (firstFrame) { firstFrame = false; root.classList.add('is-ready'); }
        const showLabels = mode !== 'walk' && !tween;
        // etykiety i pinezki: rzut na ekran, potem rozsunięcie nachodzących na siebie (pinezki mają pierwszeństwo)
        const place = [];
        const proj = (list, pin) => list.forEach((it) => {
          v3.copy(it.pos);
          v3.y *= shellY;
          v3.project(camera);
          const on = showLabels && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
          it.el.classList.toggle('is-on', on);
          if (on) place.push({ el: it.el, x: ((v3.x + 1) / 2) * W, y: ((1 - v3.y) / 2) * Hh, pin });
        });
        proj(pins, true);
        proj(labels, false);
        const taken = [];
        const free = (l, t, w, h) => !taken.some((d) => l < d.r + 4 && d.l - 4 < l + w && t < d.b + 4 && d.t - 4 < t + h);
        place.forEach((p) => {
          const w = p.el._w || (p.el._w = p.el.offsetWidth);
          const h = p.el._h || (p.el._h = p.el.offsetHeight);
          const l0 = p.x - w / 2;
          const t0 = p.pin ? p.y - h : p.y - h / 2;
          const dy = h + 6;
          const dx = w / 2 + 6;
          const tries = [[0, 0], [0, dy], [0, -dy], [dx, 0], [-dx, 0], [dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy], [0, 2 * dy], [0, -2 * dy]];
          const hit = tries.find(([ox, oy]) => free(l0 + ox, t0 + oy, w, h));
          if (!hit && !p.pin) { p.el.classList.remove('is-on'); return; }
          const [ox, oy] = hit || [0, 0];
          taken.push({ l: l0 + ox, r: l0 + ox + w, t: t0 + oy, b: t0 + oy + h });
          p.el.style.transform = `translate(${(l0 + ox).toFixed(1)}px, ${(t0 + oy).toFixed(1)}px)`;
        });
        if (miniMe && mode === 'walk') {
          const yawDeg = (Math.atan2(look.x - camera.position.x, -(look.z - camera.position.z)) * 180) / Math.PI;
          miniMe.setAttribute('transform', `translate(${PX(camera.position.x).toFixed(0)} ${PY(camera.position.z).toFixed(0)}) rotate(${yawDeg.toFixed(1)})`);
        }
      }
      if (visible) loop();
    }
    loop();

    function snapshot() {
      camera.lookAt(look);
      draw();
      try { return renderer.domElement.toDataURL('image/jpeg', 0.82); } catch (e) { return null; }
    }

    Object.entries(cfg.walls).forEach(([id, on]) => { if (on && wallState[id]) { wallState[id].v = 0; wallState[id].target = 0; applyWallScale(id); } });
    updatePins();
    return { apply: applyCfg, wall: setWall, compare: setCompare, setMode, go, snapshot, resize, busy: () => !!tween || !!litFrom || !introDone || envDirty || wallsAnimating() || texPending > 0 || trans.active };
  }
})();
