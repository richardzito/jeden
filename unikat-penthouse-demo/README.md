# UNIKAT — demo strony oferty z spacerem 3D i konfiguratorem

Pokazowa strona jednej oferty agencji UNIKAT Real Estate: penthouse 101,43 m² przy ul. Kłopot 4A (Wola, Powązki), na wyłączność, 3 499 000 zł + 100 000 zł za 2 miejsca w garażu.

Statyczny HTML/CSS/JS bez kroku budowania. Jedyna biblioteka to three.js 0.160 do 3D, ładowana z CDN.

## Jak otworzyć

- **Folder / ZIP:** rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`.
- **Jeden plik:** `unikat-penthouse-klopot.html` ma w sobie style, skrypty, dane i zdjęcia (w nieco niższej rozdzielczości). Można go wysłać mailem.
- **Internet jest potrzebny** do:
  - modelu 3D (three.js z CDN);
  - czcionki Montserrat (Google Fonts);
  - mapy OpenStreetMap.

  Bez internetu reszta strony działa, a zamiast modelu widać rzut.

## Co jest na stronie

1. **Hero:**
   - zdjęcie salonu, cena i cena za m²;
   - etykiety „Na wyłączność” i „Bez prowizji dla kupującego”;
   - trzy przyciski: Umów oglądanie, Spacer 3D, telefon.
2. **Parametry:** 8 najważniejszych liczb (metraż, pokoje, piętro, tarasy, garaż, komórka, rok, klasa energetyczna).
3. **Spacer 3D + konfigurator** (sekcja WOW, opis niżej).
4. **Galeria:** 13 zdjęć z ogłoszenia, pełny ekran, strzałki, klawiatura i przesuwanie palcem. Z każdego zdjęcia pokoju można przejść do tego pokoju w 3D.
5. **Opis:**
   - 8 atutów: kominek z nawilżaczem, 2 klimatyzatory, Hansgrohe/Laufen, Elstead/Klea, AGD Bosch, pralnia, grzejniki dla alergików, meble w cenie;
   - trzy bloki ze zdjęciami;
   - tabela szczegółów;
   - przyciski „Pobierz ofertę PDF” (druk z osobnym układem) i „Udostępnij”.
6. **Interaktywny rzut:** oryginalny rzut z ogłoszenia z zaznaczanymi pomieszczeniami. Pokazuje metraż, zdjęcie i przycisk „Zobacz w 3D”.
7. **Lokalizacja:**
   - mapa OpenStreetMap;
   - 12 miejsc w okolicy z odległością i czasem pieszo, z filtrem kategorii;
   - przyciski „Wyznacz dojazd” i „Kopiuj adres”.
8. **Koszty i kalkulator raty:**
   - cena, miejsca postojowe (włącz/wyłącz), prowizja 0 zł, PCC 2%, czynsz;
   - rata liczona z wkładem własnym, okresem i oprocentowaniem, razem z kosztem zmian z konfiguratora.
9. **Umów oglądanie:**
   - opiekun oferty z telefonami i e-mailem;
   - formularz: na miejscu / wideo / doradca kredytowy, wybór dnia i godziny, dane, zgoda;
   - po wysłaniu: potwierdzenie i plik do kalendarza (.ics).
10. **FAQ, ostatnie CTA, stopka** z danymi agencji.

Na telefonie na dole jest stały pasek: „Zadzwoń” i „Umów oglądanie”. Nagłówek po przewinięciu robi się biały i pokazuje cenę.

## Spacer 3D i konfigurator

Model mieszkania jest zbudowany według rzutu z ogłoszenia (106 px rzutu ≈ 1 m, wysokość 2,80 m), a wnętrza, materiały i kolory odtworzone według 13 zdjęć oferty (kolory próbkowane bezpośrednio ze zdjęć).

**Co odwzorowuje zdjęcia:**

- **Salon:**
  - narożnik ze skóry z szezlongiem i puf, złoty stolik-taca;
  - dębowy stół na czarnej nodze „pająk”, krzesła kubełkowe, lampa z 5 żarówkami;
  - okrągłe lustro, czarny grzejnik pionowy z klimatyzatorem;
  - ściana RTV: tapeta, czarny panel, telewizor, wisząca szafka z kominkiem-nawilżaczem, lampy-klatki;
  - grafitowe zasłony i firana.
- **Kuchnia:**
  - czarne matowe fronty, blat z czarnego granitu, betonowe płytki;
  - szafki z szarego dębu z LED, słupek AGD z czarnego szkła (lodówka side by side, 2 piekarniki).
- **Sypialnia:**
  - tapicerowane wezgłowie z przeszyciami, pościel i pled jak na zdjęciu;
  - latarnie przy łóżku, żyrandol, duży zegar;
  - fotel „butterfly”, szafy z szarego dębu.
- **Pokój:** tapeta „układ okresowy”, betonowe szafy z falistymi uchwytami, wiszące biurko, lampa „pająk”.
- **Gabinet:** orzechowa szafa, biurko z czarnym stelażem, skórzany fotel, przeszklona szafka, mosiężne kinkiety, roleta rzymska.
- **Łazienka:** szary kamień 60 × 120, szafka z szarego dębu, okrągłe lustro na pasku, wanna w zabudowie.
- **Taras:** granitowe płyty, szklana balustrada z szarymi słupkami, skrzynia z modrzewia, donice.
- **Wszędzie:**
  - podłoga z gresu drewnopodobnego (deski 20 × 120 cm);
  - okna w ciemnobrązowych ramach z czarnymi parapetami;
  - białe drzwi i listwy, czarne reflektory sufitowe.

**Realistyczne światło:**

- słońce wpada przez okna i zostawia plamy na podłodze, a cienie są miękkie;
- światło z okien oświetla wnętrze;
- odbicia i światło odbite są „zdjęte” z wnętrza modelu;
- na komputerze są też cienie kontaktowe (GTAO);
- za oknami jest prawdziwy widok z 11. piętra: panorama wycięta ze zdjęcia z tarasu (balustradę usunięto, niebo zmienia się z porą dnia);
- makieta stoi na neutralnym tle z miękkim cieniem.

**Tryby widoku:**

- **Makieta 3D:** obracanie przeciągnięciem, etykiety pokoi z metrażem, kliknięcie pokoju przenosi do środka.
- **Spacer:** widok z wysokości oczu. Przeciągnięcie obraca widok. Przejście do innego miejsca: kliknięcie podłogi, koła na podłodze, przycisku pokoju albo minimapy. Jest też przycisk „Zdjęcie z tego pokoju”.
- **Rzut:** widok z góry.

**Pora dnia:** dzień, zachód słońca, noc. W nocy świecą lampy, kominek i okna w mieście.

**Pełny ekran:** na telefonie wszystkie gesty idą wtedy do 3D.

**Konfigurator** (zmiany od razu widać w modelu):

- **Podłoga:** gres (stan obecny), deska dębowa, jodełka, mikrocement.
- **Ściany:** greige (stan obecny), ciepła biel, szałwia, grafit.
- **Fronty kuchni:** czarny mat (stan obecny), biel, dąb, butelkowa zieleń.
- **Pokój 10,46 m²:** do pracy, gościnny, dziecięcy.
- **Gabinet 10,35 m²:** gabinet, pokój dziecka, garderoba.
- **Meble:** umeblowane albo puste wnętrze.

Pod konfiguratorem widać szacunkowy koszt zmian i budżet łączny. „Wyślij moją wersję opiekunowi” robi zrzut z modelu i dołącza go z opisem zmian do formularza umawiania.

## Skąd są dane

Ze strony ogłoszenia (unikat.realestate):

- tytuł, opis, cena, metraże pomieszczeń, taras, loggia, komórka, miejsca postojowe, czynsz, rok budowy, piętro, certyfikat;
- wyposażenie (Elstead, Klea, Hansgrohe, Laufen, Bosch), uwaga o łóżku i TV;
- 13 zdjęć i rzut (z ich znakiem wodnym);
- opiekun oferty (Adam Kijowski, licencja 28270, telefony 22 290 20 10 i 798 600 414, e-mail);
- dane agencji w stopce;
- logo i kolory marki (granat `#0e1033`, złoto `#cca866`) oraz czcionka Montserrat.

Okolica i odległości: OpenStreetMap (Nominatim), odległości w linii prostej od budynku. Czas pieszo liczony orientacyjnie.

**Do potwierdzenia z agencją** (wymyślone albo uproszczone na potrzeby demo):

- **Konfigurator:**
  - stawki: deska 380 zł/m², jodełka 450 zł/m², mikrocement 520 zł/m²;
  - malowanie ok. 9 800 zł, fronty 14–16 tys. zł, pokoje 6,5–18 tys. zł;
  - powierzchnia podłogi do wymiany: 86 m².
- **Kalkulator:** domyślne oprocentowanie 7,0%, wkład 20%, 30 lat. PCC 2% liczony od ceny razem z miejscami.
- **Model 3D:**
  - wymiary są orientacyjne, rozmieszczenie mebli według zdjęć, ale poglądowe;
  - widok za oknami to jedno zdjęcie z tarasu powtórzone dookoła (lustrzanie);
  - kierunki świata odczytane z róży wiatrów na rzucie.
- **Terminy oglądania:** godziny (pn–pt 9–19, sb 10–14) są przykładowe. Formularz w demo niczego nie wysyła.
- Zdjęcie opiekuna zastąpione inicjałami.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Cała strona oferty |
| `assets/css/style.css` | Wygląd, wersja na telefon, druk/PDF, ograniczenie ruchu |
| `assets/js/data.js` | Dane: pomieszczenia (z współrzędnymi z rzutu), zdjęcia, okolica, opcje i stawki konfiguratora |
| `assets/js/tour3d.js` | Spacer 3D: model z rzutu i zdjęć, światło (słońce, okna, odbicia, GTAO), tryby widoku, pora dnia, minimapa, konfiguracja wnętrza, API `window.TOUR` |
| `assets/js/tour-pano.js` | Panorama z tarasu (ze zdjęcia oferty) do widoku za oknami |
| `assets/js/main.js` | Strona: nagłówek, konfigurator i koszty, galeria, rzut, okolica, kalkulator, formularz, udostępnianie |
| `assets/img/` | Zdjęcia (pełne i `-m` dla telefonów), rzut, logo w dwóch wersjach, ikona |

## Prezentacja dla agencji

W lewym dolnym rogu jest przycisk **„Demo 8”**. Otwiera listę funkcji strony z linkami do sekcji.

Proponowana ścieżka (ok. 4 minuty):

1. **Hero:** cena, „Bez prowizji”, przycisk „Wejdź do środka w 3D”.
2. **Makieta:**
   - obróć model;
   - kliknij „Salon”, rozejrzyj się i przejdź klikając podłogę;
   - przełącz zachód słońca i noc.
3. **Konfigurator:**
   - deska dębowa, ciepła biel, gabinet → garderoba;
   - koszt zmian i budżet przeliczają się na żywo;
   - „Wyślij moją wersję opiekunowi” (zrzut trafia do formularza).
4. **Rzut:** kliknij sypialnię, potem „Zobacz w 3D”.
5. **Koszty:** wyłącz miejsca postojowe, zmień wkład własny, zobacz ratę.
6. **Umów oglądanie:** wybierz dzień i godzinę, wyślij, pobierz plik do kalendarza.

## Animacje

- Sekcje pojawiają się przy przewijaniu: przesunięcie i przezroczystość, 700 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, z lekkim opóźnieniem między kartami.
- Zdjęcie w hero wchodzi z lekkim powiększeniem, tylko raz.
- Przyciski reagują na wciśnięcie (`scale(0.97)`).
- Kwoty w konfiguratorze przeliczają się z licznikiem.
- Kamera 3D przelatuje między widokami z krzywą ease-in-out. Obracanie makiety ma bezwładność.
- Zmiana pory dnia płynnie przechodzi światło i niebo.
- Przy ustawieniu „ogranicz ruch” animacje są skrócone, makieta się nie obraca, a przeloty są natychmiastowe.
