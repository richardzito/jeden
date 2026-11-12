/*
  Spacer wirtualny 3D z konfiguratorem — penthouse ul. Kłopot 4A.
  Klasyczny skrypt + dynamiczny import three.js (import map w <head>), więc działa też z file://.
  Model według rzutu (klopot-plan.jpg, 106 px ≈ 1 m, wysokość 2,80 m), wnętrza i materiały według zdjęć oferty.
  Realizm: słońce przez okna z miękkimi cieniami, światło z okien (RectAreaLight), odbicia i światło odbite
  z wnętrza (CubeCamera → PMREM), cienie kontaktowe (GTAO na komputerze), za oknami panorama ze zdjęcia z tarasu.
  API: window.TOUR.set({floor, walls, kitchen, pokoj, gabinet, furniture, time}), .mode(m), .go(room), .snapshot()
*/
(() => {
  'use strict';
  const root = document.querySelector('[data-tour]');
  if (!root) return;
  const PH = window.PH;
  const $ = (s) => root.querySelector(s);
  const stage = $('.tour__stage');
  const host = $('.tour__canvas');
  const labelsHost = $('.tour__labels');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const cfg = { floor: 'gres', walls: 'greige', kitchen: 'czarny', pokoj: 'praca', gabinet: 'gabinet', furniture: 'on', time: 'day' };
  let impl = null;
  const api = {
    cfg,
    set(p) { Object.assign(cfg, p); if (impl) impl.apply(p); },
    mode(m) { if (impl) impl.setMode(m); else pendingMode = m; },
    go(id) { if (impl) impl.go(id); else pendingRoom = id; },
    snapshot() { return impl ? impl.snapshot() : null; },
    get busy() { return !impl || impl.busy(); },
    get ready() { return !!impl; },
  };
  let pendingMode = null;
  let pendingRoom = null;
  window.TOUR = api;
  const emit = (detail) => root.dispatchEvent(new CustomEvent('tour:change', { detail }));

  // Pokoje: przyciski pod widokiem
  const roomsBar = $('.tour__rooms');
  if (roomsBar) {
    roomsBar.innerHTML = PH.rooms.map((r) => `<button type="button" data-room="${r.id}"><b>${r.name}</b><span>${String(r.area).replace('.', ',')} m²</span></button>`).join('');
    roomsBar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]');
      if (b) api.go(b.dataset.room);
    });
  }

  // Minimapa (SVG rzutu)
  const mini = $('.tour__mini');
  if (mini) {
    const rects = PH.rooms.map((r) => r.rects.map((q) => `<rect data-room="${r.id}" class="${r.outdoor ? 'is-out' : ''}" x="${q[0]}" y="${q[1]}" width="${q[2] - q[0]}" height="${q[3] - q[1]}"/>`).join('')).join('');
    mini.setAttribute('viewBox', '180 20 1610 1870');
    mini.innerHTML = `<g class="mini__rooms">${rects}</g><g class="mini__me" transform="translate(0 0)"><path d="M0 0 L-150 -260 A300 300 0 0 1 150 -260 Z" class="mini__cone"/><circle r="34" class="mini__dot"/></g>`;
    mini.addEventListener('click', (e) => {
      const r = e.target.closest('[data-room]');
      if (r) api.go(r.dataset.room);
    });
  }

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => api.mode(b.dataset.mode)));
  root.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
    api.set({ time: b.dataset.time });
    root.querySelectorAll('[data-time]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    emit({ cfg: { ...cfg } });
  }));

  // Pełny ekran (na telefonie: nakładka na cały ekran, gesty tylko dla 3D)
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

  // Ładowanie three.js dopiero, gdy sekcja zbliża się do ekranu
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
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { start(); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(root);
  } else start();

  // =====================================================================
  function build(THREE, MOD) {
    const { RoomEnvironment, RoundedBoxGeometry, RectAreaLightUniformsLib } = MOD;
    const HQ = !!MOD.EffectComposer;
    const S = 1 / 106;
    const CX = 980;
    const CY = 950;
    const H = 2.8;
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
    T.gres = planks([[32, 9, 41], [30, 8, 44], [34, 10, 47], [29, 8, 39], [32, 9, 43], [31, 8, 49]], { vary: 2.5, lines: 30, knots: 0.35, rough: 160 });
    T.dab = planks([[33, 32, 55], [31, 34, 52], [34, 30, 58], [32, 33, 50]], { vary: 3, lines: 36, joint: 'rgba(70,45,22,.4)', rough: 175 });
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
    T.mikro = (() => {
      const c = cnv(TS, TS);
      paintNoise(c, noise(TS, TS, 4, 6, 0.55), [158, 151, 142], [196, 190, 182], 1.6);
      const hC = cnv(TS / 2, TS / 2);
      paintNoise(hC, noise(TS / 2, TS / 2, 16, 3), [120, 120, 120], [255, 255, 255]);
      const rC = cnv(8, 8);
      const rg = rC.getContext('2d');
      rg.fillStyle = 'rgb(180,180,180)';
      rg.fillRect(0, 0, 8, 8);
      return { map: tex(c), bump: tex(hC, false), rough: tex(rC, false) };
    })();
    // mat ściany: delikatna „skórka pomarańczy” do bump
    T.paintBump = (() => { const c = cnv(512, 512); paintNoise(c, noise(512, 512, 96, 2), [150, 150, 150], [255, 255, 255]); return tex(c, false); })();
    // tapeta strukturalna srebrnoszara (salon, sypialnia) — 1 tekstura = 1,2 m
    T.wallpaper = (() => {
      const c = cnv(TS, TS);
      const n1 = noise(TS, TS, 3, 5, 0.6);
      const n2 = noise(TS, TS, 24, 3, 0.5);
      const g = c.getContext('2d');
      const im = g.createImageData(TS, TS);
      for (let i = 0; i < n1.length; i++) {
        const t = Math.min(1, Math.max(0, (n1[i] - 0.5) * 2.2 + 0.5));
        const f = (n2[i] - 0.5) * 22;
        im.data[i * 4] = 142 + t * 26 + f * 0.7;
        im.data[i * 4 + 1] = 141 + t * 26 + f * 0.7;
        im.data[i * 4 + 2] = 143 + t * 27 + f * 0.7;
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      const hC = cnv(TS / 2, TS / 2);
      paintNoise(hC, noise(TS / 2, TS / 2, 12, 4), [60, 60, 60], [255, 255, 255], 1.3);
      return { map: tex(c), bump: tex(hC, false) };
    })();
    // tapeta „układ okresowy” w pokoju (zdjęcie pokoju): 1 tekstura = 1,2 × 1,2 m, 8 × 12 kart
    T.periodic = (() => {
      const N = TS;
      const c = cnv(N, N);
      const g = c.getContext('2d');
      g.fillStyle = '#1f1c19';
      g.fillRect(0, 0, N, N);
      const EL = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts'.split(' ');
      const cw = N / 8;
      const ch = N / 12;
      for (let r = 0; r < 12; r++) {
        for (let k = 0; k < 8; k++) {
          const x = k * cw + cw * 0.08;
          const y = r * ch + ch * 0.1;
          const w = cw * 0.84;
          const h = ch * 0.8;
          const gd = g.createLinearGradient(x, y, x + w, y + h);
          gd.addColorStop(0, hsl(38, 32 + rnd() * 10, 64 + rnd() * 8));
          gd.addColorStop(1, hsl(36, 30, 52 + rnd() * 8));
          g.fillStyle = gd;
          g.fillRect(x, y, w, h);
          g.strokeStyle = 'rgba(40,30,20,.6)';
          g.lineWidth = 1;
          g.strokeRect(x + 2, y + 2, w - 4, h - 4);
          g.fillStyle = '#231d17';
          g.font = `700 ${Math.round(h * 0.52)}px Georgia, serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(EL[Math.floor(rnd() * EL.length)], x + w / 2, y + h * 0.44);
          g.fillRect(x + w * 0.25, y + h * 0.78, w * 0.5, Math.max(1, h * 0.04));
        }
      }
      return { map: tex(c) };
    })();
    // drewno (pionowe usłojenie) — 1 tekstura = 1 m
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
    T.oak = wood(38, 26, 47, 6, 1.2); // dębowy blat stołu, panele
    T.oakGrey = wood(214, 4, 46, 5, 0.9); // szaro-dębowe szafki RTV, kuchnia, szafy w sypialni
    T.oakKitchen = wood(42, 8, 46, 4, 1.1); // szafki górne kuchni
    T.walnut = wood(27, 18, 38, 5, 1.1); // szafa w gabinecie i przedpokoju
    T.oakVanity = wood(38, 16, 40, 4, 1.2); // szafka pod umywalką
    T.larch = (() => {
      const c = cnv(TS / 2, TS / 2);
      const g = c.getContext('2d');
      const n = 8;
      for (let i = 0; i < n; i++) {
        const l = 50 + (rnd() - 0.5) * 10;
        g.fillStyle = hsl(30, 52, l);
        g.fillRect((i * c.width) / n, 0, c.width / n, c.height);
        grain(g, (i * c.width) / n, 0, c.width / n, c.height, 30, 52, l, 18);
        g.fillStyle = 'rgba(40,24,10,.6)';
        g.fillRect((i * c.width) / n, 0, 3, c.height);
      }
      return tex(c);
    })();
    const mottled = (c1, c2, cells = 4, contrast = 1.6, size = TS) => { const c = cnv(size, size); paintNoise(c, noise(size, size, cells, 5, 0.55), c1, c2, contrast); return tex(c); };
    T.concreteGrey = mottled([116, 117, 122], [152, 153, 158], 3, 1.6); // szafy w pokoju
    T.leather = mottled([58, 49, 43], [108, 96, 88], 6, 1.6); // narożnik, puf
    T.leatherBump = (() => { const c = cnv(256, 256); paintNoise(c, noise(256, 256, 20, 3), [80, 80, 80], [255, 255, 255], 1.4); return tex(c, false); })();
    T.fabricBump = (() => { const c = cnv(128, 128); const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 2) { g.fillStyle = y % 4 ? '#aaa' : '#666'; g.fillRect(0, y, 128, 1); } for (let x = 0; x < 128; x += 2) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, 0, 1, 128); } return tex(c, false); })();
    // płytki z betonem (kuchnia) i szary kamień (łazienka): 60 × 120, fuga
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
    T.backsplash = tiles([170, 172, 175], [202, 204, 207], TS, TS / 2, TS, 'rgba(120,120,122,.6)', 3); // 1 tekstura = 1,2 m
    T.stone = tiles([108, 109, 107], [140, 141, 139], TS / 2, TS, TS, 'rgba(70,70,70,.8)', 5); // 1 tekstura = 1,2 × 1,2 m (60 × 120)
    T.terrace = (() => {
      const N = TS / 2;
      const c = cnv(N, N);
      const g = paintNoise(c, noise(N, N, 16, 3), [72, 75, 80], [100, 103, 108], 1.2);
      const im = g.getImageData(0, 0, N, N);
      for (let i = 0; i < im.data.length; i += 4) { const s = rnd(); if (s < 0.06) { const v = s < 0.03 ? -40 : 45; im.data[i] += v; im.data[i + 1] += v; im.data[i + 2] += v; } }
      g.putImageData(im, 0, 0);
      g.fillStyle = 'rgba(40,42,46,.85)';
      g.fillRect(0, 0, N, 2);
      g.fillRect(0, 0, 2, N);
      return tex(c);
    })(); // 1 tekstura = 0,6 m
    T.granite = (() => {
      const N = 256;
      const c = cnv(N, N);
      const g = c.getContext('2d');
      g.fillStyle = '#1d1d1f';
      g.fillRect(0, 0, N, N);
      for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() < 0.3 ? 'rgba(120,120,126,.28)' : 'rgba(55,55,58,.6)'; g.fillRect(rnd() * N, rnd() * N, 0.6 + rnd(), 0.6 + rnd()); }
      return tex(c);
    })();
    T.facade = (() => {
      const c = cnv(256, 256);
      const g = c.getContext('2d');
      g.fillStyle = '#eceae5';
      g.fillRect(0, 0, 256, 256);
      for (let f = 0; f < 2; f++) {
        const y = f * 128;
        g.fillStyle = '#3d4248';
        for (let i = 0; i < 3; i++) g.fillRect(i * 85 + 12, y + 28, 60, 72);
        g.fillStyle = 'rgba(70,72,78,.9)';
        g.fillRect(0, y + 112, 256, 6);
      }
      return tex(c);
    })();
    // miękki cień pod makietą
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
    // tarcza zegara
    T.clock = (() => {
      const N = 512;
      const c = cnv(N, N);
      const g = c.getContext('2d');
      g.fillStyle = '#efe7d6';
      g.beginPath();
      g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(120,100,70,.18)';
      g.beginPath();
      g.arc(N / 2, N / 2, N * 0.48, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1c1a17';
      g.font = `600 ${N * 0.075}px Georgia, serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((s, i) => {
        const a = (i / 12) * Math.PI * 2;
        g.fillText(s, N / 2 + Math.sin(a) * N * 0.38, N / 2 - Math.cos(a) * N * 0.38);
      });
      g.strokeStyle = '#1c1a17';
      g.lineCap = 'round';
      g.lineWidth = N * 0.018;
      g.beginPath();
      g.moveTo(N / 2, N / 2);
      g.lineTo(N / 2 + N * 0.18, N / 2 - N * 0.12);
      g.stroke();
      g.lineWidth = N * 0.012;
      g.beginPath();
      g.moveTo(N / 2, N / 2);
      g.lineTo(N / 2 - N * 0.05, N / 2 - N * 0.33);
      g.stroke();
      return tex(c);
    })();

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
    const wallC = PH.config.walls.find((w) => w.id === cfg.walls).color;
    const mat = {
      paint: M({ color: wallC, roughness: 0.92, bumpMap: T.paintBump, bumpScale: 0.25 }, 0.8),
      render: M({ color: 0xefeee9, roughness: 0.95, bumpMap: T.paintBump, bumpScale: 0.2 }, 0.6),
      cut: M({ color: 0x2e3036, roughness: 1 }, 0.3),
      ceiling: M({ color: 0xf6f5f2, roughness: 0.95 }, 0.8),
      floor: M({ map: T.gres.map, bumpMap: T.gres.bump, bumpScale: 1.2, roughnessMap: T.gres.rough, roughness: 1, metalness: 0 }, 0.7),
      floorFixed: M({ map: T.gres.map, bumpMap: T.gres.bump, bumpScale: 1.2, roughnessMap: T.gres.rough, roughness: 1 }, 0.7),
      terrace: M({ map: T.terrace, roughness: 0.82 }, 0.6),
      slab: M({ color: 0xc9c6c0, roughness: 0.95 }, 0.5),
      wallpaper: M({ map: T.wallpaper.map, bumpMap: T.wallpaper.bump, bumpScale: 2.2, roughness: 0.78, metalness: 0.08 }, 0.9),
      periodic: M({ map: T.periodic.map, roughness: 0.75 }, 0.8),
      blackPaint: M({ color: 0x1d1e21, roughness: 0.82 }, 0.6),
      backsplash: M({ map: T.backsplash.map, bumpMap: T.backsplash.bump, bumpScale: 1, roughness: 0.6 }, 1),
      stone: M({ map: T.stone.map, bumpMap: T.stone.bump, bumpScale: 1, roughness: 0.55 }, 1),
      glass: M({ color: 0xdfe9ec, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false }, 1.6),
      frame: M({ color: 0x45291f, roughness: 0.5 }, 0.8), // ramy okien: ciemny brąz jak na zdjęciach
      sill: M({ color: 0x1a1a1c, roughness: 0.35 }, 1),
      alu: M({ color: 0x5f6266, roughness: 0.45, metalness: 0.6 }, 1),
      door: M({ color: 0xf3f2ef, roughness: 0.45 }, 0.9),
      doorDark: M({ color: 0x3b3430, roughness: 0.55 }, 0.9),
      black: M({ color: 0x18191b, roughness: 0.5, metalness: 0.2 }, 0.8),
      blackMatt: M({ color: 0x1b1c1e, roughness: 0.7 }, 0.6),
      blackGloss: M({ color: 0x0b0c0e, roughness: 0.08, metalness: 0.2 }, 1.5),
      front: M({ color: 0x1d1e21, roughness: 0.62 }, 0.7), // fronty kuchni: czarny mat
      granite: M({ map: T.granite, roughness: 0.42 }, 1),
      oak: M({ map: T.oak, roughness: 0.55 }, 0.8),
      oakGrey: M({ map: T.oakGrey, roughness: 0.6 }, 0.8),
      oakKitchen: M({ map: T.oakKitchen, roughness: 0.58 }, 0.8),
      walnut: M({ map: T.walnut, roughness: 0.55 }, 0.8),
      oakVanity: M({ map: T.oakVanity, roughness: 0.55 }, 0.8),
      glassDark: M({ color: 0x23262a, roughness: 0.06, transparent: true, opacity: 0.45, depthWrite: false }, 0.5),
      larch: M({ map: T.larch, roughness: 0.75 }, 0.6),
      concreteGrey: M({ map: T.concreteGrey, roughness: 0.75 }, 0.7),
      leather: M({ map: T.leather, bumpMap: T.leatherBump, bumpScale: 1.5, roughness: 0.55 }, 1),
      fabricDark: M({ color: 0x2d2f35, roughness: 1, bumpMap: T.fabricBump, bumpScale: 0.6 }, 0.6),
      fabricGrey: M({ color: 0x8e8c89, roughness: 1, bumpMap: T.fabricBump, bumpScale: 0.6 }, 0.6),
      fabricLight: M({ color: 0xd9d4ca, roughness: 1, bumpMap: T.fabricBump, bumpScale: 0.6 }, 0.6),
      boucle: M({ color: 0xe6dfd2, roughness: 1, bumpMap: T.leatherBump, bumpScale: 3 }, 0.6),
      linen: M({ color: 0xece9e3, roughness: 1, bumpMap: T.fabricBump, bumpScale: 0.4 }, 0.6),
      throwGrey: M({ color: 0x6c6e73, roughness: 1, bumpMap: T.fabricBump, bumpScale: 1 }, 0.5),
      headboard: M({ color: 0xc9c6c1, roughness: 1, bumpMap: T.fabricBump, bumpScale: 0.6 }, 0.6),
      curtain: M({ color: 0x4b4d53, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0x9a9ca3), sheenRoughness: 0.4, side: THREE.DoubleSide }, 0.5, THREE.MeshPhysicalMaterial),
      sheer: M({ color: 0xf6f4ef, roughness: 1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }, 0.6),
      brass: M({ color: 0xc19b5c, roughness: 0.32, metalness: 1 }, 1.4),
      gold: M({ color: 0xd4ab5a, roughness: 0.22, metalness: 1 }, 1.5),
      chrome: M({ color: 0xdadde0, roughness: 0.12, metalness: 1 }, 1.4),
      mirror: M({ color: 0xc9cdd1, roughness: 0.02, metalness: 1 }, 1.6),
      ceramic: M({ color: 0xf7f7f5, roughness: 0.12 }, 1.2),
      white: M({ color: 0xf1f0ed, roughness: 0.4 }, 0.9),
      plant: M({ color: 0x3f6b39, roughness: 0.8 }, 0.6),
      plantLight: M({ color: 0x5d8a46, roughness: 0.8 }, 0.6),
      flowerPink: M({ color: 0xf0c1c0, roughness: 0.9 }, 0.6),
      flowerWhite: M({ color: 0xf6f3ee, roughness: 0.9 }, 0.6),
      wicker: M({ color: 0xb08955, roughness: 0.95, bumpMap: T.fabricBump, bumpScale: 2 }, 0.6),
      pot: M({ color: 0xeceae5, roughness: 0.6 }, 0.8),
      fruit: M({ color: 0xd9542c, roughness: 0.5 }, 0.8),
      bulb: M({ color: 0xfff1d8, emissive: 0xffc678, emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.92 }, 0.4),
      led: M({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 0.5 }, 0),
      fire: M({ color: 0x2a1408, emissive: 0xff7a2e, emissiveIntensity: 0.4, roughness: 0.9 }, 0.3),
      logs: M({ color: 0x2e2622, roughness: 0.95 }, 0.5),
      tv: M({ color: 0x050607, roughness: 0.06, metalness: 0.4 }, 1.6),
      clock: M({ map: T.clock, roughness: 0.6 }, 0.7),
      facade: M({ map: T.facade, roughness: 0.9 }, 0.5),
      kidBlue: M({ color: 0x8fb0cc, roughness: 0.9 }, 0.6),
      kidYellow: M({ color: 0xe7c86c, roughness: 0.95 }, 0.6),
      kidPink: M({ color: 0xdcaaa6, roughness: 0.9 }, 0.6),
      shadowDecal: new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false }),
    };

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
    const world = new THREE.Group(); // podłogi, płyta
    const shell = new THREE.Group(); // ściany, okna, zabudowy stałe
    const ceiling = new THREE.Group(); // sufit/dach (tylko w spacerze)
    const loose = new THREE.Group(); // meble wolnostojące (tryb „puste wnętrze”)
    const fixed = new THREE.Group(); // wyposażenie stałe (kuchnia, łazienki)
    const outside = new THREE.Group(); // budynek poniżej, panorama (tylko w spacerze)
    const variants = { pokoj: {}, gabinet: {} };
    scene.add(world, shell, ceiling, loose, fixed, outside);

    // =================================================================
    // PODŁOGI, PŁYTA, SUFIT
    // =================================================================
    const doorStrips = [[1283, 1250, 1300, 1345], [1075, 1655, 1165, 1670], [790, 1655, 885, 1670], [757, 1680, 770, 1775], [1440, 1020, 1455, 1105], [1440, 1210, 1455, 1300], [1300, 1000, 1440, 1015], [1440, 980, 1478, 1000], [1440, 400, 1478, 560]];
    const floorsByType = { wood: [], tile: [], terrace: [] };
    PH.rooms.forEach((r) => floorsByType[r.floor].push(...r.rects));
    floorsByType.wood.push(...doorStrips);
    const fWood = put(world, floorGeo(floorsByType.wood, 0.002, 2.4), mat.floor, 0, 0, 0, { cast: false });
    const fTile = put(world, floorGeo(floorsByType.tile, 0.002, 2.4), mat.floorFixed, 0, 0, 0, { cast: false });
    const fTer = put(world, floorGeo(floorsByType.terrace, 0.002, 0.6), mat.terrace, 0, 0, 0, { cast: false });
    const floorMeshes = [fWood, fTile, fTer];
    // płyta stropowa (przekrój makiety)
    PH.rooms.forEach((r) => r.rects.forEach((q) => pb(world, q[0] - 25, q[1] - 25, q[2] + 25, q[3] + 25, -0.34, -0.001, mat.slab, { cast: false, noAO: true })));
    // miękki cień pod makietą
    const shadowDecal = put(world, new THREE.PlaneGeometry(26, 26), mat.shadowDecal, X(980), -0.36, Z(960), { rx: -Math.PI / 2, cast: false, receive: false, noAO: true });
    // sufit + dach: spód biały (sufit), góra i boki tynk
    const indoor = PH.rooms.filter((r) => !r.outdoor).flatMap((r) => r.rects).concat(doorStrips);
    indoor.forEach((q) => pb(ceiling, q[0], q[1], q[2], q[3], H, H + 0.3, [mat.render, mat.render, mat.render, mat.ceiling, mat.render, mat.render], { uv: 2 }));
    pb(ceiling, 210, 1100, 937, 1270, H, H + 0.3, [mat.render, mat.render, mat.render, mat.render, mat.render, mat.render], { uv: 2 }); // strop nad loggią
    ceiling.visible = false;

    // =================================================================
    // ŚCIANY (materiał każdej strony zależy od tego, co jest za nią)
    // =================================================================
    const faceMat = (px, py) => {
      const r = roomAtPx(px, py);
      if (!r || r.outdoor) return mat.render;
      if (r.floor === 'tile') return mat.stone;
      return mat.paint;
    };
    const baseboards = [];
    const wall = (x1, y1, x2, y2, yb = 0, yt = H) => {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const e = 6;
      const mArr = [faceMat(x2 + e, my), faceMat(x1 - e, my), mat.cut, mat.paint, faceMat(mx, y2 + e), faceMat(mx, y1 - e)];
      const m = pb(shell, x1, y1, x2, y2, yb, yt, mArr, { uv: 1.2 });
      if (yb === 0) baseboards.push([x1, y1, x2, y2]);
      return m;
    };
    // zewnętrzne
    [
      [937, 440, 980, 710], [937, 960, 980, 1160], [937, 1265, 980, 1312], [1285, 352, 1520, 400], [1660, 352, 1765, 400],
      [1740, 400, 1765, 1000], [1715, 1000, 1740, 1172], [1670, 1172, 1700, 1340], [1440, 1315, 1700, 1340], [1470, 1455, 1495, 1835],
      [757, 1805, 1495, 1835], [195, 1838, 770, 1865], [757, 1775, 770, 1838], [195, 1270, 222, 1865], [195, 1270, 258, 1312],
      [530, 1270, 750, 1312], [880, 1270, 980, 1312], [937, 352, 980, 440],
    ].forEach((r) => wall(...r));
    // wewnętrzne
    [
      [980, 1000, 1300, 1015], [1283, 1015, 1300, 1250], [1283, 1345, 1300, 1440], [982, 1425, 1290, 1440], [1285, 1440, 1300, 1670],
      [982, 1655, 1075, 1670], [1165, 1655, 1300, 1670], [965, 1312, 982, 1670], [597, 1655, 790, 1670], [885, 1655, 965, 1670],
      [597, 1312, 612, 1670], [757, 1670, 770, 1680], [1440, 560, 1478, 980], [1455, 980, 1765, 1000], [1440, 1000, 1455, 1020],
      [1440, 1105, 1455, 1172], [1455, 1160, 1715, 1172], [1440, 1172, 1455, 1210], [1440, 1300, 1455, 1315], [1625, 1080, 1715, 1160],
    ].forEach((r) => wall(...r));

    // ---------- okna i drzwi balkonowe ----------
    // [x1,y1,x2,y2, typ, strona zewnętrzna]
    const openings = [
      [937, 710, 980, 960, 'w', 'w'], [980, 352, 1190, 400, 'w', 'n'], [1190, 352, 1285, 400, 'd', 'n'],
      [1520, 352, 1615, 400, 'd', 'n'], [1615, 352, 1660, 400, 'w', 'n'], [258, 1270, 435, 1312, 'w', 'n'], [435, 1270, 530, 1312, 'd', 'n'],
      [750, 1270, 880, 1312, 'w', 'n'], [937, 1160, 980, 1265, 'd', 'w'],
    ];
    const SILL = 0.82;
    const TOP = 2.5;
    const curtainGeo = (w, h, folds, depth) => {
      const g = new THREE.PlaneGeometry(w, h, Math.max(8, folds * 6), 1);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) / w) * Math.PI * 2 * folds) * depth);
      g.computeVertexNormals();
      return g;
    };
    const windowLights = [];
    const glassMeshes = [];
    openings.forEach(([x1, y1, x2, y2, t, side]) => {
      const sill = t === 'w' ? SILL : 0;
      if (sill > 0) wall(x1, y1, x2, y2, 0, sill);
      wall(x1, y1, x2, y2, TOP, H);
      const vertical = side === 'w' || side === 'e';
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const th = (vertical ? x2 - x1 : y2 - y1) * S;
      const cx = X((x1 + x2) / 2);
      const cz = Z((y1 + y2) / 2);
      // płaszczyzna okna: 1/3 grubości muru od zewnątrz
      const out = side === 'w' ? -1 : side === 'n' ? -1 : 1;
      const fx = vertical ? cx + out * th * 0.18 : cx;
      const fz = vertical ? cz : cz + out * th * 0.18;
      const hgt = TOP - sill;
      const along = (a, b) => (vertical ? [fx, b, fz + a] : [fx + a, b, fz]);
      const prof = (w, h, a, b, d = 0.08) => {
        const g = vertical ? new THREE.BoxGeometry(d, h, w) : new THREE.BoxGeometry(w, h, d);
        const p = along(a, b);
        put(shell, g, mat.frame, p[0], p[1], p[2]);
      };
      // rama ościeżnicy
      prof(len, 0.07, 0, TOP - 0.035);
      prof(len, 0.07, 0, sill + 0.035);
      prof(0.07, hgt, -len / 2 + 0.035, sill + hgt / 2);
      prof(0.07, hgt, len / 2 - 0.035, sill + hgt / 2);
      // skrzydła: co ~0,9 m słupek
      const n = Math.max(1, Math.round(len / 0.95));
      for (let i = 1; i < n; i++) prof(0.1, hgt, -len / 2 + (len * i) / n, sill + hgt / 2, 0.09);
      for (let i = 0; i < n; i++) {
        const a = -len / 2 + (len * (i + 0.5)) / n;
        const sw = len / n - 0.1;
        prof(sw, 0.06, a, TOP - 0.1, 0.07);
        prof(sw, 0.06, a, sill + 0.1, 0.07);
        if (t === 'w' || i === n - 1) {
          // klamka
          const hp = along(a + (i % 2 ? -1 : 1) * (sw / 2 - 0.05), sill + hgt * 0.5);
          put(shell, RB(vertical ? 0.03 : 0.02, 0.14, vertical ? 0.02 : 0.03, 0.008), mat.chrome, hp[0] - (vertical ? out * 0.05 : 0), hp[1], hp[2] - (vertical ? 0 : out * 0.05), { cast: false });
        }
      }
      const gm = put(shell, vertical ? new THREE.BoxGeometry(0.012, hgt - 0.14, len - 0.1) : new THREE.BoxGeometry(len - 0.1, hgt - 0.14, 0.012), mat.glass, fx, sill + hgt / 2, fz, { cast: false, receive: false, noAO: true });
      glassMeshes.push(gm);
      // parapet wewnętrzny (czarny kamień)
      if (sill > 0) {
        const inX = vertical ? cx - out * th * 0.5 : cx;
        const inZ = vertical ? cz : cz - out * th * 0.5;
        const d = th * 0.62 + 0.04;
        put(shell, vertical ? new THREE.BoxGeometry(d, 0.03, len + 0.06) : new THREE.BoxGeometry(len + 0.06, 0.03, d), mat.sill, inX + (vertical ? out * (th * 0.5 - d / 2) : 0), sill + 0.015, inZ + (vertical ? 0 : out * (th * 0.5 - d / 2)));
      }
      // zasłony: grafitowe welurowe po bokach + firana przy drzwiach balkonowych
      const inX = vertical ? cx - out * (th * 0.5 + 0.12) : cx;
      const inZ = vertical ? cz : cz - out * (th * 0.5 + 0.12);
      [-1, 1].forEach((k) => {
        const g = curtainGeo(0.46, 2.66, 3.5, 0.04);
        const off = k * (len / 2 + 0.16);
        const m = put(shell, g, mat.curtain, inX + (vertical ? 0 : off), 1.36, inZ + (vertical ? off : 0), { noAO: false });
        if (vertical) m.rotation.y = Math.PI / 2;
      });
      if ((t === 'd' && side === 'n' && x1 > 1000) || (side === 'n' && x2 <= 530)) {
        const g = curtainGeo(len * 0.55, 2.66, 7, 0.03);
        const m = put(shell, g, mat.sheer, inX + (vertical ? out * 0.04 : len * 0.22), 1.36, inZ + (vertical ? len * 0.22 : out * 0.04), { cast: false, receive: false, noAO: true });
        if (vertical) m.rotation.y = Math.PI / 2;
      }
      // karnisz
      const rp = vertical ? [inX, 2.66, inZ - len / 2 - 0.45, inX, 2.66, inZ + len / 2 + 0.45] : [inX - len / 2 - 0.45, 2.66, inZ, inX + len / 2 + 0.45, 2.66, inZ];
      rod(shell, rp.slice(0, 3), rp.slice(3), 0.012, mat.black, { cast: false });
      windowLights.push({ cx: inX, cz: inZ, len, sill, top: TOP, vertical, out });
    });

    // ---------- drzwi wewnętrzne (otwarte skrzydło, opaski) ----------
    const doors = [
      [1283, 1250, 1300, 1345, 'y2', -1], [1075, 1655, 1165, 1670, 'x1', 1], [790, 1655, 885, 1670, 'x2', -1],
      [757, 1680, 770, 1775, 'y1', -1], [1440, 1020, 1455, 1105, 'y1', 1], [1440, 1210, 1455, 1300, 'y1', 1],
    ];
    doors.forEach(([x1, y1, x2, y2, hinge, side]) => {
      wall(x1, y1, x2, y2, 2.1, H);
      const vertical = x2 - x1 < y2 - y1;
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      // opaski po obu stronach
      [-1, 1].forEach((k) => {
        if (vertical) {
          const xx = k < 0 ? x1 - 1.5 : x2 + 1.5;
          pb(shell, xx - 1, y1 - 7, xx + 1, y1, 0, 2.17, mat.door, { cast: false });
          pb(shell, xx - 1, y2, xx + 1, y2 + 7, 0, 2.17, mat.door, { cast: false });
          pb(shell, xx - 1, y1 - 7, xx + 1, y2 + 7, 2.1, 2.17, mat.door, { cast: false });
        } else {
          const yy = k < 0 ? y1 - 1.5 : y2 + 1.5;
          pb(shell, x1 - 7, yy - 1, x1, yy + 1, 0, 2.17, mat.door, { cast: false });
          pb(shell, x2, yy - 1, x2 + 7, yy + 1, 0, 2.17, mat.door, { cast: false });
          pb(shell, x1 - 7, yy - 1, x2 + 7, yy + 1, 2.1, 2.17, mat.door, { cast: false });
        }
      });
      let hx;
      let hz;
      if (vertical) { hx = X((x1 + x2) / 2); hz = Z(hinge === 'y1' ? y1 : y2); }
      else { hz = Z((y1 + y2) / 2); hx = X(hinge === 'x1' ? x1 : x2); }
      const L = len - 0.04;
      const leaf = vertical ? put(shell, RB(L, 2.04, 0.04, 0.01), mat.door, hx + (side * L) / 2, 1.02, hz + (hinge === 'y1' ? 0.03 : -0.03))
        : put(shell, RB(0.04, 2.04, L, 0.01), mat.door, hx + (hinge === 'x1' ? 0.03 : -0.03), 1.02, hz + (side * L) / 2);
      // klamka czarna
      const tip = vertical ? [hx + side * (L - 0.07), 1.02, hz + (hinge === 'y1' ? 0.03 : -0.03)] : [hx + (hinge === 'x1' ? 0.03 : -0.03), 1.02, hz + side * (L - 0.07)];
      [-1, 1].forEach((k) => {
        const g = RB(vertical ? 0.13 : 0.02, 0.02, vertical ? 0.02 : 0.13, 0.008);
        put(shell, g, mat.black, tip[0] + (vertical ? -side * 0.05 : k * 0.045), tip[1], tip[2] + (vertical ? k * 0.045 : -side * 0.05), { cast: false });
      });
      void leaf;
    });
    // drzwi wejściowe (zamknięte) i białe drzwi przy ścianie TV
    wall(1470, 1340, 1495, 1455, 2.1, H);
    pb(shell, 1472, 1345, 1493, 1452, 0, 2.08, mat.doorDark, { uv: 1 });
    pb(shell, 1464, 1430, 1472, 1436, 1.0, 1.03, mat.chrome, { cast: false });
    pb(shell, 1436, 915, 1440, 995, 0, 2.06, mat.door);
    pb(shell, 1433, 915, 1436, 920, 0, 2.12, mat.door, { cast: false });
    pb(shell, 1433, 990, 1436, 995, 0, 2.12, mat.door, { cast: false });
    pb(shell, 1433, 915, 1436, 995, 2.06, 2.12, mat.door, { cast: false });
    pb(shell, 1428, 930, 1435, 945, 1.0, 1.02, mat.black, { cast: false });

    // ---------- listwy przypodłogowe (białe) ----------
    baseboards.forEach(([x1, y1, x2, y2]) => {
      const vertical = x2 - x1 < y2 - y1;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      [-1, 1].forEach((k) => {
        const px = vertical ? (k < 0 ? x1 - 6 : x2 + 6) : mx;
        const py = vertical ? my : k < 0 ? y1 - 6 : y2 + 6;
        const r = roomAtPx(px, py);
        if (!r || r.outdoor || r.floor === 'tile') return;
        if (vertical) pb(shell, k < 0 ? x1 - 1.4 : x2, y1, k < 0 ? x1 : x2 + 1.4, y2, 0, 0.08, mat.white, { cast: false });
        else pb(shell, x1, k < 0 ? y1 - 1.4 : y2, x2, k < 0 ? y1 : y2 + 1.4, 0, 0.08, mat.white, { cast: false });
      });
    });

    // ---------- okładziny ścian ----------
    const skin = (x1, y1, x2, y2, yb, yt, m, uv = 1.2) => pb(shell, x1, y1, x2, y2, yb, yt, m, { uv, cast: false });
    // salon: ściana TV (tapeta + czarny panel za TV), ściana za narożnikiem (tapeta)
    skin(1436, 400, 1440, 700, 0.08, H, mat.wallpaper);
    skin(1435, 700, 1440, 872, 0.08, H, mat.blackPaint);
    skin(1436, 872, 1440, 1000, 0.08, H, mat.wallpaper);
    skin(980, 996, 1300, 1000, 0.08, H, mat.wallpaper);
    // sypialnia: ściana za łóżkiem
    skin(222, 1312, 226, 1660, 0.08, H, mat.wallpaper);
    // pokój: tapeta „układ okresowy” na ścianie z biurkiem
    skin(982, 1015, 1283, 1019, 0.08, H, mat.periodic);
    // kuchnia: płytki betonowe między szafkami
    skin(1736, 740, 1740, 915, 0.92, 1.45, mat.backsplash);
    skin(1545, 976, 1740, 980, 0.92, 1.45, mat.backsplash);
    // gabinet: dębowy panel za biurkiem
    skin(961, 1440, 965, 1625, 0.76, 1.65, mat.oak, 1);

    // =================================================================
    // WYPOSAŻENIE
    // =================================================================
    const F = fixed;
    const L = loose;
    const radiatorV = (parent, x1, y1, x2, y2, h0, h1) => {
      // grzejnik rurowy, pionowy (czarny)
      const vertical = x2 - x1 < y2 - y1;
      const n = Math.max(4, Math.round(((vertical ? y2 - y1 : x2 - x1) * S) / 0.05));
      const g = cyl(0.016, 0.016, h1 - h0 - 0.08, 10);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const px = vertical ? (x1 + x2) / 2 : x1 + (x2 - x1) * t;
        const py = vertical ? y1 + (y2 - y1) * t : (y1 + y2) / 2;
        put(parent, g, mat.blackMatt, X(px), (h0 + h1) / 2, Z(py));
      }
      pb(parent, x1, y1, x2, y2, h0, h0 + 0.04, mat.blackMatt);
      pb(parent, x1, y1, x2, y2, h1 - 0.04, h1, mat.blackMatt);
    };
    const ac = (parent, x1, y1, x2, y2) => {
      prb(parent, x1, y1, x2, y2, 2.28, 2.58, mat.blackGloss, 0.04);
      pb(parent, x1 + 2, y1 + 1, x2 - 2, y2 - 1, 2.27, 2.29, mat.blackMatt, { cast: false });
    };
    const spot = (x, y) => {
      put(ceiling, cyl(0.04, 0.04, 0.11, 18), mat.black, X(x), H - 0.055, Z(y), { cast: false });
      put(ceiling, cyl(0.03, 0.03, 0.005, 14), mat.bulb, X(x), H - 0.112, Z(y), { cast: false, noAO: true });
    };
    const bulb = (parent, x, y, h, r = 0.035) => {
      put(parent, new THREE.SphereGeometry(r, 14, 10), mat.bulb, x, h, y, { cast: false, noAO: true });
      put(parent, cyl(r * 0.6, r * 0.6, r * 1.2, 10), mat.brass, x, h + r * 1.2, y, { cast: false });
    };
    // roślina: liście jako spłaszczone elipsoidy rozchodzące się od środka
    const leafGeo = new THREE.SphereGeometry(1, 8, 6);
    const plant = (parent, x, y, h0 = 0, s = 1, potM = mat.pot) => {
      put(parent, cyl(0.11 * s, 0.09 * s, 0.2 * s, 18), potM, X(x), h0 + 0.1 * s, Z(y));
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2;
        const r = (0.03 + rnd() * 0.12) * s;
        const hh = h0 + (0.24 + rnd() * 0.22) * s;
        const leaf = put(parent, leafGeo, i % 3 ? mat.plant : mat.plantLight, X(x) + Math.cos(a) * r, hh, Z(y) + Math.sin(a) * r, { s: [0.06 * s, 0.012 * s, 0.035 * s], cast: false });
        leaf.rotation.set((rnd() - 0.5) * 0.8, -a, 0.4 + rnd() * 0.5);
      }
    };
    const flowers = (parent, x, y, h0, m = mat.flowerPink) => {
      put(parent, cyl(0.06, 0.07, 0.24, 18), mat.white, X(x), h0 + 0.12, Z(y));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        put(parent, new THREE.IcosahedronGeometry(0.045, 1), i % 3 ? m : mat.flowerWhite, X(x) + Math.cos(a) * 0.09, h0 + 0.32 + rnd() * 0.08, Z(y) + Math.sin(a) * 0.09);
      }
      for (let i = 0; i < 5; i++) put(parent, new THREE.IcosahedronGeometry(0.04, 0), mat.plant, X(x) + (rnd() - 0.5) * 0.2, h0 + 0.28, Z(y) + (rnd() - 0.5) * 0.2, { s: [1.4, 0.5, 1] });
    };
    // lampa „klatka” (prostokątna, czarno-mosiężna), zawieszona
    const cageLamp = (parent, x, y, bottom, w = 0.14, h = 0.3) => {
      const cx = X(x);
      const cz = Z(y);
      rod(parent, [cx, H, cz], [cx, bottom + h, cz], 0.004, mat.black, { cast: false });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => rod(parent, [cx + (a * w) / 2, bottom, cz + (b * w) / 2], [cx + (a * w) / 2, bottom + h, cz + (b * w) / 2], 0.007, mat.black, { cast: false }));
      put(parent, new THREE.BoxGeometry(w + 0.02, 0.02, w + 0.02), mat.brass, cx, bottom + h, cz, { cast: false });
      put(parent, new THREE.BoxGeometry(w + 0.02, 0.02, w + 0.02), mat.brass, cx, bottom, cz, { cast: false });
      put(parent, cyl(0.022, 0.022, h * 0.7, 10), mat.bulb, cx, bottom + h * 0.5, cz, { cast: false, noAO: true });
    };
    // lampa klatka okrągła (świecznikowa) — sypialnia
    const lantern = (parent, x, y, bottom, r = 0.13, h = 0.3) => {
      const cx = X(x);
      const cz = Z(y);
      rod(parent, [cx, H, cz], [cx, bottom + h + 0.05, cz], 0.004, mat.black, { cast: false });
      put(parent, new THREE.TorusGeometry(r, 0.007, 6, 28), mat.black, cx, bottom, cz, { rx: Math.PI / 2, cast: false });
      put(parent, new THREE.TorusGeometry(r, 0.007, 6, 28), mat.black, cx, bottom + h, cz, { rx: Math.PI / 2, cast: false });
      put(parent, new THREE.ConeGeometry(r * 0.9, 0.08, 16, 1, true), mat.black, cx, bottom + h + 0.04, cz, { cast: false });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rod(parent, [cx + Math.cos(a) * r, bottom, cz + Math.sin(a) * r], [cx + Math.cos(a) * r, bottom + h, cz + Math.sin(a) * r], 0.004, mat.black, { cast: false });
      }
      bulb(parent, cx, cz, bottom + h * 0.4, 0.04);
    };

    // ---------------- SALON ----------------
    // narożnik skórzany: oparcie wzdłuż okna (zachód), szezlong na południu
    {
      const g = L;
      const legs = (x1, y1, x2, y2) => [[x1 + 5, y1 + 5], [x2 - 5, y1 + 5], [x1 + 5, y2 - 5], [x2 - 5, y2 - 5]].forEach(([x, y]) => put(g, cyl(0.012, 0.008, 0.12, 8), mat.black, X(x), 0.06, Z(y)));
      // podstawa
      prb(g, 988, 606, 1092, 838, 0.12, 0.42, mat.leather, 0.06);
      prb(g, 988, 838, 1198, 934, 0.12, 0.42, mat.leather, 0.06);
      legs(988, 606, 1092, 838);
      legs(988, 838, 1198, 934);
      // siedziska
      prb(g, 1012, 612, 1092, 722, 0.4, 0.5, mat.leather, 0.06, { seg: 4 });
      prb(g, 1012, 724, 1092, 836, 0.4, 0.5, mat.leather, 0.06, { seg: 4 });
      prb(g, 1012, 840, 1196, 932, 0.4, 0.5, mat.leather, 0.07, { seg: 4 });
      // oparcie wzdłuż ściany (pod parapetem) — lekko odchylone poduchy
      [[608, 722], [724, 836], [838, 934]].forEach(([a, b]) => {
        const m = prb(g, 990, a + 2, 1016, b - 2, 0.42, 0.82, mat.leather, 0.07, { seg: 4 });
        m.rotation.z = 0;
      });
      // podłokietnik od północy
      prb(g, 988, 596, 1092, 618, 0.12, 0.64, mat.leather, 0.05);
      // poduszki dekoracyjne (bukla) i koc
      put(g, RB(0.12, 0.42, 0.42, 0.08, 4), mat.boucle, X(1030), 0.7, Z(660), { rz: -0.25 });
      put(g, RB(0.12, 0.42, 0.42, 0.08, 4), mat.boucle, X(1030), 0.7, Z(880), { rz: -0.25 });
      put(g, RB(0.32, 0.03, 0.62, 0.015), mat.linen, X(1040), 0.655, Z(607), { rx: 0.05 });
      put(g, RB(0.03, 0.4, 0.62, 0.015), mat.linen, X(1050), 0.47, Z(594), {});
    }
    // puf
    prb(L, 1150, 640, 1240, 722, 0.12, 0.44, mat.leather, 0.05, { seg: 4 });
    [[1155, 645], [1235, 645], [1155, 717], [1235, 717]].forEach(([x, y]) => put(L, cyl(0.012, 0.008, 0.12, 8), mat.black, X(x), 0.06, Z(y)));
    put(L, new THREE.BoxGeometry(0.26, 0.012, 0.2), mat.white, X(1200), 0.447, Z(680), { ry: 0.3 });
    // złoty stolik-taca (okrągły) na czarnych nogach
    {
      const cx = X(1175);
      const cz = Z(790);
      put(L, cyl(0.4, 0.4, 0.015, 48), mat.gold, cx, 0.52, cz);
      put(L, cyl(0.405, 0.405, 0.05, 48, true), mat.gold, cx, 0.545, cz);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        rod(L, [cx + Math.cos(a) * 0.33, 0.515, cz + Math.sin(a) * 0.33], [cx - Math.cos(a) * 0.22, 0, cz - Math.sin(a) * 0.22], 0.008, mat.black);
      }
      put(L, cyl(0.07, 0.06, 0.1, 16), mat.wicker, cx + 0.05, 0.58, cz - 0.05);
      plant(L, PX(cx + 0.05), PY(cz - 0.05), 0.5, 0.7, mat.wicker);
      put(L, new THREE.BoxGeometry(0.28, 0.008, 0.21), mat.white, cx - 0.12, 0.532, cz + 0.12, { ry: -0.4 });
    }
    // stół jadalniany: dębowy blat na czarnej nodze „pająk”, 4 krzesła kubełkowe
    {
      const cx = X(1135);
      const cz = Z(530);
      put(L, RB(1.9, 0.045, 0.92, 0.008), mat.oak, cx, 0.745, cz);
      put(L, new THREE.BoxGeometry(0.12, 0.05, 0.12), mat.black, cx, 0.7, cz);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => rod(L, [cx, 0.7, cz], [cx + a * 0.62, 0.02, cz + b * 0.3], 0.025, mat.black));
      put(L, cyl(0.15, 0.08, 0.07, 24), mat.white, cx + 0.15, 0.8, cz);
      for (let i = 0; i < 6; i++) put(L, new THREE.SphereGeometry(0.04, 12, 8), mat.fruit, cx + 0.15 + Math.cos(i) * 0.07, 0.84, cz + Math.sin(i) * 0.07);
      const chair = (x, z, ry) => {
        const c = new THREE.Group();
        c.position.set(x, 0, z);
        c.rotation.y = ry;
        L.add(c);
        put(c, RB(0.5, 0.09, 0.48, 0.04, 3), mat.fabricDark, 0, 0.47, 0);
        const back = put(c, new THREE.CylinderGeometry(0.27, 0.25, 0.36, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat.fabricDark, 0, 0.7, 0.04);
        back.material = mat.fabricDark;
        put(c, new THREE.TorusGeometry(0.26, 0.025, 8, 24, Math.PI * 0.9), mat.fabricDark, 0, 0.88, 0.04, { rx: Math.PI / 2, rz: Math.PI * 1.05 });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => rod(c, [a * 0.15, 0.43, b * 0.15], [a * 0.23, 0, b * 0.23], 0.012, mat.black));
      };
      const fabricDS = mat.fabricDark;
      fabricDS.side = THREE.DoubleSide;
      chair(cx - 0.45, cz - 0.62, 0);
      chair(cx + 0.45, cz - 0.62, 0);
      chair(cx - 0.45, cz + 0.62, Math.PI);
      chair(cx + 0.45, cz + 0.62, Math.PI);
      // lampa nad stołem: belka z 5 żarówkami
      const by = 1.92;
      put(shell, new THREE.BoxGeometry(1.15, 0.035, 0.035), mat.black, cx, by, cz);
      put(shell, new THREE.BoxGeometry(1.17, 0.012, 0.045), mat.brass, cx, by + 0.025, cz, { cast: false });
      rod(shell, [cx - 0.4, by, cz], [cx - 0.4, H, cz], 0.005, mat.black, { cast: false });
      rod(shell, [cx + 0.4, by, cz], [cx + 0.4, H, cz], 0.005, mat.black, { cast: false });
      for (let i = 0; i < 5; i++) {
        const bx = cx - 0.44 + i * 0.22;
        put(shell, cyl(0.018, 0.018, 0.06, 10), mat.brass, bx, by - 0.04, cz, { cast: false });
        put(shell, new THREE.SphereGeometry(0.04, 14, 10), mat.bulb, bx, by - 0.1, cz, { cast: false, noAO: true });
      }
    }
    // lustro okrągłe (wypukłe) w czarnej ramie — ściana zachodnia przy jadalni
    put(shell, new THREE.TorusGeometry(0.34, 0.06, 14, 48), mat.black, X(982), 1.6, Z(575), { ry: Math.PI / 2 });
    put(shell, new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, 0.6), mat.mirror, X(982) - 0.5, 1.6, Z(575), { rz: -Math.PI / 2, cast: false });
    // grzejnik pionowy czarny + klimatyzator nad nim (ściana północna)
    radiatorV(shell, 1305, 403, 1368, 412, 0.14, 1.95);
    ac(shell, 1290, 402, 1395, 426);
    // ściana TV: szafka wisząca (szary dąb), kominek z nawilżaczem, telewizor
    pb(F, 1398, 548, 1438, 912, 0.24, 0.56, mat.oakGrey, { uv: 1 });
    for (let i = 1; i < 7; i++) pb(F, 1396, 548 + i * 52 - 1, 1398, 548 + i * 52 + 1, 0.25, 0.55, mat.blackMatt, { cast: false });
    pb(F, 1396, 548, 1438, 912, 0.56, 0.585, mat.oakGrey, { uv: 1, rot: true });
    pb(F, 1405, 600, 1432, 712, 0.585, 0.6, mat.blackMatt);
    for (let i = 0; i < 6; i++) {
      const g = cyl(0.035, 0.03, 0.26 + rnd() * 0.08, 10);
      put(F, g, mat.logs, X(1418 + (rnd() - 0.5) * 12), 0.63, Z(615 + i * 16), { rx: Math.PI / 2, ry: (rnd() - 0.5) * 0.6, rz: 0 });
    }
    pb(F, 1408, 604, 1430, 708, 0.6, 0.605, mat.fire, { cast: false, noAO: true });
    flowers(F, 1418, 572, 0.585);
    flowers(F, 1418, 895, 0.585, mat.flowerWhite);
    put(L, RB(0.035, 0.97, 1.7, 0.01), mat.tv, X(1430), 1.56, Z(786));
    cageLamp(shell, 1400, 600, 1.55);
    cageLamp(shell, 1400, 650, 1.55);
    // kinkiety nad narożnikiem (ściana z tapetą)
    [1060, 1110].forEach((x) => {
      put(shell, RB(0.1, 0.2, 0.06, 0.01), mat.black, X(x), 1.75, Z(995));
      put(shell, cyl(0.016, 0.016, 0.14, 10), mat.bulb, X(x), 1.75, Z(989), { cast: false, noAO: true });
      put(shell, new THREE.BoxGeometry(0.11, 0.015, 0.07), mat.brass, X(x), 1.86, Z(994), { cast: false });
    });
    // reflektory sufitowe
    [[1405, 590], [1405, 640], [1405, 690], [1090, 960], [1140, 960], [1190, 960], [1300, 450]].forEach(([x, y]) => spot(x, y));

    // włączniki i gniazdka (detale ze zdjęć)
    const plate = (x1, y1, x2, y2, h, m = mat.white, size = 0.085) => pb(shell, x1, y1, x2, y2, h - size / 2, h + size / 2, m, { cast: false });
    plate(1436, 525, 1438, 533, 1.1); // przy ścianie TV (salon-2)
    plate(1436, 535, 1438, 543, 1.1);
    plate(1436, 1003, 1438, 1011, 1.1);
    plate(1281, 1355, 1283, 1363, 1.1); // pokój
    plate(1076, 1653, 1084, 1655, 1.1); // łazienka
    plate(760, 1663, 768, 1665, 1.1);
    plate(1734, 785, 1736, 801, 1.08, mat.black); // kuchnia: czarne gniazdka na płytkach
    plate(1734, 875, 1736, 891, 1.08, mat.black);
    plate(1600, 974, 1616, 976, 1.08, mat.black);
    // ---------------- KUCHNIA ----------------
    // słupek z AGD (czarne szkło): lodówka side by side, 2 piekarniki, cargo
    pb(shell, 1480, 562, 1545, 880, 0, 2.55, mat.front);
    pb(shell, 1545, 566, 1548, 700, 0.06, 2.0, mat.blackGloss, { cast: false });
    pb(shell, 1545, 632, 1549, 634, 0.06, 2.0, mat.black, { cast: false });
    pb(shell, 1545, 704, 1548, 798, 0.95, 1.52, mat.blackGloss, { cast: false });
    pb(shell, 1545, 704, 1548, 798, 1.56, 2.12, mat.blackGloss, { cast: false });
    pb(shell, 1548, 710, 1551, 792, 1.46, 1.48, mat.chrome, { cast: false });
    pb(shell, 1548, 710, 1551, 792, 2.04, 2.06, mat.chrome, { cast: false });
    pb(shell, 1545, 702, 1548, 704, 0.06, 2.55, mat.black, { cast: false });
    pb(shell, 1545, 798, 1548, 800, 0.06, 2.55, mat.black, { cast: false });
    // słupek z szafami (szary dąb) przy ścianie wschodniej + listwy dębowe
    pb(shell, 1672, 402, 1740, 738, 0, 2.6, mat.oakKitchen, { uv: 1 });
    for (let i = 1; i < 4; i++) pb(shell, 1670, 402 + i * 84 - 1, 1672, 402 + i * 84 + 1, 0.05, 2.55, mat.blackMatt, { cast: false });
    for (let i = 0; i < 5; i++) pb(shell, 1668 - (i % 2) * 2, 726 + i * 3, 1672, 728 + i * 3, 0.05, 2.55, mat.oak, { cast: false });
    // dolne szafki czarny mat (bez uchwytów, z czarnym profilem), blat z czarnego granitu
    pb(F, 1676, 740, 1740, 915, 0.1, 0.88, mat.front);
    pb(F, 1548, 915, 1740, 980, 0.1, 0.88, mat.front);
    pb(F, 1680, 740, 1740, 915, 0, 0.1, mat.blackMatt);
    pb(F, 1548, 920, 1740, 980, 0, 0.1, mat.blackMatt);
    [0.72, 0.42].forEach((h) => { pb(F, 1674, 740, 1676, 915, h, h + 0.025, mat.black, { cast: false }); pb(F, 1548, 913, 1676, 915, h, h + 0.025, mat.black, { cast: false }); });
    pb(F, 1670, 736, 1740, 917, 0.88, 0.915, mat.granite, { uv: 0.6 });
    pb(F, 1546, 911, 1740, 980, 0.88, 0.915, mat.granite, { uv: 0.6 });
    pb(F, 1686, 770, 1730, 855, 0.916, 0.92, mat.blackGloss, { cast: false }); // zlew granitowy
    rod(F, [X(1725), 0.915, Z(812)], [X(1725), 1.22, Z(812)], 0.012, mat.black);
    put(F, new THREE.TorusGeometry(0.1, 0.012, 8, 20, Math.PI), mat.black, X(1725) - 0.1, 1.22, Z(812), { cast: false });
    pb(F, 1568, 925, 1650, 972, 0.916, 0.921, mat.blackGloss, { cast: false }); // płyta indukcyjna
    put(F, cyl(0.1, 0.08, 0.06, 20), mat.white, X(1700), 0.95, Z(950));
    for (let i = 0; i < 4; i++) put(F, new THREE.SphereGeometry(0.035, 10, 8), i % 2 ? mat.fruit : mat.kidYellow, X(1700) + Math.cos(i * 1.6) * 0.05, 0.98, Z(950) + Math.sin(i * 1.6) * 0.05);
    // szafki górne (szary dąb) z oświetleniem LED
    pb(shell, 1706, 742, 1740, 913, 1.45, 2.35, mat.oakKitchen, { uv: 1 });
    pb(shell, 1548, 946, 1705, 980, 1.45, 2.35, mat.oakKitchen, { uv: 1 });
    pb(shell, 1706, 744, 1709, 911, 1.44, 1.45, mat.led, { cast: false, noAO: true });
    pb(shell, 1550, 943, 1703, 946, 1.44, 1.45, mat.led, { cast: false, noAO: true });
    [[1600, 700], [1620, 830]].forEach(([x, y]) => spot(x, y));

    // ---------------- PRZEDPOKÓJ ----------------
    pb(shell, 1402, 1600, 1466, 1802, 0, 2.6, mat.walnut, { uv: 1 });
    for (let i = 1; i < 3; i++) pb(shell, 1400, 1600 + i * 67 - 1, 1402, 1600 + i * 67 + 1, 0.05, 2.55, mat.blackMatt, { cast: false });
    [[1385, 1150], [1385, 1350], [1385, 1550], [1200, 1735], [1000, 1735], [850, 1735]].forEach(([x, y]) => spot(x, y));

    // ---------------- SYPIALNIA ----------------
    // wezgłowie tapicerowane z przeszyciami (ściana zachodnia)
    prb(L, 225, 1440, 238, 1648, 0.1, 1.28, mat.headboard, 0.03);
    for (let i = 0; i < 8; i++) prb(L, 236, 1444 + i * 25.5, 246, 1468 + i * 25.5, 0.36, 1.24, mat.headboard, 0.03, { seg: 3 });
    prb(L, 246, 1456, 458, 1632, 0.12, 0.36, mat.headboard, 0.03);
    prb(L, 248, 1458, 456, 1630, 0.36, 0.55, mat.linen, 0.07, { seg: 4 });
    prb(L, 320, 1452, 462, 1636, 0.5, 0.57, mat.boucle, 0.03); // narzuta pikowana
    prb(L, 400, 1450, 440, 1638, 0.555, 0.585, mat.throwGrey, 0.015); // pled
    [[1478, mat.boucle], [1527, mat.boucle], [1578, mat.boucle], [1612, mat.boucle]].forEach(([y, m]) => put(L, RB(0.16, 0.5, 0.52, 0.09, 4), m, X(262), 0.76, Z(y), { rz: -0.32 }));
    [[1500, mat.throwGrey], [1555, mat.linen], [1598, mat.throwGrey]].forEach(([y, m]) => put(L, RB(0.13, 0.36, 0.4, 0.07, 4), m, X(292), 0.68, Z(y), { rz: -0.42 }));
    // lampy wiszące przy łóżku (latarnie) + żyrandol
    lantern(shell, 248, 1418, 1.15, 0.1, 0.24);
    lantern(shell, 248, 1672, 1.15, 0.1, 0.24);
    lantern(shell, 400, 1545, 2.12, 0.15, 0.26);
    // zegar ścienny na ścianie wschodniej
    put(shell, cyl(0.42, 0.42, 0.04, 48), mat.black, X(594), 1.62, Z(1500), { rz: Math.PI / 2 });
    put(shell, new THREE.CircleGeometry(0.39, 48), mat.clock, X(594) - 0.022, 1.62, Z(1500), { ry: -Math.PI / 2, cast: false });
    put(shell, new THREE.TorusGeometry(0.06, 0.012, 8, 20), mat.black, X(594) - 0.01, 2.07, Z(1500), { ry: Math.PI / 2, cast: false });
    // grzejnik pionowy + klimatyzator (ściana północna przy narożniku)
    radiatorV(shell, 540, 1313, 590, 1322, 0.14, 1.85);
    ac(shell, 535, 1313, 595, 1336);
    // fotel „butterfly” (czarna skóra na stelażu)
    {
      const cx = X(500);
      const cz = Z(1385);
      const ch = new THREE.Group();
      ch.position.set(cx, 0, cz);
      ch.rotation.y = 0.6;
      L.add(ch);
      rod(ch, [-0.33, 0, -0.3], [0.33, 0.9, -0.3], 0.01, mat.black);
      rod(ch, [0.33, 0, -0.3], [-0.33, 0.9, -0.3], 0.01, mat.black);
      rod(ch, [-0.33, 0, 0.3], [0.33, 0.55, 0.3], 0.01, mat.black);
      rod(ch, [0.33, 0, 0.3], [-0.33, 0.55, 0.3], 0.01, mat.black);
      const sling = new THREE.PlaneGeometry(0.7, 0.85, 8, 10);
      const pa = sling.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const x = pa.getX(i); pa.setZ(i, -0.25 * (1 - (y / 0.425) ** 2) - 0.08 * (1 - (x / 0.35) ** 2)); }
      sling.computeVertexNormals();
      const leatherDS = M({ color: 0x232325, roughness: 0.5, side: THREE.DoubleSide }, 1);
      put(ch, sling, leatherDS, 0, 0.55, 0, { rx: -0.95 });
      put(ch, RB(0.5, 0.03, 0.6, 0.015), mat.linen, 0.05, 0.48, 0.05, { rx: -0.5, rz: 0.2 });
    }
    // szafy (szary dąb) wzdłuż ściany południowej, długie czarne uchwyty
    pb(shell, 224, 1778, 597, 1836, 0, 2.6, mat.oakGrey, { uv: 1 });
    for (let i = 1; i < 5; i++) {
      pb(shell, 224 + i * 74.6 - 1, 1776, 224 + i * 74.6 + 1, 1778, 0.05, 2.55, mat.blackMatt, { cast: false });
      pb(shell, 224 + i * 74.6 - 9, 1774, 224 + i * 74.6 - 6, 1778, 0.8, 1.9, mat.black, { cast: false });
    }
    [[680, 1745], [680, 1700]].forEach(([x, y]) => spot(x, y));

    // ---------------- POKÓJ (szafy betonowe z falistymi uchwytami) ----------------
    pb(shell, 984, 1365, 1281, 1423, 0, 2.6, mat.concreteGrey, { uv: 1.2 });
    for (let i = 1; i < 4; i++) pb(shell, 984 + i * 74 - 1, 1363, 984 + i * 74 + 1, 1365, 0.05, 2.55, mat.blackMatt, { cast: false });
    for (let i = 0; i < 4; i++) {
      const hx = X(984 + i * 74 + (i % 2 ? 8 : 66));
      const hz = Z(1362);
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 2) * 0.025 * (t > 0.3 && t < 0.7 ? 1.6 : 1), 0.7 + t * 1.0, 0)); }
      put(shell, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.007, 6), mat.black, hx, 0, hz, { cast: false });
    }
    radiatorV(shell, 984, 1060, 993, 1150, 0.14, 0.85);
    // lampa „pająk” z reflektorami
    {
      const cx = X(1130);
      const cz = Z(1200);
      put(shell, cyl(0.06, 0.06, 0.03, 18), mat.black, cx, H - 0.015, cz, { cast: false });
      [[-0.6, -0.4], [0.55, -0.2], [0.1, 0.5]].forEach(([a, b]) => {
        rod(shell, [cx, H - 0.03, cz], [cx + a, H - 0.25, cz + b], 0.008, mat.black, { cast: false });
        put(shell, cyl(0.03, 0.03, 0.16, 12), mat.black, cx + a, H - 0.33, cz + b, { cast: false });
      });
    }

    // ---------------- GABINET ----------------
    pb(shell, 614, 1314, 676, 1653, 0, 2.6, mat.walnut, { uv: 1 }); // szafa orzechowa
    for (let i = 1; i < 4; i++) pb(shell, 676, 1314 + i * 85 - 1, 678, 1314 + i * 85 + 1, 0.05, 2.55, mat.blackMatt, { cast: false });
    radiatorV(shell, 770, 1313, 860, 1322, 0.14, 0.72);
    // roleta rzymska w oknie
    for (let i = 0; i < 4; i++) pb(shell, 752, 1300 - i * 0.5, 878, 1305, 2.18 + i * 0.07, 2.25 + i * 0.07, mat.linen, { cast: false });

    // ---------------- ŁAZIENKA Z WANNĄ ----------------
    pb(F, 1196, 1446, 1281, 1612, 0, 0.56, mat.stone, { uv: 1.2 });
    prb(F, 1203, 1452, 1274, 1606, 0.5, 0.575, mat.ceramic, 0.03);
    pb(F, 1210, 1460, 1267, 1598, 0.574, 0.576, mat.chrome, { cast: false });
    rod(F, [X(1238), 0.8, Z(1446)], [X(1238), 1.0, Z(1446)], 0.012, mat.chrome);
    pb(F, 1040, 1446, 1176, 1494, 0.45, 0.85, mat.oakVanity, { uv: 1 });
    pb(F, 1040, 1494, 1176, 1496, 0.64, 0.655, mat.blackMatt, { cast: false });
    prb(F, 1036, 1444, 1180, 1498, 0.85, 0.97, mat.ceramic, 0.015);
    rod(F, [X(1108), 0.97, Z(1452)], [X(1108), 1.14, Z(1452)], 0.012, mat.chrome);
    put(shell, new THREE.CircleGeometry(0.3, 40), mat.mirror, X(1108), 1.62, Z(1446), { cast: false });
    put(shell, new THREE.TorusGeometry(0.3, 0.012, 8, 40), mat.black, X(1108), 1.62, Z(1447), { cast: false });
    rod(shell, [X(1108) - 0.29, 1.66, Z(1446)], [X(1108), 2.1, Z(1446)], 0.008, mat.leather, { cast: false });
    rod(shell, [X(1108) + 0.29, 1.66, Z(1446)], [X(1108), 2.1, Z(1446)], 0.008, mat.leather, { cast: false });
    cageLamp(shell, 1050, 1470, 1.65, 0.1, 0.22);
    prb(F, 990, 1590, 1035, 1645, 0.34, 0.48, mat.ceramic, 0.07);
    pb(F, 1000, 1640, 1028, 1655, 0.3, 1.1, mat.stone, { uv: 1.2 });
    put(F, RB(0.04, 0.55, 0.3, 0.02), mat.linen, X(990), 1.0, Z(1520));
    // łazienka 2 (prysznic) i pralnia
    pb(F, 1627, 1006, 1709, 1078, 0, 0.03, mat.stone, { cast: false });
    put(F, new THREE.BoxGeometry(0.01, 2.0, (1078 - 1006) * S), mat.glass, X(1627), 1.02, Z(1042), { cast: false, receive: false, noAO: true });
    put(shell, cyl(0.12, 0.12, 0.01, 24), mat.chrome, X(1690), 2.22, Z(1030), { cast: false });
    pb(F, 1462, 1112, 1530, 1154, 0.5, 0.82, mat.oakGrey);
    prb(F, 1460, 1110, 1532, 1156, 0.82, 0.92, mat.ceramic, 0.015);
    prb(F, 1560, 1110, 1600, 1154, 0.34, 0.48, mat.ceramic, 0.07);
    prb(F, 1602, 1178, 1666, 1240, 0, 0.85, mat.white, 0.03);
    prb(F, 1602, 1178, 1666, 1240, 0.87, 1.72, mat.white, 0.03);
    put(F, cyl(0.2, 0.2, 0.02, 28), mat.blackGloss, X(1601), 0.45, Z(1209), { rz: Math.PI / 2, cast: false });
    put(F, cyl(0.2, 0.2, 0.02, 28), mat.blackGloss, X(1601), 1.3, Z(1209), { rz: Math.PI / 2, cast: false });

    // ---------------- TARAS I LOGGIA ----------------
    const rail = (x1, y1, x2, y2) => {
      const vertical = x2 - x1 < y2 - y1;
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const cx = X((x1 + x2) / 2);
      const cz = Z((y1 + y2) / 2);
      const gm = put(world, new THREE.BoxGeometry(vertical ? 0.012 : len, 1.0, vertical ? len : 0.012), mat.glass, cx, 0.56, cz, { cast: false, receive: false, noAO: true });
      glassMeshes.push(gm);
      put(world, new THREE.BoxGeometry(vertical ? 0.06 : len, 0.045, vertical ? len : 0.06), mat.alu, cx, 1.1, cz);
      put(world, new THREE.BoxGeometry(vertical ? 0.08 : len, 0.05, vertical ? len : 0.08), mat.alu, cx, 0.03, cz);
      const n = Math.max(1, Math.round(len / 1.35));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        put(world, new THREE.BoxGeometry(0.05, 1.1, 0.05), mat.alu, vertical ? cx : X(x1 + (x2 - x1) * t), 0.55, vertical ? Z(y1 + (y2 - y1) * t) : cz);
      }
    };
    rail(957, 42, 1685, 46);
    rail(957, 42, 961, 352);
    rail(1681, 42, 1685, 352);
    rail(220, 1108, 937, 1112);
    rail(220, 1108, 224, 1270);
    // skrzynia z drewna modrzewiowego (zdjęcie tarasu) i białe donice z kwiatami
    pb(F, 1572, 58, 1676, 132, 0.02, 0.74, mat.larch, { uv: 0.5 });
    pb(F, 1570, 56, 1678, 134, 0.74, 0.78, mat.larch, { uv: 0.5, rot: true });
    [[1655, 205], [1655, 290]].forEach(([x, y]) => {
      put(L, cyl(0.18, 0.13, 0.62, 24), mat.pot, X(x), 0.31, Z(y));
      for (let i = 0; i < 10; i++) { const a = rnd() * 6.28; put(L, new THREE.IcosahedronGeometry(0.07, 0), i % 3 ? mat.plant : mat.kidPink, X(x) + Math.cos(a) * 0.1, 0.68 + rnd() * 0.06, Z(y) + Math.sin(a) * 0.1); }
    });
    // loggia: jednostka zewnętrzna klimatyzacji
    prb(F, 232, 1196, 300, 1262, 0.02, 0.62, mat.white, 0.02);
    put(F, new THREE.TorusGeometry(0.16, 0.01, 6, 24), mat.alu, X(301), 0.32, Z(1229), { ry: Math.PI / 2, cast: false });

    // =================================================================
    // WARIANTY POKOI
    // =================================================================
    const variantGroup = (room, id) => {
      const g = new THREE.Group();
      g.userData.loose = new THREE.Group();
      g.add(g.userData.loose);
      scene.add(g);
      variants[room][id] = g;
      return g;
    };
    const desk = (parent, x1, y1, x2, y2, top = mat.oak, frame = mat.black) => {
      prb(parent, x1, y1, x2, y2, 0.72, 0.76, top, 0.008, { rot: true });
      [[x1 + 3, y1 + 3], [x2 - 3, y1 + 3], [x1 + 3, y2 - 3], [x2 - 3, y2 - 3]].forEach(([x, y]) => pb(parent, x - 2, y - 2, x + 2, y + 2, 0, 0.72, frame, { cast: true }));
      pb(parent, x1 + 3, y1 + 1, x2 - 3, y1 + 3, 0.68, 0.72, frame, { cast: false });
    };
    const officeChair = (parent, x, y, ry, m = mat.fabricDark) => {
      const c = new THREE.Group();
      c.position.set(X(x), 0, Z(y));
      c.rotation.y = ry;
      parent.add(c);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; rod(c, [0, 0.08, 0], [Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3], 0.015, mat.chrome); put(c, new THREE.SphereGeometry(0.025, 8, 6), mat.black, Math.cos(a) * 0.3, 0.025, Math.sin(a) * 0.3); }
      put(c, cyl(0.025, 0.025, 0.36, 10), mat.chrome, 0, 0.26, 0);
      put(c, RB(0.52, 0.09, 0.5, 0.04, 4), m, 0, 0.48, 0);
      put(c, RB(0.5, 0.62, 0.08, 0.05, 4), m, 0, 0.88, 0.24, { rx: -0.12 });
    };
    const bed = (parent, x1, y1, x2, y2, head, cover = mat.linen, frame = mat.fabricGrey) => {
      prb(parent, x1, y1, x2, y2, 0.1, 0.35, frame, 0.03);
      prb(parent, x1 + 2, y1 + 2, x2 - 2, y2 - 2, 0.35, 0.52, cover, 0.06, { seg: 4 });
      const hb = { n: [x1, y1 - 8, x2, y1], s: [x1, y2, x2, y2 + 8], w: [x1 - 8, y1, x1, y2], e: [x2, y1, x2 + 8, y2] }[head];
      prb(parent, ...hb, 0.1, 1.05, frame, 0.03);
      const pw = { n: [x1 + 8, y1 + 4, x2 - 8, y1 + 40], s: [x1 + 8, y2 - 40, x2 - 8, y2 - 4], w: [x1 + 4, y1 + 8, x1 + 40, y2 - 8], e: [x2 - 40, y1 + 8, x2 - 4, y2 - 8] }[head];
      prb(parent, ...pw, 0.52, 0.64, mat.white, 0.05, { seg: 4 });
    };
    const toyShelf = (parent, x1, y1, x2, y2) => {
      pb(parent, x1, y1, x2, y2, 0, 0.9, mat.white);
      [mat.kidBlue, mat.kidYellow, mat.kidPink].forEach((m, i) => put(parent, RB(0.2, 0.2, 0.2, 0.03), m, X(x1 + ((x2 - x1) * (i + 0.5)) / 3), 1.0, Z((y1 + y2) / 2)));
    };
    const roundRug = (parent, x, y, r, m) => put(parent, cyl(r, r, 0.012, 48), m, X(x), 0.007, Z(y), { cast: false });

    // Pokój 10,46 m²: do pracy (jak na zdjęciu) / gościnny / dziecięcy
    {
      const g = variantGroup('pokoj', 'praca').userData.loose;
      // biurko betonowe na czarnym stelażu, półki, taboret
      pb(g, 1095, 1019, 1260, 1082, 0.72, 0.78, mat.concreteGrey, { uv: 1 });
      pb(g, 1100, 1078, 1255, 1082, 0.58, 0.72, mat.concreteGrey, { uv: 1 });
      [[1098, 1078], [1257, 1078]].forEach(([x, y]) => { pb(g, x - 2, 1019, x + 2, y, 0, 0.03, mat.black); pb(g, x - 2, y - 3, x + 2, y + 1, 0, 0.72, mat.black); });
      [1.25, 1.5, 1.75].forEach((h) => pb(g, 1020, 1019, 1090, 1046, h, h + 0.03, mat.concreteGrey, { uv: 1 }));
      put(g, cyl(0.035, 0.035, 0.08, 16), mat.white, X(1045), 1.57, Z(1030));
      plant(g, 1110, 1040, 0.78, 0.6, mat.wicker);
      pb(g, 1160, 1120, 1210, 1160, 0.42, 0.46, mat.blackMatt);
      [[1162, 1122], [1208, 1122], [1162, 1158], [1208, 1158]].forEach(([x, y]) => pb(g, x - 1.5, y - 1.5, x + 1.5, y + 1.5, 0, 0.42, mat.blackMatt));
    }
    {
      const g = variantGroup('pokoj', 'gosc').userData.loose;
      bed(g, 1060, 1022, 1212, 1235, 'n', mat.linen, mat.fabricGrey);
      pb(g, 1012, 1022, 1052, 1060, 0, 0.5, mat.oakGrey);
      pb(g, 1220, 1022, 1260, 1060, 0, 0.5, mat.oakGrey);
    }
    {
      const g = variantGroup('pokoj', 'dziecko').userData.loose;
      bed(g, 1188, 1100, 1280, 1310, 'n', mat.kidBlue, mat.white);
      desk(g, 1000, 1022, 1120, 1080, mat.white, mat.white);
      officeChair(g, 1060, 1115, 0, mat.kidYellow);
      toyShelf(g, 1130, 1022, 1180, 1060);
      roundRug(g, 1090, 1230, 0.75, mat.kidYellow);
    }
    // Gabinet 10,35 m²: gabinet (jak na zdjęciu) / pokój dziecka / garderoba
    {
      const v = variantGroup('gabinet', 'gabinet');
      const g = v.userData.loose;
      desk(g, 900, 1445, 962, 1620, mat.oak, mat.black);
      officeChair(g, 860, 1530, -Math.PI / 2, mat.leather);
      // przeszklona szafka nad biurkiem (czarne ramy) i kinkiety mosiężne
      v.userData.shell = new THREE.Group();
      shell.add(v.userData.shell);
      const sh = v.userData.shell;
      pb(sh, 925, 1445, 962, 1620, 1.72, 2.5, mat.black);
      pb(sh, 924, 1449, 925, 1531, 1.76, 2.46, mat.glassDark, { cast: false, receive: false, noAO: true });
      pb(sh, 924, 1534, 925, 1616, 1.76, 2.46, mat.glassDark, { cast: false, receive: false, noAO: true });
      pb(sh, 926, 1447, 960, 1618, 2.1, 2.12, mat.glass, { cast: false, noAO: true });
      [1480, 1585].forEach((y) => {
        put(sh, cyl(0.035, 0.035, 0.03, 12), mat.brass, X(960), 1.45, Z(y), { rz: Math.PI / 2 });
        put(sh, cyl(0.045, 0.045, 0.14, 16), mat.glass, X(948), 1.42, Z(y), { cast: false, noAO: true });
        bulb(sh, X(948), Z(y), 1.38, 0.03);
      });
      put(g, RB(0.12, 0.1, 0.16, 0.02), mat.black, X(945), 0.82, Z(1600));
    }
    {
      const v = variantGroup('gabinet', 'dziecko');
      const g = v.userData.loose;
      bed(g, 870, 1334, 962, 1545, 'n', mat.kidPink, mat.white);
      desk(g, 690, 1326, 830, 1390, mat.white, mat.white);
      officeChair(g, 760, 1430, 0, mat.kidBlue);
      toyShelf(g, 690, 1560, 770, 1600);
      roundRug(g, 780, 1500, 0.65, mat.kidBlue);
    }
    {
      const v = variantGroup('gabinet', 'garderoba');
      v.userData.shell = new THREE.Group();
      shell.add(v.userData.shell);
      pb(v.userData.shell, 905, 1330, 963, 1653, 0, 2.6, mat.walnut, { uv: 1 });
      for (let i = 1; i < 4; i++) pb(v.userData.shell, 903, 1330 + i * 80 - 1, 905, 1330 + i * 80 + 1, 0.05, 2.55, mat.black, { cast: false });
      const g = v.userData.loose;
      pb(g, 730, 1440, 850, 1540, 0.05, 0.9, mat.oakGrey);
      pb(g, 728, 1438, 852, 1542, 0.9, 0.93, mat.granite);
      prb(g, 760, 1580, 830, 1630, 0, 0.42, mat.boucle, 0.08);
      pb(g, 690, 1330, 760, 1336, 0.05, 1.9, mat.mirror, { cast: false });
    }

    // =================================================================
    // NA ZEWNĄTRZ: budynek pod mieszkaniem, panorama ze zdjęcia, niebo
    // =================================================================
    const GROUND = -33.6;
    const roofTex = mottled([62, 64, 66], [92, 94, 96], 24, 1.3, 256);
    roofTex.repeat.set(6, 7);
    const roofMat = M({ map: roofTex, roughness: 0.95 }, 0.4);
    const facade = put(outside, new THREE.BoxGeometry(1600 * S, -GROUND - 0.34, 1850 * S), [mat.facade, mat.facade, roofMat, mat.facade, mat.facade, mat.facade], X(980), (GROUND - 0.34) / 2, Z(955), { cast: false, noAO: true });
    mat.facade.map.repeat.set(3, 5.5);
    void facade;
    // niebo / tło studia (mieszanie wg trybu)
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
    // panorama: zdjęcie z tarasu na walcu (lustrzane powtórzenia dookoła)
    const pano = window.PH_PANO;
    const R = 900;
    const panoMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.BackSide });
    let panoMesh = null;
    const panoLights = new THREE.Group();
    if (pano) {
      const tl = new THREE.TextureLoader();
      const t = tl.load(pano.src, () => { dirty = true; envDirty = true; });
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.MirroredRepeatWrapping;
      t.anisotropy = aniso;
      panoMat.map = t;
      const span = pano.span;
      const segs = Math.round((Math.PI * 2) / span / 2) * 2; // parzysta liczba segmentów → ciągłość
      const segSpan = (Math.PI * 2) / segs;
      t.repeat.set(segs, 1);
      // środek kadru zdjęcia (oś obiektywu) w kierunku północy rzutu (-Z), czyli θ = π
      const u0 = 1 - pano.phiCenter; // obraz odwrócony poziomo
      t.offset.set(u0 - (Math.PI / segSpan), 0);
      const hgt = R * (pano.tTop - pano.tBot);
      const g = new THREE.CylinderGeometry(R, R, hgt, 128, 1, true);
      panoMesh = put(outside, g, panoMat, 0, EYE + (R * (pano.tTop + pano.tBot)) / 2, 0, { cast: false, receive: false, noAO: true });
      panoMesh.renderOrder = -1;
      // światła miasta nocą
      const pts = [];
      for (let i = 0; i < 1600; i++) {
        const a = rnd() * Math.PI * 2;
        const tt = pano.tBot * 0.7 + rnd() * (0.01 - pano.tBot * 0.7);
        pts.push(Math.sin(a) * (R - 5), EYE + tt * (R - 5), Math.cos(a) * (R - 5));
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const pl = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffd9a0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
      panoLights.add(pl);
      outside.add(panoLights);
    }
    outside.visible = false;

    // =================================================================
    // ŚWIATŁA
    // =================================================================
    const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x7b6e62, 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1de, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(HQ ? 4096 : 2048, HQ ? 4096 : 2048);
    Object.assign(sun.shadow.camera, { left: -12.5, right: 12.5, top: 12.5, bottom: -12.5, near: 1, far: 90 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    sun.target.position.set(X(980), 0, Z(950));
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
    const lampDefs = [[1135, 530, 1.75, 1], [1400, 625, 1.45, 0.6], [1140, 940, 2.55, 0.7], [1630, 800, 2.4, 0.8], [400, 1545, 1.8, 0.9], [1130, 1220, 2.3, 0.7], [930, 1530, 1.4, 0.5], [1385, 1450, 2.5, 0.6]];
    const lamps = (HQ ? lampDefs : [lampDefs[0], lampDefs[3], lampDefs[4], lampDefs[7]].map((d) => [d[0], d[1], d[2], d[3] * 1.4])).map(([x, y, h, k]) => {
      const l = new THREE.PointLight(0xffc988, 0, 7.5, 2);
      l.position.set(X(x), h, Z(y));
      l.userData.k = k;
      scene.add(l);
      return l;
    });

    // pory dnia: [stan dla makiety, stan dla spaceru]
    const sunDir = (bearing, elev) => new THREE.Vector3(Math.sin(bearing) * Math.cos(elev), Math.sin(elev), -Math.cos(bearing) * Math.cos(elev));
    const C = (v) => new THREE.Color(v);
    const TIMES = {
      day: {
        sun: C(0xffe9cf), sunI: 5.5, dir: sunDir(-1.72, 0.44), hemiS: C(0xdfe8f2), hemiG: C(0x8a7d70), hemiDoll: 1.2, hemiWalk: 0.34, rect: 2.2, rectC: C(0xe8f0ff), env: 0.9, envWalk: 0.7,
        lamp: 0, bulb: 0.15, fire: 0.04, led: 2.2, city: 0, exp: 1.18, top: C(0x3a74cc), mid: C(0xc3d6e8), bot: C((window.PH_PANO && window.PH_PANO.bot) || 0x5f6064), sTop: C(0xf6f4f0), sBot: C(0xdcd6cd), pano: C(0xffffff),
      },
      sunset: {
        sun: C(0xffa25a), sunI: 3.2, dir: sunDir(-1.95, 0.12), hemiS: C(0xf2c6a4), hemiG: C(0x4a3e44), hemiDoll: 0.8, hemiWalk: 0.22, rect: 1.6, rectC: C(0xffcfa8), env: 0.6, envWalk: 0.55,
        lamp: 4, bulb: 1.4, fire: 1.4, led: 1.2, city: 0.35, exp: 1.05, top: C(0x2b3b6c), mid: C(0xf0a46c), bot: C(0x5a4f52), sTop: C(0xefe2d4), sBot: C(0xd2bfad), pano: C(0xf4c7a6),
      },
      night: {
        sun: C(0x9fb2ff), sunI: 0.08, dir: sunDir(-0.8, 0.9), hemiS: C(0x2a3658), hemiG: C(0x0d0f16), hemiDoll: 0.35, hemiWalk: 0.06, rect: 0.15, rectC: C(0x6f86c2), env: 0.18, envWalk: 0.2,
        lamp: 11, bulb: 3.2, fire: 3, led: 2.5, city: 1, exp: 1.08, top: C(0x03060f), mid: C(0x17213a), bot: C(0x0b0d13), sTop: C(0x1d2236), sBot: C(0x0e1020), pano: C(0x1d2540),
      },
    };
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
    cubeCam.position.set(X(1215), 1.45, Z(760));
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
    const floorTex = { gres: T.gres, dab: T.dab, jodelka: T.jodelka, mikro: T.mikro };
    const applyCfg = (p) => {
      if (p.floor) {
        const t = floorTex[p.floor] || T.gres;
        mat.floor.map = t.map;
        mat.floor.bumpMap = t.bump;
        mat.floor.roughnessMap = t.rough;
        mat.floor.needsUpdate = true;
        envDirty = true;
      }
      if (p.walls) { mat.paint.color.set((PH.config.walls.find((w) => w.id === p.walls) || PH.config.walls[0]).color); envDirty = true; }
      if (p.kitchen) {
        const k2 = PH.config.kitchen.find((w) => w.id === p.kitchen) || PH.config.kitchen[0];
        if (k2.id === 'dab') { mat.front.map = T.oak; mat.front.color.set(0xffffff); }
        else { mat.front.map = null; mat.front.color.set(k2.color); }
        mat.front.roughness = k2.id === 'bialy' ? 0.35 : 0.62;
        mat.front.needsUpdate = true;
      }
      if (p.pokoj || p.gabinet || p.furniture) {
        ['pokoj', 'gabinet'].forEach((room) => Object.entries(variants[room]).forEach(([id, g]) => {
          const on = cfg[room] === id;
          g.visible = on;
          if (g.userData.shell) g.userData.shell.visible = on;
          g.userData.loose.visible = cfg.furniture !== 'off';
        }));
        loose.visible = cfg.furniture !== 'off';
      }
      if (p.time) setTime(p.time);
      shadowsDirty();
      dirty = true;
    };

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
    const orbit = { theta: 0.62, phi: 0.9, radius: 24, target: new THREE.Vector3(X(980), 0, Z(950)) };
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
    const shellTarget = { doll: 0.9, walk: 1, plan: 0.4 };
    let shellY = 0.9;
    const setShell = (v) => { if (v !== shellY) shadowsDirty(); shellY = v; shell.scale.y = v; };
    setShell(0.9);
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
        orbit.radius = aspect < 1 ? 30 : 23;
      } else { orbit.phi = aspect < 1 ? 0.72 : 0.9; orbit.radius = aspect < 1 ? 27 : 25; }
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
    const pick = (cx, cy) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (mode === 'walk') {
        const hs = ray.intersectObjects(spotsGroup.children, true);
        if (hs.length) { go(hs[0].object.userData.room); return; }
        const hf = ray.intersectObjects(floorMeshes, false);
        const hw = ray.intersectObjects([shell, fixed, loose], true).filter((h) => h.object.material !== mat.glass && h.object.material !== mat.sheer);
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
      else orbit.radius = Math.max(9, Math.min(40, orbit.radius * f));
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

    orbit.radius = aspect < 1 ? 27 : 25;
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
      if (envDirty && !tween && !litFrom) captureEnv();
      if (ceiling.visible !== lastCeil) { lastCeil = ceiling.visible; shadowsDirty(); dirty = true; }
      // w ruchu bez GTAO (płynność), po zatrzymaniu jedna klatka z cieniami kontaktowymi
      const moving = !!tween || (drag && drag.moved > 2) || Math.abs(vel) > 0.0005;
      if (gtao) {
        if (moving && gtao.enabled) gtao.enabled = false;
        else if (!moving && !gtao.enabled) { gtao.enabled = true; dirty = true; }
      }
      if (dirty || drag) {
        camera.lookAt(look);
        camera.updateProjectionMatrix();
        draw();
        dirty = false;
        if (firstFrame) { firstFrame = false; root.classList.add('is-ready'); }
        const showLabels = mode !== 'walk' && !tween;
        labels.forEach((lb) => {
          v3.copy(lb.pos);
          v3.y *= shellY;
          v3.project(camera);
          const on = showLabels && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
          lb.el.classList.toggle('is-on', on);
          if (on) lb.el.style.transform = `translate(${((v3.x + 1) / 2) * W}px, ${((1 - v3.y) / 2) * Hh}px) translate(-50%, -50%)`;
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

    return { apply: applyCfg, setMode, go, snapshot, resize, busy: () => !!tween || !!litFrom || !introDone || envDirty };
  }
})();
