/* AQUA-PERFECT — interakcje strony (bez zależności) */
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
  setTimeout(() => root.classList.add('hero-settled'), 2400);

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

  // ---------- Header, hero, pasek mobilny — jeden handler scrolla ----------
  const header = document.querySelector('.header');
  const heroVideo = document.getElementById('hero-video');
  const heroSec = document.querySelector('.vhero');
  const mbar = document.getElementById('mbar');
  const darkZones = [...document.querySelectorAll('[data-header-dark]')];
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 8);

    // Nad czarnymi sekcjami nagłówek też ciemnieje (bez szarego pasa)
    if (header && darkZones.length) {
      const mid = header.offsetHeight / 2;
      const dark = darkZones.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      header.classList.toggle('is-dark', dark);
    }

    // Film w hero lekko zostaje w tyle przy przewijaniu
    if (heroVideo && !reduceMotion && root.classList.contains('hero-settled')) {
      const r = heroSec.getBoundingClientRect();
      const p = Math.min(Math.max(-r.top / r.height, 0), 1);
      heroVideo.style.transform = `scale(${(1.02 + p * 0.06).toFixed(4)}) translateY(${(p * 9).toFixed(2)}%)`;
    }

    if (mbar) {
      const show = y > window.innerHeight * 0.7;
      mbar.classList.toggle('is-visible', show);
      document.body.classList.toggle('mbar-on', show);
    }
  };
  window.addEventListener(
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

  // ---------- Film w hero: pauza, oszczędzanie baterii, ograniczony ruch ----------
  const heroToggle = document.getElementById('hero-toggle');
  if (heroVideo) {
    let userPaused = reduceMotion;
    const play = () => {
      const pr = heroVideo.play();
      if (pr) pr.catch(() => {});
    };
    const syncToggle = () => {
      if (!heroToggle) return;
      heroToggle.setAttribute('aria-pressed', String(userPaused));
      heroToggle.setAttribute('aria-label', userPaused ? 'Odtwórz film w tle' : 'Zatrzymaj film w tle');
    };
    if (userPaused) heroVideo.pause();
    syncToggle();
    heroToggle &&
      heroToggle.addEventListener('click', () => {
        userPaused = !userPaused;
        if (userPaused) heroVideo.pause();
        else play();
        syncToggle();
      });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (userPaused) return;
        if (e.isIntersecting) play();
        else heroVideo.pause();
      }).observe(heroVideo);
    }
  }

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

  // ---------- Licznik oceny ----------
  const score = document.querySelector('[data-count]');
  if (score && 'IntersectionObserver' in window && !reduceMotion) {
    const target = parseFloat(score.dataset.count);
    const dec = (score.dataset.count.split('.')[1] || '').length;
    const fmt = (v) => v.toFixed(dec).replace('.', ',');
    score.textContent = fmt(0);
    const sio = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      sio.disconnect();
      const t0 = performance.now();
      const dur = 1100;
      const step = (t) => {
        const k = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 4);
        score.textContent = fmt(target * eased);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    sio.observe(score);
  }

  // ---------- Liczby w pasku zaufania ----------
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    const cio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        cio.unobserve(e.target);
        const el = e.target;
        const to = parseInt(el.dataset.countTo, 10);
        const t0 = performance.now();
        const dur = 1200;
        const step = (t) => {
          const k = Math.min((t - t0) / dur, 1);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 4))));
          if (k < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  }

  // ---------- Taśma marek: druga kopia listy, żeby pętla była bez szwu ----------
  const brandList = document.querySelector('.brands__list');
  if (brandList) {
    const clone = brandList.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('img').forEach((img) => (img.alt = ''));
    brandList.parentNode.appendChild(clone);
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById('toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
  };

  // ---------- Kopiowanie numeru ----------
  const copyBtn = document.getElementById('copy-phone');
  copyBtn &&
    copyBtn.addEventListener('click', async () => {
      const phone = copyBtn.dataset.phone;
      try {
        await navigator.clipboard.writeText(phone);
      } catch {
        /* brak uprawnień do schowka — i tak pokazujemy numer */
      }
      copyBtn.classList.add('is-copied');
      toast(`Numer skopiowany: ${phone}`);
      setTimeout(() => copyBtn.classList.remove('is-copied'), 1800);
    });

  // ---------- WhatsApp — dymek raz na sesję ----------
  const bubble = document.getElementById('wa-bubble');
  const closeBubble = document.getElementById('wa-close');
  let seen = false;
  try {
    seen = sessionStorage.getItem('wa-bubble') === '1';
  } catch {
    /* prywatny tryb */
  }
  if (bubble && !seen) {
    setTimeout(() => {
      bubble.classList.add('is-visible');
      try {
        sessionStorage.setItem('wa-bubble', '1');
      } catch {}
      // nie zasłaniaj treści na stałe
      setTimeout(() => bubble.classList.remove('is-visible'), 9000);
    }, 6000);
  }
  closeBubble && closeBubble.addEventListener('click', () => bubble.classList.remove('is-visible'));
})();
