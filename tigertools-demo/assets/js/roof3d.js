/* ==========================================================================
   Tiger Tools — „Dach w 3D”: kup narzędzia prosto z dachu
   Dom z dachem z blachy na rąbek. Punkty na dachu (rąbek, okap, komin, łaty,
   kalenica, trasowanie) przenoszą kamerę w dane miejsce i pokazują narzędzia
   do tej roboty. Z wybranych narzędzi powstaje zestaw (−10% od 3 sztuk),
   który trafia do koszyka jednym kliknięciem.
   ========================================================================== */
(() => {
  const stage = document.getElementById('roof-stage');
  if (!stage) return;
  const canvas = stage.querySelector('canvas');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Dane: narzędzia ze sklepu ----------
  // Narzędzia Tiger Tools i TITAN z danych sklepu (assets/js/data.js)
  const DATA = window.TT_DATA || { products: [] };
  const P = {};
  DATA.products.forEach((p) => (P[p.id] = { brand: p.brand, name: p.name, img: p.imgs[0], price: p.price, tt: p.brand !== 'TITAN', id: p.id }));
  if (P.bdz) P.bdz = { ...P.bdz, name: 'Zaginadło do rąbka 46 cm BDZ 20/40/460', price: 220 };
  const ZONES = [
    { id: 'seam', title: 'Rąbek stojący', tip: 'Zaginanie i zamykanie rąbka na połaci.', items: ['bdz', 'cegi-podwojny-rabek', 'falzmaker', 'kleszcze-90-60'] },
    { id: 'eave', title: 'Okap', tip: 'Pas nadrynnowy, okap i haki rynnowe.', items: ['gietarka-gdp700', 'zaciskacz-rynnowy', 'kleszcze-45-60'] },
    { id: 'chimney', title: 'Komin', tip: 'Obróbka komina: wąskie szczypce i młotek, który nie niszczy powłoki.', items: ['piccolo-wygiete', 'piccolo-proste', 'mlotek-bezodrzutowy'] },
    { id: 'battens', title: 'Łaty', tip: 'Równy rozstaw łat i szybka rozbiórka starego deskowania.', items: ['przymiar-gb500tt', 'wd750', 'drabina-sznurowa'] },
    { id: 'ridge', title: 'Kalenica', tip: 'Doginanie i zamykanie przy kalenicy.', items: ['cegi-trojkatne-80', 'cegi-panienki', 'faldownik-bocian'] },
    { id: 'marking', title: 'Trasowanie', tip: 'Wymiar i linia gięcia na arkuszu, zanim wejdziesz na dach.', items: ['rysik-rabek', 'rysik-5-100', 'rysik-5-34', 'wycinak-reczny'] },
  ];
  // ścieżka zdjęcia (wersja jednoplikowa podstawia tu obrazy wbudowane w stronę)
  const imgSrc = (p) => (window.TT_IMG && window.TT_IMG[p]) || `assets/img/${p}`;
  const SET_MIN = 3;
  const SET_OFF = 0.1;

  // ---------- Panel i zestaw (działają też bez WebGL) ----------
  const panel = document.getElementById('roof-panel');
  const chips = [...document.querySelectorAll('.js-zone')];
  const hotspots = [...stage.querySelectorAll('.roof-hot')];
  const setBar = document.getElementById('roof-set');
  const setCount = document.getElementById('roof-set-count');
  const setSum = document.getElementById('roof-set-sum');
  const setOld = document.getElementById('roof-set-old');
  const setNote = document.getElementById('roof-set-note');
  const setAdd = document.getElementById('roof-set-add');
  const store = {
    get() {
      try {
        return JSON.parse(sessionStorage.getItem('tt-roof-set') || '[]');
      } catch {
        return [];
      }
    },
    set(v) {
      try {
        sessionStorage.setItem('tt-roof-set', JSON.stringify(v));
      } catch {}
    },
  };
  let picked = new Set(store.get().filter((k) => P[k]));
  let zone = -1;

  const TT = () => window.TT || { fmt: (n) => n.toFixed(2).replace('.', ',') + ' zł', isB2B: () => false, rate: 0.8, renderPrices() {}, toast() {} };
  const price = (base) => (TT().isB2B() ? base * TT().rate : base);

  const renderPanel = () => {
    if (!panel) return;
    const z = ZONES[zone];
    if (!z) {
      panel.innerHTML = `<p class="roof-panel__eyebrow">Jak to działa</p><h3 class="roof-panel__title">Kliknij miejsce na dachu.</h3><p class="roof-panel__tip">Pokażemy, czym zrobić tę robotę. Z wybranych narzędzi złożysz zestaw — od ${SET_MIN} sztuk taniej o 10%.</p><ol class="roof-panel__how"><li><b>1</b>Wybierz miejsce</li><li><b>2</b>Dodaj narzędzia do zestawu</li><li><b>3</b>Zestaw do koszyka</li></ol>`;
      return;
    }
    panel.innerHTML = `<p class="roof-panel__eyebrow">${String(zone + 1).padStart(2, '0')} · ${z.title}</p><h3 class="roof-panel__title">${z.tip}</h3><ul class="roof-items">${z.items
      .map((k) => {
        const it = P[k];
        const on = picked.has(k);
        return `<li class="roof-item${it.tt ? ' is-tt' : ''}"><img src="${imgSrc(it.img)}" alt="" width="72" height="72" loading="lazy"><div class="roof-item__body"><span class="roof-item__brand">${it.brand}</span><span class="roof-item__name">${it.name}</span><span class="roof-item__price js-price" data-price="${it.price}"></span></div><button type="button" class="roof-item__add" data-k="${k}" aria-pressed="${on}" aria-label="${on ? 'Usuń z zestawu' : 'Dodaj do zestawu'}: ${it.name}"><svg><use href="#${on ? 'i-check' : 'i-plus'}"/></svg></button></li>`;
      })
      .join('')}</ul>`;
    TT().renderPrices();
  };

  let lastCount = picked.size;
  const renderSet = () => {
    const items = [...picked].map((k) => P[k]);
    const sum = items.reduce((s, it) => s + price(it.price), 0);
    const off = items.length >= SET_MIN ? SET_OFF : 0;
    if (setCount) setCount.textContent = items.length ? `${items.length} ${items.length === 1 ? 'narzędzie' : items.length < 5 ? 'narzędzia' : 'narzędzi'}` : 'pusty';
    if (setSum) setSum.textContent = TT().fmt(sum * (1 - off));
    if (setOld) {
      setOld.hidden = !off;
      setOld.textContent = TT().fmt(sum);
    }
    if (setNote) setNote.textContent = items.length >= SET_MIN ? 'Rabat zestawu −10% naliczony' : `Jeszcze ${SET_MIN - items.length} do rabatu −10%`;
    if (setAdd) setAdd.disabled = !items.length;
    if (setBar) {
      setBar.classList.toggle('has-items', items.length > 0);
      setBar.classList.toggle('has-discount', off > 0);
      if (items.length !== lastCount && !reduceMotion) {
        setBar.classList.remove('is-bump');
        void setBar.offsetWidth;
        setBar.classList.add('is-bump');
      }
    }
    lastCount = items.length;
    store.set([...picked]);
  };

  const selectZone = (i, fromUser = true) => {
    zone = i;
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    hotspots.forEach((h, k) => h.classList.toggle('is-active', k === i));
    stage.classList.toggle('has-zone', i >= 0);
    renderPanel();
    if (fromUser) userTouched = true;
    if (camCtl) camCtl.go(i);
  };

  panel &&
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('.roof-item__add');
      if (!b) return;
      const k = b.dataset.k;
      if (picked.has(k)) picked.delete(k);
      else picked.add(k);
      const on = picked.has(k);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Usuń z zestawu' : 'Dodaj do zestawu'}: ${P[k].name}`);
      b.querySelector('use').setAttribute('href', on ? '#i-check' : '#i-plus');
      renderSet();
    });
  chips.forEach((c, i) => c.addEventListener('click', () => selectZone(zone === i ? -1 : i)));
  hotspots.forEach((h, i) => h.addEventListener('click', () => selectZone(zone === i ? -1 : i)));
  document.querySelectorAll('.js-zone-reset').forEach((b) => b.addEventListener('click', () => selectZone(-1)));
  setAdd &&
    setAdd.addEventListener('click', () => {
      const items = [...picked].map((k) => P[k]);
      if (!items.length) return;
      const off = items.length >= SET_MIN ? SET_OFF : 0;
      const total = items.reduce((s, it) => s + it.price, 0) * (1 - off); // cena bazowa; rabat firmowy liczy koszyk
      if (window.TT) window.TT.addToCart({ id: null, key: `roof-${[...picked].sort().join('-')}`, name: `Zestaw z dachu (${items.length} narz.)`, sym: items.map((it) => it.name.split(' ')[0]).join(', '), price: total, img: items[0].img, qty: 1, from: setAdd });
      picked = new Set();
      renderSet();
      renderPanel();
    });
  addEventListener('tt:b2b', () => {
    renderSet();
  });
  renderPanel();
  renderSet();

  // ---------- Scena 3D ----------
  let camCtl = null;
  let userTouched = false;
  let THREE;
  let RoomEnvironment;
  (async () => {
    try {
      THREE = await import('three');
      ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    } catch {
      stage.classList.add('no-webgl');
      return;
    }
    try {
      init();
    } catch {
      stage.classList.add('no-webgl');
    }
  })();

  function init() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    if (!renderer.getContext()) throw new Error('no webgl');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.3, 200);

    scene.add(new THREE.HemisphereLight('#ffffff', '#cfc8bd', 0.75));
    const sun = new THREE.DirectionalLight('#fff3e2', 2.4);
    sun.position.set(12, 20, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    const rand = (() => {
      let s = 3;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const makeTex = (w, h, draw, repeat) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const plasterTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f1ede6';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(0,0,0,${rand() * 0.035})`;
        g.fillRect(rand() * w, rand() * h, 2, 2);
      }
    }, true);
    const brickTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d8d0c6';
      g.fillRect(0, 0, w, h);
      for (let r = 0; r < h / 24; r++) {
        for (let c = -1; c < w / 64 + 1; c++) {
          const v = 130 + rand() * 30;
          g.fillStyle = `rgb(${v},${v * 0.55},${v * 0.42})`;
          g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 24 + 2, 60, 20);
        }
      }
    }, true);
    brickTex.repeat.set(1, 2.5);
    const woodTex = makeTex(128, 128, (g, w, h) => {
      g.fillStyle = '#d3a874';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 50; k++) {
        g.fillStyle = `rgba(110,70,30,${0.05 + rand() * 0.08})`;
        g.fillRect(0, rand() * h, w, 1 + rand() * 2);
      }
    }, true);
    const groundTex = makeTex(512, 512, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, w * 0.08, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(208,214,200,1)');
      gr.addColorStop(0.6, 'rgba(226,229,220,0.8)');
      gr.addColorStop(1, 'rgba(245,245,243,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });

    // ---------- Materiały ----------
    const ACC = new THREE.Color('#ff5a2c');
    const zoneMat = (base) => {
      const m = base.clone();
      m.emissive = ACC.clone();
      m.emissiveIntensity = 0;
      return m;
    };
    const metal = new THREE.MeshStandardMaterial({ color: '#3d434a', metalness: 0.6, roughness: 0.38, envMapIntensity: 1.1 });
    const seamMat = zoneMat(metal);
    const plaster = new THREE.MeshStandardMaterial({ color: '#ffffff', map: plasterTex, roughness: 0.95 });
    const wood = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTex, roughness: 0.85 });
    const membrane = new THREE.MeshStandardMaterial({ color: '#c8d3db', roughness: 0.8, side: THREE.DoubleSide });
    const brick = new THREE.MeshStandardMaterial({ color: '#ffffff', map: brickTex, roughness: 0.9 });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2e3338', roughness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: '#3a4c5c', roughness: 0.1, metalness: 0.6 });
    const toolRed = new THREE.MeshPhysicalMaterial({ color: '#cf2c0c', roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    const steel = new THREE.MeshStandardMaterial({ color: '#c3c9ce', metalness: 0.85, roughness: 0.3 });
    const Z = {
      seam: [seamMat, zoneMat(toolRed)],
      eave: [zoneMat(metal)],
      chimney: [zoneMat(brick), zoneMat(steel)],
      battens: [zoneMat(wood)],
      ridge: [zoneMat(metal)],
      marking: [zoneMat(steel), zoneMat(wood)],
    };

    const shadowed = (m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const box = (w, h, d, mat) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));

    // ---------- Dom ----------
    const LW = 10; // długość (x)
    const DW = 7; // szerokość (z)
    const WH = 3.2; // ściany
    const A = (35 * Math.PI) / 180;
    const OV = 0.55; // okap
    const OVX = 0.35; // szczyt
    const RIDGE = WH + (DW / 2) * Math.tan(A) + 0.12;
    const SL = (DW / 2 + OV) / Math.cos(A);
    const RX = LW + 2 * OVX;
    const house = new THREE.Group();
    scene.add(house);

    const walls = box(LW, WH, DW, plaster);
    walls.position.y = WH / 2;
    house.add(walls);
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-DW / 2, 0);
    gableShape.lineTo(DW / 2, 0);
    gableShape.lineTo(0, (DW / 2) * Math.tan(A));
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.2, bevelEnabled: false });
    gableGeo.rotateY(Math.PI / 2);
    for (const sx of [-1, 1]) {
      const gm = shadowed(new THREE.Mesh(gableGeo, plaster));
      gm.position.set(sx > 0 ? LW / 2 - 0.2 : -LW / 2, WH, 0);
      house.add(gm);
    }
    // okna i drzwi
    const win = (x, y, w = 1.3, h = 1.4) => {
      const f = box(w, h, 0.1, frameMat);
      f.position.set(x, y, DW / 2 + 0.03);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.14), glass);
      g.position.set(x, y, DW / 2 + 0.09);
      house.add(f, g);
    };
    win(-3, 1.7);
    win(0.4, 1.7);
    win(3.3, 1.7);
    const door = box(1.1, 2.2, 0.1, frameMat);
    door.position.set(-1.3, 1.1, DW / 2 + 0.03);
    house.add(door);

    // ---------- Dach: połacie z ramą (lokalnie: y = normalna, z = w dół od kalenicy) ----------
    const slopeFrame = (dir) => {
      const f = new THREE.Group();
      f.position.set(0, RIDGE, 0);
      f.rotation.x = dir * A;
      house.add(f);
      return f;
    };
    const front = slopeFrame(1);
    const back = slopeFrame(-1);
    // tył: jednolita połać z rąbkami
    const PW = 0.5; // szerokość arkusza
    const addSlope = (f, cut) => {
      // cut: wycięcie przy lewym okapie (odsłonięte łaty)
      const CUT = cut ? { x0: -RX / 2, x1: -RX / 2 + 2.2, s0: SL * 0.45 } : null;
      const sheetGeo = new THREE.BoxGeometry(1, 0.03, 1);
      const sheets = [];
      for (let x = -RX / 2; x < RX / 2 - 0.01; x += PW) {
        const x0 = x;
        const x1 = Math.min(x + PW, RX / 2);
        const inCut = CUT && x1 <= CUT.x1 + 0.01;
        sheets.push({ x0, x1, s0: 0, s1: inCut ? CUT.s0 : SL });
      }
      sheets.forEach((sh) => {
        const m = shadowed(new THREE.Mesh(sheetGeo, metal));
        m.scale.set(sh.x1 - sh.x0 - 0.01, 1, sh.s1 - sh.s0);
        m.position.set((sh.x0 + sh.x1) / 2, 0.015, (sh.s0 + sh.s1) / 2);
        f.add(m);
      });
      // rąbki
      const seamGeo = new THREE.BoxGeometry(0.035, 0.06, 1);
      for (let x = -RX / 2 + PW; x < RX / 2 - 0.05; x += PW) {
        const inCut = CUT && x <= CUT.x1 + 0.01;
        const len = inCut ? CUT.s0 : SL;
        const lastPanel = cut && x > RX / 2 - PW * 1.5;
        const m = shadowed(new THREE.Mesh(seamGeo, lastPanel ? seamMat : metal));
        m.scale.z = len;
        m.position.set(x, 0.06, len / 2);
        if (lastPanel) {
          // ostatni rąbek jeszcze otwarty: wyższy, niezamknięty
          m.scale.y = 1.8;
          m.position.y = 0.085;
        }
        f.add(m);
      }
      return CUT;
    };
    const CUT = addSlope(front, true);
    addSlope(back, false);

    // Odsłonięte łaty, kontrłaty i membrana w wycięciu
    const battens = new THREE.Group();
    const memb = new THREE.Mesh(new THREE.PlaneGeometry(CUT.x1 - CUT.x0, SL - CUT.s0), membrane);
    memb.rotation.x = -Math.PI / 2;
    memb.position.set((CUT.x0 + CUT.x1) / 2, -0.09, (CUT.s0 + SL) / 2);
    memb.receiveShadow = true;
    battens.add(memb);
    for (const x of [CUT.x0 + 0.3, CUT.x0 + 1.1, CUT.x0 + 1.9]) {
      const cb = box(0.06, 0.03, SL - CUT.s0, Z.battens[0]);
      cb.position.set(x, -0.065, (CUT.s0 + SL) / 2);
      battens.add(cb);
    }
    for (let s = CUT.s0 + 0.2; s < SL - 0.05; s += 0.33) {
      const b = box(CUT.x1 - CUT.x0, 0.035, 0.05, Z.battens[0]);
      b.position.set((CUT.x0 + CUT.x1) / 2, -0.03, s);
      battens.add(b);
    }
    front.add(battens);

    // Okap: pas nadrynnowy + rynna
    const eave = new THREE.Group();
    const drip = box(RX, 0.02, 0.2, Z.eave[0]);
    drip.position.set(0, -0.02, SL + 0.05);
    drip.rotation.x = 0.6;
    front.add(drip);
    const gutterGeo = new THREE.CylinderGeometry(0.12, 0.12, RX + 0.1, 16, 1, true, Math.PI, Math.PI);
    gutterGeo.rotateZ(Math.PI / 2);
    const gutter = shadowed(new THREE.Mesh(gutterGeo, Z.eave[0]));
    const eaveY = RIDGE - SL * Math.sin(A);
    const eaveZ = SL * Math.cos(A);
    gutter.position.set(0, eaveY - 0.12, eaveZ + 0.08);
    eave.add(gutter);
    const pipe = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, eaveY - 0.2, 10), Z.eave[0]));
    pipe.position.set(LW / 2 - 0.3, (eaveY - 0.2) / 2, DW / 2 + 0.15);
    eave.add(pipe);
    house.add(eave);

    // Kalenica
    const ridgeCap = box(RX + 0.05, 0.12, 0.42, Z.ridge[0]);
    ridgeCap.position.set(0, RIDGE + 0.06, 0);
    house.add(ridgeCap);

    // Komin z obróbką
    const CHX = 1.8;
    const CHS = 1.1; // odległość od kalenicy wzdłuż połaci
    const chZ = CHS * Math.cos(A);
    const chBaseY = RIDGE - CHS * Math.sin(A);
    const chimney = box(0.7, 1.9, 0.7, Z.chimney[0]);
    chimney.position.set(CHX, chBaseY + 0.55, chZ);
    const chCap = box(0.86, 0.1, 0.86, Z.chimney[1]);
    chCap.position.set(CHX, chBaseY + 1.55, chZ);
    const flashing = box(1.0, 0.04, 1.05, Z.chimney[1]);
    flashing.position.set(CHX, 0.04, CHS);
    front.add(flashing);
    house.add(chimney, chCap);

    // Zaginadło Tiger Tools leży przy otwartym rąbku
    const mini = new THREE.Group();
    const blade = box(0.46, 0.02, 0.07, Z.seam[1]);
    const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), Z.seam[1]));
    handle.rotation.x = Math.PI / 2 - 0.2;
    handle.position.set(0, 0.04, -0.17);
    mini.add(blade, handle);
    mini.position.set(RX / 2 - PW * 1.4, 0.12, SL * 0.55);
    mini.rotation.y = Math.PI / 2;
    mini.scale.setScalar(1.6);
    front.add(mini);

    // Stół do trasowania z arkuszem blachy
    const table = new THREE.Group();
    const top = box(2.4, 0.06, 1.1, Z.marking[1]);
    top.position.y = 0.85;
    table.add(top);
    for (const [x, z] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) {
      const leg = box(0.06, 0.85, 0.06, Z.marking[1]);
      leg.position.set(x, 0.425, z);
      table.add(leg);
    }
    const plate = box(2.1, 0.012, 0.9, Z.marking[0]);
    plate.position.y = 0.89;
    table.add(plate);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.012), new THREE.MeshBasicMaterial({ color: '#ff5a2c' }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.9, 0.18);
    table.add(line);
    const square = box(0.5, 0.01, 0.06, steel);
    square.position.set(0.5, 0.905, 0.1);
    table.add(square);
    table.position.set(6.6, 0, 3.4);
    table.rotation.y = -0.5;
    scene.add(table);

    // Podłoże
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.002;
    scene.add(lawn);

    // ---------- Punkty i kamera ----------
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const onFront = (x, s, h = 0.15) => {
      const p = v(x, h, s);
      front.localToWorld(p);
      return p;
    };
    house.updateMatrixWorld(true);
    const ANCH = {
      seam: onFront(RX / 2 - PW, SL * 0.4, 0.2),
      eave: v(-1.5, eaveY - 0.1, eaveZ + 0.2),
      chimney: v(CHX, chBaseY + 1.7, chZ),
      battens: onFront(CUT.x0 + 1.1, (CUT.s0 + SL) / 2, 0),
      ridge: v(-2.6, RIDGE + 0.2, 0),
      marking: v(6.6, 1.0, 3.4),
    };
    // ujęcia: [cel, theta, phi, odległość]
    const VIEWS = {
      all: [v(1, 2.9, 0.8), 0.55, 0.4, 26],
      seam: [ANCH.seam, 0.95, 0.42, 9],
      eave: [ANCH.eave, 0.2, 0.18, 9],
      chimney: [ANCH.chimney.clone().add(v(0, -0.6, 0)), 0.55, 0.45, 8.5],
      battens: [ANCH.battens, -0.35, 0.5, 8],
      ridge: [ANCH.ridge, 0.3, 0.75, 10],
      marking: [ANCH.marking, 0.9, 0.6, 7],
    };
    const cam = { t: VIEWS.all[0].clone(), th: 0.9, ph: 0.3, r: 34, user: 0, userVel: 0, auto: 0 };
    let goal = VIEWS.all;
    camCtl = {
      go(i) {
        goal = i >= 0 ? VIEWS[ZONES[i].id] : VIEWS.all;
        cam.user *= 0.3;
      },
    };
    if (zone >= 0) camCtl.go(zone);

    // przeciąganie: obrót wokół celu
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      userTouched = true;
      lastX = e.clientX;
      lastT = performance.now();
      cam.userVel = 0;
      canvas.setPointerCapture(e.pointerId);
      stage.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      cam.user -= dx * 0.006;
      cam.userVel = ((-dx * 0.006) / Math.max(now - lastT, 1)) * 1000;
      lastX = e.clientX;
      lastT = now;
    });
    const endDrag = () => {
      dragging = false;
      stage.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    let W = 1;
    let H = 1;
    const resize = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    const _p = new THREE.Vector3();
    let visible = false;
    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;

      // kamera: płynny przejazd do ujęcia (krytycznie tłumione podążanie)
      const k = 1 - Math.exp(-3.2 * dt);
      const [gt, gth, gph, gr] = goal;
      cam.t.lerp(gt, k);
      cam.th = lerp(cam.th, gth, k);
      cam.ph = lerp(cam.ph, gph, k);
      const narrow = W < 640 ? 1.05 : 1;
      cam.r = lerp(cam.r, gr * narrow * Math.max(1, 1.1 / camera.aspect), k);
      if (!dragging) {
        cam.user += cam.userVel * dt;
        cam.userVel *= Math.exp(-3 * dt);
      }
      // bez wybranego miejsca kamera powoli krąży, dopóki ktoś nie dotknie sceny
      if (zone < 0 && !userTouched && !reduceMotion) cam.auto += dt * 0.08;
      const th = cam.th + cam.user + Math.sin(cam.auto) * 0.35;
      camera.position.set(cam.t.x + Math.sin(th) * Math.cos(cam.ph) * cam.r, cam.t.y + Math.sin(cam.ph) * cam.r, cam.t.z + Math.cos(th) * Math.cos(cam.ph) * cam.r);
      camera.lookAt(cam.t);
      camera.updateMatrixWorld();

      // podświetlenie wybranego miejsca
      Object.entries(Z).forEach(([id, mats]) => {
        const on = zone >= 0 && ZONES[zone].id === id;
        const goalI = on ? 0.35 + (reduceMotion ? 0 : Math.sin(t * 4) * 0.18) : 0;
        mats.forEach((m) => (m.emissiveIntensity = lerp(m.emissiveIntensity, goalI, k)));
      });

      // punkty na dachu
      hotspots.forEach((h, i) => {
        _p.copy(ANCH[ZONES[i].id]).project(camera);
        const behind = _p.z > 1;
        const x = (_p.x * 0.5 + 0.5) * W;
        const y = (-_p.y * 0.5 + 0.5) * H;
        h.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        h.style.visibility = behind || x < -20 || x > W + 20 || y < -20 || y > H + 20 ? 'hidden' : 'visible';
      });

      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }, { rootMargin: '100px' }).observe(stage);
    stage.classList.add('is-ready');
  }
})();
