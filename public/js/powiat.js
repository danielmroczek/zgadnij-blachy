// Wspólna tożsamość powiatu i etykieta odpowiedzi.
//
// Używane przez quiz w przeglądarce oraz skrypty Node (prepare-data, probe),
// żeby klucz i format etykiety nie rozjechały się między modułami.
//
// Tożsamość powiatu to para (województwo, nazwa) — nazwy powiatów dublują się
// między województwami (np. "grodziski" w mazowieckim i wielkopolskim), więc
// klucz po samej nazwie podstawiałby siedzibę jednego powiatu drugiemu.

export const powiatKey = (wojewodztwo, nazwa) =>
  `${(wojewodztwo ?? '').toLowerCase()}|${nazwa.toLowerCase()}`;

export const sameWojewodztwo = (a, b) =>
  (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

// Indeks powiatów z wpisów rejestracji — pierwszy wpis dla danego klucza
// (ten sam powiat ma wiele kodów, więc wartości są równoważne).
export function buildPowiatIndex(rejestracje) {
  const index = new Map();
  for (const rej of Object.values(rejestracje)) {
    if (!rej?.siedziba) continue;
    const k = powiatKey(rej.wojewodztwo, rej.nazwa);
    if (!index.has(k)) index.set(k, rej);
  }
  return index;
}

export function formatAnswer(nazwa, info) {
  if (info?.typ === 'miasto') return `${nazwa} (miasto)`;
  return `${info?.siedziba ?? nazwa} (p. ${nazwa})`;
}
