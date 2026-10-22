# Tiger Tools — demo sklepu (PrestaShop, szablon Gardenia)

Wersja poglądowa sklepu Tiger Tools, czyli polskiej marki narzędzi dekarskich i blacharskich. Pokazuje klientowi, jak będzie wyglądał i działał sklep po wdrożeniu 16 punktów z zakresu prac. To nie jest pełny sklep. Strona główna, karta produktu i koszyk działają jako makieta z prawdziwymi interakcjami. Pozostałe podstrony mają komunikat, że zostaną zrobione przy rozpoczęciu współpracy.

Statyczny HTML/CSS/JS, bez kroku budowania i bez zewnętrznych bibliotek.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- Internet jest potrzebny tylko do fontu (Inter Tight z Google Fonts). Bez niego strona użyje fontu systemowego.
- Wersja jednoplikowa (`tigertools-strona-glowna.html`) to sama strona główna z wbudowanymi stylami, skryptem i grafikami. Wygodnie wysłać ją mailem.

## Jak prezentować klientowi

W prawym dolnym rogu jest przycisk **„Funkcje wdrożenia 16”**. Po kliknięciu:

1. wysuwa się lista 16 punktów zakresu z linkami „Zobacz” do miejsc, gdzie dany punkt widać,
2. na stronie pojawiają się pomarańczowe numerki przy elementach, które realizują dany punkt (np. „5” przy przełączniku ceny firmowej, „9” przy najniższej cenie z 30 dni).

Tryb pamięta się w obrębie karty przeglądarki, więc numerki zostają przy przechodzeniu między stronami. Ponowne kliknięcie albo Esc wyłącza tryb.

Proponowana ścieżka (ok. 3 minuty):

1. **Strona główna:** hero, kategorie, przełącznik „Cena detaliczna / Firmowa −20%” (ceny przeliczają się z animacją), „Dodaj do koszyka” (produkt leci do koszyka).
2. **Konto firmowe:** sekcja „Im więcej kupujesz, tym wyższy poziom.” pokazuje kolejne poziomy rabatów B2B.
3. **Karta produktu** (`produkt.html?v=61`): warianty 31/46/61 cm, indeks WAPRO i stan magazynowy, najniższa cena z 30 dni przy promocji, „Pobierz kartę PDF”, „Zostaw numer — oddzwonimy” z podglądem zgłoszenia w panelu (status „Nowe”).
4. **Koszyk** (`koszyk.html`): dane, dostawa InPost i płatność na jednym ekranie, rabat −20% i darmowa dostawa od 299 zł, checkbox newslettera, „Pobierz koszyk PDF”.
5. **Cookies:** baner z przełącznikami zgód (Consent Mode v2). Można go wywołać ponownie linkiem „Ustawienia cookies” w stopce.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: pasek informacyjny, nagłówek z wyszukiwarką, hero, zalety, kategorie, bestsellery z przełącznikiem cen B2B, poziomy rabatów, marka, newsletter, stopka |
| `produkt.html` | Karta produktu (zaginadło do rąbka, warianty 31/46/61 cm) |
| `koszyk.html` | One page checkout |
| `kategoria.html`, `dla-firm.html`, `konto.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/shop.css` | Cały wygląd. Kolory: pomarańcz `#ff8a00` (hover `#f07800`), czerń `#161616`, dużo bieli |
| `assets/js/shop.js` | Interakcje: tryb B2B, koszyk, warianty, PDF (druk), modal „oddzwonimy”, checkout, newsletter, cookies, tryb prezentacji |
| `assets/img/products/*.svg` | Ilustracje produktów (zastępcze, patrz niżej) |
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

Strony dekarski-sklep.pl, Allegro i katalogu dodatków PrestaShop blokują pobieranie (Cloudflare), więc dane pochodzą z wyników wyszukiwania:

- produkty Tiger Tools: zaginadła do rąbka 46 cm (BDZ 20/40/460, 220 zł) i 61 cm (BDZ 20/40/610, 285 zł), wersja 31 cm (Allegro), przymiar dekarski GB-500TT do łat (239 zł), zestawy „blacha na rąbek” I, II, III i „Tygrys”,
- ceny zestawów: 1799 zł (zestaw I) i 2619 zł („Tygrys”) z ofert w sieci,
- kontakt sprzedawcy z dekarski-sklep.pl: tel. 690 566 720, biuro@dekarski-sklep.pl, ul. Długa 17C, 05-090 Podolszyn Nowy.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- logo: „TWOJE LOGO” (logo marki nie było dostępne do pobrania),
- zdjęcia: produkty to ilustracje SVG w kolorach marki. Po imporcie CSV zastąpią je zdjęcia ze sklepu klienta,
- cena 31 cm (189 zł), cena promocyjna 61 cm (259 zł zamiast 285 zł, najniższa z 30 dni 279 zł), ceny zestawów II i III, wszystkie stany magazynowe, indeksy `ZN-RAB-*`, liczby produktów w kategoriach, specyfikacje techniczne,
- poziomy rabatów B2B powyżej −20% (−25% i −30%) i progi obrotu,
- ceny dostaw (Paczkomat 12,99 zł, kurier 16,99 zł) i próg darmowej dostawy 299 zł,
- przykładowy Paczkomat, numer zgłoszenia „oddzwonimy” (#1025).

## Animacje

Te same zasady co w poprzednich demach: krótkie, celowe, z szybkim wejściem.

- sekcje pojawiają się przy przewijaniu (przesunięcie + przezroczystość, ok. 600 ms, `cubic-bezier(0.23, 1, 0.32, 1)`), z lekkim opóźnieniem między kafelkami,
- hero: tygrysie pasy przesuwają się z przewijaniem (paralaksa), produkty wjeżdżają po kolei,
- przełącznik B2B: tło przesuwa się pod aktywną opcją, ceny przeliczają się z licznikiem,
- „Dodaj do koszyka”: kropka leci do ikony koszyka, licznik w nagłówku podskakuje, przycisk na chwilę zmienia się w ✓,
- karta produktu: zdjęcie wariantu podmienia się z rozmyciem, przyciski reagują na wciśnięcie (`scale(0.97)`),
- szuflada „Funkcje wdrożenia”, modal i toast: wysuwanie z krzywą `cubic-bezier(0.32, 0.72, 0, 1)`,
- przy ustawieniu „ogranicz ruch” w systemie animacje ruchu są wyłączone, a treść pojawia się od razu.
