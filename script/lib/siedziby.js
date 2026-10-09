// Moduł danych: siedziby władz powiatów.
//
// Dane pochodzą z BAZY JST (MSWiA, baza teleadresowa jednostek samorządu
// terytorialnego) — plik XLS pobierany z gov.pl w czasie generowania danych:
//
//   https://www.gov.pl/web/mswia/baza-jst
//   (załącznik "Baza JST", format .xls)
//
// Aby uniknąć zależności od ID załącznika (zmienia się przy aktualizacji bazy),
// skrypt najpierw pobiera stronę, wyciąga z niej link do załącznika XLS i
// pobiera go. Struktura arkusza (Arkusz1, wiersz nagłówka):
//   Kod_TERYT | nazwa_samorządu | Województwo | Powiat | typ_JST |
//   nazwa_urzędu_JST | miejscowość | Kod pocztowy | poczta | ...
// Kluczowe typy_JST:
//   P    — powiat ziemski (314); siedziba = miejscowość Starostwa Powiatowego
//   MNP  — miasto na prawach powiatu (66); siedziba = sama miejscowość
//   W    — województwo (16), GM/GW/GMW — gminy (pomijane), dzielnica — Warszawa
//
// Zwraca tablicę [{ nazwa, siedziba, typ, wojewodztwo }] z twardą walidacją
// kompletności: 314 powiatów ziemskich + 66 miast na prawach powiatu = 380
// (16 województw).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // root projektu
export const BAZA_JST_URL = 'https://www.gov.pl/web/mswia/baza-jst'; // używane też w quiz-data.js (meta.zrodla.siedziby)
const CACHE_FILE = path.join(root, 'tmp', 'baza-jst.xls'); // względem roota, nie CWD
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // tydzień — gov.pl bywa wolny, baza zmienia się rzadko

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- pobieranie -------------------------------------------------------------

function extractXlsUrl(html) {
  // Załączniki gov.pl: <a class="file-download" href=".../attachment/<uuid>" ...
  //   aria-label="... Pobierz plik ... Format: xls">
  // Link bywa względny ("/attachment/...") albo bezwzględny — łapię oba.
  const ATTACH_RE = /^(?:https?:\/\/www\.gov\.pl)?\/attachment\/[a-f0-9-]+$/i;
  const links = [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => ATTACH_RE.test(u));
  if (!links.length) throw new Error('Nie znaleziono żadnego załącznika na stronie Baza JST');
  // Zwykle są 2 załączniki (PDF i XLS) — wybieram ten z opisem "Format: xls".
  const kontekst = (url) => html.slice(Math.max(0, html.indexOf(url) - 400), html.indexOf(url) + 400);
  const xls = links.find((url) => /Format:\s*xls/i.test(kontekst(url)));
  if (!xls) {
    throw new Error(
      'Nie rozpoznano załącznika XLS (żaden nie ma opisu "Format: xls"). '
      + `Załączników na stronie: ${links.length}. Strona się zmieniła? Sprawdź: ${BAZA_JST_URL}`
    );
  }
  return xls;
}

async function downloadXls() {
  console.log(`▸ Baza JST: ${BAZA_JST_URL}`);
  const t0 = Date.now();
  const res = await fetch(BAZA_JST_URL, {
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000), // gov.pl bywa bardzo wolny, ale nie nieskończenie
  });
  if (!res.ok) throw new Error(`Błąd pobierania strony Baza JST: ${res.status}`);
  const html = await res.text();
  const xlsUrl = new URL(extractXlsUrl(html), BAZA_JST_URL).href;
  console.log(`  ✓ strona (${(html.length / 1024).toFixed(0)} kB, ${Date.now() - t0} ms), załącznik: ...${xlsUrl.slice(-16)}`);

  console.log('▸ Baza JST: pobieranie XLS (~2 MB)...');
  const t1 = Date.now();
  const resX = await fetch(xlsUrl, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (!resX.ok) throw new Error(`Błąd pobierania XLS: ${resX.status}`);
  const buf = Buffer.from(await resX.arrayBuffer());
  if (buf.length < 100_000) throw new Error(`Podejrzanie mały plik XLS (${buf.length} B) — pewnie strona błędu, nie baza`);
  console.log(`  ✓ ${(buf.length / 1024 / 1024).toFixed(2)} MB (${Date.now() - t1} ms)`);

  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, buf);
  return buf;
}

// Cache pliku (tydzień), żeby prepare-data nie pobierał gov.pl przy każdym
// uruchomieniu; po tygodniu (lub po usunięciu pliku) cache się odświeża.
async function fetchJstXls() {
  if (existsSync(CACHE_FILE)) {
    const mtime = statSync(CACHE_FILE).mtimeMs;
    if (Date.now() - mtime < CACHE_TTL_MS) {
      console.log(`▸ Baza JST: cache ${CACHE_FILE} (<7 dni), pomijam pobieranie`);
      return readFileSync(CACHE_FILE);
    }
  }
  return downloadXls();
}

// --- parsowanie -------------------------------------------------------------

// Siedziba wiersza JST. Standardowo 'miejscowość', ale w bazie zdarza się
// wiersz z pustą kolumną miejscowość (np. powiat trzebnicki) — wtedy urząd
// korygujemy przez 'poczta' (adres pocztowy urzędu = jego siedziba).
function siedzibaWiersza(r) {
  return r.miejscowość || r.poczta || null;
}

function parseRows(buf) {
  const wb = xlsx.read(buf);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const wojewodztwa = rows.filter((r) => r.typ_JST === 'W');
  const powiatyZiemskie = rows.filter((r) => r.typ_JST === 'P');
  const miasta = rows.filter((r) => r.typ_JST === 'MNP');
  console.log(`  ✓ JST: ${wojewodztwa.length} województw, ${powiatyZiemskie.length} powiatów ziemskich (P), ${miasta.length} miast na prawach powiatu (MNP)`);
  const entries = [];
  for (const r of [...miasta, ...powiatyZiemskie]) {
    const siedziba = siedzibaWiersza(r);
    if (!siedziba) {
      throw new Error(`Baza JST: brak siedziby dla "${r['nazwa_samorządu']}" (TERC ${r['Kod_TERYT']})`);
    }
    const typ = r.typ_JST === 'MNP' ? 'miasto' : 'powiat';
    entries.push({
      // miasto: własna nazwa; powiat ziemski: przymiotnikowa (kolumna Powiat).
      // Baza JST bywa niekonsekwentna w zapisie (np. "Dąbrowski", "miński ")
      // — normalizuję do lowercase + trim, żeby pasowały do nazw z rozporządzenia.
      nazwa: typ === 'miasto' ? r['nazwa_samorządu'] : (r.Powiat || '').trim().toLowerCase(),
      siedziba,
      typ,
      wojewodztwo: cap((r.Województwo || '').trim()),
    });
  }

  // Twarda walidacja kompletności podziału TERYT (314 + 66 = 380, 16 województw).
  const stat = statystyki(entries);
  if (stat.woj !== 16 || stat.ziemskie !== 314 || stat.grodzkie !== 66 || stat.razem !== 380) {
    throw new Error(
      `Baza JST niekompletna: województwa=${stat.woj} (oczekiwane 16), `
      + `powiaty ziemskie=${stat.ziemskie} (oczekiwane 314), `
      + `miasta na prawach powiatu=${stat.grodzkie} (oczekiwane 66), `
      + `razem=${stat.razem} (oczekiwane 380).`
    );
  }
  return entries;
}

// Statystyki podziału — używane raz do walidacji i raz do logu.
function statystyki(entries) {
  return {
    ziemskie: entries.filter((e) => e.typ === 'powiat').length,
    grodzkie: entries.filter((e) => e.typ === 'miasto').length,
    woj: new Set(entries.map((e) => e.wojewodztwo)).size,
    razem: entries.length,
  };
}

// Zwraca posortowaną tablicę powiatów z Bazy JST (MSWiA),
// z twardą walidacją kompletności podziału (314 + 66 = 380, 16 województw).
export async function loadSiedziby() {
  const buf = await fetchJstXls();
  const entries = parseRows(buf);

  const stat = statystyki(entries);
  console.log(`Siedziby (Baza JST): ${stat.razem} powiatów (${stat.woj} województw, `
    + `${stat.ziemskie} ziemskich + ${stat.grodzkie} grodzkich)`);

  return entries.slice().sort((a, b) =>
    (a.wojewodztwo || '').localeCompare(b.wojewodztwo || '', 'pl')
    || a.nazwa.localeCompare(b.nazwa, 'pl'));
}
