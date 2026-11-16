# Szablon strony dewelopera nastawiony na zapytania

Strona firmy deweloperskiej z 3 inwestycjami: wyszukiwarka mieszkań, wybór piętra na wizualizacji, rzut piętra, karta lokalu z rzutem i ratą, formularz w 2 krokach. Logo, nazwy, ceny, wizualizacje i opinie są przykładowe — podmień je na swoje.

## Uruchomienie

Otwórz `index.html` w przeglądarce (działa też z dysku). Wersja w jednym pliku: `deweloper-szablon.html`.

## Co zwiększa liczbę zapytań

| Element | Po co |
| --- | --- |
| Szybka wyszukiwarka w hero z licznikiem („Pokaż 24 mieszkania”) | pierwszy klik od razu daje wynik |
| Cena **i rata** przy każdym lokalu | klient myśli ratą, nie ceną |
| Wybór piętra na wizualizacji → rzut piętra → karta lokalu | najkrótsza droga od „ładne” do „to moje” |
| Karta lokalu: rzut, historia ceny, „najniższa cena z 30 dni” przy promocji | jawność cen buduje zaufanie |
| Formularz w 2 krokach (najpierw 3 kliknięcia, potem imię i telefon) | łatwy start, mniej porzuceń |
| Formularz z kontekstem lokalu („C0.04, Brzozowa 12…”) | handlowiec od razu wie, o co chodzi |
| Pusty wynik → „Powiadom mnie” | zbiera kontakty, gdy nie ma pasującej oferty |
| Karta PDF i cennik za e-mail, okno przy próbie wyjścia (raz na sesję) | kontakt od osób, które jeszcze nie dzwonią |
| Ulubione → „Zapytaj o te mieszkania” | kilka lokali w jednym zapytaniu |
| Pasek „Zadzwoń / Zapytaj” na telefonie, telefon w nagłówku | CTA zawsze pod kciukiem |
| Zaufanie: rachunek powierniczy + DFG, odbiór z inspektorem, opinie, realizacje | odpowiada na obawy przed zakupem |
| Uczciwa rzadkość („zostały 3 mieszkania 2-pokojowe”) liczona z danych | bez fałszywych liczników i powiadomień |

## Pomiar konwersji

Każde zdarzenie trafia do `window.dataLayer` (Google Tag Manager / GA4):

- `generate_lead` — wysłany formularz (telefon albo e-mail), z polami `form`, `apt`, `rooms`, `when`, `money`
- `phone_click` — kliknięcie numeru telefonu
- `lead_open`, `lead_step2` — otwarcie formularza i przejście do 2. kroku (lejek)
- `view_item`, `view_investment`, `search`, `floor_select`, `add_to_wishlist`, `exit_intent_shown`

Konwersja = (`generate_lead` + `phone_click`) / sesje.

## Podmiana danych

- `assets/js/data.js` — firma, inwestycje, układy, ceny (lokale generują się z ustawień inwestycji; prawdziwą listę wstaw do `apartments`), realizacje, opinie, pakiety, założenia kredytu.
- `assets/img/` — wizualizacje (16:10). Obrysy pięter do wyboru na elewacji: `assets/js/polys.js` (punkty w % obrazu).
- Formularze: obsługa `submit` w `assets/js/main.js` (funkcja `leadForm`) — tu podłącz CRM albo e-mail.
