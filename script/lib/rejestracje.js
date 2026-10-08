// Moduł danych: wyróżniki rejestracyjne powiatów (Dz.U. 2024 poz. 1709).
//
// Pobiera tekst ujednolicony rozporządzenia przez ELI API i wyciąga z
// załącznika nr 13 wyróżniki województw i powiatów. Źródłem jest HTML
// (endpoint /text.html) — tabele są jednoznaczne, w przeciwieństwie do PDF.
// Zwraca mapę: pełny kod rejestracji -> { wojewodztwo, nazwa, dodatkowe? }.
//
// "dodatkowe: true" gdy powiat korzysta z DRUGIEJ litery województwa
// (np. "V" dla DOLNOŚLĄSKIE [D, V], "M" dla WIELKOPOLSKIE [P, M]).

const ELI_API = 'https://eli.gov.pl/api/acts';
const TITLE_PATTERN = /^Rozporządzenie .* w sprawie rejestracji i oznaczania pojazdów/i;

// "m.st. Warszawa" -> "Warszawa" (quiz i tak traktuje stolicę jak inne miasta
// na prawach powiatu; prefiks "m.st." to artefakt nazewnictwa urzędowego).
function normalizeNazwa(n) {
  return n.replace(/^m\.st\.\s*/i, '').trim();
}

// Znajdź najnowsze obowiązujące rozporządzenie podstawowe (nie "zmieniające").
// /text.html zwraca zawsze najnowszy tekst ujednolicony (z poprawkami).
async function findLatestAct() {
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 2024; year--) {
    const maxPages = 50; // zabezpieczenie: API ignoruje pageSize (zwraca cały rok)
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch(`${ELI_API}/DU/${year}?page=${page}`);
      if (!res.ok) throw new Error(`Błąd ELI API: ${res.status}`);
      const data = await res.json();
      const items = data.items || [];

      const chosen = items.find(
        (it) => TITLE_PATTERN.test(it.title || '') && !/zmieniające/i.test(it.title || '')
      );
      if (chosen) {
        console.log(`Znaleziono akt: ${chosen.displayAddress}`);
        console.log(`Tytuł: ${chosen.title}`);
        return chosen;
      }
    }
  }
  throw new Error('Nie znaleziono rozporządzenia w sprawie rejestracji i oznaczania pojazdów');
}

// Pełne metadane aktu (daty, status) z endpointu szczegółów ELI.
async function fetchActDetails(act) {
  const res = await fetch(`${ELI_API}/${act.ELI}`);
  if (!res.ok) throw new Error(`Błąd ELI API (szczegóły): ${res.status}`);
  return res.json();
}

function buildMeta(act, details) {
  return {
    pobrano: new Date().toISOString(),
    dokument: {
      tytuł: act.title,
      sygnatura: act.displayAddress,
      // Oficjalna strona dokumentu w Dzienniku Ustaw
      link: `https://www.dziennikustaw.gov.pl/${act.ELI}`,
      // bezpośredni link do pliku PDF (D2024 0001709 01.pdf -> D + rok + wyrównana pozycja + 01)
      'link:pdf': `https://www.dziennikustaw.gov.pl/D${details.year}${String(details.pos).padStart(7, '0')}01.pdf`,
      // tekst ujednolicony (HTML) z API ELI – zawsze najnowsza wersja z poprawkami
      'link:html': `${ELI_API}/${act.ELI}/text.html`,
      status: details.status,
      dataRozporządzenia: details.announcementDate, // data sporządzenia (w tytule aktu)
      dataOgłoszenia: details.promulgation, // publikacja w Dz.U.
      dataWejściaWŻycie: details.entryIntoForce,
      dataOstatniejZmiany: details.changeDate ? details.changeDate.slice(0, 10) : undefined,
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
  const rows = [...html.matchAll(/<tr[\s>][\s\S]*?<\/tr>/gi)].map((m) => m[0]);

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
  return result.filter((v) => v.powiaty.length);
}

// Pobiera dane z ELI API: { meta, rejestracje }
// rejestracje: { kod: { wojewodztwo, nazwa, dodatkowe? } }
export async function fetchRejestracje() {
  const act = await findLatestAct();
  const details = await fetchActDetails(act);
  const meta = buildMeta(act, details);
  const url = `${ELI_API}/${act.ELI}/text.html`;

  console.log('Pobieranie dokumentu HTML...');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Błąd pobierania HTML: ${res.status}`);
  const html = await res.text();
  console.log(`Pobrano ${html.length} znaków`);

  console.log('Ekstrakcja danych...');
  const wojewodztwa = extract(html);

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

  return { meta, rejestracje };
}