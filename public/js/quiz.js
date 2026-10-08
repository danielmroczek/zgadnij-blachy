import { generatePlateText } from './plate.js';

const plateEl = document.getElementById('plate');
const platePrefixEl = plateEl.querySelector('.plate-prefix');
const plateSuffixEl = plateEl.querySelector('.plate-suffix');
const answersEl = document.getElementById('answers');
const answerButtons = [...answersEl.querySelectorAll('.answer')];
const nextBtn = document.getElementById('next');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const roundEl = document.getElementById('round');

let rejestracje = null;      // quiz-data.json -> rejestracje
let powiatyByName = null;    // nazwa powiatu -> { siedziba, typ } (z wpisów rejestracji)
let pool = [];               // pula kodów z odpowiedziami (bez Warszawy)
let current = null;
let locked = false;
let score = Number(localStorage.getItem('pg-score') ?? 0);
let round = 0;
/* ---------- dane ---------- */

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  const data = await loadJson('dist/quiz-data.json');
  rejestracje = data.rejestracje;
  powiatyByName = Object.fromEntries(
    Object.values(rejestracje)
      .filter((r) => r.siedziba)
      .map((r) => [r.nazwa, { siedziba: r.siedziba, typ: r.typ }])
  );

  pool = Object.entries(rejestracje).map(([code, v]) => ({
    code,
    nazwa: v.nazwa,
    propozycje: v.propozycje ?? [],
  }));

  scoreEl.textContent = score;
  renderQuestion();
}

/* ----------ilosowanie ---------- */

function pickQuestion() {
  const entry = pool[Math.floor(Math.random() * pool.length)];
  // pool przynosi propozycje razem z kodem (quiz-data.json: rejestracje[kod].propozycje)
  const kandydaci = entry.propozycje;
  // losujemy 3 z top-N (domyślnie 5)
  const distractors = shuffle(kandydaci).slice(0, 3);
  return { entry, distractors };
}

function formatAnswer(nazwa) {
  const info = powiatyByName[nazwa];
  if (info && info.typ === 'miasto') return `${nazwa} (miasto)`;
  return `${info?.siedziba ?? nazwa} (p. ${nazwa})`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- render ---------- */

function renderPlate(entry) {
  const { suffix, odmiana } = generatePlateText(entry.code);
  plateEl.dataset.variant = odmiana;
  // prefix = wyróżnik województwa+powiatu, suffix = wyróżnik pojazdu;
  // .plate-chars (flex space-between) rozstawia: prefix | nalepka | suffix
  platePrefixEl.textContent = entry.code;
  plateSuffixEl.textContent = suffix;
}

function renderQuestion() {
  const { entry, distractors } = pickQuestion();
  current = { entry, correct: 0 };
  locked = false;

  const options = [
    formatAnswer(entry.nazwa),
    ...distractors.map(formatAnswer),
  ];
  const shuffled = shuffle(options.map((text, i) => ({ text, correct: i === 0 })));
  current.correct = shuffled.findIndex(o => o.correct);

  shuffled.forEach((opt, i) => {
    const btn = answerButtons[i];
    btn.textContent = opt.text;
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong');
  });

  renderPlate(entry);
  nextBtn.hidden = true;
  statusEl.hidden = true;
  round += 1;
  roundEl.textContent = round;
}

/* ---------- interakcja ---------- */

function onAnswer(ev) {
  if (locked) return;
  locked = true;

  const idx = Number(ev.currentTarget.dataset.index);
  const isCorrect = idx === current.correct;

  answerButtons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === current.correct) btn.classList.add('correct');
    else if (i === idx) btn.classList.add('wrong');
  });

  if (isCorrect) {
    score += 1;
    localStorage.setItem('pg-score', score);
    scoreEl.textContent = score;
  }

  statusEl.textContent = isCorrect ? '✅ Dobrze!' : '❌ Źle.';
  statusEl.hidden = false;
  nextBtn.hidden = false;
  nextBtn.focus();
}

answerButtons.forEach(btn => btn.addEventListener('click', onAnswer));
nextBtn.addEventListener('click', renderQuestion);

init().catch(err => {
  plateEl.hidden = true;
  statusEl.hidden = false;
  statusEl.textContent = `Nie udało się wczytać danych: ${err.message}`;
});
