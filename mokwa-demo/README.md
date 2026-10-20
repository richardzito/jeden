# A.Mokwa Pokrycia Dachowe — demo strony

Pokazowa wersja strony dla firmy dekarskiej A.Mokwa (Warszawa). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Dwuklik w `index.html` działa (3D ładuje się z CDN, potrzebny internet).
- Albo lokalny serwer: `npx serve .` lub `python3 -m http.server` w tym folderze.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero, realizacje, zajawka konfiguratora 3D, usługi + proces, opinie, FAQ, CTA, stopka |
| `realizacje.html`, `uslugi.html`, `konfigurator.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („realizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | Tokeny (biel + brąz `#7b4b2a`), typografia, layout, animacje |
| `assets/js/main.js` | Pojawianie się sekcji, header, menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/roof3d.js` | Scena Three.js sterowana scrollem (sekcja 3) |
| `assets/img/` | Zdjęcia firmy z wizytówki Google (+ kadry z nich) |

## Co jest prawdziwe, a co wymyślone

Prawdziwe (z wizytówki Google Maps):

- nazwa, telefon **601 610 652**, ocena **4,7**,
- 4 zdjęcia (dom z grafitową dachówką, dach czterospadowy, kosz miedziany, ekspozycja dachówek Erlus),
- 2 opinie: Katarzyna S. i Karol D. (skrócone; nazwiska do inicjałów).

Wymyślone na potrzeby demo — **do potwierdzenia z klientem przed publikacją**:

- „20+ lat”, „48 h na ofertę”, „gwarancja do 10 lat”, godziny pracy, obszar działania, ceny w FAQ i w konfiguratorze,
- opinie Marka W. i Agnieszki P.,
- logo (w jego miejscu: „TWOJE LOGO”).

Uwaga: w opinii Google klient pisze, że firma nie działa już pod adresem z wizytówki (Stawy 5). Dlatego na stronie nie podano adresu.

## Efekt WOW: Konfigurator Dachu 3D

Na stronie głównej jest zajawka. Pełny konfigurator to następny etap (`konfigurator.html`).

Zajawka (sekcja 3) to model domu 3D, który zmienia się podczas przewijania:

1. **Pomiar:** przerywany obrys i skaner, chip „125 m² · kąt 39°”.
2. **Kształt:** dach dwuspadowy płynnie przechodzi w czterospadowy. Przełącznik działa też po kliknięciu.
3. **Pokrycie:** nowy materiał „przykrywa” dach od lewej do prawej (grafit → blacha brąz → ceglasta).
4. **Cena:** widełki liczone z powierzchni modelu, czas montażu i CTA.

Model można obracać przeciągnięciem. Myszka daje lekki parallax.

Pomysł na pełny konfigurator: adres → obrys dachu z mapy satelitarnej → model 3D domu klienta → kształt, pokrycie, kolor, rynny, okna dachowe → widełki ceny → „Wyślij projekt i zadzwoń”. Klient dzwoni z gotowym projektem, a firma dostaje ciepły lead z wymiarami.

## Animacje — gdzie są i dlaczego

| Miejsce | Ruch | Cel |
| --- | --- | --- |
| Hero (pierwsze wejście) | Linie nagłówka wysuwają się z maski, zdjęcie odsłania się `clip-path` | Rzadkie, pierwsze wrażenie |
| Hero (scroll) | Zdjęcie lekko się przybliża | Głębia, tylko dekoracja |
| Realizacje | Odsłanianie zdjęć `clip-path` + przeskalowanie, 90 ms opóźnienia między kartami | Zapobiega „wyskakiwaniu” siatki |
| Sekcje | Tekst wjeżdża: przesunięcie + blur → ostrość, 70 ms między elementami | Rytm przy przewijaniu |
| Sekcja 3D | Scena sterowana scrollem, wymiana materiału, licznik ceny | Wyjaśnienie, jak działa konfigurator |
| Proces | Linia „rysuje się”, kroki zapalają się po kolei | Pokazuje kolejność kroków |
| FAQ | Wysokość + opacity, ikona + zmienia się w − | Zmiana stanu |
| Przyciski | `scale(0.97)` po wciśnięciu | Informacja zwrotna |
| WhatsApp | Dymek rośnie od przycisku, raz na sesję, sam znika | Zachęta bez nachalności |
| Kopiuj numer | Ikona kopiuj → ✓ z blurem + toast | Potwierdzenie akcji |

Świadomie **bez** animacji: linki w nawigacji (używane często), karuzela opinii przewijana automatycznie (ruchomego tekstu nie da się wygodnie czytać), parallax tła w każdej sekcji, kursor-follower.

Wszystkie animacje respektują `prefers-reduced-motion`: zostają łagodne przejścia opacity, a ruch i przesunięcia są wyłączone. Efekty hover działają tylko na urządzeniach z myszką.
