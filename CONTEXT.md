# Plate Guesser — zgadywanie powiatu po tablicy rejestracyjnej

Aplikacja webowa: pokazuje losową polską tablicę rejestracyjną (zwyczajną samochodową jednorzędową),
gracz zgaduje powiat z 4 opcji A/B/C/D.

## Language

**Wyróżnik województwa**:
Pierwsza litera numeru rejestracyjnego (np. `D` w `DW`), oznacza województwo.
_Avoid_: prefiks, pierwsza litera

**Wyróżnik powiatu**:
Druga (lub druga i trzecia) litera numeru, oznacza powiat lub miasto na prawach powiatu.
_Avoid_: kod rejestracji

**Wyróżnik pojazdu**:
Końcowy ciąg cyfr i liter po wyróżniku powiatu, tworzony wyłącznie według układów z § 30
rozporządzenia Dz.U. 2024 poz. 1709; litery z wyłączeniem B, D, I, O, Z (§ 31).
_Avoid_: numer seryjny, XXXXX

**Odmiana tablicy**:
Konkretne dozwolone ułożenie wyróżnika pojazdu (np. `3C+2L`, `1C+1L+3C`) z tabeli odmian
załącznika nr 12; determinuje proporcje i odstępy na tablicy.
_Avoid_: wzór, format numeru

**Tablica jednorzędowa**:
Standardowa tablica samochodowa 520 × 114 mm (aspect ratio 260:57), jedna linia znaków,
niebieski euroband po lewej, znak legalizacyjny między wyróżnikiem powiatu a pojazdu.
_Avoid_: zwykła tablica, duża tablica

**Siedziba powiatu**:
Miasto będące stolicą powiatu; etykieta odpowiedzi w quizie.
_Avoid_: stolica, miasto powiatowe

**Sąsiedzi**:
5 powiatów najbliższych geograficznie — koncepcja zarzucona; dystraktory pochodzą
z kandydatów podobnych siedzib.
_Avoid_: podobne, bliskie

**Dystraktor**:
Niepoprawna opcja odpowiedzi w quizie; wybierany losowo z top-5 kandydatów per kod
rejestracji wg podobieństwa wyróżnika powiatu do siedziby
(`quiz-data.json` → `rejestracje[kod].propozycje`).
_Avoid_: błędna odpowiedź, fałszywa

**Strategia prefiksowa**:
Funkcja trudności dystraktora: punkty za litery wyróżnika powiatu obecne w siedzibie
(trafienie, pozycja 0, zgodna pozycja), bonus za wspólny prefiks i województwo.
_Avoid_: leven, odległość edycyjna
