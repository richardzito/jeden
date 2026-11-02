# AQUATIC — Konfigurator basenu (demo podstrony)

Nowa podstrona dla aquatic.pl z rozbudowanym konfiguratorem basenu 3D. Reszta strony zostaje bez zmian: nagłówek, menu, baner tytułowy i stopka pochodzą z lokalnej kopii ich strony Kontakt. Wymieniona jest tylko treść pod banerem. Konfigurator nie podaje cen, kończy się wysłaniem projektu do biura.

## Jak otworzyć

- Rozpakuj ZIP i kliknij dwa razy `konfigurator-basenu.html`.
- 3D ładuje się z CDN (three.js), więc potrzebny jest internet. Bez niego wszystkie opcje i podsumowanie działają, a zamiast 3D jest komunikat.

## Co jest w środku

| Plik | Co to jest |
| --- | --- |
| `konfigurator-basenu.html` | Podstrona: kopia strony Kontakt z aquatic.pl, tytuł „Konfigurator basenu”, w miejscu mapy i formularza konfigurator |
| `assets/konfigurator/konfigurator-blok.html` | Sam blok konfiguratora do wklejenia na stronę w WordPressie (blok HTML) |
| `assets/konfigurator/konfigurator.css` | Style konfiguratora, zamknięte w `#aqk` (nie ruszają stylów motywu) |
| `assets/konfigurator/app.js` | Logika, obliczenia i scena 3D (three.js 0.160 z CDN, ładowany dynamicznie) |
| `assets/konfigurator/img/` | Baner i tło stopki z ich strony (lokalnie, żeby demo działało offline) |
| `wp-content/`, `wp-includes/`, `s/`, `css@family…` | Lokalna kopia plików motywu TheGem i czcionek, potrzebna tylko do pokazu offline (jest w ZIP-ie, nie w repozytorium — to pliki z ich serwera) |

## Funkcje konfiguratora

Sześć kroków, model 3D zmienia się na bieżąco:

1. **Basen:**
   - 4 gotowe inspiracje: ogród rodzinny, nowoczesny infinity, kryty z sauną, pod zadaszeniem.
   - Lokalizacja: ogród albo hala.
   - Konstrukcja z ich oferty: żelbet CAPENA, stal BERNDORF, poliester. Każda ma swoje ograniczenia kształtu i wymiaru.
   - 5 kształtów: prostokątny, zaokrąglony, owalny, L, nieregularny.
   - Długość, szerokość, głębokość, dno ze spadkiem.
2. **Wykończenie:**
   - Niecka: mozaika szklana, płytki, folia, stal, żelkot, każda w swoich kolorach. Kolor niecki zmienia kolor wody.
   - System skimmerowy, przelewowy (kratka rynny) albo infinity (przelew do niecki przelewowej).
   - Obrzeże w 5 materiałach.
3. **Atrakcje:**
   - Schody rzymskie, narożne, na całą szerokość albo drabinka.
   - Ławka, płytka plaża.
   - Przeciwprąd, kaskada, łuki wodne, dysze masażu, gejzer.
   - LED: biały, błękitny albo RGB, z liczbą lamp.
   - Roleta lub pokrywa termiczna z suwakiem zasłonięcia.
   - Zadaszenie teleskopowe niskie lub wysokie, z suwakiem otwarcia.
4. **Otoczenie:**
   - Ogród: taras w 4 materiałach i z regulowaną szerokością, żywopłot, drzewa, trawy, leżaki, parasol, pergola, palenisko, prysznic, wanna SPA, sauna ogrodowa, szklane ogrodzenie, oświetlenie.
   - Hala: przeszklenie albo okna, posadzka, okładzina, sauna, łaźnia parowa, wanna SPA, rośliny.
5. **Uzdatnianie wody** (ich specjalność):
   - Wybór: filtracja (piasek, złoże szklane, wkłady), pompa (zmiennoobrotowa lub stałoobrotowa), dezynfekcja (elektroliza membranowa, elektroliza soli, chlor dozowany, aktywny tlen), UV, ozon, pH, Redox, aplikacja, podgrzewanie z temperaturą, wentylacja hali.
   - **Maszynownia w przekroju 3D:** urządzenia pojawiają się zgodnie z wyborem, a woda płynie rurami. Przed filtrem jest mętna, za filtrem czysta, w lampie UV świeci na fioletowo.
   - Profil wody: 5 ocen porównawczych.
   - Parametry: pojemność, lustro wody, wydajność obiegu, czas wymiany wody, wstępny dobór filtra.
   - Przełącznik „pokaż wodę bez uzdatniania” zmienia wodę w modelu na mętną.
6. **Projekt:**
   - Podsumowanie wszystkich wyborów.
   - Obraz PNG wizualizacji, link do projektu (cały stan w adresie), druk / PDF.
   - Formularz „Wyślij projekt”: otwiera e-mail do biuro@aquatic.pl z podsumowaniem i linkiem. Jest też przycisk telefonu.

Na scenie:
- widoki 3D / z góry / z tarasu / maszynownia,
- pora dnia: dzień, zachód, noc z podświetleniem,
- pobranie obrazu, pełny ekran,
- obracanie i przybliżanie myszą lub palcami.

Projekt zapisuje się też w przeglądarce, więc po powrocie na stronę wraca ostatni stan.

## Wdrożenie na aquatic.pl (WordPress)

1. Wgrać folder `assets/konfigurator/` na serwer (np. do motywu potomnego albo `wp-content/uploads/konfigurator/`).
2. Utworzyć stronę „Konfigurator basenu” w tym samym szablonie co pozostałe podstrony.
3. W treści strony wkleić zawartość `konfigurator-blok.html` (blok HTML).
4. Na tej stronie dołączyć `konfigurator.css`, import map z three.js i `app.js` (np. przez prosty fragment w `functions.php` albo wtyczkę do wstawiania kodu).
5. Opcjonalnie dodać pozycję „Konfigurator” w menu.

Na tej podstronie konfigurator nadpisuje dwie drobne rzeczy motywu:
- `#page { overflow: hidden }` zmienia na `overflow-x: clip`. Bez tego nie działa przyklejanie sceny na telefonie.
- Ukrywa przycisk „do góry”, gdy konfigurator jest na ekranie, bo zasłaniałby przycisk „Dalej”.

## Dane i źródła

- Z aquatic.pl:
  - nazwa i dane kontaktowe (biuro@aquatic.pl, (+48) 505 988 656, ul. Holzera 4/109, Warszawa),
  - oferta: baseny poliestrowe, żelbetowe CAPENA, stalowe BERNDORF; zadaszenia teleskopowe; wentylacja hal; elektroliza soli i membranowa; lampy UV,
  - marki: Astral Pool, OSPA, ProMinent, Hugo Lahme, Speck, Hayward,
  - wygląd strony (kopia strony Kontakt).
- Opisy marek przy urządzeniach są oznaczone „np.”, bo nie znamy konkretnych modeli w ofercie.
- **Poglądowe, do potwierdzenia z firmą:**
  - ograniczenia wymiarów dla niecek poliestrowych (do 10 × 4,5 m, 1,6 m głębokości) i stalowych (kształty),
  - czasy wymiany wody (6 h i 4 h) i prędkość filtracji (40 m/h) użyte do wstępnego doboru filtra,
  - oceny w „Profilu wody”. Porównują warianty między sobą, to nie są pomiary.
- W stopce strony na telefonie motyw pokazuje inny adres (Al. Rzeczypospolitej 8/111) niż na komputerze (ul. Holzera 4/109). To zostało bez zmian, ale warto poprawić na ich stronie.
