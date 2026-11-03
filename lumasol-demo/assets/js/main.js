/* Luma Sol — interakcje strony (bez zależności) */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Wejście hero po załadowaniu fontów (bez skoku układu)
  const start = () => requestAnimationFrame(() => root.classList.add('is-loaded'));
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(start);
  } else {
    start();
  }

  // ---------- Pojawianie się elementów przy przewijaniu ----------
  const revealables = document.querySelectorAll('[data-reveal], [data-reveal-group]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  // ---------- Header i pasek mobilny — jeden handler scrolla ----------
  const header = document.querySelector('.header');
  const mbar = document.getElementById('mbar');
  const darkZones = [...document.querySelectorAll('[data-header-dark]')];
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 8);
    if (header && darkZones.length) {
      const mid = header.offsetHeight / 2;
      const dark = darkZones.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      header.classList.toggle('is-dark', dark);
    }
    if (mbar) {
      const show = y > window.innerHeight * 0.8;
      mbar.classList.toggle('is-visible', show);
      document.body.classList.toggle('mbar-on', show);
    }
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

  // ---------- Menu mobilne ----------
  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('mobile-menu');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuBtn && menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn && menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  menu && menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
  document.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('menu-open')) return;
    if (!e.target.closest('#mobile-menu, .menu-btn')) setMenu(false);
  });

  // ---------- FAQ ----------
  document.querySelectorAll('.faq__q').forEach((q) => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      q.setAttribute('aria-expanded', String(open));
    });
  });

  // ---------- Liczniki ----------
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    const cio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          cio.unobserve(e.target);
          const el = e.target;
          const to = parseFloat(el.dataset.countTo);
          const t0 = performance.now();
          const dur = 1300;
          const tick = (t) => {
            const k = Math.min((t - t0) / dur, 1);
            el.textContent = fmt(to * (1 - Math.pow(1 - k, 4)));
            if (k < 1) requestAnimationFrame(tick);
          };
          el.textContent = '0';
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => cio.observe(c));
  }

  // ---------- Realizacje: na telefonie drugie zdjęcie pokazuje się samo ----------
  const works = [...document.querySelectorAll('.work')];
  if (works.length && matchMedia('(hover: none)').matches && !reduceMotion && 'IntersectionObserver' in window) {
    const visible = new Set();
    const wio = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { threshold: 0.5 });
    works.forEach((w) => wio.observe(w));
    setInterval(() => visible.forEach((w) => w.classList.toggle('is-alt')), 3200);
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById('toast');
  let toastTimer;
  const toast = (msg, ms = 2600) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), ms);
  };
  window.lsToast = toast;

  // ---------- Kopiowanie numeru ----------
  const copyBtn = document.getElementById('copy-phone');
  copyBtn &&
    copyBtn.addEventListener('click', async () => {
      const phone = copyBtn.dataset.phone;
      try {
        await navigator.clipboard.writeText(phone);
      } catch {
        /* brak uprawnień do schowka — numer i tak widać */
      }
      copyBtn.classList.add('is-copied');
      toast(`Numer skopiowany: ${phone}`);
      setTimeout(() => copyBtn.classList.remove('is-copied'), 1800);
    });

  // ---------- Formularz wyceny (w demo bez wysyłki) ----------
  const qform = document.getElementById('qform');
  qform &&
    qform.addEventListener('submit', (e) => {
      e.preventDefault();
      const tel = qform.querySelector('[name="tel"]');
      if (tel && !tel.value.trim()) {
        tel.focus();
        toast('Podaj numer telefonu — oddzwonimy z wyceną.');
        return;
      }
      toast('Dziękujemy! W wersji demo formularz nie wysyła danych. Po wdrożeniu zgłoszenie trafi na kontakt@lumasol.pl.', 4200);
    });

  // ---------- WhatsApp — dymek raz na sesję ----------
  const bubble = document.getElementById('wa-bubble');
  const closeBubble = document.getElementById('wa-close');
  let seen = false;
  try {
    seen = sessionStorage.getItem('ls-wa') === '1';
  } catch {
    /* prywatny tryb */
  }
  if (bubble && !seen) {
    setTimeout(() => {
      bubble.classList.add('is-visible');
      try {
        sessionStorage.setItem('ls-wa', '1');
      } catch {}
      setTimeout(() => bubble.classList.remove('is-visible'), 9000);
    }, 7000);
  }
  closeBubble && closeBubble.addEventListener('click', () => bubble.classList.remove('is-visible'));
})();
