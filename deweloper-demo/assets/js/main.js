/* Szablon strony dewelopera: inwestycje, wyszukiwarka, wybór piętra na wizualizacji, karta lokalu,
   kalkulator raty, formularz 2-krokowy, ulubione, cennik za e-mail. Każda konwersja trafia do window.dataLayer. */
(() => {
  'use strict';
  const D = window.DEV;
  const PL = window.DEV_PLANS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const nb = ' ';
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, nb);
  const zl = (n) => `${num(n)}${nb}zł`;
  const m2 = (a) => `${String(a).replace('.', ',')}${nb}m²`;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const invById = Object.fromEntries(D.investments.map((i) => [i.id, i]));
  const aptById = Object.fromEntries(D.apartments.map((a) => [a.id, a]));
  const imgSrc = (k) => (window.DEV_IMG && window.DEV_IMG[k]) || `assets/img/${k}`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* tryb prywatny */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* tryb prywatny */ } },
  };
  // pomiar konwersji: Google Tag Manager / GA4 czyta window.dataLayer
  window.dataLayer = window.dataLayer || [];
  const track = (event, data = {}) => window.dataLayer.push({ event, ...data });

  const rate = (price, own = D.credit.own, years = D.credit.years, pct = D.credit.rate) => {
    const L = price * (1 - own / 100);
    const r = pct / 100 / 12;
    const n = years * 12;
    return (L * r) / (1 - Math.pow(1 + r, -n));
  };
  const roomsLabel = (n) => (n === 1 ? '1 pokój' : n < 5 ? `${n} pokoje` : `${n} pokoi`);
  const floorLabel = (f) => (f === 0 ? 'parter' : `${f}. piętro`);
  const stLabel = { free: 'Dostępne', reserved: 'Rezerwacja', sold: 'Sprzedane' };

  // ---------- komunikat ----------
  const toastEl = $('.toast');
  let toastT = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 3000);
  };

  // wstaw godziny pracy do tekstów
  $$('.ticks li').forEach((li) => { li.innerHTML = li.innerHTML.replace('{{hours}}', D.company.hours.split(',')[0]); });
  // telefon: pomiar kliknięć
  document.addEventListener('click', (e) => { const a = e.target.closest('.js-call'); if (a) track('phone_click', { where: a.closest('[class]') ? a.closest('[class]').className.split(' ')[0] : '' }); });

  // =====================================================================
  // Okna (modal / arkusz na telefonie): fokus, Escape, blokada przewijania
  // =====================================================================
  const stack = [];
  const lock = () => document.documentElement.classList.toggle('is-locked', stack.length > 0);
  function openModal(id, opener) {
    const m = document.getElementById(id);
    if (!m) return;
    clearTimeout(m._t);
    m.classList.remove('is-leaving');
    if (m.hidden) stack.push({ m, opener: opener || document.activeElement });
    m.hidden = false;
    lock();
    const f = $('input:not([type="hidden"]), button.btn, .modal__x', $('.modal__panel', m));
    requestAnimationFrame(() => { const first = matchMedia('(pointer: fine)').matches ? $('input', m) || $('.modal__x', m) : $('.modal__x', m); first && first.focus({ preventScroll: true }); });
    void f;
  }
  function closeModal(m) {
    const i = stack.findIndex((s) => s.m === m);
    if (i < 0) return;
    const { opener } = stack.splice(i, 1)[0];
    m.classList.add('is-leaving');
    m._t = setTimeout(() => { m.hidden = true; m.classList.remove('is-leaving'); }, 240);
    lock();
    opener && opener.focus && opener.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.js-close');
    if (c) closeModal(c.closest('.modal'));
  });
  addEventListener('keydown', (e) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') closeModal(top.m);
    if (e.key === 'Tab') {
      const f = $$('a[href], button, input, select, summary, [tabindex="0"]', $('.modal__panel', top.m)).filter((el) => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // =====================================================================
  // Ulubione
  // =====================================================================
  let favs = new Set(store.get('dev-favs', []).filter((id) => aptById[id]));
  const favBtn = $('.js-favs');
  const syncFavs = (bump) => {
    $('.js-fav-count').textContent = favs.size;
    favBtn.dataset.n = favs.size;
    $$('.heart[data-fav]').forEach((h) => h.setAttribute('aria-pressed', String(favs.has(h.dataset.fav))));
    if (bump && !reduce) { favBtn.classList.remove('is-bump'); void favBtn.offsetWidth; favBtn.classList.add('is-bump'); }
  };
  const toggleFav = (id) => {
    if (favs.has(id)) favs.delete(id); else { favs.add(id); track('add_to_wishlist', { apt: id }); }
    store.set('dev-favs', [...favs]);
    syncFavs(true);
    toast(favs.has(id) ? 'Dodano do ulubionych' : 'Usunięto z ulubionych');
  };
  const heart = (a) => `<button type="button" class="heart" data-fav="${a.id}" aria-pressed="${favs.has(a.id)}" aria-label="Ulubione: ${a.code}"><svg class="ic"><use href="#i-heart"/></svg></button>`;
  document.addEventListener('click', (e) => {
    const h = e.target.closest('.heart[data-fav]');
    if (h) { e.stopPropagation(); toggleFav(h.dataset.fav); }
  }, true);
  favBtn.addEventListener('click', () => {
    const list = [...favs].map((id) => aptById[id]);
    $('.js-favs-list').innerHTML = list.length
      ? `<div class="favl">${list.map((a) => `<a href="#" data-open="${a.id}"><span><b>${a.code}</b> · ${invById[a.inv].name}<br><small>${roomsLabel(a.rooms)}, ${m2(a.area)}, ${floorLabel(a.floor)}</small></span><b>${zl(a.price)}</b></a>`).join('')}</div><button type="button" class="btn btn--accent btn--block js-lead" data-src="favs" data-note="Ulubione: ${list.map((a) => a.code).join(', ')}">Zapytaj o te mieszkania</button>`
      : '<p class="modal__sub">Kliknij serce przy mieszkaniu, żeby je tu zapisać.</p>';
    openModal('favs', favBtn);
  });

  // =====================================================================
  // Inwestycje, realizacje, opinie, pakiety
  // =====================================================================
  const stats = (invId) => {
    const all = D.apartments.filter((a) => !invId || a.inv === invId);
    const free = all.filter((a) => a.status === 'free');
    return { all, free, minPrice: Math.min(...free.map((a) => a.price)), minPm: Math.min(...free.map((a) => a.pm)) };
  };
  $('.js-invs').innerHTML = D.investments.map((inv, i) => {
    const s = stats(inv.id);
    return `<article class="inv" data-reveal style="--i:${i}">
      <a href="#/inwestycja/${inv.id}" class="inv__img" aria-label="${esc(inv.name)}: szczegóły"><img src="${imgSrc(inv.img + '-m.webp')}" alt="Wizualizacja: ${esc(inv.name)}" loading="lazy" width="800" height="500"><span class="inv__badge ${inv.status === 'Gotowe do odbioru' ? 'inv__badge--ready' : ''}">${inv.status}</span></a>
      <div class="inv__body">
        <div class="inv__top"><div><h3>${inv.name}</h3><span class="inv__loc"><svg class="ic"><use href="#i-pin"/></svg>${inv.city}, ${inv.district}</span></div>
          <p class="inv__price"><small>od</small><b>${zl(s.minPrice)}</b><small>rata od ${zl(rate(s.minPrice))}/mies.</small></p></div>
        <p>${inv.lead}</p>
        <ul class="inv__tags">${inv.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
        <div class="avail"><p><span>Dostępne mieszkania</span><b>${s.free.length} z ${s.all.length}</b></p><span class="avail__bar"><i style="--p:${(s.free.length / s.all.length).toFixed(2)}"></i></span><p><span>Odbiór</span><b>${inv.handover}</b></p></div>
        <a class="btn btn--accent btn--block" href="#/inwestycja/${inv.id}">Wybierz mieszkanie z rzutu<svg class="ic"><use href="#i-arrow"/></svg></a>
      </div></article>`;
  }).join('');
  $('.js-ft-invs').insertAdjacentHTML('beforeend', D.investments.map((i) => `<a href="#/inwestycja/${i.id}">${i.name}</a>`).join(''));
  $('.js-real').innerHTML = D.realizations.map((r, i) => `<figure data-reveal style="--i:${i}"><div class="real__img"><img src="${imgSrc(r.img + '-m.webp')}" alt="${esc(r.name)}" loading="lazy" width="600" height="400"></div><figcaption><b>${r.name}</b><span>${r.city} · ${r.year} · ${r.units} mieszkań</span></figcaption></figure>`).join('');
  const starRow = (n) => `<p class="stars" aria-label="${n} na 5">${'<svg class="ic"><use href="#i-star"/></svg>'.repeat(n)}</p>`;
  $('.js-reviews').innerHTML = D.reviews.map((r, i) => `<blockquote class="rv" data-reveal style="--i:${i}">${starRow(r.stars)}<p>„${r.text}”</p><footer><b>${r.name}</b> <span>· ${r.where}</span></footer></blockquote>`).join('');

  const pkEl = $('.js-pk');
  const SW = { none: ['#d9d6d0', '#c9c5be', '#ebe8e2'], base: ['#b98f62', '#e8e4dc', '#9aa29a'], prem: ['#c7a274', '#d9d2c6', '#2f3a35'] };
  const renderPk = (area) => {
    pkEl.innerHTML = D.packages.map((p) => {
      const price = p.perM2 ? p.perM2 * area : 0;
      return `<article class="pk__c ${p.id === 'base' ? 'is-best' : ''}">${p.id === 'base' ? '<span class="pk__tag">Wybiera 7 na 10 klientów</span>' : ''}<div class="pk__sw">${SW[p.id].map((c) => `<i style="background:${c}"></i>`).join('')}</div><h3>${p.name}</h3><p>${p.note}</p><p class="pk__price tnum">${price ? zl(Math.round(price / 100) * 100) : 'W cenie'}<small>${price ? `${num(p.perM2)} zł/m², gotowe w 10 tygodni` : 'mieszkania'}</small></p></article>`;
    }).join('');
  };
  const pkArea = $('[data-pk-area]');
  pkArea.addEventListener('input', () => { $('.js-pk-area').textContent = `${pkArea.value} m²`; renderPk(+pkArea.value); });
  renderPk(50);

  // =====================================================================
  // Wyszukiwarka mieszkań
  // =====================================================================
  function makeFinder(host, fixedInv) {
    const pool = D.apartments.filter((a) => !fixedInv || a.inv === fixedInv);
    const prices = pool.map((a) => a.price);
    const PMAX = Math.ceil(Math.max(...prices) / 50000) * 50000;
    const st = { inv: fixedInv || '', rooms: new Set(), floor: '', max: PMAX, area: 0, onlyFree: true, sort: 'price', shown: 12 };
    const floors = [...new Set(pool.map((a) => a.floor))].sort((a, b) => a - b);
    host.innerHTML = `
      <form class="fl" aria-label="Filtry mieszkań">
        ${fixedInv ? '' : `<label class="fl__g"><span>Inwestycja</span><select name="inv"><option value="">Wszystkie</option>${D.investments.map((i) => `<option value="${i.id}">${i.name}</option>`).join('')}</select></label>`}
        <div class="fl__g"><span>Pokoje</span><div class="chips">${[1, 2, 3, 4].map((n) => `<button type="button" class="chip" data-rooms="${n}" aria-pressed="false">${n === 4 ? '4+' : n}</button>`).join('')}</div></div>
        <button type="button" class="fl__more" aria-expanded="false"><svg class="ic"><use href="#i-filter"/></svg>Więcej filtrów</button>
        <label class="fl__g fl__x"><span>Piętro</span><select name="floor"><option value="">Każde</option>${floors.map((f) => `<option value="${f}">${floorLabel(f)}</option>`).join('')}</select></label>
        <label class="fl__g range2 fl__x"><span>Cena do <b class="js-max"></b></span><input type="range" name="max" min="250000" max="${PMAX}" step="10000" value="${PMAX}"></label>
        <label class="fl__g range2 fl__x"><span>Metraż od <b class="js-area"></b></span><input type="range" name="area" min="0" max="80" step="2" value="0"></label>
        <div class="fl__g fl__x"><span>Status</span><div class="chips"><button type="button" class="chip" data-free aria-pressed="true">Tylko dostępne</button></div></div>
        <button type="button" class="fl__reset">Wyczyść</button>
      </form>
      <div class="res__bar"><p><b class="js-count">0</b> mieszkań</p><label>Sortuj: <select name="sort" class="js-sort"><option value="price">cena rosnąco</option><option value="pm">cena za m²</option><option value="area">metraż</option><option value="floor">piętro</option></select></label></div>
      <div class="res" role="list"></div>
      <button type="button" class="btn btn--line more">Pokaż więcej</button>`;
    const form = $('.fl', host);
    const res = $('.res', host);
    const more = $('.more', host);
    const list = () => {
      let l = pool.filter((a) => (!st.inv || a.inv === st.inv)
        && (!st.rooms.size || st.rooms.has(Math.min(4, a.rooms)))
        && (st.floor === '' || a.floor === +st.floor)
        && a.price <= st.max && a.area >= st.area
        && (!st.onlyFree || a.status !== 'sold'));
      const key = { price: (a) => a.price, pm: (a) => a.pm, area: (a) => -a.area, floor: (a) => a.floor }[st.sort];
      l.sort((a, b) => (a.status === 'sold') - (b.status === 'sold') || key(a) - key(b));
      return l;
    };
    const row = (a) => {
      const inv = invById[a.inv];
      return `<article class="row ${a.status === 'sold' ? 'is-sold' : ''}" role="listitem" data-open="${a.id}" tabindex="0" aria-label="${a.code}, ${roomsLabel(a.rooms)}, ${m2(a.area)}, ${zl(a.price)}">
        <div class="row__plan">${PL.plan(a.layout, null, { mini: true, outdoor: a.outdoor })}</div>
        <div class="row__id"><b>${a.code}${a.promo ? '<span class="promo">PROMOCJA</span>' : ''}</b><span>${fixedInv ? a.exposure : inv.name}</span></div>
        <div class="row__meta">
          <div class="row__c"><span>Pokoje</span><b>${a.rooms}</b></div>
          <div class="row__c"><span>Metraż</span><b>${m2(a.area)}</b></div>
          <div class="row__c"><span>Piętro</span><b>${a.floor === 0 ? 'parter' : a.floor}</b></div>
          <div class="row__c"><span>${a.outdoor[0]}</span><b>${m2(a.outdoor[1])}</b></div>
          <div class="row__c row__price"><span class="st st--${a.status}">${stLabel[a.status]}</span><b>${zl(a.price)}</b>${a.promo ? `<s>${zl(a.was)}</s>` : `<span>${zl(a.pm)}/m² · rata ${zl(rate(a.price))}</span>`}</div>
        </div>
        <div class="row__act">${heart(a)}<span class="btn btn--line btn--sm">Szczegóły</span></div>
      </article>`;
    };
    const render = () => {
      const l = list();
      $('.js-count', host).textContent = l.length;
      $('.js-max', host).textContent = zl(st.max);
      $('.js-area', host).textContent = st.area ? m2(st.area) : 'dowolny';
      res.innerHTML = l.length ? l.slice(0, st.shown).map(row).join('') : `<div class="empty"><p>Nie mamy teraz mieszkania z tymi parametrami. Zostaw numer, a damy znać jako pierwszym, gdy się pojawi.</p><button type="button" class="btn btn--accent js-lead" data-src="finder-empty" data-note="Szukam: ${esc(describe())}">Powiadom mnie</button></div>`;
      more.hidden = l.length <= st.shown;
      more.textContent = `Pokaż więcej (${l.length - st.shown})`;
    };
    const describe = () => [st.rooms.size ? `${[...st.rooms].join('/')} pok.` : '', st.inv ? invById[st.inv].name : '', st.max < PMAX ? `do ${zl(st.max)}` : '', st.area ? `od ${m2(st.area)}` : ''].filter(Boolean).join(', ') || 'dowolne mieszkanie';
    form.addEventListener('click', (e) => {
      const c = e.target.closest('[data-rooms]');
      if (c) { const n = +c.dataset.rooms; st.rooms.has(n) ? st.rooms.delete(n) : st.rooms.add(n); c.setAttribute('aria-pressed', String(st.rooms.has(n))); st.shown = 12; render(); }
      const f = e.target.closest('[data-free]');
      if (f) { st.onlyFree = !st.onlyFree; f.setAttribute('aria-pressed', String(st.onlyFree)); render(); }
      const mo = e.target.closest('.fl__more');
      if (mo) { const open = form.classList.toggle('is-open'); mo.setAttribute('aria-expanded', String(open)); mo.lastChild.textContent = open ? 'Mniej filtrów' : 'Więcej filtrów'; }
      if (e.target.closest('.fl__reset')) api.set({ rooms: [], floor: '', max: PMAX, area: 0, inv: fixedInv || '' });
    });
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (t.name === 'max') st.max = +t.value;
      if (t.name === 'area') st.area = +t.value;
      if (t.name === 'floor') st.floor = t.value;
      if (t.name === 'inv') st.inv = t.value;
      st.shown = 12;
      render();
    });
    $('.js-sort', host).addEventListener('change', (e) => { st.sort = e.target.value; render(); });
    more.addEventListener('click', () => { st.shown += 12; render(); });
    const api = {
      set(p) {
        if (p.rooms) { st.rooms = new Set(p.rooms); $$('[data-rooms]', form).forEach((c) => c.setAttribute('aria-pressed', String(st.rooms.has(+c.dataset.rooms)))); }
        if ('floor' in p) { st.floor = p.floor === '' ? '' : String(p.floor); form.elements.floor.value = st.floor; }
        if (p.max) { st.max = Math.min(PMAX, p.max); form.elements.max.value = st.max; }
        if ('area' in p) { st.area = p.area; form.elements.area.value = p.area; }
        if ('inv' in p && form.elements.inv) { st.inv = p.inv; form.elements.inv.value = p.inv; }
        st.shown = 12;
        render();
      },
      count(p) {
        const keep = { ...st, rooms: new Set(st.rooms) };
        Object.assign(st, { inv: p.inv || '', rooms: new Set(p.rooms || []), max: p.max || PMAX, floor: '', area: 0 });
        const n = list().length;
        Object.assign(st, keep);
        return n;
      },
      host,
    };
    render();
    return api;
  }
  // otwieranie karty lokalu z list, rzutów pięter i ulubionych
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open], .plate .u');
    if (!o) return;
    const id = o.dataset.open || o.dataset.apt;
    const a = aptById[id];
    if (!a || a.status === 'sold') return;
    e.preventDefault();
    openApt(id, o);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const o = e.target.closest('.row[data-open], .plate .u');
    if (!o) return;
    e.preventDefault();
    o.click();
  });

  const finder = makeFinder($('[data-finder]'));

  // szybka wyszukiwarka w hero: liczba wyników na żywo
  const qs = $('.qs');
  qs.elements.inv.insertAdjacentHTML('beforeend', D.investments.map((i) => `<option value="${i.id}">${i.name}, ${i.district}</option>`).join(''));
  const qsParams = () => ({ inv: qs.elements.inv.value, rooms: qs.elements.rooms.value ? [+qs.elements.rooms.value] : [], max: +qs.elements.max.value || 0 });
  const qsCount = () => { const n = finder.count(qsParams()); $('.js-qs-count').textContent = n ? `Pokaż ${n} ${n === 1 ? 'mieszkanie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'mieszkania' : 'mieszkań'}` : 'Powiadom o nowych'; };
  qs.addEventListener('change', qsCount);
  qs.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = qsParams();
    finder.set({ inv: p.inv, rooms: p.rooms, max: p.max || 9e9 });
    track('search', p);
    $('#mieszkania').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });
  qsCount();

  // =====================================================================
  // Kalkulator raty
  // =====================================================================
  const calc = $('[data-calc]');
  $('.js-c-pct').textContent = `${String(D.credit.rate).replace('.', ',')}%`;
  let rateShown = 0;
  let rateRaf = 0;
  const renderCalc = () => {
    const f = calc.elements;
    $('.js-c-price').textContent = zl(+f.price.value);
    $('.js-c-own').textContent = `${f.own.value}% · ${zl((+f.price.value * +f.own.value) / 100)}`;
    $('.js-c-years').textContent = `${f.years.value} lat`;
    const to = rate(+f.price.value, +f.own.value, +f.years.value);
    cancelAnimationFrame(rateRaf);
    if (reduce || !rateShown) { rateShown = to; $('.js-c-rate').textContent = zl(to); return; }
    const from = rateShown;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 260);
      rateShown = from + (to - from) * (1 - Math.pow(1 - t, 3));
      $('.js-c-rate').textContent = zl(rateShown);
      if (t < 1) rateRaf = requestAnimationFrame(step);
    };
    rateRaf = requestAnimationFrame(step);
  };
  calc.addEventListener('input', renderCalc);
  renderCalc();
  $('.js-calc-show').addEventListener('click', () => {
    finder.set({ max: +calc.elements.price.value });
    track('calc_to_search', { price: +calc.elements.price.value });
    $('#mieszkania').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  // =====================================================================
  // Formularz zapytania: 2 kroki (najpierw łatwe kliknięcia, potem kontakt)
  // =====================================================================
  const Q = [
    ['rooms', 'Ile pokoi?', ['1', '2', '3', '4+']],
    ['when', 'Kiedy chcesz się wprowadzić?', ['Od razu', 'W ciągu roku', 'Później']],
    ['money', 'Finansowanie', ['Kredyt', 'Gotówka', 'Jeszcze nie wiem']],
  ];
  function leadForm(host, ctx = {}) {
    const ans = {};
    const twoStep = !ctx.note;
    host.innerHTML = `<form class="lf" novalidate>
      ${twoStep ? '<p class="lf__prog"><span class="js-step">Krok 1 z 2</span><i style="--p:.5"></i></p>' : ''}
      <div class="lf__step" data-step="1" ${twoStep ? '' : 'hidden'}>
        ${Q.map(([k, q, opts]) => `<div class="lf__q"><span>${q}</span><div class="chips">${opts.map((o) => `<button type="button" class="chip" data-q="${k}" data-v="${o}" aria-pressed="false">${o}</button>`).join('')}</div></div>`).join('')}
        <button type="button" class="btn btn--accent btn--block js-next">Dalej<svg class="ic"><use href="#i-arrow"/></svg></button>
        <p class="lf__safe"><svg class="ic"><use href="#i-shield"/></svg>Zajmie 20 sekund. Bez zobowiązań.</p>
      </div>
      <div class="lf__step" data-step="2" ${twoStep ? 'hidden' : ''}>
        ${ctx.note ? `<p class="lf__ctx">${esc(ctx.note)}</p>` : ''}
        <label class="field"><span>Imię</span><input name="name" autocomplete="given-name" required><em>Wpisz imię.</em></label>
        <label class="field"><span>Telefon</span><input name="tel" type="tel" inputmode="tel" autocomplete="tel" required placeholder="600 000 000"><em>Wpisz 9 cyfr numeru.</em></label>
        <label class="consent"><input type="checkbox" name="advisor"><span>Chcę bezpłatnej konsultacji z doradcą kredytowym</span></label>
        <label class="consent js-rodo"><input type="checkbox" name="rodo" required><span>Zgadzam się na kontakt telefoniczny w sprawie oferty. <a href="#faq">Polityka prywatności</a></span></label>
        <div class="lf__row">${twoStep ? '<button type="button" class="btn btn--line js-back" aria-label="Wstecz"><svg class="ic"><use href="#i-left"/></svg></button>' : ''}<button type="submit" class="btn btn--accent">Oddzwońcie do mnie</button></div>
        <p class="lf__safe"><svg class="ic"><use href="#i-phone"/></svg>Oddzwonimy w 15 minut w godzinach pracy biura.</p>
      </div>
      <div class="done" hidden><span class="done__ic"><svg class="ic"><use href="#i-check"/></svg></span><h3>Dziękujemy! Oddzwonimy w 15 minut.</h3><p class="js-done-txt"></p><small>Wersja demonstracyjna: nic nie zostało wysłane.</small></div>
    </form>`;
    const form = $('form', host);
    const s1 = $('[data-step="1"]', form);
    const s2 = $('[data-step="2"]', form);
    const go = (n) => {
      s1.hidden = n !== 1;
      s2.hidden = n !== 2;
      const cur = n === 1 ? s1 : s2;
      if (!reduce) { cur.classList.remove('is-enter'); void cur.offsetWidth; cur.classList.add('is-enter'); }
      if (twoStep) { $('.js-step', form).textContent = `Krok ${n} z 2`; $('.lf__prog i', form).style.setProperty('--p', n === 1 ? 0.5 : 1); }
      if (n === 2) { track('lead_step2', { form: ctx.src || '' }); setTimeout(() => form.elements.name.focus({ preventScroll: true }), 30); }
    };
    form.addEventListener('click', (e) => {
      const c = e.target.closest('[data-q]');
      if (c) {
        $$(`[data-q="${c.dataset.q}"]`, form).forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
        ans[c.dataset.q] = c.dataset.v;
        // po odpowiedzi na wszystkie pytania przejdź dalej sam
        if (Object.keys(ans).length === Q.length) setTimeout(() => go(2), reduce ? 0 : 220);
      }
      if (e.target.closest('.js-next')) go(2);
      if (e.target.closest('.js-back')) go(1);
    });
    $$('input', form).forEach((i) => i.addEventListener('input', () => { const f = i.closest('.field, .consent'); f && f.classList.remove('is-error'); }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const okName = f.name.value.trim().length > 1;
      const digits = f.tel.value.replace(/\D/g, '').replace(/^48(?=\d{9}$)/, '');
      const okTel = digits.length === 9;
      const okRodo = f.rodo.checked;
      f.name.closest('.field').classList.toggle('is-error', !okName);
      f.tel.closest('.field').classList.toggle('is-error', !okTel);
      $('.js-rodo', form).classList.toggle('is-error', !okRodo);
      if (!okName) return f.name.focus();
      if (!okTel) return f.tel.focus();
      if (!okRodo) return f.rodo.focus();
      const lead = { form: ctx.src || 'kontakt', apt: ctx.apt || '', note: ctx.note || '', ...ans, advisor: f.advisor.checked };
      track('generate_lead', lead);
      store.sset('dev-lead', '1');
      s1.hidden = true;
      s2.hidden = true;
      const prog = $('.lf__prog', form);
      if (prog) prog.hidden = true;
      $('.js-done-txt', form).textContent = `Zadzwonimy na ${digits.replace(/(\d{3})(?=\d)/g, '$1 ')}${ctx.note ? ` w sprawie: ${ctx.note}` : ''}.`;
      $('.done', form).hidden = false;
    });
  }
  leadForm($('[data-leadform="kontakt"]'), { src: 'kontakt' });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.js-lead');
    if (!b) return;
    e.preventDefault();
    const note = b.dataset.note || '';
    $('#lead-h').textContent = note ? 'Zapytaj o mieszkanie' : 'Umów prezentację';
    $('.js-lead-sub').textContent = note ? 'Oddzwonimy w 15 minut z odpowiedzią.' : 'Oddzwonimy w 15 minut i dobierzemy mieszkania.';
    leadForm($('[data-leadform="modal"]'), { src: b.dataset.src || 'cta', note, apt: b.dataset.apt || '' });
    track('lead_open', { src: b.dataset.src || '' });
    openModal('lead', b);
  });

  // =====================================================================
  // Karta mieszkania
  // =====================================================================
  function openApt(id, opener) {
    const a = aptById[id];
    if (!a) return;
    const inv = invById[a.inv];
    const L = D.layouts[a.layout];
    const sameLeft = D.apartments.filter((x) => x.inv === a.inv && x.rooms === a.rooms && x.status === 'free').length;
    const low30 = Math.min(...a.hist.map((h) => h[1]));
    const note = `${a.code}, ${inv.name}, ${roomsLabel(a.rooms)}, ${m2(a.area)}`;
    $('.js-apt').innerHTML = `
      <div class="apt">
        <div class="apt__plan">
          ${PL.plan(a.layout, L.parts, { outdoor: a.outdoor, label: `Rzut mieszkania ${a.code}` })}
          <ul class="apt__parts">${L.parts.map(([n, ar]) => `<li><span>${n}</span><b>${m2(ar)}</b></li>`).join('')}<li><span>${a.outdoor[0]}</span><b>${m2(a.outdoor[1])}</b></li></ul>
        </div>
        <div class="apt__info">
          <div><p class="eyebrow">${inv.name} · ${inv.district}</p><h2 id="apt-h2">Mieszkanie ${a.code}</h2></div>
          <dl class="apt__facts">
            <div><dt>Pokoje</dt><dd>${a.rooms}</dd></div><div><dt>Metraż</dt><dd>${m2(a.area)}</dd></div><div><dt>Piętro</dt><dd>${floorLabel(a.floor)}</dd></div>
            <div><dt>${a.outdoor[0][0].toUpperCase() + a.outdoor[0].slice(1)}</dt><dd>${m2(a.outdoor[1])}</dd></div><div><dt>Strony świata</dt><dd>${a.exposure}</dd></div><div><dt>Odbiór</dt><dd>${inv.handover}</dd></div>
          </dl>
          <div class="apt__price"><span class="st st--${a.status}">${stLabel[a.status]}${a.promo ? '<span class="promo">PROMOCJA</span>' : ''}</span><b>${zl(a.price)}</b><small>${zl(a.pm)}/m²${a.promo ? ` · wcześniej ${zl(a.was)}, najniższa cena z 30 dni przed obniżką: ${zl(low30 === a.price ? a.was : low30)}` : ''}</small></div>
          <p class="apt__rate"><span>Rata od (wkład ${D.credit.own}%, ${D.credit.years} lat)</span><b>${zl(rate(a.price))}/mies.</b></p>
          ${sameLeft <= 5 && a.status === 'free' ? `<p class="apt__scarce"><svg class="ic"><use href="#i-tag"/></svg>W tej inwestycji zostało ${sameLeft} wolnych mieszkań ${a.rooms}-pokojowych.</p>` : ''}
          <div class="apt__act">
            <button type="button" class="btn btn--accent btn--block js-lead" data-src="apt" data-apt="${a.id}" data-note="${esc(note)}">${a.status === 'reserved' ? 'Zapisz się na listę rezerwową' : 'Zapytaj o to mieszkanie'}</button>
            <div class="apt__act2"><button type="button" class="btn btn--line js-card" data-apt="${a.id}"><svg class="ic"><use href="#i-file"/></svg>Karta PDF</button>${heart(a)}<a class="btn btn--line js-call" href="tel:${D.company.phone}"><svg class="ic"><use href="#i-phone"/></svg>Zadzwoń</a></div>
          </div>
          <details class="hist"><summary>Historia ceny <svg class="ic"><use href="#i-down"/></svg></summary><table>${a.hist.map(([d, p]) => `<tr><td>${d.split('-').reverse().join('.')}</td><td>${zl(p)}</td></tr>`).join('')}</table></details>
        </div>
        <div class="apt__sticky"><p><b>${zl(a.price)}</b><small>rata od ${zl(rate(a.price))}/mies.</small></p><button type="button" class="btn btn--accent js-lead" data-src="apt-sticky" data-apt="${a.id}" data-note="${esc(note)}">Zapytaj</button></div>
      </div>`;
    track('view_item', { apt: a.id, inv: a.inv, price: a.price });
    openModal('apt', opener);
  }
  // karta PDF za e-mail (to samo okno co cennik)
  let priceCtx = 'cennik';
  const priceModal = $('#price');
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.js-card');
    if (!c) return;
    const a = aptById[c.dataset.apt];
    priceCtx = `karta ${a.code}`;
    $('#price-h').textContent = `Karta mieszkania ${a.code} (PDF)`;
    $('.mini', priceModal).hidden = false;
    $('.done', priceModal).hidden = true;
    openModal('price', c);
  });
  $('.js-price-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim());
    f.email.closest('.field').classList.toggle('is-error', !ok);
    f.rodo.closest('.consent').classList.toggle('is-error', !f.rodo.checked);
    if (!ok) return f.email.focus();
    if (!f.rodo.checked) return f.rodo.focus();
    track('generate_lead', { form: 'email', what: priceCtx });
    store.sset('dev-lead', '1');
    $('.mini', priceModal).hidden = true;
    $('.done', priceModal).hidden = false;
  });
  // przy próbie wyjścia (komputer, raz na sesję, po 10 s, gdy nic nie jest otwarte i nie zostawiono kontaktu)
  const t0 = Date.now();
  if (matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mouseout', (e) => {
      if (e.relatedTarget || e.clientY > 4 || Date.now() - t0 < 10000 || stack.length || store.sget('dev-exit') || store.sget('dev-lead')) return;
      store.sset('dev-exit', '1');
      priceCtx = 'cennik';
      $('#price-h').textContent = 'Cennik i rzuty wszystkich mieszkań';
      openModal('price');
      track('exit_intent_shown');
    });
  }

  // =====================================================================
  // Widok inwestycji (#/inwestycja/id)
  // =====================================================================
  const homeView = $('[data-view="home"]');
  const invView = $('[data-view="inv"]');
  let invFinder = null;
  function renderInv(id) {
    const inv = invById[id];
    const s = stats(id);
    const polys = (window.DEV_POLYS || {})[id] || [];
    const byFloor = (f) => D.apartments.filter((a) => a.inv === id && a.floor === f);
    invView.innerHTML = `
      <div class="wrap">
        <a class="iv__crumb" href="#/"><svg class="ic"><use href="#i-left"/></svg>Wszystkie inwestycje</a>
        <div class="iv__top">
          <div>
            <div class="facade">
              <img src="${imgSrc(inv.img + '.webp')}" alt="Wizualizacja: ${esc(inv.name)}" width="1600" height="1000">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Wybierz piętro">${polys.map((p, f) => `<polygon points="${p.map((q) => q.join(',')).join(' ')}" data-floor="${f}" tabindex="0" role="button" aria-label="${floorLabel(f)}"/>`).join('')}</svg>
              <div class="facade__tip" aria-hidden="true"></div>
              <p class="facade__hint">${matchMedia('(pointer: coarse)').matches ? 'Dotknij piętra, żeby zobaczyć lokale' : 'Najedź na piętro i kliknij'}</p>
            </div>
            <div class="plate">
              <div class="plate__head"><h3 class="js-plate-h"></h3><div class="chips js-plate-tabs">${Array.from({ length: inv.floors }, (_, f) => `<button type="button" class="chip" data-pf="${f}" aria-pressed="false">${f === 0 ? 'Parter' : f}</button>`).join('')}</div></div>
              <div class="js-plate"></div>
              <p class="legend"><span class="st st--free">dostępne</span><span class="st st--reserved">rezerwacja</span><span class="st st--sold">sprzedane</span></p>
            </div>
          </div>
          <aside class="iv__sum">
            <div><p class="eyebrow">${inv.city}, ${inv.district}</p><h1>${inv.name}</h1></div>
            <p>${inv.lead}</p>
            <dl class="kv">
              <div><dt>Ceny od</dt><dd>${zl(s.minPrice)}</dd></div>
              <div><dt>Rata od</dt><dd>${zl(rate(s.minPrice))}/mies.</dd></div>
              <div><dt>Dostępne</dt><dd>${s.free.length} z ${s.all.length}</dd></div>
              <div><dt>Odbiór</dt><dd>${inv.handover}</dd></div>
            </dl>
            <ul class="inv__tags">${inv.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
            <button type="button" class="btn btn--accent btn--block js-lead" data-src="inv-${id}" data-note="Inwestycja ${esc(inv.name)}">Umów prezentację na budowie</button>
            <a class="btn btn--line btn--block js-call" href="tel:${D.company.phone}"><svg class="ic"><use href="#i-phone"/></svg>${D.company.phoneLabel}</a>
          </aside>
        </div>
        <section class="iv__sec" aria-labelledby="iv-apt-h"><div class="sec__head"><div><p class="eyebrow">Mieszkania</p><h2 id="iv-apt-h">Wszystkie lokale w ${inv.name}</h2></div></div><div class="finder" data-ifinder></div></section>
        <section class="iv__sec" aria-labelledby="iv-loc-h"><div class="poi"><div><p class="eyebrow">Lokalizacja</p><h2 id="iv-loc-h">Wszystko blisko.</h2><ul>${inv.poi.map(([n, t]) => `<li><span>${n}</span><b>${t}</b></li>`).join('')}</ul></div><div class="map">${PL.map(inv)}</div></div></section>
        <section class="iv__sec" aria-labelledby="iv-pr-h" style="padding-bottom:clamp(56px,7vw,96px)"><p class="eyebrow">Harmonogram</p><h2 id="iv-pr-h" style="margin-bottom:24px">Postęp budowy</h2><ol class="prog">${inv.progress.map(([n, d, p]) => `<li><i style="--p:${p}"></i><b>${n}</b><span>${d}${p === 1 ? ' · zrobione' : p > 0 ? ' · w trakcie' : ''}</span></li>`).join('')}</ol></section>
      </div>`;
    invFinder = makeFinder($('[data-ifinder]', invView), id);
    // rzut piętra
    const plate = $('.js-plate', invView);
    const setFloor = (f, fromFacade) => {
      $$('[data-pf]', invView).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.pf === f)));
      $$('.facade polygon', invView).forEach((p) => p.classList.toggle('is-on', +p.dataset.floor === f));
      const apts = byFloor(f);
      const free = apts.filter((a) => a.status === 'free').length;
      $('.js-plate-h', invView).textContent = `${f === 0 ? 'Parter' : `${f}. piętro`}: ${free} ${free === 1 ? 'wolne mieszkanie' : 'wolnych mieszkań'}`;
      plate.innerHTML = PL.floorPlate(apts, { fmt: zl, floorLabel: floorLabel(f) });
      if (fromFacade) { invFinder.set({ floor: f }); track('floor_select', { inv: id, floor: f }); }
    };
    $('.js-plate-tabs', invView).addEventListener('click', (e) => { const b = e.target.closest('[data-pf]'); if (b) setFloor(+b.dataset.pf, true); });
    // elewacja: podgląd piętra (wolne lokale, cena od)
    const fac = $('.facade', invView);
    const tip = $('.facade__tip', fac);
    const show = (p, x, y) => {
      const f = +p.dataset.floor;
      const apts = byFloor(f).filter((a) => a.status === 'free');
      $$('polygon', fac).forEach((q) => q.classList.toggle('is-hot', q === p));
      tip.innerHTML = `<b>${f === 0 ? 'Parter' : `${f}. piętro`}</b>${apts.length ? `${apts.length} wolne · od ${zl(Math.min(...apts.map((a) => a.price)))}` : 'brak wolnych mieszkań'}`;
      const r = fac.getBoundingClientRect();
      tip.style.left = `${x - r.left}px`;
      tip.style.top = `${y - r.top}px`;
      tip.classList.add('is-on');
    };
    $$('polygon', fac).forEach((p) => {
      p.addEventListener('pointermove', (e) => show(p, e.clientX, e.clientY));
      p.addEventListener('pointerleave', () => { tip.classList.remove('is-on'); p.classList.remove('is-hot'); });
      p.addEventListener('focus', () => { const b = p.getBoundingClientRect(); show(p, b.left + b.width / 2, b.top); });
      p.addEventListener('blur', () => tip.classList.remove('is-on'));
      const pick = () => { setFloor(+p.dataset.floor, true); $('.plate', invView).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); };
      p.addEventListener('click', pick);
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    const firstFree = [...Array(inv.floors).keys()].find((f) => byFloor(f).some((a) => a.status === 'free'));
    setFloor(firstFree === undefined ? 0 : firstFree, false);
    syncFavs();
  }

  // =====================================================================
  // Trasy: #/ (strona główna), #/inwestycja/id, #/lokal/id; zwykłe kotwice przewijają
  // =====================================================================
  let curInv = null;
  const showView = (v) => {
    const el = v === 'inv' ? invView : homeView;
    const other = v === 'inv' ? homeView : invView;
    if (!el.hidden) return false;
    other.hidden = true;
    el.hidden = false;
    if (!reduce) { el.classList.remove('is-enter'); void el.offsetWidth; el.classList.add('is-enter'); }
    return true;
  };
  function route() {
    const h = location.hash;
    let m;
    if ((m = h.match(/^#\/inwestycja\/([\w-]+)/)) && invById[m[1]]) {
      if (curInv !== m[1]) { renderInv(m[1]); curInv = m[1]; }
      showView('inv');
      scrollTo({ top: 0, behavior: 'auto' });
      document.title = `${invById[m[1]].name}: mieszkania od ${zl(stats(m[1]).minPrice)} | TWOJE LOGO`;
      track('view_investment', { inv: m[1] });
      return;
    }
    if ((m = h.match(/^#\/lokal\/([\w-]+)/)) && aptById[m[1]]) {
      showView('home');
      openApt(m[1]);
      return;
    }
    const changed = showView('home');
    document.title = 'Nowe mieszkania od dewelopera w Warszawie i Piasecznie | TWOJE LOGO';
    if (h === '#/' || h === '') { if (changed) scrollTo({ top: 0, behavior: 'auto' }); return; }
    const t = document.getElementById(h.slice(1));
    if (t && changed) requestAnimationFrame(() => t.scrollIntoView({ behavior: 'auto' }));
  }
  addEventListener('hashchange', route);
  route();

  // =====================================================================
  // Ujawnianie, liczniki, FAQ, pasek na telefonie
  // =====================================================================
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    revealIO.unobserve(en.target);
  }), { rootMargin: '0px 0px -10% 0px' }) : null;
  const watchReveal = () => $$('[data-reveal]:not(.is-in), [data-steps]:not(.is-in), .inv:not(.is-in)').forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add('is-in')));
  watchReveal();

  // liczniki w pasku zaufania: raz, przy wejściu na stronę
  if (!reduce) {
    $$('.js-num').forEach((el) => {
      const to = +el.dataset.n;
      const t1 = performance.now() + 500;
      const step = (now) => {
        const t = Math.max(0, Math.min(1, (now - t1) / 1100));
        el.textContent = num(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }

  $$('.faq__list details').forEach((d) => {
    const sum = $('summary', d);
    const body = $('div', d);
    let anim = null;
    sum.addEventListener('click', (e) => {
      if (reduce || !body.animate) return;
      e.preventDefault();
      const opening = !d.open || d.classList.contains('is-closing');
      const start = d.open ? body.getBoundingClientRect().height : 0;
      if (anim) anim.cancel();
      if (opening) {
        d.classList.remove('is-closing');
        d.open = true;
        anim = body.animate([{ height: `${start}px`, opacity: start ? 1 : 0 }, { height: `${body.scrollHeight}px`, opacity: 1 }], { duration: 260, easing: EASE_OUT });
      } else {
        d.classList.add('is-closing');
        anim = body.animate([{ height: `${start}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: EASE_OUT });
      }
      const a = anim;
      a.onfinish = () => { if (anim !== a) return; anim = null; if (!opening) { d.open = false; d.classList.remove('is-closing'); } };
    });
  });

  const mbar = $('.mbar');
  if ('IntersectionObserver' in window) {
    const vis = { top: true, cta: false };
    const upd = () => mbar.classList.toggle('is-on', !vis.top && !vis.cta);
    new IntersectionObserver(([en]) => { vis.top = en.isIntersecting; upd(); }).observe($('.hd'));
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;height:90vh;width:1px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(([en]) => { vis.top = en.isIntersecting; upd(); }).observe(sentinel);
    new IntersectionObserver(([en]) => { vis.cta = en.isIntersecting; upd(); }).observe($('#kontakt'));
  }
  syncFavs();
})();
