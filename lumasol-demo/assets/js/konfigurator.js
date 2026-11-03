/* ==========================================================================
   Luma Sol — sterowanie:
   1) konfigurator 3D w hero (panel → scena, podsumowanie, przeniesienie
      projektu do formularza wyceny razem z obrazem z modelu),
   2) „Cztery pory roku” — przewijanie steruje porą roku, kartami i HUD.
   Działa też bez 3D (brak sieci / WebGL): panel, podsumowanie i formularz
   zostają, a zamiast modelu widać zdjęcie z realizacji.
   ========================================================================== */
(() => {
  const LS = window.LumaScene;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const fmtArea = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

  const TYPE_NAMES = { calo: 'Ogród zimowy całoroczny', sezon: 'Ogród zimowy sezonowy', zadaszenie: 'Zadaszenie tarasu', pergola: 'Pergola lamelowa' };
  const FORM_TYPE = { calo: 'Ogród zimowy całoroczny', sezon: 'Ogród zimowy sezonowy', zadaszenie: 'Zadaszenie tarasu', pergola: 'Pergola ogrodowa' };
  const COLOR_SHORT = { antracyt: 'antracyt', bialy: 'biały', czarny: 'czarny', dab: 'złoty dąb' };

  /* ======================================================================
     1. Konfigurator w hero
     ====================================================================== */
  const cfg = document.getElementById('cfg');
  const stage = document.getElementById('cfg-stage');
  const canvas = document.getElementById('cfg-canvas');
  let garden = null;

  const state = { type: 'calo', W: 5, D: 3.5, color: 'antracyt', glass: 'clear', walls: 'slide', open: 0, lamella: 0.15, led: true, awning: false, heaters: false };

  if (cfg) {
    const $ = (s) => cfg.querySelector(s);
    const $$ = (s) => [...cfg.querySelectorAll(s)];
    const typeBtns = $$('[data-type]');
    const colorBtns = $$('[data-color]');
    const glassBtns = $$('[data-glass]');
    const wallsBtns = $$('[data-walls]');
    const extraBtns = $$('[data-extra]');
    const inW = $('#in-w');
    const inD = $('#in-d');
    const inL = $('#in-l');
    const inO = $('#in-o');
    const outW = $('#out-w');
    const outD = $('#out-d');
    const outL = $('#out-l');
    const outO = $('#out-o');
    const areaEl = $('#cfg-area');
    const colorName = $('#cfg-color');
    const summary = $('#cfg-summary');
    const sendBtn = $('#cfg-send');
    const timeBtns = [...document.querySelectorAll('[data-time]')];
    const dimW = document.getElementById('dim-w');
    const dimD = document.getElementById('dim-d');

    const setPct = (input) => input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
    const show = (name, on) => $$(`[data-show="${name}"]`).forEach((el) => (el.hidden = !on));
    const hasWalls = () => state.type !== 'pergola' && (state.type !== 'zadaszenie' || state.walls === 'slide');

    const summaryText = () => {
      const per = state.type === 'pergola';
      const parts = [TYPE_NAMES[state.type], `${fmt1(state.W)} × ${fmt1(state.D)} m`, COLOR_SHORT[state.color]];
      if (per) parts.push('lamele w dachu');
      else parts.push(state.glass === 'tint' ? 'szkło przeciwsłoneczne' : 'szkło bezbarwne');
      if (!per) parts.push(hasWalls() ? 'ściany przesuwne' : 'bez ścian');
      if (state.led) parts.push('LED');
      if (state.awning && !per) parts.push('markiza');
      if (state.heaters && !per) parts.push('promienniki');
      return parts.join(' · ');
    };

    const syncUI = () => {
      typeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === state.type)));
      colorBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === state.color)));
      glassBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.glass === state.glass)));
      wallsBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.walls === state.walls)));
      extraBtns.forEach((b) => b.setAttribute('aria-pressed', String(!!state[b.dataset.extra])));
      const per = state.type === 'pergola';
      show('glass', !per);
      show('lamella', per);
      show('walls-choice', state.type === 'zadaszenie');
      show('open', hasWalls());
      $$('[data-show-chip]').forEach((b) => (b.hidden = per));
      outW.textContent = `${fmt1(state.W)} m`;
      outD.textContent = `${fmt1(state.D)} m`;
      outL.textContent = state.lamella < 0.08 ? 'zamknięte' : state.lamella > 0.92 ? 'otwarte' : `${Math.round(state.lamella * 85)}°`;
      outO.textContent = state.open < 0.03 ? 'zamknięte' : state.open > 0.97 ? 'rozsunięte' : `${Math.round(state.open * 100)}%`;
      areaEl.textContent = fmtArea(state.W * state.D);
      colorName.textContent = LS && LS.COLORS ? LS.COLORS[state.color].name : '';
      summary.textContent = summaryText();
      [inW, inD, inL, inO].forEach(setPct);
    };

    let pending = null;
    const push = (patch) => {
      Object.assign(state, patch);
      syncUI();
      if (!garden) return;
      pending = Object.assign(pending || {}, patch);
      requestAnimationFrame(() => {
        if (!pending) return;
        garden.setConfig(Object.assign({}, state));
        pending = null;
      });
    };

    // etykiety wymiarów pokazują się na chwilę przy zmianie
    let dimTimer;
    const flashDims = () => {
      if (!garden) return;
      dimW.classList.add('is-show');
      dimD.classList.add('is-show');
      clearTimeout(dimTimer);
      dimTimer = setTimeout(() => {
        dimW.classList.remove('is-show');
        dimD.classList.remove('is-show');
      }, 1600);
    };

    typeBtns.forEach((b) =>
      b.addEventListener('click', () => {
        const t = b.dataset.type;
        push({ type: t, walls: t === 'zadaszenie' ? 'none' : 'slide', open: t === 'sezon' ? 0.35 : 0 });
        inO.value = state.open;
      })
    );
    colorBtns.forEach((b) => b.addEventListener('click', () => push({ color: b.dataset.color })));
    glassBtns.forEach((b) => b.addEventListener('click', () => push({ glass: b.dataset.glass })));
    wallsBtns.forEach((b) => b.addEventListener('click', () => push({ walls: b.dataset.walls })));
    extraBtns.forEach((b) => b.addEventListener('click', () => push({ [b.dataset.extra]: !state[b.dataset.extra] })));
    inW.addEventListener('input', () => {
      push({ W: parseFloat(inW.value) });
      flashDims();
    });
    inD.addEventListener('input', () => {
      push({ D: parseFloat(inD.value) });
      flashDims();
    });
    inL.addEventListener('input', () => push({ lamella: parseFloat(inL.value) }));
    inO.addEventListener('input', () => push({ open: parseFloat(inO.value) }));
    timeBtns.forEach((b) =>
      b.addEventListener('click', () => {
        timeBtns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        garden && garden.setTime(b.dataset.time);
      })
    );

    // Projekt → formularz wyceny
    sendBtn.addEventListener('click', () => {
      const card = document.getElementById('q-project');
      const img = document.getElementById('q-thumb-img');
      const title = document.getElementById('q-proj-title');
      const kicker = document.getElementById('q-proj-kicker');
      const link = document.getElementById('q-proj-link');
      const type = document.getElementById('q-type');
      const area = document.getElementById('q-area');
      if (garden) {
        try {
          img.src = garden.snapshot();
        } catch {
          /* bez obrazu, zostaje zdjęcie */
        }
      }
      kicker.textContent = 'Twój projekt z konfiguratora';
      title.textContent = summaryText();
      link.firstChild.textContent = 'Zmień w konfiguratorze';
      type.value = FORM_TYPE[state.type];
      area.value = `${fmtArea(state.W * state.D)} m²`;
      card.classList.remove('is-filled');
      void card.offsetWidth;
      card.classList.add('is-filled');
      [type, area].forEach((el) => {
        const f = el.closest('.field');
        f.classList.remove('is-flash');
        void f.offsetWidth;
        f.classList.add('is-flash');
      });
      window.lsToast && window.lsToast('Projekt dodany do formularza wyceny');
    });

    syncUI();

    // ---------- start 3D ----------
    const layout = () => {
      if (!garden) return;
      const wide = innerWidth >= 1024;
      const panel = cfg.getBoundingClientRect().width;
      // na szerokim ekranie oddalamy kadr: widać niebo nad domem, a zabudowa stoi między nagłówkiem a panelem
      garden.distK = wide ? 1.42 : 1;
      garden.viewT.ty = wide ? 2.7 : 1.5;
      garden.viewT.pol = wide ? 1.33 : 1.25;
      garden.setOffset(wide ? Math.round(innerWidth * 0.01) : 0, wide ? 0 : -Math.round(stage.clientHeight * 0.2));
    };

    const boot = async () => {
      if (!LS) return root.classList.add('no-3d');
      const ok = await LS.load();
      if (!ok) return root.classList.add('no-3d');
      try {
        garden = LS.create(canvas, { cfg: Object.assign({}, state), time: 'sunset' });
      } catch {
        return root.classList.add('no-3d');
      }
      garden.attachControls(canvas);
      layout();
      garden.intro();
      garden.onFrame = (g) => {
        if (!dimW.classList.contains('is-show')) return;
        const d = g.cfg;
        const a = g.project(0, 0.25, d.D + 0.45);
        const b = g.project(d.W / 2 + 0.45, 0.25, d.D / 2);
        dimW.textContent = `${fmt1(d.W)} m`;
        dimD.textContent = `${fmt1(d.D)} m`;
        dimW.style.transform = `translate(${a.x}px, ${a.y}px)`;
        dimD.style.transform = `translate(${b.x}px, ${b.y}px)`;
      };
      root.classList.add('is-3d');
      if (visible) garden.start();
    };

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
          document.body.classList.toggle('in-3d', visible || document.body.classList.contains('in-seasons'));
          if (!garden) return;
          visible ? garden.start() : garden.stop();
        },
        { threshold: 0.05 }
      ).observe(stage);
    }
    document.addEventListener('visibilitychange', () => {
      if (!garden) return;
      document.hidden ? garden.stop() : visible && garden.start();
    });
    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!garden) return;
        garden.resize();
        layout();
      }, 120);
    });
    boot();
  }

  /* ======================================================================
     2. Cztery pory roku
     ====================================================================== */
  const track = document.getElementById('sn-track');
  const snCanvas = document.getElementById('sn-canvas');
  const snStage = document.getElementById('sn-stage');
  if (track && snCanvas) {
    const cards = [...document.querySelectorAll('#sn-cards .sn-card')];
    const dial = document.getElementById('sn-dial');
    const monthEl = document.getElementById('sn-month');
    const outEl = document.getElementById('sn-out');
    const inEl = document.getElementById('sn-in');
    const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    const C = 2 * Math.PI * 52;
    let snGarden = null;
    let booted = false;
    let inView = false;
    let lastCard = -1;

    const weights = (p) => {
      const centers = [0.11, 0.37, 0.63, 0.89];
      const w = centers.map((c) => Math.max(0, 1 - Math.abs(p - c) / 0.22));
      const s = w.reduce((a, b) => a + b, 0) || 1;
      return w.map((x) => x / s);
    };
    const mix = (w, arr) => arr.reduce((a, v, i) => a + v * w[i], 0);

    const progress = () => {
      const r = track.getBoundingClientRect();
      return clamp01(-r.top / (r.height - innerHeight || 1));
    };

    const render = () => {
      const p = progress();
      const w = weights(p);
      dial.style.strokeDashoffset = String(C * (1 - Math.max(p, 0.02)));
      monthEl.textContent = MONTHS[(6 + Math.min(11, Math.floor(p * 12))) % 12];
      outEl.textContent = `${Math.round(mix(w, [28, 9, -8, 16]))}°`;
      inEl.textContent = `${Math.round(mix(w, [25, 20, 21, 22]))}°`;
      const idx = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3;
      if (idx !== lastCard) {
        cards.forEach((c, i) => {
          c.classList.toggle('is-active', i === idx);
          c.classList.toggle('is-done', i < idx);
        });
        lastCard = idx;
      }
      const r = track.getBoundingClientRect();
      const stuck = r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
      document.body.classList.toggle('in-seasons', stuck);
      if (snGarden) snGarden.setSeasonProgress(p);
    };

    const boot = async () => {
      booted = true;
      if (!LS) return;
      const ok = await LS.load();
      if (!ok) return;
      try {
        snGarden = LS.create(snCanvas, { seasons: true, cfg: { type: 'calo', W: 6, D: 4, color: 'antracyt', glass: 'clear', walls: 'slide', led: true } });
      } catch {
        return;
      }
      const wide = innerWidth >= 860;
      snGarden.distK = wide ? 1.14 : 1;
      snGarden.setOffset(wide ? -Math.round(innerWidth * 0.12) : 0, wide ? 0 : Math.round(snStage.clientHeight * 0.08));
      snGarden.view = Object.assign({}, snGarden.viewT);
      render();
      snStage.classList.add('sn-ready');
      if (inView) snGarden.start();
    };

    if ('IntersectionObserver' in window) {
      // wczytanie trochę wcześniej, rysowanie tylko gdy scena jest na ekranie
      new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !booted) boot();
        },
        { rootMargin: '700px 0px' }
      ).observe(track);
      new IntersectionObserver(
        ([e]) => {
          inView = e.isIntersecting;
          if (!snGarden) return;
          inView ? snGarden.start() : snGarden.stop();
          if (!inView) document.body.classList.remove('in-seasons');
        },
        { rootMargin: '0px' }
      ).observe(snStage.closest('.sn-sticky'));
    } else {
      boot();
    }

    let ticking = false;
    addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          render();
        });
      },
      { passive: true }
    );
    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!snGarden) return;
        const wide = innerWidth >= 860;
        snGarden.distK = wide ? 1.14 : 1;
        snGarden.setOffset(wide ? -Math.round(innerWidth * 0.12) : 0, wide ? 0 : Math.round(snStage.clientHeight * 0.08));
      }, 120);
    });
    render();
    if (reduce) root.classList.add('reduce');
  }
})();
