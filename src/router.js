import { state } from './state.js';
import { renderLogin } from './auth.js';
import { setActiveNav } from './ui.js';

const handlers = {};

export function registerRoute(hash, fn) {
  handlers[hash] = fn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  const hash = window.location.hash || '#room';

  if (!state.user) {
    renderLogin();
    return;
  }

  if (!state.profile) {
    const { renderProfilePicker } = await import('./auth.js');
    renderProfilePicker();
    return;
  }

  setActiveNav(hash);

  // Dynamic pattern: #collection/userId
  const collectionMatch = hash.match(/^#collection\/(.+)$/);
  if (collectionMatch) {
    const { renderCollection } = await import('./collection.js');
    renderCollection(collectionMatch[1]);
    return;
  }

  // Dynamic pattern: #game/mathblast/scores/:grade
  const blastScoreMatch = hash.match(/^#game\/mathblast\/scores\/(\d)$/);
  if (blastScoreMatch) {
    const grade = parseInt(blastScoreMatch[1]);
    if (grade >= 1 && grade <= 5) {
      // Temporarily override profile grade for the leaderboard view, restore after
      const prev = state.profile.grade;
      state.profile.grade = grade;
      const { renderMathBlastScores } = await import('./games/mathblast-scores.js');
      await renderMathBlastScores();
      state.profile.grade = prev;
    }
    return;
  }

  const handler = handlers[hash];
  if (handler) {
    handler();
  } else {
    handlers['#room']?.();
  }
}
