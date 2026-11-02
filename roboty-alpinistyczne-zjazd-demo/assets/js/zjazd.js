/* Techniczne Roboty Alpinistyczne — sekcja 3 „Zjazd z 100 m” i wysokościomierz strony.
   Przewijanie steruje zjazdem: kamera jedzie z alpinistą, budynek i ulica przesuwają się,
   miasto w tle wolniej (paralaksa). Bez bibliotek, ruch tylko na transform i opacity. */
(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const track = $('zj-track');
  const scene = $('zj-scene');

  // ======================================================================
  // 1. Scena zjazdu
  // ======================================================================
  if (track && scene) {
    const world = $('zj-world');
    const front = $('zj-front');
    const facade = $('zj-facade');
    const strip = $('zj-strip');
    const shine = $('zj-shine');
    const cityFar = $('zj-city-far');
    const cityNear = $('zj-city-near');
    const wind = $('zj-wind');
    const skyLow = $('zj-sky-low');
    const climber = $('zj-climber');
    const ropeA = $('zj-rope-a');
    const ropeB = $('zj-rope-b');
    const tailA = $('zj-tail-a');
    const tailB = $('zj-tail-b');
    const anchorA = $('zj-anchor-a');
    const anchorB = $('zj-anchor-b');
    const altEl = $('zj-alt');
    const statusEl = $('zj-status').querySelector('span');
    const gaugeDot = $('zj-gauge');
    const cards = [...scene.querySelectorAll('.zj-card')];
    const cardFrom = cards.map((c) => parseFloat(c.dataset.from) || 0);
    const landingLinks = [...$('zj-landing').querySelectorAll('a')];

    // Wysokość (m) w funkcji postępu przewijania: dach → zjazd → praca na ~50 m → zjazd → ziemia
    const KEYS = [
      [0, 100],
      [0.07, 100],
      [0.38, 52],
      [0.54, 47],
      [0.9, 0],
      [1, 0],
    ];
    const altAt = (p) => {
      for (let i = 1; i < KEYS.length; i++) {
        const [p1, a1] = KEYS[i];
        if (p <= p1) {
          const [p0, a0] = KEYS[i - 1];
          return a0 + (a1 - a0) * ((p - p0) / (p1 - p0 || 1));
        }
      }
      return 0;
    };

    // Figura: viewBox 120×190, stopy na y≈176, karabinek przy pasie na y≈100, dłoń na linie x=54
    const FEET = 176;
    const DEVICE = 100;
    const F0 = 4; // na starcie stopy tuż pod krawędzią attyki

    let W = 0;
    let H = 0;
    let ppm = 1;
    let floor = 140;
    let fig = 128;
    let figW = 80;
    let cx = 0;
    let ropeXA = 0;
    let ropeXB = 0;
    let postA = 0;
    let postB = 0;
    let Yf = 0;
    let G0 = 0;
    let stripH = 0;
    let gaugeH = 0;

    // Deterministyczny „losowy” generator, żeby miasto wyglądało tak samo po każdym przeliczeniu
    const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const skyline = (svg, o) => {
      const r = rng(o.seed);
      const hgt = Math.ceil(o.height);
      let x = -30;
      let out = '';
      let i = 0;
      while (x < W + 30) {
        const w = o.minW + r() * (o.maxW - o.minW);
        const top = o.top + r() * o.range;
        const cls = o.alt && i % 3 === 1 ? 'b b2' : 'b';
        out += `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(hgt - top).toFixed(1)}"/>`;
        if (o.win) out += `<rect class="w" x="${(x + 6).toFixed(1)}" y="${(top + 10).toFixed(1)}" width="${Math.max(w - 12, 0).toFixed(1)}" height="${(hgt - top - 10).toFixed(1)}" fill="url(#${o.win})"/>`;
        if (r() > 0.78) out += `<rect class="b" x="${(x + w * 0.5).toFixed(1)}" y="${(top - 22).toFixed(1)}" width="2" height="22"/>`;
        x += w + (r() > 0.6 ? 4 + r() * 18 : 0);
        i++;
      }
      const defs = o.win
        ? `<defs><pattern id="${o.win}" width="${o.pw}" height="${o.ph}" patternUnits="userSpaceOnUse"><rect width="${o.pw * 0.45}" height="${o.ph * 0.5}" fill="#fff"/></pattern></defs>`
        : '';
      svg.setAttribute('width', W);
      svg.setAttribute('height', hgt);
      svg.setAttribute('viewBox', `0 0 ${W} ${hgt}`);
      svg.innerHTML = defs + out;
    };

    const layout = () => {
      W = scene.clientWidth;
      H = scene.clientHeight;
      const mobile = W < 900;
      floor = Math.round(clamp(H * (mobile ? 0.15 : 0.16), 100, 168));
      ppm = floor / 3.6; // jedno piętro = 3,6 m
      const col = Math.round(floor * 0.6);
      const want = mobile ? W * 0.84 : Math.min(W * 0.42, 660);
      const cols = Math.max(3, Math.round(want / col));
      const bw = cols * col + 3;
      const bx = Math.round((mobile ? W / 2 : W * 0.47) - bw / 2);
      const k = clamp(Math.round(cols * 0.38 - 0.5), 1, cols - 2); // kolumna szyb, po której zjeżdża
      cx = bx + k * col + col / 2 + 1.5;
      fig = Math.round(clamp(floor * 0.92, 96, 156));
      figW = (fig * 120) / 190;
      const s = fig / 190;
      ropeXA = cx + (54 - 60) * s;
      ropeXB = cx + (66 - 60) * s;
      Yf = H * (mobile ? 0.6 : 0.62);
      G0 = F0 + 100 * ppm;
      const groundY = G0 - 8;

      const vanW = floor * 2.4;
      const vx = mobile ? W - vanW * 0.92 : Math.min(cx + floor * 1.2, W - vanW - 24);

      const st = scene.style;
      st.setProperty('--floor', `${floor}px`);
      st.setProperty('--col', `${col}px`);
      st.setProperty('--bw', `${bw}px`);
      st.setProperty('--bx', `${bx}px`);
      st.setProperty('--g', `${groundY}px`);
      st.setProperty('--cx', `${cx}px`);
      st.setProperty('--fig', `${fig}px`);
      st.setProperty('--vx', `${vx}px`);

      // kotwy stoją na dachu z lewej, liny schodzą przez krawędź attyki
      postA = ropeXA - col * 1.5;
      postB = ropeXB - col * 0.9;
      anchorA.style.left = `${postA - bx}px`;
      anchorB.style.left = `${postB - bx}px`;
      strip.style.left = `${k * col + 3}px`;
      strip.style.width = `${col - 3}px`;
      stripH = groundY - floor * 1.3;
      gaugeH = gaugeDot.parentElement.clientHeight;

      const drop = 100 * ppm;
      skyline(cityFar, { seed: 7, top: H * 0.5, range: H * 0.16, height: H + drop * 0.06 + 80, minW: 34, maxW: 90 });
      skyline(cityNear, {
        seed: 19,
        top: H * 0.7,
        range: H * 0.16,
        height: H + drop * 0.18 + 120,
        minW: 50,
        maxW: 130,
        win: 'zj-win',
        pw: 11,
        ph: 15,
        alt: true,
      });
    };

    // ---------- Stan i pętla ----------
    let aC = 100; // wysokość alpinisty (m)
    let aK = 100; // wysokość kamery (m), lekko spóźniona — daje wrażenie bezwładności
    let prevA = 100;
    let moving = false;
    let swayT = 0;
    let last = 0;
    let raf = 0;
    let inView = false;
    let lastAlt = -1;
    let lastStatus = '';
    let lastCard = -2;
    let landedPrev = false;

    const progress = () => {
      const r = track.getBoundingClientRect();
      return clamp(-r.top / (r.height - H || 1), 0, 1);
    };

    const render = (dt) => {
      const p = progress();
      const aT = altAt(p);
      if (reduce || dt === 0) {
        aC = aT;
        aK = aT;
      } else {
        aC += (aT - aC) * (1 - Math.exp(-dt * 9));
        aK += (aC - aK) * (1 - Math.exp(-dt * 5));
      }
      if (Math.abs(aT - aC) < 0.002) aC = aT;

      const T = Yf - (F0 + (100 - aK) * ppm);
      const lag = clamp((aK - aC) * ppm, -H * 0.12, H * 0.12);
      const feetY = Yf + lag;
      const s = fig / 190;
      const figTop = feetY - FEET * s;

      // prędkość (m/s) z histerezą, żeby nogi nie migały
      const v = dt ? Math.abs(aC - prevA) / dt : 0;
      prevA = aC;
      if (!moving && v > 0.9 && aC > 0.3) moving = true;
      else if (moving && (v < 0.3 || aC <= 0.3)) moving = false;

      swayT += dt;
      const windK = clamp((aC - 20) / 80, 0, 1);
      const sway = reduce ? 0 : Math.sin(swayT * 1.1) * (1.5 + 5 * windK) + Math.sin(swayT * 2.6) * 1.1 * windK;

      world.style.transform = `translate3d(0,${T.toFixed(2)}px,0)`;
      front.style.transform = world.style.transform;
      shine.style.transform = `translate3d(0,${(-T).toFixed(2)}px,0)`;

      const dT = T - (Yf - F0);
      cityFar.style.transform = `translate3d(0,${(dT * 0.06).toFixed(2)}px,0)`;
      cityNear.style.transform = `translate3d(0,${(dT * 0.18).toFixed(2)}px,0)`;
      skyLow.style.opacity = (1 - aK / 100).toFixed(3);
      wind.style.opacity = windK.toFixed(3);

      climber.style.transform = `translate3d(${(cx - figW / 2 + sway).toFixed(2)}px,${figTop.toFixed(2)}px,0) rotate(${(sway * 0.35).toFixed(2)}deg)`;

      // Liny: od kotwy przez krawędź attyki do przyrządu przy pasie, potem luźny koniec do ziemi
      const yP = T - 36; // oko kotwy
      const yEdge = T - 16; // wierzch attyki
      const yD = figTop + DEVICE * s;
      const yG = T + G0 + 4;
      const yE = Math.min(yG, H + 60);
      const rope = (x, post) => {
        const head = `M${post.toFixed(1)} ${yP.toFixed(1)}`;
        if (yD <= yEdge + 4) return `${head}L${(x + sway).toFixed(1)} ${yD.toFixed(1)}`;
        return `${head}L${x.toFixed(1)} ${yEdge.toFixed(1)}Q${(x + sway * 0.6).toFixed(1)} ${((yEdge + yD) / 2).toFixed(1)} ${(x + sway).toFixed(1)} ${yD.toFixed(1)}`;
      };
      const tail = (x, d) => {
        const end = yE >= yG - 1 ? ` q${8 * d} 5 ${22 * d} 3` : '';
        return `M${(x + sway).toFixed(1)} ${yD.toFixed(1)}Q${(x + sway * 1.8).toFixed(1)} ${((yD + yE) / 2).toFixed(1)} ${(x + sway * 0.3).toFixed(1)} ${yE.toFixed(1)}${end}`;
      };
      ropeA.setAttribute('d', rope(ropeXA, postA));
      ropeB.setAttribute('d', rope(ropeXB, postB));
      tailA.setAttribute('d', tail(ropeXA, -1));
      tailB.setAttribute('d', tail(ropeXB, 1));

      // Czysty pas szkła nad zgarniaczem (myjemy z góry na dół)
      const cleanTo = F0 + (100 - aC) * ppm - fig * 0.9;
      strip.style.transform = `translate3d(0,${(clamp(cleanTo, 0, stripH) - stripH).toFixed(2)}px,0)`;

      // Wysokościomierz
      const altR = Math.round(aC);
      if (altR !== lastAlt) {
        altEl.textContent = altR;
        lastAlt = altR;
      }
      gaugeDot.style.transform = `translate3d(0,${((1 - aC / 100) * gaugeH).toFixed(2)}px,0)`;

      const landed = p >= 0.9 && aC < 1;
      const working = p >= 0.37 && p < 0.55;
      const status = landed ? 'Na ziemi' : p < 0.07 ? 'Na dachu' : working ? 'Mycie szyb' : 'Zjazd';
      if (status !== lastStatus) {
        statusEl.textContent = status;
        lastStatus = status;
      }

      climber.classList.toggle('is-moving', moving);
      climber.classList.toggle('is-working', working);
      scene.classList.toggle('is-top', p < 0.1);
      scene.classList.toggle('is-street', aC < 18);
      scene.classList.toggle('is-started', p > 0.015);
      scene.classList.toggle('is-landed', landed);
      if (landed !== landedPrev) {
        landingLinks.forEach((a) => (landed ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
        landedPrev = landed;
      }

      let idx = -1;
      if (!landed) for (let i = 0; i < cards.length; i++) if (p >= cardFrom[i]) idx = i;
      if (idx !== lastCard) {
        cards.forEach((c, i) => {
          c.classList.toggle('is-active', i === idx);
          c.classList.toggle('is-past', idx >= 0 ? i < idx : true);
        });
        lastCard = idx;
      }

      // WhatsApp i pasek CTA nie zasłaniają sceny, gdy jest „przyklejona”
      const r = track.getBoundingClientRect();
      document.body.classList.toggle('in-wow', r.top < H * 0.5 && r.bottom > H * 0.5);
    };

    const loop = (now) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      render(dt);
      raf = inView && !reduce ? requestAnimationFrame(loop) : 0;
    };

    const start = () => {
      if (raf || reduce) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    layout();
    render(0);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([e]) => {
          inView = e.isIntersecting;
          if (inView) {
            render(0); // po skoku (np. z menu) bez długiego dojeżdżania
            start();
          } else {
            document.body.classList.remove('in-wow');
          }
        },
        { rootMargin: '10% 0px' }
      ).observe(track);
    } else {
      inView = true;
      start();
    }

    if (reduce) {
      let ticking = false;
      addEventListener(
        'scroll',
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            render(0);
          });
        },
        { passive: true }
      );
    }

    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = scene.clientWidth;
        const h = scene.clientHeight;
        if (w === W && h === H) return;
        layout();
        render(0);
      }, 120);
    });
  }

  // ======================================================================
  // 2. Wysokościomierz strony: hero to dach (100 m), stopka to parter (0 m)
  // ======================================================================
  const SECTIONS = [
    ['Dach', '.vhero'],
    ['Realizacje', '#realizacje'],
    ['Zjazd', '#zjazd'],
    ['Usługi', '#uslugi'],
    ['Opinie', '#opinie'],
    ['FAQ', '#faq'],
    ['Kontakt', '.final'],
    ['Parter', '.footer'],
  ]
    .map(([name, sel]) => [name, document.querySelector(sel)])
    .filter(([, el]) => el);
  if (SECTIONS.length < 3) return;

  const rail = document.createElement('div');
  rail.className = 'alt-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML =
    '<i class="alt-rail__line"></i><i class="alt-rail__used"></i>' +
    SECTIONS.map(() => '<i class="alt-rail__tick"></i>').join('') +
    '<i class="alt-rail__dot"><span class="alt-rail__label"><strong>100 m</strong><span>Dach</span></span></i>';
  document.body.appendChild(rail);
  const used = rail.querySelector('.alt-rail__used');
  const dot = rail.querySelector('.alt-rail__dot');
  const num = rail.querySelector('.alt-rail__label strong');
  const name = rail.querySelector('.alt-rail__label span');
  const ticks = [...rail.querySelectorAll('.alt-rail__tick')];

  let tops = [];
  let max = 1;
  let railH = 1;
  let lastTxt = '';
  let lastName = '';

  const measure = () => {
    max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    railH = rail.clientHeight;
    tops = SECTIONS.map(([, el]) => el.getBoundingClientRect().top + scrollY);
    tops.forEach((t, i) => (ticks[i].style.top = `${(clamp(t / max, 0, 1) * 100).toFixed(2)}%`));
  };

  const update = () => {
    const y = scrollY;
    const k = clamp(y / max, 0, 1);
    dot.style.transform = `translate3d(0,${(k * railH).toFixed(1)}px,0)`;
    used.style.transform = `scaleY(${k.toFixed(4)})`;
    const txt = `${Math.round(100 * (1 - k))} m`;
    if (txt !== lastTxt) {
      num.textContent = txt;
      lastTxt = txt;
    }
    let cur = SECTIONS[0][0];
    for (let i = 0; i < tops.length; i++) if (y + innerHeight * 0.4 >= tops[i]) cur = SECTIONS[i][0];
    if (k > 0.995) cur = SECTIONS[SECTIONS.length - 1][0];
    if (cur !== lastName) {
      name.textContent = cur;
      lastName = cur;
    }
  };

  // Etykieta widoczna w trakcie przewijania, potem znika (nie zasłania treści)
  let idle;
  const wake = (ms) => {
    rail.classList.add('is-scrolling');
    clearTimeout(idle);
    idle = setTimeout(() => rail.classList.remove('is-scrolling'), ms);
  };

  let tk = false;
  addEventListener(
    'scroll',
    () => {
      wake(1200);
      if (tk) return;
      tk = true;
      requestAnimationFrame(() => {
        tk = false;
        update();
      });
    },
    { passive: true }
  );
  let mt;
  addEventListener('resize', () => {
    clearTimeout(mt);
    mt = setTimeout(() => {
      measure();
      update();
    }, 150);
  });
  addEventListener('load', () => {
    measure();
    update();
  });
  measure();
  update();
  requestAnimationFrame(() => {
    rail.classList.add('is-on');
    wake(2600);
  });
})();
