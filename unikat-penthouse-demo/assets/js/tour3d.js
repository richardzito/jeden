/*
  Spacer wirtualny 3D z konfiguratorem — penthouse ul. Kłopot 4A.
  Klasyczny skrypt + dynamiczny import three.js (import map w <head>), więc działa też z file://.
  Model zbudowany według rzutu (klopot-plan.jpg, 106 px ≈ 1 m, wysokość 2,80 m).
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
    Promise.all([
      import('three'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
    ]).then(([THREE, envMod, rbMod]) => {
      try {
        impl = build(THREE, envMod.RoomEnvironment, rbMod.RoundedBoxGeometry);
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
  function build(THREE, RoomEnvironment, RoundedBoxGeometry) {
    const S = 1 / 106;
    const CX = 980;
    const CY = 950;
    const H = 2.8;
    const EYE = 1.6;
    const GROUND = -33.6;
    const X = (px) => (px - CX) * S;
    const Z = (py) => (py - CY) * S;
    const PX = (x) => x / S + CX;
    const PY = (z) => z / S + CY;
    let dirty = true;
    let idle = 0;

    // ---------- renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Model 3D mieszkania');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 9000);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.fog = new THREE.Fog(0xcfd9e3, 150, 4200);

    // ---------- tekstury z płótna ----------
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const canvasTex = (w, h, draw, color = true) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      return t;
    };
    const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;
    const grainLines = (g, x, y, w, h, hue, sat, l, n, vertical = true) => {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      for (let k = 0; k < n; k++) {
        g.globalAlpha = 0.08 + rnd() * 0.16;
        g.strokeStyle = rnd() < 0.55 ? hsl(hue, sat, l - 10 - rnd() * 8) : hsl(hue, sat, l + 6 + rnd() * 6);
        g.lineWidth = 0.6 + rnd() * 1.6;
        const o = rnd();
        const amp = (vertical ? w : h) * (0.03 + rnd() * 0.06);
        const ph = rnd() * 6;
        g.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          if (vertical) {
            const xx = x + o * w + Math.sin(t * 7 + ph) * amp;
            t === 0 ? g.moveTo(xx, y + t * h) : g.lineTo(xx, y + t * h);
          } else {
            const yy = y + o * h + Math.sin(t * 7 + ph) * amp;
            t === 0 ? g.moveTo(x + t * w, yy) : g.lineTo(x + t * w, yy);
          }
        }
        g.stroke();
      }
      g.restore();
      g.globalAlpha = 1;
    };
    // deski / gres drewnopodobny: 1 tekstura = 2,4 × 2,4 m, deski 20 × 120 cm
    const plankTex = (hue, sat, light, vary, joint) => canvasTex(1024, 1024, (g, w, h) => {
      const cols = 12;
      const pw = w / cols;
      const ph = h / 2;
      for (let c = 0; c < cols; c++) {
        const off = ((c * 0.37) % 1) * ph;
        for (let r = -1; r < 2; r++) {
          const y = r * ph + off;
          const l = light + (rnd() - 0.5) * vary;
          const hh = hue + (rnd() - 0.5) * 6;
          g.fillStyle = hsl(hh, sat, l);
          g.fillRect(c * pw, y, pw, ph);
          grainLines(g, c * pw, y, pw, ph, hh, sat, l, 16);
          g.fillStyle = joint;
          g.fillRect(c * pw, y, 2, ph);
          g.fillRect(c * pw, y, pw, 2);
        }
      }
    });
    const tex = {};
    tex.gres = plankTex(28, 10, 52, 12, 'rgba(40,34,28,.55)');
    tex.dab = plankTex(32, 38, 62, 10, 'rgba(70,48,25,.4)');
    tex.jodelka = canvasTex(1024, 1024, (g, w, h) => {
      // jodełka francuska: kolumny desek skośnych naprzemiennie
      const cols = 8;
      const cw = w / cols;
      const ph = cw * 0.42;
      for (let c = 0; c < cols; c++) {
        const dir = c % 2 ? 1 : -1;
        for (let y = -cw * 2; y < h + cw * 2; y += ph) {
          const l = 58 + (rnd() - 0.5) * 12;
          const hh = 30 + (rnd() - 0.5) * 6;
          const x0 = c * cw;
          const y0 = y + (dir > 0 ? 0 : cw * 0.5);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x0 + cw, y0 + dir * cw * 0.5);
          g.lineTo(x0 + cw, y0 + dir * cw * 0.5 + ph);
          g.lineTo(x0, y0 + ph);
          g.closePath();
          g.fillStyle = hsl(hh, 36, l);
          g.fill();
          g.strokeStyle = 'rgba(70,48,25,.45)';
          g.lineWidth = 2;
          g.stroke();
        }
      }
      g.globalAlpha = 0.12;
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.5 ? '#5a3b1d' : '#f3e2c8';
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 30, 1);
      }
      g.globalAlpha = 1;
    });
    tex.mikro = canvasTex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#b9b3aa';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 40 + rnd() * 220;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const c = rnd() < 0.5 ? '255,250,242' : '120,112,102';
        gr.addColorStop(0, `rgba(${c},${0.05 + rnd() * 0.08})`);
        gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '70,64,58' : '250,248,244'},${0.05 + rnd() * 0.08})`;
        g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
      }
    });
    // płytki łazienkowe 60 × 120 (1 tekstura = 2,4 × 2,4 m)
    const stoneTex = (base, light, grout) => canvasTex(512, 512, (g, w, h) => {
      const tw = w / 4;
      const th = h / 2;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = hsl(30, 3, light + (rnd() - 0.5) * 4);
        g.fillRect(i * tw, j * th, tw, th);
        for (let k = 0; k < 500; k++) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.06})`;
          g.fillRect(i * tw + rnd() * tw, j * th + rnd() * th, 2 + rnd() * 6, 1 + rnd() * 3);
        }
        g.fillStyle = grout;
        g.fillRect(i * tw, j * th, tw, 2);
        g.fillRect(i * tw, j * th, 2, th);
      }
      g.fillStyle = base;
    });
    tex.tile = stoneTex('#555', 34, 'rgba(20,20,20,.6)');
    tex.tileWall = stoneTex('#666', 42, 'rgba(25,25,25,.5)');
    tex.terrace = canvasTex(512, 512, (g, w, h) => {
      const n = 4;
      const t = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = hsl(210, 4, 52 + (rnd() - 0.5) * 6);
        g.fillRect(i * t, j * t, t, t);
        for (let k = 0; k < 300; k++) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.07})`;
          g.fillRect(i * t + rnd() * t, j * t + rnd() * t, 2, 2);
        }
        g.fillStyle = 'rgba(30,30,32,.55)';
        g.fillRect(i * t, j * t, t, 3);
        g.fillRect(i * t, j * t, 3, t);
      }
    });
    tex.oak = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = hsl(30, 30, 46);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const l = 44 + (rnd() - 0.5) * 8;
        g.fillStyle = hsl(29, 30, l);
        g.fillRect((i * w) / 6, 0, w / 6, h);
        grainLines(g, (i * w) / 6, 0, w / 6, h, 29, 30, l, 26);
      }
    });
    tex.oakLight = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = hsl(33, 34, 64);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const l = 62 + (rnd() - 0.5) * 8;
        g.fillStyle = hsl(33, 34, l);
        g.fillRect((i * w) / 6, 0, w / 6, h);
        grainLines(g, (i * w) / 6, 0, w / 6, h, 33, 34, l, 22);
      }
    });
    tex.concrete = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c9c7c3';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '90,88,85' : '250,250,248'},${rnd() * 0.12})`;
        g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
      }
    });
    // tapeta w pokoju (jak na zdjęciu: drobny wzór „cegiełek”)
    tex.wallpaper = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2a2420';
      g.fillRect(0, 0, w, h);
      const bw = w / 6;
      const bh = h / 12;
      for (let j = 0; j < 12; j++) for (let i = -1; i < 7; i++) {
        const x = i * bw + (j % 2) * bw * 0.5;
        g.fillStyle = hsl(32, 28 + rnd() * 12, 30 + rnd() * 16);
        g.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4);
        g.fillStyle = 'rgba(205,170,110,.35)';
        g.fillRect(x + bw * 0.2, j * bh + bh * 0.45, bw * 0.6, 1.5);
      }
    });
    // fasada budynku: pasy okien co 3 m (1 tekstura = 6 × 6 m)
    tex.facade = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#eceae6';
      g.fillRect(0, 0, w, h);
      for (let f = 0; f < 2; f++) {
        const y = f * (h / 2);
        g.fillStyle = '#5d6872';
        for (let i = 0; i < 3; i++) g.fillRect(i * (w / 3) + 10, y + 26, w / 3 - 20, 64);
        g.fillStyle = 'rgba(40,46,52,.85)';
        g.fillRect(0, y + h / 2 - 12, w, 6);
        g.fillStyle = 'rgba(160,190,205,.35)';
        g.fillRect(0, y + h / 2 - 34, w, 22);
      }
    });
    // okna w mieście (dzień: szkło, noc: część okien świeci)
    const cityWin = (night) => canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = night ? '#000' : '#e4e1db';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        if (night) g.fillStyle = rnd() < 0.42 ? `hsl(${36 + rnd() * 12} 90% ${55 + rnd() * 20}%)` : '#000';
        else g.fillStyle = `hsl(205 10% ${52 + rnd() * 14}%)`;
        g.fillRect(i * 16 + 4, j * 16 + 5, 9, 7);
      }
    });
    tex.cityDay = cityWin(false);
    tex.cityNight = cityWin(true);
    tex.ground = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#8a8f83';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(92,112,74,.6)' : 'rgba(150,150,140,.5)';
        g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 120, 30 + rnd() * 120);
      }
      g.fillStyle = '#5f6266';
      for (let i = 0; i < 4; i++) {
        g.fillRect(0, i * (h / 4), w, 10);
        g.fillRect(i * (w / 4), 0, 10, h);
      }
    });
    tex.ground.repeat.set(26, 26);

    // ---------- materiały ----------
    const mats = [];
    const M = (p, env = 1) => {
      const m = new THREE.MeshStandardMaterial(p);
      m.userData.env = env;
      mats.push(m);
      return m;
    };
    const wallC = PH.config.walls.find((w) => w.id === cfg.walls).color;
    const mat = {
      wall: M({ color: wallC, roughness: 0.93 }, 0.7),
      wallTop: M({ color: 0x262a35, roughness: 1 }, 0.3),
      floor: M({ map: tex.gres, roughness: 0.55, metalness: 0 }, 0.9),
      tile: M({ map: tex.tile, roughness: 0.35 }, 1),
      tileWall: M({ map: tex.tileWall, roughness: 0.4 }, 1),
      terrace: M({ map: tex.terrace, roughness: 0.85 }, 0.6),
      ceiling: M({ color: 0xf4f2ee, roughness: 1 }, 0.7),
      glass: M({ color: 0xbcd4de, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }, 1.2),
      frame: M({ color: 0x2b2d31, roughness: 0.45, metalness: 0.3 }, 1),
      door: M({ color: 0xdedbd5, roughness: 0.5 }, 0.9),
      doorDark: M({ color: 0x34302c, roughness: 0.55 }, 0.9),
      black: M({ color: 0x1b1c1f, roughness: 0.55 }, 0.8),
      blackGloss: M({ color: 0x0d0e10, roughness: 0.12, metalness: 0.2 }, 1.2),
      front: M({ color: 0x1d1e21, roughness: 0.55 }, 0.8),
      oak: M({ map: tex.oak, roughness: 0.6 }, 0.8),
      oakLight: M({ map: tex.oakLight, roughness: 0.55 }, 0.8),
      stone: M({ color: 0x2a2a2c, roughness: 0.3, metalness: 0.05 }, 1),
      concrete: M({ map: tex.concrete, roughness: 0.8 }, 0.7),
      leather: M({ color: 0x5e4232, roughness: 0.55, metalness: 0.05 }, 0.9),
      fabric: M({ color: 0x8e8a86, roughness: 1 }, 0.6),
      fabricDark: M({ color: 0x3c3d41, roughness: 1 }, 0.6),
      fabricLight: M({ color: 0xe0dbd2, roughness: 1 }, 0.6),
      curtain: M({ color: 0x6d6f74, roughness: 1, side: THREE.DoubleSide }, 0.5),
      sheer: M({ color: 0xf1efea, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }, 0.6),
      gold: M({ color: 0xc9a45c, roughness: 0.3, metalness: 0.85 }, 1.3),
      chrome: M({ color: 0xd9dcdf, roughness: 0.15, metalness: 1 }, 1.3),
      white: M({ color: 0xf3f3f1, roughness: 0.2 }, 1),
      rug: M({ color: 0xb9b4ab, roughness: 1 }, 0.5),
      plant: M({ color: 0x3e6a3a, roughness: 0.9 }, 0.6),
      pot: M({ color: 0xe9e6e0, roughness: 0.7 }, 0.8),
      wallpaper: M({ map: tex.wallpaper, roughness: 0.85 }, 0.6),
      bulb: M({ color: 0xfff3dc, emissive: 0xffc77a, emissiveIntensity: 0, roughness: 0.4 }, 0.5),
      fire: M({ color: 0x331a0c, emissive: 0xff8a3c, emissiveIntensity: 0.6, roughness: 0.8 }, 0.3),
      tv: M({ color: 0x08090b, roughness: 0.1, metalness: 0.3 }, 1.2),
      kidBlue: M({ color: 0x7fa6c9, roughness: 0.9 }, 0.6),
      kidYellow: M({ color: 0xe8c35c, roughness: 0.9 }, 0.6),
      kidPink: M({ color: 0xdba2a0, roughness: 0.9 }, 0.6),
      facade: M({ map: tex.facade, roughness: 0.85 }, 0.6),
      teak: M({ color: 0x9a6b42, roughness: 0.7 }, 0.7),
    };
    tex.facade.repeat.set(4, 6);
    const wallMats = [mat.wall, mat.wall, mat.wallTop, mat.wall, mat.wall, mat.wall];

    // ---------- pomocnicze ----------
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const RB = (w, h, d, r = 0.04, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
    const add = (parent, geo, m, x, y, z, o = {}) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      if (o.ry) mesh.rotation.y = o.ry;
      if (o.rx) mesh.rotation.x = o.rx;
      if (o.rz) mesh.rotation.z = o.rz;
      mesh.castShadow = o.cast !== false;
      mesh.receiveShadow = o.receive !== false;
      parent.add(mesh);
      return mesh;
    };
    // prostokąt z rzutu (px) od wysokości yb do yt
    const pbox = (parent, x1, y1, x2, y2, yb, yt, m, o) => add(parent, B((x2 - x1) * S, yt - yb, (y2 - y1) * S), m, X((x1 + x2) / 2), (yb + yt) / 2, Z((y1 + y2) / 2), o);
    const prbox = (parent, x1, y1, x2, y2, yb, yt, m, r, o) => add(parent, RB((x2 - x1) * S, yt - yb, (y2 - y1) * S, r), m, X((x1 + x2) / 2), (yb + yt) / 2, Z((y1 + y2) / 2), o);
    const cyl = (parent, r, h, m, x, y, z, seg = 24, o) => add(parent, new THREE.CylinderGeometry(r, r, h, seg), m, x, y, z, o);
    // płaska powierzchnia z UV w metrach świata (bez szwów między prostokątami)
    const floorGeo = (rects, y, tile) => {
      const pos = [];
      const uv = [];
      const idx = [];
      rects.forEach(([x1, y1, x2, y2]) => {
        const a = [X(x1), Z(y1)];
        const b = [X(x2), Z(y2)];
        const base = pos.length / 3;
        [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]].forEach(([x, z]) => {
          pos.push(x, y, z);
          uv.push(x / tile, -z / tile);
        });
        idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    // ---------- grupy ----------
    const world = new THREE.Group();
    const shell = new THREE.Group(); // ściany, okna, zabudowy — w makiecie obniżane
    const ceiling = new THREE.Group();
    const loose = new THREE.Group(); // meble wolnostojące (tryb „puste wnętrze”)
    const fixed = new THREE.Group(); // zabudowy i wyposażenie stałe
    const variants = { pokoj: {}, gabinet: {} };
    scene.add(world);
    world.add(shell, ceiling, loose, fixed);

    // ---------- podłogi ----------
    const floorsByType = { wood: [], tile: [], terrace: [] };
    PH.rooms.forEach((r) => floorsByType[r.floor].push(...r.rects));
    // pasy pod drzwiami i przejściami
    floorsByType.wood.push([1283, 1250, 1300, 1345], [1075, 1655, 1165, 1670], [790, 1655, 885, 1670], [757, 1680, 770, 1775], [1440, 1020, 1455, 1105], [1440, 1210, 1455, 1300], [1300, 1000, 1440, 1015], [1440, 980, 1478, 1000]);
    const floorMeshes = [];
    const fWood = add(world, floorGeo(floorsByType.wood, 0.002, 2.4), mat.floor, 0, 0, 0, { cast: false });
    const fTile = add(world, floorGeo(floorsByType.tile, 0.002, 2.4), mat.tile, 0, 0, 0, { cast: false });
    const fTer = add(world, floorGeo(floorsByType.terrace, 0.002, 2.4), mat.terrace, 0, 0, 0, { cast: false });
    floorMeshes.push(fWood, fTile, fTer);
    // płyta stropowa / dach budynku pod mieszkaniem
    tex.roof = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6f7275';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '40,42,44' : '170,172,170'},${rnd() * 0.25})`;
        g.fillRect(rnd() * w, rnd() * h, 2, 2);
      }
      g.fillStyle = 'rgba(30,32,34,.35)';
      for (let i = 0; i < 4; i++) g.fillRect(0, (i * h) / 4, w, 2);
    });
    tex.roof.repeat.set(1, 1);
    const roofMat = M({ map: tex.roof, roughness: 0.95 }, 0.4);
    const slab = pbox(world, 180, 30, 1780, 1880, -0.32, 0, mat.facade, { cast: false });
    slab.material = [mat.facade, mat.facade, roofMat, mat.facade, mat.facade, mat.facade];
    slab.geometry.attributes.uv.array.forEach((v, i, arr) => { if (i >= 16 && i < 24) arr[i] = v * 5; });
    slab.geometry.attributes.uv.needsUpdate = true;
    // sufity (widoczne tylko w spacerze)
    const ceilRects = PH.rooms.filter((r) => !r.outdoor).flatMap((r) => r.rects).concat(floorsByType.wood.slice(-8));
    const ceilGeo = floorGeo(ceilRects, H, 2);
    ceilGeo.index.array.reverse(); // odwrócone trójkąty: sufit widoczny od dołu
    ceilGeo.computeVertexNormals();
    add(ceiling, ceilGeo, mat.ceiling, 0, 0, 0, { cast: false });
    // sufit loggii
    pbox(ceiling, 220, 1108, 937, 1270, H, H + 0.25, mat.ceiling, { cast: false });
    ceiling.visible = false;

    // ---------- ściany ----------
    const wall = (x1, y1, x2, y2, yb = 0, yt = H) => {
      const m = add(shell, B((x2 - x1) * S, yt - yb, (y2 - y1) * S), wallMats, X((x1 + x2) / 2), (yb + yt) / 2, Z((y1 + y2) / 2));
      return m;
    };
    // zewnętrzne
    [
      [937, 440, 980, 710], [937, 960, 980, 1160], [937, 1265, 980, 1312], [1285, 285, 1520, 400], [1660, 352, 1765, 400],
      [1740, 400, 1765, 1000], [1715, 1000, 1740, 1172], [1670, 1172, 1700, 1340], [1440, 1315, 1700, 1340], [1470, 1455, 1495, 1835],
      [757, 1805, 1495, 1835], [195, 1838, 770, 1865], [757, 1775, 770, 1838], [195, 1270, 222, 1865], [195, 1270, 258, 1312],
      [530, 1270, 750, 1312], [880, 1270, 980, 1312],
    ].forEach((r) => wall(...r));
    // wewnętrzne
    [
      [980, 1000, 1300, 1015], [1283, 1015, 1300, 1250], [1283, 1345, 1300, 1440], [982, 1425, 1290, 1440], [1285, 1440, 1300, 1670],
      [982, 1655, 1075, 1670], [1165, 1655, 1300, 1670], [965, 1312, 982, 1670], [597, 1655, 790, 1670], [885, 1655, 965, 1670],
      [597, 1312, 612, 1670], [757, 1670, 770, 1680], [1440, 560, 1478, 980], [1440, 980, 1765, 1000], [1440, 1000, 1455, 1020],
      [1440, 1105, 1455, 1172], [1455, 1160, 1715, 1172], [1440, 1172, 1455, 1210], [1440, 1300, 1455, 1315], [1625, 1080, 1715, 1160],
    ].forEach((r) => wall(...r));

    // okna i drzwi tarasowe: parapet, nadproże, szyba, ramy
    const openings = [
      [937, 710, 980, 960, 'w'], [937, 352, 980, 440, 'w'], [980, 352, 1190, 400, 'w'], [1190, 352, 1285, 400, 'd'],
      [1520, 352, 1615, 400, 'd'], [1615, 352, 1660, 400, 'w'], [258, 1270, 435, 1312, 'w'], [435, 1270, 530, 1312, 'd'],
      [750, 1270, 880, 1312, 'w'], [937, 1160, 980, 1265, 'd'],
    ];
    const windowsGlass = [];
    const curtainGeo = (() => {
      const g = new THREE.PlaneGeometry(0.42, 2.72, 28, 1);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) / 0.42) * Math.PI * 7) * 0.035);
      g.computeVertexNormals();
      return g;
    })();
    openings.forEach(([x1, y1, x2, y2, t]) => {
      const sill = t === 'w' ? 0.62 : 0;
      const top = 2.45;
      if (sill > 0) wall(x1, y1, x2, y2, 0, sill);
      wall(x1, y1, x2, y2, top, H);
      const vertical = x2 - x1 < y2 - y1;
      const cxp = (x1 + x2) / 2;
      const cyp = (y1 + y2) / 2;
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const gw = vertical ? 0.02 : len;
      const gd = vertical ? len : 0.02;
      windowsGlass.push(add(shell, B(gw, top - sill, gd), mat.glass, X(cxp), (sill + top) / 2, Z(cyp), { cast: false, receive: false }));
      // ramy
      const fw = vertical ? 0.07 : len;
      const fd = vertical ? len : 0.07;
      add(shell, B(fw, 0.06, fd), mat.frame, X(cxp), top - 0.03, Z(cyp));
      add(shell, B(fw, 0.06, fd), mat.frame, X(cxp), sill + 0.03, Z(cyp));
      const n = Math.max(1, Math.round(len / 0.9));
      for (let i = 0; i <= n; i++) {
        const tpos = i / n;
        const px = vertical ? cxp : x1 + (x2 - x1) * tpos;
        const py = vertical ? y1 + (y2 - y1) * tpos : cyp;
        add(shell, B(0.06, top - sill, 0.06), mat.frame, X(px), (sill + top) / 2, Z(py));
      }
      // zasłony po bokach (wewnątrz)
      if (t === 'w' || t === 'd') {
        const off = 0.27;
        [0, 1].forEach((k) => {
          const px = vertical ? cxp : k ? x2 + 14 : x1 - 14;
          const py = vertical ? (k ? y2 + 14 : y1 - 14) : cyp;
          const m = add(shell, curtainGeo, mat.curtain, X(px) + (vertical ? off : 0), 1.37, Z(py) + (vertical ? 0 : off), { cast: false });
          if (vertical) m.rotation.y = Math.PI / 2;
        });
      }
    });

    // drzwi wewnętrzne: nadproże + otwarte skrzydło
    const doors = [
      [1283, 1250, 1300, 1345, 'y2', -1], [1075, 1655, 1165, 1670, 'x1', 1], [790, 1655, 885, 1670, 'x2', -1],
      [757, 1680, 770, 1775, 'y1', -1], [1440, 1020, 1455, 1105, 'y1', -1], [1440, 1210, 1455, 1300, 'y1', -1],
    ];
    doors.forEach(([x1, y1, x2, y2, hinge, side]) => {
      wall(x1, y1, x2, y2, 2.1, H);
      const vertical = x2 - x1 < y2 - y1;
      const len = (vertical ? y2 - y1 : x2 - x1) * S - 0.04;
      let hx;
      let hz;
      if (vertical) { hx = X((x1 + x2) / 2); hz = Z(hinge === 'y1' ? y1 : y2); }
      else { hz = Z((y1 + y2) / 2); hx = X(hinge === 'x1' ? x1 : x2); }
      // skrzydło prostopadle do ściany
      if (vertical) add(shell, B(len, 2.06, 0.04), mat.door, hx + (side * len) / 2, 1.03, hz + (hinge === 'y1' ? 0.03 : -0.03));
      else add(shell, B(0.04, 2.06, len), mat.door, hx + (hinge === 'x1' ? 0.03 : -0.03), 1.03, hz + (side * len) / 2);
    });
    // drzwi wejściowe (zamknięte)
    wall(1470, 1340, 1495, 1455, 2.1, H);
    pbox(shell, 1474, 1345, 1490, 1452, 0, 2.08, mat.doorDark);
    pbox(shell, 1468, 1440, 1472, 1446, 0.98, 1.02, mat.chrome);

    // okładziny łazienek (płytki na ścianach)
    const clad = (segs) => segs.forEach(([x1, y1, x2, y2]) => pbox(shell, x1, y1, x2, y2, 0, H - 0.01, mat.tileWall, { cast: false }));
    clad([
      [982, 1440, 1285, 1444], [982, 1444, 986, 1655], [1281, 1444, 1285, 1655], [982, 1651, 1075, 1655], [1165, 1651, 1285, 1655],
      [1455, 1000, 1715, 1004], [1711, 1004, 1715, 1160], [1455, 1156, 1625, 1160], [1455, 1105, 1459, 1160], [1621, 1080, 1625, 1160],
    ]);
    // tapeta w pokoju (ściana od salonu)
    pbox(shell, 984, 1015, 1281, 1018, 0, H - 0.01, mat.wallpaper, { cast: false });
    // tapeta strukturalna za łóżkiem i za TV
    // ---------- balustrady ----------
    const rail = (x1, y1, x2, y2) => {
      const vertical = x2 - x1 < y2 - y1;
      const len = (vertical ? y2 - y1 : x2 - x1) * S;
      const cx = X((x1 + x2) / 2);
      const cz = Z((y1 + y2) / 2);
      add(world, B(vertical ? 0.02 : len, 1.0, vertical ? len : 0.02), mat.glass, cx, 0.55, cz, { cast: false, receive: false });
      add(world, B(vertical ? 0.06 : len, 0.05, vertical ? len : 0.06), mat.frame, cx, 1.1, cz);
      add(world, B(vertical ? 0.08 : len, 0.06, vertical ? len : 0.08), mat.frame, cx, 0.03, cz);
      const n = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        add(world, B(0.05, 1.1, 0.05), mat.frame, vertical ? cx : X(x1 + (x2 - x1) * t), 0.55, vertical ? Z(y1 + (y2 - y1) * t) : cz);
      }
    };
    rail(957, 42, 1685, 46);
    rail(957, 42, 961, 352);
    rail(1681, 42, 1685, 352);
    rail(220, 1108, 937, 1112);
    rail(220, 1108, 224, 1270);

    // ---------- zabudowy stałe ----------
    const F = fixed;
    // kuchnia: kolumna dębowa przy ścianie wschodniej
    pbox(shell, 1668, 402, 1740, 738, 0, 2.6, mat.oak);
    for (let i = 0; i < 4; i++) pbox(shell, 1664, 430 + i * 82, 1668, 434 + i * 82, 0.9, 1.7, mat.black);
    // ciąg dolny przy ścianie wschodniej + przy ścianie łazienki
    pbox(F, 1672, 740, 1740, 915, 0.08, 0.88, mat.front);
    pbox(F, 1545, 915, 1740, 980, 0.08, 0.88, mat.front);
    pbox(F, 1672, 740, 1740, 915, 0, 0.08, mat.black);
    pbox(F, 1545, 915, 1740, 980, 0, 0.08, mat.black);
    pbox(F, 1668, 736, 1740, 917, 0.88, 0.92, mat.stone);
    pbox(F, 1543, 913, 1740, 980, 0.88, 0.92, mat.stone);
    pbox(F, 1685, 765, 1730, 850, 0.915, 0.925, mat.blackGloss, { cast: false }); // zlew
    add(F, new THREE.TorusGeometry(0.1, 0.012, 8, 20, Math.PI), mat.black, X(1728), 1.05, Z(805), { ry: Math.PI / 2 });
    pbox(F, 1565, 925, 1650, 972, 0.921, 0.928, mat.blackGloss, { cast: false }); // płyta indukcyjna
    // blat-ściana: beton
    pbox(shell, 1736, 740, 1740, 915, 0.92, 1.45, mat.concrete, { cast: false });
    pbox(shell, 1545, 976, 1740, 980, 0.92, 1.45, mat.concrete, { cast: false });
    // szafki górne dębowe z podświetleniem
    pbox(shell, 1705, 740, 1740, 913, 1.45, 2.3, mat.oak);
    pbox(shell, 1545, 945, 1704, 980, 1.45, 2.3, mat.oak);
    pbox(shell, 1705, 742, 1708, 911, 1.44, 1.45, mat.bulb, { cast: false });
    // zabudowa wysoka: lodówka side by side, dwa piekarniki
    pbox(shell, 1478, 560, 1545, 880, 0, 2.5, mat.front);
    pbox(shell, 1545, 600, 1548, 700, 0.95, 1.55, mat.blackGloss, { cast: false });
    pbox(shell, 1545, 600, 1548, 700, 1.6, 2.15, mat.blackGloss, { cast: false });
    pbox(shell, 1548, 610, 1552, 690, 1.48, 1.5, mat.chrome);
    pbox(shell, 1548, 610, 1552, 690, 2.08, 2.1, mat.chrome);
    pbox(shell, 1548, 760, 1552, 764, 0.6, 1.8, mat.chrome);
    pbox(shell, 1548, 776, 1552, 780, 0.6, 1.8, mat.chrome);

    // salon: ściana TV (czarny panel) i kominek z nawilżaczem
    pbox(shell, 1426, 640, 1440, 920, 0.28, 2.6, mat.black);
    pbox(F, 1392, 600, 1440, 960, 0.28, 0.52, mat.oakLight);
    pbox(F, 1390, 700, 1394, 860, 0.33, 0.47, mat.fire, { cast: false });
    // grzejniki pionowe, klimatyzatory
    const radiator = (x1, y1, x2, y2) => {
      const vertical = x2 - x1 < y2 - y1;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (vertical) pbox(shell, x1, y1 + (y2 - y1) * t - 3, x2, y1 + (y2 - y1) * t + 3, 0.15, 1.8, mat.black);
        else pbox(shell, x1 + (x2 - x1) * t - 3, y1, x1 + (x2 - x1) * t + 3, y2, 0.15, 1.8, mat.black);
      }
    };
    radiator(982, 565, 992, 655);
    radiator(1330, 402, 1400, 412);
    radiator(300, 1314, 360, 1324);
    radiator(612, 1314, 650, 1324);
    const ac = (x1, y1, x2, y2) => prbox(shell, x1, y1, x2, y2, 2.3, 2.6, mat.white, 0.03);
    ac(1200, 977, 1290, 998);
    ac(225, 1350, 248, 1440);
    // pokój: szafy wnękowe
    pbox(shell, 984, 1362, 1281, 1423, 0, 2.6, mat.white);
    for (let i = 1; i < 3; i++) pbox(shell, 984 + i * 99 - 1, 1360, 984 + i * 99 + 1, 1362, 0.05, 2.55, mat.frame, { cast: false });
    // gabinet: szafa przy ścianie zachodniej (dąb)
    pbox(shell, 614, 1314, 672, 1653, 0, 2.6, mat.oak);
    for (let i = 1; i < 4; i++) pbox(shell, 672, 1314 + i * 85 - 1, 674, 1314 + i * 85 + 1, 0.05, 2.55, mat.black, { cast: false });
    // sypialnia: szafy wzdłuż ściany południowej
    pbox(shell, 224, 1780, 755, 1836, 0, 2.6, mat.oak);
    for (let i = 1; i < 6; i++) pbox(shell, 224 + i * 88 - 6, 1776, 224 + i * 88 - 3, 1780, 0.9, 1.7, mat.black, { cast: false });
    // przedpokój: szafa przy wejściu
    pbox(shell, 1402, 1605, 1466, 1800, 0, 2.6, mat.oak);
    pbox(shell, 1398, 1640, 1402, 1644, 0.9, 1.5, mat.black, { cast: false });
    pbox(shell, 1398, 1740, 1402, 1744, 0.9, 1.5, mat.black, { cast: false });

    // łazienka z wanną
    pbox(F, 1196, 1446, 1280, 1612, 0, 0.56, mat.tileWall);
    prbox(F, 1203, 1452, 1274, 1606, 0.5, 0.57, mat.white, 0.03, { cast: false });
    pbox(F, 1210, 1460, 1268, 1598, 0.565, 0.575, mat.white, { cast: false });
    pbox(F, 1046, 1446, 1170, 1494, 0.5, 0.84, mat.oak);
    prbox(F, 1044, 1444, 1172, 1496, 0.84, 0.95, mat.white, 0.02);
    pbox(F, 1104, 1448, 1112, 1460, 0.95, 1.15, mat.chrome);
    add(shell, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 40), mat.chrome, X(1108), 1.62, Z(1447), { rx: Math.PI / 2, cast: false });
    add(shell, new THREE.TorusGeometry(0.3, 0.012, 8, 40), mat.black, X(1108), 1.62, Z(1449), { cast: false });
    prbox(F, 990, 1585, 1035, 1640, 0.32, 0.46, mat.white, 0.06);
    // łazienka z prysznicem
    pbox(F, 1627, 1006, 1709, 1078, 0, 0.04, mat.white, { cast: false });
    add(F, B(0.01, 2.0, (1078 - 1006) * S), mat.glass, X(1627), 1.02, Z(1042), { cast: false, receive: false });
    cyl(shell, 0.12, 0.01, mat.chrome, X(1690), 2.2, Z(1030));
    pbox(F, 1462, 1112, 1530, 1154, 0.55, 0.85, mat.oak);
    prbox(F, 1460, 1110, 1532, 1156, 0.85, 0.93, mat.white, 0.02);
    prbox(F, 1560, 1110, 1600, 1154, 0.32, 0.46, mat.white, 0.06);
    // pralnia
    prbox(F, 1600, 1178, 1666, 1240, 0, 0.85, mat.white, 0.03);
    prbox(F, 1600, 1178, 1666, 1240, 0.87, 1.72, mat.white, 0.03);
    cyl(F, 0.2, 0.02, mat.blackGloss, X(1599), 0.45, Z(1209), 28, { rz: Math.PI / 2, cast: false });
    cyl(F, 0.2, 0.02, mat.blackGloss, X(1599), 1.3, Z(1209), 28, { rz: Math.PI / 2, cast: false });
    pbox(shell, 1460, 1290, 1668, 1313, 1.6, 1.63, mat.oakLight);
    pbox(shell, 1460, 1290, 1668, 1313, 2.0, 2.03, mat.oakLight);

    // lampy wiszące
    const pendant = (parent, x, y, h = 1.95, big = false) => {
      cyl(parent, 0.004, H - h - 0.15, mat.black, X(x), (H + h + 0.15) / 2, Z(y), 6, { cast: false });
      const r = big ? 0.2 : 0.11;
      add(parent, new THREE.CylinderGeometry(r * 0.8, r, r * 1.6, 8, 1, true), mat.gold, X(x), h, Z(y), { cast: false });
      add(parent, new THREE.SphereGeometry(r * 0.45, 12, 8), mat.bulb, X(x), h - 0.02, Z(y), { cast: false });
    };
    // ---------- meble wolnostojące ----------
    const L = loose;
    // jadalnia: stół dębowy, 4 krzesła, lampa z trzema kloszami
    prbox(L, 1060, 470, 1160, 660, 0.72, 0.76, mat.oakLight, 0.01);
    [[1068, 480], [1152, 480], [1068, 650], [1152, 650]].forEach(([x, y]) => pbox(L, x - 3, y - 3, x + 3, y + 3, 0, 0.72, mat.black));
    [[1035, 515], [1035, 615], [1185, 515], [1185, 615]].forEach(([x, y], i) => {
      const dir = i < 2 ? -1 : 1;
      prbox(L, x - 22, y - 22, x + 22, y + 22, 0.42, 0.5, mat.fabricDark, 0.04);
      prbox(L, x + dir * 20 - 4, y - 22, x + dir * 20 + 4, y + 22, 0.5, 0.92, mat.fabricDark, 0.03);
      [[-18, -18], [18, -18], [-18, 18], [18, 18]].forEach(([dx, dy]) => pbox(L, x + dx - 1.5, y + dy - 1.5, x + dx + 1.5, y + dy + 1.5, 0, 0.42, mat.black, { cast: false }));
    });
    pbox(shell, 1108, 500, 1112, 630, 2.0, 2.03, mat.black);
    [520, 565, 610].forEach((y) => pendant(shell, 1110, y, 1.9));
    // narożnik skórzany przodem do ściany TV
    prbox(L, 1140, 690, 1235, 945, 0.12, 0.42, mat.leather, 0.06);
    prbox(L, 1140, 690, 1165, 945, 0.42, 0.82, mat.leather, 0.06);
    prbox(L, 1235, 870, 1330, 945, 0.12, 0.42, mat.leather, 0.06);
    prbox(L, 1140, 935, 1330, 960, 0.12, 0.7, mat.leather, 0.06);
    [[1170, 720, 1232, 800], [1170, 805, 1232, 868]].forEach((r) => prbox(L, ...r, 0.42, 0.52, mat.leather, 0.06));
    prbox(L, 1168, 700, 1190, 740, 0.5, 0.78, mat.fabricLight, 0.06);
    prbox(L, 1168, 880, 1190, 920, 0.5, 0.78, mat.fabricLight, 0.06);
    pbox(L, 1180, 660, 1400, 975, 0, 0.012, mat.rug, { cast: false });
    cyl(L, 0.42, 0.05, mat.gold, X(1305), 0.42, Z(770), 40);
    cyl(L, 0.02, 0.4, mat.black, X(1305), 0.2, Z(770), 8);
    cyl(L, 0.3, 0.05, mat.gold, X(1330), 0.34, Z(860), 40);
    cyl(L, 0.02, 0.32, mat.black, X(1330), 0.16, Z(860), 8);
    // TV (nie zostaje w mieszkaniu)
    pbox(L, 1420, 690, 1426, 860, 1.15, 1.95, mat.tv);
    // rośliny
    const plant = (parent, x, y, s = 1) => {
      cyl(parent, 0.16 * s, 0.38 * s, mat.pot, X(x), 0.19 * s, Z(y), 18);
      add(parent, new THREE.IcosahedronGeometry(0.32 * s, 1), mat.plant, X(x), 0.62 * s, Z(y));
    };
    plant(L, 1000, 965);
    plant(L, 1415, 430, 1.2);
    // sypialnia: łóżko z tapicerowanym zagłówkiem, szafki nocne, lampy, zegar
    prbox(L, 224, 1440, 236, 1650, 0.1, 1.25, mat.fabric, 0.03);
    for (let i = 0; i < 7; i++) prbox(L, 232, 1446 + i * 29, 244, 1472 + i * 29, 0.35, 1.2, mat.fabric, 0.04);
    prbox(L, 244, 1460, 455, 1630, 0.12, 0.38, mat.fabricDark, 0.03);
    prbox(L, 246, 1462, 450, 1628, 0.38, 0.55, mat.fabricLight, 0.06);
    prbox(L, 360, 1458, 395, 1632, 0.55, 0.58, mat.fabricDark, 0.02);
    [[1480], [1545], [1610]].forEach(([y], i) => prbox(L, 250, y - 28, 285, y + 28, 0.55, 0.72, i === 1 ? mat.fabricDark : mat.fabricLight, 0.05));
    [[1420], [1665]].forEach(([y]) => { pbox(L, 226, y - 22, 270, y + 22, 0.2, 0.55, mat.oak); });
    pendant(shell, 250, 1420, 1.55, true);
    pendant(shell, 250, 1665, 1.55, true);
    add(shell, new THREE.CylinderGeometry(0.36, 0.36, 0.03, 48), mat.fabricLight, X(595), 1.75, Z(1500), { rz: Math.PI / 2, cast: false });
    add(shell, new THREE.TorusGeometry(0.36, 0.02, 8, 48), mat.black, X(594), 1.75, Z(1500), { ry: Math.PI / 2, cast: false });
    pbox(L, 300, 1400, 520, 1690, 0, 0.012, mat.rug, { cast: false });
    // fotel przy oknie
    prbox(L, 532, 1330, 594, 1395, 0.2, 0.42, mat.fabricDark, 0.05);
    prbox(L, 532, 1380, 594, 1395, 0.42, 0.85, mat.fabricDark, 0.04);
    // przedpokój: konsola z lustrem
    pbox(L, 1302, 1460, 1330, 1580, 0.75, 0.8, mat.oakLight);
    pbox(shell, 1301, 1470, 1303, 1570, 1.0, 1.9, mat.chrome, { cast: false });
    // taras: stół, krzesła, leżaki, skrzynia, donice
    const T = loose;
    prbox(T, 1120, 140, 1260, 230, 0.7, 0.74, mat.teak, 0.01);
    [[1125, 145], [1255, 145], [1125, 225], [1255, 225]].forEach(([x, y]) => pbox(T, x - 3, y - 3, x + 3, y + 3, 0, 0.7, mat.frame));
    [[1150, 115], [1230, 115], [1150, 255], [1230, 255]].forEach(([x, y]) => {
      prbox(T, x - 20, y - 20, x + 20, y + 20, 0.42, 0.47, mat.teak, 0.02);
      prbox(T, x - 20, y < 200 ? y - 20 : y + 16, x + 20, y < 200 ? y - 16 : y + 20, 0.47, 0.85, mat.teak, 0.02);
    });
    [[1420], [1520]].forEach(([x]) => {
      prbox(T, x - 30, 70, x + 30, 260, 0.2, 0.32, mat.fabricLight, 0.05);
      add(T, RB(0.55, 0.06, 0.55, 0.03), mat.fabricLight, X(x), 0.5, Z(90), { rx: 0.9 });
    });
    pbox(F, 1600, 60, 1676, 160, 0, 0.7, mat.teak);
    [[990, 70], [990, 320], [1650, 320]].forEach(([x, y]) => {
      pbox(T, x - 25, y - 25, x + 25, y + 25, 0, 0.5, mat.frame);
      add(T, new THREE.IcosahedronGeometry(0.28, 1), mat.plant, X(x), 0.72, Z(y));
    });
    // loggia: stolik i dwa krzesła
    cyl(T, 0.3, 0.03, mat.teak, X(560), 0.72, Z(1190), 30);
    cyl(T, 0.025, 0.7, mat.frame, X(560), 0.36, Z(1190), 8);
    [[500, 1190], [620, 1190]].forEach(([x, y]) => prbox(T, x - 20, y - 20, x + 20, y + 20, 0.42, 0.46, mat.teak, 0.02));

    // ---------- warianty pokoi ----------
    const variantGroup = (room, id) => {
      const g = new THREE.Group();
      g.userData.loose = new THREE.Group();
      g.add(g.userData.loose);
      world.add(g);
      variants[room][id] = g;
      return g;
    };
    const desk = (parent, x1, y1, x2, y2, top = mat.oak) => {
      prbox(parent, x1, y1, x2, y2, 0.72, 0.76, top, 0.01);
      [[x1 + 4, y1 + 4], [x2 - 4, y1 + 4], [x1 + 4, y2 - 4], [x2 - 4, y2 - 4]].forEach(([x, y]) => pbox(parent, x - 2.5, y - 2.5, x + 2.5, y + 2.5, 0, 0.72, mat.black, { cast: false }));
    };
    const officeChair = (parent, x, y, back) => {
      cyl(parent, 0.26, 0.04, mat.black, X(x), 0.05, Z(y), 5);
      cyl(parent, 0.025, 0.42, mat.chrome, X(x), 0.27, Z(y), 8);
      prbox(parent, x - 24, y - 24, x + 24, y + 24, 0.46, 0.54, mat.fabricDark, 0.04);
      const by = back === 'n' ? y - 24 : y + 20;
      prbox(parent, x - 24, by, x + 24, by + 5, 0.54, 1.15, mat.fabricDark, 0.03);
    };
    const bed = (parent, x1, y1, x2, y2, head, cover = mat.fabricLight, frame = mat.fabric) => {
      prbox(parent, x1, y1, x2, y2, 0.1, 0.35, frame, 0.03);
      prbox(parent, x1 + 2, y1 + 2, x2 - 2, y2 - 2, 0.35, 0.52, cover, 0.06);
      const hb = { n: [x1, y1 - 8, x2, y1], s: [x1, y2, x2, y2 + 8], w: [x1 - 8, y1, x1, y2], e: [x2, y1, x2 + 8, y2] }[head];
      prbox(parent, ...hb, 0.1, 1.05, frame, 0.03);
      const pw = { n: [x1 + 8, y1 + 4, x2 - 8, y1 + 40], s: [x1 + 8, y2 - 40, x2 - 8, y2 - 4], w: [x1 + 4, y1 + 8, x1 + 40, y2 - 8], e: [x2 - 40, y1 + 8, x2 - 4, y2 - 8] }[head];
      prbox(parent, ...pw, 0.52, 0.64, mat.white, 0.05);
    };
    const toyShelf = (parent, x1, y1, x2, y2) => {
      pbox(parent, x1, y1, x2, y2, 0, 0.9, mat.white);
      const n = 3;
      for (let i = 0; i < n; i++) {
        const m = [mat.kidBlue, mat.kidYellow, mat.kidPink][i];
        const vertical = x2 - x1 < y2 - y1;
        if (vertical) pbox(parent, x1 - 2, y1 + ((y2 - y1) * i) / n + 6, x1, y1 + ((y2 - y1) * (i + 1)) / n - 6, 0.1, 0.4, m, { cast: false });
        else pbox(parent, x1 + ((x2 - x1) * i) / n + 6, y2, x1 + ((x2 - x1) * (i + 1)) / n - 6, y2 + 2, 0.1, 0.4, m, { cast: false });
      }
    };
    const roundRug = (parent, x, y, r, m) => cyl(parent, r, 0.012, m, X(x), 0.006, Z(y), 40, { cast: false });

    // Pokój 10,46 m²: do pracy / gościnny / dziecięcy
    {
      const g = variantGroup('pokoj', 'praca').userData.loose;
      desk(g, 1085, 1030, 1255, 1100);
      officeChair(g, 1170, 1140, 's');
      pbox(g, 1000, 1018, 1070, 1040, 1.35, 1.38, mat.oak);
      pbox(g, 1000, 1018, 1070, 1040, 1.7, 1.73, mat.oak);
      prbox(g, 1010, 1230, 1080, 1340, 0.2, 0.42, mat.fabricDark, 0.05);
      prbox(g, 1010, 1230, 1025, 1340, 0.42, 0.8, mat.fabricDark, 0.04);
    }
    {
      const g = variantGroup('pokoj', 'gosc').userData.loose;
      bed(g, 1060, 1022, 1212, 1235, 'n', mat.fabricLight, mat.fabricDark);
      pbox(g, 1012, 1022, 1052, 1060, 0, 0.5, mat.oakLight);
      pbox(g, 1220, 1022, 1260, 1060, 0, 0.5, mat.oakLight);
      pbox(g, 1040, 1250, 1240, 1350, 0, 0.012, mat.rug, { cast: false });
    }
    {
      const g = variantGroup('pokoj', 'dziecko').userData.loose;
      bed(g, 1188, 1100, 1280, 1310, 'n', mat.kidBlue, mat.white);
      desk(g, 1000, 1022, 1120, 1080, mat.white);
      officeChair(g, 1060, 1115, 's');
      toyShelf(g, 1130, 1022, 1180, 1060);
      roundRug(g, 1090, 1230, 0.75, mat.kidYellow);
    }
    // Gabinet 10,35 m²: gabinet / pokój dziecka / garderoba
    {
      const v = variantGroup('gabinet', 'gabinet');
      const g = v.userData.loose;
      desk(g, 760, 1326, 940, 1396);
      officeChair(g, 850, 1440, 's');
      prbox(g, 700, 1560, 760, 1640, 0, 0.45, mat.leather, 0.05);
    }
    {
      const v = variantGroup('gabinet', 'dziecko');
      const g = v.userData.loose;
      bed(g, 870, 1334, 962, 1545, 'n', mat.kidPink, mat.white);
      desk(g, 690, 1326, 830, 1390, mat.white);
      officeChair(g, 760, 1430, 's');
      toyShelf(g, 680, 1560, 760, 1600);
      roundRug(g, 780, 1500, 0.65, mat.kidBlue);
    }
    {
      const v = variantGroup('gabinet', 'garderoba');
      // zabudowa stała: szafy na ścianie wschodniej (obniżane w makiecie razem ze ścianami)
      v.userData.shell = new THREE.Group();
      shell.add(v.userData.shell);
      pbox(v.userData.shell, 905, 1330, 963, 1653, 0, 2.6, mat.oak);
      for (let i = 1; i < 4; i++) pbox(v.userData.shell, 903, 1330 + i * 80 - 1, 905, 1330 + i * 80 + 1, 0.05, 2.55, mat.black, { cast: false });
      const g = v.userData.loose;
      pbox(g, 730, 1440, 850, 1540, 0.05, 0.9, mat.oakLight);
      pbox(g, 728, 1438, 852, 1542, 0.9, 0.93, mat.stone);
      prbox(g, 760, 1580, 830, 1630, 0, 0.42, mat.fabricLight, 0.08);
      pbox(g, 690, 1330, 760, 1336, 0.05, 1.9, mat.chrome);
    }

    // ---------- budynek i otoczenie ----------
    const outside = new THREE.Group();
    scene.add(outside);
    // bryła budynku pod mieszkaniem
    const bodyMat = mat.facade.clone();
    bodyMat.map = tex.facade.clone();
    bodyMat.map.needsUpdate = true;
    bodyMat.map.repeat.set(3, 5.5);
    add(outside, B(1600 * S, -GROUND - 0.32, 1850 * S), bodyMat, X(980), (GROUND - 0.32) / 2, Z(955), { cast: false });
    // sąsiednie budynki osiedla (niższe)
    const neighbors = [[-34, -34, 14, 24, 40, 0.2], [36, -40, 14, 21, 46, -0.1], [-40, 28, 14, 24, 34, 0.15], [40, 34, 14, 22, 38, 0], [0, 58, 14, 19, 30, Math.PI / 2]];
    neighbors.forEach(([x, z, w, h, d, ry]) => {
      const m = bodyMat.clone();
      m.map = tex.facade.clone();
      m.map.needsUpdate = true;
      m.map.repeat.set(d / 6, h / 6);
      add(outside, B(w, h, d), m, x, GROUND + h / 2, z, { ry, cast: false, receive: false });
    });
    // grunt
    const ground = add(outside, new THREE.CircleGeometry(4500, 48), M({ map: tex.ground, roughness: 1 }, 0.4), 0, GROUND, 0, { rx: -Math.PI / 2, cast: false });
    ground.receiveShadow = false;
    // drzewa
    const treeGeo = new THREE.IcosahedronGeometry(1, 1);
    const trees = new THREE.InstancedMesh(treeGeo, M({ color: 0x5b7444, roughness: 1, flatShading: true }, 0.4), 140);
    const tm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const ps = new THREE.Vector3();
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 16 + rnd() * 110;
      const s = 1.4 + rnd() * 2.2;
      ps.set(Math.cos(a) * r, GROUND + s * 1.2, Math.sin(a) * r);
      if (Math.abs(ps.x) < 10 && Math.abs(ps.z) < 12) ps.x += 20;
      sc.set(s, s * 1.3, s);
      tm.compose(ps, q, sc);
      trees.setMatrixAt(i, tm);
    }
    outside.add(trees);
    // miasto
    const cityMat = M({ map: tex.cityDay, emissiveMap: tex.cityNight, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.9 }, 0.5);
    const N = 900;
    const cityRoof = M({ color: 0xb9b8b3, roughness: 1 }, 0.4);
    const cityMats = [cityMat, cityMat, cityRoof, cityRoof, cityMat, cityMat];
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMats, N);
    const col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < N * 2 && k < N; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 80 + Math.pow(rnd(), 0.75) * 1300;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const w = 14 + rnd() * 34;
      const d = 12 + rnd() * 30;
      const h = 9 + Math.pow(rnd(), 2.2) * (r > 500 ? 60 : 36);
      ps.set(x, GROUND + h / 2, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 3) * (Math.PI / 2) + 0.35);
      sc.set(w, h, d);
      tm.compose(ps, q, sc);
      city.setMatrixAt(k, tm);
      col.setHSL(0.08 + rnd() * 0.05, 0.08, 0.72 + rnd() * 0.2);
      city.setColorAt(k, col);
      k++;
    }
    city.count = k;
    outside.add(city);
    // centrum (wieżowce) w kierunku śródmieścia
    const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMats, 16);
    const dirA = -2.65; // kierunek śródmieścia w układzie rzutu
    for (let i = 0; i < 16; i++) {
      const a = dirA + (rnd() - 0.5) * 0.28;
      const r = 2300 + rnd() * 900;
      const w = 30 + rnd() * 30;
      const h = 90 + Math.pow(rnd(), 1.4) * 160;
      ps.set(Math.sin(a) * r, GROUND + h / 2, -Math.cos(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd());
      sc.set(w, h, w * (0.7 + rnd() * 0.6));
      tm.compose(ps, q, sc);
      towers.setMatrixAt(i, tm);
      col.setHSL(0.58, 0.12, 0.62 + rnd() * 0.18);
      towers.setColorAt(i, col);
    }
    outside.add(towers);
    // niebo
    const skyUni = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUni,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0), 0.7)) : mix(mid, bot, clamp(-h*5.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }',
    }));
    scene.add(sky);
    // gwiazdy (noc)
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 600; i++) {
      const a = rnd() * Math.PI * 2;
      const e = 0.15 + rnd() * 1.2;
      sp.push(Math.cos(a) * Math.cos(e) * 7000, Math.sin(e) * 7000, Math.sin(a) * Math.cos(e) * 7000);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    scene.add(stars);

    // ---------- światła ----------
    const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x6d6458, 0.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    const lamps = [[1110, 565, 1.9], [1250, 800, 2.4], [1600, 700, 2.3], [380, 1550, 2.3], [1130, 1220, 2.4], [1385, 1350, 2.4]].map(([x, y, h]) => {
      const l = new THREE.PointLight(0xffc98a, 0, 7, 2);
      l.position.set(X(x), h, Z(y));
      scene.add(l);
      return l;
    });

    // pory dnia
    const sunDir = (bearingPlan, elev) => new THREE.Vector3(Math.sin(bearingPlan) * Math.cos(elev), Math.sin(elev), -Math.cos(bearingPlan) * Math.cos(elev));
    const TIMES = {
      day: { sun: 0xfff1de, sunI: 2.6, dir: sunDir(-1.15, 0.72), hemiS: 0xdfe9f5, hemiG: 0x6d6458, hemiI: 0.55, env: 0.85, lamp: 0, bulb: 0, fire: 0.5, city: 0, stars: 0, exp: 1, top: 0x6f9fd6, mid: 0xd8e6f1, bot: 0xa9b4ba, fog: 0xd2dde6 },
      sunset: { sun: 0xffa45c, sunI: 2.8, dir: sunDir(0.08, 0.13), hemiS: 0xf3c7a4, hemiG: 0x3e3540, hemiI: 0.45, env: 0.5, lamp: 3, bulb: 0.8, fire: 1.2, city: 0.25, stars: 0, exp: 1.02, top: 0x34477a, mid: 0xf4a46a, bot: 0x6b5a5e, fog: 0xe0a77c },
      night: { sun: 0x8fa6ff, sunI: 0.12, dir: sunDir(-0.6, 0.9), hemiS: 0x2a3658, hemiG: 0x0d0f16, hemiI: 0.22, env: 0.16, lamp: 9, bulb: 2.4, fire: 2.2, city: 1.25, stars: 1, exp: 1.04, top: 0x03060f, mid: 0x15213b, bot: 0x0b0d13, fog: 0x101a2c },
    };
    const lit = {};
    const snapLit = () => ({
      sun: sun.color.clone(), sunI: sun.intensity, dir: sun.position.clone().normalize(), hemiS: hemi.color.clone(), hemiG: hemi.groundColor.clone(), hemiI: hemi.intensity,
      env: lit.env ?? 0.85, lamp: lamps[0].intensity, bulb: mat.bulb.emissiveIntensity, fire: mat.fire.emissiveIntensity, city: cityMat.emissiveIntensity, stars: stars.material.opacity, exp: renderer.toneMappingExposure,
      top: skyUni.top.value.clone(), mid: skyUni.mid.value.clone(), bot: skyUni.bot.value.clone(), fog: scene.fog.color.clone(),
    });
    const C = (v) => (v instanceof THREE.Color ? v : new THREE.Color(v));
    const applyLit = (a, b, t) => {
      const mix = (x, y) => x + (y - x) * t;
      sun.color.copy(C(a.sun)).lerp(C(b.sun), t);
      sun.intensity = mix(a.sunI, b.sunI);
      const d = a.dir.clone().lerp(b.dir, t).normalize();
      sun.position.copy(d).multiplyScalar(40);
      hemi.color.copy(C(a.hemiS)).lerp(C(b.hemiS), t);
      hemi.groundColor.copy(C(a.hemiG)).lerp(C(b.hemiG), t);
      hemi.intensity = mix(a.hemiI, b.hemiI);
      lit.env = mix(a.env, b.env);
      mats.forEach((m) => (m.envMapIntensity = lit.env * m.userData.env));
      lamps.forEach((l) => (l.intensity = mix(a.lamp, b.lamp)));
      mat.bulb.emissiveIntensity = mix(a.bulb, b.bulb);
      mat.fire.emissiveIntensity = mix(a.fire, b.fire);
      cityMat.emissiveIntensity = mix(a.city, b.city);
      stars.material.opacity = mix(a.stars, b.stars);
      stars.visible = stars.material.opacity > 0.01;
      renderer.toneMappingExposure = mix(a.exp, b.exp);
      skyUni.top.value.copy(C(a.top)).lerp(C(b.top), t);
      skyUni.mid.value.copy(C(a.mid)).lerp(C(b.mid), t);
      skyUni.bot.value.copy(C(a.bot)).lerp(C(b.bot), t);
      scene.fog.color.copy(C(a.fog)).lerp(C(b.fog), t);
    };
    let litTween = null;
    const setTime = (id, instant) => {
      const target = TIMES[id] || TIMES.day;
      const t0 = { ...target, dir: target.dir.clone() };
      if (instant || reduce) { applyLit(t0, t0, 1); litTween = null; }
      else litTween = { from: snapLit(), to: t0, t: 0, dur: 0.9 };
      dirty = true;
    };

    // ---------- konfiguracja ----------
    const floorRough = { gres: 0.5, dab: 0.6, jodelka: 0.6, mikro: 0.7 };
    const applyCfg = (p) => {
      if (p.floor) {
        mat.floor.map = tex[p.floor] || tex.gres;
        mat.floor.roughness = floorRough[p.floor] ?? 0.55;
        mat.floor.needsUpdate = true;
      }
      if (p.walls) mat.wall.color.set((PH.config.walls.find((w) => w.id === p.walls) || PH.config.walls[0]).color);
      if (p.kitchen) {
        const k2 = PH.config.kitchen.find((w) => w.id === p.kitchen) || PH.config.kitchen[0];
        if (k2.id === 'dab') { mat.front.map = tex.oakLight; mat.front.color.set(0xffffff); }
        else { mat.front.map = null; mat.front.color.set(k2.color); }
        mat.front.roughness = k2.id === 'bialy' ? 0.4 : 0.55;
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
      dirty = true;
    };
    applyCfg({ ...cfg });
    setTime(cfg.time, true);

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
    world.add(spotsGroup);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    const spotFill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
    const spots = PH.rooms.map((r) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), spotMat);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), spotFill);
      ring.rotation.x = disc.rotation.x = -Math.PI / 2;
      g.add(ring, disc);
      g.position.set(X(r.spot[0]), 0.02, Z(r.spot[1]));
      g.userData.room = r.id;
      ring.userData.room = disc.userData.room = r.id;
      spotsGroup.add(g);
      return g;
    });
    spotsGroup.visible = false;

    // ---------- kamera ----------
    const orbit = { theta: 0.62, phi: 0.92, radius: 24, target: new THREE.Vector3(0, 0, 0.3) };
    const walk = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.05 };
    let mode = 'doll';
    let current = null;
    const look = new THREE.Vector3();
    const orbitPose = (o = orbit) => {
      const p = new THREE.Vector3(
        o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        o.target.y + o.radius * Math.cos(o.phi),
        o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
      );
      return { pos: p, look: o.target.clone(), fov: aspect < 1 ? 50 : 40 };
    };
    const walkPose = (w = walk) => {
      const dir = new THREE.Vector3(Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch));
      return { pos: w.pos.clone(), look: w.pos.clone().add(dir), fov: aspect < 1 ? 78 : 70 };
    };
    let aspect = 1.6;
    let tween = null; // przelot kamery
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const shellTarget = { doll: 0.82, walk: 1, plan: 0.36 };
    let shellY = 0.82;
    const setShell = (v) => { shellY = v; shell.scale.y = v; };
    setShell(0.82);

    const poseNow = () => ({ pos: camera.position.clone(), look: look.clone(), fov: camera.fov });
    const flyTo = (to, dur, done) => {
      if (reduce) dur = Math.min(dur, 0.25);
      tween = { from: poseNow(), to, t: 0, dur, done, shellFrom: shellY, shellTo: shellTarget[mode] };
      dirty = true;
    };

    const roomAt = (x, z) => {
      const px = PX(x);
      const py = PY(z);
      return PH.rooms.find((r) => r.rects.some((q2) => px >= q2[0] - 2 && px <= q2[2] + 2 && py >= q2[1] - 2 && py <= q2[3] + 2));
    };

    const setCurrent = (r) => {
      if (r && current && r.id === current.id) return;
      current = r;
      emit({ mode, room: r ? r.id : null });
      root.querySelectorAll('.tour__rooms [data-room]').forEach((b) => b.setAttribute('aria-pressed', String(!!r && b.dataset.room === r.id)));
      const nameEl = $('.tour__room');
      if (nameEl) nameEl.innerHTML = r ? `<b>${r.name}</b> <span>${String(r.area).replace('.', ',')} m²</span>` : '';
      const ph = $('.js-tour-photo');
      if (ph) {
        ph.hidden = !(r && r.photos.length);
        ph.dataset.photo = r && r.photos[0] ? r.photos[0] : '';
      }
      if (mini) mini.querySelectorAll('[data-room]').forEach((el) => el.classList.toggle('is-on', !!r && el.dataset.room === r.id));
    };

    const updateModeUi = () => {
      root.dataset.mode = mode;
      root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      spotsGroup.visible = mode === 'walk';
      ceiling.visible = mode === 'walk' && !tween;
    };

    function go(id, opts = {}) {
      const r = PH.rooms.find((x) => x.id === id);
      if (!r) return;
      const wasWalk = mode === 'walk';
      mode = 'walk';
      updateModeUi();
      ceiling.visible = false;
      walk.pos.set(X(r.spot[0]), EYE, Z(r.spot[1]));
      walk.yaw = (r.spot[2] * Math.PI) / 180;
      walk.pitch = -0.06;
      setCurrent(r);
      flyTo(walkPose(), opts.instant ? 0.01 : wasWalk ? 0.9 : 1.5, () => { ceiling.visible = mode === 'walk'; });
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
      if (m === 'walk') { go(current ? current.id : 'przedpokoj'); return; }
      mode = m;
      updateModeUi();
      ceiling.visible = false;
      if (m === 'plan') {
        orbit.theta = Math.round(orbit.theta / (Math.PI * 2)) * Math.PI * 2; // rzut: taras u góry
        orbit.phi = 0.001;
        orbit.radius = aspect < 1 ? 30 : 23;
      }
      else { orbit.phi = aspect < 1 ? 0.72 : 0.92; orbit.radius = aspect < 1 ? 27 : 26; }
      setCurrent(null);
      flyTo(orbitPose(), 1.2, () => {});
      idle = 0;
    }

    // ---------- sterowanie ----------
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
        if (hf.length) {
          const r = roomAt(hf[0].point.x, hf[0].point.z);
          if (r) go(r.id);
        }
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
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
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
      if (mode === 'walk') camera.fov = Math.max(42, Math.min(85, camera.fov * f));
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
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    new ResizeObserver(resize).observe(stage);
    resize();

    // pozycja startowa (wejście z daleka); na pionowym ekranie widok bardziej z góry
    orbit.radius = aspect < 1 ? 27 : 26;
    if (aspect < 1) { orbit.phi = 0.72; orbit.theta = 0.35; }
    const start = orbitPose();
    const intro = { ...orbit, theta: orbit.theta + 0.9, phi: 0.62, radius: orbit.radius * 1.55, target: orbit.target.clone() };
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
        flyTo(start, reduce ? 0.01 : 2.2, () => {});
      }
      if (visible) loop();
    }, { threshold: 0.15 }).observe(stage);

    const v3 = new THREE.Vector3();
    const miniMe = mini && mini.querySelector('.mini__me');
    let last = performance.now();
    let raf = 0;
    let firstFrame = true;
    function loop() {
      if (raf || !visible) return;
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      idle += dt;
      // przelot
      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        const e = ease(tween.t);
        camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
        look.lerpVectors(tween.from.look, tween.to.look, e);
        camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e;
        setShell(tween.shellFrom + (tween.shellTo - tween.shellFrom) * e);
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
      if (litTween) {
        litTween.t = Math.min(1, litTween.t + dt / litTween.dur);
        applyLit(litTween.from, litTween.to, ease(litTween.t));
        if (litTween.t >= 1) litTween = null;
        dirty = true;
      }
      if (dirty || drag) {
        camera.lookAt(look);
        camera.updateProjectionMatrix();
        // słońce: cień wokół mieszkania
        sun.target.position.set(0, 0, 0);
        renderer.render(scene, camera);
        dirty = false;
        if (firstFrame) { firstFrame = false; root.classList.add('is-ready'); }
        // etykiety
        const showLabels = mode !== 'walk' && !tween;
        labels.forEach((lb) => {
          v3.copy(lb.pos);
          v3.y *= shellY;
          v3.project(camera);
          const on = showLabels && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
          lb.el.classList.toggle('is-on', on);
          if (on) lb.el.style.transform = `translate(${((v3.x + 1) / 2) * W}px, ${((1 - v3.y) / 2) * Hh}px) translate(-50%, -50%)`;
        });
        // minimapa
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
      renderer.render(scene, camera);
      try { return renderer.domElement.toDataURL('image/jpeg', 0.82); } catch (e) { return null; }
    }

    return { apply: applyCfg, setMode, go, snapshot, resize, busy: () => !!tween || !!litTween || !introDone };
  }
})();
