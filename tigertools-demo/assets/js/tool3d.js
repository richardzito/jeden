/* ==========================================================================
   Tiger Tools — zaginadło w 3D (hero i karta produktu)
   Model wg zdjęcia produktu: dwie płyty ze szczeliną na blachę, zagięte
   na tylnej krawędzi, i rura-rączka z napisem TIGER TOOLS. Długość ostrza
   zmienia się płynnie (31 / 46 / 61 cm). „Zobacz w akcji” pokazuje
   zaginanie rąbka: krawędź blachy wchodzi w szczelinę i wstaje do 90°.
   Zwykły skrypt + dynamiczny import (import map w <head>) — działa też
   otwarte prosto z dysku.
   ========================================================================== */
(() => {
  const roots = [...document.querySelectorAll('[data-tool3d]')];
  if (!roots.length) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  // Dane wariantów (te same co na karcie produktu)
  const VARIANTS = {
    31: { len: 3.1, label: '31 cm', price: 189, id: 'z31', name: 'Zaginadło do rąbka 31 cm BDZ 20/40/310' },
    46: { len: 4.6, label: '46 cm', price: 220, id: 'z46', name: 'Zaginadło do rąbka 46 cm BDZ 20/40/460' },
    61: { len: 6.1, label: '61 cm', price: 259, old: 285, id: 'z61', name: 'Zaginadło do rąbka 61 cm BDZ 20/40/610' },
  };

  // ---------- Kontrolki (działają też bez WebGL) ----------
  const controllers = new Map();
  const setVariantUI = (v) => {
    const d = VARIANTS[v];
    if (!d) return;
    document.querySelectorAll('.js-v3d').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    document.querySelectorAll('.js-h-price').forEach((el) => (el.dataset.price = d.price));
    document.querySelectorAll('.js-h-old').forEach((el) => {
      el.hidden = !d.old;
      if (d.old) el.dataset.price = d.old;
    });
    document.querySelectorAll('.js-h-add').forEach((b) => {
      b.dataset.price = d.price;
      b.dataset.id = d.id;
      b.setAttribute('aria-label', `Dodaj do koszyka: ${d.name}`);
    });
    document.querySelectorAll('.js-dim').forEach((el) => (el.textContent = d.label));
    document.querySelectorAll('.js-h-link').forEach((a) => (a.href = `produkt.html?v=${v}`));
    window.TT && window.TT.renderPrices();
    controllers.forEach((c) => c.setVariant(v));
  };
  document.querySelectorAll('.js-v3d').forEach((b) => b.addEventListener('click', () => setVariantUI(b.dataset.v)));
  // Galeria karty produktu: zdjęcie ↔ model 3D
  const setGalleryMode = (main, mode) => {
    main.classList.toggle('is-3d', mode === '3d');
    main.querySelectorAll('.js-gmode').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.m === mode)));
  };
  document.querySelectorAll('.js-gmode').forEach((b) => b.addEventListener('click', () => setGalleryMode(b.closest('.gallery__main'), b.dataset.m)));
  document.querySelectorAll('.js-play').forEach((b) =>
    b.addEventListener('click', () => {
      const root = b.dataset.target ? document.getElementById(b.dataset.target) : roots[0];
      const main = root && root.closest('.gallery__main');
      const wasHidden = main && !main.classList.contains('is-3d');
      if (wasHidden) setGalleryMode(main, '3d');
      const go = () => {
        const c = controllers.get(root);
        if (c) c.play();
      };
      // po przełączeniu na 3D płótno potrzebuje chwili na rozmiar
      if (wasHidden) setTimeout(go, 400);
      else go();
    })
  );
  window.TigerTool3D = { setVariant: setVariantUI, get: (el) => controllers.get(el) };

  let THREE;
  let RoomEnvironment;
  (async () => {
    try {
      THREE = await import('three');
      ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    } catch {
      roots.forEach((r) => r.classList.add('no-webgl'));
      return;
    }
    roots.forEach((r) => {
      try {
        controllers.set(r, mount(r));
      } catch {
        r.classList.add('no-webgl');
      }
    });
    roots.forEach((r) => r.dataset.variant && controllers.get(r)?.setVariant(r.dataset.variant, true));
  })();

  function mount(root) {
    const canvas = root.querySelector('canvas');
    const studio = root.hasAttribute('data-studio');
    const tags = [...root.querySelectorAll('.tool-tag')];
    const stepTag = root.querySelector('.js-step');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: studio });
    if (!renderer.getContext()) throw new Error('no webgl');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = studio ? 1.05 : 1.15;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight('#ffffff', '#2a2a2a', studio ? 0.9 : 0.5));
    const key = new THREE.DirectionalLight('#fff1e0', 2.6);
    key.position.set(4, 7, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(studio ? '#ffffff' : '#ffd2b8', studio ? 0.8 : 3.2);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    // ---------- Tekstury ----------
    const makeTex = (w, h, draw) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    const RED = '#cf2c0c';
    // Napis TIGER TOOLS na rurze: u = obwód, v = długość
    const handleTex = makeTex(512, 1024, (g, w, h) => {
      g.fillStyle = RED;
      g.fillRect(0, 0, w, h);
      let s = 5;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      // napis po obu stronach rury, żeby był widoczny przy obrocie
      for (const u of [0.25, 0.75]) {
        g.save();
        g.translate(w * u, h * 0.42);
        g.rotate(-Math.PI / 2);
        g.fillStyle = '#121212';
        g.font = '900 104px Impact, "Arial Black", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('TIGER TOOLS', 0, 0);
        // „szablonowe” przerwy w literach
        g.fillStyle = RED;
        for (let i = 0; i < 70; i++) g.fillRect(-360 + rnd() * 720, -44 + rnd() * 88, 2 + rnd() * 7, 2 + rnd() * 3);
        g.restore();
      }
    });
    const shadowTex = makeTex(256, 256, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, studio ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.7)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });

    // ---------- Materiały ----------
    const paint = new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.1 });
    const paintHandle = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: handleTex, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2a0d06', roughness: 0.8 });
    const sheetMat = new THREE.MeshStandardMaterial({ color: '#59626b', metalness: 0.5, roughness: 0.48, envMapIntensity: 0.6, transparent: true, side: THREE.DoubleSide });
    const dimMat = new THREE.LineBasicMaterial({ color: studio ? '#9a9a9a' : '#ffffff', transparent: true, opacity: 0.55 });

    // ---------- Model zaginadła (1 j. = 10 cm) ----------
    // Środek szczeliny w y = 0; szczelina otwiera się w stronę +z, zagięcie przy z = 0.
    const T = 0.022; // grubość blachy narzędzia
    const GAP = 0.03; // szczelina
    const DT = 0.55; // głębokość górnej płyty
    const DB = 0.72; // głębokość dolnej płyty (podpiera blachę)
    const tool = new THREE.Group();
    const blade = new THREE.Group(); // skalowany wzdłuż x przy zmianie długości
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(1, T, DB + 0.04), paint);
    bottom.position.set(0, -GAP / 2 - T / 2, DB / 2 - 0.02);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, T, DT), paint);
    top.position.set(0, GAP / 2 + T / 2, DT / 2);
    const foldR = GAP / 2 + T;
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(foldR, foldR, 1, 20, 1, true, Math.PI / 2, Math.PI), paint);
    fold.rotation.z = Math.PI / 2;
    fold.position.set(0, 0, 0);
    paint.side = THREE.DoubleSide;
    blade.add(bottom, top, fold);
    tool.add(blade);

    const HR = 0.15;
    const HL = 2.7;
    const tilt = (12 * Math.PI) / 180;
    const handle = new THREE.Group();
    handle.position.set(0, GAP / 2 + T + HR * 0.92, 0.16);
    handle.rotation.x = -Math.PI / 2 + tilt; // oś rury: w stronę −z i lekko w górę
    const tubeGeo = new THREE.CylinderGeometry(HR, HR, HL, 40, 1, true);
    tubeGeo.translate(0, HL / 2, 0);
    const tube = new THREE.Mesh(tubeGeo, paintHandle);
    tube.rotation.y = Math.PI * 0.75; // napis od strony patrzącego
    const capFar = new THREE.Mesh(new THREE.CircleGeometry(HR, 40), paint);
    capFar.position.y = HL;
    capFar.rotation.x = -Math.PI / 2;
    const capNear = new THREE.Mesh(new THREE.RingGeometry(HR * 0.72, HR, 40), paint);
    capNear.rotation.x = Math.PI / 2;
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(HR * 0.72, 32), darkMat);
    hollow.position.y = 0.02;
    hollow.rotation.x = Math.PI / 2;
    const weld = new THREE.Mesh(new THREE.TorusGeometry(HR * 1.02, 0.025, 8, 40), paint);
    weld.rotation.x = Math.PI / 2;
    weld.position.y = 0.06;
    handle.add(tube, capFar, capNear, hollow, weld);
    tool.add(handle);

    // Wymiar długości pod ostrzem
    const dim = new THREE.Group();
    const dimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0)]);
    const dimLine = new THREE.Line(dimGeo, dimMat);
    const tickGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, 0.08, 0)]);
    const tickL = new THREE.Line(tickGeo, dimMat);
    const tickR = new THREE.Line(tickGeo, dimMat);
    dim.add(dimLine, tickL, tickR);
    dim.position.set(0, -0.35, DB + 0.35);
    dim.visible = !studio;
    tool.add(dim);

    const pivot = new THREE.Group(); // pozycja i obrót całego narzędzia
    pivot.add(tool);
    scene.add(pivot);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.15;
    scene.add(shadow);

    // ---------- Blacha do pokazu ----------
    // Blacha leży przed narzędziem; zaginana jest jej tylna krawędź (z = ZK − FL … ZK),
    // więc rączka podnosi się jak dźwignia, a nie celuje w kamerę.
    const SY = -0.62; // wysokość blachy
    const ZK = -0.35; // linia gięcia
    const FL = 0.2; // zaginana krawędź (20 mm)
    const SW = 6.8;
    const SD = 1.7;
    const sheet = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.012, SD), sheetMat);
    base.position.set(0, SY, ZK + SD / 2);
    const flangePivot = new THREE.Group();
    flangePivot.position.set(0, SY, ZK);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.012, FL), sheetMat);
    flange.position.z = -FL / 2;
    flangePivot.add(flange);
    const bendGeo = new THREE.CylinderGeometry(0.012, 0.012, SW, 8);
    bendGeo.rotateZ(Math.PI / 2);
    const bend = new THREE.Mesh(bendGeo, sheetMat);
    bend.position.set(0, SY, ZK);
    sheet.add(base, flangePivot, bend);
    sheet.visible = false;
    scene.add(sheet);

    let tagsDirty = true;

    // ---------- Stan ----------
    const state = {
      len: 4.6,
      lenGoal: 4.6,
      lenVel: 0,
      yaw: -0.5,
      pitch: 0.18,
      userYaw: 0,
      userPitch: 0,
      yawVel: 0,
      playing: false,
      t0: 0,
      sheetHold: 0,
      hover: { x: 0, y: 0 },
      visible: true,
      intro: reduceMotion || studio ? 1 : 0,
      introT0: 0,
    };

    const setVariant = (v, instant) => {
      const d = VARIANTS[v];
      if (!d) return;
      state.lenGoal = d.len;
      if (instant || reduceMotion) state.len = d.len;
      tagsDirty = true;
    };

    // Pokaz zaginania: oś czasu 0…1 (ok. 4 s)
    const DUR = 4200;
    const play = () => {
      if (state.playing) return;
      if (reduceMotion) {
        // bez animacji ruchu: od razu stan „po”
        state.playing = false;
        sheet.visible = true;
        flangePivot.rotation.x = Math.PI / 2;
        sheetMat.opacity = 1;
        state.sheetHold = performance.now() + 4000;
        showStep('Rąbek 20 mm zagięty do 90°');
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

    // ---------- Sterowanie: przeciąganie z bezwładnością, lekki ruch za kursorem ----------
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    if (!studio) {
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
        state.userPitch = Math.max(-0.5, Math.min(0.7, state.userPitch + dy * 0.006));
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
    }

    // ---------- Rozmiar ----------
    let W = 1;
    let H = 1;
    const resize = () => {
      W = root.clientWidth;
      H = root.clientHeight;
      if (!W || !H) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      tagsDirty = true;
    };
    new ResizeObserver(resize).observe(root);
    resize();

    // ---------- Etykiety (rzut 3D → 2D) ----------
    const tagW = new Map();
    const _v = new THREE.Vector3();
    const anchors = {
      slot: () => _v.set(state.len * 0.3, 0, DT * 0.9),
      handle: () => _v.set(0, GAP / 2 + T + HR, 0.16).add(new THREE.Vector3(0, Math.sin(tilt), -Math.cos(tilt)).multiplyScalar(HL * 0.78)),
      dim: () => _v.set(0, -0.35, DB + 0.35),
    };
    const placeTags = (alpha) => {
      tags.forEach((el) => {
        const key = el.dataset.tag;
        if (!anchors[key]) return;
        anchors[key]();
        tool.localToWorld(_v);
        _v.project(camera);
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (!tagW.has(el)) tagW.set(el, el.offsetWidth);
        const left = key === 'dim' ? x - tagW.get(el) / 2 : Math.min(x + 10, W - tagW.get(el) - 8);
        el.style.transform = `translate(${left.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
        el.style.opacity = alpha.toFixed(3);
      });
    };

    // ---------- Pętla ----------
    const qTmp = new THREE.Quaternion();
    const qBase = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const axisX = new THREE.Vector3(1, 0, 0);
    const pivotPt = new THREE.Vector3(0, SY, ZK);
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

      // Długość ostrza: sprężyna krytycznie tłumiona
      const k = 120;
      const c = 2 * Math.sqrt(k);
      state.lenVel += (-(state.len - state.lenGoal) * k - state.lenVel * c) * dt;
      state.len += state.lenVel * dt;
      blade.scale.x = state.len;
      dim.scale.x = state.len;
      tickL.position.x = -0.5;
      tickR.position.x = 0.5;
      tickL.scale.x = tickR.scale.x = 1 / Math.max(state.len, 0.01);

      // Kadr: zmieści 61 cm
      // w czasie pokazu kamera odjeżdża w bok, żeby było widać profil gięcia
      const actGoal = state.playing || sheet.visible ? 1 : 0;
      state.act = actGoal + ((state.act || 0) - actGoal) * Math.exp(-3.2 * dt);
      const fit = (studio ? 9.4 : 8.3) + (state.len - 4.6) * 0.9;
      const aspectFix = Math.max(1, 1.3 / camera.aspect);
      const act = reduceMotion ? actGoal : state.act;
      camera.position.set(lerp(1.3, 6.4, act) * aspectFix, lerp(2.3, 2.7, act), lerp(fit, 6.2 + (state.len - 4.6) * 0.6, act) * aspectFix);
      camera.lookAt(lerp(0, -0.2, act), lerp(-0.05, -0.1, act), lerp(-0.4, -0.8, act));

      // Poza spoczynkowa (obrót użytkownika + delikatne „pływanie”)
      if (!dragging) {
        state.userYaw += state.yawVel * dt;
        state.yawVel *= Math.exp(-3 * dt);
        if (!state.playing && Math.abs(state.yawVel) < 0.05) state.userYaw *= Math.exp(-0.25 * dt);
      }
      const idleSwing = reduceMotion || studio ? 0 : Math.sin(t * 0.45) * 0.28;
      const idleBob = reduceMotion || studio ? 0 : Math.sin(t * 1.1) * 0.06;
      eul.set(state.pitch + state.userPitch + state.hover.y * 0.06, state.yaw + idleSwing + state.userYaw + state.hover.x * 0.12, 0, 'YXZ');
      qBase.setFromEuler(eul);
      const idlePos = new THREE.Vector3(0, idleBob + (1 - intro) * -0.6, 0);

      // Pokaz zaginania
      let p = -1;
      if (state.playing) {
        p = clamp01((now - state.t0) / DUR);
        // pozy: start → przed krawędzią → nasunięte → zagięte → zdjęte → start
        const qEngage = new THREE.Quaternion();
        const posPre = new THREE.Vector3(0, SY, ZK - DT - 0.9);
        const posIn = new THREE.Vector3(0, SY, ZK - DT);
        const a = smooth(0, 0.2, p); // dojazd
        const b = smooth(0.2, 0.32, p); // nasunięcie
        const bendK = smooth(0.36, 0.62, p); // zginanie
        const off = smooth(0.74, 0.86, p); // zdjęcie
        const back = smooth(0.86, 1, p); // powrót
        sheetMat.opacity = smooth(0.02, 0.16, p);
        const theta = (Math.PI / 2) * bendK;
        flangePivot.rotation.x = theta;
        // pozycja przed zgięciem
        const pos = new THREE.Vector3().lerpVectors(idlePos, posPre, a).lerp(posIn, b);
        const q = new THREE.Quaternion().slerpQuaternions(qBase, qEngage, a);
        // obrót wokół linii gięcia
        qTmp.setFromAxisAngle(axisX, theta);
        pos.sub(pivotPt).applyQuaternion(qTmp).add(pivotPt);
        q.premultiply(qTmp);
        // zdjęcie z krawędzi (w górę wzdłuż zagiętej krawędzi) i powrót
        pos.y += off * 1.0;
        pos.lerp(idlePos, back);
        q.slerp(qBase, back);
        pivot.position.copy(pos);
        pivot.quaternion.copy(q);
        if (p < 0.2) showStep('1. Ustaw zaginadło przy krawędzi');
        else if (p < 0.36) showStep('2. Wsuń blachę w szczelinę');
        else if (p < 0.7) showStep('3. Zegnij do 90°');
        else showStep('Rąbek 20 mm gotowy');
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

      // Cień pod narzędziem
      const sh = studio ? state.len * 0.8 + 1 : state.len + 1.6;
      shadow.scale.set(sh, sh * 0.42, 1);
      shadow.position.x = pivot.position.x;
      shadow.material.opacity = (sheet.visible ? 0.5 : 1) * intro * (1 - Math.max(0, pivot.position.y - idleBob) * 0.25);

      camera.updateMatrixWorld();
      pivot.updateMatrixWorld();
      const tagA = state.playing || sheet.visible ? 0 : smooth(0.6, 1, intro);
      placeTags(tagA);

      renderer.render(scene, camera);
      if (state.visible && !studio) raf = requestAnimationFrame(frame);
    };

    if (studio) {
      // jedna klatka do zdjęcia produktu
      root._renderStudio = (v, yaw = -0.62, pitch = 0.32) => {
        setVariant(v, true);
        state.yaw = yaw;
        state.pitch = pitch;
        frame(performance.now());
        return canvas.toDataURL('image/png');
      };
    } else {
      new IntersectionObserver(([e]) => {
        state.visible = e.isIntersecting;
        if (state.visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      }).observe(root);
    }
    root.classList.add('is-ready');
    // do zrzutów ekranu: ustawia pokaz na danym momencie (0…1) i rysuje klatkę
    root._seek = (p) => {
      if (!state.playing) play();
      state.t0 = performance.now() - p * DUR;
      state.act = 1;
      frame(performance.now());
    };
    return { setVariant, play };
  }
})();
