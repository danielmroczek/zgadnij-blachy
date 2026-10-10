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
const quizEl = document.getElementById('quiz');
const summaryEl = document.getElementById('summary');
const summaryScoreEl = document.getElementById('summary-score');
const summaryTimeEl = document.getElementById('summary-time');
const summaryRateEl = document.getElementById('summary-rate');
const restartBtn = document.getElementById('restart');
const scoreBarEl = document.getElementById('score-bar');
const titleEl = document.getElementById('title');

const QUESTIONS_PER_GAME = 10;

let rejestracje = null;      // quiz-data.json -> rejestracje
let powiatyByName = null;    // nazwa powiatu -> { siedziba, typ } (z wpisów rejestracji)
let pool = [];               // pula kodów z odpowiedziami (bez Warszawy)
let current = null;
let locked = false;
let score = 0;               // punkty bieżącej gry
let questionNo = 0;          // numer pytania w bieżącej grze (1..10)
const AUTO_NEXT_MS = 3000;   // automatyczne przejście po odpowiedzi
let autoTimer = null;        // uchwyt setInterval odliczania
let answeringTime = 0;       // skumulowany czas odpowiedzi (bez pauz między pytaniami)
let answeringStart = 0;      // performance.now() początku bieżącego segmentu odpowiedzi
let pauseStart = 0;          // moment zablokowania ekranu (po odpowiedzi)
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

  // domyślnie pomijamy tablice "dodatkowe" (2. litera województwa);
  // przełącznik w ustawieniach połączy je z powrotem z pulą
  const uwzglednijDodatkowe =
    localStorage.getItem('zgadnij-blachy:dodatkowe') === '1';
  pool = Object.entries(rejestracje)
    .filter(([, v]) => uwzglednijDodatkowe || !v.dodatkowe)
    .map(([code, v]) => ({
      code,
      nazwa: v.nazwa,
      propozycje: v.propozycje ?? [],
    }));
  startGame();
}

/* ----------mechanika gry ---------- */

// pauza: domknij bieżący segment odpowiedzi (między pokazaniem pytania a odpowiedzią)
function pauseClock() {
  if (answeringStart) {
    answeringTime += performance.now() - answeringStart;
    answeringStart = 0;
  }
}

function startGame() {
  score = 0;
  questionNo = 0;
  answeringTime = 0;
  answeringStart = 0;
  pauseStart = 0;
  cancelAutoNext();
  scoreEl.textContent = score;
  scoreBarEl.hidden = false;
  titleEl.hidden = false;
  summaryEl.hidden = true;
  quizEl.hidden = false;
  nextQuestion();
}

function endGame() {
  pauseClock(); // domknij ostatni segment (czas nad 10. pytaniem)
  const elapsed = answeringTime / 1000;
  scoreBarEl.hidden = true;
  titleEl.hidden = true;
  quizEl.hidden = true;
  summaryEl.hidden = false;
  summaryScoreEl.textContent = score;
  summaryTimeEl.textContent = elapsed.toFixed(1);
  summaryRateEl.textContent = (score / elapsed).toFixed(2);
  restartBtn.focus();
}

function nextQuestion() {
  answeringStart = performance.now(); // nowy segment: czas nad tym pytaniem liczy się od teraz
  questionNo += 1;
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
  roundEl.textContent = `${questionNo}/${QUESTIONS_PER_GAME}`;
}

/* ---------- interakcja ---------- */

function onAnswer(ev) {
  if (locked) return;
  locked = true;
  // klik w odpowiedź triggersuje start odliczania — zatrzymaj bąbelkowanie,
  // żeby globalny listener „anuluj auto” nie skasował go jeszcze w tym samym evencie
  ev.stopPropagation();

  const idx = Number(ev.currentTarget.dataset.index);
  const isCorrect = idx === current.correct;

  answerButtons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === current.correct) btn.classList.add('correct');
    else if (i === idx) btn.classList.add('wrong');
  });

  if (isCorrect) {
    score += 1;
    scoreEl.textContent = score;
  }

  statusEl.textContent = isCorrect ? '✅ Dobrze!' : '❌ Źle.';
  statusEl.hidden = false;

  if (questionNo >= QUESTIONS_PER_GAME) {
    nextBtn.textContent = 'Pokaż wynik';
    nextBtn.hidden = false;
    nextBtn.focus();
  } else {
    nextBtn.textContent = 'Następna tablica';
    nextBtn.hidden = false;
    nextBtn.focus();
    startAutoNext();
  }
}

/* ---------- automatyczne przejście ---------- */

function startAutoNext() {
  pauseClock(); // stop — pauza trwa od pary az
  pauseStart = performance.now();
  let remaining = AUTO_NEXT_MS / 1000;
  const updateLabel = () => {
    nextBtn.textContent = `Następna tablica (${remaining})`;
  };
  updateLabel();
  clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      cancelAutoNext();
      nextQuestion();
    } else updateLabel();
  }, 1000);
}

function cancelAutoNext() {
  clearInterval(autoTimer);
  autoTimer = null;
  // usuń zatrzymany licznik z etykiety przycisku (powrót do zwykłego stanu)
  nextBtn.textContent = questionNo >= QUESTIONS_PER_GAME ? 'Pokaż wynik' : 'Następna tablica';
}

answerButtons.forEach(btn => btn.addEventListener('click', onAnswer));
nextBtn.addEventListener('click', () => {
  cancelAutoNext();
  pauseStart = 0;
  if (questionNo >= QUESTIONS_PER_GAME) endGame();
  else nextQuestion();
});
// tap/klik w dowolne miejsce poza przyciskiem „Następna” → rezygnacja z auto-przejścia.
// pointerdown, nie click: iOS Safari w ogóle nie wysyła click przy tapnięciu
// w nieinteraktywny element (tablicę, tło, pasek wyniku) — pointerdown odpala zawsze
document.addEventListener('pointerdown', (ev) => {
  if (!autoTimer) return;
  if (ev.target instanceof Element && ev.target.closest('#next')) return;
  cancelAutoNext();
  pauseStart = 0;
});
restartBtn.addEventListener('click', startGame);

init().catch(err => {
  plateEl.hidden = true;
  statusEl.hidden = false;
  statusEl.textContent = `Nie udało się wczytać danych: ${err.message}`;
});
