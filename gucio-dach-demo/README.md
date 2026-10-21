# Guciodach — demo strony

Pokazowa wersja strony dla firmy dekarskiej Guciodach (Warszawa-Wesoła). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero, realizacje, zajawka „Zobacz, jak powstaje Twój dach”, usługi + proces, opinie, FAQ, CTA, stopka |
| `realizacje.html`, `uslugi.html`, `konfigurator-3d.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („realizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z demo A.Mokwa (biel + brąz `#7b4b2a`) + dodatki dla Guciodach |
| `assets/js/main.js` | Pojawianie się sekcji, header, menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/roofbuild3d.js` | Scena Three.js sterowana scrollem (sekcja 3) |
| `assets/img/` | Zdjęcia z wizytówki Google i kadry z nich |

## Skąd są dane

Firma nie ma strony internetowej ani logo, a w wyszukiwarce nic o niej nie ma. W miejscu logo jest więc „TWOJE LOGO”.

Z wizytówki Google:

- nazwa Guciodach, kategoria „Dekarz”,
- telefon 500 634 188 (ten sam numer jest na busie firmy),
- adres ul. Krokusów 52, 05-077 Warszawa,
- 4 zdjęcia: ekipa przy montażu dachówki, gotowy dach grafitowy z kominem, bus „DACHY”, brązowa blachodachówka z obłożonym kominem (przekrzywione o 14°, wyprostowane).

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- wszystkie 4 opinie (firma nie ma opinii w Google),
- „własna ekipa”, „gwarancja”, „bezpłatny pomiar i wycena”, obszar działania,
- ceny w FAQ i w konfiguratorze (290 / 190 / 300 zł/m²), czas montażu, długość wymiany dachu.

Do zebrania od klienta: logo i 10–20 zdjęć realizacji. Teraz są tylko 4, więc z dwóch zrobiłem dodatkowe kadry.

## Efekt WOW: „Zobacz, jak powstaje Twój dach”

Na stronie głównej jest zajawka. Pełny konfigurator to następny etap (`konfigurator-3d.html`).

Zajawka (sekcja 3) to dom w 3D, na którym podczas przewijania powstaje dach:

1. **Więźba:** krokwie rosną jedna po drugiej od okapu do kalenicy. Licznik krokwi na karcie.
2. **Membrana i łaty:** membrana rozwija się od okapu, wchodzą kontrłaty, a łaty pojawiają się rzędami. Licznik rzędów.
3. **Pokrycie:** dachówka odsłania się rząd po rzędzie od okapu, na końcu gąsiory. Licznik „% dachu”.
4. **Kolor i cena:** nowe pokrycie przykrywa dach od lewej (dachówka grafit → blachodachówka brąz → dachówka ceglasta). Można też klikać próbki. Widełki ceny liczone są z powierzchni modelu.

Model można obracać przeciągnięciem.

Dlaczego to działa: klient widzi, że dach to kilka warstw pracy, a nie tylko dachówka. Rozumie, za co płaci, i dzwoni z wybranym kolorem.

Pomysł na pełny konfigurator: wymiary i kształt dachu → budowa warstwa po warstwie → pokrycie, kolor, obróbki komina, rynny → widełki ceny → „Wyślij projekt i zadzwoń”.

## Animacje

Te same zasady co w poprzednich demach:

- wejście hero, odsłanianie zdjęć, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru,
- budowa dachu w 3D z licznikami postępu.

Wszystko respektuje `prefers-reduced-motion`.
