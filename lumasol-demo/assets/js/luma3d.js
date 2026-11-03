/* ==========================================================================
   Luma Sol — scena 3D: dom z tarasem, ogród i zabudowa (ogród zimowy
   całoroczny / sezonowy, zadaszenie tarasu, pergola lamelowa).
   Ta sama scena działa w dwóch miejscach:
   • konfigurator w hero — klient zmienia rodzaj, wymiary, kolor, dach,
     ściany i dodatki, a model przebudowuje się na żywo,
   • „Cztery pory roku” (sekcja 3) — przewijanie zmienia porę roku: lato,
     deszcz jesienią, śnieg na dachu zimą, kwiaty wiosną.
   Zwykły skrypt + dynamiczny import three.js (import map w <head>),
   żeby strona działała też otwarta prosto z dysku (file://).
   ========================================================================== */
(() => {
  const LS = (window.LumaScene = {});
  let THREE = null;
  let RoomEnvironment = null;
  let loading = null;

  LS.load = () =>
    loading ||
    (loading = (async () => {
      try {
        THREE = await import('three');
        ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
        return true;
      } catch {
        return false;
      }
    })());

  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const damp = (cur, target, k, dt) => lerp(cur, target, 1 - Math.exp(-k * dt));

  // Kolory konstrukcji (proszkowo malowane aluminium)
  LS.COLORS = {
    antracyt: { hex: '#3a4045', name: 'Antracyt RAL 7016' },
    bialy: { hex: '#eeede7', name: 'Biały RAL 9016' },
    czarny: { hex: '#16171a', name: 'Czarny RAL 9005' },
    dab: { hex: '#8a5a33', name: 'Złoty dąb (okleina)' },
  };

  // Pory dnia: niebo, słońce, światło wnętrza
  const TIMES = {
    day: { top: '#7fb6e6', hor: '#e4eef5', sun: '#fff1dc', sunI: 2.7, sunEl: 0.95, sunAz: -0.75, hemi: 0.95, env: 0.9, inside: 0, exp: 1.0, win: 0 },
    sunset: { top: '#3f5384', hor: '#f2a978', sun: '#ffab68', sunI: 2.2, sunEl: 0.2, sunAz: -1.1, hemi: 0.45, env: 0.4, inside: 0.6, exp: 1.04, win: 0.22 },
    night: { top: '#060c19', hor: '#1c2840', sun: '#9fb4dc', sunI: 0.3, sunEl: 0.9, sunAz: 0.6, hemi: 0.14, env: 0.08, inside: 1, exp: 1.15, win: 0.85 },
  };

  /* ------------------------------------------------------------------------
     Tekstury rysowane w canvasie (bez pobierania plików)
     ------------------------------------------------------------------------ */
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  }

  function lawnTex() {
    return canvasTex(
      256,
      (g, s) => {
        g.fillStyle = '#5b7d43';
        g.fillRect(0, 0, s, s);
        for (let i = 0; i < 5200; i++) {
          const l = 26 + Math.random() * 18;
          g.fillStyle = `hsl(${86 + Math.random() * 16}, ${26 + Math.random() * 14}%, ${l}%)`;
          g.fillRect(Math.random() * s, Math.random() * s, 1.2, 2.4 + Math.random() * 2);
        }
      },
      34
    );
  }

  function tileTex() {
    return canvasTex(256, (g, s) => {
      g.fillStyle = '#c9c4ba';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,84,76'},${Math.random() * 0.06})`;
        g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      g.strokeStyle = 'rgba(70,64,58,0.35)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, s / 2 - 2, s - 2);
      g.strokeRect(s / 2 + 1, 1, s / 2 - 2, s - 2);
    });
  }

  function deckTex() {
    return canvasTex(256, (g, s) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `hsl(28, ${30 + Math.random() * 8}%, ${44 + Math.random() * 8}%)`;
        g.fillRect(0, (i * s) / 8, s, s / 8 - 2);
      }
      g.fillStyle = 'rgba(40,24,12,0.5)';
      for (let i = 0; i < 8; i++) g.fillRect(0, ((i + 1) * s) / 8 - 2, s, 2);
    });
  }

  function dotSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ------------------------------------------------------------------------
     Scena
     ------------------------------------------------------------------------ */
  class Garden {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.opts = opts;
      this.small = matchMedia('(max-width: 760px)').matches;
      this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.cfg = Object.assign(
        { type: 'calo', W: 5, D: 3.5, color: 'antracyt', glass: 'clear', walls: 'slide', open: 0, lamella: 0.15, led: true, awning: false, heaters: false },
        opts.cfg || {}
      );
      // wartości animowane (aktualne → docelowe)
      this.anim = { open: this.cfg.open, lamella: this.cfg.lamella, awning: this.cfg.awning ? 1 : 0, led: this.cfg.led ? 1 : 0, heat: this.cfg.heaters ? 1 : 0, pop: 1 };
      this.timeKey = opts.time || 'sunset';
      this.tm = Object.assign({}, TIMES[this.timeKey]);
      this.season = null; // tylko w trybie pór roku
      this.view = { az: -0.6, pol: 1.25, dist: 17, tx: 0, ty: 1.5, tz: 1.8 };
      this.viewT = Object.assign({}, this.view);
      this.offsetX = 0;
      this.distK = 1; // dodatkowe oddalenie kadru (hero na szerokim ekranie)
      this.running = false;
      this.last = 0;
      this.t = 0;
      this.onFrame = null;

      this.initRenderer();
      this.initWorld();
      this.buildStructure();
      if (opts.seasons) this.initWeather();
      this.applyTime(1);
      this.resize();
    }

    initRenderer() {
      const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }));
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 1.75));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
      this.aspectK = 1;
      const pm = new THREE.PMREMGenerator(r);
      this.scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
    }

    mat(color, rough = 0.7, metal = 0, extra = {}) {
      return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
    }

    box(w, h, d, mat, x = 0, y = 0, z = 0, parent = this.scene, cast = true, receive = true) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = receive;
      parent.add(m);
      return m;
    }

    initWorld() {
      const S = this.scene;
      const M = (this.M = {});

      // Niebo: kopuła z gradientem
      this.sky = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(hor, top, pow(clamp(h,0.0,1.0),0.55)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), this.sky);
      S.add(dome);
      S.fog = new THREE.Fog('#e4eef5', 38, 120);

      // Światło
      this.hemi = new THREE.HemisphereLight('#dfefff', '#4f6b3a', 0.9);
      S.add(this.hemi);
      const sun = (this.sun = new THREE.DirectionalLight('#fff1dc', 2.6));
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.small ? 1024 : 2048, this.small ? 1024 : 2048);
      sun.shadow.camera.left = -15;
      sun.shadow.camera.right = 15;
      sun.shadow.camera.top = 15;
      sun.shadow.camera.bottom = -15;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 60;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      sun.target.position.set(0, 0, 2);
      S.add(sun, sun.target);

      // Trawnik
      M.lawn = this.mat('#ffffff', 0.95, 0, { map: lawnTex() });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M.lawn);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      S.add(ground);
      this.ground = ground;

      // Dom
      const house = (this.house = new THREE.Group());
      S.add(house);
      M.render = this.mat('#f1efea', 0.92);
      M.dark = this.mat('#2f3438', 0.55, 0.2);
      M.plinth = this.mat('#55595c', 0.85);
      M.winGlass = this.mat('#1d2a33', 0.08, 0.6, { envMapIntensity: 1.4, emissive: new THREE.Color('#ffc884'), emissiveIntensity: 0 });
      M.clad = this.mat('#4a3a2c', 0.8, 0, { map: deckTex() });
      M.clad.map.repeat.set(1, 3);
      this.box(16, 6.4, 9, M.render, 0, 3.2, -4.5, house);
      this.box(16.5, 0.38, 9.5, M.dark, 0, 6.55, -4.5, house);
      this.box(16.1, 0.34, 9.1, M.plinth, 0, 0.17, -4.5, house);
      this.box(4.2, 3.0, 0.08, M.clad, 5.6, 4.7, 0.04, house); // okładzina drewniana na piętrze
      const win = (w, h, x, y) => {
        this.box(w + 0.14, h + 0.14, 0.1, M.dark, x, y, 0.04, house, false);
        this.box(w, h, 0.06, M.winGlass, x, y, 0.08, house, false);
      };
      // drzwi tarasowe w osi zabudowy
      win(1.9, 2.35, -1.05, 1.5);
      win(1.9, 2.35, 1.05, 1.5);
      win(1.5, 1.5, -5.6, 1.6);
      win(1.5, 1.5, 6.2, 1.6);
      win(1.4, 1.5, -5.6, 4.6);
      win(1.4, 1.5, -2.4, 4.6);
      win(1.4, 1.5, 1.2, 4.6);
      // kinkiety przy drzwiach
      M.lamp = this.mat('#ffd9a0', 0.4, 0, { emissive: new THREE.Color('#ffc177'), emissiveIntensity: 0 });

      // Żywopłot, sosny, drzewa liściaste, basen
      M.hedge = this.mat('#3f6a33', 0.95);
      M.leaf = this.mat('#4f7f39', 0.9);
      M.pine = this.mat('#2f5a34', 0.9);
      M.trunk = this.mat('#6b4f3a', 0.95);
      M.pineTrunk = this.mat('#9a6243', 0.9);
      this.hedgeCaps = [];
      M.snow = this.mat('#f4f7fa', 0.9);
      [
        [-11.5, 4, 1.3, 16],
        [11.5, 4, 1.3, 16],
      ].forEach(([x, z, h, len]) => {
        this.box(1.2, h, len, M.hedge, x, h / 2, z);
        const cap = this.box(1.25, 0.12, len + 0.05, M.snow, x, h + 0.06, z, this.scene, false, false);
        cap.scale.y = 0.001;
        this.hedgeCaps.push(cap);
      });
      const pine = (x, z, h) => {
        const g = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h * 0.72, 7), M.pineTrunk);
        tr.position.y = (h * 0.72) / 2;
        tr.castShadow = true;
        g.add(tr);
        const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.2, 1), M.pine);
        cr.scale.set(1.15, 0.85, 1.15);
        cr.position.y = h * 0.82;
        cr.castShadow = true;
        g.add(cr);
        g.position.set(x, 0, z);
        this.scene.add(g);
      };
      [
        [-9, -12, 15],
        [-4, -14, 17],
        [2, -13, 16],
        [7, -12, 14.5],
        [12, -9, 16],
        [-13, -6, 14],
        [-15, 3, 15],
        [15, 2, 13],
        [-18, 12, 16],
        [19, 13, 15],
      ].forEach((a) => pine(...a));
      const tree = (x, z, s) => {
        const g = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.2 * s, 7), M.trunk);
        tr.position.y = 1.1 * s;
        tr.castShadow = true;
        g.add(tr);
        [
          [0, 2.8, 0, 1.25],
          [0.6, 2.4, 0.3, 0.9],
          [-0.55, 2.5, -0.2, 0.95],
        ].forEach(([a, b, c, r]) => {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), M.leaf);
          f.position.set(a * s, b * s, c * s);
          f.castShadow = true;
          g.add(f);
        });
        g.position.set(x, 0, z);
        this.scene.add(g);
      };
      tree(-13.5, 2.5, 1.2);
      tree(11.8, 5.5, 1);
      // Basen
      M.coping = this.mat('#dcd8cf', 0.8);
      M.water = this.mat('#2f9ac8', 0.08, 0.1, { transparent: true, opacity: 0.88, envMapIntensity: 1.6, emissive: new THREE.Color('#1b6f97'), emissiveIntensity: 0 });
      this.box(7.4, 0.12, 3.9, M.coping, 5.2, 0.06, 11.2);
      this.water = this.box(6.6, 0.06, 3.1, M.water, 5.2, 0.1, 11.2, this.scene, false, true);

      // Taras + zabudowa + meble budowane w buildStructure()
      M.tiles = this.mat('#ffffff', 0.85, 0, { map: tileTex() });
      M.frame = this.mat(LS.COLORS[this.cfg.color].hex, 0.42, 0.45);
      M.glassRoof = this.mat('#cfe5ee', 0.04, 0.1, { transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.3, side: THREE.DoubleSide });
      M.glassWall = this.mat('#dcecf2', 0.03, 0.1, { transparent: true, opacity: 0.13, depthWrite: false, envMapIntensity: 1.5, side: THREE.DoubleSide });
      M.awning = this.mat('#d8d0c0', 0.95, 0, { side: THREE.DoubleSide });
      M.led = this.mat('#fff2d8', 0.5, 0, { emissive: new THREE.Color('#ffd49a'), emissiveIntensity: 0 });
      M.heater = this.mat('#2b2b2b', 0.5, 0.3, { emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 0 });
      M.fabric = this.mat('#d9d3c7', 0.95);
      M.cushion = this.mat('#b9b1a2', 0.95);
      M.wood = this.mat('#7a5638', 0.7);
      M.pot = this.mat('#3b3d3f', 0.8);
      M.plant = this.mat('#467c3a', 0.9);
      M.rug = this.mat('#a39a8a', 1);

      // Światło wnętrza zabudowy (ciepłe)
      this.inLight = new THREE.PointLight('#ffc98a', 0, 9, 1.6);
      this.inLight.position.set(0, 2.1, 1.8);
      S.add(this.inLight);
      this.heatLight = new THREE.PointLight('#ff6a2a', 0, 4, 2);
      S.add(this.heatLight);
    }

    /* Wymiary pochodne dla rodzaju zabudowy */
    dims() {
      const c = this.cfg;
      const per = c.type === 'pergola';
      const p = { calo: 0.15, sezon: 0.11, zadaszenie: 0.11, pergola: 0.17 }[c.type];
      const H1 = per ? 2.75 : 2.95;
      const H2 = per ? 2.75 : 2.42;
      return { W: c.W, D: c.D, p, H1, H2, per, beamH: per ? 0.24 : 0.2 };
    }

    roofY(z) {
      const d = this.dims();
      const y1 = d.H1 + 0.16;
      const y2 = d.H2 + d.beamH;
      return y1 + ((y2 - y1) * z) / d.D;
    }

    clearGroup(g) {
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      this.scene.remove(g);
    }

    buildStructure() {
      if (this.struct) this.clearGroup(this.struct);
      const G = (this.struct = new THREE.Group());
      this.scene.add(G);
      const M = this.M;
      const d = this.dims();
      const { W, D, p, H1, H2 } = d;
      const c = this.cfg;
      this.leds = [];
      this.panels = [];
      this.lamellas = [];
      this.slope = null;
      this.awningMesh = null;
      this.roofSnow = null;

      // taras
      const tw = W + 1.4;
      const td = D + 1.0;
      M.tiles.map.repeat.set(tw / 1.2, td / 0.6);
      this.box(tw, 0.16, td, M.tiles, 0, 0.08, td / 2 + 0.02, G, false, true);
      const base = 0.16;

      // słupy na froncie
      const n = Math.max(2, Math.ceil(W / 3.4) + 1);
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + p / 2 + ((W - p) * i) / (n - 1);
        this.box(p, H2 - base, p, M.frame, x, base + (H2 - base) / 2, D - p / 2, G);
      }
      // rynna / belka frontowa
      this.box(W, d.beamH, p + 0.06, M.frame, 0, H2 + d.beamH / 2, D - p / 2, G);
      // rura spustowa
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H2 - base, 8), M.frame);
      pipe.position.set(W / 2 - p / 2 + 0.07, base + (H2 - base) / 2, D - p - 0.04);
      G.add(pipe);

      if (d.per) {
        // pergola: rama płaska + lamele
        this.box(W, d.beamH, 0.14, M.frame, 0, H1 + d.beamH / 2, 0.07, G);
        this.box(p, d.beamH, D, M.frame, -W / 2 + p / 2, H1 + d.beamH / 2, D / 2, G);
        this.box(p, d.beamH, D, M.frame, W / 2 - p / 2, H1 + d.beamH / 2, D / 2, G);
        const k = Math.max(6, Math.floor((D - 0.3) / 0.19));
        for (let i = 0; i < k; i++) {
          const z = 0.22 + ((D - 0.44) * (i + 0.5)) / k;
          const l = this.box(W - p * 2 - 0.04, 0.03, 0.19, M.frame, 0, H1 + d.beamH * 0.55, z, G, true, true);
          this.lamellas.push(l);
        }
        // LED w obwodzie pergoli
        const s = this.box(W - p * 2, 0.02, 0.03, M.led, 0, H1 + 0.01, D - p - 0.04, G, false, false);
        this.leds.push(s);
      } else {
        // belka przyścienna
        this.box(W, 0.16, 0.12, M.frame, 0, H1 + 0.08, 0.06, G);
        const y1 = H1 + 0.16;
        const y2 = H2 + d.beamH;
        const L = Math.hypot(D, y1 - y2);
        const ang = Math.atan2(y1 - y2, D);
        this.slope = { y1, y2, L, ang };
        const m = Math.max(3, Math.round(W / 0.9) + 1);
        for (let i = 0; i < m; i++) {
          const x = -W / 2 + 0.04 + ((W - 0.08) * i) / (m - 1);
          const r = this.box(0.07, 0.11, L, M.frame, x, (y1 + y2) / 2 + 0.02, D / 2, G);
          r.rotation.x = ang;
          if (i > 0 && i < m - 1 && i % 2 === 1) {
            const s = this.box(0.025, 0.012, L * 0.92, M.led, x, (y1 + y2) / 2 - 0.045, D / 2, G, false, false);
            s.rotation.x = ang;
            this.leds.push(s);
          }
        }
        const glass = this.box(W - 0.06, 0.02, L, M.glassRoof, 0, (y1 + y2) / 2 - 0.01, D / 2, G, false, false);
        glass.rotation.x = ang;
        glass.renderOrder = 2;
        // markiza nad szkłem
        const aw = (this.awningMesh = this.box(W - 0.2, 0.015, L, M.awning, 0, 0, 0, G, true, false));
        aw.rotation.x = ang;
        // śnieg na dachu (pory roku)
        const sn = (this.roofSnow = this.box(W + 0.08, 0.14, L + 0.04, M.snow, 0, (y1 + y2) / 2 + 0.1, D / 2, G, false, false));
        sn.rotation.x = ang;
        sn.scale.y = 0.001;
        sn.visible = false;
      }

      // ściany szklane przesuwne
      const hasWalls = !d.per && (c.type !== 'zadaszenie' || c.walls === 'slide');
      this.hasWalls = hasWalls;
      if (hasWalls) {
        const f = c.type === 'calo' ? 0.07 : 0.045;
        const Hp = H2 - base - 0.04;
        const mkPanel = (w, h) => {
          const g = new THREE.Group();
          this.box(w, f, f, M.frame, 0, h / 2 - f / 2, 0, g, true, false);
          this.box(w, f, f, M.frame, 0, -h / 2 + f / 2, 0, g, true, false);
          this.box(f, h, f, M.frame, -w / 2 + f / 2, 0, 0, g, true, false);
          this.box(f, h, f, M.frame, w / 2 - f / 2, 0, 0, g, true, false);
          const gl = this.box(w - f, h - f, 0.012, M.glassWall, 0, 0, 0, g, false, false);
          gl.renderOrder = 3;
          if (c.type === 'calo') {
            const gl2 = this.box(w - f, h - f, 0.012, M.glassWall, 0, 0, 0.03, g, false, false);
            gl2.renderOrder = 3;
          }
          return g;
        };
        // szyny
        this.box(W - p * 2, 0.04, 0.16, M.frame, 0, base + 0.02, D - p / 2, G, false, true);
        // front
        const nf = Math.max(3, Math.round((W - p * 2) / 1.05));
        const pwF = (W - p * 2) / nf;
        for (let i = 0; i < nf; i++) {
          const g = mkPanel(pwF + 0.02, Hp);
          const home = -W / 2 + p + pwF * (i + 0.5);
          const stack = -W / 2 + p + pwF / 2 + i * 0.05;
          g.position.set(home, base + 0.02 + Hp / 2, D - p / 2 - 0.045 + (i % 3) * 0.035);
          G.add(g);
          this.panels.push({ g, axis: 'x', home, stack });
        }
        // boki
        [-1, 1].forEach((side) => {
          const ns = Math.max(2, Math.round((D - p) / 1.05));
          const pwS = (D - p - 0.1) / ns;
          for (let i = 0; i < ns; i++) {
            const g = mkPanel(pwS + 0.02, Hp);
            g.rotation.y = Math.PI / 2;
            const home = 0.1 + pwS * (i + 0.5);
            const stack = 0.1 + pwS / 2 + (ns - 1 - i) * 0.05;
            g.position.set(side * (W / 2 - 0.05 - (i % 2) * 0.035), base + 0.02 + Hp / 2, home);
            G.add(g);
            this.panels.push({ g, axis: 'z', home, stack: stack });
          }
          // stały klin pod spadkiem dachu
          const sh = new THREE.Shape();
          sh.moveTo(0.06, H2);
          sh.lineTo(D - p, H2);
          sh.lineTo(D - p, this.slope.y2 - 0.05 - ((this.slope.y1 - this.slope.y2) * p) / D);
          sh.lineTo(0.06, this.slope.y1 - 0.05);
          sh.lineTo(0.06, H2);
          const tri = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.glassWall);
          tri.rotation.y = -Math.PI / 2;
          tri.position.x = side * (W / 2 - 0.04);
          tri.renderOrder = 3;
          G.add(tri);
          this.box(0.05, 0.05, D - p, M.frame, side * (W / 2 - 0.04), H2, (D - p) / 2, G, false, false);
        });
      }

      // promienniki ciepła
      this.heaters = [];
      if (!d.per) {
        [-W / 4, W / 4].forEach((x) => {
          this.heaters.push(this.box(0.62, 0.1, 0.12, M.heater, x, H1 - 0.12, 0.16, G, false, false));
        });
      }
      this.heatLight.position.set(0, H1 - 0.4, 0.8);

      // meble
      this.buildFurniture(G, d);
      this.inLight.position.set(0, Math.min(H2, H1) - 0.4, D / 2);

      // kamera celuje w środek zabudowy
      this.viewT.tz = D * 0.5;
      this.viewT.dist = 9.8 + W * 0.62 + D * 0.48;
      this.applyColor();
      this.anim.pop = 0;
    }

    buildFurniture(G, d) {
      const { W, D } = d;
      const M = this.M;
      const sw = Math.min(W * 0.52, 2.6);
      const zS = Math.min(0.95, D * 0.28);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W * 0.6, 3), Math.min(D * 0.55, 2.2)), M.rug);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.165, D * 0.52);
      rug.receiveShadow = true;
      G.add(rug);
      // sofa
      this.box(sw, 0.38, 0.85, M.fabric, 0, 0.16 + 0.19, zS, G);
      this.box(sw, 0.42, 0.22, M.fabric, 0, 0.16 + 0.56, zS - 0.32, G);
      this.box(0.2, 0.28, 0.85, M.fabric, -sw / 2 + 0.1, 0.16 + 0.52, zS, G);
      this.box(0.2, 0.28, 0.85, M.fabric, sw / 2 - 0.1, 0.16 + 0.52, zS, G);
      for (let i = 0; i < 3; i++) this.box(sw / 3 - 0.1, 0.12, 0.55, M.cushion, -sw / 3 + (i * sw) / 3, 0.16 + 0.44, zS + 0.08, G);
      // stolik
      const zt = D * 0.55;
      this.box(1.1, 0.06, 0.62, M.wood, 0, 0.16 + 0.4, zt, G);
      this.box(0.9, 0.36, 0.42, M.dark, 0, 0.16 + 0.18, zt, G);
      // fotele
      if (D > 2.8) {
        [-0.7, 0.7].forEach((x) => {
          this.box(0.75, 0.34, 0.7, M.fabric, x, 0.16 + 0.17, D - 0.75, G);
          this.box(0.75, 0.4, 0.16, M.fabric, x, 0.16 + 0.5, D - 0.48, G);
        });
      }
      // rośliny w donicach
      [
        [-W / 2 + 0.45, 0.45],
        [W / 2 - 0.45, 0.45],
        [W / 2 - 0.5, D - 0.6],
      ].forEach(([x, z], i) => {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.48, 14), M.pot);
        pot.position.set(x, 0.16 + 0.24, z);
        pot.castShadow = true;
        G.add(pot);
        const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 2 ? 0.42 : 0.5, 1), M.plant);
        pl.scale.set(0.9, 1.35, 0.9);
        pl.position.set(x, 0.16 + 0.48 + 0.55, z);
        pl.castShadow = true;
        G.add(pl);
      });
    }

    applyColor() {
      this.M.frame.color.set(LS.COLORS[this.cfg.color].hex);
      const tint = this.cfg.glass === 'tint';
      this.M.glassRoof.color.set(tint ? '#3e4a52' : '#cfe5ee');
      this.M.glassRoof.opacity = tint ? 0.58 : 0.2;
    }

    /* Zmiana konfiguracji z panelu */
    setConfig(next) {
      const prev = Object.assign({}, this.cfg);
      Object.assign(this.cfg, next);
      const rebuild = ['type', 'W', 'D', 'walls'].some((k) => prev[k] !== this.cfg[k]);
      if (rebuild) this.buildStructure();
      else this.applyColor();
      if (prev.type !== this.cfg.type) this.anim.pop = 0;
      this.kick();
    }

    setTime(key) {
      this.timeKey = key;
      this.kick();
    }

    /* Pory dnia: płynne przejście */
    applyTime(k) {
      const T = TIMES[this.timeKey];
      const tm = this.tm;
      for (const key of ['sunI', 'sunEl', 'sunAz', 'hemi', 'env', 'inside', 'exp', 'win']) tm[key] = lerp(tm[key], T[key], k);
      tm.topC = (tm.topC || new THREE.Color(T.top)).lerp(new THREE.Color(T.top), k);
      tm.horC = (tm.horC || new THREE.Color(T.hor)).lerp(new THREE.Color(T.hor), k);
      tm.sunC = (tm.sunC || new THREE.Color(T.sun)).lerp(new THREE.Color(T.sun), k);
    }

    /* Sterowanie kamerą: przeciąganie obraca, bez zoomu kółkiem (strona się przewija) */
    attachControls(el) {
      let drag = null;
      let vx = 0;
      let vy = 0;
      const touch = matchMedia('(pointer: coarse)').matches;
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, t: performance.now() };
        el.setPointerCapture(e.pointerId);
        this.userAt = performance.now();
        el.classList.add('is-dragging');
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const now = performance.now();
        const dt = Math.max(now - drag.t, 1);
        drag = { x: e.clientX, y: e.clientY, t: now };
        this.viewT.az -= dx * 0.0062;
        if (!touch) this.viewT.pol = Math.min(Math.max(this.viewT.pol - dy * 0.004, 0.9), 1.45);
        vx = (-dx * 0.0062) / dt;
        vy = touch ? 0 : (-dy * 0.004) / dt;
        this.viewT.az = Math.min(Math.max(this.viewT.az, -1.35), 1.35);
        this.userAt = now;
        this.kick();
      });
      const up = () => {
        if (!drag) return;
        drag = null;
        el.classList.remove('is-dragging');
        // bezwładność: rzut do przodu proporcjonalny do prędkości
        this.viewT.az = Math.min(Math.max(this.viewT.az + vx * 220, -1.35), 1.35);
        this.viewT.pol = Math.min(Math.max(this.viewT.pol + vy * 160, 0.9), 1.45);
        vx = vy = 0;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }

    setOffset(px, py = 0) {
      this.offsetX = px;
      this.offsetY = py;
      this.resize();
    }

    resize() {
      const w = this.canvas.clientWidth || 1;
      const h = this.canvas.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // wąski / pionowy ekran: kamera odjeżdża, żeby zabudowa mieściła się w kadrze
      this.aspectK = w / h < 1.25 ? 1 + (1.25 - w / h) * 0.85 : 1;
      if (this.offsetX || this.offsetY) this.camera.setViewOffset(w, h, this.offsetX || 0, this.offsetY || 0, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.kick();
    }

    kick() {
      this.dirty = 2;
      if (this.running && !this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = 0;
      this.kick();
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    frame(now) {
      this.raf = 0;
      if (!this.running) return;
      const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0.016;
      this.last = now;
      this.t += dt;
      const busy = this.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.onFrame) this.onFrame(this);
      if (busy || this.dirty > 0 || this.opts.seasons || this.idleSway) {
        this.dirty--;
        this.raf = requestAnimationFrame((t) => this.frame(t));
      }
    }

    /* Jedna klatka: animacje parametrów, kamera, światło, pogoda */
    update(dt) {
      let busy = false;
      const A = this.anim;
      const c = this.cfg;
      const k = this.reduce ? 60 : 7;
      const step = (key, target, kk = k) => {
        const v = damp(A[key], target, kk, dt);
        if (Math.abs(v - target) > 0.002) busy = true;
        A[key] = Math.abs(v - target) < 0.002 ? target : v;
      };
      const S = this.season;
      step('open', S ? S.open : this.hasWalls ? c.open : 0, 5);
      step('lamella', c.lamella, 5);
      step('awning', c.awning ? 1 : 0, 4);
      step('led', (c.led ? 1 : 0) * (S ? S.led : 1), 5);
      step('heat', S ? S.heat : c.heaters ? 1 : 0, 4);
      step('pop', 1, 6);

      // pojawienie się po zmianie rodzaju
      const pop = A.pop;
      this.struct.scale.set(1, lerp(0.94, 1, pop), 1);

      // ściany przesuwne
      for (const pnl of this.panels) {
        const v = lerp(pnl.home, pnl.stack, A.open);
        if (pnl.axis === 'x') pnl.g.position.x = v;
        else pnl.g.position.z = v;
      }
      // lamele pergoli (0 = zamknięte, 1 = otwarte 85°)
      const la = A.lamella * 1.48;
      for (const l of this.lamellas) l.rotation.x = la;
      // markiza
      if (this.awningMesh && this.slope) {
        const s = this.slope;
        const a = Math.max(A.awning, 0.001);
        this.awningMesh.scale.z = a;
        const t = (s.L * a) / 2;
        this.awningMesh.position.set(0, s.y1 - Math.sin(s.ang) * t + 0.12, Math.cos(s.ang) * t + 0.06);
        this.awningMesh.visible = A.awning > 0.01;
      }

      // pora dnia (albo pora roku)
      if (S) this.applySeason(S, dt);
      else {
        this.applyTime(1 - Math.exp(-3 * dt));
        const tm = this.tm;
        const T = TIMES[this.timeKey];
        if (Math.abs(tm.sunI - T.sunI) > 0.01) busy = true;
        this.sky.uniforms.top.value.copy(tm.topC);
        this.sky.uniforms.hor.value.copy(tm.horC);
        this.scene.fog.color.copy(tm.horC);
        this.sun.color.copy(tm.sunC);
        this.sun.intensity = tm.sunI;
        this.hemi.intensity = tm.hemi;
        this.renderer.toneMappingExposure = tm.exp;
        this.scene.environment && (this.envI = tm.env);
        this.setLights(tm.inside, tm.win, tm.env);
        this.placeSun(tm.sunEl, tm.sunAz);
      }

      // kamera: spokojne kołysanie, gdy nikt nie dotyka
      const v = this.view;
      const vt = this.viewT;
      const idle = !S && !this.reduce && performance.now() - (this.userAt || 0) > 7000 && this.introDone;
      this.idleSway = idle;
      if (idle) vt.az = this.baseAz + Math.sin(this.t * 0.18) * 0.32;
      else if (!S) this.baseAz = vt.az;
      const kc = this.reduce ? 60 : 3.2;
      for (const key of ['az', 'pol', 'dist', 'tx', 'ty', 'tz']) {
        const nv = damp(v[key], vt[key], kc, dt);
        if (Math.abs(nv - vt[key]) > 0.0008) busy = true;
        v[key] = nv;
      }
      const sp = Math.sin(v.pol);
      const dist = v.dist * this.aspectK * this.distK;
      this.camera.position.set(v.tx + dist * sp * Math.sin(v.az), v.ty + dist * Math.cos(v.pol), v.tz + dist * sp * Math.cos(v.az));
      this.camera.lookAt(v.tx, v.ty, v.tz);

      // woda w basenie lekko „żyje”
      this.water.position.y = 0.1 + Math.sin(this.t * 1.3) * 0.004;
      return busy;
    }

    placeSun(el, az) {
      const r = 30;
      this.sun.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r + 2, 2 + Math.cos(az) * Math.cos(el) * r);
    }

    setLights(inside, win, env) {
      const A = this.anim;
      const M = this.M;
      const led = A.led;
      M.led.emissiveIntensity = led * (0.6 + inside * 2.6);
      this.inLight.intensity = (inside * 6 + led * inside * 5) * (this.small ? 0.9 : 1);
      M.winGlass.emissiveIntensity = win * 0.55;
      M.lamp.emissiveIntensity = win * 2;
      M.water.emissiveIntensity = win * 0.45;
      M.heater.emissiveIntensity = A.heat * (1.2 + inside * 1.5);
      this.heatLight.intensity = A.heat * (0.6 + inside * 2.2);
      // światło otoczenia (odbicia) gaśnie razem z porą dnia — na wszystkich materiałach
      for (const m of Object.values(M)) {
        if (!m.isMeshStandardMaterial) continue;
        m.envMapIntensity = env * (m === M.glassWall || m === M.glassRoof || m === M.winGlass ? 1.7 : m === M.water ? 1.4 : 1);
      }
    }

    /* Intro: kamera najeżdża z daleka */
    intro() {
      if (this.reduce) {
        this.introDone = true;
        return;
      }
      this.view.dist = this.viewT.dist + 9;
      this.view.az = this.viewT.az - 0.5;
      this.view.pol = 1.18;
      this.view.ty = 2.4;
      setTimeout(() => (this.introDone = true), 2200);
      this.kick();
    }

    snapshot() {
      const off = this.offsetX || this.offsetY;
      if (off) {
        this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
      }
      this.renderer.render(this.scene, this.camera);
      const url = this.canvas.toDataURL('image/jpeg', 0.82);
      if (off) this.resize();
      return url;
    }

    /* Rzut punktu 3D na ekran (etykiety wymiarów) */
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, behind: v.z > 1 };
    }

    /* ----------------------------------------------------------------------
       Pory roku (sekcja 3)
       ---------------------------------------------------------------------- */
    initWeather() {
      const N = this.small ? 700 : 1300;
      const rand = (a, b) => a + Math.random() * (b - a);
      this.box3 = { x0: -13, x1: 13, z0: -3, z1: 15, top: 11 };
      // deszcz: odcinki
      const rp = new Float32Array(N * 6);
      this.rain = [];
      for (let i = 0; i < N; i++) this.rain.push({ x: rand(-13, 13), y: rand(0, 11), z: rand(-3, 15), s: rand(11, 15) });
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      this.rainMat = new THREE.LineBasicMaterial({ color: '#c9d6e2', transparent: true, opacity: 0, depthWrite: false });
      this.rainLines = new THREE.LineSegments(rg, this.rainMat);
      this.rainLines.frustumCulled = false;
      this.scene.add(this.rainLines);
      // płatki: śnieg / liście / kwiaty
      const fp = new Float32Array(N * 3);
      const fc = new Float32Array(N * 3);
      this.flakes = [];
      for (let i = 0; i < N; i++) this.flakes.push({ x: rand(-13, 13), y: rand(0, 11), z: rand(-3, 15), ph: rand(0, 6.28), r: Math.random() });
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
      this.flakeMat = new THREE.PointsMaterial({ size: 0.12, map: dotSprite(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
      this.flakePts = new THREE.Points(fg, this.flakeMat);
      this.flakePts.frustumCulled = false;
      this.scene.add(this.flakePts);
      // warstwa śniegu / liści na trawniku i śnieg na dachu domu
      this.groundCover = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: '#f2f5f8', roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
      this.groundCover.rotation.x = -Math.PI / 2;
      this.groundCover.position.y = 0.015;
      this.groundCover.receiveShadow = true;
      this.scene.add(this.groundCover);
      this.houseSnow = this.box(16.4, 0.14, 9.4, this.M.snow, 0, 6.82, -4.5, this.scene, false, false);
      this.houseSnow.scale.y = 0.001;
      this.season = { open: 1, led: 1, heat: 0 };
      this.seasonP = 0;
      this.colLeaf = [new THREE.Color('#d9822b'), new THREE.Color('#b8542a'), new THREE.Color('#e3b23c')];
      this.colPetal = [new THREE.Color('#f7c6d4'), new THREE.Color('#ffffff'), new THREE.Color('#f2a7bf')];
      this.colSnow = new THREE.Color('#ffffff');
      this.lawnBase = new THREE.Color('#ffffff');
    }

    setSeasonProgress(p) {
      this.seasonP = clamp01(p);
      this.kick();
    }

    /* Wagi pór roku: lato, jesień, zima, wiosna */
    seasonWeights(p) {
      const centers = [0.11, 0.37, 0.63, 0.89];
      const w = centers.map((c) => Math.max(0, 1 - Math.abs(p - c) / 0.22));
      const sum = w.reduce((a, b) => a + b, 0) || 1;
      return w.map((x) => x / sum);
    }

    applySeason(S, dt) {
      const w = this.seasonWeights(this.seasonP);
      const mix = (arr) => arr.reduce((a, v, i) => a + v * w[i], 0);
      const mixC = (arr) => {
        const c = new THREE.Color(0, 0, 0);
        arr.forEach((h, i) => c.add(new THREE.Color(h).multiplyScalar(w[i])));
        return c;
      };
      // [lato, jesień, zima, wiosna]
      this.sky.uniforms.top.value.copy(mixC(['#6fb0e6', '#7e8a96', '#1b2742', '#8cc6ef']));
      const hor = mixC(['#e6f0f6', '#c4c9cc', '#5f6f8c', '#eef6fb']);
      this.sky.uniforms.hor.value.copy(hor);
      this.scene.fog.color.copy(hor);
      this.scene.fog.near = mix([40, 18, 22, 40]);
      this.scene.fog.far = mix([120, 70, 80, 120]);
      this.sun.color.copy(mixC(['#fff0d6', '#e3e6ea', '#9fb2d8', '#fff6e6']));
      this.sun.intensity = mix([2.8, 0.9, 0.35, 2.4]);
      this.hemi.intensity = mix([0.95, 0.75, 0.3, 0.95]);
      this.renderer.toneMappingExposure = mix([1, 0.95, 1.1, 1.02]);
      this.placeSun(mix([1.0, 0.7, 0.5, 0.85]), mix([-0.8, -0.5, 0.5, -0.6]));
      S.open = mix([1, 0, 0, 0.55]);
      S.led = mix([0.15, 0.7, 1, 0.3]);
      S.heat = mix([0, 0.2, 1, 0]);
      const inside = mix([0.05, 0.55, 1, 0.1]);
      const win = mix([0, 0.35, 1, 0]);
      this.setLights(inside, win, mix([0.9, 0.6, 0.3, 0.9]));

      const rain = w[1];
      const snow = w[2];
      const leaves = w[1] * 0.8;
      const petals = w[3];
      // trawnik i drzewa
      const g = this.M.lawn.color;
      g.copy(this.lawnBase).lerp(new THREE.Color('#b9a37a'), w[1] * 0.35).lerp(new THREE.Color('#f2f5f8'), snow * 0.92);
      this.M.leaf.color.set('#4f7f39').lerp(new THREE.Color('#c27a2c'), w[1] * 0.75).lerp(new THREE.Color('#d9e1e6'), snow * 0.55);
      this.M.hedge.color.set('#3f6a33').lerp(new THREE.Color('#5d6b3e'), w[1] * 0.4);
      const snowCover = smooth(0.48, 0.6, this.seasonP) * (1 - smooth(0.74, 0.82, this.seasonP));
      if (this.roofSnow) {
        this.roofSnow.visible = snowCover > 0.01;
        this.roofSnow.scale.y = Math.max(snowCover, 0.001);
      }
      this.hedgeCaps.forEach((h) => (h.scale.y = Math.max(snowCover, 0.001)));
      this.houseSnow.scale.y = Math.max(snowCover, 0.001);
      const gc = this.groundCover.material;
      gc.color.set('#9c7c45').lerp(new THREE.Color('#f2f5f8'), snowCover > 0.01 ? 1 : 0);
      gc.opacity = Math.max(snowCover * 0.94, w[1] * 0.3);

      // cząstki
      const B = this.box3;
      const d = this.dims();
      const inFoot = (x, z) => Math.abs(x) < d.W / 2 + 0.05 && z > 0 && z < d.D + 0.05;
      const roofY = (z) => (this.slope ? this.roofY(z) : d.H1 + 0.3) + 0.06;
      const rp = this.rainLines.geometry.attributes.position.array;
      this.rainMat.opacity = rain * 0.55;
      if (rain > 0.01 && !this.reduce) {
        this.rain.forEach((r, i) => {
          r.y -= r.s * dt;
          r.x += 1.2 * dt;
          if (r.y < 0.05 || (inFoot(r.x, r.z) && r.y < roofY(r.z)) || r.x > B.x1) {
            r.y = B.top + Math.random() * 2;
            r.x = B.x0 + Math.random() * (B.x1 - B.x0);
            r.z = B.z0 + Math.random() * (B.z1 - B.z0);
          }
          const j = i * 6;
          rp[j] = r.x;
          rp[j + 1] = r.y;
          rp[j + 2] = r.z;
          rp[j + 3] = r.x - 0.03;
          rp[j + 4] = r.y + 0.42;
          rp[j + 5] = r.z;
        });
        this.rainLines.geometry.attributes.position.needsUpdate = true;
      }
      const flakeAmt = Math.max(snow, leaves, petals);
      this.flakeMat.opacity = Math.min(1, flakeAmt * 1.2);
      this.flakeMat.size = snow * 0.11 + leaves * 0.2 + petals * 0.12 + 0.02;
      if (flakeAmt > 0.01 && !this.reduce) {
        const fp = this.flakePts.geometry.attributes.position.array;
        const fc = this.flakePts.geometry.attributes.color.array;
        const tw = snow + leaves + petals || 1;
        const vy = (snow * 1.1 + leaves * 1.6 + petals * 0.9) / tw;
        const sw = (snow * 0.5 + leaves * 1.4 + petals * 1.1) / tw;
        const tmp = new THREE.Color();
        this.flakes.forEach((f, i) => {
          f.y -= vy * dt * (0.7 + f.r * 0.6);
          f.x += (Math.sin(this.t * 1.3 + f.ph) * sw + 0.4) * dt;
          f.z += Math.cos(this.t * 1.1 + f.ph) * sw * 0.5 * dt;
          if (f.y < 0.05 || (inFoot(f.x, f.z) && f.y < roofY(f.z)) || f.x > B.x1) {
            f.y = B.top + Math.random() * 2;
            f.x = B.x0 + Math.random() * (B.x1 - B.x0);
            f.z = B.z0 + Math.random() * (B.z1 - B.z0);
          }
          const j = i * 3;
          fp[j] = f.x;
          fp[j + 1] = f.y;
          fp[j + 2] = f.z;
          const k = i % 3;
          tmp.setRGB(0, 0, 0);
          tmp.add(this.colSnow.clone().multiplyScalar(snow / tw));
          tmp.add(this.colLeaf[k].clone().multiplyScalar(leaves / tw));
          tmp.add(this.colPetal[k].clone().multiplyScalar(petals / tw));
          fc[j] = tmp.r;
          fc[j + 1] = tmp.g;
          fc[j + 2] = tmp.b;
        });
        this.flakePts.geometry.attributes.position.needsUpdate = true;
        this.flakePts.geometry.attributes.color.needsUpdate = true;
      }

      // kamera przesuwa się z porami roku, zimą podjeżdża bliżej (ciepłe wnętrze)
      const p = this.seasonP;
      this.viewT.az = lerp(-0.72, 0.62, p);
      this.viewT.dist = lerp(23, 20.5, p) - snow * 0.8;
      this.viewT.pol = 1.37 - snow * 0.03;
      this.viewT.ty = 2.1;
      this.viewT.tz = d.D * 0.5;
      return { w, rain, snow, leaves, petals };
    }

    dispose() {
      this.stop();
      this.renderer.dispose();
    }
  }

  LS.create = (canvas, opts) => new Garden(canvas, opts);
})();
