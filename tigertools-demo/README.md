# Tiger Tools — demo sklepu (PrestaShop, szablon Gardenia)

Wersja poglądowa sklepu Tiger Tools, czyli polskiej marki narzędzi dekarskich i blacharskich. Pokazuje klientowi, jak będzie wyglądał i działał sklep po wdrożeniu 16 punktów z zakresu prac. To nie jest pełny sklep. Strona główna, karta produktu i koszyk działają jako makieta z prawdziwymi interakcjami. Pozostałe podstrony mają komunikat, że zostaną zrobione przy rozpoczęciu współpracy.

Statyczny HTML/CSS/JS, bez kroku budowania. Jedyna biblioteka to Three.js do modeli 3D, ładowana z CDN.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- Internet jest potrzebny do fontu (Inter Tight z Google Fonts) i do 3D (Three.js z CDN). Bez niego strona działa dalej: zamiast modeli 3D widać zdjęcia, a przełączniki, ceny i zestaw działają normalnie.
- Wersja jednoplikowa (`tigertools-strona-glowna.html`) to sama strona główna z wbudowanymi stylami, skryptem i grafikami. Wygodnie wysłać ją mailem.

## Co nowego w wersji WOW

Strona nie jest już „zwykłym sklepem”. Trzy rzeczy robią wrażenie i od razu sprzedają:

1. **Zaginadło Tiger Tools w 3D (hero).** Model narzędzia zrobiony według zdjęcia produktu: podwójna szczęka ze szczeliną, rura z napisem TIGER TOOLS, czerwony lakier proszkowy. Można je obracać palcem lub myszką. Przełącznik 31 / 46 / 61 cm płynnie wydłuża ostrze, a cena i przycisk „Do koszyka” zmieniają się razem z nim. „Zobacz w akcji” pokazuje zaginanie: krawędź blachy wchodzi w szczelinę, narzędzie podnosi ją do 90°, a kamera odjeżdża w bok, żeby było widać profil gięcia.
2. **Dach w 3D — „Kup narzędzia prosto z dachu”.** Dom z dachem z blachy na rąbek z sześcioma punktami: rąbek, okap, komin, łaty (odsłonięte w wycięciu), kalenica i stół do trasowania. Kliknięcie przenosi kamerę w to miejsce i podświetla je. Obok pojawiają się narzędzia do tej roboty, z prawdziwymi zdjęciami ze sklepu. Z wybranych narzędzi powstaje zestaw: od 3 sztuk −10%, a jednym kliknięciem trafia on do koszyka. Ceny uwzględniają tryb firmowy −20%.
3. **Prawdziwa marka i prawdziwe zdjęcia.**
   - Logo Tiger Tools (tarcza z tygrysem) zamiast „TWOJE LOGO”.
   - Kolor akcentu jak lakier narzędzi: czerwono-pomarańczowy `#d93a14`.
   - Zdjęcia produktów z oferty sklepu w kategoriach, bestsellerach, kaflach i w „Dachu w 3D”.
   - Pasek marek, które sklep sprzedaje.

Na karcie produktu galeria ma przełącznik „Zdjęcie / 3D / W akcji”. To ten sam model, w wybranym wariancie długości.

Obie funkcje 3D są w szufladzie „Funkcje wdrożenia” jako **propozycje ponad zakres 16 punktów** (wycena osobno).

## Jak prezentować klientowi

W prawym dolnym rogu jest przycisk **„Funkcje wdrożenia 16”**. Po kliknięciu:

1. wysuwa się lista 16 punktów zakresu z linkami „Zobacz” do miejsc, gdzie dany punkt widać, a pod nią dwie propozycje 3D,
2. na stronie pojawiają się numerki przy elementach, które realizują dany punkt (np. „5” przy przełączniku ceny firmowej, „9” przy najniższej cenie z 30 dni).

Tryb pamięta się w obrębie karty przeglądarki, więc numerki zostają przy przechodzeniu między stronami. Ponowne kliknięcie albo Esc wyłącza tryb.

Proponowana ścieżka (ok. 4 minuty):

1. **Hero 3D:** obróć zaginadło, przełącz 31 → 61 cm, kliknij „Zobacz w akcji”, potem „Do koszyka” (produkt leci do koszyka).
2. **Dach w 3D:** kliknij „1 Rąbek”, dodaj dwa narzędzia, przejdź do „3 Komin” i dodaj trzecie. Rabat −10% nalicza się sam. „Zestaw do koszyka”.
3. **Bestsellery:** przełącznik „Cena detaliczna / Firmowa −20%”. Ceny przeliczają się z animacją, także w zestawie z dachu.
4. **Karta produktu** (`produkt.html?v=61`): warianty 31/46/61 cm, zakładka **3D** i „W akcji”, indeks WAPRO i stan magazynowy, najniższa cena z 30 dni, „Pobierz kartę PDF”, „Zostaw numer — oddzwonimy” z podglądem zgłoszenia w panelu.
5. **Koszyk** (`koszyk.html`): dane, dostawa InPost i płatność na jednym ekranie, rabat −20% i darmowa dostawa od 299 zł, checkbox newslettera, „Pobierz koszyk PDF”.
6. **Cookies:** baner z przełącznikami zgód (Consent Mode v2). Można go wywołać ponownie linkiem „Ustawienia cookies” w stopce.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: pasek informacyjny, nagłówek z logo i wyszukiwarką, hero z zaginadłem 3D, kafle, zalety, kategorie ze zdjęciami, bestsellery z przełącznikiem cen B2B, pasek marek, „Dach w 3D” z zestawem, poziomy rabatów, marka, newsletter, stopka |
| `produkt.html` | Karta produktu (zaginadło do rąbka, warianty 31/46/61 cm, galeria ze zdjęciem i modelem 3D) |
| `koszyk.html` | One page checkout |
| `kategoria.html`, `dla-firm.html`, `konto.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/shop.css` | Cały wygląd. Kolory marki: czerwono-pomarańczowy `#d93a14` jak lakier narzędzi (hover `#bf3010`, na ciemnym tle `#ff5a2c`), czerń `#161616`, dużo bieli |
| `assets/js/shop.js` | Interakcje: tryb B2B, koszyk (też API `window.TT` dla 3D), warianty, PDF (druk), modal „oddzwonimy”, checkout, newsletter, cookies, tryb prezentacji |
| `assets/js/tool3d.js` | Zaginadło w 3D: model, warianty długości, obrót, pokaz zaginania (hero i karta produktu) |
| `assets/js/roof3d.js` | „Dach w 3D”: dom z dachem na rąbek, punkty, przejazdy kamery, panel narzędzi i zestaw |
| `assets/img/logo-tigertools.png` | Logo marki wycięte ze zdjęcia produktu |
| `assets/img/products/*.webp` | Zdjęcia zaginadeł 31/46/61 cm wyrenderowane z modelu 3D i kolaż „Zestaw Tygrys” |
| `assets/img/shop/*.webp` | Zdjęcia produktów z oferty sklepu |
| `assets/img/stripes.svg` | Tygrysie pasy w tle hero |

Stan demo (koszyk, tryb B2B, zgody cookies) zapisuje się w `localStorage` przeglądarki. Żeby zacząć od zera, wyczyść dane strony.

## 16 punktów zakresu → gdzie je widać

| # | Punkt | Gdzie w demo |
| --- | --- | --- |
| 1 | Szablon Gardenia + dostosowanie graficzne (7 h) | Cały wygląd; numerek przy hero |
| 2 | One page checkout | `koszyk.html`; ikona koszyka w nagłówku |
| 3 | Import produktów i kategorii z CSV | Kafelki kategorii, siatka produktów, indeksy w karcie |
| 4 | Konfiguracja sklepu | Pasek informacyjny (darmowa dostawa od 299 zł, wysyłka 24 h) |
| 5 | Grupa klientów B2B (−20%, potem kolejne poziomy) | Przełącznik cen, „Konto firmowe” w nagłówku, sekcja poziomów rabatów, rabat w koszyku |
| 6 | Integracja WAPRO (ceny, promocje, stany po indeksie + 2 raporty) | Indeks i stan na karcie produktu i kartach produktów |
| 7 | PDF produktu i koszyka | „Pobierz kartę PDF” / „Pobierz koszyk PDF” (w demo: druk przeglądarki z osobnym układem do PDF) |
| 8 | „Zostaw telefon, oddzwonimy” → BackOffice ze statusami i notatkami | Przycisk w nagłówku i na karcie produktu; po wysłaniu podgląd zgłoszenia w panelu |
| 9 | Moduł x13: najniższa cena z 30 dni | Przy produktach w promocji (karty i karta produktu 61 cm) |
| 10 | Newsletter: pasek + checkbox w zamówieniu | Sekcja na stronie głównej, checkbox w koszyku |
| 11 | seigi cookie, Consent Mode v2 | Baner cookies z przełącznikami zgód |
| 12 | Przelewy24 + PayPal | Płatność w koszyku, logotypy w stopce |
| 13 | InPost | Paczkomat i kurier w koszyku, informacja o dostawie na karcie produktu |
| 14 | Instalacja na serwerze (cyber_Folks, 30 GB) | Tylko na liście w trybie prezentacji |
| 15 | Wersja developerska | Tylko na liście w trybie prezentacji |
| 16 | Szkolenie i wsparcie | Tylko na liście w trybie prezentacji |

## Skąd są dane

Strona dekarski-sklep.pl blokuje automatyczne pobieranie (Cloudflare, błąd 403, także przez archiwum). Dlatego dane i zdjęcia pochodzą z innych źródeł:

- **Zdjęcia produktów:** z oferty tego samego sprzedawcy na Empiku (sklep „Dekarski-Sklep”, 135 produktów). To te same zdjęcia, które sklep wystawia u siebie. Pobrałem pierwszą stronę oferty (31 zdjęć) w pełnej rozdzielczości z serwera zdjęć Empiku. Są wśród nich dwa produkty Tiger Tools: zaginadło do obróbki komina i przymiar GB-500TT. Pozostałe zdjęcia to marki, które sklep sprzedaje: Stubai, Sorex Technic, Rau, Haidl, Jouanel, Tjep, Yato, Freund, Rawlplug, Grün.
- **Logo Tiger Tools:** wycięte ze zdjęcia zaginadła do obróbki komina (tarcza w rogu zdjęcia). Przed wdrożeniem warto dostać od klienta plik w lepszej jakości.
- **Model 3D zaginadła:** wykonany według zdjęcia zaginadła Tiger Tools (płaska podwójna szczęka, rura z napisem, czerwony lakier). Zdjęcia zaginadeł 31/46/61 cm na stronie to rendery z tego modelu.
- **Produkty i ceny Tiger Tools z wyników wyszukiwania:**
  - zaginadła do rąbka 46 cm (BDZ 20/40/460, 220 zł) i 61 cm (BDZ 20/40/610, 285 zł), wersja 31 cm (Allegro),
  - przymiar dekarski GB-500TT (239 zł),
  - zaginadło do obróbki komina (86,90 zł na Empiku; szerokość robocza 250 mm, blacha 2 mm),
  - zestawy „blacha na rąbek” i „Tygrys” (1799 zł i 2619 zł).
- **Kontakt sprzedawcy z dekarski-sklep.pl:** tel. 690 566 720, biuro@dekarski-sklep.pl, ul. Długa 17C, 05-090 Podolszyn Nowy.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- czy zaginadła do rąbka BDZ wyglądają jak zaginadło do obróbki komina (model 3D zakłada ten sam kształt, tylko dłuższą szczękę),
- ceny produktów innych marek (Rau, Stubai, Sorex, Yato, Jouanel), cena 31 cm (189 zł), promocje −9% i −8% oraz najniższe ceny z 30 dni, wszystkie stany magazynowe i indeksy, liczby produktów w kategoriach,
- rabat −10% na zestaw z „Dachu w 3D” od 3 narzędzi,
- poziomy rabatów B2B powyżej −20% (−25% i −30%) i progi obrotu,
- ceny dostaw (Paczkomat 12,99 zł, kurier 16,99 zł) i próg darmowej dostawy 299 zł,
- przykładowy Paczkomat, numer zgłoszenia „oddzwonimy” (#1025),
- kolaż „Zestaw Tygrys” (złożony z prawdziwych zdjęć, ale nie wiemy, co dokładnie jest w zestawie).

## Animacje

Te same zasady co w poprzednich demach: krótkie, celowe, z szybkim wejściem.

- sekcje pojawiają się przy przewijaniu (przesunięcie + przezroczystość, ok. 600 ms, `cubic-bezier(0.23, 1, 0.32, 1)`), z lekkim opóźnieniem między kafelkami,
- hero: tygrysie pasy przesuwają się z przewijaniem (paralaksa), produkty wjeżdżają po kolei,
- przełącznik B2B: tło przesuwa się pod aktywną opcją, ceny przeliczają się z licznikiem,
- „Dodaj do koszyka”: kropka leci do ikony koszyka, licznik w nagłówku podskakuje, przycisk na chwilę zmienia się w ✓,
- karta produktu: zdjęcie wariantu podmienia się z rozmyciem, przyciski reagują na wciśnięcie (`scale(0.97)`),
- zaginadło 3D: wejście z dołu, delikatne „pływanie”, obrót z bezwładnością, sprężynowa zmiana długości ostrza, pokaz zaginania z podpisami kroków,
- Dach w 3D: kamera krąży, dopóki ktoś nie dotknie sceny; przejazd do wybranego miejsca z pulsującym podświetleniem; pulsujące punkty; narzędzia w panelu wjeżdżają po kolei; ikona zestawu podskakuje przy dodaniu,
- pasek marek przesuwa się powoli i zatrzymuje po najechaniu,
- szuflada „Funkcje wdrożenia”, modal i toast: wysuwanie z krzywą `cubic-bezier(0.32, 0.72, 0, 1)`,
- przy ustawieniu „ogranicz ruch” w systemie animacje ruchu są wyłączone, a treść pojawia się od razu: modele stoją nieruchomo, a „W akcji” od razu pokazuje zagiętą blachę.
