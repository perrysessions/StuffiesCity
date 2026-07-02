import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView } from './ui.js';
import { stuffieCard, STUFFIE_ROSTER } from './stuffies.js';

const rosterMap = Object.fromEntries(STUFFIE_ROSTER.map(s => [s.key, s]));

export async function renderHome() {
  const profile = state.profile;
  const siblings = state.profiles.filter(p => p.id !== profile.id);

  // Fetch shelf stuffies + pending friend requests in parallel
  const [{ data: stuffies }, { data: pending }] = await Promise.all([
    supabase.from('user_stuffies')
      .select('*')
      .eq('profile_id', profile.id)
      .order('acquired_at', { ascending: false })
      .limit(6),
    supabase.from('friendships')
      .select('*, requester:requester_id(username, avatar_emoji)')
      .eq('addressee_id', profile.id)
      .eq('status', 'pending'),
  ]);

  const shelfItems = (stuffies && stuffies.length)
    ? stuffies.map(r => stuffieCard({ ...(rosterMap[r.stuffie_key] || { emoji: '❓', name: r.stuffie_key }), rarity: r.rarity })).join('')
    : Array(6).fill(`<div class="stuffie-card stuffie-empty">❓<div class="stuffie-name">Empty</div></div>`).join('');

  const pendingHtml = (pending && pending.length)
    ? `<div class="home-section">
        <h3>🔔 Friend Requests (${pending.length})</h3>
        ${pending.map(f => `
          <div class="friend-request-row">
            <span>${f.requester.avatar_emoji} ${f.requester.username}</span>
            <button class="btn btn-sm btn-primary" onclick="acceptFriend('${f.id}')">Accept</button>
          </div>
        `).join('')}
      </div>`
    : '';

  const siblingsHtml = siblings.length
    ? `<div class="home-section siblings-bar">
        ${siblings.map(s => `
          <button class="sibling-chip" onclick="switchToSibling('${s.id}')">
            ${s.avatar_emoji} ${s.username}
          </button>
        `).join('')}
      </div>`
    : '';

  setView(`
    <div class="home-screen">
      <div class="home-header">
        <div class="home-avatar">${profile.avatar_emoji}</div>
        <div>
          <div class="home-username">${profile.username}'s House</div>
          <div class="home-grade">${gradeLabel(profile.grade)}</div>
        </div>
        <div class="home-coins">🪙 ${profile.coins}</div>
      </div>

      ${siblingsHtml}

      <div class="stuffie-shelf">
        <h3>🏠 My Stuffie Shelf</h3>
        <div class="stuffie-shelf-grid">${shelfItems}</div>
        <a href="#collection" class="btn btn-outline btn-sm">See All Collections →</a>
      </div>

      ${pendingHtml}

      <div class="home-quick-actions">
        <a href="#games" class="quick-card">
          <div class="quick-icon">🎮</div>
          <div class="quick-label">Play Games</div>
          <div class="quick-sub">Earn coins!</div>
        </a>
        <a href="#shop" class="quick-card">
          <div class="quick-icon">🛍️</div>
          <div class="quick-label">Blind Bags</div>
          <div class="quick-sub">Get stuffies!</div>
        </a>
        <a href="#collection" class="quick-card">
          <div class="quick-icon">🎒</div>
          <div class="quick-label">Collections</div>
          <div class="quick-sub">All ${state.profiles.length > 1 ? state.profiles.length + ' girls!' : 'stuffies!'}</div>
        </a>
      </div>
    </div>
  `);

  window.acceptFriend = async (friendshipId) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    renderHome();
  };

  window.switchToSibling = async (profileId) => {
    const { activateProfile } = await import('./auth.js');
    const sibling = state.profiles.find(p => p.id === profileId);
    if (sibling) activateProfile(sibling);
  };
}

function gradeLabel(g) {
  return `${g}${['st','nd','rd','th'][Math.min(g-1,3)]} Grade`;
}
