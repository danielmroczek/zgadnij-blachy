# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Obie grupy, jako główni traktowani pasjonaci:

- **Pasjonaci polskich tablic rejestracyjnych** — znają kody powiatów i chcą
  testować swoją wiedzę; dla nich liczy się trudność pytań (dystraktory są
  podobne, „na granicy”) i wierność danych.
- **Przypadkowy gracz w sieci** — wpada z linku (np. Open Graph na
  Facebooku/Messengerze), gra jedną rundę 10 pytań dla ciekawości; dla niego
  liczy się zero-tarcia: brak ekranu startowego, natychmiastowa gra, czytelny
  wynik i zachęta do pobicia rekordu.

## Product Purpose

Quiz o polskich tablicach rejestracyjnych: strona pokazuje losową tablicę
(wzór polski, jednorzędową, wygenerowaną zgodnie z § 30 rozporządzenia
Dz.U. 2024 poz. 1709), a gracz zgaduje powiat, wybierając jedną z 4 odpowiedzi
(poprawna siedziba + 3 trudne dystraktory). Jedna gra = 10 pytań; sukces to
wysoki wynik i szybkie tempo — podsumowanie pokazuje punkty, czas i pkt/s.

## Positioning

Sygnaturą jest **wierność danych i jakość dystraktorów**:
- wszystkie wyróżniki powiatów pochodzą wprost z rozporządzenia (z nowelizacjami
  nanoszonymi automatycznie z metadanych ELI — zero zahardkodowanych kodów);
- siedziby z oficjalnej Bazy JST (MSWiA), walidowane do dokładnie 380 powiatów
  i 16 województw;
- dystraktory wybierane algorytmem „strategii prefiksowej” — to powiaty, których
  kody brzmią podobnie do prawdziwego, więc pytanie potyka nawet pasjonata.

Sąsiedni quiz mógłby skopiować formę (tablica + 4 przyciski), ale nie kopię
aktualnego rozporządzenia z nowelizacjami.

## Operating Context

- Gra zaczyna się **automatycznie** po wejściu na stronę — bez ekranu startowego.
- Po odpowiedzi odliczanie 3 s prowadzi do następnego pytania; kliknięcie
  poza przyciskiem je anuluje (czas oczekiwania nie wlicza się do wyniku).
- Czas gry liczony jest wyłącznie za odpowiedzi gracza.
- Zasób terminologiczny w `CONTEXT.md` (wyróżnik województwa / powiatu /
  pojazdu, odmiana tablicy, siedziba powiatu, dystraktor) jest wiążący dla
  copy produktu i kodu.

## Capabilities and Constraints

- **W 100% statyczna strona** z katalogu `public/`, bez build stepu;
  front-end to Alpine.js z CDN + moduły ES (`public/js/quiz.js`, `plate.js`).
- Dane quizu (`public/dist/quiz-data.json`) generowane skryptem
  `npm run prepare-data` (Node) z rozporządzenia (ELI) i Bazy JST; font
  tablicy pobierany skryptem `npm run download:font` (sekret `FONT_URL`).
- Deploy: GitHub Pages przez workflow `.github/workflows/deploy.yml`;
  ścieżki zasobów względne (działa w podkatalogu i w root).
- Quiz wykorzystuje wyłącznie **tablice jednorzędowe samochodowe**
  (520 × 114 mm, 260:57) — tablice podwójne, motocyklowe i służbowe
  (typ `służba`) są wykluczone z puli pytań.
- ⏳ **Otwarte:** przyszła rozbudowa modułami (np. przeglądarka tablic);
  na razie zakres = mini-gra 10 pytań. Nowe moduły projektować tak, by
  nie psuły zero-tarcia auto-startu i zachowały statyczny charakter strony.

## Brand Commitments

- Nazwa: **„Zgadnij blachy!”** (title, og:title, twitter:title — trzymać spójnie).
- Tablica jest **wiernie stylizowana realna**: euroband z gwiazdkami i „PL”,
  niebieski pas, nalepka legalizacyjna, właściwe proporcje i font — odbieganie
  od realnego wyglądu tablicy jest regresją jakości.
- Copy po polsku, ton lekki i bezpośredni („Zagraj i pobij swój rekord!”).

## Evidence on Hand

- Generowane dane: `public/dist/quiz-data.json` (mapa `rejestracje`:
  nazwa powiatu, województwo, siedziba, typ, propozycje dystraktorów).
- Dokumentacja procesu i źródeł: `README.md` (rozporządzenie ELI, Baza JST,
  wymagany wynik 314 + 66 = 380 powiatów, 16 województw).
- Słownik terminologii: `CONTEXT.md`.
- Brak własnych zrzutów, recenzji, metryk użycia ani materiałów prasowych —
  przyszła praca nie może twierdzić inaczej, dopóki nie powstaną.

## Accessibility & Inclusion

- **Responsywność jest wymogiem**: strona musi poprawnie wyświetlać się i
  obsługiwać zarówno na telefonach (wąskie ekrany, dotyk), jak i na desktopie
  (szerokie ekrany, kursor). To stały, wiążący standard dla każdego nowego
  modułu i każdej zmiany layoutu — nie jednorazowa cecha obecnego quizu.
- Realizacja w obecnym kodzie (`public/style.css`): płynna szerokość tablicy
  (`--plate-w: min(calc(100vw - 32px), 520px)` ze skalą `--mm`), siatka
  odpowiedzi 1 kolumna → 2×2 od 480 px, kolumnowe podsumowanie < 660 px,
  `100svh` dla mobilnego Safari, `touch-action: manipulation` (bez opóźnienia
  tapa), hover tylko przy `@media (hover: hover)`, dotykowe cele ≥ ~44 px.
- Przy każdej zmianie UI weryfikować render na wąskich viewportach
  (≈360–400 px) i desktopie (~1280 px+), łącznie z ekranem podsumowania
  i stanami poprawna/błędna odpowiedź.

## Product Principles

1. **Zero tarcia** — gracz gra od pierwszej sekundy; bez ekranów
   pośrednich i konfiguracji przed startem.
2. **Wierność powyżej spektaklu** — wygląd tablicy i dane muszą być zgodne
   z rzeczywistością (rozporządzenie, Baza JST); estetyka nie może ich
   zafałszować.
3. **Trudność z algorytmu, nie z losowości** — dystraktory mają nasz
   algorytm podobieństwa, nie losową pulę.
4. **Terminologia spójna** — używamy słownika z `CONTEXT.md` w copy,
   danych i kodzie.
5. **Statyczność** — bez build stepu, bez backendu; złożoność może rosnąć
   tylko skryptami do przygotowania danych.
