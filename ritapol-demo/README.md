# Ritapol — demo strony

Pokazowa wersja strony dla Ritapol Sp. z o.o. (dachy, tarasy, hydroizolacje, elewacje; Warszawa, od 1990 r.). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero + „Pracujemy na materiałach”, realizacje, zajawka „Zamień dach w ogród”, usługi + proces, opinie, FAQ, CTA, stopka |
| `realizacje.html`, `uslugi.html`, `dach-zielony-3d.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („realizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw Ritapol: czerwień `#d20028` (hover `#b80023`) i grafit `#1a171b` z ich obecnej strony |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek (ciemnieje nad stopką), menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/greenroof3d.js` | Scena Three.js sterowana scrollem (sekcja 3) |
| `assets/img/` | Logo, zdjęcia i logotypy materiałów z ritapol.pl |

## Skąd są dane

Z ritapol.pl:

- logo (dorobiona wersja z białym napisem na ciemną stopkę) i kolory,
- telefon 600 242 109 („szybki kontakt”, specjalista ds. badań szczelności), biuro +48 22 354 67 74, biuro@ritapol.pl, ul. Sarmacka 22a lok. 35, 02-972 Warszawa,
- historia: fuzja trzech firm rodzinnych, działają od 1990 r., ponad 1000 inwestycji, kadra inżynierska, własny sprzęt,
- usługi: dachy (skośne, płaskie, balastowe, zielone), tarasy, balkony, hydroizolacje, badanie szczelności (metoda dymowa, elektryczna, wodna), elewacje, odśnieżanie,
- proces: audyt dachu (obmiary, dokumentacja zdjęciowa, stan techniczny, zalecenia, wycena) → plan remontu etapami → realizacja → serwis, także awaryjny,
- realizacje z ich galerii: dworzec PKP i PKS w Łodzi (miedź, 2500 m²), kamienica przy ul. Profesorskiej (miedź + dachówka, 400 m²), ul. Senatorska (tytan-cynk, 2500 m²), przetwórnia (membrana PVC, 400 m²), Park Ostrobramska (dach + tarasy, 2500 m²), pałac w Kobylinie (karpiówka),
- logotypy materiałów z ich sekcji partnerów: Rheinzink, VMZinc, KGHM, Prefa, Röben, Wienerberger, Braas, Bauder, Icopal,
- zdjęcie w karcie „Tarasy i balkony” to wizualizacja z ich strony, nie realizacja.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- wszystkie 4 opinie (firma nie ma wizytówki z opiniami w Google; można je zastąpić fragmentami listów referencyjnych),
- liczby w kreatorze: temperatura dachu, retencja wody (opad ok. 550 mm/rok × 30–75%), ceny za m², ciężar dachu ekstensywnego w FAQ.

## Efekt WOW: „Zamień dach w ogród” — kreator dachu zielonego 3D

Ritapol robi dachy zielone i obsługuje wspólnoty oraz biurowce, więc efekt WOW pokazuje, jak zwykły dach z papy zamienia się w ogród. Na stronie głównej jest zajawka. Pełny kreator to następny etap (`dach-zielony-3d.html`).

Zajawka (sekcja 3) to blok mieszkalny z balkonami, na którym podczas przewijania:

1. **Twój dach dziś:** czarna papa z pulsującym żarem i karta „Papa latem: 70°C, nagrzewa mieszkania”.
2. **Warstwy pod zieleń:** spadają po kolei i rozsuwają się z podpisami: membrana antykorzenna, mata drenażowa, geowłóknina i substrat. Licznik „1 z 4 … 4 z 4”.
3. **Wybierz ogród:** zieleń rozrasta się falą od narożnika dachu. Przewijanie (lub kliknięcie) zmienia typ:
   - ekstensywny (kolorowe rozchodniki),
   - taras (deska, donice, leżaki, czerwony parasol w kolorze marki, rozchodniki obok),
   - intensywny (trawy, krzewy, drzewka, ścieżka, grubszy substrat).
4. **Policz korzyści:** pada deszcz, który wsiąka w dach. Karta pokazuje cenę, wodę zatrzymaną na dachu (m³/rok) i temperaturę dachu latem.

Model można obracać przeciągnięciem.

Pomysł na pełny kreator: obrys dachu z mapy → sprawdzenie nośności (audyt) → wybór typu i roślin → przekrój warstw → symulacja deszczu i upału → wycena → „Wyślij projekt”.

## Animacje

Te same zasady co w poprzednich demach:

- wejście hero, odsłanianie zdjęć, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru,
- nagłówek ciemnieje nad stopką,
- logotypy materiałów są szare i kolorowe po najechaniu myszką,
- warstwy w karcie „Dachy zielone” rozchodzą się po najechaniu.

Wszystko respektuje `prefers-reduced-motion` (bez deszczu, krótsze ruchy).
