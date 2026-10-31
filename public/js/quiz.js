// Alpine.js — bez build stepu: CDN + Alpine.data zarejestrowane na „alpine:init”.
// Ten plik ładujemy PRZED skryptem CDN Alpine (moduły i defer wykonują się
// w kolejności występowania w dokumencie), żeby listener zdążył się podpiąć.
import { generatePlateText } from './plate.js';
import { VERDICTS } from './verdicts-data.js';

const QUESTIONS_PER_GAME = 10;
const DISTRACTOR_COUNT = 3;  // poprawna odpowiedź + tyle dystraktorów
const AUTO_NEXT_MS = 3000;   // automatyczne przejście po odpowiedzi

let autoTimer = null;        // uchwyt setInterval odliczania
let answeringTime = 0;       // skumulowany czas odpowiedzi (bez pauz między pytaniami)
let answeringStart = 0;      // performance.now() początku bieżącego segmentu odpowiedzi
let verdictTimer = null;     // uchwyt setTimeout fade-inu oceny (anulowany przy resecie)

// Dane ładowane raz w init() — nie potrzebują reaktywności, więc siedzą
// poza stanem komponentu (zamiast być proxyjowanymi przez Alpine bez powodu).
const data = {
  rejestracje: null,   // quiz-data.json -> rejestracje
  powiatyByName: null, // nazwa powiatu -> { siedziba, typ } (z wpisów rejestracji)
  pool: [],            // pula kodów z odpowiedziami (bez Warszawy)
};

document.addEventListener('alpine:init', () => {
  Alpine.data('quiz', () => ({
    /* ---------- stan ---------- */
    loading: true,
    error: '',
    phase: 'loading',          // 'loading' | 'quiz' | 'summary'
    score: 0,
    questionNo: 0,
    total: QUESTIONS_PER_GAME,
    locked: false,
    correctIndex: -1,
    prefix: '',
    suffix: '',
    variant: '',
    options: Array.from({ length: DISTRACTOR_COUNT + 1 }, () => ({ text: '', state: '' })),
    status: '',
    remaining: null,           // sekundy do auto-przejścia (null = nie liczy)
    showNext: false,
    wojewodztwo: '',          // województwo bieżącej tablicy — widoczne dopiero po odpowiedzi
    showWojewodztwo: false,
    // podsumowanie
    summaryScore: 0,
    summaryTime: '',
    summaryRate: '',
    summaryVerdict: '',      // ocena opisowa (1 zdanie, wg wyniku)
    showVerdict: false,      // fade-in oceny 0,4 s po wyniku

    /* ---------- dane ---------- */

    async init() {
      try {
        const json = await loadJson('dist/quiz-data.json');
        data.rejestracje = json.rejestracje;
        data.powiatyByName = Object.fromEntries(
          Object.values(json.rejestracje)
            .filter((r) => r.siedziba)
            .map((r) => [r.nazwa, { siedziba: r.siedziba, typ: r.typ, wojewodztwo: r.wojewodztwo }])
        );

        // domyślnie pomijamy tablice "dodatkowe" (2. litera województwa);
        // przełącznik w ustawieniach połączy je z powrotem z pulą.
        // Tablice służbowe (typ 'służba') są wykluczone ZAWSZE — nie mają
        // powiatu ani propozycji, więc nie nadają się do pytania.
        const uwzglednijDodatkowe =
          localStorage.getItem('zgadnij-blachy:dodatkowe') === '1';
        data.pool = Object.entries(json.rejestracje)
          .filter(([, v]) => v.typ !== 'służba' && (uwzglednijDodatkowe || !v.dodatkowe))
          .map(([code, v]) => ({
            code,
            nazwa: v.nazwa,
            wojewodztwo: v.wojewodztwo,
            propozycje: v.propozycje ?? [],
          }));
        this.startGame();

        // Debug: /?koniec=N → od razu ekran podsumowania z wynikiem N
        // (do ręcznych podglądów ekranu końcowego). Działa TYLKO na hoście
        // lokalnym — na produkcji parametr jest ignorowany.
        const isLocalhost =
          location.hostname === 'localhost' ||
          location.hostname === '127.0.0.1' ||
          location.hostname === '[::1]';
        const koniec = isLocalhost
          ? new URLSearchParams(location.search).get('koniec')
          : null;
        if (koniec !== null) {
          this.score = Math.min(Math.max(Number.parseInt(koniec, 10) || 0, 0), QUESTIONS_PER_GAME);
          this.endGame();
        }
      } catch (err) {
        this.error = `Nie udało się wczytać danych: ${err.message}`;
      } finally {
        this.loading = false;
      }
    },

    /* ---------- pochodne (gettery Alpine) ---------- */

    get roundLabel() {
      return `${this.questionNo}/${this.total}`;
    },

    get isLastQuestion() {
      return this.questionNo >= QUESTIONS_PER_GAME;
    },

    // etykieta przycisku bez licznika — jedno źródło prawdy dla obu wariantów
    get nextButtonLabel() {
      return this.isLastQuestion ? 'Pokaż wynik' : 'Następna tablica';
    },

    /* ----------mechanika gry ---------- */

    // pauza: domknij bieżący segment odpowiedzi (między pokazaniem pytania a odpowiedzią)
    pauseClock() {
      if (answeringStart) {
        answeringTime += performance.now() - answeringStart;
        answeringStart = 0;
      }
    },

    startGame() {
      this.score = 0;
      this.questionNo = 0;
      answeringTime = 0;
      answeringStart = 0;
      this.stopAutoNext();
      clearTimeout(verdictTimer); // wstrzymaj ewentualny fade-in ze starej gry
      this.showVerdict = false;
      this.phase = 'quiz';
      this.nextQuestion();
    },

    endGame() {
      this.pauseClock(); // domknij ostatni segment (czas nad 10. pytaniem)
      const elapsed = answeringTime / 1000;
      this.summaryScore = this.score;
      this.summaryTime = formatTime(elapsed);
      this.summaryRate = formatRate(this.score, elapsed);
      // ocena opisowa: deterministycznie wg punktów (Q4) — los z 3 wariantów progu
      const warianty = VERDICTS[Math.min(Math.max(this.score, 0), VERDICTS.length - 1)];
      this.summaryVerdict = warianty[Math.floor(Math.random() * warianty.length)];
      this.showVerdict = false;
      this.phase = 'summary';
      // „beat”: wynik wjeżdża od razu, ocena dopiero po 0,4 s (Q7)
      clearTimeout(verdictTimer);
      verdictTimer = setTimeout(() => { this.showVerdict = true; }, 400);
      this.$nextTick(() => this.$refs.restart?.focus());
    },

    nextQuestion() {
      answeringStart = performance.now(); // czas nad tym pytaniem liczy się od teraz
      this.questionNo += 1;
      this.renderQuestion();
    },

    /* ----------losowanie ---------- */

    pickQuestion() {
      const entry = data.pool[Math.floor(Math.random() * data.pool.length)];
      // pool przynosi propozycje razem z kodem (quiz-data.json: rejestracje[kod].propozycje)
      const distractors = shuffle(entry.propozycje).slice(0, DISTRACTOR_COUNT);
      return { entry, distractors };
    },

    formatAnswer(nazwa) {
      const info = data.powiatyByName[nazwa];
      if (info && info.typ === 'miasto') return `${nazwa} (miasto)`;
      return `${info?.siedziba ?? nazwa} (p. ${nazwa})`;
    },

    /* ---------- render ---------- */

    renderQuestion() {
      const { entry, distractors } = this.pickQuestion();
      this.locked = false;

      const options = [
        this.formatAnswer(entry.nazwa),
        ...distractors.map((n) => this.formatAnswer(n)),
      ];
      const shuffled = shuffle(options.map((text, i) => ({ text, correct: i === 0 })));
      this.correctIndex = shuffled.findIndex((o) => o.correct);
      this.options = shuffled.map((o) => ({ text: o.text, state: '' }));

      // prefix = wyróżnik województwa+powiatu, suffix = wyróżnik pojazdu;
      // .plate-chars (flex space-between) rozstawia: prefix | nalepka | suffix
      const { suffix, odmiana } = generatePlateText(entry.code);
      this.variant = odmiana;
      this.prefix = entry.code;
      this.suffix = suffix;
      this.wojewodztwo = entry.wojewodztwo;
      this.showWojewodztwo = false;
      this.showNext = false;
      this.status = '';
    },

    /* ---------- interakcja ---------- */

    onAnswer(index) {
      if (this.locked) return;
      this.locked = true;

      const isCorrect = index === this.correctIndex;
      this.options = this.options.map((o, i) => ({
        ...o,
        state:
          i === this.correctIndex ? 'correct'
          : i === index ? 'wrong'
          : '',
      }));

      if (isCorrect) this.score += 1;
      this.status = isCorrect ? '✅ Dobrze!' : '❌ Źle.';
      this.showWojewodztwo = true; // ujawnij województwo bieżącej tablicy

      this.showNext = true;
      this.focusNext();
      if (!this.isLastQuestion) this.startAutoNext();
    },

    focusNext() {
      this.$nextTick(() => this.$refs.next?.focus());
    },

    onNext() {
      this.stopAutoNext();
      if (this.isLastQuestion) this.endGame();
      else this.nextQuestion();
    },

    // tap/klik w dowolne miejsce poza przyciskiem „Następna” → rezygnacja z
    // auto-przejścia. pointerdown, nie click: iOS Safari w ogóle nie wysyła
    // click przy tapnięciu w nieinteraktywny element — pointerdown odpala zawsze
    onPointerDown(ev) {
      if (!autoTimer) return;
      if (ev.target instanceof Element && ev.target.closest('#next')) return;
      this.stopAutoNext();
    },

    /* ---------- automatyczne przejście ---------- */

    startAutoNext() {
      this.pauseClock(); // stop — pauza trwa od teraz
      let remaining = AUTO_NEXT_MS / 1000;
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          this.stopAutoNext();
          this.nextQuestion();
        } else {
          this.remaining = remaining;
        }
      };
      this.remaining = remaining;
      clearInterval(autoTimer);
      autoTimer = setInterval(tick, 1000);
    },

    stopAutoNext() {
      clearInterval(autoTimer);
      autoTimer = null;
      this.remaining = null;
    },
  }));
});

/* ---------- dane ---------- */

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// <1 min -> "42,3 s", <1 h -> "2:07", dalej -> "1:05:32" (bez jednostek wyżej)
function formatTime(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (total >= 60) return `${m}:${pad(s)}`;
  return `${seconds.toFixed(1).replace('.', ',')} s`;
}

// < 0,1 pkt/s → pkt/min; < 0,1 pkt/min → pkt/godz.; inaczej pkt/s
function formatRate(punkty, seconds) {
  const perSecond = punkty / Math.max(seconds, 1e-9);
  const perMinute = perSecond * 60;
  const perHour = perSecond * 3600;
  if (perMinute < 0.1) return `${perHour.toFixed(1).replace('.', ',')} pkt/godz.`;
  if (perSecond < 0.1) return `${perMinute.toFixed(1).replace('.', ',')} pkt/min`;
  return `${perSecond.toFixed(2).replace('.', ',')} pkt/s`;
}