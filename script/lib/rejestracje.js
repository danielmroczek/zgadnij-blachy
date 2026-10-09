// Moduł danych: wyróżniki rejestracyjne powiatów (Dz.U. 2024 poz. 1709).
//
// Pobiera rozporządzenie podstawowe ze STAŁEGO adresu ELI (Dz.U. 2024 poz. 1709)
// i wyciąga z załącznika nr 13 wyróżniki województw i powiatów. Źródłem jest HTML
// (endpoint /text.html) — tabele są jednoznaczne, w przeciwieństwie do PDF.
//
// UWAGA: /text.html zwraca TEKST PIERWOTNY aktów — ELI **nie** publikuje tu
// tekstu ujednoliconego. Nowelizacje tabeli wyróżników są wykrywane i nanoszone
// AUTOMATYCZNIE przez moduł nowelizacje.js (PDF-y aktów zmieniających z wykazu
// w metadanych ELI — zero zahardkodowanych kodów).
// Zwraca mapę: pełny kod rejestracji -> { wojewodztwo, nazwa, dodatkowe? }.
//
// "dodatkowe: true" gdy powiat korzysta z DRUGIEJ litery województwa
// (np. "V" dla DOLNOŚLĄSKIE [D, V], "M" dla WIELKOPOLSKIE [P, M]).

import { applyAllAmendments, sygnatura } from './nowelizacje.js';

const ELI_API = 'https://eli.gov.pl/api/acts';

// Rozporządzenie podstawowe: Dz.U. 2024 poz. 1709.
// Numer jest stabilny — nowelizacje nie zmieniają adresu (to zawsze ten sam akt).
// Zmiany tabeli wyróżników nanosi automatycznie moduł nowelizacje.js:
// pobiera PDF-y aktów zmieniających (wykaz z metadanych ELI) i wyciąga z nich
// kody dodawane/skreślane w kolumnie 5 tabeli załącznika nr 13.
const ACT_ELI = 'DU/2024/1709';
const DETAILS_URL = `${ELI_API}/${ACT_ELI}`;
const HTML_URL = `${DETAILS_URL}/text.html`;
const SYGNATURA_PODSTAWOWEGO = sygnatura(ACT_ELI); // "Dz.U. 2024 poz. 1709"

// "m.st. Warszawa" -> "Warszawa" (quiz i tak traktuje stolicę jak inne miasta
// na prawach powiatu; prefiks "m.st." to artefakt nazewnictwa urzędowego).
function normalizeNazwa(n) {
  return n.replace(/^m\.st\.\s*/i, '').trim();
}

// Pełne metadane aktu (daty, status) z endpointu szczegółów ELI.
async function fetchActDetails() {
  const t0 = Date.now();
  console.log(`▸ Metadane aktu: ${DETAILS_URL}`);
  const res = await fetch(DETAILS_URL);
  if (!res.ok) throw new Error(`Błąd ELI API (szczegóły): ${res.status}`);
  const details = await res.json();
  console.log(`  ✓ ${details.displayAddress} — ${details.status} (zmiana: ${details.changeDate?.slice(0, 10) || 'brak'}), ${Date.now() - t0} ms`);
  return details;
}

function buildMeta(details, appliedAmendments) {
  return {
    pobrano: new Date().toISOString(),
    dokument: {
      tytuł: details.title,
      sygnatura: details.displayAddress,
      // Oficjalna strona dokumentu w Dzienniku Ustaw
      link: `https://www.dziennikustaw.gov.pl/${details.address}`,
      // bezpośredni link do pliku PDF (D2024 0001709 01.pdf -> D + rok + wyrównana pozycja + 01)
      'link:pdf': `https://www.dziennikustaw.gov.pl/D${details.year}${String(details.pos).padStart(7, '0')}01.pdf`,
      // tekst pierwotny (HTML) z API ELI — nowelizacje nanosi nowelizacje.js
      'link:html': HTML_URL,
      status: details.status,
      dataRozporządzenia: details.announcementDate, // data sporządzenia (w tytule aktu)
      dataOgłoszenia: details.promulgation, // publikacja w Dz.U.
      dataWejściaWŻycie: details.entryIntoForce,
      dataOstatniejZmiany: details.changeDate ? details.changeDate.slice(0, 10) : undefined,
      // rozporządzenia zmieniające zastosowane przez nowelizacje.js (widoczne w quiz-data.json)
      poprawki: appliedAmendments,
    },
  };
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kod wyróżnika: 1-2 wielkie litery ASCII
const CODE_RE = /^[A-Z]{1,2}$/;

function isCodeList(s) {
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => CODE_RE.test(p));
}

function extract(html) {
  const result = [];
  const t0 = Date.now();
  const rows = [...html.matchAll(/<tr[\s>][\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  console.log(`  ✓ wierszy tabel do analizy: ${rows.length}`);

  for (const row of rows) {
    // Nagłówki tabel (np. "X | Y | βt" — współrzędne barw tablic) nie są danymi
    if (/class="[^"]*pro-thead/i.test(row)) continue;
    const cells = [...row.matchAll(/<td[\s>][\s\S]*?<\/td>/gi)].map((m) => stripTags(m[0]));
    if (!cells.length) continue;
    const filled = cells.filter((c) => c !== '');
    if (filled.length < 2) continue;

    // Nagłówek województwa: komórki to np. ["1","DOLNOŚLĄSKIE","","D, V","","D0-D9, V0-V9"]
    // -> filled: ["1","DOLNOŚLĄSKIE","D, V","D0-D9, V0-V9"]
    if (filled.length >= 4 && /^\d+$/.test(filled[0])
      && /^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ ,\-]*$/.test(filled[1])
      && isCodeList(filled[2]) && /\d/.test(filled[3])) {
      const name = filled[1];
      const kod = filled[2].split(',').map((s) => s.trim());
      console.log(`Województwo: ${name} [${kod.join(', ')}]`);
      result.push({ kod, nazwa: name, powiaty: [] });
      continue;
    }
    // Wariant: "8 OPOLSKIE | O | O0-O9" (nazwa z numerem w jednej komórce)
    if (filled.length >= 3
      && /^(?:\d+\s+)?[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ ,\-]*$/.test(filled[0])
      && isCodeList(filled[1]) && /\d/.test(filled[2])) {
      const name = filled[0].replace(/^\d+\s+/, '').trim();
      const kod = filled[1].split(',').map((s) => s.trim());
      console.log(`Województwo: ${name} [${kod.join(', ')}]`);
      result.push({ kod, nazwa: name, powiaty: [] });
      continue;
    }

    const voiv = result[result.length - 1];
    if (!voiv) continue;

    // Wiersz powiatu: ["", "", "", "nazwa", "R, Y", "ZE, ZZ, ZR", ""]
    const idx = cells.findIndex((c) => c !== '' && !/^\d+$/.test(c));
    if (idx === -1 || idx >= cells.length - 1) continue;
    const name = cells[idx];

    // Kod powiatu: pierwsza komórka za nazwą, która jest listą kodów
    // i nie jest identyczna z wyróżnikiem województwa
    let codes = '';
    for (let i = idx + 1; i < cells.length; i++) {
      if (!isCodeList(cells[i])) continue;
      const parts = cells[i].split(',').map((s) => s.trim()).filter(Boolean);
      const isVoivPrefix = parts.length === voiv.kod.length
        && parts.every((p, j) => voiv.kod[j] === p);
      if (!isVoivPrefix) {
        codes = cells[i];
        break;
      }
    }
    if (!codes) continue;

    voiv.powiaty.push({
      nazwa: name,
      kod: [...new Set(codes.split(',').map((s) => s.trim()).filter(Boolean))],
    });
  }

  for (const v of result) {
    v.powiaty = v.powiaty.filter((p) => p.nazwa && p.kod.length);
  }
  const filtered = result.filter((v) => v.powiaty.length);
  console.log(`  ✓ wyekstrahowano ${filtered.length} województw, ${filtered.reduce((s, v) => s + v.powiaty.length, 0)} wierszy powiatów (${Date.now() - t0} ms)`);
  return filtered;
}

// Pobiera dane z ELI API: { meta, rejestracje }
// rejestracje: { kod: { wojewodztwo, nazwa, dodatkowe? } }
export async function fetchRejestracje() {
  const details = await fetchActDetails();

  console.log(`▸ Pobieranie dokumentu HTML: ${HTML_URL}`);
  const t0 = Date.now();
  const res = await fetch(HTML_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Błąd pobierania HTML: ${res.status}`);
  const html = await res.text();
  console.log(`  ✓ ${(html.length / 1024).toFixed(0)} kB (${Date.now() - t0} ms)`);

  const wojewodztwa = extract(html);
  const applied = await applyAllAmendments(details, wojewodztwa);

  const rejestracje = {};
  const kolizje = [];
  for (const v of wojewodztwa) {
    for (const p of v.powiaty) {
      for (const [i, litWoj] of v.kod.entries()) {
        for (const kodPoviatowy of p.kod) {
          const pelny = litWoj + kodPoviatowy;
          const istniejacy = rejestracje[pelny];
          if (istniejacy && (istniejacy.nazwa !== p.nazwa || istniejacy.wojewodztwo !== v.nazwa)) {
            kolizje.push({ kod: pelny, istniejacy, nowy: { wojewodztwo: v.nazwa, nazwa: p.nazwa } });
            continue; // zostawiamy pierwszy wpis – nie nadpisujemy
          }
          rejestracje[pelny] = {
            wojewodztwo: v.nazwa,
            nazwa: normalizeNazwa(p.nazwa),
            // akt, w którym kod pierwszy raz się pojawił: nowelizacja (p.zrodlo)
            // albo rozporządzenie podstawowe (tekst pierwotny z /text.html)
            akt: p.zrodlo?.[kodPoviatowy] || SYGNATURA_PODSTAWOWEGO,
            // druga (i kolejne) litera województwa = tablice "dodatkowe"
            ...(i > 0 ? { dodatkowe: true } : {}),
          };
        }
      }
    }
  }
  if (kolizje.length) {
    console.warn(`UWAGA: ${kolizje.length} kolizji kodów rejestracji (ten sam kod -> różne powiaty):`);
    for (const k of kolizje) {
      console.warn(`  ${k.kod}: "${k.istniejacy.nazwa}" (${k.istniejacy.wojewodztwo}) VS "${k.nowy.nazwa}" (${k.nowy.wojewodztwo}) – pozostawiono pierwszy`);
    }
  }

  const total = Object.keys(rejestracje).length;
  const powiaty = new Set(Object.values(rejestracje).map((r) => `${r.wojewodztwo}|${r.nazwa}`)).size;
  const dodatkowe = Object.values(rejestracje).filter((r) => r.dodatkowe).length;
  console.log(`Województw: ${wojewodztwa.length}, powiatów: ${powiaty}, kodów rejestracji: ${total} (w tym "dodatkowe": ${dodatkowe})`);

  const meta = buildMeta(details, applied);
  return { meta, rejestracje };
}