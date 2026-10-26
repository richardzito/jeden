# Perfect-Dach — demo strony

Pokazowa wersja strony dla Perfect-Dach, dekarza z Warszawy (naprawy dachów, papa termozgrzewalna, obróbki kominów, rynny, renowacje i przeglądy). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet. Bez niego w sekcji 3 widać zdjęcie, a kroki i liczniki działają dalej.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero, realizacje, zajawka „Twój dach za 5 lat”, usługi i proces, opinie, FAQ, mocne CTA, stopka |
| `realizacje.html`, `uslugi.html`, `dach-za-5-lat.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw Perfect-Dach: niebieski `#2872fa` (hover `#1559ed`) i granat `#192a3d` z obecnej strony |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek (ciemnieje nad stopką), menu, FAQ, licznik opinii, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/roof5y3d.js` | Scena Three.js sterowana przewijaniem (sekcja 3) |
| `assets/img/` | Logo (dorobiona biała wersja do stopki) i zdjęcia z perfectdach.waw.pl |

## Skąd są dane

Z perfectdach.waw.pl:

- logo i kolory (niebieski i granat z motywu strony),
- telefon 516 903 308, e-mail perfectdach.waw@gmail.com, godziny: pon–sob 7–22, niedziela 8–16,
- obszar: Warszawa i okolice; klienci indywidualni, firmy i wspólnoty mieszkaniowe,
- usługi: naprawy dachów płaskich i skośnych (papa, blachodachówka, dachówka, gont), papa termozgrzewalna („nawet kilkanaście lat”), obróbki kominów, świetlików i wyłazów, rynny (montaż, czyszczenie, naprawa), renowacje i serwis, przeglądy dachów („zapobiec kosztownym awariom”),
- 130 opinii w Google z oceną „doskonała” (widżet Trustindex na ich stronie) i jedna opinia z treścią: „Dobra robota. Polecam” (Damian M.),
- wszystkie zdjęcia. Trzy pionowe kadry w realizacjach (komin z obudową, nasady wentylacyjne, praca na dachu z blachy) wyglądają na zdjęcia z ich zleceń. Pozostałe (dekarz przy kominie, dekarz z gwoździarką, papa, dach z drona) mogą być zdjęciami stockowymi — do sprawdzenia z klientem.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- trzy z czterech opinii (Katarzyna W., Paweł R., Anna Z.) — do podmiany na prawdziwe opinie z wizytówki Google,
- podpisy realizacji (nie znamy adresów ani zakresu tych prac),
- WhatsApp na numer 516 903 308 (nie wiemy, czy firma go używa),
- kwoty w symulacji: koszt naprawy rosnący od 600 zł do 14 800 zł w ciągu 5 lat i przegląd „od 350 zł / rok”. Na stronie jest dopisek „Kwoty poglądowe”.

## Efekt WOW: „Twój dach za 5 lat” — symulacja 3D

Perfect-Dach robi głównie naprawy i przeglądy. Klient dzwoni zwykle dopiero, gdy już cieknie. Efekt WOW pokazuje więc, co się dzieje z dachem, kiedy drobna usterka czeka latami, i ile to kosztuje. Na stronie głównej jest zajawka. Pełna symulacja to następny etap (`dach-za-5-lat.html`).

Zajawka (sekcja 3) to dom jednorodzinny z dachem z blachodachówki. Przewijanie przesuwa czas, a licznik pokazuje rok i koszt naprawy:

1. **Dziś, drobna usterka:** pęknięta obróbka komina (pulsuje na czerwono) i kilka liści w rynnie. Naprawa: 600 zł.
2. **Za 2 lata, rynna się przelewa:** zaczyna padać, liście zapychają rynnę, woda leje się po elewacji i zostawia zaciek, na pokryciu rośnie mech skupiskami. Etykiety wskazują usterki.
3. **Za 5 lat, przeciek:** kamera zjeżdża do prawego szczytu, ściana staje się przezierna i widać pokój na piętrze: mokry komin, plama na suficie, krople do wiadra, kałuża. Licznik dochodzi do 14 800 zł i robi się czerwony.
4. **Albo przegląd raz w roku:** niebieska płaszczyzna skanu przesuwa się od ziemi po kalenicę. Wszystko, przez co przejdzie, wraca do stanu z dnia zero, a lista „Po przeglądzie” odhacza kolejne punkty.

Model można obracać przeciągnięciem. Na telefonie kadr przesuwa się w dół, żeby karta z listą nie zasłaniała domu.

Pomysł na pełną symulację: wybór kształtu dachu i pokrycia → wiek dachu i ostatni przegląd → zaznaczanie objawów na modelu 3D → oś czasu 0–10 lat z kosztem naprawy dziś i później → wysłanie zdjęć i zamówienie przeglądu.

## Animacje

Te same zasady co w poprzednich demach:

- wejście hero, odsłanianie zdjęć, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru, licznik „130” w opiniach,
- nagłówek ciemnieje nad stopką,
- karta „Kominy i obróbki”: po najechaniu pęknięcie się zamyka i znika kapiąca kropla,
- karta „Rynny”: po najechaniu liście wylatują z rynny i woda spływa rurą,
- dymek WhatsApp chowa się, gdy na ekranie jest scena 3D.

Wszystko respektuje `prefers-reduced-motion` (bez deszczu i kropel, krótsze ruchy).
