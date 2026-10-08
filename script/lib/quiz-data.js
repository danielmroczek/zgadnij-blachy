// Skleja dane z modułów rejestracje.js / siedziby.js / odpowiedzi.js
// i zapisuje JEDEN plik wynikowy: public/dist/quiz-data.json.
//
// Struktura:
// {
//   meta: { wygenerowano, liczy: {...}, zrodla: {...} },
//   rejestracje:   { kod: { nazwa, wojewodztwo, typ?, dodatkowe?,
//                          siedziba?, propozycje: [nazwy powiatów] } }
// }

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchRejestracje } from './rejestracje.js';
import { loadSiedziby } from './siedziby.js';
import { buildOdpowiedzi } from './odpowiedzi.js';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DIST = join(root, 'public', 'dist');

const DEFAULT_OUTPUT = join(DIST, 'quiz-data.json');

export async function buildQuizData({ top = 5, output = DEFAULT_OUTPUT } = {}) {

  console.log('=== 1/3 Rejestracje (ELI API) ===');
  const { meta: metaRej, rejestracje } = await fetchRejestracje();

  console.log('=== 2/3 Siedziby powiatów ===');
  const powiaty = loadSiedziby();

  console.log('=== 3/3 Proponowane odpowiedzi ===');
  const odpowiedzi = buildOdpowiedzi(rejestracje, powiaty, top);
  // odpowiedzi i siedziby mają te same klucze co rejestracje (nazwa powiatu) —
  // wszystko trafia bezpośrednio do wpisu kodu (dane są zduplikowane między
  // kodami tego samego powiatu, ale plik pozostaje płaski i samowystarczalny)
  const siedzibaByNazwa = new Map(powiaty.map((p) => [p.nazwa, p]));
  for (const [kod, propozycje] of Object.entries(odpowiedzi)) {
    rejestracje[kod].propozycje = propozycje;
  }

  for (const [kod, rej] of Object.entries(rejestracje)) {
    const p = siedzibaByNazwa.get(rej.nazwa);
    if (!p) {
      console.warn(`⚠ ${kod}: brak siedziby dla "${rej.nazwa}" — wpis bez siedziba/typ`);
      continue;
    }
    rej.siedziba = p.siedziba;
    rej.typ = p.typ;
  }

  const data = {
    meta: {
      wygenerowano: new Date().toISOString(),
      liczy: {
        kodyRejestracji: Object.keys(rejestracje).length,
        powiaty: siedzibaByNazwa.size,
        dodatkowe: Object.values(rejestracje).filter((r) => r.dodatkowe).length,
      },
      zrodla: {
        rejestracje: { ...metaRej.dokument },
        siedziby: 'M.P. 2001 poz. 325 (wykaz powiatów + siedziby; dane wbudowane, script/lib/siedziby-data.js)',
      },
    },
    rejestracje,
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(`Zapisano: ${output} (${Object.keys(rejestracje).length} kodów, ${powiaty.length} powiatów)`);
  return output;
}