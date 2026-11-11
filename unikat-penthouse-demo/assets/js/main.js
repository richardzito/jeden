/* Strona oferty: nagłówek, pojawianie się sekcji, konfigurator, galeria, rzut, okolica,
   koszty z kalkulatorem raty, umawianie oglądania (demo bez wysyłki). */
(() => {
  'use strict';
  const PH = window.PH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => `${Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ')} zł`;
  const fmtNum = (n, d = 2) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* tryb prywatny */ } },
  };
  const img = (id, size = '') => `assets/img/${id}${size}.webp`;
  const photoUrl = (id, size) => (window.PH_IMG && window.PH_IMG[`${id}${size || ''}.webp`]) || img(id, size);

  // ---------- toast ----------
  const toastEl = $('.toast');
  let toastT = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };

  // ---------- nagłówek i pasek CTA ----------
  const header = $('.header');
  const hero = $('.hero');
  const mbar = $('.mbar');
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle('is-solid', y > 40);
    const past = y > hero.offsetHeight - 120;
    header.classList.toggle('is-past', past);
    mbar.classList.toggle('is-on', past && !inBook);
  };
  let inBook = false;
  const book = $('#kontakt');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { inBook = en[0].isIntersecting; onScroll(); }, { threshold: 0.15 }).observe(book);
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- pojawianie się sekcji ----------
  const io = 'IntersectionObserver' in window && !reduce
    ? new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  $$('[data-reveal]').forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')));

  // ---------- spacer 3D: przejście do pokoju z innych sekcji ----------
  const tourRoot = $('[data-tour]');
  const goRoom = (room) => {
    $('#spacer').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const tryGo = (n = 0) => {
      if (window.TOUR && window.TOUR.ready) window.TOUR.go(room);
      else if (n < 60) setTimeout(() => tryGo(n + 1), 250);
    };
    setTimeout(() => tryGo(), reduce ? 0 : 500);
  };
  $$('a[data-room]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goRoom(a.dataset.room); }));

  // ---------- konfigurator ----------
  const C = PH.config;
  const DEF = { floor: 'gres', walls: 'greige', kitchen: 'czarny', pokoj: 'praca', gabinet: 'gabinet', furniture: 'on' };
  const cfg = { ...DEF, ...store.get('ph-cfg', {}) };
  const opts = { floor: C.floor, walls: C.walls, kitchen: C.kitchen, pokoj: C.pokoj, gabinet: C.gabinet, furniture: C.furniture };
  $$('.cfg__group').forEach((g) => {
    const key = g.dataset.key;
    const box = $('.sw', g);
    box.innerHTML = opts[key].map((o) => {
      const pre = key === 'floor' ? `<i class="tex-${o.id}"></i>` : o.color ? `<i style="background:${o.color}"></i>` : '';
      return `<button type="button" data-v="${o.id}" aria-pressed="${cfg[key] === o.id}">${pre}<span>${o.name}<small>${o.note}</small></span></button>`;
    }).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      setCfg({ [key]: b.dataset.v });
    });
  });
  const costOf = (c) => {
    const f = C.floor.find((x) => x.id === c.floor);
    let sum = f ? f.rate * C.floorArea : 0;
    ['walls', 'kitchen', 'pokoj', 'gabinet'].forEach((k) => { const o = C[k].find((x) => x.id === c[k]); sum += o ? o.cost : 0; });
    return sum;
  };
  const describe = (c) => {
    const parts = [];
    ['floor', 'walls', 'kitchen'].forEach((k) => { if (c[k] !== DEF[k]) parts.push(`${{ floor: 'podłoga', walls: 'ściany', kitchen: 'fronty kuchni' }[k]}: ${C[k].find((x) => x.id === c[k]).name.toLowerCase()}`); });
    if (c.pokoj !== DEF.pokoj) parts.push(`pokój 10,46 m²: ${C.pokoj.find((x) => x.id === c.pokoj).name.toLowerCase()}`);
    if (c.gabinet !== DEF.gabinet) parts.push(`gabinet: ${C.gabinet.find((x) => x.id === c.gabinet).name.toLowerCase()}`);
    return parts;
  };
  const costEl = $('.js-cfg-cost');
  const totalEl = $('.js-cfg-total');
  const noteEl = $('.js-cfg-note');
  let shownCost = costOf(cfg);
  const animateNum = (el, from, to, wrap = fmt) => {
    if (reduce || from === to) { el.textContent = wrap(to); return; }
    const t0 = performance.now();
    const dur = 450;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = wrap(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  function renderCfg() {
    $$('.cfg__group').forEach((g) => $$('[data-v]', g).forEach((b) => b.setAttribute('aria-pressed', String(cfg[g.dataset.key] === b.dataset.v))));
    const cost = costOf(cfg);
    animateNum(costEl, shownCost, cost);
    animateNum(totalEl, PH.offer.price + PH.offer.parking + shownCost, PH.offer.price + PH.offer.parking + cost);
    shownCost = cost;
    const parts = describe(cfg);
    noteEl.textContent = parts.length ? `Zmiany: ${parts.join(', ')}.` : 'Stan obecny: gres drewnopodobny, ściany greige, czarne fronty kuchni.';
    updateCalc();
  }
  function setCfg(p) {
    Object.assign(cfg, p);
    store.set('ph-cfg', cfg);
    if (window.TOUR) window.TOUR.set(p);
    renderCfg();
  }
  if (window.TOUR) window.TOUR.set({ ...cfg });
  $('.js-cfg-reset').addEventListener('click', () => { setCfg({ ...DEF }); toast('Przywrócono stan obecny mieszkania'); });

  // wysłanie wersji z konfiguratora do formularza
  const bookCfg = $('.bookform__cfg');
  let cfgShot = null;
  $('.js-cfg-send').addEventListener('click', () => {
    const shot = window.TOUR && window.TOUR.snapshot();
    const parts = describe(cfg);
    const cost = costOf(cfg);
    cfgShot = { img: shot, text: parts.length ? `${parts.join(', ')} · koszt zmian ok. ${fmt(cost)}` : 'Stan obecny mieszkania (bez zmian).' };
    if (shot) $('img', bookCfg).src = shot;
    $('img', bookCfg).hidden = !shot;
    $('.js-book-cfg').textContent = cfgShot.text;
    bookCfg.hidden = false;
    book.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    toast('Twoja wersja dołączona do zgłoszenia');
  });
  $('.js-book-cfg-rm').addEventListener('click', () => { cfgShot = null; bookCfg.hidden = true; });

  // ---------- galeria pełnoekranowa ----------
  const lb = $('#lightbox');
  const lbImg = $('.lb__img', lb);
  const lbThumbs = $('.lb__thumbs', lb);
  const photos = PH.photos;
  let lbIndex = 0;
  let lbReturn = null;
  lbThumbs.innerHTML = photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="${p.alt}"><img src="${photoUrl(p.id, '-m')}" alt="" loading="lazy"></button>`).join('');
  const showPhoto = (i) => {
    lbIndex = (i + photos.length) % photos.length;
    const p = photos[lbIndex];
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth;
    lbImg.style.animation = '';
    lbImg.src = photoUrl(p.id, matchMedia('(max-width: 760px)').matches ? '-m' : '');
    lbImg.alt = p.alt;
    $('.lb__cap', lb).textContent = p.alt;
    $('.lb__count', lb).textContent = `${lbIndex + 1} / ${photos.length}`;
    $$('button', lbThumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === lbIndex)));
    const cur = lbThumbs.children[lbIndex];
    cur && cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const room = p.room && PH.rooms.find((r) => r.id === p.room);
    const b3 = $('.js-lb-3d', lb);
    b3.hidden = !room;
    if (room) b3.dataset.room = room.id;
  };
  const openLb = (id) => {
    lbReturn = document.activeElement;
    const i = Math.max(0, photos.findIndex((p) => p.id === id));
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    showPhoto(i);
    $('.js-lb-close', lb).focus();
  };
  const closeLb = () => {
    lb.hidden = true;
    document.documentElement.style.overflow = '';
    lbReturn && lbReturn.focus && lbReturn.focus();
  };
  window.PH_LIGHTBOX = { open: openLb };
  $$('[data-photo]').forEach((b) => b.addEventListener('click', () => openLb(b.dataset.photo)));
  $('.js-lb-close', lb).addEventListener('click', closeLb);
  $('.lb__prev', lb).addEventListener('click', () => showPhoto(lbIndex - 1));
  $('.lb__next', lb).addEventListener('click', () => showPhoto(lbIndex + 1));
  lbThumbs.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) showPhoto(+b.dataset.i); });
  $('.js-lb-book', lb).addEventListener('click', closeLb);
  $('.js-lb-3d', lb).addEventListener('click', (e) => { const r = e.currentTarget.dataset.room; closeLb(); goRoom(r); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
    else if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
    else if (e.key === 'Tab') {
      const f = $$('button:not([hidden]), a[href]', lb).filter((x) => x.offsetParent);
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // przesuwanie palcem
  let sx = null;
  let sy = 0;
  let st = 0;
  const stage = $('.lb__stage', lb);
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; st = performance.now(); } });
  stage.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const v = Math.abs(dx) / Math.max(1, performance.now() - st);
    if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > 60 || v > 0.4)) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
    sx = null;
  });
  stage.addEventListener('pointercancel', () => { sx = null; });
  tourRoot && tourRoot.addEventListener('tour:photo', (e) => { if (e.detail.photo) openLb(e.detail.photo); });

  // ---------- rzut ----------
  const planSvg = $('.plan__svg');
  const planList = $('.plan__list');
  const roomsById = Object.fromEntries(PH.rooms.map((r) => [r.id, r]));
  const planImg = (window.PH_IMG && window.PH_IMG['rzut.webp']) || 'assets/img/rzut.webp';
  planSvg.setAttribute('viewBox', '0 0 1840 1924');
  planSvg.innerHTML = `<image href="${planImg}" x="0" y="0" width="1840" height="1924"/>` + PH.rooms.map((r) => r.rects.map((q) => `<rect class="room" data-room="${r.id}" x="${q[0]}" y="${q[1]}" width="${q[2] - q[0]}" height="${q[3] - q[1]}"><title>${r.name} ${fmtNum(r.area)} m²</title></rect>`).join('')).join('');
  planList.innerHTML = PH.rooms.map((r) => `<li><button type="button" data-room="${r.id}" aria-pressed="false"><b>${r.name}</b><span>${fmtNum(r.area)} m²</span></button></li>`).join('');
  let planRoom = 'salon';
  const kinds = { taras: 'Na zewnątrz', loggia: 'Na zewnątrz', lazienka: 'Łazienka', lazienka2: 'Łazienka', pralnia: 'Pomieszczenie gospodarcze', przedpokoj: 'Komunikacja' };
  const selectPlan = (id) => {
    const r = roomsById[id];
    if (!r) return;
    planRoom = id;
    $$('.room', planSvg).forEach((el) => el.classList.toggle('is-on', el.dataset.room === id));
    $$('button', planList).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === id)));
    $('.js-plan-name').textContent = r.name;
    $('.js-plan-area').textContent = `${fmtNum(r.area)} m²`;
    $('.js-plan-kind').textContent = kinds[id] || 'Pokój';
    const fig = $('.plan__photo');
    const pi = $('img', fig);
    if (r.photos.length) { pi.src = photoUrl(r.photos[0], '-m'); pi.alt = r.name; fig.classList.remove('is-empty'); }
    else { fig.classList.add('is-empty'); pi.removeAttribute('src'); pi.alt = ''; }
    $('.js-plan-photo').hidden = !r.photos.length;
  };
  planSvg.addEventListener('click', (e) => { const el = e.target.closest('[data-room]'); if (el) selectPlan(el.dataset.room); });
  planSvg.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-room]'); $$('.room', planSvg).forEach((x) => x.classList.toggle('is-hover', !!el && x.dataset.room === el.dataset.room)); });
  planSvg.addEventListener('pointerleave', () => $$('.room', planSvg).forEach((x) => x.classList.remove('is-hover')));
  planList.addEventListener('click', (e) => { const b = e.target.closest('[data-room]'); if (b) selectPlan(b.dataset.room); });
  $('.js-plan-3d').addEventListener('click', () => goRoom(planRoom));
  $('.js-plan-photo').addEventListener('click', () => { const r = roomsById[planRoom]; if (r.photos.length) openLb(r.photos[0]); });
  selectPlan('salon');

  // ---------- okolica ----------
  const poiIcons = { Zakupy: 'i-cart', Komunikacja: 'i-train', Edukacja: 'i-school', 'Zieleń i zdrowie': 'i-tree', Dojazd: 'i-road' };
  const cats = ['Wszystko', ...new Set(PH.poi.map((p) => p.cat))];
  const filter = $('.loc__filter');
  const poiList = $('.poi');
  filter.innerHTML = cats.map((c, i) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${i === 0}">${c}</button>`).join('');
  const walkMin = (d) => Math.max(1, Math.round((d * 1.3) / 80));
  const renderPoi = (cat) => {
    const list = PH.poi.filter((p) => cat === 'Wszystko' || p.cat === cat).sort((a, b) => a.d - b.d);
    poiList.innerHTML = list.map((p, i) => `<li style="animation-delay:${i * 30}ms"><svg class="ic"><use href="#${poiIcons[p.cat]}"/></svg><span><b>${p.name}</b><small>${p.cat}</small></span><em>${p.d >= 1000 ? `${fmtNum(p.d / 1000, 1)} km` : `${p.d} m`}<small>≈ ${walkMin(p.d)} min pieszo</small></em></li>`).join('');
  };
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    $$('[data-cat]', filter).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderPoi(b.dataset.cat);
  });
  renderPoi('Wszystko');
  $$('.js-copy').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Adres skopiowany'); } catch (e) { toast(b.dataset.copy); }
  }));

  // ---------- koszty i kalkulator ----------
  const park = $('.js-park');
  const own = $('.js-own');
  const years = $('.js-years');
  const rate = $('.js-rate');
  const setRangeFill = (r) => r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
  function updateCalc() {
    const base = PH.offer.price + (park.checked ? PH.offer.parking : 0);
    $('.js-park-val').textContent = park.checked ? fmt(PH.offer.parking) : '—';
    $('.js-pcc').textContent = fmt(base * 0.02);
    const total = base + costOf(cfg);
    const ownPct = +own.value;
    const ownAmt = (total * ownPct) / 100;
    const loan = total - ownAmt;
    const n = +years.value * 12;
    const r = Math.max(0, parseFloat(String(rate.value).replace(',', '.')) || 0) / 100 / 12;
    const m = r ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
    $('.js-own-out').textContent = `${ownPct}% · ${fmt(ownAmt)}`;
    $('.js-years-out').textContent = `${years.value} lat`;
    $('.js-loan').textContent = fmt(loan);
    $('.js-month').textContent = fmt(m);
    setRangeFill(own);
    setRangeFill(years);
  }
  [park, own, years, rate].forEach((el) => el.addEventListener('input', updateCalc));
  renderCfg();

  // ---------- umawianie oglądania ----------
  const form = $('#bookform');
  const daysBox = $('.days', form);
  const timesBox = $('.times', form);
  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const days = [];
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  for (let i = 1; days.length < 12 && i < 30; i++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + i);
    if (d.getDay() !== 0) days.push(d);
  }
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  daysBox.innerHTML = days.map((d, i) => `<label class="day"><input type="radio" name="day" value="${dayKey(d)}" ${i === 0 ? 'checked' : ''}><span>${DOW[d.getDay()]}<b>${d.getDate()}</b>${MON[d.getMonth()]}</span></label>`).join('');
  const renderTimes = () => {
    const v = $('input[name=day]:checked', form).value;
    const d = days.find((x) => dayKey(x) === v);
    const hours = d.getDay() === 6 ? [10, 11, 12, 13, 14] : [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    timesBox.innerHTML = hours.map((h) => `<label class="time"><input type="radio" name="time" value="${h}:00"><span>${h}:00</span></label>`).join('');
  };
  daysBox.addEventListener('change', renderTimes);
  timesBox.addEventListener('change', () => timesBox.classList.remove('is-error'));
  renderTimes();
  const ctaTxt = $('.js-book-cta', form);
  const kindLabels = { 'Oglądanie na miejscu': 'Umów oglądanie', 'Wirtualne spotkanie (wideo)': 'Umów spotkanie wideo', 'Rozmowa z doradcą kredytowym': 'Umów rozmowę z doradcą' };
  form.addEventListener('change', (e) => { if (e.target.name === 'kind') ctaTxt.textContent = kindLabels[e.target.value]; });
  $$('[data-topic]').forEach((a) => a.addEventListener('click', () => {
    const topic = a.dataset.topic;
    if (topic === 'kredyt') { const r = $('input[name=kind][value^="Rozmowa"]', form); r.checked = true; ctaTxt.textContent = kindLabels[r.value]; }
    if (topic === 'pytanie') setTimeout(() => form.msg.focus({ preventScroll: true }), 600);
  }));
  $$('input, textarea', form).forEach((i) => i.addEventListener('input', () => { const f = i.closest('.field, .check'); f && f.classList.remove('is-error'); }));
  const validate = () => {
    let ok = true;
    const set = (id, bad) => { $(`#${id}`).classList.toggle('is-error', bad); if (bad) ok = false; };
    set('f-name', form.name.value.trim().length < 3);
    set('f-phone', form.phone.value.replace(/\D/g, '').replace(/^48(?=\d{9}$)/, '').length !== 9);
    set('f-email', !!form.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()));
    set('f-consent', !form.consent.checked);
    const t = $('input[name=time]:checked', form);
    timesBox.classList.toggle('is-error', !t);
    if (!t) { ok = false; toast('Wybierz godzinę spotkania'); }
    return ok;
  };
  const ics = (dayV, timeV, kind) => {
    const [y, mo, d] = dayV.split('-');
    const [h] = timeV.split(':');
    const st2 = `${y}${mo}${d}T${String(h).padStart(2, '0')}0000`;
    const en2 = `${y}${mo}${d}T${String(+h + 1).padStart(2, '0')}0000`;
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UNIKAT demo//PL', 'BEGIN:VEVENT', `UID:${Date.now()}@unikat-demo`, `DTSTART:${st2}`, `DTEND:${en2}`,
      `SUMMARY:${kind}: penthouse ul. Kłopot 4A`, 'LOCATION:ul. Kłopot 4A\\, 01-066 Warszawa', 'DESCRIPTION:Opiekun oferty: Adam Kijowski\\, tel. 798 600 414 (termin do potwierdzenia)', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) {
      const bad = $('.is-error input, .is-error', form);
      bad && bad.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    const dayV = $('input[name=day]:checked', form).value;
    const timeV = $('input[name=time]:checked', form).value;
    const kind = $('input[name=kind]:checked', form).value;
    const d = days.find((x) => dayKey(x) === dayV);
    const when = `${['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}, godz. ${timeV}`;
    $('.js-done-txt', form).textContent = `${kind} — ${when}. Adam Kijowski oddzwoni na numer ${form.phone.value.trim()}, żeby potwierdzić termin.${cfgShot ? ' Dołączyliśmy Twoją wersję z konfiguratora.' : ''}`;
    $('.js-ics', form).href = ics(dayV, timeV, kind);
    $('.bookform__done', form).hidden = false;
  });
  $('.js-book-again', form).addEventListener('click', () => {
    form.reset();
    $('.bookform__done', form).hidden = true;
    renderTimes();
    ctaTxt.textContent = kindLabels['Oglądanie na miejscu'];
  });

  // ---------- udostępnij, PDF ----------
  $$('.js-share').forEach((b) => b.addEventListener('click', async () => {
    const data = { title: document.title, text: 'Penthouse 101 m² z dwoma tarasami — Wola, ul. Kłopot 4A', url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('Link do oferty skopiowany'); }
    } catch (e) { /* anulowano */ }
  }));
  $$('.js-print').forEach((b) => b.addEventListener('click', () => window.print()));

  // ---------- tryb prezentacji ----------
  const demoBtn = $('.demo-btn');
  const drawer = $('#demo-drawer');
  const setDrawer = (on) => { drawer.hidden = !on; demoBtn.setAttribute('aria-expanded', String(on)); };
  demoBtn.addEventListener('click', () => setDrawer(drawer.hidden));
  $('.js-drawer-close', drawer).addEventListener('click', () => setDrawer(false));
  $$('a', drawer).forEach((a) => a.addEventListener('click', () => setDrawer(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) setDrawer(false); });
})();
