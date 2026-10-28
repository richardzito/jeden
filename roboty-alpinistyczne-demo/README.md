# Techniczne Roboty Alpinistyczne — demo strony

Pokazowa wersja strony dla firmy Techniczne Roboty Alpinistyczne z Warszawy (prace na wysokościach techniką alpinistyczną). Firma ma tylko wizytówkę w Google, bez strony i logo. Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet. Bez niego w sekcji 3 widać zdjęcie z realizacji, a kroki i karta porównania działają dalej.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero ze zdjęciem z wizytówki, realizacje, zajawka „Liny czy rusztowanie?”, usługi i proces, opinie, FAQ, mocne CTA, stopka |
| `realizacje.html`, `uslugi.html`, `bez-rusztowania.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw firmy: granat `#0f1b26` i pomarańcz `#cc4a0c` |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek (przezroczysty nad zdjęciem, ciemnieje nad stopką), paralaksa zdjęcia w hero, menu, FAQ, licznik oceny, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/rusztowanie3d.js` | Scena Three.js sterowana przewijaniem (sekcja 3) |
| `assets/img/` | Cztery zdjęcia z wizytówki Google firmy |

## Skąd są dane

Z wizytówki Google (Prace na wysokościach):

- nazwa Techniczne Roboty Alpinistyczne, adres Piękna 68, 00-672 Warszawa, telefon 513 017 509, „czynne całą dobę”,
- ocena 5,0 z 3 opinii. Trzy opinie z treścią: Yankeessks („Polecam - Brzoza Team. Konkretna wycena…”), Anna Płaza („Profesjonalna ekipa, punktualna…”) i jocelyn manguy („Doskonały”). Cytaty na stronie są dosłowne, czasem skrócone (wielokropek w nawiasie),
- wszystkie cztery zdjęcia: naprawa poszycia kopuły (hero i tło CTA), dwie szklane elewacje biurowców, elewacja kamienicy.

Brak strony i logo — w miejscu logo jest „TWOJE LOGO”. Kolory dobrane do branży: granat jak szkło na zdjęciach z realizacji, pomarańcz jak sprzęt i kaski alpinistów. Z opinii wynika, że ekipa nazywa się „Brzoza Team” — do potwierdzenia, na stronie tej nazwy nie użyłem.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- zakres usług (mycie okien i elewacji, naprawy elewacji i dachów, reklamy i siatki, sople i odśnieżanie) — typowy dla branży, wizytówka go nie podaje,
- czwarta opinia (Marta K., zarządca budynku),
- podpisy realizacji (nie znamy nazw budynków),
- WhatsApp na numer 513 017 509 (nie wiemy, czy firma go używa),
- liczby w porównaniu „Liny czy rusztowanie?”: start za 6 dni / jutro, 11 dni / 4 dni, koszt 100% / ≈ 55%. Na stronie są opisane jako wartości poglądowe.

## Efekt WOW: „Liny czy rusztowanie?” — porównanie w 3D

Największa przewaga pracy na linach: nie trzeba stawiać rusztowania ani podnośnika, więc start jest szybszy, koszt niższy, a chodnik zostaje wolny. Opinia z Google mówi to samo („szybki termin realizacji, już na drugi dzień”, „cenowo rewelacja”). Efekt WOW pokazuje to na jednym budynku. Na stronie głównej jest zajawka. Pełny kalkulator to następny etap (`bez-rusztowania.html`).

Zajawka (sekcja 3) to 10-piętrowy biurowiec ze szklaną elewacją przy ulicy. Przewijanie prowadzi przez cztery kroki:

1. **Zlecenie:** brudna elewacja z zaciekami. Karta: 36 m, 10 pięter, 1 900 m² szkła.
2. **Z rusztowania:** rusztowanie rośnie poziom po poziomie, z siatką ochronną. Barierki zamykają chodnik, a przechodnie schodzą na jezdnię. W karcie porównania rośnie licznik „start za … dni”.
3. **Na linach:** rusztowanie znika, na dachu świecą punkty kotwiczenia, z dachu spadają po dwie liny (robocza i asekuracyjna). Czterech alpinistów zjeżdża pas po pasie, a nad każdym z nich szkło jest już czyste. Kamera zjeżdża razem z nimi.
4. **Wynik:** czysta elewacja z odblaskiem słońca, chodnik wolny. Karta porównania podświetla kolumnę „Liny” i pokazuje przycisk „Wycena w 24 h”.

Model można obracać przeciągnięciem. Na komputerze kadr przesuwa się w lewo, żeby karta porównania nie zasłaniała budynku. Na telefonie przesuwa się w dół.

Pomysł na pełny kalkulator: wysokość i szerokość elewacji → rodzaj pracy → czy pod budynkiem jest chodnik albo ulica → model 3D z rusztowaniem, podnośnikiem albo ekipą na linach → porównanie czasu, kosztu i utrudnień → zdjęcia i prośba o wycenę.

## Animacje

Te same zasady co w poprzednich demach:

- hero: zdjęcie z realizacji odjeżdża z przybliżenia, nagłówek wjeżdża linia po linii, przy przewijaniu zdjęcie lekko zostaje w tyle,
- odsłanianie zdjęć realizacji, linia procesu, FAQ, licznik oceny 5,0,
- reakcja przycisków, WhatsApp, kopiowanie numeru, nagłówek ciemnieje nad stopką,
- ilustracje usług po najechaniu:
  - zgarniacz przejeżdża po szybie i zbiera brud,
  - rysa w murze wypełnia się zaprawą,
  - baner rozwija się z rolki,
  - sople odpadają, a śnieg zsuwa się z dachu,
  - na telefonie trzy pierwsze pokazują stan „po” raz, gdy karta wejdzie w kadr,
- karta porównania: wartości pojawiają się z lekkim rozmyciem w chwili, gdy dzieje się to na modelu,
- dymek WhatsApp chowa się, gdy na ekranie jest scena 3D.

Wszystko respektuje `prefers-reduced-motion`: bez paralaksy, chodzących przechodniów i kołysania lin, krótsze ruchy.
