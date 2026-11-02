/* ==========================================================================
   AQUATIC — Konfigurator basenu (bez wyceny)
   Interfejs działa zawsze; wizualizacja 3D (three.js z CDN) ładuje się
   dynamicznie. Stan projektu trafia do adresu (#projekt=…), więc link
   można wysłać dalej, a gotowy projekt — do biura jednym kliknięciem.
   ========================================================================== */

(() => {
const root = document.getElementById('aqk');
if (root) main();

function main() {
  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: d });
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PHONE = '+48505988656';
  const MAIL = 'biuro@aquatic.pl';

  /* ======================================================================
     KATALOG OPCJI
     ====================================================================== */
  const BUILDS = {
    capena: { t: 'Żelbet CAPENA', d: 'Dowolny kształt i wykończenie' },
    steel: { t: 'Stal BERNDORF', d: 'Niecka w całości ze stali' },
    poly: { t: 'Poliester', d: 'Gotowa niecka, szybki montaż' },
  };
  const SHAPES = {
    rect: { t: 'Prostokątny', svg: '<rect x="4" y="5" width="36" height="16" rx="0.5"/>' },
    round: { t: 'Zaokrąglony', svg: '<rect x="4" y="5" width="36" height="16" rx="5"/>' },
    oval: { t: 'Owalny', svg: '<rect x="4" y="5" width="36" height="16" rx="8"/>' },
    lshape: { t: 'L', svg: '<path d="M4 4h36v11H17v8H4z"/>' },
    kidney: { t: 'Nieregularny', svg: '<path d="M6 13c0-6 5-9 11-8 4 1 6 4 10 2 5-2 12 0 12 6s-6 9-12 8c-4-1-6-3-9-1-6 3-12 0-12-7z"/>' },
  };
  const FINISH = {
    mosaic: { t: 'Mozaika szklana', d: 'Najbardziej luksusowa', tile: 0.25 },
    tiles: { t: 'Płytki ceramiczne', d: 'Klasyka, łatwe w czyszczeniu', tile: 0.5 },
    liner: { t: 'Folia basenowa', d: 'Wzmacniana, wiele kolorów', tile: 1.6 },
    steel: { t: 'Stal szlachetna', d: 'Bez fug, na dziesięciolecia', tile: 1 },
    gelcoat: { t: 'Żelkot', d: 'Gładka powłoka niecki', tile: 1 },
  };
  const COLORS = {
    mosaic: [['lazur', 'Lazur', '#2f86c9'], ['turkus', 'Turkus', '#21aebf'], ['biel', 'Biel', '#eef2f3'], ['grafit', 'Grafit', '#39424b'], ['piasek', 'Piasek', '#d9c7a4'], ['szmaragd', 'Szmaragd', '#2d8b7a']],
    tiles: [['biel', 'Biel', '#eef1f2'], ['blekit', 'Błękit', '#9ccbe4'], ['antracyt', 'Antracyt', '#3a3f45'], ['bez', 'Beż', '#d8ccb6']],
    liner: [['biala', 'Biała', '#f1f4f5'], ['blekitna', 'Błękitna', '#7cc2e6'], ['piaskowa', 'Piaskowa', '#d5c29b'], ['szara', 'Szara', '#a8b1b7'], ['antracyt', 'Antracyt', '#3b4148']],
    steel: [['stal', 'Szczotkowana', '#cfd7dc']],
    gelcoat: [['bialy', 'Biały', '#f3f5f6'], ['blekitny', 'Błękitny', '#8bcbe7'], ['szary', 'Szary', '#9aa6ae'], ['granit', 'Granit', '#6e767c']],
  };
  const EDGES = {
    skimmer: { t: 'Skimmerowy', d: 'Woda 10–15 cm pod obrzeżem' },
    overflow: { t: 'Przelewowy', d: 'Lustro wody równo z kratką' },
    infinity: { t: 'Infinity', d: 'Woda przelewa się przez krawędź' },
  };
  const COPING = [['granit', 'Granit jasny', '#d8d7d2'], ['trawertyn', 'Trawertyn', '#e2d3b9'], ['beton', 'Beton arch.', '#b9b6b0'], ['drewno', 'Drewno', '#8f6040'], ['kompozyt', 'Kompozyt grafit', '#4a4e52']];
  const DECKS = [['deska', 'Deska egzotyczna', '#9b6743'], ['kompozyt', 'Kompozyt grafit', '#55595c'], ['trawertyn', 'Trawertyn', '#e1d2b8'], ['beton', 'Płyty betonowe', '#c3c0ba']];
  const HALL_FLOORS = [['kamien', 'Kamień jasny', '#e3dfd8'], ['gres', 'Gres grafit', '#585c60'], ['drewno', 'Drewno', '#a9784f']];
  const HALL_WALLS = [['drewno', 'Drewno', '#b98a5f'], ['kamien', 'Kamień', '#cbc4b8'], ['beton', 'Beton', '#bcb9b3']];
  const STEPS = {
    roman: { t: 'Schody rzymskie', d: 'Półokrągłe, na krótszym boku' },
    corner: { t: 'Schody narożne', d: 'Oszczędzają miejsce' },
    full: { t: 'Na całą szerokość', d: 'Wygodne, jak na plaży' },
    ladder: { t: 'Drabinka', d: 'Cała niecka do pływania' },
  };
  const LIGHTS = { white: { t: 'Białe', c: '#eaf3ff' }, blue: { t: 'Błękitne', c: '#2aa9ff' }, rgb: { t: 'RGB', c: '#b45cff' } };
  const COVERS = { none: { t: 'Brak' }, roller: { t: 'Roleta automatyczna', d: 'Żaluzja z lamel, chowana w ławce' }, thermal: { t: 'Pokrywa termiczna', d: 'Solarna, na zwijaczu' } };
  const ENCLOSURES = { none: { t: 'Brak' }, low: { t: 'Niskie', d: 'Teleskopowe, ok. 90 cm' }, high: { t: 'Wysokie', d: 'Można pod nim chodzić' } };
  const FILTERS = { sand: { t: 'Piasek kwarcowy', d: 'Sprawdzona klasyka' }, glass: { t: 'Złoże szklane', d: 'Dokładniejsza filtracja, rzadsze płukanie' }, cartridge: { t: 'Wkłady filtracyjne', d: 'Kompaktowe, do mniejszych basenów' } };
  const PUMPS = { vs: { t: 'Zmiennoobrotowa', d: 'Cicha, oszczędna (np. Speck)' }, fixed: { t: 'Stałoobrotowa', d: 'Prosta i niezawodna' } };
  const DISINF = {
    membrane: { t: 'Elektroliza membranowa', d: 'Słodka woda bez zapachu chloru. Nasz system premium.' },
    salt: { t: 'Elektroliza soli', d: 'Chlor z soli kuchennej, lekko słona woda' },
    chlorine: { t: 'Chlor dozowany automatycznie', d: 'Pompy dozujące (np. ProMinent)' },
    oxygen: { t: 'Aktywny tlen', d: 'Bez chloru, dla wrażliwej skóry' },
  };
  const HEATING = { hp: { t: 'Pompa ciepła', d: 'Najtańsza w eksploatacji' }, exchanger: { t: 'Wymiennik ciepła', d: 'Z kotłem domowym' }, solar: { t: 'Kolektory solarne', d: 'Darmowe ciepło latem' }, none: { t: 'Bez podgrzewania', d: '' } };
  const VENT = { recovery: { t: 'Centrala z odzyskiem ciepła', d: 'Osusza i ogrzewa halę' }, hp: { t: 'Centrala z pompą ciepła', d: 'Także chłodzenie latem' } };
  const USAGE = { family: { t: 'Rodzinne', d: 'Wymiana wody co 6 h', T: 6 }, intensive: { t: 'Intensywne', d: 'Goście, dzieci: co 4 h', T: 4 } };

  const DEFAULT = {
    loc: 'out', build: 'capena', shape: 'round', L: 9, W: 4, D: 1.4, slope: false, D2: 1.9,
    finish: 'mosaic', color: 'lazur', edge: 'overflow', coping: 'granit',
    steps: 'roman', bench: true, beach: false,
    counter: true, cascade: false, laminar: false, jets: false, geyser: false,
    light: 'white', lamps: 4,
    cover: 'none', coverAmt: 0, enclosure: 'none', encOpen: 0,
    deck: 'deska', deckW: 2.5, hedge: true, trees: 2, grasses: true, loungers: 4, umbrella: true, pergola: false, spa: false, sauna: false, shower: false, firepit: false, fence: false, gardenLights: true,
    hallGlass: 'panorama', hallFloor: 'kamien', hallWall: 'drewno', inSauna: true, inSteam: false, inSpa: false, plants: true,
    usage: 'family', filter: 'glass', pump: 'vs', disinf: 'membrane', uv: true, ozone: false, ph: true, redox: true, app: true, heat: 'hp', temp: 28, vent: 'recovery',
    raw: false,
  };

  const PRESETS = [
    { id: 'ogrod', t: 'Ogród rodzinny', d: 'Owal, schody rzymskie, przeciwprąd', g: 'linear-gradient(135deg,#2fa9c9,#9bd5a1)', s: { loc: 'out', build: 'capena', shape: 'oval', L: 9, W: 4, D: 1.4, finish: 'mosaic', color: 'turkus', edge: 'skimmer', coping: 'trawertyn', steps: 'roman', bench: true, counter: true, cascade: false, laminar: false, light: 'white', deck: 'deska', deckW: 2.5, hedge: true, trees: 3, loungers: 4, umbrella: true, pergola: false, spa: false, disinf: 'salt', heat: 'hp' } },
    { id: 'infinity', t: 'Nowoczesny infinity', d: 'Grafit, łuki wodne, pergola', g: 'linear-gradient(135deg,#283a4a,#e3a36c)', s: { loc: 'out', build: 'capena', shape: 'rect', L: 12, W: 4, D: 1.5, finish: 'mosaic', color: 'grafit', edge: 'infinity', coping: 'beton', steps: 'full', bench: false, counter: false, cascade: false, laminar: true, light: 'blue', deck: 'beton', deckW: 3, hedge: true, trees: 2, loungers: 4, umbrella: false, pergola: true, firepit: true, fence: false, disinf: 'membrane', uv: true, heat: 'hp' }, time: 'sunset' },
    { id: 'kryty', t: 'Kryty z sauną', d: 'Stal, hala z przeszkleniem, SPA', g: 'linear-gradient(135deg,#9aa9b4,#d8c4a5)', s: { loc: 'in', build: 'steel', shape: 'rect', L: 10, W: 4, D: 1.4, finish: 'steel', color: 'stal', edge: 'overflow', coping: 'granit', steps: 'roman', bench: true, jets: true, counter: true, light: 'white', deckW: 3, hallGlass: 'panorama', hallFloor: 'kamien', hallWall: 'drewno', inSauna: true, inSteam: true, inSpa: true, plants: true, loungers: 3, disinf: 'membrane', uv: true, ozone: true, heat: 'exchanger', vent: 'recovery' } },
    { id: 'zadaszony', t: 'Pod zadaszeniem', d: 'Poliester, zadaszenie teleskopowe', g: 'linear-gradient(135deg,#5fb8d8,#cfd8dc)', s: { loc: 'out', build: 'poly', shape: 'rect', L: 8, W: 3.5, D: 1.4, finish: 'gelcoat', color: 'blekitny', edge: 'skimmer', coping: 'granit', steps: 'corner', bench: false, counter: false, light: 'white', enclosure: 'high', encOpen: 0.15, deck: 'kompozyt', deckW: 2, hedge: true, trees: 1, loungers: 2, umbrella: false, disinf: 'chlorine', uv: false, heat: 'solar' } },
  ];

  /* ======================================================================
     STAN + REGUŁY
     ====================================================================== */
  let state = { ...DEFAULT };
  let time = 'day';
  let view = 'persp';

  const finishesFor = (b) => (b === 'steel' ? ['steel'] : b === 'poly' ? ['gelcoat'] : ['mosaic', 'tiles', 'liner']);
  const shapesFor = (b) => (b === 'steel' ? ['rect', 'round', 'lshape'] : b === 'poly' ? ['rect', 'round', 'oval'] : Object.keys(SHAPES));
  const straightShape = (s) => ['rect', 'round', 'lshape'].includes(s.shape);
  const limits = (s) => (s.build === 'poly' ? { L: [4, 10], W: [2.5, 4.5], D: [1.0, 1.6] } : { L: [4, 16], W: [2.5, 7], D: [1.0, 2.0] });

  const reasons = {
    shape: (s, v) => (shapesFor(s.build).includes(v) ? '' : s.build === 'poly' ? 'Niecki poliestrowe: prostokąt, zaokrąglony, owal' : 'Niecki stalowe: prostokąt, zaokrąglony, L'),
    finish: (s, v) => (finishesFor(s.build).includes(v) ? '' : 'Niedostępne dla tej konstrukcji'),
    edge: (s, v) => (v === 'infinity' && (s.loc !== 'out' || !['rect', 'round'].includes(s.shape)) ? 'Infinity: basen zewnętrzny, prostokątny lub zaokrąglony' : ''),
    steps: (s, v) => (['corner', 'full'].includes(v) && !straightShape(s) ? 'Wymaga prostych ścian' : ''),
  };

  const normalize = (s) => {
    if (!shapesFor(s.build).includes(s.shape)) s.shape = shapesFor(s.build)[0];
    const fs = finishesFor(s.build);
    if (!fs.includes(s.finish)) s.finish = fs[0];
    if (!COLORS[s.finish].some((c) => c[0] === s.color)) s.color = COLORS[s.finish][0][0];
    const lim = limits(s);
    s.L = clamp(s.L, lim.L[0], lim.L[1]);
    s.W = clamp(s.W, lim.W[0], Math.min(lim.W[1], s.L * 0.8));
    s.D = clamp(s.D, lim.D[0], lim.D[1]);
    s.D2 = clamp(Math.max(s.D2, s.D + 0.2), s.D + 0.2, s.build === 'poly' ? 1.8 : 2.6);
    if (s.edge === 'infinity' && reasons.edge(s, 'infinity')) s.edge = 'overflow';
    if (reasons.steps(s, s.steps)) s.steps = 'roman';
    if (!straightShape(s)) s.beach = false;
    if (s.shape === 'kidney') s.bench = false;
    if (!s.bench) s.jets = false;
    if (s.loc === 'in') s.enclosure = 'none';
    if (s.cover !== 'none' && s.enclosure !== 'none' && s.encOpen < 0.95) s.coverAmt = Math.min(s.coverAmt, 1);
    return s;
  };

  // Zapis: link (#projekt=…) i pamięć przeglądarki
  const encode = (s) => {
    const diff = {};
    for (const k of Object.keys(DEFAULT)) if (s[k] !== DEFAULT[k]) diff[k] = s[k];
    diff._t = time;
    return btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const decode = (str) => {
    try {
      const json = decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
      return JSON.parse(json);
    } catch {
      return null;
    }
  };
  const loadInitial = () => {
    const m = location.hash.match(/projekt=([\w-]+)/);
    let d = m ? decode(m[1]) : null;
    if (!d) {
      try {
        d = JSON.parse(localStorage.getItem('aqk-projekt') || 'null');
      } catch {
        d = null;
      }
    }
    if (d) {
      if (d._t && ['day', 'sunset', 'night'].includes(d._t)) time = d._t;
      for (const k of Object.keys(DEFAULT)) if (k in d && typeof d[k] === typeof DEFAULT[k]) state[k] = d[k];
    }
    normalize(state);
  };
  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const code = encode(state);
      try {
        history.replaceState(null, '', `${location.pathname}${location.search}#projekt=${code}`);
      } catch {}
      try {
        const diff = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
        localStorage.setItem('aqk-projekt', JSON.stringify(diff));
      } catch {}
    }, 300);
  };

  /* ======================================================================
     GEOMETRIA BASENU (czysty JS — także do obliczeń)
     ====================================================================== */
  const signedArea = (pts) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[(i + 1) % pts.length];
      a += x1 * z2 - x2 * z1;
    }
    return a / 2;
  };
  const roundRect = (x0, z0, w, h, r, seg = 10) => {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
    const pts = [];
    const corners = [
      [x0 + w - r, z0 + r, -Math.PI / 2],
      [x0 + w - r, z0 + h - r, 0],
      [x0 + r, z0 + h - r, Math.PI / 2],
      [x0 + r, z0 + r, Math.PI],
    ];
    corners.forEach(([cx, cz, a0]) => {
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (i / seg) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
    });
    return pts;
  };
  const catmull = (ctrl, n) => {
    // zamknięta krzywa Catmulla-Roma (centripetal nie jest tu potrzebna)
    const out = [];
    const m = ctrl.length;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * m;
      const k = Math.floor(t);
      const u = t - k;
      const p0 = ctrl[(k - 1 + m) % m];
      const p1 = ctrl[k % m];
      const p2 = ctrl[(k + 1) % m];
      const p3 = ctrl[(k + 2) % m];
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  };
  const outline = (s) => {
    const { L, W } = s;
    let pts;
    if (s.shape === 'rect') pts = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    else if (s.shape === 'round') pts = roundRect(-L / 2, -W / 2, L, W, Math.min(1.1, W * 0.28));
    else if (s.shape === 'oval') pts = roundRect(-L / 2, -W / 2, L, W, W / 2, 16);
    else if (s.shape === 'lshape') {
      const wL = Math.min(3.2, L * 0.36);
      const wW = Math.min(2.6, W * 0.62);
      const z0 = -W / 2 - wW / 2;
      pts = [[-L / 2, z0], [L / 2, z0], [L / 2, z0 + W], [-L / 2 + wL, z0 + W], [-L / 2 + wL, z0 + W + wW], [-L / 2, z0 + W + wW]];
    } else {
      const ctrl = [[-0.5, -0.05], [-0.43, -0.33], [-0.24, -0.48], [0.03, -0.46], [0.3, -0.42], [0.47, -0.22], [0.5, 0.05], [0.41, 0.31], [0.21, 0.46], [0.04, 0.37], [-0.09, 0.2], [-0.23, 0.35], [-0.41, 0.33]];
      pts = catmull(ctrl.map(([x, z]) => [x * L, z * W]), 150);
    }
    if (signedArea(pts) < 0) pts.reverse();
    return pts;
  };
  const pointIn = (pts, x, z) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i];
      const [xj, zj] = pts[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const bounds = (pts) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    pts.forEach(([x, z]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    return { minX, maxX, minZ, maxZ };
  };
  // Odsunięcie wielokąta (dodatnie = na zewnątrz) z osobną odległością dla każdej krawędzi
  const offsetPoly = (pts, distFn) => {
    const n = pts.length;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[(i + 1) % n];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dz / len; // na zewnątrz dla wielokąta o dodatnim polu
      const nz = -dx / len;
      const d = distFn(i, -nx, -nz);
      lines.push({ x: x1 + nx * d, z: z1 + nz * d, dx: dx / len, dz: dz / len, nx, nz, d });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = lines[(i - 1 + n) % n];
      const b = lines[i];
      const den = a.dx * b.dz - a.dz * b.dx;
      if (Math.abs(den) < 1e-4) {
        out.push([pts[i][0] + b.nx * b.d, pts[i][1] + b.nz * b.d]);
        continue;
      }
      const t = ((b.x - a.x) * b.dz - (b.z - a.z) * b.dx) / den;
      let x = a.x + a.dx * t;
      let z = a.z + a.dz * t;
      // ogranicz ostre narożniki
      const mx = pts[i][0] + ((a.nx + b.nx) / 2) * Math.max(a.d, b.d);
      const mz = pts[i][1] + ((a.nz + b.nz) / 2) * Math.max(a.d, b.d);
      if (Math.hypot(x - pts[i][0], z - pts[i][1]) > Math.max(a.d, b.d) * 3) {
        x = mx;
        z = mz;
      }
      out.push([x, z]);
    }
    return out;
  };

  const poolModel = (s) => {
    const pts = outline(s);
    const b = bounds(pts);
    const area = Math.abs(signedArea(pts));
    const depthAt = (x) => (s.slope ? lerp(s.D, s.D2, clamp((x - b.minX) / (b.maxX - b.minX), 0, 1)) : s.D);
    // średnia głębokość z siatki punktów
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 24; j++) {
        const x = lerp(b.minX, b.maxX, (i + 0.5) / 40);
        const z = lerp(b.minZ, b.maxZ, (j + 0.5) / 24);
        if (pointIn(pts, x, z)) {
          sum += depthAt(x);
          cnt++;
        }
      }
    }
    const avgD = cnt ? sum / cnt : s.D;
    let per = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[(i + 1) % pts.length];
      per += Math.hypot(x2 - x1, z2 - z1);
    }
    return { pts, b, area, avgD, vol: area * avgD, per, depthAt };
  };

  /* ======================================================================
     PARAMETRY I PROFIL WODY (poglądowo)
     ====================================================================== */
  const FILTER_SIZES = [400, 500, 600, 650, 750, 900, 1050, 1200, 1400, 1600];
  const metrics = (s) => {
    const pm = poolModel(s);
    const T = USAGE[s.usage].T;
    const Q = pm.vol / T;
    let filter;
    if (s.filter === 'cartridge') filter = `${Math.max(1, Math.ceil(Q / 12))} × wkład`;
    else {
      const A = Q / 40;
      const d = Math.sqrt((4 * A) / Math.PI) * 1000;
      const n = d > 1600 ? Math.ceil(d / 1400) : 1;
      const per = Math.sqrt((4 * (A / n)) / Math.PI) * 1000;
      const size = FILTER_SIZES.find((x) => x >= per) || 1600;
      filter = `${n > 1 ? `${n} × ` : ''}Ø ${size} mm`;
    }
    return { ...pm, T, Q, filter };
  };
  const scores = (s) => {
    const cap = (v) => clamp(v, 0, 5);
    const disinfC = { membrane: 0.3, salt: 0.2, chlorine: 0.2, oxygen: 0.1 }[s.disinf];
    const clarity = cap({ sand: 3.1, glass: 3.9, cartridge: 3.3 }[s.filter] + (s.uv ? 0.4 : 0) + (s.ozone ? 0.5 : 0) + disinfC + (s.redox ? 0.2 : 0));
    const comfort = cap({ chlorine: 2.6, salt: 3.6, membrane: 4.4, oxygen: 4.2 }[s.disinf] + (s.uv ? 0.4 : 0) + (s.ozone ? 0.3 : 0) + (s.ph ? 0.4 : 0));
    const smell = cap({ chlorine: 2.0, salt: 3.2, membrane: 4.6, oxygen: 4.8 }[s.disinf] + (s.uv ? 0.5 : 0) + (s.ozone ? 0.3 : 0) + (s.loc === 'in' ? 0.2 : 0));
    const auto = cap(1 + (s.ph ? 1 : 0) + (s.redox ? 1 : 0) + (s.app ? 1 : 0) + (s.disinf === 'oxygen' ? 0.3 : 0.5) + (s.pump === 'vs' ? 0.5 : 0));
    const energy = cap(1.6 + (s.pump === 'vs' ? 1.2 : 0) + { hp: 1.2, solar: 1.5, exchanger: 0.6, none: 0.4 }[s.heat] + (s.cover !== 'none' ? 0.6 : 0) + (s.enclosure !== 'none' ? 0.4 : 0) + (s.loc === 'in' ? (s.vent === 'hp' ? 0.6 : 0.4) : 0));
    return [
      ['Przejrzystość wody', clarity],
      ['Komfort skóry i oczu', comfort],
      ['Bez zapachu chloru', smell],
      ['Automatyka obsługi', auto],
      ['Oszczędność energii', energy],
    ];
  };
  const scoreWord = (v) => (v >= 4.5 ? 'znakomita' : v >= 3.8 ? 'bardzo dobra' : v >= 3 ? 'dobra' : v >= 2.2 ? 'średnia' : 'podstawowa');

  /* ======================================================================
     INTERFEJS
     ====================================================================== */
  const tabs = [
    { id: 'basen', t: 'Basen', h: 'Kształt i wymiar', p: 'Zacznij od inspiracji albo od zera.' },
    { id: 'wykonczenie', t: 'Wykończenie', h: 'Niecka i brzeg', p: 'Kolor niecki zmienia kolor wody.' },
    { id: 'atrakcje', t: 'Atrakcje', h: 'Wejście, atrakcje, światło', p: 'Wszystko, co sprawia, że basen cieszy codziennie.' },
    { id: 'otoczenie', t: 'Otoczenie', h: 'Przestrzeń wokół basenu', p: 'Taras, zieleń i strefa wypoczynku.' },
    { id: 'woda', t: 'Woda', h: 'Uzdatnianie wody', p: 'Nasza specjalność. Zobacz maszynownię w przekroju.', water: true },
    { id: 'projekt', t: 'Projekt', h: 'Twój projekt', p: 'Zapisz, pobierz albo wyślij do nas.' },
  ];

  const seg = (key, label, opts, cols = 2, extra = {}) => ({ type: 'seg', key, label, opts, cols, ...extra });
  const tgl = (key, label, sub, extra = {}) => ({ type: 'toggle', key, label, sub, ...extra });
  const SCHEMA = {
    basen: [
      { type: 'presets', label: 'Inspiracje' },
      seg('loc', 'Lokalizacja', () => [['out', 'Ogrodowy', 'Na zewnątrz'], ['in', 'Wewnętrzny', 'Hala basenowa']]),
      seg('build', 'Konstrukcja niecki', () => Object.entries(BUILDS).map(([v, o]) => [v, o.t, o.d]), 1),
      seg('shape', 'Kształt', () => Object.entries(SHAPES).map(([v, o]) => [v, o.t, '', o.svg]), 3),
      { type: 'range', key: 'L', label: 'Długość', unit: 'm', step: 0.5, min: (s) => limits(s).L[0], max: (s) => limits(s).L[1] },
      { type: 'range', key: 'W', label: 'Szerokość', unit: 'm', step: 0.5, min: (s) => limits(s).W[0], max: (s) => Math.min(limits(s).W[1], s.L * 0.8) },
      { type: 'range', key: 'D', label: 'Głębokość', unit: 'm', step: 0.05, min: (s) => limits(s).D[0], max: (s) => limits(s).D[1] },
      { type: 'toggles', items: [tgl('slope', 'Dno ze spadkiem', 'Płytko przy wejściu, głębiej na końcu')] },
      { type: 'range', key: 'D2', label: 'Głębokość w części głębokiej', unit: 'm', step: 0.05, min: (s) => s.D + 0.2, max: (s) => (s.build === 'poly' ? 1.8 : 2.6), show: (s) => s.slope },
      { type: 'note', text: (s) => (s.build === 'poly' ? 'Niecki poliestrowe to gotowe formy: do 10 × 4,5 m i 1,6 m głębokości.' : s.build === 'steel' ? 'Niecka BERNDORF jest spawana ze stali szlachetnej: szczelna, bez fug i płytek.' : 'Żelbet w technologii CAPENA: dowolny kształt, wymiar i wykończenie.') },
    ],
    wykonczenie: [
      seg('finish', 'Wykończenie niecki', (s) => finishesFor(s.build).map((v) => [v, FINISH[v].t, FINISH[v].d]), 1),
      { type: 'swatch', key: 'color', label: 'Kolor', opts: (s) => COLORS[s.finish] },
      seg('edge', 'System brzegowy', () => Object.entries(EDGES).map(([v, o]) => [v, o.t, o.d]), 1),
      { type: 'swatch', key: 'coping', label: 'Obrzeże (kamień brzegowy)', opts: () => COPING },
    ],
    atrakcje: [
      seg('steps', 'Wejście do wody', () => Object.entries(STEPS).map(([v, o]) => [v, o.t, o.d])),
      { type: 'toggles', label: 'Strefy w niecce', items: [tgl('bench', 'Ławka do relaksu', 'Pod wodą, wzdłuż ściany', { off: (s) => (s.shape === 'kidney' ? 'Niedostępna dla tego kształtu' : '') }), tgl('beach', 'Płytka plaża', 'Strefa 25 cm dla dzieci i leżaka w wodzie', { off: (s) => (!straightShape(s) ? 'Wymaga prostych ścian' : '') })] },
      { type: 'toggles', label: 'Atrakcje wodne', items: [tgl('counter', 'Przeciwprąd', 'Pływanie w miejscu (np. Hugo Lahme)'), tgl('cascade', 'Kaskada', 'Masaż karku spadającą wodą'), tgl('laminar', 'Łuki wodne', 'Podświetlane strumienie nad wodą'), tgl('jets', 'Dysze masażu', 'W ławce', { off: (s) => (!s.bench ? 'Wymaga ławki' : '') }), tgl('geyser', 'Gejzer powietrzny', 'Masaż bąbelkami z dna')] },
      seg('light', 'Podświetlenie LED', () => Object.entries(LIGHTS).map(([v, o]) => [v, o.t, '']), 3),
      { type: 'count', key: 'lamps', label: 'Liczba lamp', min: 2, max: 12 },
      seg('cover', 'Przykrycie wody', () => Object.entries(COVERS).map(([v, o]) => [v, o.t, o.d || '']), 1),
      { type: 'range', key: 'coverAmt', label: 'Zasłonięcie', unit: '%', step: 0.05, min: () => 0, max: () => 1, pct: true, show: (s) => s.cover !== 'none' },
      seg('enclosure', 'Zadaszenie teleskopowe', () => Object.entries(ENCLOSURES).map(([v, o]) => [v, o.t, o.d || '']), 3, { show: (s) => s.loc === 'out' }),
      { type: 'range', key: 'encOpen', label: 'Otwarcie zadaszenia', unit: '%', step: 0.05, min: () => 0, max: () => 1, pct: true, show: (s) => s.loc === 'out' && s.enclosure !== 'none' },
    ],
    otoczenie: [
      { type: 'swatch', key: 'deck', label: 'Taras', opts: () => DECKS, show: (s) => s.loc === 'out' },
      { type: 'range', key: 'deckW', label: 'Szerokość tarasu', unit: 'm', step: 0.25, min: () => 1, max: () => 4.5 },
      { type: 'toggles', label: 'Zieleń', show: (s) => s.loc === 'out', items: [tgl('hedge', 'Żywopłot', 'Prywatność od strony sąsiadów'), tgl('grasses', 'Trawy ozdobne', 'W donicach przy tarasie')] },
      { type: 'count', key: 'trees', label: 'Drzewa', min: 0, max: 4, show: (s) => s.loc === 'out' },
      { type: 'count', key: 'loungers', label: 'Leżaki', min: 0, max: 6 },
      { type: 'toggles', label: 'Strefa wypoczynku', show: (s) => s.loc === 'out', items: [tgl('umbrella', 'Parasol', ''), tgl('pergola', 'Pergola z sofą', 'Cień i miejsce na wieczór'), tgl('firepit', 'Palenisko', 'Ogień przy wieczornej kąpieli'), tgl('shower', 'Prysznic ogrodowy', '')] },
      { type: 'toggles', label: 'Wellness w ogrodzie', show: (s) => s.loc === 'out', items: [tgl('spa', 'Wanna SPA', 'Obok basenu, na tarasie'), tgl('sauna', 'Sauna ogrodowa', 'Z przeszklonym frontem')] },
      { type: 'toggles', label: 'Bezpieczeństwo i światło', show: (s) => s.loc === 'out', items: [tgl('fence', 'Szklane ogrodzenie', 'Bezpieczeństwo dzieci'), tgl('gardenLights', 'Oświetlenie ogrodu', 'Słupki przy tarasie')] },
      seg('hallGlass', 'Hala: ściana z widokiem', () => [['panorama', 'Panoramiczne przeszklenie', 'Ogród na wyciągnięcie ręki'], ['windows', 'Okna w ścianie', 'Więcej prywatności']], 1, { show: (s) => s.loc === 'in' }),
      { type: 'swatch', key: 'hallFloor', label: 'Posadzka hali', opts: () => HALL_FLOORS, show: (s) => s.loc === 'in' },
      { type: 'swatch', key: 'hallWall', label: 'Okładzina ścian', opts: () => HALL_WALLS, show: (s) => s.loc === 'in' },
      { type: 'toggles', label: 'Wellness w hali', show: (s) => s.loc === 'in', items: [tgl('inSauna', 'Sauna', 'Fińska, przy ścianie'), tgl('inSteam', 'Łaźnia parowa', 'Mozaika i ławy'), tgl('inSpa', 'Wanna SPA', ''), tgl('plants', 'Rośliny', 'Duże donice przy przeszkleniu')] },
    ],
    woda: [
      { type: 'water' },
      seg('usage', 'Użytkowanie basenu', () => Object.entries(USAGE).map(([v, o]) => [v, o.t, o.d])),
      seg('filter', 'Filtracja', () => Object.entries(FILTERS).map(([v, o]) => [v, o.t, o.d]), 1),
      seg('pump', 'Pompa obiegowa', () => Object.entries(PUMPS).map(([v, o]) => [v, o.t, o.d])),
      seg('disinf', 'Dezynfekcja', () => Object.entries(DISINF).map(([v, o]) => [v, o.t, o.d]), 1),
      { type: 'toggles', label: 'Wspomaganie i automatyka', items: [tgl('uv', 'Lampa UV', 'Niszczy bakterie i chloraminy'), tgl('ozone', 'Ozonator', 'Krystaliczna woda, mniej chemii'), tgl('ph', 'Automatyczna korekta pH', 'Dozowanie i pomiar'), tgl('redox', 'Pomiar Redox / wolnego chloru', 'Dezynfekcja dokładnie wtedy, gdy trzeba'), tgl('app', 'Sterowanie z aplikacji', 'Parametry wody w telefonie')] },
      seg('heat', 'Podgrzewanie wody', () => Object.entries(HEATING).map(([v, o]) => [v, o.t, o.d])),
      { type: 'range', key: 'temp', label: 'Temperatura wody', unit: '°C', step: 1, min: () => 24, max: () => 32, show: (s) => s.heat !== 'none' },
      seg('vent', 'Wentylacja hali basenowej', () => Object.entries(VENT).map(([v, o]) => [v, o.t, o.d]), 1, { show: (s) => s.loc === 'in' }),
      { type: 'toggles', label: 'Porównanie', items: [tgl('raw', 'Pokaż wodę bez uzdatniania', 'Tak wyglądałby basen po kilku dniach')] },
    ],
    projekt: [{ type: 'summary' }],
  };

  const tabsEl = $('#aqk-tabs');
  const sectionsEl = $('#aqk-sections');
  let tabIndex = 0;

  tabsEl.innerHTML = tabs
    .map((t, i) => `<button type="button" role="tab" class="aqk-tab${t.water ? ' is-water' : ''}" id="aqk-tab-${t.id}" aria-controls="aqk-sec-${t.id}" aria-selected="${i === 0}"><i>${i + 1}</i>${t.t}</button>`)
    .join('');
  sectionsEl.innerHTML = tabs
    .map((t, i) => `<section class="aqk-section${i === 0 ? ' is-active' : ''}" id="aqk-sec-${t.id}" role="tabpanel" aria-labelledby="aqk-tab-${t.id}"><div class="aqk-section-head">${t.water ? '<span class="aqk-badge">Specjalność AQUATIC</span>' : ''}<h3>${t.h}</h3><p>${t.p}</p></div><div class="aqk-controls" data-tab="${t.id}"></div></section>`)
    .join('');

  // --- Budowa kontrolek ---
  const controls = [];
  const optBtn = (key, [v, t, d, svg]) => `<button type="button" class="aqk-opt" data-key="${key}" data-v="${v}" aria-pressed="false">${svg ? `<svg class="aqk-shape" viewBox="0 0 44 26">${svg}</svg>` : ''}<b>${t}</b>${d ? `<small>${d}</small>` : ''}</button>`;
  const swBtn = (key, [v, t, c]) => `<button type="button" class="aqk-swatch" data-key="${key}" data-v="${v}" aria-pressed="false" title="${t}"><i style="--sw:${swatchBg(key, v, c)}"></i>${t}</button>`;
  const swatchBg = (key, v, c) => {
    if (key === 'color' && state.finish === 'mosaic') return `repeating-linear-gradient(0deg, rgb(255 255 255 / .35) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgb(255 255 255 / .35) 0 1px, ${c} 1px 6px)`;
    if (['deck', 'hallFloor'].includes(key) && ['deska', 'drewno'].includes(v)) return `repeating-linear-gradient(0deg, rgb(0 0 0 / .18) 0 1px, ${c} 1px 9px)`;
    if (key === 'coping' && v === 'drewno') return `repeating-linear-gradient(0deg, rgb(0 0 0 / .18) 0 1px, ${c} 1px 9px)`;
    if (v === 'trawertyn') return `radial-gradient(circle at 30% 40%, rgb(0 0 0 / .08) 0 2px, transparent 3px) 0 0 / 9px 9px, ${c}`;
    return c;
  };

  Object.entries(SCHEMA).forEach(([tab, list]) => {
    const host = $(`.aqk-controls[data-tab="${tab}"]`);
    list.forEach((c, i) => {
      const g = document.createElement('div');
      g.className = 'aqk-group';
      g.dataset.idx = `${tab}-${i}`;
      c.el = g;
      controls.push(c);
      host.appendChild(g);
    });
  });

  // Rysuje (raz) lub odświeża treść kontrolki
  const renderControl = (c) => {
    const s = state;
    const g = c.el;
    const visible = !c.show || c.show(s);
    g.hidden = !visible;
    if (!visible) return;
    if (c.type === 'seg') {
      const opts = c.opts(s);
      const sig = opts.map((o) => o[0]).join('|');
      if (g.dataset.sig !== sig) {
        g.dataset.sig = sig;
        g.innerHTML = `<div class="aqk-label">${c.label}</div><div class="aqk-options" style="--cols:${c.cols}">${opts.map((o) => optBtn(c.key, o)).join('')}</div><p class="aqk-note" hidden></p>`;
      }
      let why = '';
      $$('.aqk-opt', g).forEach((b) => {
        const r = reasons[c.key] ? reasons[c.key](s, b.dataset.v) : '';
        b.disabled = !!r;
        b.title = r;
        b.setAttribute('aria-pressed', String(s[c.key] === b.dataset.v));
        if (r && !why) why = r;
      });
      const note = $('.aqk-note', g);
      note.hidden = !why;
      note.textContent = why;
    } else if (c.type === 'swatch') {
      const opts = c.opts(s);
      const sig = opts.map((o) => o[0]).join('|') + (c.key === 'color' ? s.finish : '');
      if (g.dataset.sig !== sig) {
        g.dataset.sig = sig;
        g.innerHTML = `<div class="aqk-label">${c.label}<em></em></div><div class="aqk-swatches">${opts.map((o) => swBtn(c.key, o)).join('')}</div>`;
      }
      $$('.aqk-swatch', g).forEach((b) => b.setAttribute('aria-pressed', String(s[c.key] === b.dataset.v)));
      const cur = opts.find((o) => o[0] === s[c.key]);
      $('.aqk-label em', g).textContent = cur ? cur[1] : '';
    } else if (c.type === 'range') {
      const min = c.min(s);
      const max = c.max(s);
      if (!g.dataset.built) {
        g.dataset.built = '1';
        g.innerHTML = `<label class="aqk-label" for="aqk-r-${c.key}">${c.label}<output></output></label><input class="aqk-range" type="range" id="aqk-r-${c.key}" data-key="${c.key}"><div class="aqk-range-scale"><span></span><span></span></div>`;
      }
      const inp = $('input', g);
      inp.min = min;
      inp.max = max;
      inp.step = c.step;
      inp.value = s[c.key];
      const p = max > min ? ((s[c.key] - min) / (max - min)) * 100 : 0;
      inp.style.setProperty('--p', `${p}%`);
      const show = (v) => (c.pct ? `${Math.round(v * 100)}%` : `${fmt(v, 2)} ${c.unit}`);
      $('output', g).textContent = show(s[c.key]);
      const [a, b] = $$('.aqk-range-scale span', g);
      a.textContent = show(min);
      b.textContent = show(max);
    } else if (c.type === 'toggles') {
      if (!g.dataset.built) {
        g.dataset.built = '1';
        g.innerHTML = `${c.label ? `<div class="aqk-label">${c.label}</div>` : ''}<div class="aqk-toggles">${c.items.map((t) => `<button type="button" class="aqk-toggle" role="switch" data-key="${t.key}" aria-checked="false"><span>${t.label}${t.sub ? `<small>${t.sub}</small>` : ''}</span><i class="aqk-switch" aria-hidden="true"></i></button>`).join('')}</div>`;
      }
      c.items.forEach((t) => {
        const b = $(`.aqk-toggle[data-key="${t.key}"]`, g);
        const off = t.off ? t.off(s) : '';
        b.disabled = !!off;
        b.title = off;
        b.setAttribute('aria-checked', String(!!s[t.key]));
        const sm = $('small', b);
        if (sm) sm.textContent = off || t.sub;
      });
    } else if (c.type === 'count') {
      if (!g.dataset.built) {
        g.dataset.built = '1';
        g.innerHTML = `<div class="aqk-counter-row"><span>${c.label}</span><span class="aqk-counter"><button type="button" data-key="${c.key}" data-d="-1" aria-label="Mniej">−</button><output></output><button type="button" data-key="${c.key}" data-d="1" aria-label="Więcej">+</button></span></div>`;
      }
      $('output', g).textContent = s[c.key];
      const [m, p] = $$('.aqk-counter button', g);
      m.disabled = s[c.key] <= c.min;
      p.disabled = s[c.key] >= c.max;
    } else if (c.type === 'note') {
      g.innerHTML = `<p class="aqk-note">${c.text(s)}</p>`;
    } else if (c.type === 'presets') {
      if (!g.dataset.built) {
        g.dataset.built = '1';
        g.innerHTML = `<div class="aqk-label">${c.label}<em>gotowe projekty do edycji</em></div><div class="aqk-presets">${PRESETS.map((p) => `<button type="button" class="aqk-preset" data-preset="${p.id}" style="--g:${p.g}"><b>${p.t}</b><small>${p.d}</small></button>`).join('')}</div>`;
      }
    } else if (c.type === 'water') {
      renderWater(g);
    } else if (c.type === 'summary') {
      renderSummary(g);
    }
  };

  const renderWater = (g) => {
    const s = state;
    const m = metrics(s);
    const sc = scores(s);
    const bar = (v) => Array.from({ length: 5 }, (_, i) => `<i class="${v >= i + 1 ? 'on' : v >= i + 0.5 ? 'half' : ''}"></i>`).join('');
    g.innerHTML = `
      <div class="aqk-water">
        ${sc.map(([l, v]) => `<div class="aqk-meter"><span>${l}</span><em>${scoreWord(v)}</em><div class="bar">${bar(v)}</div></div>`).join('')}
      </div>
      <div class="aqk-params">
        <div class="aqk-param"><span>Pojemność</span><b>${fmt(m.vol, 0)} m³</b></div>
        <div class="aqk-param"><span>Lustro wody</span><b>${fmt(m.area, 1)} m²</b></div>
        <div class="aqk-param"><span>Wydajność obiegu</span><b>${fmt(m.Q, 1)} m³/h</b></div>
        <div class="aqk-param"><span>Cała woda przez filtr</span><b>co ${m.T} h</b></div>
        <div class="aqk-param"><span>Filtr (dobór wstępny)</span><b>${m.filter}</b></div>
        <div class="aqk-param"><span>Temperatura wody</span><b>${s.heat === 'none' ? 'naturalna' : `${s.temp} °C`}</b></div>
      </div>
      <p class="aqk-note">Ocena porównuje warianty między sobą. Parametry są orientacyjne; dokładny dobór przygotuje nasz inżynier.</p>
      <div class="aqk-actions"><button type="button" class="aqk-btn aqk-btn--cyan aqk-btn--wide" data-act="tech"><svg><use href="#aqk-i-gear"/></svg>Pokaż maszynownię w 3D</button></div>`;
  };

  // --- Podsumowanie ---
  const labelOf = (cat, v) => (cat[v] ? cat[v].t : v);
  const swLabel = (list, v) => (list.find((x) => x[0] === v) || [v, v])[1];
  const summaryData = (s) => {
    const m = metrics(s);
    const att = [s.counter && 'przeciwprąd', s.cascade && 'kaskada', s.laminar && 'łuki wodne', s.jets && 'dysze masażu', s.geyser && 'gejzer'].filter(Boolean);
    const aux = [s.uv && 'lampa UV', s.ozone && 'ozonator'].filter(Boolean);
    const ctl = [s.ph && 'pH', s.redox && 'Redox/chlor', s.app && 'aplikacja'].filter(Boolean);
    const out = [
      ['Basen', [
        ['Lokalizacja', s.loc === 'out' ? 'ogrodowy' : 'wewnętrzny'],
        ['Konstrukcja', BUILDS[s.build].t],
        ['Kształt', SHAPES[s.shape].t],
        ['Wymiary', `${fmt(s.L)} × ${fmt(s.W)} m`],
        ['Głębokość', s.slope ? `${fmt(s.D, 2)}–${fmt(s.D2, 2)} m` : `${fmt(s.D, 2)} m`],
        ['Pojemność', `ok. ${fmt(m.vol, 0)} m³`],
      ]],
      ['Wykończenie', [
        ['Niecka', FINISH[s.finish].t],
        ['Kolor', swLabel(COLORS[s.finish], s.color)],
        ['System brzegowy', EDGES[s.edge].t],
        ['Obrzeże', swLabel(COPING, s.coping)],
      ]],
      ['Strefy i atrakcje', [
        ['Wejście', STEPS[s.steps].t],
        ['Strefy', [s.bench && 'ławka', s.beach && 'plaża'].filter(Boolean).join(', ') || '—'],
        ['Atrakcje', att.join(', ') || '—'],
        ['Oświetlenie', `${LIGHTS[s.light].t}, ${s.lamps} lamp`],
        ['Przykrycie', COVERS[s.cover].t],
        ...(s.loc === 'out' ? [['Zadaszenie', ENCLOSURES[s.enclosure].t]] : []),
      ]],
      ['Otoczenie', s.loc === 'out' ? [
        ['Taras', `${swLabel(DECKS, s.deck)}, ${fmt(s.deckW, 2)} m`],
        ['Zieleń', [s.hedge && 'żywopłot', s.trees && `drzewa: ${s.trees}`, s.grasses && 'trawy'].filter(Boolean).join(', ') || '—'],
        ['Wypoczynek', [s.loungers && `leżaki: ${s.loungers}`, s.umbrella && 'parasol', s.pergola && 'pergola', s.firepit && 'palenisko', s.shower && 'prysznic'].filter(Boolean).join(', ') || '—'],
        ['Wellness', [s.spa && 'wanna SPA', s.sauna && 'sauna'].filter(Boolean).join(', ') || '—'],
        ['Inne', [s.fence && 'szklane ogrodzenie', s.gardenLights && 'oświetlenie ogrodu'].filter(Boolean).join(', ') || '—'],
      ] : [
        ['Hala', s.hallGlass === 'panorama' ? 'panoramiczne przeszklenie' : 'okna w ścianie'],
        ['Posadzka', swLabel(HALL_FLOORS, s.hallFloor)],
        ['Ściany', swLabel(HALL_WALLS, s.hallWall)],
        ['Wellness', [s.inSauna && 'sauna', s.inSteam && 'łaźnia parowa', s.inSpa && 'wanna SPA'].filter(Boolean).join(', ') || '—'],
        ['Leżaki', String(s.loungers)],
      ]],
      ['Uzdatnianie wody', [
        ['Filtracja', FILTERS[s.filter].t],
        ['Pompa', PUMPS[s.pump].t],
        ['Dezynfekcja', DISINF[s.disinf].t],
        ['Wspomaganie', aux.join(', ') || '—'],
        ['Automatyka', ctl.join(', ') || '—'],
        ['Podgrzewanie', s.heat === 'none' ? 'brak' : `${HEATING[s.heat].t}, ${s.temp} °C`],
        ...(s.loc === 'in' ? [['Wentylacja', VENT[s.vent].t]] : []),
        ['Obieg (orient.)', `${fmt(m.Q, 1)} m³/h, co ${m.T} h`],
        ['Filtr (orient.)', m.filter],
      ]],
    ];
    return out;
  };
  const renderSummary = (g) => {
    const prev = $('#aqk-form', g) ? Object.fromEntries(new FormData($('#aqk-form', g))) : null;
    const data = summaryData(state);
    g.innerHTML = `
      <div class="aqk-summary">${data.map(([h, rows]) => `<div class="aqk-sum-block"><h4>${h}</h4><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div>`).join('')}</div>
      <div class="aqk-actions">
        <button type="button" class="aqk-btn" data-act="png"><svg><use href="#aqk-i-download"/></svg>Obraz PNG</button>
        <button type="button" class="aqk-btn" data-act="link"><svg><use href="#aqk-i-link"/></svg>Kopiuj link</button>
        <button type="button" class="aqk-btn aqk-btn--wide" data-act="print"><svg><use href="#aqk-i-print"/></svg>Drukuj / zapisz PDF</button>
      </div>
      <div class="aqk-group" style="margin-top:22px">
        <div class="aqk-label">Wyślij projekt do AQUATIC</div>
        <form class="aqk-form" id="aqk-form" novalidate>
          <label class="aqk-field">Imię i nazwisko<input name="name" autocomplete="name" required></label>
          <label class="aqk-field">Telefon<input name="phone" type="tel" autocomplete="tel" required></label>
          <label class="aqk-field">E-mail<input name="email" type="email" autocomplete="email"></label>
          <label class="aqk-field">Miejscowość<input name="city" autocomplete="address-level2"></label>
          <label class="aqk-field aqk-field--full">Planowany termin<select name="when"><option>Jak najszybciej</option><option>W tym roku</option><option>W przyszłym roku</option><option>Na razie zbieram pomysły</option></select></label>
          <label class="aqk-field aqk-field--full">Uwagi<textarea name="note" placeholder="Np. wymiary działki, rodzaj gruntu, pytania"></textarea></label>
          <div class="aqk-actions aqk-field--full" style="margin-top:4px">
            <button type="submit" class="aqk-btn aqk-btn--solid aqk-btn--wide"><svg><use href="#aqk-i-send"/></svg>Wyślij projekt</button>
            <a class="aqk-btn aqk-btn--wide" href="tel:${PHONE}"><svg><use href="#aqk-i-phone"/></svg>Zadzwoń: (+48) 505 988 656</a>
          </div>
        </form>
        <p class="aqk-note">Wysłanie otwiera Twój program pocztowy z gotową wiadomością i linkiem do projektu. Bez wyceny i bez zobowiązań.</p>
      </div>`;
    if (prev) Object.entries(prev).forEach(([k, v]) => {
      const f = $(`#aqk-form [name="${k}"]`, g);
      if (f) f.value = v;
    });
  };

  // Szybkie fakty na scenie
  const factsEl = $('#aqk-facts');
  const renderFacts = () => {
    const m = metrics(state);
    factsEl.innerHTML = `<span><b>${fmt(state.L)} × ${fmt(state.W)} m</b></span><span><b>${fmt(m.vol, 0)} m³</b></span><span class="opt">${SHAPES[state.shape].t.toLowerCase()}, ${state.loc === 'out' ? 'ogrodowy' : 'kryty'}</span>${state.heat !== 'none' ? `<span class="opt"><b>${state.temp} °C</b></span>` : ''}`;
  };

  const refreshUI = () => {
    controls.forEach(renderControl);
    renderFacts();
    $('#aqk-stage').dataset.loc = state.loc;
  };

  // --- Zmiany ---
  let onChange = () => {};
  const set = (patch, opts = {}) => {
    Object.assign(state, patch);
    normalize(state);
    refreshUI();
    persist();
    onChange(opts);
  };

  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.aqk-opt, .aqk-swatch');
    if (opt && !opt.disabled) {
      set({ [opt.dataset.key]: opt.dataset.v });
      return;
    }
    const tg = e.target.closest('.aqk-toggle');
    if (tg && !tg.disabled) {
      set({ [tg.dataset.key]: !state[tg.dataset.key] });
      return;
    }
    const cnt = e.target.closest('.aqk-counter button');
    if (cnt && !cnt.disabled) {
      const k = cnt.dataset.key;
      set({ [k]: state[k] + Number(cnt.dataset.d) });
      return;
    }
    const pr = e.target.closest('.aqk-preset');
    if (pr) {
      const p = PRESETS.find((x) => x.id === pr.dataset.preset);
      state = { ...DEFAULT, ...p.s };
      if (p.time) setTime(p.time);
      $$('.aqk-preset').forEach((b) => b.classList.toggle('is-active', b === pr));
      set({}, { reframe: true });
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'tech') setView('tech');
      if (a === 'png') downloadPng();
      if (a === 'link') copyLink();
      if (a === 'print') printProject();
    }
  });
  root.addEventListener('input', (e) => {
    const r = e.target.closest('.aqk-range');
    if (!r) return;
    set({ [r.dataset.key]: Number(r.value) }, { live: true });
  });
  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'aqk-form') return;
    e.preventDefault();
    sendProject(new FormData(e.target));
  });

  // --- Zakładki ---
  const prevBtn = $('#aqk-prev');
  const nextBtn = $('#aqk-next');
  const progress = $('#aqk-progress');
  const setTab = (i, focus) => {
    tabIndex = clamp(i, 0, tabs.length - 1);
    $$('.aqk-tab').forEach((t, k) => t.setAttribute('aria-selected', String(k === tabIndex)));
    $$('.aqk-section').forEach((s, k) => s.classList.toggle('is-active', k === tabIndex));
    prevBtn.disabled = tabIndex === 0;
    nextBtn.textContent = tabIndex === tabs.length - 1 ? 'Wyślij projekt' : `Dalej: ${tabs[tabIndex + 1].t}`;
    progress.textContent = `${tabIndex + 1} / ${tabs.length}`;
    $('#aqk-sections').scrollTop = 0;
    if (tabs[tabIndex].id === 'projekt') renderControl(controls.find((c) => c.type === 'summary'));
    if (tabs[tabIndex].id === 'woda' && view === 'persp') setView('tech');
    else if (tabs[tabIndex].id !== 'woda' && view === 'tech') setView('persp');
    if (focus) $$('.aqk-tab')[tabIndex].focus();
    if (window.innerWidth <= 900) {
      const top = $('#aqk-tabs').getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight) $('#aqk-app').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };
  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.aqk-tab');
    if (t) setTab($$('.aqk-tab').indexOf(t));
  });
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') setTab(tabIndex + 1, true);
    if (e.key === 'ArrowLeft') setTab(tabIndex - 1, true);
  });
  prevBtn.addEventListener('click', () => setTab(tabIndex - 1));
  nextBtn.addEventListener('click', () => {
    if (tabIndex === tabs.length - 1) {
      const f = $('#aqk-form');
      if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true }));
    } else setTab(tabIndex + 1);
  });

  // --- Widoki i pora dnia (przyciski na scenie) ---
  const stageEl = $('#aqk-stage');
  let onView = () => {};
  let onTime = () => {};
  const setView = (v, instant) => {
    view = v;
    $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    onView(v, instant);
  };
  const setTime = (t) => {
    time = t;
    stageEl.dataset.time = t;
    $$('.aqk-bar--tr [data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === t)));
    onTime(t);
    persist();
  };
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('.aqk-bar--tr [data-time]').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.time)));

  // --- Komunikat ---
  const toastEl = $('#aqk-toast');
  let toastT = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  };

  // --- Eksport ---
  let snapshot = () => null;
  const downloadPng = () => {
    const url = snapshot();
    if (!url) return toast('Wizualizacja jeszcze się ładuje');
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquatic-basen-${state.L}x${state.W}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Pobrano obraz basenu');
  };
  const projectLink = () => `${location.origin === 'null' || location.protocol === 'file:' ? 'https://aquatic.pl/konfigurator-basenu/' : location.href.split('#')[0]}#projekt=${encode(state)}`;
  const copyLink = async () => {
    const link = projectLink();
    try {
      await navigator.clipboard.writeText(link);
      toast('Link do projektu skopiowany');
    } catch {
      prompt('Skopiuj link do projektu:', link);
    }
  };
  const summaryText = () =>
    summaryData(state)
      .map(([h, rows]) => `${h.toUpperCase()}\n${rows.map(([a, b]) => `• ${a}: ${b}`).join('\n')}`)
      .join('\n\n');
  const sendProject = (fd) => {
    const name = (fd.get('name') || '').trim();
    const phone = (fd.get('phone') || '').trim();
    if (!name || !phone) {
      toast('Podaj imię i telefon, żebyśmy mogli oddzwonić');
      const f = $('#aqk-form');
      (name ? f.phone : f.name).focus();
      return;
    }
    const body = `Dzień dobry,\n\nprzesyłam projekt basenu z konfiguratora.\n\n${summaryText()}\n\nLink do projektu: ${projectLink()}\n\nImię i nazwisko: ${name}\nTelefon: ${phone}\nE-mail: ${fd.get('email') || '—'}\nMiejscowość: ${fd.get('city') || '—'}\nTermin: ${fd.get('when')}\nUwagi: ${fd.get('note') || '—'}\n`;
    const subject = `Projekt basenu ${fmt(state.L)}×${fmt(state.W)} m — ${name}`;
    location.href = `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('Otwieram wiadomość do AQUATIC…');
  };
  const printProject = () => {
    const box = document.getElementById('aqk-print');
    if (box.parentElement !== document.body) document.body.appendChild(box);
    const img = snapshot();
    box.innerHTML = `<h1>Projekt basenu — AQUATIC</h1><p class="meta">${new Date().toLocaleDateString('pl-PL')} · ${MAIL} · (+48) 505 988 656</p>${img ? `<img src="${img}" alt="">` : ''}<div class="cols">${summaryData(state).map(([h, rows]) => `<h4>${h}</h4><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`).join('')}</div><p class="meta">Link do projektu: ${projectLink()}</p>`;
    setTimeout(() => window.print(), 50);
  };

  // --- Pełny ekran ---
  const appEl = $('#aqk-app');
  let onResize = () => {};
  $('#aqk-full').addEventListener('click', () => {
    appEl.classList.toggle('is-full');
    document.documentElement.style.overflow = appEl.classList.contains('is-full') ? 'hidden' : '';
    onResize();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && appEl.classList.contains('is-full')) $('#aqk-full').click();
  });
  $('#aqk-shot').addEventListener('click', downloadPng);

  // Stały nagłówek motywu chowa się i wraca przy przewijaniu — odstęp liczony na bieżąco
  let headQueued = false;
  let headLast = -1;
  const measureHead = () => {
    headQueued = false;
    const h = document.querySelector('.header-sticky');
    let v = 0;
    if (h && getComputedStyle(h).position === 'fixed') {
      const r = h.getBoundingClientRect();
      v = Math.max(0, Math.round(r.bottom));
    }
    if (v !== headLast) {
      headLast = v;
      root.style.setProperty('--aq-head', `${v}px`);
    }
  };
  measureHead();
  window.addEventListener('resize', measureHead);
  window.addEventListener('scroll', () => {
    if (!headQueued) {
      headQueued = true;
      requestAnimationFrame(measureHead);
    }
  }, { passive: true });
  new IntersectionObserver(([e]) => document.body.classList.toggle('aqk-in-view', e.isIntersecting), { rootMargin: '-30% 0px -30% 0px' }).observe(appElRef());
  function appElRef() {
    return root.querySelector('#aqk-app');
  }

  loadInitial();
  stageEl.dataset.time = time;
  $$('.aqk-bar--tr [data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === time)));
  refreshUI();
  setTab(0);

  /* ======================================================================
     WIZUALIZACJA 3D
     ====================================================================== */
  const loadingEl = $('#aqk-loading');
  Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/environments/RoomEnvironment.js')])
    .then(([THREE, { OrbitControls }, { RoomEnvironment }]) => {
      startEngine(THREE, OrbitControls, RoomEnvironment);
    })
    .catch(() => {
      loadingEl.classList.add('is-error');
      loadingEl.textContent = 'Wizualizacja 3D potrzebuje połączenia z internetem. Wszystkie opcje działają — podsumowanie znajdziesz w kroku 6.';
    });

  function startEngine(THREE, OrbitControls, RoomEnvironment) {
    const canvas = $('#aqk-canvas');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      loadingEl.classList.add('is-error');
      loadingEl.textContent = 'Ta przeglądarka nie obsługuje 3D. Opcje i podsumowanie działają normalnie.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.fog = new THREE.Fog('#eef5f8', 40, 95);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    camera.position.set(12, 9, 14);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.48;
    controls.minDistance = 3;
    controls.maxDistance = 80;
    controls.screenSpacePanning = false;

    const hemi = new THREE.HemisphereLight('#ffffff', '#b8c4a2', 0.85);
    const sun = new THREE.DirectionalLight('#fff6e8', 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    scene.add(hemi, sun, sun.target);
    const poolLights = [0, 1].map(() => {
      const l = new THREE.PointLight('#ffffff', 0, 12, 1.6);
      scene.add(l);
      return l;
    });

    /* ---------- Tekstury proceduralne ---------- */
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const texCache = new Map();
    const rand = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    const canvasTex = (key, w, h, draw, srgb = true) => {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      texCache.set(key, t);
      return t;
    };
    const shade = (hex, k) => {
      const c = new THREE.Color(hex);
      c.offsetHSL(0, 0, k);
      return `#${c.getHexString()}`;
    };
    const finishTex = (finish, hex) =>
      canvasTex(`fin-${finish}-${hex}`, 256, 256, (g, w, h) => {
        if (finish === 'mosaic') {
          const n = 12;
          const s = w / n;
          g.fillStyle = shade(hex, 0.18);
          g.fillRect(0, 0, w, h);
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            g.fillStyle = shade(hex, (rand() - 0.5) * 0.12);
            g.fillRect(x * s + 1.2, y * s + 1.2, s - 2.4, s - 2.4);
          }
        } else if (finish === 'tiles') {
          const n = 4;
          const s = w / n;
          g.fillStyle = shade(hex, 0.12);
          g.fillRect(0, 0, w, h);
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            g.fillStyle = shade(hex, (rand() - 0.5) * 0.05);
            g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
          }
        } else if (finish === 'steel') {
          g.fillStyle = hex;
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < 400; i++) {
            g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '90,100,110'},${0.04 + rand() * 0.06})`;
            g.fillRect(0, rand() * h, w, 1);
          }
        } else {
          g.fillStyle = hex;
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < (finish === 'gelcoat' && hex === '#6e767c' ? 2500 : 600); i++) {
            g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.05})`;
            g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
          }
          if (finish === 'liner') {
            g.fillStyle = 'rgba(0,0,0,0.06)';
            g.fillRect(0, 0, w, 2);
          }
        }
      });
    const stoneTex = (kind, hex) =>
      canvasTex(`stone-${kind}-${hex}`, 256, 256, (g, w, h) => {
        g.fillStyle = hex;
        g.fillRect(0, 0, w, h);
        if (kind === 'deska' || kind === 'drewno') {
          const n = 8;
          for (let i = 0; i < n; i++) {
            g.fillStyle = shade(hex, (rand() - 0.5) * 0.08);
            g.fillRect(0, (i * h) / n, w, h / n - 2);
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(0, ((i + 1) * h) / n - 2, w, 2);
            for (let k = 0; k < 6; k++) {
              g.fillStyle = 'rgba(60,30,10,0.12)';
              g.fillRect(0, (i * h) / n + rand() * (h / n - 4), w, 1);
            }
          }
        } else if (kind === 'kompozyt') {
          const n = 8;
          for (let i = 0; i < n; i++) {
            g.fillStyle = shade(hex, (rand() - 0.5) * 0.04);
            g.fillRect(0, (i * h) / n, w, h / n - 3);
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.fillRect(0, ((i + 1) * h) / n - 3, w, 3);
            for (let k = 0; k < 5; k++) {
              g.fillStyle = 'rgba(255,255,255,0.05)';
              g.fillRect(0, (i * h) / n + 3 + k * 3, w, 1);
            }
          }
        } else {
          const big = kind === 'beton' || kind === 'gres';
          const n = big ? 2 : 4;
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const off = !big && y % 2 ? w / n / 2 : 0;
            g.fillStyle = shade(hex, (rand() - 0.5) * (big ? 0.04 : 0.07));
            g.fillRect(x * (w / n) + off, y * (h / n), w / n - 3, h / n - 3);
            if (!big && off) g.fillRect(0, y * (h / n), off - 3, h / n - 3);
          }
          for (let i = 0; i < (kind === 'trawertyn' ? 260 : 120); i++) {
            g.fillStyle = `rgba(0,0,0,${kind === 'trawertyn' ? 0.1 : 0.04})`;
            g.beginPath();
            g.ellipse(rand() * w, rand() * h, 0.6 + rand() * 2.4, 0.4 + rand() * 1.2, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      });
    const grassTex = canvasTex('grass', 256, 256, (g, w, h) => {
      g.fillStyle = '#6f9b4c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        const v = rand();
        g.fillStyle = v > 0.6 ? 'rgba(160,196,100,0.35)' : v > 0.3 ? 'rgba(68,108,48,0.35)' : 'rgba(118,150,70,0.3)';
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 1.4, 2 + rand() * 3);
      }
    });
    grassTex.repeat.set(40, 40);
    const grateTex = canvasTex('grate', 64, 64, (g, w, h) => {
      g.fillStyle = '#56636c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f3f5f6';
      for (let x = 0; x < w; x += 8) g.fillRect(x + 1, 0, 6, h);
    });
    const causticCanvasTex = () =>
      canvasTex('caustic', 256, 256, (g, w, h) => {
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
            const a = Math.pow(clamp(1 - (f2 - f1) * 9, 0, 1), 3.2);
            const i = (py * w + px) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
            img.data[i + 3] = Math.round(a * 255);
          }
        }
        g.putImageData(img, 0, 0);
      });
    const causticA = causticCanvasTex();
    const causticB = causticA.clone();
    causticB.needsUpdate = true;
    const waveNormal = canvasTex(
      'wave',
      128,
      128,
      (g, w, h) => {
        const waves = [];
        for (let i = 0; i < 9; i++) waves.push([1 + Math.floor(rand() * 4), Math.floor(rand() * 7) - 3, rand() * 6.28, 0.5 + rand()]);
        const hgt = (x, y) => waves.reduce((s, [a, b, ph, amp]) => s + amp * Math.sin(2 * Math.PI * (a * x + b * y) + ph), 0);
        const img = g.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dx = hgt((x + 1) / w, y / h) - hgt((x - 1) / w, y / h);
            const dy = hgt(x / w, (y + 1) / h) - hgt(x / w, (y - 1) / h);
            const nx = -dx * 0.16;
            const ny = -dy * 0.16;
            const l = Math.hypot(nx, ny, 1);
            const i = (y * w + x) * 4;
            img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
            img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
            img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
      },
      false
    );
    const sheetTex = canvasTex('sheet', 64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = rand() * w;
        const a = 0.25 + rand() * 0.5;
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, `rgba(255,255,255,${a})`);
        gr.addColorStop(0.5, `rgba(220,245,255,${a * 0.6})`);
        gr.addColorStop(1, `rgba(255,255,255,${a})`);
        g.fillStyle = gr;
        g.fillRect(x, 0, 1 + rand() * 2.5, h);
      }
    });
    const slatTex = canvasTex('slats', 64, 64, (g, w, h) => {
      g.fillStyle = '#e8eef1';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) {
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(0, y, w, 1);
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(0, y + 1, w, 1);
      }
    });
    const bubbleCoverTex = canvasTex('bubble', 64, 64, (g, w, h) => {
      g.fillStyle = '#2f7fb7';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.arc(x + 4, y + 4, 2.6, 0, Math.PI * 2);
        g.fill();
      }
    });
    const puffTex = canvasTex(
      'puff',
      64,
      64,
      (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)');
        gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      },
      false
    );
    const flameTex = canvasTex(
      'flame',
      64,
      128,
      (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.55);
        gr.addColorStop(0, 'rgba(255,250,210,1)');
        gr.addColorStop(0.25, 'rgba(255,200,90,0.95)');
        gr.addColorStop(0.6, 'rgba(255,110,30,0.55)');
        gr.addColorStop(1, 'rgba(255,60,10,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(w / 2, 0);
        g.bezierCurveTo(w * 0.95, h * 0.45, w, h * 0.8, w / 2, h);
        g.bezierCurveTo(0, h * 0.8, w * 0.05, h * 0.45, w / 2, 0);
        g.fill();
      },
      false
    );
    const soilTex = canvasTex('soil', 128, 128, (g, w, h) => {
      g.fillStyle = '#8a6a4a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${rand() > 0.5 ? '255,240,220' : '40,25,12'},${0.06 + rand() * 0.12})`;
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
      }
    });

    /* ---------- Materiały ---------- */
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const M = {
      white: std({ color: '#f3f5f6', roughness: 0.5 }),
      steel: std({ color: '#d3dbe0', roughness: 0.3, metalness: 0.75 }),
      alu: std({ color: '#c9cfd3', roughness: 0.4, metalness: 0.6 }),
      dark: std({ color: '#2a2e33', roughness: 0.55, metalness: 0.3 }),
      black: std({ color: '#141618', roughness: 0.5 }),
      cushion: std({ color: '#f4f1ea', roughness: 0.9 }),
      fabric: std({ color: '#e9e4d9', roughness: 0.95, side: THREE.DoubleSide }),
      wood: std({ color: '#9b6c48', roughness: 0.75 }),
      grass: std({ map: grassTex, roughness: 1 }),
      hedge: std({ color: '#466f3e', roughness: 1, flatShading: true }),
      leaf: std({ color: '#7fa957', roughness: 1, flatShading: true }),
      leafDark: std({ color: '#3d6a3a', roughness: 1, flatShading: true }),
      trunk: std({ color: '#6b4d35', roughness: 1 }),
      pot: std({ color: '#3b4045', roughness: 0.7 }),
      gravel: std({ color: '#cfcac0', roughness: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#cfe3ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide }),
      poly: new THREE.MeshPhysicalMaterial({ color: '#cfe9f5', roughness: 0.22, metalness: 0, transparent: true, opacity: 0.45, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }),
      grate: std({ map: grateTex, roughness: 0.5, side: THREE.DoubleSide }),
      soil: std({ map: soilTex, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
      concrete: std({ color: '#cfd4d7', roughness: 0.92 }),
      pipe: std({ color: '#dfe7ec', roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }),
      pipeSolid: std({ color: '#8f9aa3', roughness: 0.5 }),
      filter: std({ color: '#35576d', roughness: 0.35, metalness: 0.2 }),
      pump: std({ color: '#2f6fa8', roughness: 0.4, metalness: 0.2 }),
      prominent: std({ color: '#1e66c8', roughness: 0.4 }),
      uvGlow: new THREE.MeshBasicMaterial({ color: '#b48cff', transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
      screen: std({ color: '#0b2233', emissive: '#2fd2ff', emissiveIntensity: 1.2 }),
      led: new THREE.MeshBasicMaterial({ color: '#2fd27c', toneMapped: false }),
      lampDisc: std({ color: '#ffffff', emissive: '#eaf3ff', emissiveIntensity: 0, roughness: 0.2 }),
      bollard: std({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 0, roughness: 0.4 }),
      sheet: new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
      bubble: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }),
      laminar: new THREE.MeshBasicMaterial({ color: '#dff7ff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
      spaWater: std({ color: '#52c6e6', emissive: '#1fb4e8', emissiveIntensity: 0.15, roughness: 0.05, transparent: true, opacity: 0.85 }),
      warmGlow: new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false }),
      particle: new THREE.MeshBasicMaterial({ toneMapped: false }),
    };
    const surfaceMat = std({ color: '#7fd3f3', transparent: true, opacity: 0.55, roughness: 0.06, metalness: 0, normalMap: waveNormal, envMapIntensity: 0.7, depthWrite: false, emissive: '#2bc6ff', emissiveIntensity: 0, side: THREE.DoubleSide });
    surfaceMat.normalScale.set(0.55, 0.55);
    const causticMatA = new THREE.MeshBasicMaterial({ map: causticA, color: '#ffffff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    const causticMatB = new THREE.MeshBasicMaterial({ map: causticB, color: '#c9f1ff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    const basinMat = std({ roughness: 0.35, vertexColors: true, side: THREE.DoubleSide });
    const copingMat = std({ roughness: 0.8, side: THREE.DoubleSide });
    const deckMat = std({ roughness: 0.85 });
    const wallMat = std({ roughness: 0.8 });
    const flameMat = new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const steamMat = new THREE.SpriteMaterial({ map: puffTex, color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false });
    const coverClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const coverMat = std({ map: slatTex, roughness: 0.5, clippingPlanes: [coverClip], side: THREE.DoubleSide });

    /* ---------- Pomocnicze ---------- */
    const G = (parent) => {
      const g = new THREE.Group();
      if (parent) parent.add(g);
      return g;
    };
    const mesh = (geo, mat, cast = true, recv = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast;
      m.receiveShadow = recv;
      return m;
    };
    const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
      const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return m;
    };
    const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) => {
      const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z);
      return m;
    };
    const disposeTree = (obj) => {
      obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    };
    const clear = (g) => {
      [...g.children].forEach((c) => {
        disposeTree(c);
        g.remove(c);
      });
    };
    // Kształt (x,z) jako płaska siatka na wysokości y(x,z)
    const flatShape = (pts, holes, yFn, uvScale = 1) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
      (holes || []).forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z)))));
      const geo = new THREE.ShapeGeometry(shape, 24);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getY(i);
        pos.setXYZ(i, x, yFn(x, z), z);
        uv.setXY(i, x / uvScale, z / uvScale);
      }
      // twarze ku górze
      const idx = geo.index;
      const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(0));
      const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(1));
      const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(2));
      const n = b.sub(a).cross(c.sub(a));
      if (n.y < 0) {
        for (let i = 0; i < idx.count; i += 3) {
          const t = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, t);
        }
      }
      geo.computeVertexNormals();
      return geo;
    };
    // Płaska bryła z otworami (taras, obrzeże) — grubość w dół od y
    const slab = (pts, holes, y, thick, uvScale) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      (holes || []).forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 16 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y - thick, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / uvScale, uv.getY(i) / uvScale);
      return geo;
    };
    // Pas wzdłuż obwodu (obrzeże, kratka rynny) między dwoma obrysami
    const ring = (inner, outer, y, skipEdge, uvScale = 0.6) => {
      const pos = [];
      const uvs = [];
      let u = 0;
      for (let i = 0; i < inner.length; i++) {
        const j = (i + 1) % inner.length;
        const len = Math.hypot(inner[j][0] - inner[i][0], inner[j][1] - inner[i][1]);
        if (!skipEdge || !skipEdge(i)) {
          const q = [inner[i], inner[j], outer[j], outer[i]];
          const t = [[0, 1, 2], [0, 2, 3]];
          t.forEach((tri) =>
            tri.forEach((k) => {
              pos.push(q[k][0], y, q[k][1]);
              uvs.push((u + (k === 1 || k === 2 ? len : 0)) / uvScale, k >= 2 ? 1 : 0);
            })
          );
        }
        u += len;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      // normalne zawsze w górę
      const n = geo.attributes.normal;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      return geo;
    };

    /* ---------- Sceny ---------- */
    const world = G(scene);
    const poolG = G(world);
    const deckG = G(world);
    const envG = G(world);
    const propsG = G(world);
    const hallG = G(world);
    const coverG = G(world);
    const encG = G(world);
    const techG = G(world);
    const fxG = G(world);
    let ext = { minX: -10, maxX: 10, minZ: -8, maxZ: 8, cx: 0, cz: 0, size: 20 };
    let P = null; // bieżący model basenu
    const anim = { bubbles: [], sheets: [], flames: [], fans: [], laminar: [], steam: [], spaBubbles: [], encSegs: [], encOpen: state.encOpen, coverAmt: state.coverAmt, particles: null };
    const tags = [];

    // Woda: kolor zależy od niecki (jasna niecka = turkus, ciemna = głęboki granat)
    const waterTint = () => {
      const hex = (COLORS[state.finish].find((c) => c[0] === state.color) || COLORS[state.finish][0])[2];
      const c = new THREE.Color(hex);
      const hsl = {};
      c.getHSL(hsl);
      const lum = hsl.l;
      const deep = new THREE.Color('#0f4d66');
      const bright = new THREE.Color('#4fd0ee');
      const out = deep.clone().lerp(bright, clamp(lum * 1.15, 0, 1));
      if (state.finish === 'mosaic' && state.color === 'szmaragd') out.lerp(new THREE.Color('#2fb39a'), 0.4);
      if (state.color === 'piasek' || state.color === 'piaskowa' || state.color === 'bez') out.lerp(new THREE.Color('#5fd6d0'), 0.35);
      return out;
    };

    /* ---------- Basen ---------- */
    const buildPool = () => {
      clear(poolG);
      clear(fxG);
      anim.bubbles = [];
      anim.sheets = [];
      anim.laminar = [];
      const s = state;
      const pm = poolModel(s);
      const { pts, b, depthAt } = pm;
      const waterY = s.edge === 'skimmer' ? -0.13 : -0.02;
      const cw = 0.4; // szerokość obrzeża
      const gutter = s.edge === 'overflow' ? 0.22 : 0;
      const infEdge = (i) => {
        if (s.edge !== 'infinity') return false;
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[(i + 1) % pts.length];
        return Math.abs(z1 - b.minZ) < 0.02 && Math.abs(z2 - b.minZ) < 0.02 && Math.abs(x2 - x1) > 0.5;
      };
      const finHex = (COLORS[s.finish].find((c) => c[0] === s.color) || COLORS[s.finish][0])[2];
      const tile = FINISH[s.finish].tile;
      basinMat.map = finishTex(s.finish, finHex);
      basinMat.metalness = s.finish === 'steel' ? 0.65 : 0.02;
      basinMat.roughness = s.finish === 'steel' ? 0.3 : s.finish === 'mosaic' ? 0.25 : 0.4;
      basinMat.needsUpdate = true;
      const tint = waterTint();

      // ściany (pas wzdłuż obwodu od y=0 w dół do dna)
      const wp = [];
      const wuv = [];
      const wcol = [];
      const wn = [];
      let u = 0;
      const colAt = (y) => {
        const k = clamp(0.25 + -y / 2.0, 0, 1) * 0.72;
        return [lerp(1, tint.r, k), lerp(1, tint.g, k), lerp(1, tint.b, k)];
      };
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[j];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const nx = -(z2 - z1) / (len || 1);
        const nz = (x2 - x1) / (len || 1);
        const top = infEdge(i) ? waterY : 0;
        const y1 = -depthAt(x1);
        const y2 = -depthAt(x2);
        const quad = [[x1, top, z1, u, top], [x2, top, z2, u + len, top], [x2, y2, z2, u + len, y2], [x1, y1, z1, u, y1]];
        [[0, 2, 1], [0, 3, 2]].forEach((tri) =>
          tri.forEach((k) => {
            const [x, y, z, uu, vv] = quad[k];
            wp.push(x, y, z);
            wuv.push(uu / tile, vv / tile);
            wcol.push(...colAt(y));
            wn.push(nx, 0, nz);
          })
        );
        u += len;
      }
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
      wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
      wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
      poolG.add(mesh(wallGeo, basinMat, false, true));

      // dno
      const floorGeo = flatShape(pts, null, (x) => -depthAt(x), tile);
      const fc = [];
      const fpos = floorGeo.attributes.position;
      for (let i = 0; i < fpos.count; i++) fc.push(...colAt(fpos.getY(i)));
      floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      poolG.add(mesh(floorGeo, basinMat, false, true));

      // kaustyki na dnie
      const cA = mesh(flatShape(pts, null, (x) => -depthAt(x) + 0.012, 1.3), causticMatA, false, false);
      const cB = mesh(flatShape(pts, null, (x) => -depthAt(x) + 0.016, 1.9), causticMatB, false, false);
      cA.renderOrder = cB.renderOrder = 2;
      poolG.add(cA, cB);

      // tafla
      const surf = mesh(flatShape(pts, null, () => waterY, 3), surfaceMat, false, false);
      surf.renderOrder = 6;
      poolG.add(surf);
      surfaceMat.color.copy(tint);

      // rynna przelewowa (kratka) i obrzeże
      const inner = gutter ? offsetPoly(pts, () => gutter) : pts;
      if (gutter) poolG.add(mesh(ring(pts, inner, -0.01, null, 0.08), M.grate, false, true));
      const outer = offsetPoly(pts, () => gutter + cw);
      const copHex = swHex(COPING, s.coping);
      copingMat.map = stoneTex(s.coping === 'drewno' ? 'drewno' : s.coping, copHex);
      copingMat.needsUpdate = true;
      const cop = mesh(ring(inner, outer, 0.035, infEdge, 0.6), copingMat, true, true);
      poolG.add(cop);
      // krawędź obrzeża (front pasa)
      const edgeH = [];
      for (let i = 0; i < outer.length; i++) {
        if (infEdge(i)) continue;
        const j = (i + 1) % outer.length;
        const q = [[outer[i][0], 0.035, outer[i][1]], [outer[j][0], 0.035, outer[j][1]], [outer[j][0], 0, outer[j][1]], [outer[i][0], 0, outer[i][1]]];
        [[0, 1, 2], [0, 2, 3]].forEach((t) => t.forEach((k) => edgeH.push(...q[k])));
      }
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(edgeH, 3));
      eg.computeVertexNormals();
      poolG.add(mesh(eg, copingMat, false, true));

      // infinity: niecka przelewowa i spadająca woda
      if (s.edge === 'infinity') {
        const x0 = b.minX + 0.05;
        const x1 = b.maxX - 0.05;
        const len = x1 - x0;
        const trough = box(len, 0.55, 0.7, M.dark, (x0 + x1) / 2, -0.4, b.minZ - 0.38);
        poolG.add(trough);
        const tw = mesh(new THREE.PlaneGeometry(len, 0.6), surfaceMat, false, false);
        tw.rotation.x = -Math.PI / 2;
        tw.position.set((x0 + x1) / 2, -0.24, b.minZ - 0.38);
        poolG.add(tw);
        const sheet = mesh(new THREE.PlaneGeometry(len, 0.24), M.sheet, false, false);
        sheet.position.set((x0 + x1) / 2, -0.13, b.minZ - 0.025);
        poolG.add(sheet);
        anim.sheets.push({ tex: sheet.material.map, speed: 1.2 });
      }

      // schody / plaża / ławka
      const zMid = (x) => {
        // środek szerokości basenu przy danym x
        let lo = Infinity;
        let hi = -Infinity;
        for (let z = b.minZ; z <= b.maxZ; z += 0.05) if (pointIn(pts, x, z)) {
          lo = Math.min(lo, z);
          hi = Math.max(hi, z);
        }
        return lo < hi ? [lo, hi] : [b.minZ, b.maxZ];
      };
      const stepMat = basinMat;
      let entryX = b.minX;
      let entryTop = 0;
      if (s.beach) {
        const bl = Math.min(2.2, (b.maxX - b.minX) * 0.28);
        const [lo, hi] = zMid(b.minX + bl / 2);
        const h = depthAt(b.minX) - 0.28;
        poolG.add(box(bl, h, hi - lo - 0.02, stepMat, b.minX + bl / 2, -depthAt(b.minX) + h / 2, (lo + hi) / 2));
        entryX = b.minX + bl;
        entryTop = -0.28;
      }
      const stepDepth = depthAt(entryX);
      const nSteps = 3;
      const rise = (stepDepth + entryTop) / (nSteps + 1);
      if (s.steps === 'roman') {
        const [lo, hi] = zMid(entryX + 0.4);
        const R = Math.min(1.25, (hi - lo) / 2 - 0.05);
        for (let k = 0; k < nSteps; k++) {
          const r = R * (0.46 + k * 0.27);
          const topY = entryTop - rise * (k + 1);
          const h = topY + stepDepth;
          const g = new THREE.CylinderGeometry(r, r, h, 40, 1, false, 0, Math.PI);
          const m = mesh(g, stepMat, false, true);
          m.position.set(entryX, -stepDepth + h / 2, (lo + hi) / 2);
          poolG.add(m);
        }
      } else if (s.steps === 'corner') {
        const [lo] = zMid(entryX + 0.3);
        for (let k = 0; k < nSteps; k++) {
          const a = 0.52 + k * 0.4;
          const topY = entryTop - rise * (k + 1);
          const h = topY + stepDepth;
          poolG.add(box(a, h, a, stepMat, entryX + a / 2, -stepDepth + h / 2, lo + a / 2));
        }
      } else if (s.steps === 'full') {
        const [lo, hi] = zMid(entryX + 0.6);
        for (let k = 0; k < nSteps; k++) {
          const dx = 0.38 * (k + 1);
          const topY = entryTop - rise * (k + 1);
          const h = topY + stepDepth;
          poolG.add(box(dx, h, hi - lo - 0.02, stepMat, entryX + dx / 2, -stepDepth + h / 2, (lo + hi) / 2));
        }
      } else {
        const lad = G(poolG);
        [-0.25, 0.25].forEach((dz) => {
          const arc = mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 20, Math.PI), M.steel);
          arc.rotation.y = Math.PI / 2;
          arc.position.set(0, 0.6, dz);
          lad.add(arc, cyl(0.022, 0.022, 0.95, M.steel, 0.28, 0.15, dz, 8), cyl(0.022, 0.022, 1.1, M.steel, -0.28, 0.05, dz, 8));
        });
        lad.position.set(b.maxX - 1.2, 0, b.minZ + 0.02);
        lad.rotation.y = -Math.PI / 2;
      }
      if (s.bench) {
        const bx0 = lerp(b.minX, b.maxX, 0.35);
        const bx1 = lerp(b.minX, b.maxX, 0.78);
        const [lo] = zMid((bx0 + bx1) / 2);
        const by = -0.55;
        const h = depthAt((bx0 + bx1) / 2) + by;
        poolG.add(box(bx1 - bx0, h, 0.45, stepMat, (bx0 + bx1) / 2, -depthAt((bx0 + bx1) / 2) + h / 2, lo + 0.23));
        if (s.jets) {
          const n = 14;
          const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, n * 6);
          bub.frustumCulled = false;
          bub.renderOrder = 8;
          fxG.add(bub);
          anim.bubbles.push({ mesh: bub, n: n * 6, src: (k) => [lerp(bx0 + 0.2, bx1 - 0.2, (k % n) / (n - 1)), by - 0.15, lo + 0.05], dir: [0, 1, 0.6], len: 0.5, rate: 0.9, size: 0.025, top: waterY });
        }
      }

      // lampy LED na ścianach
      const lampPos = [];
      const per = pm.per;
      const n = state.lamps;
      let acc = 0;
      let k = 0;
      const targets = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * per);
      for (let i = 0; i < pts.length && k < n; i++) {
        const j = (i + 1) % pts.length;
        const len = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
        while (k < n && targets[k] <= acc + len) {
          const t = (targets[k] - acc) / len;
          const x = lerp(pts[i][0], pts[j][0], t);
          const z = lerp(pts[i][1], pts[j][1], t);
          const nx = -(pts[j][1] - pts[i][1]) / len;
          const nz = (pts[j][0] - pts[i][0]) / len;
          lampPos.push([x + nx * 0.01, z + nz * 0.01, nx, nz]);
          k++;
        }
        acc += len;
      }
      lampPos.forEach(([x, z, nx, nz]) => {
        const disc = mesh(new THREE.CircleGeometry(0.12, 24), M.lampDisc, false, false);
        disc.position.set(x, Math.max(-0.45, -depthAt(x) + 0.3), z);
        disc.lookAt(x + nx, disc.position.y, z + nz);
        poolG.add(disc);
      });
      poolLights[0].position.set(lerp(b.minX, b.maxX, 0.3), -0.7, (b.minZ + b.maxZ) / 2);
      poolLights[1].position.set(lerp(b.minX, b.maxX, 0.7), -0.7, (b.minZ + b.maxZ) / 2);
      poolLights.forEach((l) => (l.distance = Math.max(b.maxX - b.minX, 6)));

      // atrakcje
      const midZ = (b.minZ + b.maxZ) / 2;
      if (s.counter) {
        const [lo, hi] = zMid(b.maxX - 0.3);
        const cz = (lo + hi) / 2;
        const plate = box(0.04, 0.38, 0.6, M.steel, b.maxX - 0.03, -0.42, cz);
        poolG.add(plate);
        const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, 80);
        bub.frustumCulled = false;
        bub.renderOrder = 8;
        fxG.add(bub);
        anim.bubbles.push({ mesh: bub, n: 80, src: (i) => [b.maxX - 0.1, -0.42, cz + (hash(i) - 0.5) * 0.3], dir: [-1, 0.25, 0], len: Math.min(3.2, (b.maxX - b.minX) * 0.45), rate: 0.35, size: 0.03, top: waterY, spread: 0.6 });
      }
      if (s.cascade) {
        const [lo] = zMid(lerp(b.minX, b.maxX, 0.6));
        const cx = lerp(b.minX, b.maxX, 0.6);
        const cz = lo - gutter - cw * 0.5;
        const post = G(poolG);
        post.add(box(0.55, 1.15, 0.16, M.steel, 0, 0.58, -0.08), box(0.55, 0.05, 0.55, M.steel, 0, 1.15, 0.18));
        post.position.set(cx, 0, cz);
        const sh = mesh(new THREE.PlaneGeometry(0.46, 1.2), M.sheet.clone(), false, false);
        sh.material.map = sheetTex;
        sh.position.set(cx, 0.55, lo + 0.25 - gutter * 0.3);
        sh.rotation.x = 0.18;
        poolG.add(sh);
        anim.sheets.push({ tex: sheetTex, speed: 1.6 });
      }
      if (s.laminar) {
        const xs = [lerp(b.minX, b.maxX, 0.32), lerp(b.minX, b.maxX, 0.68)];
        const zs = b.maxZ + gutter + cw * 0.5;
        xs.forEach((x0, i) => {
          const end = new THREE.Vector3(x0 + (i ? -1.2 : 1.2), waterY, midZ + (b.maxZ - midZ) * 0.2);
          const start = new THREE.Vector3(x0, 0.08, zs);
          const mid = start.clone().lerp(end, 0.5);
          mid.y = 1.4;
          const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
          const tube = mesh(new THREE.TubeGeometry(curve, 40, 0.022, 8, false), M.laminar, false, false);
          poolG.add(tube, cyl(0.06, 0.06, 0.08, M.steel, x0, 0.04, zs, 12));
          anim.laminar.push(tube);
        });
      }
      if (s.geyser) {
        const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, 90);
        bub.frustumCulled = false;
        bub.renderOrder = 8;
        fxG.add(bub);
        const gx = lerp(b.minX, b.maxX, 0.55);
        anim.bubbles.push({ mesh: bub, n: 90, src: (i) => [gx + (hash(i) - 0.5) * 0.8, -depthAt(gx) + 0.05, midZ + (hash(i + 99) - 0.5) * 0.8], dir: [0, 1, 0], len: depthAt(gx), rate: 0.5, size: 0.028, top: waterY, spread: 0.2 });
      }

      P = { pts, b, pm, depthAt, waterY, outer, inner, cw, gutter, infEdge };
    };

    const swHex = (list, v) => (list.find((x) => x[0] === v) || list[0])[2];
    const hash = (i) => {
      const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
      return x - Math.floor(x);
    };

    /* ---------- Taras / posadzka hali ---------- */
    const buildDeck = () => {
      clear(deckG);
      const s = state;
      const { b, outer } = P;
      const dw = s.deckW;
      const out = s.loc === 'out';
      const backExtra = s.loungers > 0 ? 1.7 : 0.4;
      const infBack = s.edge === 'infinity';
      let minX = b.minX - P.gutter - P.cw - dw - (out && s.pergola ? 3.6 : 0);
      let maxX = b.maxX + P.gutter + P.cw + dw + (out && s.spa ? 2.8 : 0);
      let minZ = b.minZ - P.gutter - P.cw - dw - (infBack ? 0 : backExtra);
      let maxZ = b.maxZ + P.gutter + P.cw + dw + (infBack ? backExtra : 0);
      if (!out) {
        minX -= (s.inSauna || s.inSteam ? 2.6 : 0.6);
        maxX += s.inSpa ? 2.6 : 0.6;
        minZ -= 0.4;
        maxZ += 0.6;
      }
      // otwór: obrys obrzeża + przelew infinity
      let hole = outer;
      if (infBack) hole = offsetPoly(P.pts, (i) => (P.infEdge(i) ? 0.75 : P.gutter + P.cw));
      const rect = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
      const kind = out ? s.deck : s.hallFloor;
      const hex = out ? swHex(DECKS, s.deck) : swHex(HALL_FLOORS, s.hallFloor);
      const tile = kind === 'beton' || kind === 'gres' ? 2 : kind === 'trawertyn' || kind === 'kamien' ? 1.2 : 1.4;
      deckMat.map = stoneTex(kind, hex);
      deckMat.needsUpdate = true;
      const d = mesh(slab(rect, [hole], 0, 0.14, tile), deckMat, false, true);
      deckG.add(d);
      ext = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, (maxZ - minZ) * 1.2) };
    };

    /* ---------- Ogród ---------- */
    const lounger = () => {
      const g = new THREE.Group();
      g.add(box(0.7, 0.07, 1.95, M.dark, 0, 0.3, 0), box(0.64, 0.08, 1.35, M.cushion, 0, 0.38, 0.27));
      const back = box(0.64, 0.08, 0.62, M.cushion, 0, 0.58, -0.62);
      back.rotation.x = -0.7;
      g.add(back);
      [-0.28, 0.28].forEach((x) => [-0.82, 0.82].forEach((z) => g.add(box(0.04, 0.3, 0.04, M.dark, x, 0.15, z))));
      return g;
    };
    const tree = (sc, kind) => {
      const g = new THREE.Group();
      if (kind === 'thuja') {
        g.add(cyl(0.08, 0.12, 0.6, M.trunk, 0, 0.3, 0, 8));
        const c = mesh(new THREE.ConeGeometry(0.75 * sc, 3.6 * sc, 9), M.leafDark);
        c.position.y = 2.1 * sc;
        g.add(c);
      } else {
        g.add(cyl(0.1 * sc, 0.16 * sc, 2.6 * sc, M.trunk, 0, 1.3 * sc, 0, 8));
        [[0, 3.1, 0, 1.3], [0.7, 2.6, 0.3, 0.95], [-0.6, 2.5, -0.25, 0.9], [0.1, 3.75, -0.2, 0.85]].forEach(([x, y, z, r]) => {
          const c = mesh(new THREE.IcosahedronGeometry(r * sc, 1), M.leaf);
          c.position.set(x * sc, y * sc, z * sc);
          g.add(c);
        });
      }
      return g;
    };
    const buildEnv = () => {
      clear(envG);
      clear(propsG);
      clear(hallG);
      anim.flames = [];
      anim.steam = [];
      anim.spaBubbles = [];
      const s = state;
      const out = s.loc === 'out';
      // trawa (także za halą)
      const lawn = mesh(new THREE.PlaneGeometry(160, 160), M.grass, false, true);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(ext.cx, -0.141, ext.cz);
      envG.add(lawn);
      envG.userData.lawn = lawn;
      const { minX, maxX, minZ, maxZ } = ext;
      const backZ = minZ - (out ? 1.6 : 3.2);
      // żywopłot
      if (!out || s.hedge) {
        const len = maxX - minX + 6;
        const n = Math.round(len / 0.9);
        const hg = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 1), M.hedge, n * 2);
        hg.castShadow = hg.receiveShadow = true;
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const col = new THREE.Color();
        for (let i = 0; i < n * 2; i++) {
          const row = i % 2;
          const x = minX - 3 + ((Math.floor(i / 2) + 0.5) / n) * len;
          q.setFromEuler(new THREE.Euler(rand(), rand() * 3, rand()));
          m4.compose(new THREE.Vector3(x, 0.8 + row * 0.6, backZ - row * 0.15), q, new THREE.Vector3(1.05 + rand() * 0.2, 1.25 + rand() * 0.25, 0.9));
          hg.setMatrixAt(i, m4);
          col.set('#466f3e').offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
          hg.setColorAt(i, col);
        }
        envG.add(hg);
      }
      // drzewa
      const spots = [[minX - 2.4, backZ + 0.8, 'tree'], [maxX + 2.6, backZ + 1.2, 'thuja'], [minX - 3, maxZ + 1.5, 'thuja'], [maxX + 3.2, maxZ + 2, 'tree']];
      const nTrees = out ? s.trees : 3;
      spots.slice(0, nTrees).forEach(([x, z, k], i) => {
        const t = tree(i % 2 ? 0.9 : 1.05, k);
        t.position.set(x, -0.14, z);
        t.traverse((o) => {
          if (o.isMesh) o.castShadow = o.receiveShadow = true;
        });
        envG.add(t);
      });

      const placeLoungers = (zRow, facing, xFrom, xTo, n, parent) => {
        for (let i = 0; i < n; i++) {
          const l = lounger();
          const x = n === 1 ? (xFrom + xTo) / 2 : lerp(xFrom, xTo, i / (n - 1));
          l.position.set(x, 0, zRow);
          l.rotation.y = facing;
          l.traverse((o) => {
            if (o.isMesh) o.castShadow = o.receiveShadow = true;
          });
          parent.add(l);
        }
      };
      const { b } = P;
      const span = Math.min(b.maxX - b.minX, s.loungers * 1.1);
      const inf = s.edge === 'infinity';
      if (out) {
        const zRow = inf ? b.maxZ + P.gutter + P.cw + s.deckW + 0.95 : b.minZ - P.gutter - P.cw - s.deckW - 0.95;
        placeLoungers(zRow, inf ? Math.PI : 0, (b.minX + b.maxX) / 2 - span / 2 + 0.5, (b.minX + b.maxX) / 2 + span / 2 - 0.5, s.loungers, propsG);
        if (s.umbrella) {
          const ux = (b.minX + b.maxX) / 2 + span / 2 + 0.4;
          const u = G(propsG);
          u.add(cyl(0.035, 0.035, 2.4, M.dark, 0, 1.2, 0, 8), cyl(0.3, 0.3, 0.05, M.dark, 0, 0.03, 0, 16));
          const canopy = mesh(new THREE.ConeGeometry(1.5, 0.42, 8, 1, true), M.fabric);
          canopy.position.y = 2.38;
          u.add(canopy);
          u.position.set(ux, 0, zRow);
        }
        if (s.grasses) {
          [[minX + 0.5, minZ + 0.5], [maxX - 0.5, minZ + 0.5], [minX + 0.5, maxZ - 0.5], [maxX - 0.5, maxZ - 0.5]].forEach(([x, z]) => {
            const g = G(propsG);
            g.add(cyl(0.32, 0.25, 0.55, M.pot, 0, 0.27, 0, 16));
            for (let i = 0; i < 16; i++) {
              const blade = mesh(new THREE.ConeGeometry(0.035, 0.9 + rand() * 0.4, 4), M.leaf);
              blade.position.set((rand() - 0.5) * 0.35, 0.95, (rand() - 0.5) * 0.35);
              blade.rotation.set((rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6);
              g.add(blade);
            }
            g.position.set(x, 0, z);
          });
        }
        if (s.pergola) {
          const px = b.minX - P.gutter - P.cw - s.deckW - 1.8;
          const pz = (b.minZ + b.maxZ) / 2;
          const pg = G(propsG);
          [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([x, z]) => pg.add(box(0.14, 2.6, 0.14, M.dark, x, 1.3, z)));
          pg.add(box(3.5, 0.12, 0.14, M.dark, 0, 2.6, -1.6), box(3.5, 0.12, 0.14, M.dark, 0, 2.6, 1.6));
          for (let i = 0; i < 14; i++) pg.add(box(0.06, 0.1, 3.4, M.wood, -1.6 + (i / 13) * 3.2, 2.7, 0));
          pg.add(box(2.6, 0.4, 0.85, M.cushion, -0.2, 0.2, -1.05), box(0.85, 0.4, 1.6, M.cushion, -1.1, 0.2, 0.0), box(2.6, 0.4, 0.15, M.cushion, -0.2, 0.55, -1.45), box(0.9, 0.35, 0.9, M.wood, 0.4, 0.17, 0.2));
          const strip = box(3.2, 0.03, 0.03, M.warmGlow, 0, 2.55, 0);
          pg.add(strip);
          pg.userData.glow = strip;
          pg.traverse((o) => {
            if (o.isMesh) o.castShadow = o.receiveShadow = true;
          });
          pg.position.set(px, 0, pz);
        }
        if (s.spa) {
          const sx = b.maxX + P.gutter + P.cw + s.deckW + 1.4;
          const sz = (b.minZ + b.maxZ) / 2 - 0.4;
          const sp = G(propsG);
          sp.add(box(2.2, 0.9, 2.2, M.dark, 0, 0.45, 0), box(2.24, 0.08, 2.24, M.white, 0, 0.92, 0));
          const w = box(1.8, 0.05, 1.8, M.spaWater, 0, 0.86, 0);
          sp.add(w);
          sp.position.set(sx, 0, sz);
          sp.traverse((o) => {
            if (o.isMesh && o !== w) o.castShadow = o.receiveShadow = true;
          });
          anim.steam.push({ x: sx, y: 0.95, z: sz, spread: 1.4, sprites: [] });
          const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, 40);
          bub.frustumCulled = false;
          fxG.add(bub);
          anim.bubbles.push({ mesh: bub, n: 40, src: (i) => [sx + (hash(i) - 0.5) * 1.6, 0.6, sz + (hash(i + 50) - 0.5) * 1.6], dir: [0, 1, 0], len: 0.28, rate: 0.9, size: 0.02, top: 0.88 });
        }
        if (s.sauna) {
          const sx = maxX + 3.2;
          const sz = minZ + 1.8;
          const sa = G(propsG);
          for (let i = 0; i < 18; i++) sa.add(box(0.13, 2.2, 0.05, M.wood, -1.1 + i * 0.125 + 0.06, 1.25, -1.0));
          sa.add(box(0.05, 2.2, 2.0, M.wood, -1.1, 1.25, 0), box(0.05, 2.2, 2.0, M.wood, 1.1, 1.25, 0), box(2.6, 0.16, 2.5, M.dark, 0, 2.43, 0.15), box(2.3, 0.15, 2.1, M.dark, 0, 0.07, 0));
          const gl = mesh(new THREE.PlaneGeometry(2.1, 2.1), M.glass, false, false);
          gl.position.set(0, 1.25, 1.0);
          sa.add(gl, box(2.0, 0.05, 0.5, M.wood, 0, 1.05, -0.7), box(2.0, 0.02, 0.02, M.warmGlow, 0, 1.02, -0.46), box(0.45, 0.6, 0.35, M.dark, -0.7, 0.45, 0.6));
          sa.traverse((o) => {
            if (o.isMesh && o !== gl) o.castShadow = o.receiveShadow = true;
          });
          sa.position.set(sx, 0, sz);
          sa.rotation.y = -0.35;
        }
        if (s.shower) {
          const sh = G(propsG);
          sh.add(cyl(0.035, 0.035, 2.3, M.steel, 0, 1.15, 0, 10), box(0.4, 0.03, 0.06, M.steel, 0.18, 2.28, 0), cyl(0.12, 0.12, 0.03, M.steel, 0.36, 2.25, 0, 16), box(0.7, 0.04, 0.7, M.dark, 0.2, 0.02, 0));
          sh.position.set(maxX - 0.7, 0, maxZ - 0.7);
        }
        if (s.firepit) {
          const fx = minX - 2.2;
          const fz = maxZ + 0.6;
          const fp = G(propsG);
          const gravel = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 32), M.gravel, false, true);
          gravel.position.y = -0.12;
          fp.add(gravel, cyl(0.55, 0.45, 0.32, M.dark, 0, 0.0, 0, 24));
          for (let i = 0; i < 5; i++) {
            const f = new THREE.Sprite(flameMat);
            f.userData.ph = i * 1.4;
            f.position.set((rand() - 0.5) * 0.4, 0.4, (rand() - 0.5) * 0.4);
            fp.add(f);
            anim.flames.push(f);
          }
          [0, 2.1, 4.2].forEach((a) => {
            const c = G(fp);
            c.add(box(0.6, 0.12, 0.6, M.cushion, 0, 0.36, 0), box(0.6, 0.55, 0.1, M.cushion, 0, 0.62, -0.28));
            [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([x, z]) => c.add(box(0.04, 0.36, 0.04, M.dark, x, 0.18, z)));
            c.position.set(Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25);
            c.rotation.y = a + Math.PI;
          });
          fp.position.set(fx, 0, fz);
          fireLight.position.set(fx, 0.9, fz);
        }
        if (s.fence) {
          const fz0 = minZ;
          const fz1 = maxZ;
          const panels = [];
          const addRun = (x0, z0, x1, z1) => {
            const len = Math.hypot(x1 - x0, z1 - z0);
            const n = Math.max(1, Math.round(len / 1.6));
            for (let i = 0; i < n; i++) {
              const t0 = i / n;
              const t1 = (i + 1) / n;
              const cx = lerp(x0, x1, (t0 + t1) / 2);
              const cz = lerp(z0, z1, (t0 + t1) / 2);
              if (Math.abs(cx - (minX + maxX) / 2) < 0.8 && Math.abs(cz - fz1) < 0.1) continue; // furtka
              const p = mesh(new THREE.PlaneGeometry(len / n - 0.05, 1.1), M.glass, false, false);
              p.position.set(cx, 0.6, cz);
              p.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
              panels.push(p, box(0.04, 1.15, 0.04, M.steel, lerp(x0, x1, t0), 0.58, lerp(z0, z1, t0)));
            }
          };
          addRun(minX, fz0, maxX, fz0);
          addRun(maxX, fz0, maxX, fz1);
          addRun(maxX, fz1, minX, fz1);
          addRun(minX, fz1, minX, fz0);
          panels.forEach((p) => propsG.add(p));
        }
        if (s.gardenLights) {
          [[minX + 0.25, maxZ - 0.25], [maxX - 0.25, maxZ - 0.25], [minX + 0.25, minZ + 0.25], [maxX - 0.25, minZ + 0.25], [(minX + maxX) / 2, maxZ - 0.25]].forEach(([x, z]) => {
            const bl = cyl(0.06, 0.06, 0.6, M.dark, x, 0.3, z, 10);
            bl.add(cyl(0.065, 0.065, 0.1, M.bollard, 0, 0.22, 0, 10));
            propsG.add(bl);
          });
        }
      } else {
        buildHall();
      }
    };
    const fireLight = new THREE.PointLight('#ff8a2a', 0, 8, 1.6);
    scene.add(fireLight);

    /* ---------- Hala basenowa ---------- */
    const buildHall = () => {
      const s = state;
      const { minX, maxX, minZ, maxZ } = ext;
      const H = 3.6;
      const wallHex = swHex(HALL_WALLS, s.hallWall);
      const wt = stoneTex(s.hallWall === 'drewno' ? 'drewno' : s.hallWall === 'beton' ? 'beton' : 'kamien', wallHex).clone();
      wt.needsUpdate = true;
      wt.repeat.set(6, 3);
      wt.userData.own = true;
      if (wallMat.map && wallMat.map.userData.own) wallMat.map.dispose();
      wallMat.map = wt;
      wallMat.needsUpdate = true;
      // lewa ściana i prawa ściana (pełne)
      const wl = box(0.2, H, maxZ - minZ, wallMat, minX - 0.1, H / 2 - 0.14, (minZ + maxZ) / 2);
      const wr = box(0.2, H, maxZ - minZ, wallMat, maxX + 0.1, H / 2 - 0.14, (minZ + maxZ) / 2);
      hallG.add(wl, wr);
      // tylna ściana: przeszklenie lub okna
      const backZ = minZ - 0.1;
      if (s.hallGlass === 'panorama') {
        const len = maxX - minX;
        const n = Math.round(len / 1.6);
        for (let i = 0; i <= n; i++) hallG.add(box(0.08, H, 0.12, M.dark, minX + (i / n) * len, H / 2 - 0.14, backZ));
        hallG.add(box(len, 0.12, 0.14, M.dark, (minX + maxX) / 2, H - 0.14, backZ), box(len, 0.08, 0.14, M.dark, (minX + maxX) / 2, 0, backZ));
        const gl = mesh(new THREE.PlaneGeometry(len, H), M.glass, false, false);
        gl.position.set((minX + maxX) / 2, H / 2 - 0.14, backZ);
        hallG.add(gl);
      } else {
        const len = maxX - minX;
        const wall = box(len, H, 0.2, wallMat, (minX + maxX) / 2, H / 2 - 0.14, backZ);
        hallG.add(wall);
        const n = Math.max(2, Math.round(len / 3));
        for (let i = 0; i < n; i++) {
          const x = minX + ((i + 0.5) / n) * len;
          const win = mesh(new THREE.PlaneGeometry(1.5, 2.0), M.glass, false, false);
          win.position.set(x, 1.6, backZ + 0.11);
          hallG.add(win, box(1.6, 0.08, 0.06, M.dark, x, 2.62, backZ + 0.12), box(1.6, 0.08, 0.06, M.dark, x, 0.58, backZ + 0.12));
        }
      }
      // kanały wentylacyjne pod sufitem (centrala basenowa)
      const duct = mesh(new THREE.CylinderGeometry(0.2, 0.2, maxX - minX - 0.6, 20), M.alu);
      duct.rotation.z = Math.PI / 2;
      duct.position.set((minX + maxX) / 2, H - 0.6, minZ + 0.5);
      hallG.add(duct);
      for (let i = 0; i < 5; i++) hallG.add(box(0.5, 0.08, 0.3, M.dark, lerp(minX + 1, maxX - 1, i / 4), H - 0.82, minZ + 0.5));
      // krawędź „przekroju” z przodu
      hallG.add(box(maxX - minX + 0.4, 0.3, 0.2, wallMat, (minX + maxX) / 2, 0.01, maxZ + 0.1));
      // wellness
      const { b } = P;
      if (s.inSauna) {
        const sa = G(hallG);
        sa.add(box(2.2, 2.4, 2.0, M.wood, 0, 1.06, 0));
        const gl = mesh(new THREE.PlaneGeometry(1.8, 2.1), M.glass, false, false);
        gl.position.set(1.105, 1.05, 0);
        gl.rotation.y = Math.PI / 2;
        sa.add(gl, box(0.02, 1.8, 0.02, M.warmGlow, 1.11, 1.0, 0.7));
        sa.position.set(minX + 1.2, 0, minZ + 1.5);
      }
      if (s.inSteam) {
        const st = G(hallG);
        st.add(box(2.0, 2.4, 1.8, std({ color: '#5aa6b8', roughness: 0.4 }), 0, 1.06, 0));
        const gl = mesh(new THREE.PlaneGeometry(1.5, 2.0), M.glass, false, false);
        gl.position.set(1.005, 1.0, 0);
        gl.rotation.y = Math.PI / 2;
        st.add(gl);
        st.position.set(minX + 1.1, 0, maxZ - 1.6);
        anim.steam.push({ x: minX + 2.2, y: 2.2, z: maxZ - 1.6, spread: 0.4, sprites: [], soft: true });
      }
      if (s.inSpa) {
        const sx = maxX - 1.5;
        const sz = minZ + 1.6;
        const sp = G(hallG);
        sp.add(box(2.2, 0.9, 2.2, M.white, 0, 0.45, 0));
        const w = box(1.8, 0.05, 1.8, M.spaWater, 0, 0.86, 0);
        sp.add(w);
        sp.position.set(sx, 0, sz);
        const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.bubble, 40);
        bub.frustumCulled = false;
        fxG.add(bub);
        anim.bubbles.push({ mesh: bub, n: 40, src: (i) => [sx + (hash(i) - 0.5) * 1.6, 0.6, sz + (hash(i + 50) - 0.5) * 1.6], dir: [0, 1, 0], len: 0.28, rate: 0.9, size: 0.02, top: 0.88 });
      }
      if (s.plants) {
        [[minX + 0.6, minZ + 0.6], [maxX - 0.6, minZ + 0.6], [(minX + maxX) / 2, minZ + 0.6]].forEach(([x, z], i) => {
          if (s.inSpa && i === 1) return;
          if (s.inSauna && i === 0) return;
          const pl = G(hallG);
          pl.add(cyl(0.35, 0.28, 0.7, M.pot, 0, 0.35, 0, 16), cyl(0.05, 0.07, 1.6, M.trunk, 0, 1.4, 0, 8));
          for (let k = 0; k < 7; k++) {
            const leaf = mesh(new THREE.ConeGeometry(0.16, 1.3, 5), M.leaf);
            leaf.position.set(0, 2.15, 0);
            leaf.rotation.set(1.1, (k / 7) * Math.PI * 2, 0);
            leaf.translateY(0.55);
            pl.add(leaf);
          }
          pl.position.set(x, 0, z);
        });
      }
      const span = Math.min(b.maxX - b.minX, s.loungers * 1.1);
      for (let i = 0; i < s.loungers; i++) {
        const l = lounger();
        const x = s.loungers === 1 ? (b.minX + b.maxX) / 2 : lerp((b.minX + b.maxX) / 2 - span / 2 + 0.5, (b.minX + b.maxX) / 2 + span / 2 - 0.5, i / (s.loungers - 1));
        l.position.set(x, 0, b.minZ - P.gutter - P.cw - Math.max(1.1, s.deckW * 0.6));
        hallG.add(l);
      }
      hallG.traverse((o) => {
        if (o.isMesh && o.material !== M.glass) o.castShadow = o.receiveShadow = true;
      });
    };

    /* ---------- Przykrycie wody ---------- */
    const buildCover = () => {
      clear(coverG);
      const s = state;
      if (s.cover === 'none') return;
      const { pts, b, waterY } = P;
      coverMat.map = s.cover === 'roller' ? slatTex : bubbleCoverTex;
      coverMat.map.repeat.set(s.cover === 'roller' ? 1 : 3, s.cover === 'roller' ? 6 : 3);
      coverMat.needsUpdate = true;
      const c = mesh(flatShape(pts, null, () => waterY + 0.02, 1), coverMat, false, true);
      c.renderOrder = 7;
      coverG.add(c);
      const [lo, hi] = [b.minZ, b.maxZ];
      if (s.cover === 'roller') {
        coverG.add(box(0.5, 0.45, hi - lo + 0.3, M.alu, b.maxX + P.gutter + P.cw + 0.3, 0.22, (lo + hi) / 2));
      } else {
        const reel = mesh(new THREE.CylinderGeometry(0.25, 0.25, hi - lo + 0.2, 20), std({ color: '#2f7fb7', roughness: 0.6 }));
        reel.rotation.x = Math.PI / 2;
        reel.position.set(b.maxX + P.gutter + P.cw + 0.45, 0.55, (lo + hi) / 2);
        coverG.add(reel, box(0.08, 0.6, 0.08, M.steel, b.maxX + P.gutter + P.cw + 0.45, 0.3, lo - 0.15), box(0.08, 0.6, 0.08, M.steel, b.maxX + P.gutter + P.cw + 0.45, 0.3, hi + 0.15));
      }
    };

    /* ---------- Zadaszenie teleskopowe ---------- */
    const buildEnclosure = () => {
      clear(encG);
      anim.encSegs = [];
      const s = state;
      if (s.loc !== 'out' || s.enclosure === 'none') return;
      const { b } = P;
      const pad = P.gutter + P.cw + 0.2;
      const x0 = b.minX - pad;
      const x1 = b.maxX + pad;
      const zc = (b.minZ + b.maxZ) / 2;
      const Wd = b.maxZ - b.minZ + pad * 2;
      const H0 = s.enclosure === 'high' ? 2.3 : 0.95;
      const len = x1 - x0;
      const n = Math.max(3, Math.round(len / 2.4));
      const segL = len / n;
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        const w = Wd / 2 + i * 0.05;
        const h = H0 + i * 0.04;
        const shell = mesh(new THREE.CylinderGeometry(1, 1, segL, 40, 1, true, 0, Math.PI), M.poly, false, false);
        shell.rotation.z = Math.PI / 2;
        shell.scale.set(h, 1, w);
        shell.renderOrder = 9;
        g.add(shell);
        [-segL / 2, segL / 2].forEach((dx) => {
          const arc = mesh(new THREE.TorusGeometry(1, 0.035, 6, 40, Math.PI), M.alu);
          arc.rotation.y = Math.PI / 2;
          arc.scale.set(w, h, 1);
          arc.position.x = dx;
          g.add(arc);
        });
        g.add(box(segL, 0.06, 0.08, M.alu, 0, 0.03, -w), box(segL, 0.06, 0.08, M.alu, 0, 0.03, w));
        g.position.set(x0 + segL * (i + 0.5), 0, zc);
        encG.add(g);
        anim.encSegs.push({ g, closedX: x0 + segL * (i + 0.5), openX: x1 + segL * 0.5 + 0.2 + (n - 1 - i) * 0.02, i, n });
      }
      // szyny
      encG.add(box(len + segL * 1.4, 0.03, 0.06, M.alu, x0 + (len + segL * 1.4) / 2, 0.01, zc - Wd / 2), box(len + segL * 1.4, 0.03, 0.06, M.alu, x0 + (len + segL * 1.4) / 2, 0.01, zc + Wd / 2));
    };

    /* ---------- Maszynownia (przekrój) ---------- */
    const techTags = [];
    const buildTech = () => {
      clear(techG);
      techTags.length = 0;
      anim.particles = null;
      anim.fans = [];
      const s = state;
      const { b, depthAt } = P;
      const RW = 4.8;
      const RZ = 3.4;
      const FLOOR = -3.0;
      const rx0 = ext.maxX + 0.8; // ściana maszynowni bliżej basenu
      const room = G(techG);
      room.position.set(rx0, 0, ext.cz);
      // grunt w przekroju
      const SH = -FLOOR + 0.2;
      [[RW + 2, SH, 0.1, RW / 2, FLOOR / 2 - 0.12, -RZ / 2 - 1], [0.1, SH, RZ + 2, -1, FLOOR / 2 - 0.12, 0], [0.1, SH, RZ + 2, RW + 1, FLOOR / 2 - 0.12, 0], [RW + 2, 0.1, RZ + 2, RW / 2, FLOOR - 0.2, 0]].forEach(([w, h, d, x, y, z]) => {
        const sl = mesh(new THREE.BoxGeometry(w, h, d), M.soil, false, false);
        sl.position.set(x, y, z);
        sl.renderOrder = 1;
        room.add(sl);
      });
      room.add(box(RW, 0.15, RZ, M.concrete, RW / 2, FLOOR - 0.07, 0), box(RW, -FLOOR - 0.15, 0.15, M.concrete, RW / 2, FLOOR / 2 - 0.08, -RZ / 2), box(0.15, -FLOOR - 0.15, RZ, M.concrete, RW, FLOOR / 2 - 0.08, 0));
      const tag = (label, sub, obj, dy = 0.4, c) => techTags.push({ label, sub, obj, dy, c });

      // pompa
      const pump = G(room);
      pump.add(box(0.8, 0.08, 0.42, M.dark, 0, 0.04, 0));
      const motor = cyl(0.18, 0.18, 0.5, M.pump, 0.2, 0.3, 0, 20);
      motor.rotation.z = Math.PI / 2;
      const vol = cyl(0.2, 0.2, 0.16, M.pump, -0.14, 0.3, 0, 20);
      vol.rotation.z = Math.PI / 2;
      const basket = cyl(0.14, 0.14, 0.3, std({ color: '#cfe7f2', roughness: 0.15, transparent: true, opacity: 0.7 }), -0.38, 0.3, 0, 16);
      pump.add(motor, vol, basket);
      if (s.pump === 'vs') pump.add(box(0.22, 0.18, 0.06, M.screen, 0.2, 0.55, 0.12));
      pump.position.set(0.8, FLOOR, 1.0);
      tag(s.pump === 'vs' ? 'Pompa zmiennoobrotowa' : 'Pompa obiegowa', 'np. Speck', pump, 0.75, '#2f6fa8');

      // filtr
      const m = metrics(s);
      const fr = clamp(Math.sqrt(m.Q / 40 / Math.PI) * 0.9, 0.28, 0.62);
      const filt = G(room);
      if (s.filter === 'cartridge') {
        filt.add(cyl(0.22, 0.22, 1.1, M.filter, 0, 0.6, 0, 24), cyl(0.24, 0.24, 0.1, M.dark, 0, 1.2, 0, 24));
      } else {
        filt.add(cyl(fr, fr, 1.1, M.filter, 0, 0.75, 0, 32));
        const top = mesh(new THREE.SphereGeometry(fr, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.filter);
        top.position.y = 1.3;
        const bot = mesh(new THREE.SphereGeometry(fr, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.filter);
        bot.position.y = 0.2;
        filt.add(top, bot, box(0.3, 0.22, 0.3, M.dark, 0, 1.3 + fr * 0.9, 0), cyl(0.05, 0.05, 0.03, M.white, 0, 1.0, fr + 0.01, 12));
        [0, 2.1, 4.2].forEach((a) => filt.add(cyl(0.03, 0.03, 0.3, M.dark, Math.cos(a) * fr * 0.6, 0.12, Math.sin(a) * fr * 0.6, 6)));
      }
      filt.position.set(1.9, FLOOR, -0.7);
      tag(FILTERS[s.filter].t, s.filter === 'glass' ? 'złoże AFM' : `${m.filter}`, filt, s.filter === 'cartridge' ? 1.4 : 1.9, '#35576d');

      // dezynfekcja
      const dis = G(room);
      if (s.disinf === 'membrane') {
        dis.add(box(0.9, 1.1, 0.25, M.white, 0, 1.4, 0), box(0.5, 0.25, 0.04, M.screen, 0, 1.65, 0.13), box(0.5, 0.6, 0.45, std({ color: '#e8eef2', roughness: 0.5 }), 0.75, 0.3, 0.2), cyl(0.2, 0.2, 0.5, std({ color: '#2a7fd0', roughness: 0.4 }), -0.6, 0.25, 0.25, 16));
        tag('Elektroliza membranowa', 'słodka woda, np. OSPA', dis, 2.1, '#00b8e0');
      } else if (s.disinf === 'salt') {
        const cell = cyl(0.09, 0.09, 0.5, std({ color: '#d7f2fb', roughness: 0.1, transparent: true, opacity: 0.6 }), 0, 0.9, 0.3, 16);
        cell.rotation.z = Math.PI / 2;
        dis.add(cell, box(0.35, 0.45, 0.15, M.white, 0, 1.45, 0), box(0.25, 0.12, 0.02, M.screen, 0, 1.52, 0.08));
        tag('Elektroliza soli', 'chlor z soli kuchennej', dis, 1.8, '#00b8e0');
      } else if (s.disinf === 'chlorine') {
        dis.add(box(0.8, 0.9, 0.06, M.white, 0, 1.4, 0), box(0.18, 0.22, 0.2, M.prominent, -0.2, 1.3, 0.1), box(0.18, 0.22, 0.2, M.prominent, 0.2, 1.3, 0.1), cyl(0.16, 0.18, 0.55, M.white, -0.25, 0.28, 0.35, 16), cyl(0.16, 0.18, 0.55, std({ color: '#e7eef4' }), 0.25, 0.28, 0.35, 16));
        tag('Dozowanie chloru i pH', 'np. ProMinent', dis, 1.9, '#1e66c8');
      } else {
        dis.add(box(0.5, 0.6, 0.06, M.white, 0, 1.4, 0), box(0.18, 0.22, 0.2, M.prominent, 0, 1.3, 0.1), cyl(0.16, 0.18, 0.55, std({ color: '#e9f6ff' }), 0, 0.28, 0.35, 16));
        tag('Aktywny tlen', 'bez chloru', dis, 1.8, '#00b8e0');
      }
      dis.position.set(3.4, FLOOR, -RZ / 2 + 0.1);

      // UV
      if (s.uv) {
        const uv = G(room);
        const body = cyl(0.13, 0.13, 1.0, M.steel, 0, 0, 0, 20);
        body.rotation.z = Math.PI / 2;
        const glow = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.9, 20, 1, true), M.uvGlow, false, false);
        glow.rotation.z = Math.PI / 2;
        uv.add(body, glow, box(0.05, 0.9, 0.05, M.dark, -0.35, -0.45, 0), box(0.05, 0.9, 0.05, M.dark, 0.35, -0.45, 0));
        uv.position.set(3.0, FLOOR + 1.0, 1.1);
        tag('Lampa UV', 'bakterie i chloraminy', uv, 0.4, '#8a5cff');
      }
      if (s.ozone) {
        const oz = G(room);
        oz.add(box(0.45, 0.55, 0.22, M.white, 0, 0, 0), box(0.2, 0.08, 0.02, M.screen, 0, 0.12, 0.12));
        oz.position.set(2.2, FLOOR + 1.6, -RZ / 2 + 0.12);
        tag('Ozonator', 'krystaliczna woda', oz, 0.45, '#00b8e0');
      }
      if (s.ph || s.redox || s.app) {
        const pan = G(room);
        pan.add(box(0.06, 0.8, 0.9, M.white, 0, 0, 0));
        if (s.ph) pan.add(cyl(0.025, 0.025, 0.25, M.dark, -0.05, -0.15, -0.2, 8));
        if (s.redox) pan.add(cyl(0.025, 0.025, 0.25, M.dark, -0.05, -0.15, 0.0, 8));
        if (s.app) pan.add(box(0.03, 0.2, 0.3, M.screen, -0.05, 0.22, 0.15));
        pan.position.set(RW - 0.12, FLOOR + 1.4, 0.4);
        tag('Pomiar i sterowanie', [s.ph && 'pH', s.redox && 'Redox', s.app && 'aplikacja'].filter(Boolean).join(' · '), pan, 0.55, '#2fd27c');
      }
      if (s.heat === 'exchanger') {
        const hx = cyl(0.12, 0.12, 0.7, M.steel, 0, 0, 0, 16);
        hx.rotation.z = Math.PI / 2;
        const hg = G(room);
        hg.add(hx);
        hg.position.set(1.6, FLOOR + 0.9, 1.2);
        tag('Wymiennik ciepła', 'z kotłem domowym', hg, 0.35, '#e0752b');
      }
      if (s.loc === 'in') {
        const ahu = G(room);
        ahu.add(box(1.5, 1.0, 0.8, M.alu, 0, 0.5, 0), box(0.4, 0.4, 0.02, M.dark, -0.4, 0.55, 0.41), cyl(0.18, 0.18, -FLOOR - 1.0, M.alu, 0.5, 1.0 + (-FLOOR - 1.0) / 2, -0.1, 16));
        ahu.position.set(3.2, FLOOR, 1.0);
        tag(VENT[s.vent].t, 'osuszanie i ogrzewanie hali', ahu, 1.25, '#99a9b5');
      }
      // pompa ciepła / kolektory na zewnątrz
      if (s.heat === 'hp') {
        const hp = G(techG);
        hp.add(box(1.1, 0.8, 0.45, std({ color: '#e9edef', roughness: 0.5 }), 0, 0.4, 0));
        const fan = cyl(0.3, 0.3, 0.03, M.dark, 0.18, 0.42, 0.24, 20);
        fan.rotation.x = Math.PI / 2;
        hp.add(fan);
        anim.fans.push(fan);
        hp.position.set(rx0 + RW + 1.2, -0.14, ext.cz + 1.2);
        hp.rotation.y = -0.4;
        tag('Pompa ciepła', `woda ${s.temp} °C`, hp, 0.95, '#e0752b');
      } else if (s.heat === 'solar') {
        const sol = G(techG);
        for (let i = 0; i < 4; i++) {
          const p = box(1.0, 0.04, 1.8, std({ color: '#1c2a44', roughness: 0.25, metalness: 0.4 }), i * 1.1, 0.75, 0);
          p.rotation.x = -0.6;
          sol.add(p, box(0.04, 0.9, 0.04, M.alu, i * 1.1, 0.45, -0.55));
        }
        sol.position.set(rx0 + RW + 0.8, -0.14, ext.cz - 1.5);
        tag('Kolektory solarne', `woda ${s.temp} °C`, sol, 1.4, '#e0752b');
      }

      // rury i przepływ
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      const rx = rx0;
      const cz = ext.cz;
      const [poolL, poolR] = [b.minX, b.maxX];
      const zIn = clamp(cz, b.minZ + 0.4, b.maxZ - 0.4);
      const pts = [
        V(poolR - 0.05, P.waterY - 0.05, zIn), // wylot z basenu (rynna / skimmer)
        V(poolR + P.gutter + 0.5, -0.5, zIn),
        V(rx + 0.4, -0.5, zIn),
        V(rx + 0.4, -0.5, cz + 1.0),
        V(rx + 0.4, FLOOR + 0.3, cz + 1.0),
        V(rx + 0.8, FLOOR + 0.3, cz + 1.0), // pompa
        V(rx + 1.2, FLOOR + 0.3, cz + 1.0),
        V(rx + 1.2, FLOOR + 1.9, cz + 1.0),
        V(rx + 1.9, FLOOR + 1.9, cz + 1.0),
        V(rx + 1.9, FLOOR + 1.9, cz - 0.7),
        V(rx + 1.9, FLOOR + 1.3, cz - 0.7), // filtr
        V(rx + 1.9, FLOOR + 0.2, cz - 0.7),
        V(rx + 1.9, FLOOR + 0.2, cz + 0.2),
        V(rx + 2.4, FLOOR + 0.2, cz + 0.2),
        V(rx + 2.4, FLOOR + 1.0, cz + 0.2),
        V(rx + 2.4, FLOOR + 1.0, cz + 1.1),
        V(rx + 3.6, FLOOR + 1.0, cz + 1.1), // UV
        V(rx + 3.6, FLOOR + 1.0, cz - 1.2), // dezynfekcja
        V(rx + 3.6, FLOOR + 0.15, cz - 1.2),
        V(rx + 0.25, FLOOR + 0.15, cz - 1.2),
        V(rx + 0.25, -depthAt(poolL) - 0.5, cz - 1.2),
        V(poolL + 0.4, -depthAt(poolL) - 0.5, clamp(cz - 1.2, b.minZ + 0.3, b.maxZ - 0.3)),
        V(poolL + 0.4, -depthAt(poolL) + 0.25, clamp(cz - 1.2, b.minZ + 0.3, b.maxZ - 0.3)), // dysza powrotna
      ];
      const path = new THREE.CurvePath();
      for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
      const tube = mesh(new THREE.TubeGeometry(path, 320, 0.075, 8, false), M.pipe, false, false);
      tube.renderOrder = 8;
      techG.add(tube);
      // cząstki
      const N = 160;
      const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.particle, N);
      parts.frustumCulled = false;
      techG.add(parts);
      const samples = path.getSpacedPoints(800);
      const segLen = [];
      let tot = 0;
      for (let i = 1; i < pts.length; i++) {
        tot += pts[i].distanceTo(pts[i - 1]);
        segLen.push(tot);
      }
      anim.particles = { mesh: parts, n: N, samples, uFilter: segLen[10] / tot, uUv: segLen[14] / tot, uUvEnd: segLen[15] / tot };
      techG.userData.room = room;
      techG.userData.focus = new THREE.Vector3(rx + RW / 2, FLOOR + 1.2, cz);
    };

    /* ---------- Pora dnia i materiały zależne od wyboru ---------- */
    const timeCfg = {
      day: { hemi: ['#ffffff', '#b9c6a6', 0.85], sun: ['#fff6e8', 2.6, [12, 18, 9]], exp: 1.0, fog: '#eef5f8', night: 0 },
      sunset: { hemi: ['#ffd9b8', '#8a7a6a', 0.62], sun: ['#ffb070', 2.0, [-16, 6, 7]], exp: 0.96, fog: '#f7e3cf', night: 0.35 },
      night: { hemi: ['#3a4c74', '#10141c', 0.32], sun: ['#a9bcff', 0.28, [6, 14, -8]], exp: 0.9, fog: '#152337', night: 1 },
    };
    const applyTime = () => {
      const c = timeCfg[time];
      hemi.color.set(c.hemi[0]);
      hemi.groundColor.set(c.hemi[1]);
      hemi.intensity = c.hemi[2] + (state.loc === 'in' ? 0.15 : 0);
      sun.color.set(c.sun[0]);
      sun.intensity = c.sun[1];
      const [x, y, z] = c.sun[2];
      const k = ext.size / 20;
      sun.position.set(ext.cx + x * k, y * k, ext.cz + z * k);
      sun.target.position.set(ext.cx, 0, ext.cz);
      const span = ext.size * 0.75 + 4;
      Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: span * 6 });
      sun.shadow.camera.updateProjectionMatrix();
      renderer.toneMappingExposure = c.exp;
      const envK = time === 'night' ? 0.1 : time === 'sunset' ? 0.55 : 1;
      const seen = new Set();
      scene.traverse((o) => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((mt) => {
          if (seen.has(mt) || mt.envMapIntensity === undefined) return;
          seen.add(mt);
          if (mt.userData.baseEnv === undefined) mt.userData.baseEnv = mt.envMapIntensity;
          mt.envMapIntensity = mt.userData.baseEnv * envK;
        });
      });
      scene.fog.color.set(c.fog);
      scene.fog.near = ext.size * 2;
      scene.fog.far = ext.size * 5;
    };
    const lightColor = new THREE.Color();
    const updateDynamic = (t) => {
      const night = timeCfg[time].night;
      // kolor LED
      if (state.light === 'rgb') lightColor.setHSL((t * 0.05) % 1, 0.85, 0.6);
      else lightColor.set(LIGHTS[state.light].c);
      M.lampDisc.emissive.copy(lightColor);
      M.lampDisc.emissiveIntensity = 0.3 + night * 4;
      poolLights.forEach((l) => {
        l.color.copy(lightColor);
        l.intensity = night * 14 * (state.lamps / 4);
      });
      const glow = waterTint().lerp(lightColor, state.light === 'white' ? 0.25 : 0.6);
      glow.offsetHSL(0, 0.2, 0.08);
      surfaceMat.emissive.copy(glow);
      surfaceMat.emissiveIntensity = night * 0.95;
      basinMat.emissive.copy(glow);
      basinMat.emissiveIntensity = night * 0.85 * clamp(state.lamps / 4, 0.6, 1.5);
      causticMatA.opacity = (0.17 + night * 0.3) * (state.raw ? 0.15 : 1);
      causticMatB.opacity = (0.1 + night * 0.22) * (state.raw ? 0.15 : 1);
      causticMatA.color.set('#ffffff').lerp(lightColor, night * 0.8);
      M.laminar.color.set('#e8fbff').lerp(lightColor, night * 0.7);
      M.bollard.emissiveIntensity = night * 6;
      M.warmGlow.color.set('#ffcf8a').multiplyScalar(0.4 + night * 0.9);
      // woda bez uzdatniania
      const tint = waterTint();
      const murky = new THREE.Color('#6f8d55');
      surfaceMat.color.copy(tint).lerp(murky, state.raw ? 0.85 : 0);
      surfaceMat.opacity = state.raw ? 0.9 : 0.55;
      fireLight.intensity = state.firepit && state.loc === 'out' ? 1.2 + night * 5 + Math.sin(t * 11) * 0.5 : 0;
    };

    /* ---------- Kamera i widoki ---------- */
    const camTween = { t: 1, from: null, to: null };
    const viewPose = (v) => {
      const { cx, cz, size, minZ, maxZ } = ext;
      const { b } = P;
      if (v === 'top') return { pos: new THREE.Vector3(cx, size * 1.15 + 6, cz + 0.01), tgt: new THREE.Vector3(cx, 0, cz) };
      if (v === 'eye') return { pos: new THREE.Vector3(b.minX - P.cw - 3.4, 1.9, (b.minZ + b.maxZ) / 2 + 2.2), tgt: new THREE.Vector3(b.maxX - 1, -0.3, (b.minZ + b.maxZ) / 2 - 0.6) };
      if (v === 'tech') {
        const f = techG.userData.focus || new THREE.Vector3(cx, -1.5, cz);
        return { pos: new THREE.Vector3(f.x - 3.2, 2.8, f.z + 7.8), tgt: f.clone() };
      }
      const r = size * 0.95 + 6;
      return { pos: new THREE.Vector3(cx + r * 0.55, r * 0.55, maxZ + r * 0.62), tgt: new THREE.Vector3(cx, -0.4, (minZ + maxZ) / 2) };
    };
    const goView = (v, instant) => {
      const pose = viewPose(v);
      if (instant || reduceMotion) {
        camera.position.copy(pose.pos);
        controls.target.copy(pose.tgt);
        controls.update();
        camTween.t = 1;
        return;
      }
      camTween.from = { pos: camera.position.clone(), tgt: controls.target.clone() };
      camTween.to = pose;
      camTween.t = 0;
    };
    onView = (v, instant) => {
      goView(v, instant);
      if (instant) techMix = v === 'tech' ? 1 : 0;
      kick();
    };
    onTime = () => {
      applyTime();
      kick();
    };
    $('#aqk-reset-cam').addEventListener('click', () => goView(view));

    /* ---------- Przebudowa ---------- */
    let dirty = true;
    let reframe = true;
    let lastShapeKey = '';
    onChange = (opts) => {
      dirty = true;
      if (opts.reframe) reframe = true;
      kick();
    };
    const rebuild = () => {
      dirty = false;
      buildPool();
      buildDeck();
      buildEnv();
      buildCover();
      buildEnclosure();
      buildTech();
      applyTime();
      const key = state.loc;
      if (reframe || key !== lastShapeKey) {
        if (lastShapeKey === '' || reframe) goView(view, lastShapeKey === '');
        reframe = false;
      }
      lastShapeKey = key;
      loadingEl.classList.add('is-done');
    };

    /* ---------- Etykiety maszynowni ---------- */
    const tagsEl = $('#aqk-tags');
    let tagEls = [];
    const syncTagEls = () => {
      tagsEl.innerHTML = techTags.map((t) => `<div class="aqk-tag" style="--c:${t.c || '#00d8ff'}"><span>${t.label}${t.sub ? `<small>${t.sub}</small>` : ''}</span></div>`).join('');
      tagEls = [...tagsEl.children];
    };
    const _v = new THREE.Vector3();
    let techMix = 0;
    const placeTags = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      techTags.forEach((t, i) => {
        const el = tagEls[i];
        if (!el) return;
        if (techMix < 0.6) {
          el.style.opacity = '0';
          return;
        }
        t.obj.getWorldPosition(_v);
        _v.y += t.dy;
        _v.project(camera);
        if (_v.z > 1) {
          el.style.opacity = '0';
          return;
        }
        const x = (_v.x * 0.5 + 0.5) * w;
        const y = (-_v.y * 0.5 + 0.5) * h;
        if (!t.w) t.w = el.offsetWidth || 160;
        const left = x + t.w > w - 8;
        el.classList.toggle('is-left', left);
        el.style.opacity = String(clamp((techMix - 0.6) / 0.4, 0, 1));
        el.style.transform = `translate(${(left ? x - t.w + 5 : x - 5).toFixed(1)}px, ${(y - 5).toFixed(1)}px)`;
      });
    };

    /* ---------- Pętla ---------- */
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const cMurky = new THREE.Color('#a39f4f');
    const cClean = new THREE.Color('#2fd2ff');
    const cUv = new THREE.Color('#c39bff');
    const pc = new THREE.Color();
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const steamSprites = [];
    const ensureSteam = () => {
      steamSprites.forEach((sp) => {
        fxG.remove(sp);
        sp.material.dispose();
      });
      steamSprites.length = 0;
      anim.steam.forEach((src) => {
        for (let i = 0; i < (src.soft ? 4 : 10); i++) {
          const sp = new THREE.Sprite(steamMat.clone());
          sp.userData = { src, life: rand(), dur: 3 + rand() * 3, ox: 0, oz: 0 };
          sp.renderOrder = 10;
          fxG.add(sp);
          steamSprites.push(sp);
        }
      });
    };
    const frame = (now) => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;
      if (dirty) {
        rebuild();
        syncTagEls();
        ensureSteam();
      }
      // kamera
      if (camTween.t < 1 && camTween.to) {
        camTween.t = Math.min(camTween.t + dt / 1.1, 1);
        const k = camTween.t < 0.5 ? 4 * camTween.t ** 3 : 1 - Math.pow(-2 * camTween.t + 2, 3) / 2;
        camera.position.lerpVectors(camTween.from.pos, camTween.to.pos, k);
        controls.target.lerpVectors(camTween.from.tgt, camTween.to.tgt, k);
      }
      controls.update();

      // przekrój maszynowni
      const techGoal = view === 'tech' ? 1 : 0;
      techMix += (techGoal - techMix) * (1 - Math.exp(-6 * dt));
      if (Math.abs(techMix - techGoal) < 0.002) techMix = techGoal;
      techG.visible = techMix > 0.01;
      techG.traverse((o) => {
        if (o.isMesh && o.material && o.material !== M.pipe && o.material !== M.soil && o.material !== M.particle) o.visible = techMix > 0.05;
      });
      const lawn = envG.userData.lawn;
      const see = techMix > 0.01;
      if (lawn && M.grass.transparent !== see) {
        M.grass.transparent = see;
        M.grass.needsUpdate = true;
      }
      M.grass.opacity = 1 - techMix * 0.85;
      M.grass.depthWrite = techMix < 0.5;
      if (deckMat.transparent !== see) {
        deckMat.transparent = see;
        deckMat.needsUpdate = true;
      }
      deckMat.opacity = 1 - techMix * 0.65;
      deckMat.depthWrite = techMix < 0.5;
      M.pipe.opacity = 0.35 * techMix;
      M.soil.opacity = 0.5 * techMix;

      // woda
      if (!reduceMotion) {
        causticA.offset.set(t * 0.03, t * 0.017);
        causticB.offset.set(-t * 0.021, t * 0.026);
        waveNormal.offset.set(t * 0.02, t * 0.013);
        anim.sheets.forEach((s) => (s.tex.offset.y = (t * s.speed) % 1));
      }
      updateDynamic(t);

      // bąbelki
      anim.bubbles.forEach((bb) => {
        for (let i = 0; i < bb.n; i++) {
          const seed = (i * 0.6180339) % 1;
          const u = (seed + t * bb.rate) % 1;
          const [sx, sy, sz] = bb.src(i);
          const sp = bb.spread || 0;
          const jx = Math.sin(i * 12.9) * sp * u;
          const jz = Math.cos(i * 7.3) * sp * u;
          pos.set(sx + bb.dir[0] * bb.len * u + jx, Math.min(sy + bb.dir[1] * bb.len * u + Math.sin(i) * 0.05, bb.top - 0.01), sz + bb.dir[2] * bb.len * u * 0.3 + jz);
          m4.compose(pos, q, sc.setScalar(bb.size * (0.6 + seed * 0.8) * (reduceMotion ? 0.6 : 1)));
          bb.mesh.setMatrixAt(i, m4);
        }
        bb.mesh.instanceMatrix.needsUpdate = true;
      });
      // łuki wodne: pulsowanie
      anim.laminar.forEach((tb, i) => (tb.material.opacity = 0.75 + Math.sin(t * 3 + i) * 0.1));
      // ogień
      anim.flames.forEach((f, i) => {
        const fl = reduceMotion ? 1 : 0.8 + Math.sin(t * 9 + f.userData.ph) * 0.15 + Math.sin(t * 13.7 + i) * 0.08;
        f.scale.set(0.32 * fl, 0.6 * fl, 1);
        f.position.y = 0.4 + 0.25 * fl;
      });
      // para
      steamSprites.forEach((sp) => {
        const u = sp.userData;
        if (!reduceMotion) u.life += dt / u.dur;
        if (u.life >= 1) {
          u.life -= 1;
          u.ox = (rand() - 0.5) * u.src.spread;
          u.oz = (rand() - 0.5) * u.src.spread;
        }
        const a = Math.sin(Math.PI * u.life) * (u.src.soft ? 0.12 : 0.22) * (0.6 + timeCfg[time].night * 0.6);
        sp.material.opacity = a;
        const size = 0.7 * (0.6 + u.life * 1.6);
        sp.scale.set(size, size, 1);
        sp.position.set(u.src.x + u.ox + u.life * 0.3, u.src.y + u.life * 1.4, u.src.z + u.oz);
      });
      // wentylator pompy ciepła
      anim.fans.forEach((f) => (f.rotation.y = t * 6));
      // zadaszenie: płynne otwieranie
      anim.encOpen += (state.encOpen - anim.encOpen) * (1 - Math.exp(-5 * dt));
      anim.encSegs.forEach((sgm) => {
        const k = clamp(anim.encOpen * 1.25 - (sgm.n - 1 - sgm.i) * (0.25 / sgm.n), 0, 1);
        sgm.g.position.x = lerp(sgm.closedX, sgm.openX, k);
      });
      // przykrycie: zasuwanie od końca basenu
      anim.coverAmt += (state.coverAmt - anim.coverAmt) * (1 - Math.exp(-5 * dt));
      if (P) {
        const xLim = lerp(P.b.maxX, P.b.minX, anim.coverAmt);
        coverClip.normal.set(1, 0, 0);
        coverClip.constant = -xLim;
        coverG.visible = state.cover !== 'none' && anim.coverAmt > 0.01;
      }
      // cząstki w rurach
      const pa = anim.particles;
      if (pa && techMix > 0.02) {
        pa.mesh.visible = true;
        const S = pa.samples;
        const n = S.length - 1;
        for (let i = 0; i < pa.n; i++) {
          const u = (i / pa.n + t * 0.05) % 1;
          const fi = u * n;
          const i0 = Math.floor(fi);
          pos.lerpVectors(S[i0], S[Math.min(i0 + 1, n)], fi - i0);
          m4.compose(pos, q, sc.setScalar(0.05 * techMix));
          pa.mesh.setMatrixAt(i, m4);
          const mk = state.raw ? 1 : u < pa.uFilter ? 0.75 : 0;
          pc.copy(cClean).lerp(cMurky, mk);
          if (state.uv && u > pa.uUv && u < pa.uUvEnd) pc.lerp(cUv, 0.8);
          pa.mesh.setColorAt(i, pc);
        }
        pa.mesh.instanceMatrix.needsUpdate = true;
        if (pa.mesh.instanceColor) pa.mesh.instanceColor.needsUpdate = true;
      } else if (pa) pa.mesh.visible = false;

      renderer.render(scene, camera);
      placeTags();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      kick();
    };
    onResize = () => requestAnimationFrame(resize);
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      kick();
    }).observe(canvas);
    document.addEventListener('visibilitychange', kick);
    controls.addEventListener('start', () => {
      camTween.t = 1;
      $('#aqk-hint').classList.add('is-hidden');
    });
    setTimeout(() => $('#aqk-hint').classList.add('is-hidden'), 7000);

    snapshot = () => {
      if (dirty) rebuild();
      renderer.render(scene, camera);
      try {
        return renderer.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    };
    // uchwyt do testów
    root._aqk = {
      set, setView, setTime, setTab, state: () => state, frame: () => frame(performance.now()), ready: true,
      // testy: przebudowa bez renderowania i wstrzymanie pętli
      rebuild: () => {
        if (dirty) {
          rebuild();
          syncTagEls();
          ensureSteam();
        }
      },
      pause: (on) => {
        visible = !on;
        if (!on) kick();
      },
    };
    resize();
    kick();
  }
}
})();
