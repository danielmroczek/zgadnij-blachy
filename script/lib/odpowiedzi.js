// Moduł danych: proponowane odpowiedzi (dystraktory) per kod rejestracji.
//
// Trudność kandydata mierzymy podobieństwem WYRÓŻNIKA POWIATU do nazwy
// SIEDZIBY (strategia 'prefiks'):
//  - litery wyróżnika powiatu (kod bez litery województwa) szukane w nazwie
//    siedziby; bonus za trafienie pozycyjne (ta sama pozycja w nazwie)
//    i za pozycję 0;
//  - bonus za prefiks nazwy złożony z kolejnych liter wyróżnika
//    (JA → Jarosław, Jasin);
//  - bonus za to samo województwo (kandydaci z innych województw też
//    wchodzą, niżej);
//  - poprawna odpowiedź wykluczona; per kod rejestracji (Toruń ≠ toruński).
//
// Kandydat = POWIAT — tożsamość opcji quizu to PARA (województwo, nazwa);
// trudność mierzymy jego siedzibą. Dzięki temu grodzki i ziemski o tej samej
// siedzibie to dwa odrębne kandydaty ("Poznań (miasto)" vs "Poznań
// (p. poznański)"), a powiaty o TYCH SAMYCH nazwach w różnych województwach
// (grodziski, średzki, świdnicki...) pozostają osobnymi opcjami — mają różne
// siedziby, więc różne etykiety. Deduplikacja po samej nazwie gubiła jedną
// z nich i podstawiała jej siedzibę drugiej (np. WGM → Grodzisk Wielkopolski).

import { powiatKey, sameWojewodztwo } from '../../public/js/powiat.js';

// --- wagi scoringu ---
const W_TRAFIENIE = 1; // litera wyróżnika występuje gdziekolwiek w nazwie
const W_POZYCJA_0 = 2; // litera na pozycji 0 nazwy siedziby
const W_POZYCJA_ZGODNA = 1.5; // litera na tej samej pozycji co w wyróżniku
const W_WOJEWODZTWO = 1; // kandydat z tego samego województwa
const W_PREFIKS = 3; // za każdy znak wspólnego prefiksu (najsilniejszy sygnał)

function scorePrefiks(wyroznik, nazwaSiedziby) {
  const nazwa = nazwaSiedziby.toLowerCase().replace(/-/g, ' ');
  let score = 0;
  for (let i = 0; i < wyroznik.length; i++) {
    const pos = nazwa.indexOf(wyroznik[i]);
    if (pos === -1) continue;
    score += W_TRAFIENIE;
    if (pos === 0) score += W_POZYCJA_0;
    if (pos === i) score += W_POZYCJA_ZGODNA;
  }
  // prefiks: ile pierwszych liter nazwy zgadza się z kolejnymi literami wyróżnika
  let prefixLen = 0;
  for (let i = 0; i < Math.min(wyroznik.length, nazwa.length); i++) {
    if (wyroznik[i] === nazwa[i]) prefixLen += 1;
    else break;
  }
  return score + prefixLen * W_PREFIKS;
}

// rejestracje: { kod: { wojewodztwo, nazwa } }; powiaty: [{ nazwa, siedziba, typ, wojewodztwo }]
// Zwraca { kod: [{ nazwa, wojewodztwo } x TOP] } (bez poprawnej odpowiedzi) —
// quiz-data.js dokleja tę listę jako pole `propozycje` do wpisu rejestracji kodu.
// Województwo jest częścią tożsamości, bo nazwy powiatów dublują się między
// województwami (np. "grodziski" jest i w mazowieckim, i w wielkopolskim).

export function buildOdpowiedzi(rejestracje, powiaty, top = 5) {
  // dedupe po parze (województwo, nazwa) — ten sam powiat ma wiele kodów
  // rejestracji, ale jako opcja quizu występuje raz
  const widziane = new Set();
  const kandydaci = powiaty.filter((p) => {
    const k = powiatKey(p.wojewodztwo, p.nazwa);
    if (widziane.has(k)) return false;
    widziane.add(k);
    return true;
  });

  const odpowiedzi = {};
  for (const [kod, info] of Object.entries(rejestracje)) {
    const wyroznik = kod.slice(1).toLowerCase(); // kod bez litery województwa
    const kluczInfo = powiatKey(info.wojewodztwo, info.nazwa);
    const wynik = kandydaci
      .filter((p) => powiatKey(p.wojewodztwo, p.nazwa) !== kluczInfo)
      .map((p) => ({
        nazwa: p.nazwa,
        wojewodztwo: p.wojewodztwo,
        score: scorePrefiks(wyroznik, p.siedziba)
          + (sameWojewodztwo(p.wojewodztwo, info.wojewodztwo) ? W_WOJEWODZTWO : 0),
      }))
      .sort((a, b) => b.score - a.score || a.nazwa.localeCompare(b.nazwa, 'pl'));
    odpowiedzi[kod] = wynik.slice(0, top).map(({ nazwa, wojewodztwo }) => ({ nazwa, wojewodztwo }));
  }
  return odpowiedzi;
}
