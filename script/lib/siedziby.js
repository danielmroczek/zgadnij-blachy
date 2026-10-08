// Moduł danych: siedziby władz powiatów.
//
// Dane są WBUDOWANE (script/lib/siedziby-data.js) — brak zależności od
// zewnętrznego pliku txt. Zwraca tablicę [{ nazwa, siedziba, typ, wojewodztwo }].
//
// Źródło danych: wykaz gmin i powiatów wchodzących w skład województw
// (Obwieszczenie Prezesa Rady Ministrów z 22.06.2001, M.P. 2001 poz. 325),
// zaktualizowany o zmiany podziału (szczegóły w siedziby-data.js).

import { SIEDZIBY_POWIATOW } from './siedziby-data.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Końcówki nazw województw (16 szt.).
const VOIV_SUFFIX = /(skie|ckie|ńskie|dzkie|ońskie|yckie|awskie)$/i;

// Rozpoznawanie powiatu ziemskiego: wystarczający jest zestaw realnie
// występujących końcówek (-icki, -ecki, -awski itd. zawierają się w nich)
// plus dwa wyjątki z dwuczłonowymi nazwami.
const POWIAT_SUFFIXES = ['ski', 'cki', 'ński', 'dzki', 'yński'];
const POWIAT_EXCEPTIONS = ['łódzki wschodni', 'warszawski zachodni'];
const isPowiatZiemski = (s) => {
  const n = s.toLowerCase();
  return POWIAT_EXCEPTIONS.includes(n) || POWIAT_SUFFIXES.some((x) => n.endsWith(x));
};

// Buduje listę powiatów z wbudowanych danych.
// Wpis danych: ["bolesławiecki", "Bolesławiec"] (powiat ziemski)
//           albo ["Wrocław"] (miasto na prawach powiatu).
function buildEntries() {
  const out = [];
  for (const [wojewodztwo, wpisy] of Object.entries(SIEDZIBY_POWIATOW)) {
    for (const wpis of wpisy) {
      if (wpis.length === 2) {
        const [nazwa, siedziba] = wpis;
        out.push({ nazwa, siedziba, typ: 'powiat', wojewodztwo: cap(wojewodztwo) });
      } else {
        const [nazwa] = wpis;
        out.push({ nazwa, siedziba: nazwa, typ: 'miasto', wojewodztwo: cap(wojewodztwo) });
      }
    }
  }
  return out;
}

// Zwraca posortowaną tablicę powiatów z wbudowanych danych,
// z twardą walidacją kompletności podziału (314 + 66 = 380, 16 województw).
export function loadSiedziby() {
  const entries = buildEntries();

  const ziemskie = entries.filter((e) => e.typ === 'powiat').length;
  const grodzkie = entries.filter((e) => e.typ === 'miasto').length;
  const wojewodztwa = new Set(entries.map((e) => e.wojewodztwo));
  if (wojewodztwa.size !== 16 || ziemskie !== 314 || grodzkie !== 66
    || entries.length !== 380) {
    throw new Error(
      `Wbudowane dane siedzib są niekompletne: województwa=${wojewodztwa.size} (oczekiwane 16), `
      + `powiaty ziemskie=${ziemskie} (oczekiwane 314), `
      + `miasta na prawach powiatu=${grodzkie} (oczekiwane 66), razem=${entries.length} (oczekiwane 380).`
    );
  }
  console.log(`Siedziby: ${entries.length} powiatów (${wojewodztwa.size} województw, `
    + `${ziemskie} ziemskich + ${grodzkie} grodzkich)`);

  return entries.slice().sort((a, b) =>
    (a.wojewodztwo || '').localeCompare(b.wojewodztwo || '', 'pl')
    || a.nazwa.localeCompare(b.nazwa, 'pl'));
}