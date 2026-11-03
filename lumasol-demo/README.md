# Luma Sol — demo strony z konfiguratorem 3D w hero

Pokazowa wersja strony dla Luma Sol (ogrody zimowe sezonowe i całoroczne, zadaszenia tarasów, zabudowy balkonów, pergole, wiaty, okna aluminiowe). Statyczny HTML/CSS/JS bez kroku budowania. Jedyna biblioteka to three.js do 3D, ładowana z CDN.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- Internet jest potrzebny do 3D (three.js z CDN) i czcionek (Google Fonts). Bez niego panel konfiguratora, podsumowanie i formularz działają dalej, a zamiast modelu widać zdjęcia z realizacji.
- Wersja jednoplikowa (`lumasol-strona-glowna.html`) to strona główna z wbudowanymi stylami, skryptami i zdjęciami (w nieco niższej rozdzielczości). Wygodnie wysłać ją mailem.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero z konfiguratorem 3D, pasek liczb, realizacje i „rzeka zdjęć”, cztery pory roku w 3D, oferta i proces, opinie, FAQ, wycena z formularzem, stopka |
| `realizacje.html`, `oferta.html`, `konfigurator.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) z opisem planowanej zawartości |
| `assets/css/style.css` | Wygląd. Kolory z obecnej strony: grafit `#2c3639` / `#3f4e4f`, beż `#dcd7c9`, pomarańcz słońca z logo `#f4a22f` i żółty `#fec42d`. Czcionki jak na obecnej stronie: Tenor Sans i Montserrat |
| `assets/js/luma3d.js` | Scena 3D: dom, taras, ogród z sosnami i basenem oraz zabudowa budowana z parametrów. Ta sama scena działa w hero i w sekcji „Cztery pory roku” |
| `assets/js/konfigurator.js` | Sterowanie panelem konfiguratora, przeniesienie projektu do formularza, przewijanie pór roku |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek, menu, FAQ, liczniki, formularz (w demo bez wysyłki), WhatsApp, kopiowanie numeru |
| `assets/img/` | Zdjęcia z realizacji i oferty ze strony lumasol.pl, logo w wersji ciemnej i jasnej, favicon |

## Hero: konfigurator 3D

Pierwszy ekran to od razu działający konfigurator. Klient widzi dom z tarasem i ogrodem, a obok panel:

- **Rodzaj:** ogród zimowy całoroczny, ogród zimowy sezonowy, zadaszenie tarasu, pergola lamelowa. Model przebudowuje się na żywo (słupy, rynna, krokwie, szkło, ściany).
- **Wymiary:** szerokość 3–8 m i głębokość 2,5–5 m. Powierzchnia w m² liczy się sama, a przy zmianie na modelu pojawiają się etykiety wymiarów.
- **Kolor konstrukcji:** antracyt RAL 7016, biały RAL 9016, czarny RAL 9005, złoty dąb.
- **Dach:** szkło bezbarwne albo przeciwsłoneczne. Przy pergoli suwak otwiera i zamyka lamele.
- **Ściany:** szklane przesuwne z suwakiem otwarcia — panele zjeżdżają na bok jak w prawdziwym systemie. Przy zadaszeniu ściany można dodać albo nie.
- **Dodatki:** oświetlenie LED, markiza na dachu (rozwija się na modelu), promienniki ciepła.
- **Pora dnia:** dzień, zachód, noc z ciepłym światłem w środku i podświetlonymi oknami domu.
- Model obraca się przeciągnięciem (na telefonie poziomo, żeby nie blokować przewijania strony). Gdy nikt go nie dotyka, kamera lekko się kołysze.
- **„Wyślij do bezpłatnej wyceny”** przenosi projekt do formularza na dole strony: obraz z modelu, podsumowanie, rodzaj zabudowy i metraż wpisują się same.

## Efekt WOW: „Jeden taras. Cztery pory roku.” (sekcja 3)

Scena przyklejona do ekranu, przewijanie przesuwa rok od lipca do czerwca:

1. **Lato:** słońce, szklane ściany rozsunięte na bok.
2. **Jesień:** pochmurno, pada deszcz i lecą liście. Krople zatrzymują się na dachu, w środku sucho.
3. **Zima:** zmierzch, pada śnieg, na dachu ogrodu, domu i na trawniku leży śnieg. W środku ciepłe światło i promienniki.
4. **Wiosna:** jasno, kwitną drzewa, ściany do połowy otwarte.

Obok: tarcza z miesiącem, termometr „na zewnątrz / w środku” i cztery krótkie karty. Temperatury są przykładowe i opisane na stronie jako poglądowe.

## Skąd są dane

Ze strony lumasol.pl:

- nazwa, logo, telefon 668 637 577, e-mail kontakt@lumasol.pl, NIP 521-053-40-87,
- oferta (ogrody sezonowe i całoroczne, zadaszenia, zabudowy balkonów, pergole, wiaty, okna aluminiowe),
- liczby z licznika na stronie: 10 lat gwarancji, 500+ realizacji, 25 000 m² konstrukcji; wycena w 24 h,
- pięć kroków współpracy, opinie klientów (skrócone, z imionami jak na stronie), odpowiedzi w FAQ (skrócone),
- realizacje i zdjęcia: Jabłonna (60 m², system dachowy TS Aluminium), Marki (jacuzzi), Marki (32 m², jadalnia), Międzylesie, Puszcza Biała (całoroczny z termoizolacją), Warszawa Radość (szyby po 120 kg wniesione dźwigiem).

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- wymiary w konfiguratorze (3–8 × 2,5–5 m), kolory i nazwy RAL, zestaw dodatków,
- temperatury w sekcji „Cztery pory roku” (poglądowe),
- WhatsApp na numer 668 637 577 (nie wiemy, czy firma go używa),
- obszar działania „Warszawa i okolice” (wynika z lokalizacji realizacji),
- model 3D domu i ogrodu jest ilustracją, nie projektem technicznym.

## Animacje

- hero: nagłówek wjeżdża linia po linii, kamera najeżdża na dom, panel i pasek pory dnia pojawiają się po kolei; zmiany w konfiguratorze płynnie animują model (ściany, lamele, markiza, światło, kolor),
- realizacje: zdjęcia odsłaniają się przy przewijaniu; po najechaniu (na telefonie co kilka sekund) zmieniają się na drugie ujęcie tej samej realizacji; pod siatką powoli płynie „rzeka zdjęć”,
- liczniki 10 / 500 / 25 000 / 24, linia procesu, FAQ, WhatsApp, kopiowanie numeru,
- formularz: po przeniesieniu projektu karta „Twój projekt” i wypełnione pola krótko się podświetlają.

Przy ustawieniu „ogranicz ruch” animacje ruchu są wyłączone albo skrócone, scena pór roku pokazuje stan bez cząstek, a model nie kołysze się sam.
