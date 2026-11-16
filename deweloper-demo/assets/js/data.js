/* Dane szablonu strony dewelopera (demo). Wszystkie nazwy, ceny i opinie są przykładowe: podmień je na swoje.
   Lokale generowane są deterministycznie z ustawień inwestycji, żeby szablon dało się szybko przestawić na prawdziwą ofertę. */
(() => {
  const company = {
    name: 'TWOJE LOGO',
    brand: 'Deweloper',
    phone: '+48500600700',
    phoneLabel: '500 600 700',
    email: 'sprzedaz@twojadomena.pl',
    hours: 'pn–pt 9–18, sob 10–14',
    office: 'Biuro sprzedaży: ul. Przykładowa 10, Warszawa',
    years: 18,
    handed: 1240,
    rating: 4.9,
    reviews: 312,
  };

  // procent rocznie i założenia kalkulatora (do zmiany w jednym miejscu)
  const credit = { rate: 7.1, years: 30, own: 20 };

  const investments = [
    {
      id: 'park-lipowy', name: 'Park Lipowy', city: 'Warszawa', district: 'Białołęka', status: 'W budowie', handover: 'IV kw. 2027',
      lead: 'Pięć pięter, ogródki na parterze, park 200 m od klatki.', img: 'park-lipowy', floors: 5, perFloor: 8, base: 13900, step: 220,
      tags: ['Ogródki do 80 m²', 'Hala garażowa', 'Rowerownia'],
      poi: [['Park Lipowy', '3 min pieszo'], ['Szkoła i przedszkole', '6 min pieszo'], ['Tramwaj do centrum', '4 min pieszo'], ['Centrum', '22 min tramwajem']],
      progress: [['Pozwolenie na budowę', 'III kw. 2025', 1], ['Stan zero', 'I kw. 2026', 1], ['Stan surowy', 'IV kw. 2026', 0.6], ['Odbiór kluczy', 'IV kw. 2027', 0]],
    },
    {
      id: 'tarasy-wisniowe', name: 'Tarasy Wiśniowe', city: 'Warszawa', district: 'Ursus', status: 'Gotowe do odbioru', handover: 'Klucze od ręki',
      lead: 'Cegła klinkierowa, duże tarasy na ostatnim piętrze, cicha ulica.', img: 'tarasy-wisniowe', floors: 4, perFloor: 7, base: 14800, step: 260,
      tags: ['Odbiór od ręki', 'Tarasy do 40 m²', 'Pompa ciepła'],
      poi: [['Stacja SKM', '5 min pieszo'], ['Szkoła podstawowa', '7 min pieszo'], ['Park Achera', '9 min pieszo'], ['Centrum', '18 min SKM']],
      progress: [['Pozwolenie na budowę', 'II kw. 2023', 1], ['Stan surowy', 'II kw. 2024', 1], ['Pozwolenie na użytkowanie', 'III kw. 2026', 1], ['Odbiór kluczy', 'od ręki', 1]],
    },
    {
      id: 'brzozowa-12', name: 'Brzozowa 12', city: 'Piaseczno', district: 'Zalesie', status: 'Przedsprzedaż', handover: 'II kw. 2028',
      lead: 'Kameralny budynek na 24 mieszkania, las Kabacki 10 minut autem.', img: 'brzozowa-12', floors: 3, perFloor: 8, base: 10900, step: 180,
      tags: ['Ceny przedsprzedaży', 'Tylko 24 lokale', 'Miejsce postojowe w cenie'],
      poi: [['Las', '10 min autem'], ['Stacja PKP', '8 min pieszo'], ['Szkoła', '5 min pieszo'], ['Warszawa Mokotów', '25 min autem']],
      progress: [['Zakup gruntu', 'I kw. 2025', 1], ['Pozwolenie na budowę', 'III kw. 2026', 1], ['Start budowy', 'I kw. 2027', 0], ['Odbiór kluczy', 'II kw. 2028', 0]],
    },
  ];

  // układy mieszkań (rzut rysowany na stronie z tych danych)
  const layouts = {
    A: { rooms: 1, area: 31.4, label: 'Kawalerka z aneksem', parts: [['Pokój z aneksem', 20.6], ['Łazienka', 4.1], ['Przedpokój', 4.3], ['Garderoba', 2.4]] },
    B: { rooms: 2, area: 42.8, label: '2 pokoje', parts: [['Salon z aneksem', 22.4], ['Sypialnia', 11.2], ['Łazienka', 4.6], ['Przedpokój', 4.6]] },
    C: { rooms: 3, area: 58.6, label: '3 pokoje', parts: [['Salon z aneksem', 25.8], ['Sypialnia', 12.4], ['Pokój', 9.6], ['Łazienka', 5.2], ['Przedpokój', 5.6]] },
    D: { rooms: 4, area: 76.2, label: '4 pokoje', parts: [['Salon z aneksem', 29.4], ['Sypialnia', 13.8], ['Pokój', 10.2], ['Pokój', 9.4], ['Łazienka', 5.4], ['WC', 1.8], ['Przedpokój', 6.2]] },
  };
  const floorPattern = ['C', 'B', 'A', 'B', 'D', 'B', 'A', 'C'];

  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const apartments = [];
  investments.forEach((inv, ii) => {
    seed = 1000 + ii * 77;
    for (let f = 0; f < inv.floors; f++) {
      for (let k = 0; k < inv.perFloor; k++) {
        const lay = floorPattern[k % floorPattern.length];
        const L = layouts[lay];
        const area = +(L.area + (rnd() - 0.5) * 2.4).toFixed(2);
        const top = f === inv.floors - 1;
        const pm = Math.round((inv.base + f * inv.step + (top ? 600 : 0) + (lay === 'A' ? 900 : 0) + (rnd() - 0.5) * 300) / 10) * 10;
        const price = Math.round((area * pm) / 1000) * 1000;
        const r = rnd();
        const sold = inv.id === 'tarasy-wisniowe' ? 0.52 : inv.id === 'brzozowa-12' ? 0.12 : 0.34;
        const status = r < sold ? 'sold' : r < sold + 0.12 ? 'reserved' : 'free';
        const outdoor = f === 0 ? ['ogródek', Math.round(30 + rnd() * 50)] : top && inv.id === 'tarasy-wisniowe' ? ['taras', Math.round(18 + rnd() * 22)] : ['balkon', +(4 + rnd() * 5).toFixed(1)];
        const promo = status === 'free' && rnd() < 0.18;
        const was = promo ? Math.round((price * (1.04 + rnd() * 0.03)) / 1000) * 1000 : price;
        const hist = [];
        // historia cen (jawność cen): data, cena
        hist.push(['2025-09-01', Math.round((was * 0.965) / 1000) * 1000]);
        hist.push(['2026-03-01', was]);
        if (promo) hist.push(['2026-11-01', price]);
        apartments.push({
          id: `${inv.id}-${f}-${k + 1}`,
          code: `${String.fromCharCode(65 + ii)}${f}.${String(k + 1).padStart(2, '0')}`,
          inv: inv.id, floor: f, idx: k, layout: lay, rooms: L.rooms, area, price, was, pm: Math.round(price / area),
          status, outdoor, side: k < inv.perFloor / 2 ? 'S' : 'N', exposure: k < inv.perFloor / 2 ? 'południe, zachód' : 'północ, wschód',
          promo, hist,
        });
      }
    }
  });

  const realizations = [
    { img: 'real-1', name: 'Osiedle Zielone Tarasy', city: 'Warszawa Bemowo', year: 2024, units: 168 },
    { img: 'real-2', name: 'Kamienica Ogrodowa', city: 'Warszawa Ochota', year: 2023, units: 74 },
    { img: 'real-3', name: 'Grafitowy Dom', city: 'Pruszków', year: 2022, units: 48 },
    { img: 'real-4', name: 'Willa Sosnowa', city: 'Konstancin', year: 2021, units: 18 },
  ];

  const reviews = [
    { name: 'Karolina i Michał', where: 'Tarasy Wiśniowe', text: 'Odbiór bez ani jednej usterki do poprawki. Klucze dostaliśmy w dniu z umowy.', stars: 5 },
    { name: 'Tomasz W.', where: 'Zielone Tarasy', text: 'Cena z cennika była ceną z umowy. Żadnych dopłat za miejsce czy komórkę „przy podpisie”.', stars: 5 },
    { name: 'Anna R.', where: 'Grafitowy Dom', text: 'Opiekun odpowiadał tego samego dnia przez cały rok budowy. Zdjęcia postępów co miesiąc.', stars: 5 },
    { name: 'Paweł i Ola', where: 'Kamienica Ogrodowa', text: 'Pomogli z kredytem: doradca znalazł bank, w którym rata była niższa o 380 zł.', stars: 5 },
  ];

  const packages = [
    { id: 'none', name: 'Stan deweloperski', price: 0, note: 'Gładzie, tynki, wylewki, okna 3-szybowe, drzwi antywłamaniowe.' },
    { id: 'base', name: 'Pod klucz Komfort', perM2: 1490, note: 'Podłogi dębowe, łazienka do sufitu, drzwi bezprzylgowe, oświetlenie.' },
    { id: 'prem', name: 'Pod klucz Premium', perM2: 2190, note: 'Jodełka, spiek w łazience, zabudowy na wymiar, smart home.' },
  ];

  window.DEV = { company, credit, investments, layouts, apartments, realizations, reviews, packages };
})();
