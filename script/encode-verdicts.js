// Kodowanie ocen opisowych: script/lib/verdicts.js -> public/js/verdicts-data.js
//
// Cel: w źródłach strony lista zdań nie leży wprost w plaintext (best-effort
// zasłonięcie — XOR stałym kluczem + base64). Schemat jest odwracalny w JS
// przeglądarki (dekoder siedzi obok danych w public/js/verdicts-data.js), więc
// to nie jest zabezpieczenie, tylko utrudnienie niechcianego podglądu.
// Edycja tekstów: zmień script/lib/verdicts.js i odpal `npm run encode-verdicts`.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERDICTS } from './lib/verdicts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'js', 'verdicts-data.js');

// Klucz stały (commitowany) — celowo: wszystkie przeglądarki mają dekodować tak samo.
const KEY = 'zgadnij-blachy';

function xxorBase64(text) {
  const bytes = Buffer.from(text, 'utf8');
  const enc = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    enc[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
  }
  return enc.toString('base64');
}

// Walidacja: dokładnie 11 progów po dokładnie 3 warianty.
if (!Array.isArray(VERDICTS) || VERDICTS.length !== 11) {
  throw new Error(`VERDICTS: oczekiwano 11 progów (0..10), jest ${VERDICTS?.length}`);
}
VERDICTS.forEach((warianty, wynik) => {
  if (!Array.isArray(warianty) || warianty.length !== 3) {
    throw new Error(`VERDICTS[${wynik}]: oczekiwano 3 wariantów, jest ${warianty?.length}`);
  }
  warianty.forEach((s, i) => {
    if (typeof s !== 'string' || !s.trim()) {
      throw new Error(`VERDICTS[${wynik}][${i}]: puste/nietekstowe zdanie`);
    }
  });
});

const encoded = VERDICTS.map((warianty) =>
  warianty.map((s) => JSON.stringify(xxorBase64(s))).join(', '),
);

const banner = `// AUTOGENEROWANY PLIK — nie edytuj ręcznie!
// Źródło prawdy: script/lib/verdicts.js (plaintext, tam edytuj zdania).
// Regeneracja po każdej zmianie: npm run encode-verdicts
// (w CI dzieje się to automatycznie przed publikacją).
// Schemat: XOR kluczem + base64 — best-effort zasłonięcie, nie szyfrowanie.

const KEY = ${JSON.stringify(KEY)};

function decode(b64) {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
  return new TextDecoder().decode(bytes);
}

// PLIK PRZECHOWUJE ZASZYFROWANE STRINGI; eksport dekoduje w locie, więc
// konsument (quiz.js) dostaje gotowy plaintext.
const ENCRYPTED = [
`;

const body = encoded
  .map((w, wynik) => `  /* ${wynik} */ [${w}],`)
  .join('\n');

const tail = '\n];\n\nexport const VERDICTS = ENCRYPTED.map((row) => row.map(decode));\n';

writeFileSync(OUT, banner + body + tail, 'utf8');
console.log(`✓ ${'public/js/verdicts-data.js'}: 11 progów × 3 warianty zakodowane.`);
