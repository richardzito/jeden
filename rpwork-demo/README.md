# RP Work — demo strony

Pokazowa wersja nowej strony RP Work Sp. z o.o. (Ząbki): płynne membrany dachowe na starą papę, blachę, PVC i beton, posadzki żywiczne oraz uszczelnianie zbiorników i basenów. Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet. Bez niego w sekcji 3 widać zdjęcie dachu w trakcie natrysku, a kroki i karty działają dalej.

## Struktura

Układ działów wzorowany na trokentech.pl (bez sklepu), zgodnie z prośbą klienta.

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero, realizacje z drona, zajawka „Natrysk 3D”, działy + technologie + proces, opinie, FAQ, mocne CTA, stopka |
| `dachy.html`, `posadzki-zywiczne.html`, `zbiorniki-i-baseny.html` | Trzy działy (zaślepki „zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `technologie.html` | Technologie i karty techniczne (zaślepka) |
| `realizacje.html`, `kontakt.html`, `natrysk-3d.html` | Realizacje i filmy z drona, kontakt, pełny kalkulator 3D (zaślepki) |
| `assets/css/style.css` | System z poprzednich dem + motyw RP Work: czerwień `#e31e24` z logo (hover `#c4161c`) i grafit `#2b2a29` |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek (ciemnieje nad stopką), menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/membrana3d.js` | Scena Three.js sterowana przewijaniem (sekcja 3) |
| `assets/img/` | Logo z rpwork.pl (dorobiona wersja z białym napisem do stopki), zdjęcia od klienta i z rpwork.pl |

## Skąd są dane

- **Od klienta:** opis działów (dachy z płynnymi membranami na papę, blachę, PVC i beton; posadzki żywiczne; zbiorniki i baseny), systemy Neoproof Polyurea R (polimocznik, „na większości inwestycji”) i PU W-40 (poliuretan), pięć zdjęć z drona.
- **Z rpwork.pl:** logo i kolory, telefony 502 621 456 (Robert) i 533 822 313 (Paweł), biuro@rpwork.pl, RP Work Sp. z o.o., ul. Traugutta 5, 05-091 Ząbki, NIP 7010533322, „setki zleceń”, Warszawa i cała Polska, zdjęcie dachu z panoramą Warszawy i zdjęcie posadzki na balkonie.
- **Z kart produktów na trokentech.pl (dostawca klienta):**
  - Neoproof Polyurea R: dwuskładnikowa, na zimno; odporna na deszcz po 1 h; alifatyczna, odporna na UV bez warstwy nawierzchniowej; klasa trwałości W3 według ETA (do 25 lat); Broof(t1); elastyczna od −35 do +80°C; aplikacja wałkiem, pędzlem lub natryskiem; podłoża: beton, papa, blacha, PVC, piana PUR.
  - Neoproof PU W-40: jednoskładnikowa, na bazie wody; certyfikat chłodnego dachu Cool Material; Broof(t1); CE wg EN 1504-2; nie trzeba zrywać starej papy; wałek.
  - Przygotowanie podłoża w kroku 2 symulacji (mycie i naprawy papy, odrdzewienie i grunt antykorozyjny na blachę, chemiczne przygotowanie PVC, grunt do wilgotności betonu).

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- wszystkie 4 opinie (nie znalazłem opinii RP Work w sieci),
- podpisy realizacji (przedszkole, ciepłownia, budynek mieszkalny, budynek usługowy) odczytane ze zdjęć, bez nazw i adresów,
- karta „Film z drona” prowadzi na podstronę realizacji. Filmy klienta trafią tam po rozpoczęciu współpracy,
- ceny w symulacji: 120–170 zł/m² (polimocznik) i 90–130 zł/m² (poliuretan). Na stronie są opisane jako poglądowe.

## Efekt WOW: „Natrysk 3D” — zobacz, jak znika stara papa

Główna przewaga RP Work to membrana nakładana na stare pokrycie, bez zrywania papy. Efekt WOW pokazuje to dosłownie, jak na zdjęciu klienta z dachem w połowie pokrytym. Na stronie głównej jest zajawka. Pełny kalkulator to następny etap (`natrysk-3d.html`).

Zajawka (sekcja 3) to budynek z dachem płaskim (≈ 840 m²) z kominkami, wywietrzakami, świetlikami i wyłazem:

1. **Stara papa:** pasy, łaty, pęknięcia, pęcherze i zastoiny wody. Etykiety wskazują usterki.
2. **Nic nie zrywamy:** przewijanie zmienia podłoże: papa, blacha z rdzą, PVC ze zgrzewami, beton z rysami. Można też kliknąć przełącznik. Karta pokazuje, jak przygotowujemy dane podłoże.
3. **Natrysk:** dekarz w czerwonym kombinezonie przechodzi lancą pas po pasie, a za nim „rozlewa się” biała membrana. Mokra krawędź błyszczy, a kołnierze detali bieleją, gdy dojdzie do nich natrysk. Licznik pokazuje procent pokrycia.
4. **Biały dach:** kamera wznosi się jak dron, na dach spadają panele fotowoltaiczne. Karta pozwala przełączyć system (polimocznik / poliuretan) i pokazuje parametry z kart technicznych oraz szacunek ceny dla tego dachu.

Model można obracać przeciągnięciem.

Pomysł na pełny kalkulator: obrys dachu na mapie satelitarnej lub wpisanie powierzchni → podłoże i jego stan → system (z włókniną lub bez) → zużycie materiału wg kart technicznych → symulacja natrysku 3D → szacunek ceny i czasu → karta techniczna do pobrania i zapytanie do RP Work.

## Animacje

Te same zasady co w poprzednich demach:

- wejście hero, odsłanianie zdjęć, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru,
- nagłówek ciemnieje nad stopką,
- karta „Film z drona”: pulsujący pierścień wokół przycisku odtwarzania,
- karta „Zbiorniki i baseny”: woda w basenie delikatnie faluje,
- karty technologii: po najechaniu warstwy próbki (papa, grunt, membrana) się rozsuwają,
- dymek WhatsApp chowa się, gdy na ekranie jest scena 3D.

Wszystko respektuje `prefers-reduced-motion` (bez mgiełki natrysku i fal, krótsze ruchy).
