/* Tiger Tools — interakcje demo sklepu (bez zależności) */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Pamięć per przeglądarka (prywatny tryb może jej nie mieć — wtedy po prostu nie pamiętamy)
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
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' zł';

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
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(start);
  } else start();

  const revealables = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    revealables.forEach((el) => io.observe(el));
  } else revealables.forEach((el) => el.classList.add('is-in'));

  // ---------- Nagłówek + paski tygrysa w hero ----------
  const header = $('.header');
  const stripes = $('.hero__stripes');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 40);
    if (stripes && !reduceMotion && y < 900) stripes.style.transform = `translateY(${y * 0.12}px) rotate(${y * 0.004}deg)`;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  // „/” przenosi do wyszukiwarki
  const searchInput = $('.search input');
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || !searchInput) return;
    if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
    e.preventDefault();
    searchInput.focus();
  });

  // ---------- Ceny: detaliczne / firmowe (grupa klientów B2B) ----------
  let b2b = store.get('tt-b2b', false);
  const priceEls = () => $$('.js-price');
  const shownVal = new WeakMap();

  const renderPrices = (animate) => {
    priceEls().forEach((el) => {
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

  // ---------- Koszyk ----------
  const cart = store.get('tt-cart', { count: 2, total: 459 });
  const badge = $('#cart-badge');
  const cartTotalH = $('#cart-total-h');
  function renderCart() {
    if (badge) badge.textContent = cart.count;
    if (cartTotalH) cartTotalH.textContent = fmt(b2b ? cart.total * B2B_RATE : cart.total);
  }

  const flyToCart = (fromEl) => {
    const cartIcon = $('.actions a[href="koszyk.html"] svg');
    if (!cartIcon || reduceMotion || !fromEl.animate) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = cartIcon.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    document.body.appendChild(dot);
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const midX = (x0 + x1) / 2, midY = Math.min(y0, y1) - 120;
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

  $$('.js-add').forEach((btn) =>
    btn.addEventListener('click', () => {
      const qty = btn.id === 'pdp-add' ? parseInt($('#qty')?.value || $('#qty')?.textContent || '1', 10) : 1;
      const price = parseFloat(btn.dataset.price);
      cart.count += qty;
      cart.total += price * qty;
      store.set('tt-cart', cart);
      btn.classList.add('is-added');
      const icon = btn.querySelector('use');
      const prev = icon && icon.getAttribute('href');
      if (icon && !btn.id) icon.setAttribute('href', '#i-check');
      flyToCart(btn).then(() => {
        renderCart();
        if (badge) {
          badge.classList.remove('is-bump');
          void badge.offsetWidth;
          badge.classList.add('is-bump');
        }
      });
      if (reduceMotion) renderCart();
      const name = btn.getAttribute('aria-label')?.replace('Dodaj do koszyka: ', '') || $('.pdp__title')?.textContent.trim() || 'Produkt';
      toast(`Dodano do koszyka: ${name}`);
      setTimeout(() => {
        btn.classList.remove('is-added');
        if (icon && prev && !btn.id) icon.setAttribute('href', prev);
      }, 1400);
    })
  );

  // ---------- Karta produktu: warianty i ilość ----------
  const VARIANTS = {
    31: { len: '31 cm', mm: '310 mm', model: 'BDZ 20/40/310', idx: 'BDZ-20-40-310', price: 189, stock: 3, img: 'zaginadlo-31.svg', id: 'z31' },
    46: { len: '46 cm', mm: '460 mm', model: 'BDZ 20/40/460', idx: 'BDZ-20-40-460', price: 220, stock: 14, img: 'zaginadlo-46.svg', id: 'z46' },
    61: { len: '61 cm', mm: '610 mm', model: 'BDZ 20/40/610', idx: 'BDZ-20-40-610', price: 259, old: 285, low: 279, stock: 6, img: 'zaginadlo-61.svg', id: 'z61' },
  };
  const pdpImg = $('#pdp-img');
  const setVariant = (v, animate = true) => {
    const d = VARIANTS[v];
    if (!d || !pdpImg) return;
    $$('.js-variant').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    const swap = () => {
      pdpImg.src = `assets/img/products/${d.img}`;
      requestAnimationFrame(() => pdpImg.classList.remove('is-swapping'));
    };
    if (animate && !reduceMotion) {
      pdpImg.classList.add('is-swapping');
      setTimeout(swap, 200);
    } else swap();
    $('#pdp-len').textContent = d.len;
    $('#pdp-idx').textContent = d.idx;
    $('#spec-model').textContent = d.model;
    $('#spec-len').textContent = d.mm;
    const stock = $('#pdp-stock');
    stock.textContent = `W magazynie: ${d.stock} szt.`;
    stock.classList.toggle('stock--low', d.stock < 5);
    $('#pdp-price').dataset.price = d.price;
    const old = $('#pdp-old');
    old.hidden = !d.old;
    if (d.old) old.dataset.price = d.old;
    const omni = $('#pdp-omni');
    omni.hidden = !d.low;
    if (d.low) $('#pdp-low').dataset.price = d.low;
    const add = $('#pdp-add');
    add.dataset.price = d.price;
    add.dataset.id = d.id;
    renderPrices(animate);
  };
  $$('.js-variant').forEach((b) => b.addEventListener('click', () => setVariant(b.dataset.v)));
  if (pdpImg) {
    const v = new URLSearchParams(location.search).get('v');
    setVariant(VARIANTS[v] ? v : 46, false);
  }

  const qtyOut = $('#qty');
  $$('.js-qty').forEach((b) =>
    b.addEventListener('click', () => {
      const n = Math.max(1, Math.min(99, parseInt(qtyOut.textContent, 10) + parseInt(b.dataset.d, 10)));
      qtyOut.textContent = n;
      qtyOut.value = n;
    })
  );

  // ---------- PDF (karta produktu i koszyk) ----------
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

  // ---------- One page checkout ----------
  const sumProducts = 459;
  function renderCheckout() {
    const totalEl = $('#sum-total');
    if (!totalEl) return;
    const shipIn = $('input[name="ship"]:checked');
    const shipBase = shipIn ? parseFloat(shipIn.value) : 0;
    const disc = b2b ? sumProducts * (1 - B2B_RATE) : 0;
    const afterDisc = sumProducts - disc;
    const freeShip = afterDisc >= FREE_SHIP;
    const ship = freeShip ? 0 : shipBase;
    $('#sum-disc-row').hidden = !b2b;
    $('#sum-disc').textContent = '−' + fmt(disc);
    $('#sum-ship').textContent = ship === 0 && shipBase > 0 ? '0,00 zł · darmowa od 299 zł' : fmt(ship);
    $$('.js-ship-price').forEach((el) => {
      const base = parseFloat(el.closest('.opt').querySelector('input').value);
      el.innerHTML = freeShip ? `<s style="color:var(--ink-3);font-weight:500">${fmt(base)}</s> 0,00 zł` : fmt(base);
    });
    totalEl.textContent = fmt(afterDisc + ship);
  }
  $$('input[name="ship"]').forEach((r) => r.addEventListener('change', renderCheckout));
  $$('.js-order').forEach((b) => b.addEventListener('click', () => toast('Demo: tu nastąpi przekierowanie do płatności Przelewy24 / PayPal')));

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

  // ---------- Cookies: Consent Mode v2 (podgląd modułu) ----------
  const ck = $('#cookies');
  const consentSaved = store.get('tt-consent', null);
  const showCookies = () => ck && ck.classList.add('is-visible');
  const saveConsent = (analytics, ads) => {
    store.set('tt-consent', { analytics, ads });
    ck.classList.remove('is-visible', 'is-expanded');
    toast(`Zapisano zgody · analytics_storage: ${analytics ? 'granted' : 'denied'}, ad_storage: ${ads ? 'granted' : 'denied'}`);
  };
  if (ck) {
    if (!consentSaved) setTimeout(showCookies, 1200);
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

  // ---------- Tryb prezentacji: zakres wdrożenia ----------
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
    // Klik włącza numery i listę funkcji; kolejny klik wyłącza numery (lista ma też własne „zamknij”)
    presentBtn.addEventListener('click', () => setPresenting(!presenting, true));
    $('.js-drawer-close', drawer).addEventListener('click', () => {
      drawer.classList.remove('is-open');
      presentBtn.setAttribute('aria-expanded', 'false');
    });
    $$('a[href="#cookies"]', drawer).forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        drawer.classList.remove('is-open');
        showCookies();
      })
    );
  }

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal();
    if (drawer && drawer.classList.contains('is-open')) {
      drawer.classList.remove('is-open');
      presentBtn.setAttribute('aria-expanded', 'false');
    }
  });

  applyB2B(false);
})();
