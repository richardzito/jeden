/* Rzuty mieszkań (SVG) i rzut piętra. Geometria w metrach; fasada (okna, balkon) zawsze u góry rzutu. */
(() => {
  const G = {
    A: {
      W: 5.4, H: 6.0,
      rooms: [[0, 0, 5.4, 3.9, 0], [0, 3.9, 2.0, 2.1, 1, 'wet'], [2.0, 3.9, 2.2, 2.1, 2], [4.2, 3.9, 1.2, 2.1, 3]],
      win: [['t', 0.5, 2.0], ['t', 3.0, 4.8]],
      doors: [['v', 2.0, 4.3, 0.8, 1], ['h', 3.9, 4.3, 0.8, -1]],
      open: [['h', 3.9, 2.3, 1.0]],
      entry: [2.6, 0.9],
      furn: [['k', 0, 2.5, 1.9, 0.6], ['sofa', 3.0, 2.7, 2.1, 0.85], ['table', 1.4, 1.2, 0.45], ['shower', 0, 5.1, 0.9, 0.9], ['wc', 1.6, 4.3], ['sink', 0.9, 3.95, 0.6]],
    },
    B: {
      W: 7.2, H: 6.4,
      rooms: [[0, 0, 4.2, 4.0, 0], [4.2, 0, 3.0, 4.0, 1], [0, 4.0, 2.2, 2.4, 2, 'wet'], [2.2, 4.0, 5.0, 2.4, 3]],
      win: [['t', 0.4, 1.9], ['t', 2.4, 3.9], ['t', 4.8, 6.6]],
      doors: [['h', 4.0, 5.0, 0.8, 1], ['v', 2.2, 4.6, 0.8, -1]],
      open: [['h', 4.0, 2.6, 1.0]],
      entry: [6.0, 0.9],
      furn: [['k', 0, 3.3, 2.0, 0.65], ['sofa', 2.4, 0.4, 0.85, 2.2], ['table', 1.2, 1.6, 0.5], ['bed', 4.9, 0.4, 1.6, 2.0], ['tub', 0, 5.6, 1.7, 0.75], ['wc', 1.7, 4.4], ['sink', 0.5, 4.05, 0.6]],
    },
    C: {
      W: 9.0, H: 7.0,
      rooms: [[0, 0, 4.6, 4.4, 0], [4.6, 0, 4.4, 2.9, 1], [6.2, 2.9, 2.8, 4.1, 2], [0, 4.4, 2.4, 2.6, 3, 'wet'], [2.4, 4.4, 3.8, 2.6, 4], [4.6, 2.9, 1.6, 1.5, -1]],
      win: [['t', 0.4, 2.1], ['t', 2.6, 4.3], ['t', 5.4, 8.2], ['r', 4.0, 5.8]],
      doors: [['h', 2.9, 4.8, 0.8, 1], ['v', 6.2, 5.0, 0.8, 1], ['v', 2.4, 5.2, 0.8, -1]],
      open: [['h', 4.4, 2.8, 1.1]],
      entry: [4.4, 0.9],
      furn: [['k', 0, 3.7, 2.2, 0.65], ['sofa', 2.6, 0.6, 1.9, 0.9], ['table', 1.1, 1.8, 0.55], ['bed', 6.1, 0.3, 2.0, 1.6, 'h'], ['bed1', 7.9, 3.4, 0.95, 2.0], ['desk', 6.3, 6.2, 1.2, 0.6], ['tub', 0, 6.2, 1.8, 0.75], ['wc', 2.0, 4.8], ['sink', 0.6, 4.45, 0.6]],
    },
    D: {
      W: 10.4, H: 7.6,
      rooms: [[0, 0, 5.2, 4.6, 0], [5.2, 0, 5.2, 3.0, 1], [0, 4.6, 3.0, 3.0, 2], [7.6, 3.0, 2.8, 4.6, 3], [5.0, 4.6, 2.6, 1.9, 4, 'wet'], [5.0, 6.5, 1.2, 1.1, 5, 'wet'], [3.0, 4.6, 2.0, 3.0, 6], [5.2, 3.0, 2.4, 1.6, -1], [6.2, 6.5, 1.4, 1.1, -1]],
      win: [['t', 0.5, 2.4], ['t', 2.9, 4.8], ['t', 6.2, 9.4], ['l', 5.4, 6.8], ['r', 4.4, 5.9]],
      doors: [['h', 3.0, 5.5, 0.8, 1], ['v', 3.0, 5.2, 0.8, -1], ['v', 7.6, 3.4, 0.8, 1], ['h', 4.6, 5.6, 0.8, 1], ['v', 5.0, 6.7, 0.7, 1]],
      open: [['h', 4.6, 3.3, 1.3]],
      entry: [3.6, 0.9],
      furn: [['k', 0, 3.9, 2.4, 0.65], ['sofa', 2.8, 0.6, 2.1, 0.9], ['table', 1.2, 2.0, 0.6], ['bed', 6.4, 0.3, 2.0, 1.6, 'h'], ['bed1', 0.3, 5.0, 0.95, 2.0], ['bed1', 9.3, 3.4, 0.95, 2.0], ['tub', 5.0, 5.75, 1.7, 0.75], ['wc', 5.6, 6.9], ['sink', 6.9, 4.65, 0.6]],
    },
  };
  const U = 100; // px na metr
  const OUT = 1.4; // głębokość balkonu / ogródka
  const C = {
    floor: '#f8f6f1', wet: '#edf1f2', out: '#e6eee3', wall: '#24272b', win: '#cfe0e9', furn: '#b9b2a6', text: '#121417', mute: '#7b8088',
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function plan(layoutId, parts, opts = {}) {
    const g = G[layoutId];
    const mini = !!opts.mini;
    const out = opts.outdoor;
    const top = out ? OUT : 0;
    const pad = mini ? 0.25 : 0.5;
    const W = g.W;
    const H = g.H;
    const vb = [-pad * U, -(pad + top) * U, (W + pad * 2) * U, (H + top + pad * 2) * U];
    const p = [];
    p.push(`<svg viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(opts.label || 'Rzut mieszkania')}">`);
    // balkon / ogródek / taras
    if (out) {
      const garden = out[0] === 'ogródek';
      p.push(`<rect x="${0.3 * U}" y="${-OUT * U}" width="${(W - 0.6) * U}" height="${OUT * U - 6}" fill="${garden ? '#dbe8d4' : C.out}" stroke="${C.furn}" stroke-width="${mini ? 4 : 3}" ${garden ? '' : 'stroke-dasharray="10 8"'}/>`);
      if (!mini) p.push(`<text x="${(W / 2) * U}" y="${-OUT * U * 0.42}" text-anchor="middle" font-size="28" fill="${C.mute}" font-family="Manrope, sans-serif" font-weight="600">${esc(out[0])} ${String(out[1]).replace('.', ',')} m²</text>`);
    }
    // pomieszczenia
    g.rooms.forEach(([x, y, w, h, , kind]) => {
      p.push(`<rect x="${x * U}" y="${y * U}" width="${w * U}" height="${h * U}" fill="${kind === 'wet' ? C.wet : C.floor}"/>`);
    });
    if (!mini) {
      // siatka płytek w łazienkach
      g.rooms.filter((r) => r[5] === 'wet').forEach(([x, y, w, h]) => {
        for (let gx = x + 0.3; gx < x + w; gx += 0.3) p.push(`<line x1="${gx * U}" y1="${y * U}" x2="${gx * U}" y2="${(y + h) * U}" stroke="#dde3e5" stroke-width="1.5"/>`);
        for (let gy = y + 0.3; gy < y + h; gy += 0.3) p.push(`<line x1="${x * U}" y1="${gy * U}" x2="${(x + w) * U}" y2="${gy * U}" stroke="#dde3e5" stroke-width="1.5"/>`);
      });
      // meble
      const fs = `fill="none" stroke="${C.furn}" stroke-width="3"`;
      g.furn.forEach((f) => {
        const [t, x, y, a, b] = f;
        if (t === 'k') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" ${fs}/>`);
          [0.3, 0.6].forEach((dx) => p.push(`<circle cx="${(x + a - dx) * U}" cy="${(y + b / 2) * U}" r="${0.1 * U}" ${fs}/>`));
          p.push(`<rect x="${(x + 0.25) * U}" y="${(y + 0.12) * U}" width="${0.5 * U}" height="${(b - 0.24) * U}" rx="6" ${fs}/>`);
        } else if (t === 'sofa') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" rx="10" ${fs}/>`);
          const vert = b > a;
          p.push(vert ? `<line x1="${(x + 0.22) * U}" y1="${y * U}" x2="${(x + 0.22) * U}" y2="${(y + b) * U}" stroke="${C.furn}" stroke-width="3"/>` : `<line x1="${x * U}" y1="${(y + 0.22) * U}" x2="${(x + a) * U}" y2="${(y + 0.22) * U}" stroke="${C.furn}" stroke-width="3"/>`);
        } else if (t === 'table') {
          p.push(`<circle cx="${x * U}" cy="${y * U}" r="${a * U}" ${fs}/>`);
          [0, 1.57, 3.14, 4.71].forEach((k) => p.push(`<circle cx="${(x + Math.cos(k) * (a + 0.22)) * U}" cy="${(y + Math.sin(k) * (a + 0.22)) * U}" r="${0.16 * U}" ${fs}/>`));
        } else if (t === 'bed' || t === 'bed1') {
          const horiz = f[5] === 'h';
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" rx="8" ${fs}/>`);
          if (horiz) p.push(`<rect x="${(x + 0.1) * U}" y="${(y + 0.1) * U}" width="${0.45 * U}" height="${(b - 0.2) * U}" rx="8" ${fs}/>`);
          else p.push(`<rect x="${(x + 0.1) * U}" y="${(y + 0.1) * U}" width="${(a - 0.2) * U}" height="${0.45 * U}" rx="8" ${fs}/>`);
        } else if (t === 'desk') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" ${fs}/>`);
        } else if (t === 'tub') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" rx="12" ${fs}/>`);
          p.push(`<rect x="${(x + 0.1) * U}" y="${(y + 0.1) * U}" width="${(a - 0.2) * U}" height="${(b - 0.2) * U}" rx="22" ${fs}/>`);
        } else if (t === 'shower') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${b * U}" ${fs}/><line x1="${x * U}" y1="${y * U}" x2="${(x + a) * U}" y2="${(y + b) * U}" stroke="${C.furn}" stroke-width="2"/>`);
        } else if (t === 'wc') {
          p.push(`<ellipse cx="${x * U}" cy="${y * U + 0.28 * U}" rx="${0.19 * U}" ry="${0.26 * U}" ${fs}/><rect x="${(x - 0.2) * U}" y="${y * U - 0.02 * U}" width="${0.4 * U}" height="${0.14 * U}" ${fs}/>`);
        } else if (t === 'sink') {
          p.push(`<rect x="${x * U}" y="${y * U}" width="${a * U}" height="${0.45 * U}" rx="8" ${fs}/><ellipse cx="${(x + a / 2) * U}" cy="${(y + 0.22) * U}" rx="${0.18 * U}" ry="${0.13 * U}" ${fs}/>`);
        }
      });
    }
    // ściany wewnętrzne (krawędzie pomieszczeń) i zewnętrzne
    const iw = mini ? 7 : 8;
    g.rooms.forEach(([x, y, w, h]) => p.push(`<rect x="${x * U}" y="${y * U}" width="${w * U}" height="${h * U}" fill="none" stroke="${C.wall}" stroke-width="${iw}"/>`));
    // otwory bez drzwi
    g.open.forEach(([o, at, a, len]) => {
      const r = o === 'h' ? [a * U, at * U - iw, len * U, iw * 2] : [at * U - iw, a * U, iw * 2, len * U];
      p.push(`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${C.floor}"/>`);
    });
    // drzwi: przerwa w ścianie + skrzydło i łuk
    g.doors.forEach(([o, at, a, len, dir]) => {
      const r = o === 'h' ? [a * U, at * U - iw, len * U, iw * 2] : [at * U - iw, a * U, iw * 2, len * U];
      p.push(`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${C.floor}"/>`);
      if (mini) return;
      if (o === 'h') {
        const x0 = a * U;
        const y0 = at * U;
        const y1 = y0 + dir * len * U;
        p.push(`<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${C.wall}" stroke-width="3"/><path d="M${x0 + len * U} ${y0} A${len * U} ${len * U} 0 0 ${dir > 0 ? 1 : 0} ${x0} ${y1}" fill="none" stroke="${C.furn}" stroke-width="2" stroke-dasharray="6 5"/>`);
      } else {
        const x0 = at * U;
        const y0 = a * U;
        const x1 = x0 + dir * len * U;
        p.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${C.wall}" stroke-width="3"/><path d="M${x0} ${y0 + len * U} A${len * U} ${len * U} 0 0 ${dir > 0 ? 0 : 1} ${x1} ${y0}" fill="none" stroke="${C.furn}" stroke-width="2" stroke-dasharray="6 5"/>`);
      }
    });
    // obrys zewnętrzny
    const ow = mini ? 16 : 22;
    p.push(`<rect x="${-ow / 2}" y="${-ow / 2}" width="${W * U + ow}" height="${H * U + ow}" fill="none" stroke="${C.wall}" stroke-width="${ow}"/>`);
    // okna
    g.win.forEach(([side, a, b]) => {
      const t = ow;
      let r;
      if (side === 't') r = [a * U, -t, (b - a) * U, t];
      else if (side === 'r') r = [W * U, a * U, t, (b - a) * U];
      else r = [-t, a * U, t, (b - a) * U];
      p.push(`<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${C.win}" stroke="${C.wall}" stroke-width="2"/>`);
      if (side === 't') p.push(`<line x1="${a * U}" y1="${-t / 2}" x2="${b * U}" y2="${-t / 2}" stroke="${C.wall}" stroke-width="2"/>`);
      else p.push(`<line x1="${r[0] + t / 2}" y1="${a * U}" x2="${r[0] + t / 2}" y2="${b * U}" stroke="${C.wall}" stroke-width="2"/>`);
    });
    // wejście
    const [ex, ew] = g.entry;
    p.push(`<rect x="${ex * U}" y="${H * U - 2}" width="${ew * U}" height="${ow + 4}" fill="${C.floor}"/>`);
    if (!mini) p.push(`<path d="M${(ex + ew / 2) * U} ${H * U + 60} l0 -42 m-14 14 l14 -14 l14 14" fill="none" stroke="${C.text}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
    // podpisy pomieszczeń
    if (!mini && parts) {
      g.rooms.forEach(([x, y, w, h, i]) => {
        if (i < 0 || !parts[i]) return;
        const [name, area] = parts[i];
        const cx = (x + w / 2) * U;
        const cy = (y + h / 2 + (h > 2.5 ? h * 0.2 : 0)) * U;
        const small = w < 1.6;
        const fsz = small ? 22 : 28;
        p.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="${fsz}" fill="${C.mute}" font-family="Manrope, sans-serif" font-weight="600">${esc(small ? name.split(' ')[0] : name)}</text>`);
        p.push(`<text x="${cx}" y="${cy + fsz + 2}" text-anchor="middle" font-size="${fsz + 2}" fill="${C.text}" font-family="Manrope, sans-serif" font-weight="800">${String(area).replace('.', ',')} m²</text>`);
      });
    }
    p.push('</svg>');
    return p.join('');
  }

  // rzut piętra: lokale w dwóch rzędach wzdłuż korytarza; kolor = status
  function floorPlate(apts, opts = {}) {
    const per = apts.length;
    const half = Math.ceil(per / 2);
    const rowA = apts.slice(0, half);
    const rowB = apts.slice(half).reverse();
    const Wd = 1200;
    const rowH = 230;
    const cor = 70;
    const Hd = rowH * 2 + cor;
    const fill = { free: '#e3efe8', reserved: '#f6ead2', sold: '#ece9e4' };
    const strokeC = { free: '#2f7a55', reserved: '#b97f12', sold: '#c9c4bb' };
    const p = [`<svg viewBox="-20 -20 ${Wd + 40} ${Hd + 40}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Rzut piętra ${opts.floorLabel || ''}">`];
    p.push(`<rect x="-14" y="-14" width="${Wd + 28}" height="${Hd + 28}" rx="10" fill="#24272b"/>`);
    p.push(`<rect x="0" y="${rowH}" width="${Wd}" height="${cor}" fill="#f2efe9"/>`);
    // klatka i winda
    const core = [Wd / 2 - 70, rowH - 10, 140, cor + 20];
    p.push(`<rect x="${core[0]}" y="${core[1]}" width="${core[2]}" height="${core[3]}" fill="#d9d4cb"/>`);
    p.push(`<text x="${Wd / 2}" y="${rowH + cor / 2 + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="#4a4f57" font-family="Manrope, sans-serif">KLATKA</text>`);
    const drawRow = (row, y, top) => {
      const total = row.reduce((s, a) => s + a.area, 0);
      let x = 0;
      row.forEach((a) => {
        const w = (a.area / total) * Wd;
        const st = a.status;
        const label = `${a.code}, ${a.rooms} pok., ${String(a.area).replace('.', ',')} m², ${st === 'free' ? 'dostępne' : st === 'reserved' ? 'rezerwacja' : 'sprzedane'}`;
        p.push(`<g class="u u--${st}" data-apt="${a.id}" tabindex="${st === 'sold' ? -1 : 0}" role="button" aria-label="${esc(label)}">`);
        p.push(`<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${rowH - 8}" rx="6" fill="${fill[st]}" stroke="${strokeC[st]}" stroke-width="2"/>`);
        const cx = x + w / 2;
        const tc = st === 'sold' ? '#9a958c' : '#121417';
        p.push(`<text x="${cx}" y="${y + rowH / 2 - 14}" text-anchor="middle" font-size="24" font-weight="800" fill="${tc}" font-family="Manrope, sans-serif">${a.code}</text>`);
        p.push(`<text x="${cx}" y="${y + rowH / 2 + 14}" text-anchor="middle" font-size="18" font-weight="600" fill="${tc}" font-family="Manrope, sans-serif">${a.rooms} pok. · ${String(a.area).replace('.', ',')} m²</text>`);
        p.push(`<text x="${cx}" y="${y + rowH / 2 + 40}" text-anchor="middle" font-size="16" font-weight="700" fill="${strokeC[st]}" font-family="Manrope, sans-serif">${st === 'free' ? opts.fmt(a.price) : st === 'reserved' ? 'rezerwacja' : 'sprzedane'}</text>`);
        // okna od strony elewacji
        const wy = top ? y - 8 : y + rowH;
        p.push(`<rect x="${x + w * 0.2}" y="${wy}" width="${w * 0.6}" height="8" fill="#cfe0e9"/>`);
        p.push('</g>');
        x += w;
      });
    };
    drawRow(rowA, 0, true);
    drawRow(rowB, rowH + cor, false);
    p.push(`<text x="${Wd}" y="-24" text-anchor="end" font-size="16" font-weight="600" fill="#7b8088" font-family="Manrope, sans-serif">ELEWACJA POŁUDNIOWA ↑</text>`);
    p.push('</svg>');
    return p.join('');
  }

  // uproszczona mapa okolicy
  function map(inv) {
    const poi = inv.poi;
    const pts = [[160, 120], [470, 150], [420, 360], [110, 330]];
    const p = ['<svg viewBox="0 0 600 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa okolicy">'];
    p.push('<rect width="600" height="440" fill="#eef0ea"/>');
    p.push('<path d="M-20 300 C 120 250, 220 330, 360 290 S 560 220, 640 260 L640 330 C 560 300, 470 350, 360 360 S 120 330, -20 370 Z" fill="#cfe1ea"/>');
    p.push('<ellipse cx="150" cy="110" rx="120" ry="80" fill="#d5e5c8"/><ellipse cx="500" cy="380" rx="110" ry="60" fill="#d5e5c8"/>');
    [['M0 200 L600 170', 16], ['M300 0 L320 440', 14], ['M0 60 L600 90', 8], ['M80 0 L60 440', 8], ['M520 0 L540 440', 8], ['M0 420 L600 400', 8]].forEach(([d, w]) => {
      p.push(`<path d="${d}" stroke="#fff" stroke-width="${w}" fill="none"/>`);
    });
    p.push('<path d="M300 0 L320 440" stroke="#e1b25c" stroke-width="3" stroke-dasharray="14 10" fill="none"/>');
    poi.forEach(([name], i) => {
      const [x, y] = pts[i % pts.length];
      p.push(`<circle cx="${x}" cy="${y}" r="9" fill="#121417"/><text x="${x + 16}" y="${y + 5}" font-size="15" font-weight="700" fill="#121417" font-family="Manrope, sans-serif">${esc(name)}</text>`);
    });
    p.push('<g transform="translate(300 200)"><circle r="34" fill="#1f4d3f" opacity=".18"/><circle r="16" fill="#1f4d3f"/><circle r="6" fill="#fff"/></g>');
    p.push(`<text x="300" y="250" text-anchor="middle" font-size="16" font-weight="800" fill="#1f4d3f" font-family="Manrope, sans-serif">${esc(inv.name)}</text>`);
    p.push('</svg>');
    return p.join('');
  }

  window.DEV_PLANS = { plan, floorPlate, map };
})();
