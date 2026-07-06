import { state } from '../state.js';
import { setView } from '../ui.js';
import { supabase } from '../supabase.js';

export async function renderMathBlastScores() {
  setView(`<div class="scores-loading">Loading scores… 🚀</div>`);

  const grade = state.profile.grade;

  // Fetch top 40 for the current grade (deduplicate client-side to best per player)
  const [gradeRes, personalRes] = await Promise.all([
    supabase
      .from('mathblast_scores')
      .select('profile_id, username, score, correct, answered, created_at')
      .eq('grade', grade)
      .order('score', { ascending: false })
      .limit(40),
    supabase
      .from('mathblast_scores')
      .select('score, correct, answered, created_at')
      .eq('profile_id', state.profile.id)
      .order('score', { ascending: false })
      .limit(1),
  ]);

  const allRows  = gradeRes.data  || [];
  const personal = personalRes.data?.[0] || null;

  // Keep only the best score per player
  const seen    = new Map();
  const board   = [];
  for (const row of allRows) {
    if (!seen.has(row.profile_id)) {
      seen.set(row.profile_id, true);
      board.push(row);
      if (board.length >= 10) break;
    }
  }

  const gradeLabel = g => `${g}${['st','nd','rd','th'][Math.min(g-1,3)]} Grade`;
  const pct = r => r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0;

  // Grade tab buttons
  const gradeTabs = [1,2,3,4,5].map(g => `
    <button class="grade-tab ${g === grade ? 'grade-tab--active' : ''}"
      onclick="window.location.hash='#game/mathblast/scores/${g}'">${g}</button>
  `).join('');

  // Leaderboard rows
  const rows = board.length === 0
    ? `<p class="scores-empty">No scores yet for ${gradeLabel(grade)} — be the first! 🚀</p>`
    : board.map((r, i) => {
        const isMe   = r.profile_id === state.profile.id;
        const medal  = ['🥇','🥈','🥉'][i] || `${i+1}.`;
        const date   = new Date(r.created_at).toLocaleDateString();
        return `
          <div class="score-row ${isMe ? 'score-row--me' : ''}">
            <span class="score-rank">${medal}</span>
            <span class="score-name">${r.username}${isMe ? ' ⭐' : ''}</span>
            <span class="score-pts">${r.score}</span>
            <span class="score-acc">${pct(r)}%</span>
          </div>
        `;
      }).join('');

  // Personal best card
  const personalCard = personal
    ? `<div class="personal-best">
        <div class="pb-label">Your Best</div>
        <div class="pb-score">${personal.score}</div>
        <div class="pb-detail">${personal.correct}/${personal.answered} correct · ${pct(personal)}%</div>
      </div>`
    : `<div class="personal-best personal-best--empty">
        <div class="pb-label">Your Best</div>
        <div class="pb-detail">Play Math Blast to set a score!</div>
      </div>`;

  setView(`
    <div class="scores-screen">
      <h2>🏆 Math Blast Scores</h2>
      ${personalCard}

      <div class="grade-tabs">${gradeTabs}</div>
      <div class="scores-grade-label">${gradeLabel(grade)} Leaderboard</div>

      <div class="score-header">
        <span class="score-rank">#</span>
        <span class="score-name">Player</span>
        <span class="score-pts">Score</span>
        <span class="score-acc">Accuracy</span>
      </div>
      <div class="score-list">${rows}</div>

      <div class="scores-actions">
        <button class="btn btn-primary"
          onclick="if(window.location.hash==='#game/mathblast'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/mathblast'}">
          Play 🚀
        </button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}
