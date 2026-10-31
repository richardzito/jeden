# AQUA-PERFECT — demo strony

Pokazowa wersja strony dla AQUA-PERFECT (system basenowy Grupy Konsultingowo-Inżynieryjnej KOMPLEKS S.A. z Wałbrzycha): baseny pod klucz, technologia uzdatniania wody, niecki ze stali AQUA-STAL, wanny SPA, serwis. Statyczny HTML/CSS/JS, bez kroku budowania.

## Jak otworzyć

- Rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku bezpośrednio ze środka ZIP-a.
- 3D ładuje się z CDN, więc potrzebny jest internet. Bez niego w sekcji 3 widać zdjęcie niecki ze stali, a kroki i karta danych działają dalej.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: hero z filmem, pasek zaufania, taśma marek, realizacje, zajawka konfiguratora 3D, oferta i proces, opinie, FAQ, mocne CTA, stopka |
| `realizacje.html`, `oferta.html`, `konfigurator-basenu.html`, `o-firmie.html`, `kontakt.html` | Podstrony-zaślepki („zostanie zrealizowana przy rozpoczęciu współpracy”) |
| `assets/css/style.css` | System z poprzednich dem + motyw firmy: błękit `#015fa9` i granat `#002c4f` z obecnej strony |
| `assets/js/main.js` | Wejście hero, film w tle (pauza, oszczędzanie baterii, ograniczony ruch), nagłówek, menu, FAQ, liczniki, taśma marek, pasek CTA na telefonie, WhatsApp, kopiowanie numeru |
| `assets/js/basen3d.js` | Scena Three.js sterowana przewijaniem (sekcja 3) |
| `assets/video/hero.mp4`, `hero.webm` | Film w tle hero (pętla bez szwu, 13 s): MP4/H.264 1,9 MB i zapasowy WebM/VP9 1,5 MB dla przeglądarek bez H.264 |
| `assets/img/` | Logo, zdjęcia z obecnej strony, logotypy marek, Gazele Biznesu |

## Skąd są dane

Z obecnej strony aqua-perfect.pl:

- logo AQUA-PERFECT (powiększone i wycięte z tła, plus jasna wersja na granat), kolory `#015fa9` i `#002c4f`,
- dane firmy: KOMPLEKS S.A., ul. Ogrodowa 19, 58-306 Wałbrzych, tel. 74 841 55 19, poczta@kompleks.pl, oddziały we Wrocławiu i Warszawie, na rynku od 1991 r., Gazele Biznesu 2024,
- aquaparki w Sopocie, Zakopanem, Zielonej Górze i Przemyślu,
- marki: Technol, ProMinent, Hugo Lahme, Lifetech, Aseko, USSPA, ALGE, Gemaş, AngelEye, Malmsten, Rada, Astore, TMA, Venture (logotypy z ich strony), pompy Speck,
- wszystkie zdjęcia realizacji, maszynowni, wanien SPA i niecek AQUA-STAL (galerie na ich stronie).

Film w hero to darmowe nagranie z Mixkit (licencja Mixkit, bez wymogu podpisu). Kolory przesunięte w stronę błękitu marki. Na stronie nie jest przedstawiony jako realizacja firmy. Do podmiany na nagranie z ich obiektu, jeśli takie mają.

Firma nie ma wizytówki z opiniami, więc **wymyślone na potrzeby demo — do potwierdzenia lub podmiany**:

- cztery opinie (Marek Z. – hotel, Anna i Piotr K. – basen przydomowy, Tomasz R. – pracownia architektoniczna, kierownik pływalni miejskiej),
- WhatsApp na numer +48 503 143 936 (Michał Słowik, dyrektor oddziału w Wałbrzychu, numer z ich strony) — do potwierdzenia, czy ma być publiczny,
- podpisy realizacji (nie znamy nazw obiektów),
- dane w konfiguratorze: wymiary typowych basenów, pojemność, obieg wody, liczba i średnica filtrów, liczba pomp. Na stronie są opisane jako dane poglądowe.

## Efekt WOW: „Konfigurator basenu 3D”

Klient widzi zwykle tylko taflę wody. O jakości decyduje to, czego nie widać: niecka, rynna przelewowa, rury i maszynownia. Konfigurator pokazuje to wszystko w przekroju i zamienia „ile to kosztuje?” w telefon. Na stronie głównej jest zajawka. Pełny konfigurator to następny etap (`konfigurator-basenu.html`).

Zajawka (sekcja 3) to makieta basenu w przekroju gruntu. Przełącznik u góry zmienia typ: **prywatny 8 × 4 m**, **hotelowy 15 × 7 m** albo **sportowy 25 × 12,5 m**. Niecka płynnie zmienia wymiar (sprężyna). Zmienia się też wyposażenie: schody i przeciwprąd, ławka i kaskada albo liny torowe, słupki startowe i płyty pomiaru czasu. W maszynowni zmienia się liczba filtrów i pomp. Przewijanie prowadzi przez cztery kroki:

1. **Niecka:** pusta niecka ze stali napełnia się wodą. Licznik pojemności rośnie razem z poziomem wody.
2. **Obieg:** przód gruntu odjeżdża, reszta staje się szklana. Mętna woda płynie z rynny przelewowej przezroczystą rurą do zbiornika przelewowego. Karta pokazuje obieg w m³/h i co ile godzin cała woda przechodzi przez filtr.
3. **Maszynownia:** kamera wjeżdża do maszynowni: pompy Speck, filtry Technol, lampa UV Lifetech (świeci na fioletowo), dezynfekcja ProMinent. Woda za filtrem zmienia kolor na krystaliczny, a basen się klaruje.
4. **Efekt:** zmierzch, podświetlenie LED w ścianach, kaustyki na dnie i atrakcja wybranego typu (pęcherzyki przeciwprądu, kaskada albo świecące płyty pomiaru czasu). Przycisk „Skonfiguruj swój basen” dostaje poświatę.

Model można obracać przeciągnięciem. Na komputerze kadr przesuwa się w lewo, żeby karta danych nie zasłaniała basenu. Etykiety same przeskakują na drugą stronę, gdy wpadłyby pod kartę.

Pomysł na pełny konfigurator: typ obiektu → wymiar, głębokość i kształt → schody, ławki, atrakcje, światło → automatyczny dobór maszynowni z obiegiem liczonym dla obiektu → porównanie stali i betonu → wstępna wycena i wysłanie projektu do doradcy.

## Animacje

- hero: film wyłania się z przybliżenia, nagłówek wjeżdża linia po linii, przy przewijaniu film lekko zostaje w tyle; przycisk pauzy, film staje poza ekranem,
- liczniki w pasku zaufania, spokojna taśma logotypów marek (zatrzymuje się po najechaniu),
- odsłanianie zdjęć realizacji, powiększenie zdjęć usług po najechaniu, linia procesu, FAQ,
- reakcja przycisków, WhatsApp, kopiowanie numeru, nagłówek ciemnieje nad filmem i stopką,
- `prefers-reduced-motion`: film zatrzymany na pierwszej klatce, bez paralaksy, scena 3D przechodzi skokowo między krokami, taśma marek jest zwykłą siatką.

## Do zrobienia przy wdrożeniu

- prawdziwe opinie klientów i zgoda na ich publikację,
- potwierdzenie numeru WhatsApp,
- nagranie z obiektu firmy do hero (opcjonalnie),
- logo w wersji wektorowej (obecne jest powiększone z małego pliku 294 × 40 px).
