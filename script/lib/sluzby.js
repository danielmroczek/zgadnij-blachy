// Moduł danych: tablice "służbowe" (specjalne) — wyróżniki służb i wojska.
//
// Akty prawne (ELI API, zweryfikowane 2026-10):
//   - Dz.U. 2023 poz. 1776 (MON): wyróżnik Sił Zbrojnych = U + jedna z wielkich
//     liter (bez O i U) + wyróżnik pojazdu. § 6 ust. 4: przyporządkowanie
//     drugiej litery do typu pojazdu "określa wojskowy organ rejestrujący" —
//     NIE jest regulowane w akcie (stąd ta sama nazwa dla wszystkich U*).
//   - Dz.U. 2023 poz. 1777 (MON): wyróżnik HM dla SKW i SWW.
//   - Dz.U. 2025 poz. 1326 (MSWiA): HB, HP, HK, HA, HW, HC — aktualny akt
//     ws. pojazdów służb (uchylił Dz.U. 2023 poz. 1778 od 1.10.2025).
//     W ELI tylko PDF (textHTML: false) — tekst wyciągany pdf-parse.
//
// UWAGA: akty podają wyłącznie litery służb (pierwsze dwie litery numeru).
// Wyróżniki jednostek trzeciej litery (HPA = KG Policji, HPA–HPZ komendy,
// HCA–HCR izby KAS itd.) NIE są regulowane prawem powszechnym — nie ma ich
// tutaj. Wszystkie wpisy dostają `dodatkowe: true` (zbieżnie z tablicami
// "dodatkowymi" powiatów: też poza domyślną pulą quizu) i typ 'służba'.

import { PDFParse } from 'pdf-parse';

const ELI_API = 'https://eli.gov.pl/api/acts';

const sygnatura = (eliId) => {
  const [, rok, poz] = eliId.split('/');
  return `Dz.U. ${rok} poz. ${poz}`;
};

// Normalizacja tekstu: HTML -> czysty tekst (encje i znaczniki), stłoczone
// białe znaki — te same akty potrafią pisać "Celno Skarbowej" (HTML) i
// "Celno-Skarbowej" (PDF).
function normalizeText(raw) {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// ELI: tekst HTML, a gdy akt nie ma HTML (textHTML: false, np. Dz.U. 2025/1326)
// albo zwrócił pustkę — fallback do PDF (pdf-parse).
async function fetchEliText(eliId) {
  const htmlUrl = `${ELI_API}/${eliId}/text.html`;
  const res = await fetch(htmlUrl, { signal: AbortSignal.timeout(120_000) });
  if (res.ok) {
    const html = await res.text();
    if (html.trim().length > 0) {
      const parsed = normalizeText(html);
      if (parsed.length > 0) return parsed;
    }
  }
  console.log(`  (brak HTML dla ${eliId} — pobieram PDF)`);
  const pdfUrl = `${ELI_API}/${eliId}/text.pdf`;
  const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(120_000) });
  if (!pdfRes.ok) throw new Error(`Błąd pobierania PDF (${eliId}): ${pdfRes.status}`);
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const { text } = await parser.getText();
    return normalizeText(text);
  } finally {
    await parser.destroy();
  }
}

// --- definicje aktów ----------------------------------------------------------
// Nazwa wojskowa wpisowa jest jedna (§ 6 ust. 4: druga litera nie jest
// przypisana prawnie do typu pojazdu).
const NAZWA_WOJSKO = 'Siły Zbrojne Rzeczypospolitej Polskiej';

const AKTY = [
  // Wojsko: kod = U + druga litera z listy § 6 ust. 3 pkt 2 lit. a
  {
    eli: 'DU/2023/1776',
    extract(text) {
      const m = text.match(/wielkich\s+liter:\s*((?:[A-Z],\s*)+[A-Z])/);
      if (!m) throw new Error(`${this.eli}: nie znaleziono listy liter wyróżnika Sił Zbrojnych (§ 6)`);
      const litery = [...new Set(m[1].split(',').map((s) => s.trim()).filter((s) => /^[A-Z]$/.test(s)))];
      // W akcie 23 litery (bez O i U; Q nie występuje w alfabecie polskim)
      if (litery.length !== 23) {
        throw new Error(`${this.eli}: oczekiwano 23 liter wyróżnika wojskowego, znaleziono ${litery.length} [${litery.join(', ')}]`);
      }
      return litery.map((l) => ({ kod: `U${l}`, nazwa: NAZWA_WOJSKO }));
    },
  },

  // SKW/SWW: jednowyróżnikowy akt
  {
    eli: 'DU/2023/1777',
    extract(text) {
      const m = text.match(/Wyróżnik\s+dla\s+służb\s+SKW\s+i\s+SWW\s+stanowią\s+litery\s+([A-Z]{2})/);
      if (!m) throw new Error(`${this.eli}: nie znaleziono wyróżnika HM (§ 4)`);
      return [{ kod: m[1], nazwa: 'Służba Kontrwywiadu Wojskowego i Służba Wywiadu Wojskowego' }];
    },
  },

  // Służby cywilne/mundurowe: pary "HB – dla Służby Ochrony Państwa; ..." (§ 5 ust. 3)
  {
    eli: 'DU/2025/1326',
    extract(text) {
      const anchor = text.indexOf('wyróżniki służb');
      const scope = anchor === -1 ? text : text.slice(anchor);
      const pairs = [...scope.matchAll(/([A-Z]{2})\s*[–−-]\s*dla\s+([^;.]{3,120})/g)];
      if (!pairs.length) throw new Error(`${this.eli}: nie znaleziono par litera–służba (§ 5 ust. 3)`);
      return pairs.map(([, kod, nazwa]) => ({ kod, nazwa: nazwa.trim() }));
    },
  },
];

// Zwraca { meta: { akty: [...] }, sluzby: { kod: { nazwa, typ, dodatkowe, akt } } }
export async function fetchSluzby() {
  console.log(`▸ Tablice służbowe: ${AKTY.map((a) => sygnatura(a.eli)).join(', ')}`);
  const t0 = Date.now();
  const sluzby = {};
  const aktyMeta = [];

  for (const akt of AKTY) {
    const text = await fetchEliText(akt.eli);
    const wpisy = akt.extract(text);
    for (const w of wpisy) {
      if (sluzby[w.kod]) {
        console.warn(`  ⚠ ${w.kod}: duplikat między aktami (${sluzby[w.kod].akt} vs ${sygnatura(akt.eli)}) — pomijam`);
        continue;
      }
      sluzby[w.kod] = {
        nazwa: w.nazwa,
        typ: 'służba',
        dodatkowe: true,
        akt: sygnatura(akt.eli),
      };
    }
    console.log(`  ✓ ${sygnatura(akt.eli)}: ${wpisy.length} wyróżników — ${wpisy.map((w) => w.kod).join(', ')}`);
    aktyMeta.push({ sygnatura: sygnatura(akt.eli), eli: akt.eli });
  }

  console.log(`Tablice służbowe łącznie: ${Object.keys(sluzby).length} wyróżników (${Date.now() - t0} ms)`);
  return {
    meta: {
      opis:
        'Tablice służbowe (wyróżniki służb i wojska). Akty podają wyłącznie litery wyróżnika służby; '
        + 'wyróżniki jednostek (HPA = KG Policji, HCA–HCR izby KAS itp.) nie są regulowane prawem powszechnym. '
        + 'Przyporządkowanie drugiej litery wojskowej (U*) do typu pojazdu określa wojskowy organ rejestrujący (§6 ust.4).',
      akty: aktyMeta,
    },
    sluzby,
  };
}