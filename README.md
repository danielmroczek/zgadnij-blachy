# plate-guesser 🚗

Quiz: patrzysz na losową tablicę rejestracyjną (wzór polski, flat) i zgadujesz, **z którego powiatu pochodzi** — wybierasz jedną z 4 odpowiedzi (poprawna siedziba + 3 trudne dystraktory).

## Uruchomienie

Strona jest w pełni statyczna (`public/`), ale używa `fetch()`, więc trzeba ją serwować przez HTTP:

```bash
npx serve public
# albo
python -m http.server -d public 8000
```

Otwórz wskazany adres w przeglądarce. (Dla ciekawych: `file://` nie zadziała — fetch JSON-ów jest blokowany przez CORS, aplikacja pokaże czytelny komunikat błędu.)

## Deploy na GitHub Pages

Pipeline CI: `.github/workflows/deploy.yml`. Przy każdym pushu na `main`
(uruchamia się też ręcznie z zakładki *Actions* → *Run workflow*):

1. `npm run prepare-data` — generuje `public/dist/quiz-data.json`,
2. `npm run download:font` — pobiera font z adresu podanego w **sekrecie `FONT_URL`**,
3. publikuje katalog `public/` na GitHub Pages.

— Zasoby (JSON, font) ładowane są ścieżkami względnymi — strona działa zarówno
pod `https://<user>.github.io/<repo>/`, jak i w root domeny, bez konfiguracji.

### Ustawienia do zrobienia raz w repozytorium

1. **Sekret z adresem czcionki** — *Settings → Secrets and variables → Actions →
   New repository secret*, nazwa: `FONT_URL`, wartość: pełny URL do pliku `.zip`
   z fontem (ten sam, co w lokalnym `.env`). Bez niego krok "Pobieranie czcionki"
   zakończy się błędem.
2. **Włączenie Pages z workflow** — *Settings → Pages → Build and deployment →
   Source: **GitHub Actions*** (nie "Deploy from a branch").

Adres strony: `https://<user>.github.io/<repo>/` (jeśli repo nie jest w root
domeny — workflow sam ustawi właściwy base URL).

## Dane (`public/dist/quiz-data.json`)

Cały komplet danych quizu jest generowany jednym poleceniem:

```bash
npm run prepare-data
# warianty: node script/prepare-data.js --top 5 [--out inna/sciezka.json]
```

Źródłem wyróżników jest rozporządzenie Dz.U. 2024 poz. 1709 pobierane ze
**stałego adresu ELI** (`eli.gov.pl/api/acts/DU/2024/1709/text.html`).
ELI publikuje tekst **pierwotny** (nie ujednolicony), ale nowelizacje są
nanoszone **automatycznie**: skrypt czyta z metadanych ELI wykaz „Akty
zmieniające”, pobiera PDF każdego z nich i parsuje frazę zmieniającą kolumnę 5
tabeli załącznika nr 13 (np. „po literach „WR” dodaje się przecinek i litery
„WW””) — zero zahardkodowanych kodów. Gdy się pojawi nowa nowelizacja,
`npm run prepare-data` sam ją wciągnie (log pokaże każdy naniesiony kod).

Siedziby powiatów pochodzą z **Bazy JST (MSWiA)** — bazy teleadresowej
jednostek samorządu terytorialnego ([gov.pl/web/mswia/baza-jst](https://www.gov.pl/web/mswia/baza-jst)).
Skrypt pobiera stronę, wyciąga link do załącznika XLS i parsuje go: powiaty
ziemskie mają typ `P` (siedziba = miejscowość urzędu, starostwo powiatowe),
miasta na prawach powiatu — typ `MNP` (siedziba = sama miejscowość). Wynik jest
twardo walidowany: **314 powiatów ziemskich + 66 miast na prawach powiatu
= 380**, 16 województw. Pobrany XLS jest cache'owany w `tmp/baza-jst.xls`
(ważny tydzień), żeby generowanie nie uderzało w gov.pl za każdym razem.

Plik ma jedną mapę `rejestracje` — każdy kod niesie komplet danych (dla kodów
tego samego powiatu dane się powtarzają, to zamierzona redundancja):

```jsonc
{
  "meta": { "wygenerowano", "liczby": { ... }, "zrodla": { ... } },
  "rejestracje": {
    "WM": {
      "nazwa": "miński", "wojewodztwo": "MAZOWIECKIE",
      "dodatkowe": true,                // tablice "dodatkowe" (2. litera województwa)
      "akt": "Dz.U. 2024 poz. 1709",    // akt, w którym kod pierwszy raz się pojawił
                                        //   (nowelizacja, jeśli kod został dodany później)
      "siedziba": "Mińsk Mazowiecki", "typ": "powiat",
      // typ: "powiat" | "miasto" (miasto na prawach powiatu)
      "propozycje": ["makowski", ...]   // proponowane odpowiedzi (dystraktory)
    }
  }
}
```

## Struktura

```
public/
  index.html              # markup quiza
  style.css               # styl flat: tablica 520×114, euroband, nalepka legalizacyjna
  js/
    plate.js              # generator wyróżnika pojazdu wg §30 Dz.U. 2024 poz. 1709
    quiz.js               # logika: ładowanie danych, pytania, punkty (localStorage)
  dist/
    arklatrs.ttf          # font tablic rejestracyjnych
    quiz-data.json        # JEDEN plik danych: mapa rejestracji z pełnym kompletem
script/                   # skrypty Node
  prepare-data.js         # główny skrypt: generuje public/dist/quiz-data.json
                          #   ("npm run prepare-data"; --top/--out)
  lib/
    rejestracje.js        # wyróżniki ze stałego URL ELI (Dz.U. 2024 poz. 1709)
    nowelizacje.js        # automat: PDF-y aktów zmieniających -> kody zał. 13
    siedziby.js           # siedziby z Bazy JST (MSWiA) + walidacja 314+66=380
    odpowiedzi.js         # proponowane odpowiedzi (dystraktory) per kod
    quiz-data.js          # skleja dane i zapisuje quiz-data.json
  download-font.js        # pobiera font (zip) do dist/; URL z env FONT_URL
                          #   ("npm run download:font", przez dotenv-cli z pliku .env)
tmp/                      # prototypy (m.in. render tablicy w PIL)
CONTEXT.md                # glosariusz (język wspólny projektu)
```

## Zasady generatora tablic (`plate.js`)

- Litery: `ACEFGHJKLMPRSTUWXY` (bez wykluczonych §31: B, D, I, O, Z).
- Wzory wyróżnika pojazdu wg §30: dla wyróżnika 2-literowego wzory 4-znakowe, dla 3-literowego — 5-znakowe (np. `2L+5C`, `3L+3C,2L`), w tym odmiana `3L+5C` (rys. 9, wiersz 12).
- Tablica jednorzędowa standardowa: proporcje 520:114 (Załącznik 12).
- Nalepka legalizacyjna ma „benzynowy” gradient hologramu, pozycja liczona z długości wyróżnika powiatu.
- Odmiany 8-znakowe (`3L+5C`, `3L+4C,1L`, `3L+3C,2L` — rys. 9, wiersze 12–14) renderowane są ze zmniejszonymi odstępami proporcjonalnymi do deficytu szerokości (tab. odmian: b 12→8, c 40→35) — CSS w `style.css` pod `[data-variant=…]`.

## Proponowane odpowiedzi (`quiz-data.json` → `rejestracje[*].propozycje`)

Dystraktory wybierane są wg podobieństwa **wyróżnika powiatu** do nazwy siedziby (strategia `prefiks`):

- litery wyróżnika powiatu szukane w nazwie siedziby kandydata (punktacja za trafienie,
  za pozycję 0 nazwy i za zgodną pozycję),
- duży bonus za wspólny prefiks (JA → Jarosław, Jasin, Janów),
- bonus za to samo województwo (kandydaci z innych województw też wchodzą, niżej),
- poprawna odpowiedź wykluczona.

Quiz losuje 3 dystraktory z top-5 kandydatów kodu (konfiguracja: `--top N`).
Wag scoringu znajdziesz na górze `script/lib/odpowiedzi.js`.

Nazwa stolicy jest normalizowana: z rozporządzenia przychodzi „m.st. Warszawa”,
w danych i quizie występuje po prostu „Warszawa” (jak każde miasto na prawach powiatu).

## Znane ograniczenia

- Punkty trzymane w `localStorage` pod kluczem `pg-score`.
