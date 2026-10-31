// Jednorazowy probe wysokości pól odpowiedzi: liczy etykiety wszystkich
// możliwych odpowiedzi quizu (powiaty z puli + ich propozycje) i sprawdza,
// czy najdłuższa mieści się w stałej wysokości pola (--answer-min-h
// z public/style.css) przy najgorszym layoucie.
//
// Użycie:
//   node script/probe-odpowiedzi.js [--dist public/dist/quiz-data.json] [--font 16] [--pad-y 20]
//
// Pomiar szerokości tekstu robi przeglądarka (Playwright + canvas.measureText)
// — metryki 1:1 ze stylem quizu (font system-ui). Probe symuluje zawijanie
// w dostępnej szerokości kolumny i porównuje wysokość z limitem = 2 linie +
// padding pionowy.
//
// Wynik → konsola; jeśli wyjdą 3 linie / przekroczenie limitu, złagodnij próg
// .answer-long (public/js/quiz.js) albo zwiększ --answer-min-h (public/style.css).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const args = { dist: 'public/dist/quiz-data.json', font: 16, padY: 20 };
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z-]+)$/i);
  if (m) args[m[1]] = process.argv[++i];
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(join(root, args.dist), 'utf8'));

// — formatAnswer z public/js/quiz.js (musi pozostać w synchronizacji)
function formatAnswer(nazwa, info) {
  if (info && info.typ === 'miasto') return `${nazwa} (miasto)`;
  return `${info?.siedziba ?? nazwa} (p. ${nazwa})`;
}

// — pełny zbiór etykiet: powiaty z puli + dystraktory (propozycje), bez duplikatów
const byName = new Map();
for (const rej of Object.values(data.rejestracje)) {
  if (rej.typ === 'służba') continue;
  if (rej.nazwa && !byName.has(rej.nazwa)) byName.set(rej.nazwa, rej);
  for (const n of rej.propozycje ?? []) {
    if (!byName.has(n)) byName.set(n, null); // siedziba dociągnięta niżej
  }
}
for (const [nazwa, rej] of byName) {
  if (!rej?.siedziba) {
    byName.set(nazwa, Object.values(data.rejestracje)
      .find((r) => r.nazwa === nazwa && r.siedziba) ?? { siedziba: nazwa });
  }
}
const labels = [...byName.keys()].map((nazwa) => formatAnswer(nazwa, byName.get(nazwa)));

// — najgorsze layouty: (a) telefon 1 kolumna (wąski ekran),
//                      (b) grid 2×2 tuż nad progiem 480px
// .app: max-width 640px, padding 1rem z każdej strony.
const MOBILE_COL_W = 320;  // klasa telefonu iPhone SE (viewport ~375 px)
const GRID_COL_W = 214;    // połowa .app minus połowa gap przy 480 px
const LINE_H = Math.round(args.font * 1.2); // line-height normalny ≈ 1.2
const MAX_H = 2 * LINE_H + args.padY;       // stała wysokość: 2 linie + pady

console.log(`font=${args.font}px, lineHeight=${LINE_H}, pad-y=${args.padY} → limit=${MAX_H}px (2 linie + pady)`);
console.log(`etykiet do sprawdzenia: ${labels.length}`);

// — cały pomiar i symulacja zawijania w przeglądarce (metryki 1:1 z quizem);
//   zwraca: rozkład linii per layout × wariant fontu + TOP-10 najdłuższych
const analyze = async (fontPx) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(({ labels, fontPx, MOBILE_COL_W, GRID_COL_W }) => {
    const measureText = (ctx, s) => ctx.measureText(s).width;
    const run = (ctx) => {
      const lines = (text, maxW) => {
        let rows = 1, line = '';
        for (const w of text.split(/\s+/)) {
          const cand = line ? `${line} ${w}` : w;
          if (measureText(ctx, cand) <= maxW) line = cand;
          else { if (line) rows += 1; line = w; }
        }
        return rows;
      };
      const out = {};
      for (const [name, colW] of [['mobile-1col', MOBILE_COL_W], ['grid-2x2', GRID_COL_W]]) {
        const dist = new Map();
        const top = [];
        for (const label of labels) {
          const rows = lines(label, colW);
          dist.set(rows, (dist.get(rows) ?? 0) + 1);
          top.push({ label, rows });
        }
        top.sort((a, b) => b.rows - a.rows);
        out[name] = {
          dist: [...dist.entries()].sort((a, b) => a[0] - b[0]),
          top: top.slice(0, 10),
          worst: top[0]?.rows ?? 0,
        };
      }
      return out;
    };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontPx}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const normal = run(ctx);
    ctx.font = `13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const small = run(ctx);
    return { normal, small };
  }, { labels, fontPx, MOBILE_COL_W, GRID_COL_W });
  await browser.close();
  return result;
};

// — rozkład + TOP-10 dla fontu normalnego i małego (klasa .answer-long)
const { normal, small } = await analyze(args.font);
for (const [label, res, fontPx] of [['font normalny', normal, args.font], ['font mały (.answer-long)', small, 13]]) {
  for (const [layout, data] of Object.entries(res)) {
    const colW = layout === 'mobile-1col' ? MOBILE_COL_W : GRID_COL_W;
    console.log(`\n=== ${label}, layout ${layout} (szer. kolumny ${colW}px) ===`);
    console.log('rozkład linii:', data.dist.map(([r, n]) => `${r} linii: ${n}`).join(', '));
    console.log('TOP-10 najdłuższych:');
    for (const { label: l, rows } of data.top) console.log(`  ${rows} linii — ${l}`);
  }
}

// — werdykt: czy przy foncie normalnym 2 linie wystarczą na najgorszy layout?
const worstRowsOverall = Math.max(normal['mobile-1col'].worst, normal['grid-2x2'].worst);
const worstRowsSmall = Math.max(small['mobile-1col'].worst, small['grid-2x2'].worst);
console.log(`\n--- werdykt ---`);
console.log(`font normalny: najgorszy ${worstRowsOverall} linii; font 13px: najgorszy ${worstRowsSmall} linii`);
console.log(`limit stałej wysokości = 2 linie + pady = ${MAX_H}px (przy font ${args.font}px)`);
console.log(worstRowsOverall <= 2
  ? '✅ OK — stała wysokość --answer-min-h wystarcza'
  : `⚠ najdłuższe etykiety potrzebują ${worstRowsOverall} linii przy font ${args.font}px →`);
console.log(worstRowsSmall <= 2
  ? '✅ KLASA .answer-long (13px) SPOKAJA — 2 linie wystarczą dla wszystkich etykiet'
  : '❌ nawet font 13px nie mieści się w 2 liniach — zwiększ limit wysokości');

console.log('\nWniosek: pole odpowiedzi ma STALĄ wysokość (2 linie + pady), niezależnie');
console.log('od długości etykiety — layout nie podskakuje między pytaniami.');
