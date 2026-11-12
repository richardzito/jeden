# Żybura Nieruchomości: strona oferty z spacerem 3D (demo)

Strona pokazowa jednej oferty: **2 pokoje, 53,5 m², ul. Jana Kazimierza 28, Warszawa Wola (Odolany)**.
Źródło: https://zyburanieruchomosci.pl/oferty-nieruchomosci/na-sprzedaz-zielone-zadbane-osiedle-2-pokoje-535-m%c2%b2-2-balkony-garaz/

## Uruchomienie

Otwórz `index.html` w przeglądarce. Działa też z dysku (`file://`). Spacer 3D pobiera three.js 0.160 z jsDelivr, więc potrzebuje internetu. Bez internetu albo bez WebGL pokazuje zdjęcie salonu.

## Układ strony

1. **Hero:** spacer 3D (makieta, spacer, rzut) z konfiguratorem. Zakładki: wnętrze (obecnie, po odświeżeniu, puste), ściany, podłoga, kuchnia, wyburzanie ścian. Koszt zmian liczy się na bieżąco.
2. **Realizacje:** 9 transakcji ze strony biura. Karuzelę można przeciągać myszą.
3. **Usługi i proces:** sprzedaż, kupno, wynajem, home staging oraz 5 kroków współpracy.
4. **Opinie:** ocena 5,0 i 42 opinie w Google oraz 4 przykładowe opinie.
5. **FAQ:** 6 pytań.
6. **Zakończenie:** CTA na zdjęciu osiedla.
7. **Stopka**

Dwa CTA powtarzają się w każdej sekcji: telefon 696 512 833 i „Umów prezentację”. Na telefonie jest też dolny pasek CTA. Strona ma widżet WhatsApp z gotową wiadomością, do której dołącza się wersja z konfiguratora.

## Co jest prawdziwe, a co poglądowe

| Element | Źródło |
| --- | --- |
| Cena, metraż, piętro, rok, czynsz, garaż, opis | ogłoszenie |
| Zdjęcia mieszkania, osiedla, wizualizacje | ogłoszenie |
| Logo, zdjęcie agentki, realizacje, usługi, licencja | strona zyburanieruchomosci.pl |
| Ocena 5,0 / 42 opinie | profil Google biura (stan z dnia przygotowania) |
| **Treść 4 opinii** | **wymyślona, do podmiany na prawdziwe opinie z Google** |
| **Układ pomieszczeń w 3D** | **poglądowy: ogłoszenie nie ma rzutu, układ ułożono z metraży i zdjęć** |
| **Koszty zmian w konfiguratorze** | **orientacyjne stawki rynkowe (Warszawa 2026)** |
| **Ściany do wyburzenia** | **założenie: ściany działowe; wymaga opinii konstruktora** |
| Formularz „Umów prezentację” | demo: nic nie wysyła |

## Pliki

- `index.html`: strona
- `assets/css/style.css`: style (Antonio + Jost, czerń i grafit marki na bieli)
- `assets/js/data.js`: dane oferty, pomieszczeń, konfiguratora, zdjęć i realizacji
- `assets/js/tour3d.js`: spacer 3D (three.js: cienie, światło z okien, okluzja otoczenia, odbicia z wnętrza, wyburzanie ścian sprężyną z pyłem)
- `assets/js/tour-pano.js`: widok za oknem (zdjęcie podwórka z ogłoszenia)
- `assets/js/main.js`: konfigurator, zdjęcia, karuzela, FAQ, WhatsApp, umawianie

## Przed publikacją

- Podmień 4 opinie na prawdziwe z Google (`index.html`, sekcja `#opinie`).
- Podłącz formularz do poczty lub CRM (`main.js`, obsługa `submit`).
- Uzupełnij linki do Facebooka, Instagrama i YouTube w stopce.
- Jeśli biuro ma rzut mieszkania, popraw prostokąty pomieszczeń w `data.js` i ściany w modelu 3D.
