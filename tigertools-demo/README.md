# Tiger Tools — demo sklepu (wersja 2, po spotkaniu)

To wersja poglądowa sklepu Tiger Tools + TITAN do pokazania właścicielowi. Obejmuje 12 punktów ustalonych na spotkaniu.

Strona jest napisana w statycznym HTML/CSS/JS, bez kroku budowania. Jedyna biblioteka to Three.js do 3D, ładowana z CDN. Postawienie sklepu na docelowej platformie (Sky-Shop / Shoper) i integracje (WAPRO, WF-Mag) są poza tym demo i zostają dla informatyka.

## Jak otworzyć

- **Folder / ZIP:** rozpakuj ZIP („Wyodrębnij wszystkie”) i kliknij dwa razy `index.html`. Nie otwieraj pliku ze środka ZIP-a.
- **Jeden plik:** `tigertools-demo.html` zawiera wszystkie podstrony, zdjęcia i dane. Można go wysłać mailem lub przez WhatsApp i otworzyć bez rozpakowywania. Linki między podstronami, przycisk „wstecz” i koszyk działają tak samo jak w folderze.
- Internet jest potrzebny do fontu (Google Fonts) i do 3D (Three.js z CDN). Bez internetu reszta działa, a zamiast modelu 3D widać zdjęcie.

## Jak prezentować

Po prawej na dole, nad ikoną WhatsApp, jest okrągły przycisk **„Zakres 12”**. Po kliknięciu:

- wysuwa się lista 12 punktów ze spotkania, każdy z linkiem „Zobacz”,
- przy elementach strony pojawiają się pomarańczowe numerki z numerem punktu.

Ponowne kliknięcie albo Esc wyłącza ten tryb.

Proponowana ścieżka (ok. 5 minut):

1. **Strona główna, baner 3D:**
   - przełącz długość 31 → 61 cm, głębokość 15/30 mm i „Z rękojeścią”;
   - cena, symbol i stan w sztukach zmieniają się na żywo;
   - „Zobacz w akcji” pokazuje gięcie blachy.
2. **Wyszukiwarka:** wpisz „kle” lub „zgrzew”. Podpowiedzi pojawiają się od pierwszej litery, ułożone według liczby wejść (przy każdym produkcie widać liczbę wyświetleń).
3. **Kafel „Tygrys”:** prowadzi na podstronę zestawów i podświetla zestaw „Tygrys”. „Zestaw do koszyka” dodaje cały zestaw.
4. **Kategorie:** kafle ze zdjęciami. Na liście produktów widać:
   - drzewo kategorii i podkategorii, filtr marki i sortowanie;
   - produkty doładowujące się przy przewijaniu, bez stron.
5. **Karta produktu:**
   - stan w sztukach i liczba wyświetleń;
   - opis i parametry;
   - pod opisem „Podobne produkty”: 5 w rzędzie, strzałki w lewo i w prawo.
6. **Koszyk w jednym kroku:**
   - dane, dostawa InPost, płatność (BLIK / Przelewy24 / PayPal) i „Zamawiam i płacę” na jednym ekranie;
   - błędy pokazują się przy polach;
   - po zamówieniu pojawia się potwierdzenie.

## 12 punktów → gdzie je widać

| # | Punkt ze spotkania | Gdzie w demo |
| --- | --- | --- |
| 1 | Kolejność po wejściach | Wyszukiwarka (podpowiedzi według wejść), sekcja „Najczęściej oglądane” na stronie głównej, domyślne sortowanie listy „Najpopularniejsze” |
| 2 | Kategorie i podkategorie jak w dekarski-sklep.pl | Menu, kafle kategorii, drzewo na liście produktów (`kategoria.html`) |
| 3 | Konfiguracja: długość, głębokość, rękojeść | Baner 3D na stronie głównej i karta zaginadła BDZ (`produkt.html?id=bdz`) |
| 4 | „Zestaw Tygrys” → zestawy firmy | Kafel na stronie głównej → `zestawy.html#tygrys`; 8 przykładowych zestawów z liczbą zamówień |
| 5 | Przewijanie bez końca | Lista produktów: po 12 produktów, kolejne doładowują się same |
| 6 | Koszyk w jednym kroku | `koszyk.html` |
| 7 | Podobne produkty pod opisem | Karta produktu, sekcja „Podobne produkty” |
| 8 | Liczba sztuk | „Na stanie: N szt.” na kartach produktów, w karcie produktu i w konfiguratorze; mało sztuk = kolor pomarańczowy |
| 9 | WAPRO, Sky-Shop, Shoper | Pominięte zgodnie z ustaleniem |
| 10 | Tylko Tiger Tools + TITAN | 59 produktów: 28 Tiger Tools, 31 TITAN; inne marki usunięte |
| 11 | Dane TITAN ze strony TITAN | Nazwy, zdjęcia, opisy i ceny z titan-zgrzewarki.pl |
| 12 | Opisy z dekarski-sklep.pl | Patrz „Skąd są dane”: strona blokuje automatyczne kopiowanie, więc opisy są z katalogu i strony TITAN |

Z poprzedniej wersji zostają: „Dach w 3D” (zakupy według miejsca na dachu, zestaw −10%), konto firmowe −20%, „Zostaw numer — oddzwonimy”, karta PDF, newsletter i baner cookies.

## Skąd są dane

- **Produkty Tiger Tools:** z katalogu PDF od klienta. Stąd pochodzą:
  - nazwy, symbole, ceny i ceny przed promocją;
  - opisy i parametry;
  - zdjęcia, wycięte z katalogu na przezroczyste tło.
- **Produkty TITAN:**
  - ze strony titan-zgrzewarki.pl (publiczna lista produktów sklepu) pochodzą nazwy, zdjęcia, opisy i ceny;
  - ceny z katalogu PDF mają pierwszeństwo, jeśli produkt jest w katalogu;
  - 3 produkty TITAN są tylko w katalogu (HADES PRO, dysza 20 mm/90°, tester-scyzoryk) i mają zdjęcia z katalogu.
- **Opisy z dekarski-sklep.pl nie zostały skopiowane.** Strona blokuje automatyczne pobieranie (zabezpieczenie Cloudflare). Kopię opisów trzeba zrobić ręcznie albo dostać od klienta. Pod każdym opisem jest dopisek o źródle. Docelowe opisy poprawi osoba od SEO.
- **Logo:** z plików od klienta. Wersja ciemna na jasne tła, jasna na ciemne.
- **Model 3D zaginadła BDZ:** zrobiony według zdjęć z katalogu. Ma szlifowaną stalową płytę, otwory, nity i grawer z logo. Wersja BDZR ma rękojeść.

Wymyślone na potrzeby demo — **do potwierdzenia z klientem**:

- **Drzewo kategorii.** Główne działy pochodzą z dekarski-sklep.pl. Podkategorie są próbne: część potwierdzona w wynikach wyszukiwania, reszta to robocze nazwy.
- **Dane sprzedażowe i magazynowe:**
  - liczby wyświetleń produktów, które ustalają kolejność, docelowo ze statystyk sklepu;
  - stany magazynowe w sztukach, docelowo z WF-Mag lub WAPRO;
  - liczby zamówień przy zestawach.
- **Zestawy.** Ich skład, nazwy i ceny to przykłady. Docelowo zestawy składa firma na podstawie tego, co klienci najczęściej kupują razem.
- **Ceny BDZ:**
  - wersje 15/30 mm mają tę samą cenę co 20/40 mm;
  - wersja 81 cm kosztuje 320 zł;
  - BDZR kosztuje 320 zł (46 cm) i 389 zł (61 cm).
- **Dostawa i rabaty:**
  - dostawa: Paczkomat 12,99 zł, kurier 16,99 zł, darmowa od 299 zł;
  - rabat B2B −20% i poziomy −25% / −30%.

## Struktura

| Plik | Co to jest |
| --- | --- |
| `index.html` | Strona główna: baner 3D z konfiguratorem BDZ, kafle („Tygrys” → zestawy), 12 kategorii ze zdjęciami, najczęściej oglądane, zestawy, marki Tiger Tools / TITAN, Dach w 3D, konto firmowe, newsletter |
| `kategoria.html` | Lista produktów: drzewo kategorii, podkategorie ze zdjęciami, marka, sortowanie, przewijanie bez końca. Parametry: `?cat=`, `?q=`, `?brand=tiger` / `titan`, `?sort=pop` / `asc` / `desc` / `name` |
| `produkt.html` | Karta produktu (`?id=…`); dla `?id=bdz` konfigurator i model 3D. Pod opisem są podobne produkty |
| `zestawy.html` | Zestawy narzędziowe (`#tygrys`, `#kleszcze-3`, …) |
| `koszyk.html` | Zamówienie w jednym kroku |
| `konto.html`, `kontakt.html`, `dla-firm.html` | Podstrony-zaślepki |
| `assets/js/data.js` | Dane: kategorie, 59 produktów, 8 zestawów, ceny i stany BDZ |
| `assets/js/shop.js` | Koszyk, wyszukiwarka z podpowiedziami, ceny B2B, koszyk jednokrokowy, modale, cookies, tryb prezentacji |
| `assets/js/catalog.js` | Lista produktów, karta produktu, podobne produkty, zestawy |
| `assets/js/tool3d.js` | Konfigurator i model 3D zaginadła BDZ / BDZR |
| `assets/js/roof3d.js` | Dach w 3D |
| `assets/css/shop.css` | Wygląd. Kolor marki z logo: pomarańczowy `#f46d14`, czerń `#161616` |
| `assets/img/p/` | Zdjęcia produktów |
| `assets/img/zestawy/` | Kolaże zestawów |

Stan demo (koszyk, liczba wejść, tryb B2B, zgody cookies) zapisuje się w przeglądarce (`localStorage`). Żeby zacząć od zera, wyczyść dane strony.

## Uwagi do wdrożenia

- Kolejność po wejściach liczy się z liczby wyświetleń karty produktu. W demo to przykładowe liczby plus Twoje wejścia w tej przeglądarce. W sklepie dane przyjdą ze statystyk platformy.
- Stany w sztukach przyjdą z integracji magazynowej; w demo pola i wygląd są gotowe.
- Przy ustawieniu „ogranicz ruch” w systemie animacje są wyłączone, a model 3D stoi nieruchomo.
