/* Dane oferty: pomieszczenia (współrzędne w pikselach rzutu klopot-plan.jpg, 106 px ≈ 1 m),
   zdjęcia, okolica i opcje konfiguratora. Wspólne dla strony i spaceru 3D. */
window.PH = {
  offer: {
    title: 'Penthouse 101 m² z dwoma tarasami',
    address: 'ul. Kłopot 4A, Warszawa Wola (Powązki)',
    price: 3499000,
    parking: 100000,
    area: 101.43,
    rent: 1150,
    phone1: '+48222902010',
    phone1Label: '22 290 20 10',
    phone2: '+48798600414',
    phone2Label: '798 600 414',
    agent: 'Adam Kijowski',
    agentEmail: 'kijowski@unikat.realestate',
    license: '28270',
    lat: 52.25705,
    lng: 20.98035,
  },

  // id, nazwa, metraż, prostokąty podłogi [x1,y1,x2,y2], punkt spaceru [x,y,kierunek°], zdjęcia
  // kierunek: 0 = w górę rzutu (taras), 90 = w prawo, 180 = w dół, 270 = w lewo
  rooms: [
    { id: 'salon', name: 'Salon', area: 23.47, floor: 'wood', rects: [[980, 400, 1440, 1000]], spot: [1315, 975, 336, -0.05, 78], photos: ['salon-3', 'salon-1', 'salon-2'], label: [1180, 720] },
    { id: 'kuchnia', name: 'Kuchnia', area: 12.68, floor: 'wood', rects: [[1440, 400, 1740, 560], [1478, 560, 1740, 980]], spot: [1608, 700, 180, -0.3, 92], photos: ['kuchnia-1', 'kuchnia-2'], label: [1600, 690] },
    { id: 'taras', name: 'Taras', area: 17.66, floor: 'terrace', outdoor: true, rects: [[957, 42, 1685, 352]], spot: [995, 330, 18, -0.06], photos: ['taras-2', 'taras-1'], label: [1320, 190] },
    { id: 'przedpokoj', name: 'Przedpokój', area: 16.37, floor: 'wood', rects: [[1300, 1000, 1470, 1805], [770, 1670, 1300, 1805]], spot: [1385, 1450, 0, -0.06], photos: [], label: [1385, 1560] },
    { id: 'pokoj', name: 'Pokój', area: 10.46, floor: 'wood', rects: [[982, 1015, 1283, 1425]], spot: [1268, 1250, 282, -0.06, 80], photos: ['pokoj'], label: [1130, 1180] },
    { id: 'loggia', name: 'Loggia', area: 9.63, floor: 'terrace', outdoor: true, rects: [[220, 1108, 937, 1270]], spot: [270, 1185, 90, -0.06], photos: ['taras-1'], label: [560, 1190] },
    { id: 'gabinet', name: 'Gabinet', area: 10.35, floor: 'wood', rects: [[612, 1312, 965, 1655]], spot: [800, 1632, 4, -0.06], photos: ['gabinet'], label: [800, 1470] },
    { id: 'sypialnia', name: 'Sypialnia', area: 18.64, floor: 'wood', rects: [[222, 1312, 597, 1838], [597, 1670, 757, 1838]], spot: [445, 1765, 354, -0.09, 80], photos: ['sypialnia-2', 'sypialnia-1'], label: [420, 1560] },
    { id: 'lazienka', short: 'Łazienka', name: 'Łazienka z wanną', area: 4.82, floor: 'tile', rects: [[982, 1440, 1285, 1655]], spot: [1120, 1642, 0, -0.12], photos: ['lazienka'], label: [1110, 1540] },
    { id: 'lazienka2', short: 'Łazienka 2', name: 'Łazienka z prysznicem', area: 2.95, floor: 'tile', rects: [[1455, 1000, 1715, 1160]], spot: [1500, 1065, 90], photos: [], label: [1580, 1100] },
    { id: 'pralnia', name: 'Pralnia', area: 2.65, floor: 'tile', rects: [[1455, 1172, 1670, 1315]], spot: [1495, 1250, 90], photos: [], label: [1560, 1245] },
  ],

  photos: [
    { id: 'salon-3', room: 'salon', alt: 'Salon z narożnikiem i jadalnią przy oknie tarasowym' },
    { id: 'salon-1', room: 'salon', alt: 'Strefa dzienna: wypoczynek i stół jadalniany' },
    { id: 'salon-2', room: 'salon', alt: 'Salon: ściana TV z kominkiem' },
    { id: 'kuchnia-1', room: 'kuchnia', alt: 'Kuchnia: czarne fronty, dębowe szafki górne' },
    { id: 'kuchnia-2', room: 'kuchnia', alt: 'Kuchnia: zabudowa z dwoma piekarnikami i lodówką side by side' },
    { id: 'sypialnia-2', room: 'sypialnia', alt: 'Sypialnia z oknem na loggię' },
    { id: 'sypialnia-1', room: 'sypialnia', alt: 'Sypialnia: zabudowa szaf na wymiar' },
    { id: 'gabinet', room: 'gabinet', alt: 'Gabinet z biurkiem przy oknie i szafą na wymiar' },
    { id: 'pokoj', room: 'pokoj', alt: 'Pokój z wyjściem na loggię' },
    { id: 'lazienka', room: 'lazienka', alt: 'Łazienka z wanną, armatura Hansgrohe i Laufen' },
    { id: 'taras-2', room: 'taras', alt: 'Taras 17,67 m² z widokiem na Warszawę' },
    { id: 'taras-1', room: 'loggia', alt: 'Loggia 9,63 m² na 11. piętrze' },
    { id: 'budynek', room: null, alt: 'Budynek z 2019 roku przy ul. Kłopot 4A' },
  ],

  // Okolica: odległości w linii prostej od budynku (OpenStreetMap)
  poi: [
    { cat: 'Zakupy', name: 'Westfield Arkadia', d: 290 },
    { cat: 'Zakupy', name: 'Carrefour (Arkadia)', d: 380 },
    { cat: 'Zakupy', name: 'Defabryka', d: 730 },
    { cat: 'Komunikacja', name: 'Tramwaj: Rondo „Radosława”', d: 340 },
    { cat: 'Komunikacja', name: 'Warszawa Gdańska (SKM, kolej)', d: 850 },
    { cat: 'Komunikacja', name: 'Metro M1 Dworzec Gdański', d: 950 },
    { cat: 'Edukacja', name: 'Przedszkole „Żyrafki”', d: 450 },
    { cat: 'Edukacja', name: 'XXXII LO im. Grota-Roweckiego', d: 805 },
    { cat: 'Edukacja', name: 'XVI LO im. Sempołowskiej', d: 860 },
    { cat: 'Zieleń i zdrowie', name: 'Park Sady Żoliborskie', d: 1010 },
    { cat: 'Zieleń i zdrowie', name: 'Warszawski Instytut Zdrowia Kobiet', d: 790 },
    { cat: 'Dojazd', name: 'Rondo „Radosława” (al. Jana Pawła II)', d: 250 },
  ],

  // Konfigurator: stawki orientacyjne (materiał + robocizna), do potwierdzenia z wykonawcą
  config: {
    floor: [
      { id: 'gres', name: 'Gres', note: 'obecnie', rate: 0 },
      { id: 'dab', name: 'Deska dębowa', note: '≈ 380 zł/m²', rate: 380 },
      { id: 'jodelka', name: 'Jodełka dębowa', note: '≈ 450 zł/m²', rate: 450 },
      { id: 'mikro', name: 'Mikrocement', note: '≈ 520 zł/m²', rate: 520 },
    ],
    walls: [
      { id: 'greige', name: 'Greige', note: 'obecnie', cost: 0, color: '#c6c1b7' },
      { id: 'biel', name: 'Ciepła biel', note: '≈ 9 800 zł', cost: 9800, color: '#efebe4' },
      { id: 'szalwia', name: 'Szałwia', note: '≈ 9 800 zł', cost: 9800, color: '#a9b49c' },
      { id: 'grafit', name: 'Grafit', note: '≈ 9 800 zł', cost: 9800, color: '#5b5e63' },
    ],
    kitchen: [
      { id: 'czarny', name: 'Czarny mat', note: 'obecnie', cost: 0, color: '#1d1e21' },
      { id: 'bialy', name: 'Biel', note: '≈ 14 000 zł', cost: 14000, color: '#ecebe7' },
      { id: 'dab', name: 'Dąb', note: '≈ 16 000 zł', cost: 16000, color: '#a07a52' },
      { id: 'zielen', name: 'Butelkowa zieleń', note: '≈ 15 000 zł', cost: 15000, color: '#2f4a3e' },
    ],
    pokoj: [
      { id: 'praca', name: 'Do pracy', note: 'obecnie', cost: 0 },
      { id: 'gosc', name: 'Gościnny', note: '≈ 6 500 zł', cost: 6500 },
      { id: 'dziecko', name: 'Dziecięcy', note: '≈ 9 000 zł', cost: 9000 },
    ],
    gabinet: [
      { id: 'gabinet', name: 'Gabinet', note: 'obecnie', cost: 0 },
      { id: 'dziecko', name: 'Pokój dziecka', note: '≈ 9 000 zł', cost: 9000 },
      { id: 'garderoba', name: 'Garderoba', note: '≈ 18 000 zł', cost: 18000 },
    ],
    furniture: [
      { id: 'on', name: 'Umeblowane', note: 'meble zostają w cenie', cost: 0 },
      { id: 'off', name: 'Puste wnętrze', note: 'zobacz samą przestrzeń', cost: 0 },
    ],
    floorArea: 86, // podłoga poza łazienkami i pralnią, m²
  },
};
