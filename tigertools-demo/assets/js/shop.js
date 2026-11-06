/* Tiger Tools — wspólne interakcje sklepu demo (bez zależności):
   ceny B2B, koszyk, wyszukiwarka z podpowiedziami (kolejność wg wejść),
   oddzwonimy, PDF, newsletter, cookies, koszyk w jednym kroku, tryb prezentacji. */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DATA = window.TT_DATA || { products: [], cats: [], sets: [] };
  const PBY = Object.fromEntries(DATA.products.map((p) => [p.id, p]));
  const CBY = Object.fromEntries(DATA.cats.map((c) => [c.id, c]));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const img = (p) => (window.TT_IMG && window.TT_IMG[p]) || `assets/img/${p}`;
  // przejście na inną podstronę (wersja jednoplikowa przechwytuje je w ramce)
  const go = (u) => (window.TT_GO ? window.TT_GO(u) : (location.href = u));

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
  };

  const B2B_RATE = 0.8;
  const FREE_SHIP = 299;
  const fmt = (n) =>
    n
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

  // ---------- Toast ----------
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  };

  // ---------- Wejście + pojawianie się ----------
  const start = () => requestAnimationFrame(() => root.classList.add('is-loaded'));
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(start);
  else start();

  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              e.target.classList.add('is-in');
              io.unobserve(e.target);
            }
          },
          { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
        )
      : null;
  const reveal = (els) => els.forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')));
  reveal($$('[data-reveal]'));

  // ---------- Nagłówek + paski tygrysa ----------
  const header = $('.header');
  const stripes = $('.hero__stripes');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 40);
    if (stripes && !reduceMotion && y < 900) stripes.style.transform = `translateY(${y * 0.12}px) rotate(${y * 0.004}deg)`;
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  // ---------- Wejścia na produkty (do kolejności w wyszukiwarce) ----------
  const viewsLocal = store.get('tt-views', {});
  const views = (id) => ((PBY[id] && PBY[id].views) || 0) + (viewsLocal[id] || 0);
  const addView = (id) => {
    viewsLocal[id] = (viewsLocal[id] || 0) + 1;
    store.set('tt-views', viewsLocal);
  };

  // ---------- Ceny: detaliczne / firmowe ----------
  let b2b = store.get('tt-b2b', false);
  const shownVal = new WeakMap();
  const renderPrices = (animate) => {
    $$('.js-price').forEach((el) => {
      const base = parseFloat(el.dataset.price);
      if (Number.isNaN(base)) return;
      const goal = el.dataset.raw ? base : b2b ? base * B2B_RATE : base;
      const from = shownVal.get(el);
      shownVal.set(el, goal);
      if (!animate || reduceMotion || from === undefined || from === goal) {
        el.textContent = fmt(goal);
        return;
      }
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min((t - t0) / 550, 1);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(from + (goal - from) * e);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  const applyB2B = (animate) => {
    root.classList.toggle('is-b2b', b2b);
    $$('.js-mode').forEach((btn) => btn.setAttribute('aria-pressed', String((btn.dataset.mode === 'b2b') === b2b)));
    $$('.js-login').forEach((btn) => btn.setAttribute('aria-pressed', String(b2b)));
    $$('.js-login-small').forEach((el) => (el.textContent = b2b ? 'Firma (demo)' : 'Zaloguj się'));
    renderPrices(animate);
    renderCart();
    renderCheckout();
    dispatchEvent(new CustomEvent('tt:b2b', { detail: { b2b } }));
  };
  const setB2B = (on, msg = true) => {
    if (on === b2b) return;
    b2b = on;
    store.set('tt-b2b', b2b);
    applyB2B(true);
    if (msg) toast(b2b ? 'Zalogowano jako firma (demo) — ceny z rabatem −20%' : 'Wylogowano — ceny detaliczne');
  };
  $$('.js-mode').forEach((btn) => btn.addEventListener('click', () => setB2B(btn.dataset.mode === 'b2b')));
  $$('.js-login').forEach((btn) => btn.addEventListener('click', () => setB2B(!b2b)));
  $$('.js-login-cta').forEach((btn) =>
    btn.addEventListener('click', () => {
      setB2B(true);
      const products = $('#produkty');
      if (products) products.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    })
  );

  // ---------- Koszyk (pozycje) ----------
  const seed = () => {
    const l = [];
    const bdz = PBY.bdz;
    if (bdz) l.push({ key: 'bdz-46-20/40-0', id: 'bdz', name: 'Zaginadło do rąbka blachy 46 cm BDZ 20/40/460', sym: 'BDZ 20/40/460', price: 220, qty: 1, img: 'p/bdz.webp' });
    const k = PBY['kleszcze-proste-60'];
    if (k) l.push({ key: k.id, id: k.id, name: k.name, sym: k.sym, price: k.price, qty: 1, img: k.imgs[0] });
    return l;
  };
  let cart = store.get('tt-cart3', null);
  if (!cart || !Array.isArray(cart.lines)) cart = { lines: seed() };
  const saveCart = () => store.set('tt-cart3', cart);
  const cartCount = () => cart.lines.reduce((s, l) => s + l.qty, 0);
  const cartSum = () => cart.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const badge = $('#cart-badge');
  const cartTotalH = $('#cart-total-h');
  function renderCart() {
    if (badge) badge.textContent = cartCount();
    if (cartTotalH) cartTotalH.textContent = fmt(b2b ? cartSum() * B2B_RATE : cartSum());
  }

  const flyToCart = (fromEl) => {
    const cartIcon = $('.actions a[href="koszyk.html"] svg');
    if (!cartIcon || reduceMotion || !fromEl || !fromEl.animate) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = cartIcon.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    document.body.appendChild(dot);
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2;
    const y1 = b.top + b.height / 2;
    const midX = (x0 + x1) / 2;
    const midY = Math.min(y0, y1) - 120;
    const frames = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * midX + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * midY + t * t * y1;
      frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 - t * 0.5})`, opacity: t > 0.9 ? 0.4 : 1 });
    }
    dot.style.left = '0px';
    dot.style.top = '0px';
    const anim = dot.animate(frames, { duration: 650, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    return anim.finished.then(() => dot.remove()).catch(() => dot.remove());
  };

  const addToCart = ({ id, key, name, sym, price, qty = 1, img: im, from, silent }) => {
    const p = PBY[id];
    const line = {
      key: key || id || name,
      id: id || null,
      name: name || (p && p.name) || 'Produkt',
      sym: sym || (p && p.sym) || '',
      price: price != null ? price : p ? p.price : 0,
      qty,
      img: im || (p && p.imgs[0]) || '',
    };
    const ex = cart.lines.find((l) => l.key === line.key);
    if (ex) ex.qty = Math.min(99, ex.qty + qty);
    else cart.lines.push(line);
    saveCart();
    const bump = () => {
      renderCart();
      if (badge) {
        badge.classList.remove('is-bump');
        void badge.offsetWidth;
        badge.classList.add('is-bump');
      }
    };
    if (from) flyToCart(from).then(bump);
    if (reduceMotion || !from) bump();
    if (!silent) toast(`Dodano do koszyka: ${line.name}`);
    renderCheckout();
  };
  const setQty = (key, n) => {
    const l = cart.lines.find((x) => x.key === key);
    if (!l) return;
    l.qty = Math.max(1, Math.min(99, n));
    saveCart();
    renderCart();
    renderCheckout();
  };
  const removeLine = (key) => {
    cart.lines = cart.lines.filter((x) => x.key !== key);
    saveCart();
    renderCart();
    renderCheckout();
  };

  // Przyciski „+” na kartach (także tych dokładanych później)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-add');
    if (!btn) return;
    const id = btn.dataset.id;
    if (id === 'bdz' && window.BDZ) {
      // karta zaginadła dodaje domyślny wariant BDZ 20/40/460
      const d = window.BDZ.info({ len: 46, depth: '20/40', handle: false });
      addToCart({ id: 'bdz', key: d.key, name: d.name, sym: d.sym, price: d.price, img: d.img, from: btn });
    } else if (id === 'bdz') {
      addToCart({ id: 'bdz', key: 'bdz-46-20/40-0', name: 'Zaginadło do rąbka blachy 46 cm BDZ 20/40/460', sym: 'BDZ 20/40/460', price: 220, img: 'p/bdz.webp', from: btn });
    } else addToCart({ id, from: btn });
    btn.classList.add('is-added');
    const icon = btn.querySelector('use');
    const prev = icon && icon.getAttribute('href');
    if (icon) icon.setAttribute('href', '#i-check');
    setTimeout(() => {
      btn.classList.remove('is-added');
      if (icon && prev) icon.setAttribute('href', prev);
    }, 1400);
  });

  // ---------- Karta produktu (HTML wspólny dla listy, podobnych i podpowiedzi) ----------
  const cardHTML = (p) => {
    const url = `produkt.html?id=${encodeURIComponent(p.id)}`;
    const badges = [];
    if (p.id === 'bdz') badges.push('<span class="badge badge--3d">3D</span>');
    if (p.old) badges.push(`<span class="badge badge--promo">−${Math.round((1 - p.price / p.old) * 100)}%</span>`);
    if (p.brand === 'TITAN') badges.push('<span class="badge badge--titan">TITAN</span>');
    const white = p.brand === 'TITAN' && !/^p\/(hades|dysza-20-90|tester-scyzoryk)/.test(p.imgs[0]) ? ' card__media--white' : '';
    return `<article class="card" data-reveal>
  <a href="${url}" class="card__media${white}" aria-label="${esc(p.name)}"><img src="${img(p.imgs[0])}" alt="" loading="lazy" width="720" height="720"><div class="badges">${badges.join('')}</div></a>
  <div class="card__body">
    <span class="card__brand">${esc(p.brand)}</span>
    <a href="${url}" class="card__name">${esc(p.name)}</a>
    <div class="card__meta" data-f="9"><span class="stock${p.stock < 6 ? ' stock--low' : ''}">Na stanie: ${p.stock} szt.</span><span class="idx">${esc(p.sym)}</span></div>
    <div class="card__foot">
      <div class="price">${p.old ? `<span class="price__old js-price" data-price="${p.old}"></span>` : ''}${p.id === 'bdz' ? '<span class="price__from">od</span>' : ''}<span class="price__now js-price" data-price="${p.price}"></span>${p.unit ? '<span class="price__unit">/ mb</span>' : ''}<span class="price__b2b">Cena firmowa −20%</span></div>
      <button type="button" class="add js-add" data-id="${esc(p.id)}" aria-label="Dodaj do koszyka: ${esc(p.name)}"><svg><use href="#i-plus"/></svg></button>
    </div>
  </div>
</article>`;
  };

  // ---------- Wyszukiwarka z podpowiedziami ----------
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l');
  const catPath = (cid) => {
    const out = [];
    let c = CBY[cid];
    while (c) {
      out.unshift(c);
      c = CBY[c.parent];
    }
    return out;
  };
  const index = DATA.products.map((p) => ({ p, hay: norm([p.name, p.sym, p.brand, ...catPath(p.cat).map((c) => c.name)].join(' ')) }));
  const search = (q) => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    return index
      .filter((x) => toks.every((t) => x.hay.includes(t)))
      .map((x) => x.p)
      .sort((a, b) => views(b.id) - views(a.id));
  };
  const hl = (name, q) => {
    const toks = norm(q).split(/\s+/).filter((t) => t.length > 1);
    if (!toks.length) return esc(name);
    const n = norm(name);
    const marks = new Array(name.length).fill(false);
    toks.forEach((t) => {
      let i = n.indexOf(t);
      while (i >= 0) {
        for (let k = i; k < i + t.length; k++) marks[k] = true;
        i = n.indexOf(t, i + t.length);
      }
    });
    let out = '';
    let open = false;
    for (let i = 0; i < name.length; i++) {
      if (marks[i] && !open) {
        out += '<mark>';
        open = true;
      }
      if (!marks[i] && open) {
        out += '</mark>';
        open = false;
      }
      out += esc(name[i]);
    }
    return out + (open ? '</mark>' : '');
  };
  const form = $('form.search');
  const input = form && $('input', form);
  const box = $('#suggest');
  let active = -1;
  const fmtViews = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const priceOf = (p) => fmt(b2b ? p.price * B2B_RATE : p.price);
  const renderSuggest = () => {
    if (!box || !input) return;
    const q = input.value.trim();
    let list;
    let head;
    let cats = [];
    if (!q) {
      list = [...DATA.products].sort((a, b) => views(b.id) - views(a.id)).slice(0, 6);
      head = '<p class="suggest__head"><svg><use href="#i-fire"/></svg>Najczęściej oglądane</p>';
    } else {
      const all = search(q);
      list = all.slice(0, 6);
      const nq = norm(q);
      cats = DATA.cats.filter((c) => norm(c.name).includes(nq)).slice(0, 3);
      head = all.length
        ? `<p class="suggest__head">Podpowiedzi · kolejność wg liczby wejść</p>`
        : `<p class="suggest__empty">Brak produktów dla „${esc(q)}”. Spróbuj: zaginadło, kleszcze, rysik, zgrzewarka.</p>`;
      list.total = all.length;
    }
    const catHTML = cats.length
      ? `<div class="suggest__cats">${cats.map((c) => `<a href="${c.id === 'zestawy' ? 'zestawy.html' : `kategoria.html?cat=${c.id}`}" class="chip">${esc(c.name)}</a>`).join('')}</div>`
      : '';
    const items = list
      .map(
        (p, i) => `<a href="produkt.html?id=${encodeURIComponent(p.id)}" class="sg${i === active ? ' is-active' : ''}" role="option" id="sg-${i}" aria-selected="${i === active}">
  <span class="sg__img${p.brand === 'TITAN' ? ' is-white' : ''}"><img src="${img(p.imgs[0])}" alt=""></span>
  <span class="sg__txt"><b>${hl(p.name, q)}</b><small>${esc(p.brand)} · ${esc(p.sym)} · <span class="${p.stock < 6 ? 'is-low' : ''}">${p.stock} szt.</span></small></span>
  <span class="sg__side"><b>${p.id === 'bdz' ? 'od ' : ''}${priceOf(p)}</b><small><svg><use href="#i-eye"/></svg>${fmtViews(views(p.id))}</small></span>
</a>`
      )
      .join('');
    const more = q && list.total > list.length ? `<a class="suggest__all" href="kategoria.html?q=${encodeURIComponent(q)}">Pokaż wszystkie wyniki (${list.total})<svg><use href="#i-arrow"/></svg></a>` : '';
    box.innerHTML = head + catHTML + items + more;
    box.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', active >= 0 ? `sg-${active}` : '');
  };
  const closeSuggest = () => {
    if (!box) return;
    box.classList.remove('is-open');
    input && input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  if (input && box) {
    let deb;
    input.addEventListener('input', () => {
      active = -1;
      clearTimeout(deb);
      deb = setTimeout(renderSuggest, 60);
    });
    input.addEventListener('focus', renderSuggest);
    input.addEventListener('keydown', (e) => {
      const opts = $$('.sg', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!box.classList.contains('is-open')) renderSuggest();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length + 1) % (opts.length + 1);
        if (active === opts.length) active = -1;
        renderSuggest();
      } else if (e.key === 'Enter' && active >= 0 && opts[active]) {
        e.preventDefault();
        go(opts[active].href);
      } else if (e.key === 'Escape') {
        closeSuggest();
        input.blur();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!form.contains(e.target)) closeSuggest();
    });
  }
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || !input) return;
    if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
    e.preventDefault();
    input.focus();
  });

  // ---------- PDF ----------
  $$('.js-pdf').forEach((b) =>
    b.addEventListener('click', () => {
      toast('Przygotowuję PDF… wybierz „Zapisz jako PDF”');
      setTimeout(() => window.print(), 450);
    })
  );

  // ---------- Zostaw telefon, oddzwonimy ----------
  const modal = $('#callback');
  const cbForm = $('#cb-form');
  let lastFocus = null;
  let ticket = store.get('tt-ticket', 1024);
  const openModal = () => {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.remove('is-done');
    cbForm.reset();
    $('#cb-phone-field').classList.remove('is-error');
    $('#cb-product').value = $('.pdp__title')?.textContent.trim() || 'Strona główna';
    modal.classList.add('is-open');
    setTimeout(() => cbForm.querySelector('input[name="phone"]').focus(), 120);
  };
  const closeModal = () => {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    lastFocus && lastFocus.focus();
  };
  $$('.js-callback').forEach((b) => b.addEventListener('click', openModal));
  $$('.js-modal-close').forEach((b) => b.addEventListener('click', closeModal));
  modal && modal.addEventListener('click', (e) => e.target === modal && closeModal());
  cbForm &&
    cbForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const phone = cbForm.phone.value.replace(/\D/g, '').replace(/^48/, '');
      const field = $('#cb-phone-field');
      if (phone.length !== 9) {
        field.classList.add('is-error');
        cbForm.phone.focus();
        return;
      }
      field.classList.remove('is-error');
      ticket += 1;
      store.set('tt-ticket', ticket);
      $('#bo-id').textContent = `#${ticket}`;
      $('#bo-desc').textContent = `${phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')} · ${$('#cb-product').value}`;
      modal.classList.add('is-done');
    });
  cbForm && cbForm.phone.addEventListener('input', () => $('#cb-phone-field').classList.remove('is-error'));

  // ---------- Koszyk w jednym kroku ----------
  const coForm = $('#co-form');
  const linesEl = $('#co-lines');
  function renderCheckout() {
    if (!linesEl) return;
    const empty = !cart.lines.length;
    $('#co-empty').hidden = !empty;
    $('#co-wrap').hidden = empty;
    $('#co-count').textContent = `(${cartCount()} szt.)`;
    linesEl.innerHTML = cart.lines
      .map(
        (l) => `<div class="co-line" data-key="${esc(l.key)}">
  <img src="${img(l.img)}" alt="">
  <span class="co-line__txt"><b>${esc(l.name)}</b><small>${esc(l.sym)}</small>
    <span class="co-line__qty"><button type="button" class="js-cq" data-d="-1" aria-label="Mniej">−</button><output>${l.qty}</output><button type="button" class="js-cq" data-d="1" aria-label="Więcej">+</button><button type="button" class="co-line__rm js-crm" aria-label="Usuń ${esc(l.name)}"><svg><use href="#i-trash"/></svg></button></span></span>
  <b class="co-line__sum">${fmt((b2b ? l.price * B2B_RATE : l.price) * l.qty)}</b>
</div>`
      )
      .join('');
    const sum = cartSum();
    const shipIn = $('input[name="ship"]:checked');
    const shipBase = shipIn ? parseFloat(shipIn.value) : 0;
    const disc = b2b ? sum * (1 - B2B_RATE) : 0;
    const after = sum - disc;
    const freeShip = after >= FREE_SHIP;
    const ship = freeShip ? 0 : shipBase;
    $('#sum-products').textContent = fmt(sum);
    $('#sum-disc-row').hidden = !b2b;
    $('#sum-disc').textContent = '−' + fmt(disc);
    $('#sum-ship').textContent = ship === 0 && shipBase > 0 ? '0,00 zł · darmowa' : fmt(ship);
    $$('.js-ship-price').forEach((el) => {
      const base = parseFloat(el.closest('.opt').querySelector('input').value);
      el.innerHTML = freeShip ? `<s>${fmt(base)}</s> 0,00 zł` : fmt(base);
    });
    const bar = $('#free-ship-bar');
    if (bar) {
      bar.style.transform = `scaleX(${Math.min(after / FREE_SHIP, 1)})`;
      $('#free-ship-txt').textContent = freeShip ? 'Masz darmową dostawę InPost.' : `Do darmowej dostawy brakuje ${fmt(FREE_SHIP - after)}.`;
      $('#free-ship').classList.toggle('is-done', freeShip);
    }
    const total = after + ship;
    $('#sum-total').textContent = fmt(total);
    $('#co-pay-txt').textContent = `Zamawiam i płacę ${fmt(total)}`;
  }
  if (coForm) {
    linesEl.addEventListener('click', (e) => {
      const line = e.target.closest('.co-line');
      if (!line) return;
      const key = line.dataset.key;
      const l = cart.lines.find((x) => x.key === key);
      if (e.target.closest('.js-cq')) setQty(key, l.qty + parseInt(e.target.closest('.js-cq').dataset.d, 10));
      if (e.target.closest('.js-crm')) {
        if (!reduceMotion && line.animate) line.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(12px)' }], { duration: 180, easing: 'ease-out' }).finished.then(() => removeLine(key));
        else removeLine(key);
      }
    });
    const syncOpts = () => {
      const kind = $('input[name="ship"]:checked').dataset.kind;
      $('#co-locker').hidden = kind !== 'locker';
      $('#f-addr').hidden = kind !== 'courier';
      $('#f-blik').hidden = $('input[name="pay"]:checked').value !== 'blik';
      $('#co-inv-fields').hidden = !$('#co-inv').checked;
      renderCheckout();
    };
    $$('input[name="ship"], input[name="pay"], #co-inv', coForm).forEach((r) => r.addEventListener('change', syncOpts));
    syncOpts();
    $$('.js-locker').forEach((b) => b.addEventListener('click', () => toast('Demo: tu otworzy się mapa Paczkomatów InPost')));
    $$('.js-xpay').forEach((b) =>
      b.addEventListener('click', () => {
        const blik = $('input[name="pay"][value="blik"]');
        blik.checked = true;
        syncOpts();
        toast(b.dataset.pay === 'blik' ? 'Wpisz kod BLIK i kliknij „Zamawiam i płacę”' : 'Demo: tu otworzy się portfel Google Pay / Apple Pay');
        if (b.dataset.pay === 'blik') $('input[name="blik"]').focus();
      })
    );
    const blikIn = $('input[name="blik"]');
    blikIn.addEventListener('input', () => {
      const d = blikIn.value.replace(/\D/g, '').slice(0, 6);
      blikIn.value = d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
    });
    $$('.field input', coForm).forEach((i) => i.addEventListener('input', () => i.closest('.field').classList.remove('is-error')));
    coForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n) => coForm[n].value.trim();
      const errs = [];
      const bad = (id, ok) => {
        $(`#${id}`).classList.toggle('is-error', !ok);
        if (!ok) errs.push(id);
      };
      bad('f-email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email')));
      bad('f-phone', v('phone').replace(/\D/g, '').replace(/^48/, '').length === 9);
      bad('f-name', v('name').length > 2);
      if (!$('#f-addr').hidden) bad('f-addr', v('addr').length > 5);
      if (!$('#f-blik').hidden) bad('f-blik', v('blik').replace(/\D/g, '').length === 6);
      const terms = coForm.terms.checked;
      $('#f-terms').classList.toggle('is-error', !terms);
      if (!terms) errs.push('f-terms');
      if (errs.length) {
        const first = $(`#${errs[0]} input`) || $(`#${errs[0]}`);
        first.focus();
        toast('Uzupełnij zaznaczone pola');
        return;
      }
      const btn = $('#co-pay');
      btn.classList.add('is-loading');
      btn.disabled = true;
      $('#co-pay-txt').textContent = 'Łączę z bankiem…';
      setTimeout(() => {
        const no = `TT-${10240 + Math.floor(Math.random() * 90)}`;
        const pay = { blik: 'BLIK', p24: 'Przelewy24', paypal: 'PayPal' }[$('input[name="pay"]:checked').value];
        const ship = $('input[name="ship"]:checked').closest('.opt').querySelector('b').textContent;
        $('#co-done-txt').textContent = `Numer zamówienia ${no}. Płatność: ${pay}. Dostawa: ${ship}. Potwierdzenie wysłaliśmy na ${v('email')}. (Demo: nic nie zostało pobrane.)`;
        $('#co-wrap').hidden = true;
        $('.co-head').hidden = true;
        $('#co-done').hidden = false;
        cart.lines = [];
        saveCart();
        renderCart();
        scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      }, 900);
    });
  }

  // ---------- Newsletter ----------
  const nl = $('#nl-form');
  nl &&
    nl.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = nl.email.value.trim();
      const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      const consent = nl.querySelector('input[type="checkbox"]').checked;
      if (!ok) return toast('Wpisz poprawny adres e-mail');
      if (!consent) return toast('Zaznacz zgodę na newsletter');
      nl.classList.add('is-done');
    });

  // ---------- Cookies ----------
  const ck = $('#cookies');
  const consentSaved = store.get('tt-consent', null);
  const showCookies = () => ck && ck.classList.add('is-visible');
  const saveConsent = (analytics, ads) => {
    store.set('tt-consent', { analytics, ads });
    ck.classList.remove('is-visible', 'is-expanded');
    toast(`Zapisano zgody · analytics_storage: ${analytics ? 'granted' : 'denied'}, ad_storage: ${ads ? 'granted' : 'denied'}`);
  };
  if (ck) {
    if (!consentSaved) setTimeout(showCookies, 1600);
    $('.js-ck-all', ck).addEventListener('click', () => saveConsent(true, true));
    $('.js-ck-save', ck).addEventListener('click', () => {
      if (ck.classList.contains('is-expanded')) saveConsent($('[data-ck="analytics"]', ck).checked, $('[data-ck="ads"]', ck).checked);
      else saveConsent(false, false);
    });
    $('.js-ck-more', ck).addEventListener('click', () => {
      ck.classList.add('is-expanded');
      $('.js-ck-save', ck).textContent = 'Zapisz wybór';
    });
  }
  $$('.js-cookie-open').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showCookies();
    })
  );

  // ---------- Tryb prezentacji: zakres po spotkaniu ----------
  const presentBtn = $('#present-btn');
  const drawer = $('#scope-drawer');
  let presenting = false;
  try {
    presenting = sessionStorage.getItem('tt-present') === '1';
  } catch {}
  const setPresenting = (on, openDrawer) => {
    presenting = on;
    root.classList.toggle('is-presenting', on);
    try {
      sessionStorage.setItem('tt-present', on ? '1' : '0');
    } catch {}
    drawer.classList.toggle('is-open', on && openDrawer);
    presentBtn.setAttribute('aria-expanded', String(on && openDrawer));
  };
  if (presentBtn && drawer) {
    setPresenting(presenting, false);
    presentBtn.addEventListener('click', () => setPresenting(!presenting, true));
    $('.js-drawer-close', drawer).addEventListener('click', () => {
      drawer.classList.remove('is-open');
      presentBtn.setAttribute('aria-expanded', 'false');
    });
  }
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal();
    if (drawer && drawer.classList.contains('is-open')) {
      drawer.classList.remove('is-open');
      presentBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Wspólne API (3D, lista produktów, karta produktu, zestawy)
  window.TT = {
    go,
    fmt,
    toast,
    esc,
    img,
    rate: B2B_RATE,
    isB2B: () => b2b,
    renderPrices: () => renderPrices(true),
    addToCart,
    cardHTML,
    reveal,
    views,
    addView,
    data: DATA,
    product: (id) => PBY[id],
    cat: (id) => CBY[id],
    catPath,
    search,
  };

  applyB2B(false);
})();
