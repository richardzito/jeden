# Dachy Dekar — demo strony

Pokazowa wersja strony dla firmy Dekar Robert Szymański (dachy płaskie, Warszawa i mazowieckie). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero, realizacje, zajawka „Przekrój Dachu 3D”, usługi + proces, opinie, FAQ, CTA, stopka |
| `realizacje.html`, `uslugi.html`, `kalkulator-3d.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („realizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzedniego demo + dodatki dla Dekar + motyw w kolorach firmy (na końcu pliku) |
| `assets/js/main.js` | Pojawianie się sekcji, header, menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/flatroof3d.js` | Scena Three.js sterowana scrollem (sekcja 3) |
| `assets/img/` | Zdjęcia i logo z dachydekar.pl |

## Kolory

Kolorystyka obecnej strony dachydekar.pl: czerń `#161922` i żółty `#ffd266`, na białej bazie z dużą ilością oddechu.

- Żółty to tylko wypełnienie (przyciski, kropki, linie postępu). Nigdy nie jest tekstem na białym, bo byłby nieczytelny.
- Czarne bloki: sekcja 3D i stopka. Nad nimi nagłówek sam przełącza się na ciemny, a logo zamienia się na jasne.
- Mocne zakończenie (sekcja 7) jest na żółtym tle z czarnym tekstem.

## Skąd są dane

Z dachydekar.pl:

- logo (białe na ciemne tło; dorobiona wersja z ciemnym napisem na jasną stronę, znak dachu bez zmian),
- telefon 602 441 225, e-mail dekar.08@wp.pl,
- specjalizacja: dachy płaskie, papa termozgrzewalna,
- „ponad 20 lat doświadczenia”, „wieloletnie gwarancje”, „dojazd do przecieku w 24 h”, odśnieżanie, całe mazowieckie,
- wszystkie zdjęcia realizacji.

Z wizytówki Google: adres ul. Dobra 51A, ocena 5,0 z 25 opinii i 4 opinie (skrócone, nazwiska do inicjałów).

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- ceny w FAQ (120–250 zł/m²) i w kalkulatorze (165 / 195 / 240 zł/m²),
- czas prac w kalkulatorze (4–5 dni),
- kroki procesu (na ich stronie jest 5 kroków; tu skrócone do 4).

## Efekt WOW: „Przekrój Dachu 3D”

Dekar robi dachy płaskie, więc efekt WOW pokazuje to, czego klient normalnie nie widzi: co jest pod papą. Na stronie głównej jest zajawka. Pełny kalkulator to następny etap (`kalkulator-3d.html`).

Zajawka (sekcja 3) to budynek z dachem płaskim, który zmienia się podczas przewijania:

1. **Pomiar:** obrys dachu i skaner, chip „128 m² · spadek 2%”.
2. **Warstwy:** dach rozkłada się na 5 warstw: papa wierzchnia, papa podkładowa, ocieplenie, paroizolacja i strop. Etykiety śledzą model.
3. **Ocieplenie:** EPS 10 cm → EPS 20 cm → PIR 16 cm. Warstwa rośnie i zmienia kolor, a karta pokazuje współczynnik U i to, czy dach spełnia WT 2021 (U ≤ 0,15 W/m²K). Można też klikać.
4. **Cena:** warstwy składają się z powrotem. Widełki kosztu i czas prac.

U liczone jest wzorem `1 / (Rsi 0,10 + Rse 0,04 + strop 0,12 + d/λ)`, gdzie λ wynosi 0,036 dla EPS i 0,022 dla PIR. To wartości poglądowe.

Pomysł na pełny kalkulator: adres → obrys dachu z mapy → rodzaj prac (nowe krycie, renowacja, ocieplenie) → przekrój 3D → U i zgodność z WT 2021 → widełki ceny → „Wyślij projekt i zadzwoń”.

## Animacje

Te same zasady co w poprzednim demo: wejście hero, odsłanianie zdjęć, linia procesu, FAQ, reakcja przycisków, WhatsApp, kopiowanie numeru. Nowe elementy:

- pulsująca kropka w pasku „Przecieka? Dojeżdżamy w 24 h”,
- warstwy w karcie „Ocieplenie”, które rozchodzą się po najechaniu myszką,
- rozkładanie dachu w 3D.

Wszystko respektuje `prefers-reduced-motion`.
