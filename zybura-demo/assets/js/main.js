/* Strona oferty ul. Jana Kazimierza 28 — interakcje poza spacerem 3D:
   konfigurator, zdjęcia, karuzela realizacji, ujawnianie przy przewijaniu, FAQ, WhatsApp, umawianie prezentacji. */
(() => {
  'use strict';
  const ZB = window.ZB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const fmt = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} zł`;
  // w wersji jednoplikowej obrazy siedzą w mapie window.ZB_IMG
  const src = (k) => (window.ZB_IMG && window.ZB_IMG[k]) || `assets/img/${k}`;
  const img = (id, size = '-m') => src(`${id}${size}.webp`);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* tryb prywatny */ } },
  };

  // ---------- komunikat ----------
  const toastEl = $('.toast');
  let toastT = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  };

  // ---------- nagłówek: materiał po zjechaniu z góry ----------
  const hd = $('.hd');
  let hdTick = false;
  const onScroll = () => {
    if (hdTick) return;
    hdTick = true;
    requestAnimationFrame(() => { hd.classList.toggle('is-solid', scrollY > 8); hdTick = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // =====================================================================
  // Konfigurator
  // =====================================================================
  const tourRoot = $('[data-tour]');
  const T = window.TOUR;
  const C = ZB.config;
  const state = { styl: 'obecny', sciany: 'bez', podloga: 'panele', kuchnia: 'braz', walls: {} };
  let tourMode = 'doll';
  let tourRoom = null;

  const swatch = {
    styl: (o) => ({ obecny: `background-image:url(${img('salon-1')})`, odswiezony: `background-image:url(${img('salon-wiz')})`, puste: 'background:linear-gradient(135deg,#f3f0eb,#dcd5cb)' }[o.id]),
    sciany: (o) => `background:${o.color}`,
    podloga: () => '',
    kuchnia: (o) => (o.id === 'braz' ? 'background:linear-gradient(135deg,#9c603a,#6c3b20)' : `background:${o.color}`),
  };
  const wallIcon = {
    kuchnia: '<svg viewBox="0 0 44 44" aria-hidden="true"><rect class="w-room" x="3" y="7" width="14" height="30" rx="2"/><rect class="w-room" x="20" y="7" width="21" height="30" rx="2"/><rect class="w-hit" x="17" y="7" width="3" height="30"/></svg>',
    hol: '<svg viewBox="0 0 44 44" aria-hidden="true"><rect class="w-room" x="3" y="3" width="38" height="20" rx="2"/><rect class="w-room" x="3" y="26" width="38" height="15" rx="2"/><rect class="w-hit" x="3" y="23" width="38" height="3"/></svg>',
  };

  const panels = {};
  $$('[data-panel]').forEach((p) => { panels[p.dataset.panel] = p; });

  ['styl', 'sciany', 'podloga', 'kuchnia'].forEach((key) => {
    const p = panels[key];
    if (!p) return;
    const dot = key === 'sciany' || key === 'kuchnia';
    p.innerHTML = C[key].map((o) => {
      const sw = key === 'podloga' ? `<i class="tex-${o.id}"></i>` : `<i style="${swatch[key](o)}"></i>`;
      return `<button type="button" class="opt${dot ? ' opt--dot' : ''}" data-key="${key}" data-val="${o.id}" aria-pressed="${state[key] === o.id}">${sw}<span><b>${o.name}</b><small>${o.note}</small></span></button>`;
    }).join('');
  });
  if (panels.wyburz) {
    panels.wyburz.innerHTML = ZB.walls.map((w) => `<button type="button" class="opt opt--wall" data-wall="${w.id}" aria-pressed="false">${wallIcon[w.id] || ''}<span><b>${w.name}</b><small>${w.note} · ≈ ${fmt(w.cost)}</small></span></button>`).join('')
      + '<p class="cfg__note">Ściany działowe. Przed remontem: opinia konstruktora.</p>';
  }

  // zakładki (klawiatura: strzałki)
  const tabs = $$('.cfg__tabs [role="tab"]');
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = panels[t.dataset.tab];
      if (p) p.hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus();
      selectTab(n);
    });
  });

  // koszt zmian: liczby dojeżdżają do nowej wartości (od wartości bieżącej, więc szybkie klikanie nie skacze)
  const costEl = $('.js-cost');
  const totalEl = $('.js-total');
  const shown = { cost: 0, total: ZB.offer.price + ZB.offer.garage };
  let numRaf = 0;
  const cost = () => {
    const pick = (key) => C[key].find((o) => o.id === state[key]) || C[key][0];
    let sum = pick('styl').cost + pick('sciany').cost + pick('kuchnia').cost + pick('podloga').rate * C.floorArea;
    ZB.walls.forEach((w) => { if (state.walls[w.id]) sum += w.cost; });
    return Math.round(sum / 100) * 100;
  };
  const renderCost = () => {
    const to = { cost: cost(), total: 0 };
    to.total = ZB.offer.price + ZB.offer.garage + to.cost;
    cancelAnimationFrame(numRaf);
    if (reduce) {
      Object.assign(shown, to);
      costEl.textContent = (to.cost ? '+ ' : '') + fmt(to.cost);
      totalEl.textContent = fmt(to.total);
      return;
    }
    const from = { ...shown };
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 380);
      const k = 1 - Math.pow(1 - t, 3);
      shown.cost = from.cost + (to.cost - from.cost) * k;
      shown.total = from.total + (to.total - from.total) * k;
      costEl.textContent = (to.cost ? '+ ' : '') + fmt(shown.cost);
      totalEl.textContent = fmt(shown.total);
      if (t < 1) numRaf = requestAnimationFrame(step);
    };
    numRaf = requestAnimationFrame(step);
  };

  const syncPressed = () => {
    $$('.opt[data-key]').forEach((b) => b.setAttribute('aria-pressed', String(state[b.dataset.key] === b.dataset.val)));
    $$('.opt[data-wall]').forEach((b) => b.setAttribute('aria-pressed', String(!!state.walls[b.dataset.wall])));
  };

  // pokoje, z których widać daną ścianę w spacerze
  const wallRooms = { kuchnia: ['kuchnia', 'salon'], hol: ['przedpokoj', 'salon'] };

  // wybór wnętrza ustawia cały zestaw: ściany, podłogę i kuchnię (wariant po odświeżeniu to pełny projekt)
  const PRESET = {
    obecny: { sciany: 'bez', podloga: 'panele', kuchnia: 'braz' },
    puste: { sciany: 'bez', podloga: 'panele', kuchnia: 'braz' },
    odswiezony: { sciany: 'biel', podloga: 'jodelka', kuchnia: 'szalwia' },
  };
  $('.cfg') && $('.cfg').addEventListener('click', (e) => {
    const o = e.target.closest('.opt[data-key]');
    if (o) {
      const key = o.dataset.key;
      const val = o.dataset.val;
      if (key === 'styl') {
        Object.assign(state, PRESET[val] || {}, { styl: val });
        T && T.set({ styl: val, ...(PRESET[val] || {}) });
      } else {
        state[key] = val;
        T && T.set({ [key]: val });
      }
      syncPressed();
      renderCost();
      return;
    }
    const w = e.target.closest('.opt[data-wall]');
    if (w && T) {
      const id = w.dataset.wall;
      // żeby było widać, jak ściana znika: z innego pokoju przenosimy widok na makietę
      if (tourMode !== 'doll' && !(tourMode === 'walk' && wallRooms[id].includes(tourRoom))) T.mode('doll');
      T.wall(id, !state.walls[id]);
    }
  });

  if (tourRoot) {
    tourRoot.addEventListener('tour:change', (e) => {
      const d = e.detail || {};
      if (d.mode) tourMode = d.mode;
      if ('room' in d) tourRoom = d.room;
      if (d.walls) {
        ZB.walls.forEach((w) => {
          const was = !!state.walls[w.id];
          const now = !!d.walls[w.id];
          if (!was && now) toast(`Wyburzone: ${w.name.toLowerCase()} · ≈ ${fmt(w.cost)}`);
        });
        state.walls = { ...d.walls };
        syncPressed();
        renderCost();
      }
    });
  }

  // ---------- porównanie „obecnie / po odświeżeniu” (linia przeciągana po widoku 3D) ----------
  const cmpBtn = $('.js-cmp');
  const cmpEl = $('.cmp');
  if (cmpBtn && cmpEl && T) {
    const stageEl = $('.tour__stage');
    const line = $('.cmp__line', cmpEl);
    let u = 0.5;
    let on = false;
    const place = () => { line.style.transform = 'translateX(' + (u * stageEl.clientWidth).toFixed(1) + 'px)'; };
    const setU = (v) => { u = Math.max(0.03, Math.min(0.97, v)); place(); T.compare(true, u); };
    const setOn = (v) => {
      on = v;
      cmpBtn.setAttribute('aria-pressed', String(on));
      cmpEl.hidden = !on;
      tourRoot.classList.toggle('is-cmp', on);
      if (on) { u = 0.5; place(); }
      T.compare(on, u);
      if (on) toast('Przeciągnij linię: po lewej obecnie, po prawej po odświeżeniu');
    };
    cmpBtn.addEventListener('click', () => setOn(!on));
    addEventListener('resize', () => on && place());
    let dragging = null;
    const down = (e) => {
      dragging = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    };
    const move = (e) => {
      if (dragging !== e.pointerId) return;
      const r = stageEl.getBoundingClientRect();
      setU((e.clientX - r.left) / r.width);
      e.stopPropagation();
    };
    const up = (e) => { if (dragging === e.pointerId) dragging = null; };
    $$('.cmp__knob, .cmp__hit', cmpEl).forEach((h) => {
      h.addEventListener('pointerdown', down);
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
    $('.cmp__knob', cmpEl).addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { setU(u - 0.05); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setU(u + 0.05); e.preventDefault(); }
    });
  }

  const changes = () => {
    const out = [];
    const name = (key) => (C[key].find((o) => o.id === state[key]) || {}).name;
    if (state.styl !== 'obecny') out.push(`wnętrze: ${name('styl')}`);
    if (state.sciany !== 'bez') out.push(`ściany: ${name('sciany')}`);
    if (state.podloga !== 'panele') out.push(`podłoga: ${name('podloga')}`);
    if (state.kuchnia !== 'braz') out.push(`kuchnia: ${name('kuchnia')}`);
    ZB.walls.forEach((w) => { if (state.walls[w.id]) out.push(`bez ściany (${w.name.toLowerCase()})`); });
    return out;
  };

  // =====================================================================
  // Zdjęcia z oferty + podgląd na pełnym ekranie
  // =====================================================================
  const photos = ZB.photos;
  const strip = $('.photos__track');
  if (strip) {
    strip.innerHTML = photos.map((p, i) => `<button type="button" class="${p.id.includes('wiz') ? 'is-wiz' : ''}" data-photo="${i}" aria-label="${p.alt}"><img src="${img(p.id)}" alt="" loading="lazy" width="760" height="570" draggable="false"></button>`).join('');
    strip.addEventListener('click', (e) => {
      const b = e.target.closest('[data-photo]');
      if (b) openLb(+b.dataset.photo, b);
    });
  }

  const lb = $('#lb');
  const lbImg = $('.lb__img', lb);
  const lbCap = $('.lb__cap', lb);
  let lbIndex = 0;
  let lbOpener = null;
  let lbT = 0;
  const lbShow = (i) => {
    lbIndex = (i + photos.length) % photos.length;
    const p = photos[lbIndex];
    lbImg.src = img(p.id, '');
    lbImg.alt = p.alt;
    lbCap.textContent = `${p.alt} · ${lbIndex + 1}/${photos.length}`;
    if (!reduce) { lbImg.style.animation = 'none'; void lbImg.offsetWidth; lbImg.style.animation = ''; }
  };
  function openLb(i, opener) {
    clearTimeout(lbT);
    lbOpener = opener || document.activeElement;
    lb.classList.remove('is-leaving');
    lbShow(i);
    lb.hidden = false;
    lock(true);
    $('.js-lb-close', lb).focus({ preventScroll: true });
  }
  const closeLb = () => {
    if (lb.hidden) return;
    lb.classList.add('is-leaving');
    lbT = setTimeout(() => { lb.hidden = true; lb.classList.remove('is-leaving'); }, 200);
    lock(false);
    lbOpener && lbOpener.focus && lbOpener.focus({ preventScroll: true });
  };
  $('.js-lb-close', lb).addEventListener('click', closeLb);
  $('.lb__prev', lb).addEventListener('click', () => lbShow(lbIndex - 1));
  $('.lb__next', lb).addEventListener('click', () => lbShow(lbIndex + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  let lbSwipe = null;
  lb.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') lbSwipe = { x: e.clientX, y: e.clientY }; });
  lb.addEventListener('pointerup', (e) => {
    if (!lbSwipe) return;
    const dx = e.clientX - lbSwipe.x;
    const dy = e.clientY - lbSwipe.y;
    lbSwipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    else if (dy > 80) closeLb();
  });
  tourRoot && tourRoot.addEventListener('tour:photo', (e) => {
    const id = e.detail && e.detail.photo;
    const i = photos.findIndex((p) => p.id === id);
    if (i >= 0) openLb(i, $('.js-tour-photo'));
  });

  // blokada przewijania strony pod warstwami
  let locks = 0;
  function lock(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle('is-locked', locks > 0);
  }

  // =====================================================================
  // Realizacje: karuzela — przeciąganie 1:1, rzut pędem, sprężyna do najbliższego kadru
  // =====================================================================
  const car = $('.car');
  const track = $('.car__track');
  if (car && track) {
    track.innerHTML = ZB.done.map((d) => `<article class="car__item"><figure><img src="${src(`r/${d.img}.webp`)}" alt="${d.kind}: ${d.place}, ${d.meta}" loading="lazy" width="760" height="573" draggable="false"></figure><div class="car__cap"><p><b>${d.place}</b><span>${d.meta}</span></p><em>${d.kind}</em></div></article>`).join('');

    const items = () => $$('.car__item', track);
    const maxScroll = () => car.scrollWidth - car.clientWidth;
    const snaps = () => {
      const pad = parseFloat(getComputedStyle(car).paddingLeft) || 0;
      const base = car.getBoundingClientRect().left;
      const m = maxScroll();
      return items().map((it) => Math.max(0, Math.min(m, car.scrollLeft + it.getBoundingClientRect().left - base - pad)));
    };
    const nearest = (x) => snaps().reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), 0);
    const rubber = (o, dim) => (o * dim * 0.55) / (dim + 0.55 * Math.abs(o));

    let anim = 0;
    const stop = () => { cancelAnimationFrame(anim); anim = 0; };
    // sprężyna krytycznie tłumiona (response 0,45 s); przejmuje prędkość palca/myszy
    const springTo = (target, v0 = 0, over0 = 0) => {
      stop();
      if (reduce) { car.scrollLeft = target; track.style.transform = ''; car.classList.remove('is-drag'); return; }
      const k = (2 * Math.PI / 0.45) ** 2;
      const c = 2 * Math.sqrt(k);
      let x = car.scrollLeft;
      let v = v0;
      let o = over0;
      let ov = 0;
      let last = performance.now();
      car.classList.add('is-drag');
      const tick = (now) => {
        const dt = Math.min(1 / 30, (now - last) / 1000);
        last = now;
        v += (-(x - target) * k - v * c) * dt;
        x += v * dt;
        ov += (-o * k - ov * c) * dt;
        o += ov * dt;
        car.scrollLeft = x;
        track.style.transform = Math.abs(o) > 0.5 ? `translateX(${-o}px)` : '';
        if (Math.abs(x - target) < 0.5 && Math.abs(v) < 8 && Math.abs(o) < 0.5) {
          car.scrollLeft = target;
          track.style.transform = '';
          car.classList.remove('is-drag');
          anim = 0;
          return;
        }
        anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
    };

    let drag = null;
    car.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return; // dotyk: natywne przewijanie z przyciąganiem
      stop();
      drag = { id: e.pointerId, x: e.clientX, left: car.scrollLeft, moved: false, over: 0, hist: [{ x: e.clientX, t: e.timeStamp }] };
    });
    car.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        car.setPointerCapture(e.pointerId);
        car.classList.add('is-drag');
      }
      const m = maxScroll();
      const want = drag.left - dx;
      const cl = Math.max(0, Math.min(m, want));
      car.scrollLeft = cl;
      drag.over = rubber(want - cl, car.clientWidth);
      track.style.transform = drag.over ? `translateX(${-drag.over}px)` : '';
      drag.hist.push({ x: e.clientX, t: e.timeStamp });
      if (drag.hist.length > 6) drag.hist.shift();
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      const a = d.hist[0];
      const b = d.hist[d.hist.length - 1];
      const fresh = e.timeStamp - b.t < 90;
      const v = fresh ? (-(b.x - a.x) / Math.max(1, b.t - a.t)) * 1000 : 0; // px/s w osi przewijania
      const projected = car.scrollLeft + ((v / 1000) * 0.998) / (1 - 0.998);
      springTo(nearest(projected), d.over ? 0 : v, d.over);
    };
    car.addEventListener('pointerup', release);
    car.addEventListener('pointercancel', release);

    $$('.js-car').forEach((b) => b.addEventListener('click', () => {
      const s = snaps();
      const cur = s.reduce((bi, x, i) => (Math.abs(x - car.scrollLeft) < Math.abs(s[bi] - car.scrollLeft) ? i : bi), 0);
      const next = Math.max(0, Math.min(s.length - 1, cur + Number(b.dataset.d)));
      springTo(s[next]);
    }));
  }

  // =====================================================================
  // Ujawnianie przy przewijaniu (raz) + linia procesu
  // =====================================================================
  const revealEls = [...$$('[data-reveal]'), ...$$('.rev').filter((el) => !el.closest('[data-reveal]')), ...$$('[data-proc]')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // =====================================================================
  // FAQ: wysokość + przezroczystość, przerywalne (startuje z bieżącej wysokości)
  // =====================================================================
  $$('.faq__list details').forEach((d) => {
    const sum = $('summary', d);
    const body = $('div', d);
    let anim = null;
    sum.addEventListener('click', (e) => {
      if (reduce || !body.animate) return;
      e.preventDefault();
      const closing = d.classList.contains('is-closing');
      const opening = !d.open || closing;
      const start = d.open ? body.getBoundingClientRect().height : 0;
      if (anim) anim.cancel();
      if (opening) {
        d.classList.remove('is-closing');
        d.open = true;
        const end = body.scrollHeight;
        anim = body.animate([{ height: `${start}px`, opacity: start ? 1 : 0 }, { height: `${end}px`, opacity: 1 }], { duration: 260, easing: EASE_OUT });
      } else {
        d.classList.add('is-closing');
        anim = body.animate([{ height: `${start}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: EASE_OUT });
      }
      const a = anim;
      a.onfinish = () => {
        if (anim !== a) return;
        anim = null;
        if (!opening) { d.open = false; d.classList.remove('is-closing'); }
      };
    });
  });

  // =====================================================================
  // Wejście/wyjście małych warstw (WhatsApp)
  // =====================================================================
  const show = (el) => { clearTimeout(el._t); el.classList.remove('is-leaving'); el.hidden = false; };
  const hide = (el, ms = 150) => {
    if (el.hidden) return;
    el.classList.add('is-leaving');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; el.classList.remove('is-leaving'); }, ms);
  };

  const wa = $('[data-wa]');
  if (wa) {
    const card = $('.wa__card', wa);
    const nudge = $('.wa__nudge', wa);
    const btn = $('.js-wa', wa);
    const link = $('.js-wa-link', wa);
    const waText = () => {
      let t = 'Dzień dobry, pytam o mieszkanie 2 pokoje, 53,5 m² przy ul. Jana Kazimierza 28.';
      const ch = changes();
      if (ch.length) t += ` Moja wersja z konfiguratora: ${ch.join(', ')}.`;
      return t;
    };
    const setHref = () => { link.href = `https://wa.me/${ZB.offer.whatsapp}?text=${encodeURIComponent(waText())}`; };
    const isOpen = () => !card.hidden && !card.classList.contains('is-leaving');
    const open = () => {
      setHref();
      hide(nudge);
      show(card);
      btn.setAttribute('aria-expanded', 'true');
      store.set('zb-wa', '1');
    };
    const close = () => { hide(card); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    nudge.addEventListener('click', open);
    $('.js-wa-close', wa).addEventListener('click', close);
    link.addEventListener('click', setHref);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { close(); btn.focus(); } });
    document.addEventListener('pointerdown', (e) => { if (isOpen() && !wa.contains(e.target)) close(); });
    // jedna podpowiedź na sesję, gdy ktoś już chwilę ogląda
    if (!store.get('zb-wa')) {
      setTimeout(() => {
        if (isOpen() || !$('#book').hidden) return;
        show(nudge);
        store.set('zb-wa', '1');
        setTimeout(() => hide(nudge), 8000);
      }, 14000);
    }
  }

  // =====================================================================
  // Umawianie prezentacji: modal (komputer) / arkusz od dołu z przeciąganiem (telefon)
  // =====================================================================
  const sheet = $('#book');
  const panel = $('.sheet__panel', sheet);
  const form = panel;
  const formBox = $('.sheet__form', sheet);
  const doneBox = $('.sheet__done', sheet);
  const cfgCheck = $('.js-book-cfg', sheet);
  const mobile = matchMedia('(max-width: 640px)');
  let sheetOpener = null;
  let sheetT = 0;

  const openSheet = (opener) => {
    clearTimeout(sheetT);
    sheetOpener = opener;
    sheet.classList.remove('is-leaving');
    panel.style.transform = '';
    panel.style.transition = '';
    formBox.hidden = false;
    doneBox.hidden = true;
    const ch = changes();
    cfgCheck.hidden = !ch.length;
    if (ch.length) {
      const n = ch.length;
      const word = n === 1 ? 'zmiana' : n < 5 ? 'zmiany' : 'zmian';
      $('span', cfgCheck).textContent = `Dołącz moją wersję z konfiguratora (${n} ${word})`;
    }
    const wasHidden = sheet.hidden;
    sheet.hidden = false;
    if (wasHidden) lock(true);
    setTimeout(() => { const f = $('input[name="name"]', sheet); if (f && !mobile.matches) f.focus({ preventScroll: true }); else $('.sheet__x', sheet).focus({ preventScroll: true }); }, 60);
  };
  const closeSheet = (fromDrag) => {
    if (sheet.hidden || sheet.classList.contains('is-leaving')) return;
    if (!fromDrag) { panel.style.transform = ''; panel.style.transition = ''; }
    sheet.classList.add('is-leaving');
    sheetT = setTimeout(() => {
      sheet.hidden = true;
      sheet.classList.remove('is-leaving');
      panel.style.transform = '';
      panel.style.transition = '';
    }, mobile.matches ? 280 : 180);
    lock(false);
    sheetOpener && sheetOpener.focus && sheetOpener.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.js-book');
    if (b) { e.preventDefault(); openSheet(b); return; }
    if (e.target.closest('.js-book-close')) closeSheet();
  });
  addEventListener('keydown', (e) => {
    if (sheet.hidden) {
      if (e.key === 'Escape' && !lb.hidden) closeLb();
      if (!lb.hidden && e.key === 'ArrowRight') lbShow(lbIndex + 1);
      if (!lb.hidden && e.key === 'ArrowLeft') lbShow(lbIndex - 1);
      return;
    }
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      const f = $$('button, input, a[href]', panel).filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // walidacja
  const fieldOk = {
    name: (v) => v.trim().length > 1,
    tel: (v) => v.replace(/\D/g, '').replace(/^48(?=\d{9}$)/, '').length >= 9,
  };
  $$('.field input', sheet).forEach((inp) => inp.addEventListener('input', () => inp.closest('.field').classList.remove('is-error')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let bad = null;
    ['name', 'tel'].forEach((n) => {
      const inp = form.elements[n];
      const ok = fieldOk[n](inp.value);
      inp.closest('.field').classList.toggle('is-error', !ok);
      inp.setAttribute('aria-invalid', String(!ok));
      if (!ok && !bad) bad = inp;
    });
    if (bad) { bad.focus(); return; }
    const when = form.elements.when.value;
    const withCfg = !cfgCheck.hidden && form.elements.cfg.checked;
    const digits = form.elements.tel.value.replace(/\D/g, '').slice(-9).replace(/(\d{3})(?=\d)/g, '$1 ');
    $('.js-done-txt', sheet).textContent = `Oddzwonię na ${digits}${when === 'Jak najszybciej' ? ' jeszcze dziś' : ` i ustalimy termin (${when.toLowerCase()})`}.${withCfg ? ' Pokażę też Twoją wersję mieszkania.' : ''}`;
    formBox.hidden = true;
    doneBox.hidden = false;
    $('.sheet__x', sheet).focus({ preventScroll: true });
    form.reset();
  });

  // telefon: przeciągnij arkusz w dół, by zamknąć (1:1, prędkość decyduje, opór przy ciągnięciu w górę)
  let sd = null;
  panel.addEventListener('pointerdown', (e) => {
    if (!mobile.matches || e.button > 0) return;
    if (e.target.closest('input, label, button, a')) return;
    sd = { id: e.pointerId, y: e.clientY, t: e.timeStamp, dy: 0, last: [{ y: e.clientY, t: e.timeStamp }] };
    panel.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  });
  panel.addEventListener('pointermove', (e) => {
    if (!sd || e.pointerId !== sd.id) return;
    const raw = e.clientY - sd.y;
    sd.dy = raw >= 0 ? raw : -((-raw * 60) / (60 + -raw)); // w górę: opór
    panel.style.transform = `translateY(${sd.dy}px)`;
    sd.last.push({ y: e.clientY, t: e.timeStamp });
    if (sd.last.length > 5) sd.last.shift();
  });
  const sheetRelease = (e) => {
    if (!sd || e.pointerId !== sd.id) return;
    const d = sd;
    sd = null;
    const a = d.last[0];
    const b = d.last[d.last.length - 1];
    const v = (b.y - a.y) / Math.max(1, b.t - a.t); // px/ms
    if (d.dy > panel.offsetHeight * 0.3 || (v > 0.11 && d.dy > 10)) {
      panel.style.transition = `transform 240ms ${EASE_OUT}`;
      panel.style.transform = 'translateY(100%)';
      closeSheet(true);
    } else {
      panel.style.transition = 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.transform = '';
    }
  };
  panel.addEventListener('pointerup', sheetRelease);
  panel.addEventListener('pointercancel', sheetRelease);

  // =====================================================================
  // Pasek CTA na telefonie: gdy przyciski z hero znikną z ekranu, a przed finałem
  // =====================================================================
  const mbar = $('.mbar');
  if (mbar && 'IntersectionObserver' in window) {
    const vis = { hero: true, final: false };
    const upd = () => mbar.classList.toggle('is-on', !vis.hero && !vis.final);
    const watch = (el, key) => {
      if (!el) return;
      new IntersectionObserver(([en]) => { vis[key] = en.isIntersecting; upd(); }).observe(el);
    };
    watch($('.hero__copy .ctas'), 'hero');
    watch($('.final .ctas'), 'final');
  }

  renderCost();
})();
