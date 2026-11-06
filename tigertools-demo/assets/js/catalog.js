/* Tiger Tools — katalog: lista produktów (przewijanie bez końca), karta produktu,
   podobne produkty (karuzela 5 w rzędzie), zestawy. Dane: window.TT_DATA. */
(() => {
  const T = window.TT;
  if (!T) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = T.data;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOC = window.TT_LOC || location; // wersja jednoplikowa podaje adres podstrony z zewnątrz
  const params = new URLSearchParams(LOC.search);
  const kids = (id) => D.cats.filter((c) => c.parent === id);
  const descendants = (id) => {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      D.cats.forEach((c) => {
        if (c.parent && out.has(c.parent) && !out.has(c.id)) {
          out.add(c.id);
          grew = true;
        }
      });
    }
    return out;
  };
  const inCat = (p, id) => descendants(id).has(p.cat);
  const countIn = (id) => D.products.filter((p) => inCat(p, id)).length;
  const catImg = (id) => {
    const p = [...D.products].filter((x) => inCat(x, id)).sort((a, b) => T.views(b.id) - T.views(a.id))[0];
    return p ? p : null;
  };
  const catUrl = (id) => (id === 'zestawy' ? 'zestawy.html' : `kategoria.html?cat=${id}`);
  const brandKey = (p) => (p.brand === 'TITAN' ? 'titan' : 'tiger-tools');

  // ======================= Lista produktów =======================
  const grid = $('#ls-grid');
  if (grid) {
    const state = { cat: params.get('cat') || '', q: params.get('q') || '', brand: params.get('brand') || '', sort: params.get('sort') || 'pop' };
    if (state.cat && !T.cat(state.cat)) state.cat = '';
    const PAGE = 12;
    let list = [];
    let shown = 0;
    const more = $('#ls-more');
    const endEl = $('#ls-end');

    const compute = () => {
      let l = D.products.slice();
      if (state.cat) l = l.filter((p) => inCat(p, state.cat));
      if (state.q) {
        const ids = new Set(T.search(state.q).map((p) => p.id));
        l = l.filter((p) => ids.has(p.id));
      }
      if (state.brand) l = l.filter((p) => brandKey(p) === state.brand);
      const by = {
        pop: (a, b) => T.views(b.id) - T.views(a.id),
        asc: (a, b) => a.price - b.price,
        desc: (a, b) => b.price - a.price,
        name: (a, b) => a.name.localeCompare(b.name, 'pl'),
      }[state.sort] || ((a, b) => T.views(b.id) - T.views(a.id));
      return l.sort(by);
    };

    const renderTree = () => {
      const path = state.cat ? T.catPath(state.cat).map((c) => c.id) : [];
      const node = (c, depth) => {
        const open = path.includes(c.id);
        const ch = kids(c.id);
        const n = c.id === 'zestawy' ? D.sets.length : countIn(c.id);
        return `<li class="${open ? 'is-open' : ''}"><a href="${catUrl(c.id)}" class="${state.cat === c.id ? 'is-active' : ''}" ${state.cat === c.id ? 'aria-current="page"' : ''}>${T.esc(c.name)}<small>${n}</small></a>${
          ch.length && (open || depth === 0) ? `<ul>${ch.map((k) => node(k, depth + 1)).join('')}</ul>` : ''
        }</li>`;
      };
      $('#ls-tree').innerHTML = `<ul><li><a href="kategoria.html" class="${!state.cat ? 'is-active' : ''}">Wszystkie produkty<small>${D.products.length}</small></a></li>${kids(null)
        .map((c) => node(c, 0))
        .join('')}</ul>`;
    };

    const renderSubcats = () => {
      const subs = state.cat ? kids(state.cat) : kids(null);
      const box = $('#ls-subcats');
      if (!subs.length || state.q) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.innerHTML = subs
        .map((c) => {
          const p = catImg(c.id);
          const im = c.id === 'zestawy' ? 'zestawy/tygrys.webp' : p ? p.imgs[0] : '';
          const white = p && p.brand === 'TITAN' && c.id !== 'zestawy' ? ' is-white' : '';
          return `<a href="${catUrl(c.id)}" class="subcat${white}"><span class="subcat__img"><img src="${T.img(im)}" alt="" loading="lazy"></span><span>${T.esc(c.name)}<small>${c.id === 'zestawy' ? D.sets.length + ' zestawów' : countIn(c.id) + ' prod.'}</small></span></a>`;
        })
        .join('');
    };

    const renderHead = () => {
      const c = state.cat ? T.cat(state.cat) : null;
      const title = state.q ? `Wyniki: „${state.q}”` : c ? c.name : state.brand === 'titan' ? 'TITAN' : state.brand === 'tiger-tools' ? 'Tiger Tools' : 'Wszystkie produkty';
      $('#ls-title').textContent = title;
      document.title = `${title} — Tiger Tools`;
      $('#ls-eyebrow').textContent = c && c.parent ? T.cat(c.parent).name : state.q ? 'Wyszukiwarka' : 'Sklep';
      const crumbs = ['<a href="index.html">Start</a>', '<span>/</span>', '<a href="kategoria.html">Produkty</a>'];
      if (c) T.catPath(c.id).forEach((x, i, arr) => crumbs.push('<span>/</span>', i === arr.length - 1 ? `<span>${T.esc(x.name)}</span>` : `<a href="${catUrl(x.id)}">${T.esc(x.name)}</a>`));
      $('#ls-crumbs').innerHTML = crumbs.join('');
      $('#ls-count').textContent = `${list.length} ${list.length === 1 ? 'produkt' : list.length % 10 >= 2 && list.length % 10 <= 4 && (list.length % 100 < 10 || list.length % 100 >= 20) ? 'produkty' : 'produktów'}`;
      $$('#ls-brands .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.brand === state.brand)));
      $('#ls-sort').value = state.sort;
    };

    const appendBatch = () => {
      const next = list.slice(shown, shown + PAGE);
      if (!next.length) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = next.map(T.cardHTML).join('');
      const nodes = [...tmp.children];
      nodes.forEach((n, i) => {
        n.style.setProperty('--i', i % 4);
        grid.appendChild(n);
      });
      shown += next.length;
      T.renderPrices();
      T.reveal(nodes);
      const done = shown >= list.length;
      more.hidden = done;
      endEl.hidden = !done || !list.length;
      endEl.textContent = list.length > PAGE ? `To już wszystkie produkty (${list.length}). Bez klikania w strony.` : '';
      if (!list.length) {
        grid.innerHTML = `<p class="ls-none">Brak produktów. <a href="kategoria.html" class="link">Pokaż wszystkie</a></p>`;
        more.hidden = true;
      }
    };

    let loading = false;
    const loadMore = () => {
      if (loading || shown >= list.length) return;
      loading = true;
      more.classList.add('is-loading');
      setTimeout(
        () => {
          appendBatch();
          loading = false;
          more.classList.remove('is-loading');
          // jeśli strona nadal krótka – dociągnij kolejną porcję
          requestAnimationFrame(() => {
            if (more.getBoundingClientRect().top < innerHeight + 300) loadMore();
          });
        },
        reduceMotion ? 0 : 380
      );
    };

    const reset = () => {
      list = compute();
      shown = 0;
      grid.innerHTML = '';
      renderTree();
      renderSubcats();
      renderHead();
      appendBatch();
      const u = new URLSearchParams();
      Object.entries(state).forEach(([k, v]) => v && !(k === 'sort' && v === 'pop') && u.set(k, v));
      const next = `kategoria.html${u.toString() ? '?' + u : ''}`;
      if (window.TT_SETURL) window.TT_SETURL(next);
      else history.replaceState(null, '', next);
    };
    $$('#ls-brands .chip').forEach((b) =>
      b.addEventListener('click', () => {
        state.brand = b.dataset.brand;
        reset();
      })
    );
    $('#ls-sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      reset();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => en[0].isIntersecting && loadMore(), { rootMargin: '600px 0px' }).observe(more);
    reset();
  }

  // ======================= Karta produktu =======================
  const pdp = $('#pdp');
  if (pdp && $('#pdp-title')) {
    const p = T.product(params.get('id')) || T.product('bdz');
    const isBDZ = p.id === 'bdz';
    T.addView(p.id);
    const path = T.catPath(p.cat);
    document.title = `${p.name} — ${p.brand}`;
    $('#pdp-crumbs').innerHTML = ['<a href="index.html">Start</a>', '<span>/</span>', '<a href="kategoria.html">Produkty</a>']
      .concat(...path.map((c) => ['<span>/</span>', `<a href="${catUrl(c.id)}">${T.esc(c.name)}</a>`]))
      .join('');
    $('#pdp-eyebrow').textContent = `${p.brand} · ${path[path.length - 1].name}`;
    $('#pdp-title').textContent = isBDZ ? 'Zaginadło do rąbka blachy BDZ' : p.name;
    $('#pdp-sym').textContent = p.sym;
    const stockEl = $('#pdp-stock');
    const setStock = (n) => {
      stockEl.textContent = `Na stanie: ${n} szt.${n < 6 ? ' – ostatnie sztuki' : ''}`;
      stockEl.classList.toggle('stock--low', n < 6);
    };
    setStock(p.stock);
    const v = T.views(p.id);
    $('#pdp-views span').textContent = `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} wyświetleń`;
    const price = $('#pdp-price');
    price.dataset.price = p.price;
    if (p.old) {
      $('#pdp-old').hidden = false;
      $('#pdp-old').dataset.price = p.old;
      $('#pdp-omni').hidden = false;
      $('#pdp-low').dataset.price = p.old;
    }
    $('#pdp-unit').hidden = !p.unit;
    $('#pdp-desc').innerHTML = p.desc;
    $('#pdp-src').textContent = `Źródło opisu w demo: ${p.src}. Docelowy opis: dekarski-sklep.pl (poprawi osoba od SEO).`;
    const specs = [['Marka', p.brand], ['Symbol', isBDZ ? 'BDZ / BDZR' : p.sym], ['Kategoria', path.map((c) => c.name).join(' › ')], ...p.specs];
    $('#pdp-specs').innerHTML = specs.map(([k, val]) => `<tr><th>${T.esc(k)}</th><td>${T.esc(val)}</td></tr>`).join('');

    // galeria
    const main = $('#pdp-main');
    const im = $('#pdp-img');
    const white = p.brand === 'TITAN' && !/^p\/(hades|dysza-20-90|tester-scyzoryk)/.test(p.imgs[0]);
    main.classList.toggle('is-white', white);
    im.src = T.img(p.imgs[0]);
    im.alt = p.name;
    const thumbs = $('#pdp-thumbs');
    const setImg = (src, btn) => {
      $$('button', thumbs).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (window.BDZ) window.BDZ.setGalleryMode(main, 'photo');
      if (reduceMotion) im.src = T.img(src);
      else {
        im.classList.add('is-swapping');
        setTimeout(() => {
          im.src = T.img(src);
          requestAnimationFrame(() => im.classList.remove('is-swapping'));
        }, 180);
      }
    };
    thumbs.innerHTML = p.imgs.map((src, i) => `<button type="button" aria-pressed="${i === 0 && !isBDZ}" aria-label="Zdjęcie ${i + 1}" class="${white ? 'is-white' : ''}"><img src="${T.img(src)}" alt=""></button>`).join('');
    $$('button', thumbs).forEach((b, i) => b.addEventListener('click', () => setImg(p.imgs[i], b)));
    if (p.imgs.length < 2) thumbs.classList.add('is-single');

    // ilość
    const qtyOut = $('#qty');
    $$('.js-qty').forEach((b) =>
      b.addEventListener('click', () => {
        const n = Math.max(1, Math.min(99, parseInt(qtyOut.textContent, 10) + parseInt(b.dataset.d, 10)));
        qtyOut.textContent = n;
        qtyOut.value = n;
      })
    );
    const qty = () => parseInt(qtyOut.textContent, 10) || 1;
    const add = (from) => {
      if (isBDZ && window.BDZ) window.BDZ.add(qty(), from);
      else T.addToCart({ id: p.id, qty: qty(), from });
    };
    $('#pdp-add').addEventListener('click', (e) => add(e.currentTarget));
    $('#pdp-buy').addEventListener('click', () => {
      add(null);
      setTimeout(() => T.go('koszyk.html'), 250);
    });

    // BDZ: konfigurator + 3D
    if (isBDZ) {
      $('#pdp-cfg').hidden = false;
      $('#pdp-modes').hidden = false;
      $('#pdp3d').hidden = false;
      main.classList.add('is-3d', 'has-3d');
      addEventListener('tt:bdz', (e) => {
        const d = e.detail;
        $('#pdp-sym').textContent = d.sym;
        price.dataset.price = d.price;
        setStock(d.stock);
        $('#pdp-title').textContent = `Zaginadło do rąbka blachy ${window.BDZ.cfg.len} cm${d.handle ? ' z rękojeścią' : ''}`;
        T.renderPrices();
      });
      window.BDZ && window.BDZ.set({});
      window.BDZ && window.BDZ.start();
    }
    T.renderPrices();

    // podobne produkty: ta sama kategoria, potem kategoria nadrzędna
    const sim = D.products.filter((x) => x.id !== p.id && x.cat === p.cat);
    let parent = T.cat(p.cat).parent;
    while (sim.length < 10 && parent) {
      D.products.filter((x) => x.id !== p.id && !sim.includes(x) && inCat(x, parent)).forEach((x) => sim.push(x));
      parent = T.cat(parent).parent;
    }
    D.products.filter((x) => x.id !== p.id && !sim.includes(x) && x.brand === p.brand).forEach((x) => sim.length < 10 && sim.push(x));
    const track = $('#sim-track');
    track.innerHTML = sim.slice(0, 12).map(T.cardHTML).join('');
    $('#sim-eyebrow').textContent = `Z kategorii: ${T.cat(p.cat).name}`;
    T.renderPrices();
    T.reveal($$('.card', track));
    const navBtns = $$('.js-sim');
    const syncNav = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      navBtns[0].disabled = track.scrollLeft <= 2;
      navBtns[1].disabled = track.scrollLeft >= max;
    };
    navBtns.forEach((b) =>
      b.addEventListener('click', () => {
        const card = $('.card', track);
        const step = card ? (card.getBoundingClientRect().width + 20) * Math.max(1, Math.floor(track.clientWidth / (card.getBoundingClientRect().width + 20))) : track.clientWidth;
        track.scrollBy({ left: step * parseInt(b.dataset.d, 10), behavior: reduceMotion ? 'auto' : 'smooth' });
      })
    );
    track.addEventListener('scroll', syncNav, { passive: true });
    addEventListener('resize', syncNav);
    syncNav();
  }

  // ======================= Zestawy =======================
  $$('.js-set-add').forEach((b) =>
    b.addEventListener('click', () => {
      const s = D.sets.find((x) => x.id === b.dataset.set);
      if (!s) return;
      T.addToCart({ id: null, key: `set-${s.id}`, name: s.name, sym: `${s.items.length} narzędzi w zestawie`, price: s.price, img: s.img, from: b });
    })
  );
  // podświetlenie zestawu, do którego prowadzi link (#tygrys)
  const hash = LOC.hash.slice(1);
  if (hash && $(`.set#${CSS.escape(hash)}`)) {
    const el = $(`.set#${CSS.escape(hash)}`);
    el.classList.add('is-target');
    setTimeout(() => el.classList.remove('is-target'), 2400);
  }
})();
