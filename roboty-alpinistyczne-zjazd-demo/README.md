# Techniczne Roboty Alpinistyczne — demo „Zjazd z 100 m”

Druga wersja demo strony dla firmy Techniczne Roboty Alpinistyczne z Warszawy (prace na wysokościach techniką alpinistyczną). Strona jest taka sama jak w pierwszym demo (`roboty-alpinistyczne-demo`). Zmienił się tylko efekt WOW: zamiast modelu 3D „Liny czy rusztowanie?” jest zjazd na linie sterowany przewijaniem. Statyczny HTML/CSS/JS, bez bibliotek i bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- Działa bez internetu, poza czcionką (Google Fonts). Bez internetu strona używa czcionki systemowej.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero ze zdjęciem z wizytówki, realizacje, zajawka „Zjazd z 100 m”, usługi i proces, opinie, FAQ, mocne CTA, stopka |
| `realizacje.html`, `uslugi.html`, `zjazd.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | Style z pierwszego demo + scena zjazdu i wysokościomierz strony |
| `assets/js/main.js` | Bez zmian: pojawianie się sekcji, nagłówek, paralaksa hero, menu, FAQ, licznik oceny, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/zjazd.js` | Scena zjazdu (sekcja 3) i wysokościomierz całej strony |
| `assets/img/` | Cztery zdjęcia z wizytówki Google firmy |

## Co się zmieniło względem pierwszego demo

- Usunięty model 3D „Liny czy rusztowanie?” razem z three.js (strona nie ładuje już nic z CDN poza czcionką).
- Sekcja 3 to teraz „Zjazd z 100 m”.
- Drugie powtarzające się CTA prowadzi do `zjazd.html` („Zjedź z nami”, „Zjedź po swoim budynku”). Przycisk w hero przewija do zajawki na stronie głównej.
- Po prawej stronie ekranu jest wysokościomierz całej strony (opis niżej).
- Reszta treści, zdjęć i animacji jest bez zmian.

## Efekt WOW: „Zjazd z 100 m”

Pomysł: strona to budynek, a przewijanie to zjazd na linie. Odwiedzający przez kilka ekranów zjeżdża razem z alpinistą po szklanej elewacji biurowca, z dachu na chodnik. Widzi przy tym, jak firma pracuje.

Przebieg (przewijanie steruje wszystkim, można się cofać):

1. **Na dachu, 100 m:** alpinista staje na krawędzi attyki. Na dachu pulsują dwie kotwy, z każdej idzie osobna lina: robocza (pomarańczowa) i asekuracyjna (biała). Karta: „Dwie kotwy, dwie liny.”
2. **Zjazd:** kamera jedzie z alpinistą. Budynek przesuwa się w górę, a miasto w tle wolniej (paralaksa w dwóch warstwach). Na dużej wysokości widać wiatr i alpinista lekko się kołysze. Karta: „Start następnego dnia.”
3. **Praca, ok. 50 m:** zjazd zwalnia, alpinista myje szybę zgarniaczem, kapie woda. Nad nim zostaje czysty pas szkła, pod nim szyby są jeszcze brudne. Karta: „Każdy pas elewacji z bliska.”
4. **Pod budynkiem:** pojawia się ulica, odgrodzone miejsce lądowania z tabliczką „Uwaga, prace na wysokości”, przechodnie idą obok, a przy krawężniku stoi auto ekipy z numerem telefonu. Karta: „Teren odgrodzony.”
5. **0 m, na ziemi:** luźny koniec liny leży na chodniku, alpinista unosi zgarniacz. Pojawia się karta „Robota zrobiona. Bez rusztowania.” z telefonem i linkiem do pełnej wersji.

Wysokościomierz po lewej pokazuje metry nad chodnikiem, etap („Na dachu”, „Zjazd”, „Mycie szyb”, „Na ziemi”) i pozycję na skali 100–0 m.

**Wysokościomierz strony.** Na szerokich ekranach (od 1100 px) przy prawej krawędzi jest cienka lina z kropką. Góra strony to dach (100 m), stopka to parter (0 m). Podczas przewijania obok kropki pokazuje się wysokość i nazwa „piętra” (Realizacje, Usługi, Opinie…). W sekcji zjazdu chowa się, bo scena ma własny wysokościomierz.

Pomysł na pełną wersję (`zjazd.html`): wybór budynku (biurowiec ze szkłem, blok, kamienica, hala) i wysokości → rodzaj pracy (mycie, naprawa, montaż reklamy, odśnieżanie) pokazany na elewacji w czasie zjazdu → ile trwa praca i czy trzeba zamknąć chodnik → zdjęcia budynku i prośba o wycenę.

Technicznie:
- Ilustracja jest narysowana w CSS i SVG, bez zdjęć i bez WebGL.
- Ruch to tylko `transform` i `opacity`.
- Przy szybkim przewijaniu kamera odrobinę się spóźnia za alpinistą, co daje wrażenie bezwładności.
- Nogi pracują tylko w ruchu.
- Na telefonie pasek CTA i WhatsApp chowają się na czas sceny (scena zajmuje cały ekran, a karta lądowania ma oba przyciski) i wracają zaraz za nią.
- Przy `prefers-reduced-motion` scena dalej podąża za przewijaniem, ale bez kołysania, wiatru, chmur, chodzących przechodniów i opóźnienia kamery.

## Dlaczego nie ma „mycia na żywo” (pomysł 6)

Pomysł 6 to suwak „przed i po” na prawdziwych zdjęciach brudnej i umytej elewacji. Wymaga par zdjęć tego samego miejsca przed pracą i po niej. Firma ma w wizytówce Google tylko cztery zdjęcia: kopuła, dwie szklane elewacje i kamienica. Żadne z nich nie jest parą „przed/po”, więc tego efektu nie zrobiłem. Rysowany czysty pas szkła w scenie zjazdu to ilustracja, nie porównanie zdjęć. Gdy firma przyśle 2–3 pary zdjęć (to samo ujęcie przed i po), można dodać „mycie na żywo” jako osobną sekcję albo w realizacjach.

## Skąd są dane

Z wizytówki Google (Prace na wysokościach):

- nazwa Techniczne Roboty Alpinistyczne, adres Piękna 68, 00-672 Warszawa, telefon 513 017 509, „czynne całą dobę”,
- ocena 5,0 z 3 opinii. Trzy opinie z treścią: Yankeessks („Polecam - Brzoza Team. Konkretna wycena…”), Anna Płaza („Profesjonalna ekipa, punktualna…”) i jocelyn manguy („Doskonały”). Cytaty na stronie są dosłowne, czasem skrócone (wielokropek w nawiasie),
- wszystkie cztery zdjęcia: naprawa poszycia kopuły (hero i tło CTA), dwie szklane elewacje biurowców, elewacja kamienicy.

Brak strony i logo, więc w miejscu logo jest „TWOJE LOGO” (także na aucie w scenie zjazdu). Kolory dobrane do branży: granat jak szkło na zdjęciach z realizacji, pomarańcz jak sprzęt i kaski alpinistów.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- zakres usług (mycie okien i elewacji, naprawy elewacji i dachów, reklamy i siatki, sople i odśnieżanie) — typowy dla branży, wizytówka go nie podaje,
- czwarta opinia (Marta K., zarządca budynku),
- podpisy realizacji (nie znamy nazw budynków),
- WhatsApp na numer 513 017 509 (nie wiemy, czy firma go używa),
- scena zjazdu: budynek 100 m, auto ekipy, kolory kasku i kurtki. „Start następnego dnia” opiera się na opinii z Google („już na drugi dzień”). Dwie liny i odgradzanie terenu to standard pracy na linach i są już w FAQ.
