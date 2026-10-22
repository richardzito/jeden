# Max Profil — demo strony

Pokazowa wersja strony dla firmy Max Profil (kompleksowe roboty dekarskie, dachy płaskie, Warszawa). Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero + „Współpracujemy z”, realizacje, zajawka „Test szczelności 3D”, usługi + proces, opinie, FAQ, CTA, stopka |
| `realizacje.html`, `uslugi.html`, `test-szczelnosci-3d.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („realizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw czerwień `#d80604` / czerń (na końcu pliku) |
| `assets/js/main.js` | Pojawianie się sekcji, nagłówek (ciemnieje nad czarnymi sekcjami), menu, FAQ, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/smoketest3d.js` | Scena Three.js sterowana scrollem (sekcja 3), z cząsteczkami dymu |
| `assets/img/` | Logo, zdjęcia i logotypy partnerów z maxprofil.pl |

## Skąd są dane

Z maxprofil.pl:

- logo (dorobiona wersja z białym napisem na ciemne tło),
- telefon 602 344 841, e-mail kontakt@maxprofil.pl, adres Staniewicka 7,
- „kompleksowe usługi dekarskie dla firm”, ponad 20 lat, dachy płaskie i zielone,
- bezpłatny dojazd, przedmiar, kosztorys i doradztwo,
- zadymianie dachu: gaz 95% azotu i 5% wodoru, bezpieczny, nieinwazyjny; „setki prób szczelności w całej Polsce”; dlaczego nie próba wodna,
- logotypy z sekcji „Współpracujemy z firmami” (Budimex, Skanska, Erbud, Aldesa, Develia, PKP, Poczta Polska, Polskie Radio),
- wszystkie zdjęcia realizacji i usług (jedno zdjęcie membrany PCV to zdjęcie stockowe, które jest na ich stronie).

Z wizytówki Google: jedna prawdziwa opinia („Polecam, śmiało można dzwonić!”, Jurek M.).

**Uwaga:** w Google firma ma ocenę 3,4 z 5 opinii, w tym jedną bardzo negatywną. Dlatego strona nie pokazuje oceny z Google.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- 3 opinie (Michał K., Anna W., Robert P.),
- cena próby dymowej (3–5 zł/m²), „czas próby ok. 1 dzień”, „raport tego samego dnia”,
- nazwy nieszczelności w scenie 3D (to przykłady).

## Efekt WOW: „Test szczelności 3D — znajdź przeciek, zanim zaleje biuro”

Wyróżnikiem Max Profil jest zadymianie dachów, więc efekt WOW pokazuje, jak działa próba dymowa. Na stronie głównej jest zajawka. Pełna wersja to następny etap (`test-szczelnosci-3d.html`).

Zajawka (sekcja 3, czarne tło) to biurowiec z dachem z membrany PCV, który zmienia się podczas przewijania:

1. **Wtłaczamy gaz:** wytwornica z wężem, a pod membraną rozchodzą się fale gazu (przycięte do obrysu dachu). Licznik wypełnienia, chipy 95% N₂ i 5% H₂.
2. **Dym wskazuje dziury:** z 4 nieszczelności po kolei wydobywa się dym (cząsteczki). Licznik „1 z 4 … 4 z 4”.
3. **Lokalizujemy:** czerwone pulsujące pinezki z opisami, a kamera się przybliża.
4. **Naprawa i raport:** dym gaśnie, pojawiają się łaty, pinezki zmieniają się na zielone „Uszczelnione”. Na koniec karta z ceną próby, czasem i raportem.

Model można obracać przeciągnięciem.

Pomysł na pełną wersję: obrys dachu z mapy → model 3D budynku → klient zaznacza, gdzie cieknie → plan próby dymowej, termin i wycena → wysłanie zgłoszenia. To idealne narzędzie dla zarządców nieruchomości i generalnych wykonawców.

## Animacje

Te same zasady co w poprzednich demach:

- wejście hero, odsłanianie zdjęć, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru,
- nagłówek przełącza się na ciemny nad czarnymi sekcjami,
- logotypy partnerów są szare i kolorowe po najechaniu myszką,
- pulsujące pinezki i dym w 3D.

Wszystko respektuje `prefers-reduced-motion`.
