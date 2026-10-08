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
// Kandydat = POWIAT (typeof: nazwa) — tożsamość opcji quizu; trudność mierzymy
// jego siedzibą. Dzięki temu grodzki i ziemski o tej samej siedzibie to dwa
// odrębne kandydaty ("Poznań (miasto)" vs "Poznań (p. poznański)"), bez
// duplikatów etykiet. Powiaty o TYCH SAMYCH nazwach w różnych województwach
// (średzki, świdnicki...) deduplikujemy: etykieta quizu i tak bierze pierwszy
// wpis, więc duplikat byłby identyczny.

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
// Zwraca { kod: [nazwa powiatu x TOP] } (bez poprawnej odpowiedzi) — quiz-data.js
// dokleja tę listę jako pole `propozycje` do wpisu rejestracji kodu.
export function buildOdpowiedzi(rejestracje, powiaty, top = 5) {
  // dedupe po nazwie powiatu (duplikaty międzywojewódzkie są naturalne,
  // ale duplikat kandydata dawałby identyczną opcję)
  const kandydaci = powiaty.filter(
    (p, i, arr) => arr.findIndex((q) => q.nazwa === p.nazwa) === i
  );

  const odpowiedzi = {};
  for (const [kod, info] of Object.entries(rejestracje)) {
    const wyroznik = kod.slice(1).toLowerCase(); // kod bez litery województwa
    const wynik = kandydaci
      .filter((p) => p.nazwa !== info.nazwa)
      .map((p) => ({
        nazwa: p.nazwa,
        score: scorePrefiks(wyroznik, p.siedziba)
          + (p.wojewodztwo === info.wojewodztwo ? W_WOJEWODZTWO : 0),
      }))
      .sort((a, b) => b.score - a.score || a.nazwa.localeCompare(b.nazwa, 'pl'));
    odpowiedzi[kod] = wynik.slice(0, top).map((x) => x.nazwa);
  }
  return odpowiedzi;
}