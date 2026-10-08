// Pobiera font (zip) z adresu podanego w zmiennej środowiskowej FONT_URL
// i rozpakowuje jego zawartość do katalogu dist/.
//
// UWAGA: skrypt czyta wyłącznie process.env – nie ładuje sam pliku .env.
// Zmienne dostarcza dotenv-cli w tasku npm (patrz package.json).
//
// Użycie: npx dotenv-cli -e .env -- node ./script/download-font.js

import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import { Readable } from 'stream';
import { Extract } from 'unzipper';

const DIST_DIR = 'public/dist';

const fontUrl = process.env.FONT_URL;
if (!fontUrl) {
  console.error('Brak zmiennej środowiskowej FONT_URL (podaj adres zip z fontem).');
  process.exit(1);
}

await mkdir(DIST_DIR, { recursive: true });

console.log(`Pobieranie fontu z: ${fontUrl}`);
const res = await fetch(fontUrl);
if (!res.ok) {
  console.error(`Błąd pobierania: ${res.status} ${res.statusText}`);
  process.exit(1);
}
if (!res.body) {
  console.error('Pusta odpowiedź (brak body).');
  process.exit(1);
}

// Zweryfikuj, że to zip (podpis PK)
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
  console.error('Odpowiedź nie jest plikiem ZIP (brak sygnatury PK).');
  process.exit(1);
}

const zipPath = '.tmp-font.zip';
await writeFile(zipPath, buf);

console.log(`Rozpakowywanie do: ${DIST_DIR}/`);
await new Promise((resolve, reject) => {
  const stream = Extract({ path: DIST_DIR });
  stream.on('close', resolve);
  stream.on('error', reject);
  Readable.from(buf).pipe(stream);
});

await rm(zipPath, { force: true });

const files = await readdir(DIST_DIR);
console.log(`Rozpakowano pliki: ${files.join(', ')}`);
