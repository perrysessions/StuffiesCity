import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';
import { READING_PASSAGES } from './reading-data.js';

let passages = [];
let current = 0;
let sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };

export function renderReading() {
  const grade = state.profile.grade;
  const pool = READING_PASSAGES.filter(p => p.grade === grade);
  passages = shuffle([...pool]).slice(0, 5);
  current = 0;
  sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
  showPassage();
}

function showPassage() {
  if (current >= passages.length) { endReading(); return; }
  const p = passages[current];

  // Shuffle choices so correct answer isn't always the same position
  const correctText = p.choices[p.answer];
  const shuffledChoices = shuffle([...p.choices]);
  const correctIdx = shuffledChoices.indexOf(correctText);

  setView(`
    <div class="game-screen">
      ${progressBar()}
      <div class="reading-passage">
        <div class="question-label">📚 Read carefully, then answer</div>
        <div class="passage-text">${p.passage}</div>
      </div>
      <div class="game-question">
        <div class="passage-question">${p.question}</div>
      </div>
      <div class="choices-grid">
        ${shuffledChoices.map((c, i) => `
          <button class="choice-btn" onclick="pickReading(${i},${correctIdx})">${c}</button>
        `).join('')}
      </div>
    </div>
  `);

  window.pickReading = (idx, correctIdx) => {
    const isRight = idx === correctIdx;
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === correctIdx) btn.classList.add('correct');
      else if (i === idx && !isRight) btn.classList.add('wrong');
    });
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    setTimeout(() => { current++; showPassage(); }, 1100);
  };
}

async function endReading() {
  await flushCoins({ game_type: 'reading', ...sessionStats });
  setView(`
    <div class="game-end">
      <div class="end-emoji">📚</div>
      <h2>Reading done!</h2>
      <p>${sessionStats.correct} out of ${sessionStats.questions_answered} correct</p>
      <p class="end-coins">+${sessionStats.coins_earned} coins earned!</p>
      <div class="end-actions">
        <button class="btn btn-primary" onclick="if(window.location.hash==='#game/reading'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/reading'}">Play Again</button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}

function progressBar() {
  const pct = Math.round((current / passages.length) * 100);
  return `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${current}/${passages.length}</span>
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
