// Moduł: automatyczne parsowanie nowelizacji tabeli wyróżników (załącznik nr 13).
//
// ELI nie publikuje tekstu ujednoliconego — /text.html zwraca tekst pierwotny.
// Wszystkie zmiany wprowadzają rozporządzenia zmieniające (wykaz w metadanych
// ELI: details.references["Akty zmieniające"]). Te akty mają tylko PDF,
// więc: pobieramy PDF -> pdf-parse -> regex na frazę zmiany tabeli w kolumnie 5.
//
// Wzorzec zmiany (uzgodniona fraza ustawodawcy, oba akty dotychczas identyczne):
//   „w wierszu dotyczącym powiatu <nazwa> po literach „XY” dodaje się
//    przecinek i litery „AB, CD””
// Obsługiwany też wariant skreślenia: „skreśla się litery „AB””.

import { PDFParse } from 'pdf-parse';

const ELI_API = 'https://eli.gov.pl/api/acts';

// Odmiana nazw powiatów: dane są w mianowniku ("tarnogórski"), PDF używa
// dopełniacza ("powiatu tarnogórskiego"). Sprowadzamy obie formy do wspólnego
// rdzenia obcinając końcówki przymiotnikowe (deklinacja lepska niż heurystyka
// prefiksowa — ta myliła "tarnogórski" z "tarnowskim"/"tarnowskimi"-typu).
//
//   mianownik:  tarnogórski / chełmiński / lubelski / międzyzdrojski
//   dopełniacz: tarnogórskiego / chełmińskiego / lubelskiego / międzyzdrojskiego
//
// Obcięcie: dopełniacz kończy się "skiego/ckiego/dzkiego/niejszego..." — zawsze
// "...skiego"-rodzina; rdzeń = ciąg przed "skiego". Mianownik = ciąg przed
// "ski". Hmm — ale "tarnogórski" = "tarnogór"+"ski", a "tarnogórskiego" =
// "tarnogórs"+"kiego": rdzeń dopełniacza zawiera "s", mianownika nie.
// Dlatego porównujemy z WYRÓWNANIEM: dopełniacz traci "skiego" (-6 znaków),
// a z rdzenia dopełniacza obcinamy jeszcze końcowe "s"/"c" (od "ski"→"skiego").
function toStem(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// mianownik ("bieruńsko-lędziński", "tarnogórski") -> kanoniczny rdzeń
// łącznik traktujemy jak separator członów (PDF też pisze z łącznikiem)
function stemNominative(s) {
  return toStem(s)
    .split('-')
    .map((cz) => cz.replace(/(ski|cki|dzki|żki)$/u, ''))
    .join('-');
}

// dopełniacz ("tarnogórskiego") -> kanoniczny rdzeń ("tarnogór"):
// obcinamy "...skiego"-rodzinę (jedyny wariant końcówki: skiego/ckiego/dzkiego),
// potem końcowe "sk"/"ck"/"dz" (od drugi "ski"→"skiego")
function stemGenitive(s) {
  return toStem(s)
    .split('-')
    .map((cz) =>
      cz
        .replace(/(skiego|ckiego|dzkiego)$/u, '') // tarnogórskiego -> tarnogórsk
        .replace(/(sk|ck|dz)$/u, '')
    ) // tarnogórsk -> tarnogór
    .join('-');
}

function namesMatch(pdfName, dataName) {
  return stemGenitive(pdfName) === stemNominative(dataName);
}

// 'DU/2025/939' -> 'Dz.U. 2025 poz. 939' (format jak sygnatura w meta.dokument)
// eksport przydaje się też rejestracje.js (sygnatura rozporządzenia podstawowego)
export function sygnatura(eliId) {
  const [, rok, poz] = eliId.split('/');
  return `Dz.U. ${rok} poz. ${poz}`;
}

async function fetchAmendmentText(eliId) {
  const url = `${ELI_API}/${eliId}/text.pdf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Błąd pobierania PDF (${eliId}): ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const { text } = await parser.getText();
    return text;
  } finally {
    await parser.destroy();
  }
}

// Wydobywa zmiany tabeli załącznika nr 13 z tekstu rozporządzenia zmieniającego.
// Zwraca: [{ powiat, after: 'XY', add: ['AB'], remove: ['CD'] }] lub [] gdy akt
// nie rusza tej tabeli.
function parseTableAmendments(text) {
  const flat = text.replace(/\s+/g, ' ');
  const anchor = flat.search(/nr\s+13\s+do\s+rozporz\u0105dzenia\s+w\s+tabeli/i);
  if (anchor === -1) return [];
  // wyliczenie zmian kończy się na "§ 2." (lub "wchodzi w życie") — szukamy
  // w CAŁYM tekście po anchorze (okno stałej długości ucinałoby długie wyliczenia)
  const poAnchorze = flat.slice(anchor);
  const koniec = poAnchorze.search(/§\s*2\.|\.\s+wchodzi\s+w\s+życie/i);
  const scope = koniec === -1 ? poAnchorze : poAnchorze.slice(0, koniec);

  const zmiany = [];
  // "w wierszu dotyczącym powiatu <nazwa> po literach „XY” dodaje się przecinek
  //  i litery „AB, CD”"  (wariant skreślenia bez "po literach")
  const re =
    /wierszu\s+dotycz\u0105cym\s+powiatu\s+((?:[\p{L}][\p{L}-]*\s?)+?)\s+(po\s+literach\s+[\u201E"]([A-Z]{2})[\u201D"]\s+)?(dodaje\s+si\u0119\s+przecinek\s+i\s+litery|skre\u015Bla\s+si\u0119\s+litery)\s+[\u201E"]([A-Z][A-Z,\s]+?)[\u201D"]/gu;
  for (const m of scope.matchAll(re)) {
    const [, powiat, , after, opRaw, kodyRaw] = m;
    const op = /dodaje/i.test(opRaw) ? 'add' : 'remove';
    const kody = kodyRaw.split(',').map((s) => s.trim()).filter((s) => /^[A-Z]{2}$/.test(s));
    zmiany.push({ powiat: powiat.trim(), after: after || null, op, kody });
  }
  return zmiany;
}

// Nanosi zmiany na strukturę województw (z extract() w rejestracje.js).
// Twarda walidacja: powiat musi istnieć, kody muszą być sensowne.
function apply(wojewodztwa, eliId, zmiany) {
  for (const z of zmiany) {
    // powiat może się powtarzać między województwami — szukamy wśród wszystkich,
    // walidacja wg litery "po literach" rozstrzyga wieloznaczność
    const kandydaci = wojewodztwa.flatMap((v) =>
      v.powiaty.filter((p) => namesMatch(z.powiat, p.nazwa)).map((p) => ({ v, p }))
    );
    if (!kandydaci.length) {
      throw new Error(`Nowelizacja ${eliId}: nie znaleziono powiatu "${z.powiat}" w danych podstawowych`);
    }
    let wybierany = kandydaci[0];
    if (kandydaci.length > 1) {
      const disamb = z.after
        ? kandydaci.find((k) => k.p.kod.includes(z.after))
        : undefined;
      if (!disamb) {
        throw new Error(
          `Nowelizacja ${eliId}: powiat "${z.powiat}" jest niejednoznaczny (${kandydaci.map((k) => k.v.nazwa).join(', ')}), a fraza "po literach ${z.after}" nie rozstrzyga`
        );
      }
      wybierany = disamb;
    }
    const powiat = wybierany.p;
    const przed = new Set(powiat.kod);
    for (const kod of z.kody) {
      if (z.op === 'add' && !powiat.kod.includes(kod)) {
        powiat.kod.push(kod);
        // proweniencja: kod wprowadzony przez TĘ nowelizację (rejestracje.js użyje
        // tego jako "akt" wpisu; brak wpisu = kod z tekstu pierwotnego)
        (powiat.zrodlo ??= {})[kod] = sygnatura(eliId);
      }
      if (z.op === 'remove') {
        powiat.kod = powiat.kod.filter((k) => k !== kod);
        delete powiat.zrodlo?.[kod];
      }
    }
    const nowe = powiat.kod.filter((k) => !przed.has(k));
    const usuniente = [...przed].filter((k) => !powiat.kod.includes(k));
    const delta = z.op === 'add' ? `+ [${nowe.join(', ') || 'żadnych nowych'}]` : `- [${usuniente.join(', ') || 'żadnych'}]`;
    console.log(`  ✓ ${eliId}: ${delta} -> ${powiat.nazwa} (${wybierany.v.nazwa}) [${powiat.kod.join(', ')}]`);
  }
}

// Sprawdza wszystkie akty zmieniające i nanosi zmiany z PDF-ów.
// zwraca listę ELI, których zmiany udało się zastosować.
export async function applyAllAmendments(details, wojewodztwa) {
  const zmieniajace = details.references?.['Akty zmieniające'] || [];
  if (!zmieniajace.length) {
    console.log('▸ Brak rozporządzeń zmieniających (ELI nie raportuje żadnych nowelizacji)');
    return [];
  }
  console.log(`▸ Rozporządzenia zmieniające (${zmieniajace.length}): ${zmieniajace.map((a) => a.id).join(', ')}`);
  // ELI zwraca wykaz MALEJĄCO (najnowszy pierwszy); stosujemy rosnąco (najstarszy
  // najpierw), żeby skreślenia z nowszych aktów nadpisywały dodania ze starszych.
  const chronologicznie = [...zmieniajace].sort((x, y) => String(x.date).localeCompare(String(y.date)));
  console.log(`  kolejność stosowania: ${chronologicznie.map((a) => a.id).join(' -> ')}`);
  const applied = [];
  for (const a of chronologicznie) {
    const t0 = Date.now();
    const text = await fetchAmendmentText(a.id);
    const zmiany = parseTableAmendments(text);
    if (!zmiany.length) {
      // sekcja zał. 13 w tekście JEST, ale parser nic nie wyciągnął — możliwa
      // cicha utrata (nowy wzorzec frazy albo zmiana innej kolumny niż 5)
      if (/nr\s+13\s+do\s+rozporz\u0105dzenia\s+w\s+tabeli/i.test(text.replace(/\s+/g, ' '))) {
        console.warn(`  ⚠ ${a.id}: tekst WSPOMINA tabelę zał. 13, ale parser nie rozpoznał żadnej zmiany — sprawdź ręcznie! (${ELI_API}/${a.id})`);
      }
      console.log(`  • ${a.id}: nie zmienia tabeli wyróżników (zał. 13), pomijam (${Date.now() - t0} ms)`);
      continue;
    }
    apply(wojewodztwa, a.id, zmiany);
    applied.push(a.id);
  }
  return applied;
}
