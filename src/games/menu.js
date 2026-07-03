import { state } from '../state.js';
import { setView } from '../ui.js';

export function renderGamesMenu() {
  const grade = state.profile.grade;
  const gradeLabel = `${grade}${['st','nd','rd','th'][Math.min(grade-1,3)]} Grade`;

  setView(`
    <div class="games-menu">
      <h2>🎮 Choose a Game</h2>
      <p class="games-grade">Playing at <strong>${gradeLabel}</strong> level</p>

      <a href="#game/english" class="game-card">
        <div class="game-icon">📖</div>
        <div class="game-info">
          <div class="game-title">English</div>
          <div class="game-desc">Fill in the blank & put words in order</div>
        </div>
        <div class="game-coins">🪙 +5/correct</div>
      </a>

      <a href="#game/math" class="game-card">
        <div class="game-icon">🔢</div>
        <div class="game-info">
          <div class="game-title">Math</div>
          <div class="game-desc">Addition, subtraction & more</div>
        </div>
        <div class="game-coins">🪙 +5/correct</div>
      </a>

      <a href="#game/reading" class="game-card">
        <div class="game-icon">📚</div>
        <div class="game-info">
          <div class="game-title">Reading</div>
          <div class="game-desc">Short stories & comprehension questions</div>
        </div>
        <div class="game-coins">🪙 +5/correct</div>
      </a>

      <a href="#game/geography" class="game-card">
        <div class="game-icon">🗺️</div>
        <div class="game-info">
          <div class="game-title">Geography</div>
          <div class="game-desc">Find states on the US map</div>
        </div>
        <div class="game-coins">🪙 +5/correct</div>
      </a>

      <div class="games-hint">Answer correctly to build a streak bonus! ⭐</div>
    </div>
  `);
}
