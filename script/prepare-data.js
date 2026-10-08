// Przygotowuje plik danych quizu (public/dist/quiz-data.json) z kompletem:
// rejestracje (wyróżniki), powiaty (siedziby) i proponowane odpowiedzi.
// Logika żyje w modułach script/lib/*.js — ten plik tylko skleja CLI.
// Siedziby są wbudowane (script/lib/siedziby-data.js) — bez pliku wejściowego.
//
// Użycie:
//   node script/prepare-data.js [--top 5] [--out public/dist/quiz-data.json]

import { buildQuizData } from './lib/quiz-data.js';

const args = { top: 5, out: null };
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z-]+)$/i);
  if (m && process.argv[i + 1] !== undefined) args[m[1]] = process.argv[++i];
}

try {
  await buildQuizData({
    top: Number(args.top) || 5,
    ...(args.out ? { output: args.out } : {}),
  });
} catch (err) {
  console.error('Błąd:', err);
  process.exit(1);
}