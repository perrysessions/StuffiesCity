import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';

const TOTAL_QUESTIONS = 10;
let current = 0;
let sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };

export function renderMath() {
  current = 0;
  sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
  showMathQuestion();
}

function showMathQuestion() {
  if (current >= TOTAL_QUESTIONS) { endMath(); return; }
  const q = generateQuestion(state.profile.grade);
  const choices = generateChoices(q.answer);

  setView(`
    <div class="game-screen">
      ${progressBar()}
      <div class="game-question">
        <div class="question-label">🔢 What is the answer?</div>
        <div class="math-problem">${q.display}</div>
      </div>
      <div class="choices-grid choices-grid--2col">
        ${choices.map(c => `
          <button class="choice-btn choice-btn--num" onclick="pickMath(${c},${q.answer})">${c}</button>
        `).join('')}
      </div>
    </div>
  `);

  window.pickMath = (choice, correct) => {
    const isRight = choice === correct;
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.disabled = true;
      if (+btn.textContent === correct) btn.classList.add('correct');
      else if (+btn.textContent === choice && !isRight) btn.classList.add('wrong');
    });
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    setTimeout(() => { current++; showMathQuestion(); }, 900);
  };
}

function generateQuestion(grade) {
  if (grade <= 2) return addSub(grade === 1 ? 10 : 20);
  if (grade === 3) return Math.random() < 0.5 ? multiplyDiv(10) : addSub(50);
  if (grade === 4) return Math.random() < 0.4 ? multiplyDiv(12) : addSub(200);
  // grade 5
  return Math.random() < 0.3 ? percentOf() : addSub(999);
}

function addSub(max) {
  const a = rand(1, max);
  const b = rand(1, max - 1);
  const sub = Math.random() < 0.5 && a > b;
  return sub
    ? { display: `${a} − ${b} = ?`, answer: a - b }
    : { display: `${a} + ${b} = ?`, answer: a + b };
}

function multiplyDiv(max) {
  const a = rand(2, max);
  const b = rand(2, max);
  return Math.random() < 0.5
    ? { display: `${a} × ${b} = ?`, answer: a * b }
    : { display: `${a * b} ÷ ${a} = ?`, answer: b };
}

function percentOf() {
  const pcts = [10, 20, 25, 50];
  const p = pcts[rand(0, pcts.length - 1)];
  const nums = [20, 40, 50, 60, 80, 100, 200];
  const n = nums[rand(0, nums.length - 1)];
  return { display: `${p}% of ${n} = ?`, answer: (p / 100) * n };
}

function generateChoices(correct) {
  const set = new Set([correct]);
  while (set.size < 4) {
    const delta = rand(1, Math.max(3, Math.floor(correct * 0.3)));
    const sign = Math.random() < 0.5 ? 1 : -1;
    const v = correct + sign * delta;
    if (v >= 0) set.add(v);
  }
  return shuffle([...set]);
}

async function endMath() {
  await flushCoins({ game_type: 'math', ...sessionStats });
  setView(`
    <div class="game-end">
      <div class="end-emoji">🔢</div>
      <h2>Math done!</h2>
      <p>${sessionStats.correct} out of ${sessionStats.questions_answered} correct</p>
      <p class="end-coins">+${sessionStats.coins_earned} coins earned!</p>
      <div class="end-actions">
        <button class="btn btn-primary" onclick="if(window.location.hash==='#game/math'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/math'}">Play Again</button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}

function progressBar() {
  const pct = Math.round((current / TOTAL_QUESTIONS) * 100);
  return `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${current}/${TOTAL_QUESTIONS}</span>
    </div>
  `;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
