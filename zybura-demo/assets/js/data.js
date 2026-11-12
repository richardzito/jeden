/* Dane strony oferty: ul. Jana Kazimierza 28, Warszawa Wola (Odolany).
   Pomieszczenia w px rzutu (100 px = 1 m). Rzutu nie ma w ogłoszeniu — układ ułożony z metraży i zdjęć oferty. */
window.ZB = {
  offer: {
    title: '2 pokoje, 53,5 m², Wola',
    address: 'ul. Jana Kazimierza 28, Warszawa Wola',
    price: 1020000,
    garage: 60000,
    area: 53.5,
    rent: 730,
    phone: '+48696512833',
    phoneLabel: '696 512 833',
    whatsapp: '48696512833',
    agent: 'Agnieszka Żybura',
    license: 'PFRN 27594',
    email: 'azybura.nieruchomosci@gmail.com',
  },

  // Układ według rzutu z oferty (px, 100 px = 1 m). spot: [x, y, kierunek° (0 = północ, 90 = wschód), pochylenie, pole widzenia]
  rooms: [
    { id: 'salon', name: 'Pokój dzienny', short: 'Salon', area: 17.5, floor: 'wood', rects: [[0, 0, 570, 299]], spot: [548, 178, 284, -0.07, 80], photos: ['salon-1', 'salon-2', 'salon-wiz'], label: [300, 150] },
    { id: 'sypialnia', name: 'Sypialnia', short: 'Sypialnia', area: 14.9, floor: 'wood', rects: [[868, 0, 1387, 299]], spot: [918, 214, 78, -0.06, 80], photos: ['sypialnia-3', 'sypialnia-1', 'sypialnia-wiz'], label: [1130, 150] },
    { id: 'kuchnia', name: 'Kuchnia z oknem', short: 'Kuchnia', area: 7.4, floor: 'tile', rects: [[137, 314, 423, 574]], spot: [258, 330, 180, -0.13, 82], photos: ['kuchnia-1', 'kuchnia-2'], label: [290, 430] },
    { id: 'lazienka', name: 'Łazienka', short: 'Łazienka', area: 4.7, floor: 'tile', rects: [[582, 0, 856, 190]], spot: [716, 186, 358, -0.14, 92], photos: ['lazienka'], label: [720, 95] },
    { id: 'przedpokoj', name: 'Przedpokój', short: 'Przedpokój', area: 9.0, floor: 'tile', rects: [[435, 314, 669, 574], [582, 203, 856, 314]], spot: [600, 284, 192, -0.08, 84], photos: ['przedpokoj'], label: [552, 440] },
    { id: 'loggia1', name: 'Loggia przy kuchni', short: 'Loggia', area: 3.0, floor: 'terrace', outdoor: true, rects: [[-25, 314, 122, 574]], spot: [50, 540, 0, -0.04, 80], photos: [], label: [50, 440] },
    { id: 'loggia2', name: 'Loggia przy sypialni', short: 'Loggia 2', area: 2.5, floor: 'terrace', outdoor: true, rects: [[1412, -10, 1492, 300]], spot: [1452, 280, 0, -0.04, 80], photos: [], label: [1452, 150] },
  ],

  // ściany działowe, które można wyburzyć (do potwierdzenia przez konstruktora)
  walls: [
    { id: 'kuchnia', name: 'Kuchnia + pokój', note: 'Otwarta kuchnia z wyspą', cost: 6500, pin: [330, 306] },
    { id: 'hol', name: 'Przedpokój + pokój', note: 'Salon otwarty na hol', cost: 4000, pin: [500, 306] },
  ],

  config: {
    styl: [
      { id: 'obecny', name: 'Obecnie', note: 'jak na zdjęciach', cost: 0 },
      { id: 'odswiezony', name: 'Po odświeżeniu', note: 'łazienka, światło, meble', cost: 58000 },
      { id: 'puste', name: 'Puste', note: 'bez mebli', cost: 0 },
    ],
    sciany: [
      { id: 'bez', name: 'Ciepły beż', note: 'obecnie', cost: 0, color: '#d9c4a5' },
      { id: 'biel', name: 'Ciepła biel', note: '≈ 4 200 zł', cost: 4200, color: '#efe9e0' },
      { id: 'greige', name: 'Greige', note: '≈ 4 200 zł', cost: 4200, color: '#cec6ba' },
      { id: 'szalwia', name: 'Szałwia', note: '≈ 4 200 zł', cost: 4200, color: '#b8bfa8' },
    ],
    podloga: [
      { id: 'panele', name: 'Panele dąb', note: 'obecnie', rate: 0 },
      { id: 'jasny', name: 'Dąb jasny', note: '≈ 160 zł/m²', rate: 160 },
      { id: 'jodelka', name: 'Jodełka', note: '≈ 290 zł/m²', rate: 290 },
    ],
    kuchnia: [
      { id: 'braz', name: 'Orzech', note: 'obecnie', cost: 0, color: '#8a5737' },
      { id: 'biel', name: 'Biel mat', note: '≈ 19 000 zł', cost: 19000, color: '#f0eee9' },
      { id: 'szalwia', name: 'Szałwia', note: '≈ 21 000 zł', cost: 21000, color: '#97a38e' },
      { id: 'grafit', name: 'Grafit', note: '≈ 21 000 zł', cost: 21000, color: '#3a3c3f' },
    ],
    floorArea: 41.4,
  },

  photos: [
    { id: 'salon-1', alt: 'Pokój dzienny z wyjściem na loggię' },
    { id: 'salon-2', alt: 'Pokój dzienny, widok od wejścia' },
    { id: 'salon-wiz', alt: 'Wizualizacja: pokój dzienny po odświeżeniu' },
    { id: 'sypialnia-3', alt: 'Sypialnia z wyjściem na loggię' },
    { id: 'sypialnia-1', alt: 'Sypialnia' },
    { id: 'sypialnia-wiz', alt: 'Wizualizacja: sypialnia po odświeżeniu' },
    { id: 'kuchnia-1', alt: 'Kuchnia z oknem' },
    { id: 'kuchnia-2', alt: 'Zabudowa kuchenna' },
    { id: 'przedpokoj', alt: 'Przedpokój i wejście do kuchni' },
    { id: 'lazienka', alt: 'Łazienka z kabiną prysznicową' },
    { id: 'osiedle-3', alt: 'Zielone, zamknięte osiedle' },
    { id: 'osiedle-2', alt: 'Plac zabaw na osiedlu' },
    { id: 'osiedle-1', alt: 'Dziedziniec osiedla' },
    { id: 'klatka-2', alt: 'Klatka schodowa z windą' },
  ],

  done: [
    { img: 'na-sprzedaz-pawia-piaseczno-43-m2-1', kind: 'Sprzedane', place: 'Piaseczno, ul. Pawia', meta: '2 pokoje · 43,5 m²' },
    { img: 'wynajete-12', kind: 'Sprzedane', place: 'Warszawa, Marywilska', meta: '3 pokoje · 63 m²' },
    { img: 'na-wynajem-segment-olchowa-jozefoslaw-146-m2-15', kind: 'Wynajęte', place: 'Józefosław, ul. Olchowa', meta: 'Segment · 146 m²' },
    { img: 'wynajete-13', kind: 'Sprzedane', place: 'Piaseczno, Al. Kalin', meta: '2 pokoje · 49 m²' },
    { img: 'wynajete-10', kind: 'Sprzedane', place: 'Józefosław, ul. Alaski', meta: '3 pokoje · 57 m²' },
    { img: 'wynajete-8', kind: 'Wynajęte', place: 'Mokotów, ul. Bruśny', meta: '2 pokoje · 31 m²' },
    { img: 'wynajete-10-1', kind: 'Sprzedane', place: 'Skierniewice, Witkacego', meta: 'Dom · 140 m²' },
    { img: 'wynajete-9', kind: 'Wynajęte', place: 'Józefosław, ul. Tenisowa', meta: '2 pokoje · 43 m²' },
    { img: 'wynajete-11', kind: 'Sprzedane', place: 'Wola Gołkowska', meta: 'Działka · 1717 m²' },
  ],
};
