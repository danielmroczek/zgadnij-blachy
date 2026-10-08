// Generator wyróżnika pojazdu wg § 30 ust. 2 pkt 1 rozporządzenia
// Dz.U. 2024 poz. 1709 oraz odmian z załącznika nr 12.
//
// - Wyróżnik województwa: 1 litera, wyróżnik powiatu: 1 lub 2 litery
//   (kod rejestracji ma odpowiednio 2 lub 3 znaki łącznie).
// - Powiat jednoliterowy (kod 2-znakowy): wyróżnik pojazdu = 5 znaków.
// - Powiat dwuliterowy (kod 3-znakowy): wyróżnik pojazdu = 4 znaków.
// - Litery wyróżnika pojazdu: bez B, D, I, O, Z (§ 31 ust. 1).
// - Każdy wynik zawiera odmianę (etykietę z tabeli rysunków 9-26), do
//   wykorzystania przy renderowaniu odstępów.

export const LETTERS = 'ACEFGHJKLMPRSTUWXY'.split('');
export const DIGITS = '0123456789'.split('');

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randOf = (arr) => arr[randInt(0, arr.length - 1)];

const digits = (n, { min, max }) =>
  String(randInt(min, max)).padStart(n, '0');

const letter = () => randOf(LETTERS);

// Układy dla powiatu jednoliterowego (wyróżnik pojazdu 5-znakowy)
const ONE_LETTER_PATTERNS = [
  { label: '2L+5C', build: () => digits(5, { min: 1, max: 99999 }) },
  { label: '2L+4C,1L', build: () => digits(4, { min: 1, max: 9999 }) + letter() },
  {
    label: '2L+3C,2L',
    build: () => {
      const [a, b] = [letter(), letter()];
      return digits(3, { min: 1, max: 999 }) + a + b;
    },
  },
  {
    label: '2L+1C,1L,3C',
    build: () => {
      const c = randInt(1, 9);
      return c + letter() + digits(3, { min: 1, max: 999 });
    },
  },
  {
    label: '2L+1C,2L,2C',
    build: () => {
      const c = randInt(1, 9);
      const [a, b] = [letter(), letter()];
      return c + a + digits(2, { min: 1, max: 99 }) + b;
    },
  },
];

// Układy dla powiatu dwuliterowego (wyróżnik pojazdu 4-znakowy), łącznie
// z odmianami 5-znakowymi z tablicy rys. 9: 3L+5C (w. 12), 3L+4C,1L (w. 13),
// 3L+3C,2L (w. 14). Odmiana 3L+5C (491,6 mm członów) mieści się na tablicy
// tylko przy zmniejszonych odstępach — obsługuje to style.css przez
// .plate[data-variant='3L+5C']; pozostałe mieszczą się w standardowych.
const TWO_LETTER_PATTERNS = [
  { label: '3L+4C', build: () => digits(4, { min: 1, max: 9999 }) },
  {
    label: '3L+3C,1L',
    build: () => digits(3, { min: 1, max: 999 }) + letter(),
  },
  {
    label: '3L+2C,2L',
    build: () => {
      const [a, b] = [letter(), letter()];
      return digits(2, { min: 1, max: 99 }) + a + b;
    },
  },
  {
    label: '3L+1L,3C',
    build: () => letter() + digits(3, { min: 1, max: 999 }),
  },
  {
    label: '3L+1C,1L,2C',
    build: () => {
      const c = randInt(1, 9);
      const a = letter();
      return c + a + digits(2, { min: 1, max: 99 });
    },
  },
  {
    label: '3L+2C,1L,1C',
    build: () => {
      const [a, b] = [randInt(1, 9), randInt(1, 9)];
      return digits(2, { min: 1, max: 99 }) + letter() + a;
    },
  },
  {
    label: '3L+1C,1L,1C,1L',
    build: () => {
      const [c, d] = [randInt(1, 9), randInt(1, 9)];
      const [a, b] = [letter(), letter()];
      return c + a + b + d;
    },
  },
  {
    label: '3L+2L,2C',
    build: () => {
      const [a, b] = [letter(), letter()];
      return a + b + digits(2, { min: 1, max: 99 });
    },
  },
  {
    label: '3L+5C',
    build: () => digits(5, { min: 1, max: 99999 }),
  },
  {
    label: '3L+4C,1L',
    build: () => digits(4, { min: 1, max: 9999 }) + letter(),
  },
  {
    label: '3L+3C,2L',
    build: () => {
      const [a, b] = [letter(), letter()];
      return digits(3, { min: 1, max: 999 }) + a + b;
    },
  },
];

/**
 * Generuje wyróżnik pojazdu dla danego kodu rejestracji.
 * @param {string} code - kod rejestracji pozycji (np. "SB", "WPR", "DJ")
 * @returns {{suffix: string, odmiana: string}} wyróżnik pojazdu i odmiana
 */
export function generateVehicleSuffix(code) {
  // Powiat dwuliterowy => kod 3-znakowy (województwo + 2 litery)
  const patterns = code.length >= 3 ? TWO_LETTER_PATTERNS : ONE_LETTER_PATTERNS;
  const pattern = randOf(patterns);
  return { suffix: pattern.build(), odmiana: pattern.label };
}

/**
 * Składa pełny numer rejestracyjny: wyróżnik powiatu + wyróżnik pojazdu.
 * @param {string} code - kod rejestracji pozycji
 * @returns {{full: string, powiatCode: string, suffix: string, odmiana: string}}
 */
export function generatePlateText(code) {
  const { suffix, odmiana } = generateVehicleSuffix(code);
  return { full: code + suffix, powiatCode: code, suffix, odmiana };
}
