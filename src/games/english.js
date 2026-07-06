import { state } from '../state.js';
import { setView, toast } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';
import { ENGLISH_QUESTIONS } from './english-data.js';

let questions = [];
let current = 0;
let sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
let selectedItems = [];  // for 'order' type — [{word, bankIdx}]

export function renderEnglish() {
  const grade = state.profile.grade;
  const pool = ENGLISH_QUESTIONS.filter(q => q.grade === grade);
  questions = shuffle([...pool]).slice(0, 10);
  current = 0;
  sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
  showQuestion();
}

function showQuestion() {
  if (current >= questions.length) {
    endGame();
    return;
  }
  const q = questions[current];
  if (q.type === 'fill') showFill(q);
  else showOrder(q);
}

function showFill(q) {
  const shuffledChoices = shuffle([...q.choices]);
  setView(`
    <div class="game-screen">
      ${progressBar()}
      <div class="game-question">
        <div class="question-label">📖 Fill in the blank</div>
        <div class="sentence">${q.sentence}</div>
      </div>
      <div class="choices-grid">
        ${shuffledChoices.map(c => `
          <button class="choice-btn" onclick="pickFill('${c}','${q.blank}')">${c}</button>
        `).join('')}
      </div>
    </div>
  `);
  window.pickFill = (choice, correct) => {
    const isRight = choice === correct;
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.textContent === correct) btn.classList.add('correct');
      else if (btn.textContent === choice && !isRight) btn.classList.add('wrong');
    });
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    setTimeout(() => { current++; showQuestion(); }, 900);
  };
}

function showOrder(q) {
  selectedItems = [];
  const shuffled = shuffle([...q.words]);
  renderOrderView(q, shuffled);
}

function renderOrderView(q, shuffled) {
  const usedIndices = new Set(selectedItems.map(s => s.bankIdx));
  setView(`
    <div class="game-screen">
      ${progressBar()}
      <div class="game-question">
        <div class="question-label">📝 Put the words in order</div>
        <div class="order-answer" id="order-answer">
          ${selectedItems.map((s,i) => `<span class="word-chip selected" onclick="removeWord(${i})">${s.word}</span>`).join('')}
          ${selectedItems.length === 0 ? '<span class="order-placeholder">Tap words below ↓</span>' : ''}
        </div>
      </div>
      <div class="order-bank" id="order-bank">
        ${shuffled.map((w,i) => {
          const used = usedIndices.has(i);
          return `<span class="word-chip${used ? ' used' : ''}" onclick="addWord('${w}',${i})">${w}</span>`;
        }).join('')}
      </div>
      <div class="order-actions">
        <button class="btn btn-outline" onclick="clearOrder()">Clear</button>
        <button class="btn btn-primary" onclick="submitOrder('${q.words.join(' ')}')">Check ✓</button>
      </div>
    </div>
  `);

  window.addWord = (word, bankIdx) => {
    selectedItems.push({ word, bankIdx });
    renderOrderView(q, shuffled);
  };
  window.removeWord = (idx) => {
    selectedItems.splice(idx, 1);
    renderOrderView(q, shuffled);
  };
  window.clearOrder = () => {
    selectedItems = [];
    renderOrderView(q, shuffled);
  };
  window.submitOrder = (correct) => {
    const btn = document.querySelector('.order-actions .btn-primary');
    if (btn) btn.disabled = true;
    const attempt = selectedItems.map(s => s.word).join(' ');
    const isRight = attempt === correct;
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    toast(isRight ? '✅ Perfect!' : `The answer was: "${correct}"`, isRight ? 'success' : 'error');
    setTimeout(() => { current++; showQuestion(); }, 1200);
  };
}

async function endGame() {
  await flushCoins({ game_type: 'english', ...sessionStats });
  setView(`
    <div class="game-end">
      <div class="end-emoji">🎉</div>
      <h2>Great job!</h2>
      <p>${sessionStats.correct} out of ${sessionStats.questions_answered} correct</p>
      <p class="end-coins">+${sessionStats.coins_earned} coins earned!</p>
      <div class="end-actions">
        <button class="btn btn-primary" onclick="if(window.location.hash==='#game/english'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/english'}">Play Again</button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}

function progressBar() {
  const pct = Math.round((current / questions.length) * 100);
  return `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${current}/${questions.length}</span>
    </div>
  `;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
