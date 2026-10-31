# DORAKO — demo strony

Pokazowa wersja strony dla DORAKO Kominki & SPA (Piotr Koper, Warszawa): producent saun na wymiar i saun ogrodowych, domki saunowe, jacuzzi i wanny SPA, wanny lodowe, kominki. Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet. Bez niego w sekcji 3 widać zdjęcie przeszklonej sauny w ogrodzie, a kroki i termometr działają dalej.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero ze zdjęciem sauny i animowaną parą, pasek zaufania, realizacje, zajawka „Ogrodowe SPA w 3D”, oferta, showroom i proces, opinie, FAQ, mocne CTA, stopka |
| `realizacje.html`, `oferta.html`, `konfigurator-spa.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw firmy: malina z obecnej strony i logo (przyciski `#d81b4c`, kontrast 5:1), turkus `#3fadc7` jako drugi akcent, ciepły grafit `#1c1918` |
| `assets/js/main.js` | Wejście hero, para nad ławami (canvas, pół rozdzielczości, staje poza ekranem), paralaksa zdjęcia, nagłówek, menu, FAQ, liczniki, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/spa3d.js` | Scena Three.js sterowana przewijaniem (sekcja 3) |
| `assets/img/` | Logo (oryginał + jasna wersja), zdjęcia z dorako.pl, odznaka Oferteo |

## Skąd są dane

Z obecnej strony dorako.pl:

- logo DORAKO Kominki & SPA (wycięte z marginesów, plus jasna wersja na ciemne tło), kolory malina `#e62855` i turkus `#3fadc7`,
- dane: DORAKO Piotr Koper, ul. Czarodzieja 2 lok. 4, 03-116 Warszawa, tel. +48 784 874 875, dorako@dorako.pl, pn–pt 9–17, sob. 10–13, „ponad 30-letnie doświadczenie”, „realizujemy projekty na terenie całej Polski”,
- oferta: sauny na wymiar (Tylö), sauny ogrodowe (Kopenhaga, Hanko, Bergen i inne), domki saunowe, wanny SPA (Dimension One Spas, dealer Jacuzzi®), wanny lodowe, kominki, montaż jacuzzi „w zagłębieniu, w zabudowie do połowy wysokości lub na podłożu”, sauny ogrodowe „bez znacznej ingerencji w teren”,
- odznaka Oferteo „Najlepsi 2025”,
- wszystkie zdjęcia: realizacje z ich galerii (sauny, łaźnia parowa, jacuzzi, wanny SPA), produkty (Kopenhaga, Kuusamo, wanny lodowe), kominek ogrodowy.

Wizytówka Google się nie wczytała (panel w Mapach stoi na ładowaniu), więc **wymyślone na potrzeby demo — do potwierdzenia lub podmiany**:

- cztery opinie (Katarzyna i Marek z Legionowa, Paweł W. z Jabłonny, Agnieszka N. z Wawra, Tomasz R. z pensjonatu na Mazurach),
- WhatsApp na numer 784 874 875 (to ich główna komórka — do potwierdzenia, czy działa na WhatsAppie),
- podpisy realizacji (nie znamy lokalizacji),
- dane w konfiguratorze: wymiary modeli Kopenhaga 2,2 × 2,0 m, Hanko 2,0 × 2,0 m, Bergen 2,6 × 2,2 m, czas nagrzewania „do 90 °C w 40 min”, temperatury i czasy rytuału. Na stronie opisane jako dane poglądowe.

## Efekt WOW: „Ogrodowe SPA w 3D — gorąco, zimno, gorąco”

Klient kupujący saunę ogrodową zwykle nie wie, jak to będzie wyglądać u niego i co jeszcze dołożyć. Konfigurator pokazuje całe ogrodowe SPA od jednego producenta i prowadzi przez rytuał gorąco–zimno, który sprzedaje kolejne produkty (jacuzzi, wanna lodowa, kominek). Na stronie głównej jest zajawka. Pełny konfigurator to następny etap (`konfigurator-spa.html`).

Zajawka (sekcja 3) to makieta ogrodu z żywopłotem, brzozami i świerkiem. Przełącznik u góry zmienia model sauny: **Kopenhaga** (przeszklony front), **Hanko** (drewniane drzwi z okrągłym okienkiem i boczne okno), **Bergen** (szkło z dwóch stron, większa). Przewijanie prowadzi przez cztery kroki:

1. **Sauna:** deski spadają na miejsce jedna po drugiej, potem dach i szkło. Kamienie w piecu rozżarzają się, LED pod ławami świeci, a termometr rośnie z 20 do 90 °C.
2. **Jacuzzi:** taras układa się deska po desce, z góry wjeżdża wanna SPA, woda się nalewa, bąbelki i para. Termometr: 38 °C.
3. **Wanna lodowa:** czarna wanna z agregatem, kostki lodu, zimna mgła ścielona nad tarasem. Termometr: 4 °C.
4. **Rytuał:** zmierzch, kominek ogrodowy z płomieniem, światła przy ścieżce, świecąca woda, para z sauny. Termometr pokazuje w pętli rytuał: sauna 12 min → wanna lodowa 1 min → jacuzzi 15 min. Przycisk „Zaprojektuj swoje SPA” dostaje poświatę.

Model można obracać przeciągnięciem. Na komputerze kadr przesuwa się w lewo, żeby karta termometru nie zasłaniała ogrodu. Etykiety same przeskakują na drugą stronę, gdy wpadłyby pod kartę.

Pomysł na pełny konfigurator: model i wymiar sauny (także domowej pod skos) → drewno, piec, oświetlenie, sól himalajska → jacuzzi, wanna lodowa, balia, kominek na planie działki → widok dzień i zmierzch → wstępna wycena i wysłanie projektu do doradcy.

## Animacje

- hero: zdjęcie sauny wyłania się z przybliżenia, nad ławami unosi się para (miękkie kłęby na canvasie), nagłówek wjeżdża linia po linii, przy przewijaniu zdjęcie lekko zostaje w tyle,
- liczniki w pasku zaufania, odsłanianie zdjęć realizacji, powiększenie zdjęć oferty po najechaniu, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru, nagłówek ciemnieje nad zdjęciem i stopką,
- `prefers-reduced-motion`: bez pary i paralaksy, scena 3D przechodzi skokowo między krokami.

## Do zrobienia przy wdrożeniu

- prawdziwe opinie (np. z Google lub Oferteo) i zgoda na ich publikację,
- potwierdzenie numeru WhatsApp,
- rzeczywiste wymiary i ceny modeli saun ogrodowych do konfiguratora.
