// Skleja dane z modułów rejestracje.js / siedziby.js / odpowiedzi.js
// i zapisuje JEDEN plik wynikowy: public/dist/quiz-data.json.
//
// Struktura:
// {
//   meta: { wygenerowano, liczby: {...}, zrodla: {...} },
//   rejestracje:   { kod: { nazwa, wojewodztwo, typ?, dodatkowe?,
//                          siedziba?, propozycje: [nazwy powiatów] } }
// }

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchRejestracje } from './rejestracje.js';
import { loadSiedziby, BAZA_JST_URL } from './siedziby.js';
import { buildOdpowiedzi } from './odpowiedzi.js';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DIST = join(root, 'public', 'dist');

const DEFAULT_OUTPUT = join(DIST, 'quiz-data.json');

export async function buildQuizData({ top = 5, output = DEFAULT_OUTPUT } = {}) {

  console.log('=== 1/3 Rejestracje (ELI API) ===');
  const { meta: metaRej, rejestracje } = await fetchRejestracje();

  console.log('=== 2/3 Siedziby powiatów (Baza JST MSWiA) ===');
  const powiaty = await loadSiedziby();

  console.log('=== 3/3 Proponowane odpowiedzi ===');
  const odpowiedzi = buildOdpowiedzi(rejestracje, powiaty, top);
  // odpowiedzi i siedziby mają te same klucze co rejestracje (nazwa powiatu) —
  // wszystko trafia bezpośrednio do wpisu kodu (dane są zduplikowane między
  // kodami tego samego powiatu, ale plik pozostaje płaski i samowystarczalny)
  // Join po NAZWIE nie wystarcza — 10 nazw powiatów się dubluje między
  // województwami (średzki, świdnicki, opolski…); klucz to para (wojewodztwo,
  // nazwa). ELI ma województwo UPPERCASE, JST — z wielkiej litery → lowercase.
  const klucz = (woj, nazwa) => `${woj.toLowerCase()}|${nazwa.toLowerCase()}`;
  const siedzibaByKlucz = new Map(powiaty.map((p) => [klucz(p.wojewodztwo, p.nazwa), p]));
  for (const [kod, propozycje] of Object.entries(odpowiedzi)) {
    rejestracje[kod].propozycje = propozycje;
  }

  for (const [kod, rej] of Object.entries(rejestracje)) {
    const p = siedzibaByKlucz.get(klucz(rej.wojewodztwo, rej.nazwa));
    if (!p) {
      console.warn(`⚠ ${kod}: brak siedziby dla "${rej.nazwa}" (${rej.wojewodztwo}) — wpis bez siedziba/typ`);
      continue;
    }
    rej.siedziba = p.siedziba;
    rej.typ = p.typ;
  }

  const data = {
    meta: {
      wygenerowano: new Date().toISOString(),
      liczby: {
        kodyRejestracji: Object.keys(rejestracje).length,
        powiaty: powiaty.length,
        dodatkowe: Object.values(rejestracje).filter((r) => r.dodatkowe).length,
      },
      zrodla: {
        rejestracje: { ...metaRej.dokument },
        siedziby: {
          opis: 'Baza JST (MSWiA) — baza teleadresowa jednostek samorządu terytorialnego: powiaty (typ P) i miasta na prawach powiatu (MNP), siedziba = miejscowość urzędu',
          link: BAZA_JST_URL,
        },
      },
    },
    rejestracje,
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(`Zapisano: ${output} (${Object.keys(rejestracje).length} kodów, ${powiaty.length} powiatów)`);
  return output;
}