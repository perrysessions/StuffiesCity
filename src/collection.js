import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView } from './ui.js';
import { stuffieCard, RARITIES, STUFFIE_ROSTER } from './stuffies.js';
import { pendingTradesHtml } from './trades.js';

const rosterMap = Object.fromEntries(STUFFIE_ROSTER.map(s => [s.key, s]));

// Default view: all siblings' collections side by side
export async function renderFamilyCollection() {
  const profiles = state.profiles;

  // Fetch stuffies for all profiles in one query
  const profileIds = profiles.map(p => p.id);
  const { data: rows } = await supabase
    .from('user_stuffies')
    .select('*')
    .in('profile_id', profileIds)
    .order('acquired_at', { ascending: false });

  // Group rows by profile_id
  const byProfile = {};
  for (const r of rows || []) {
    if (!byProfile[r.profile_id]) byProfile[r.profile_id] = [];
    byProfile[r.profile_id].push(r);
  }

  const pendingHtml = await pendingTradesHtml();

  const columns = profiles.map(p => {
    const stuffies = (byProfile[p.id] || []).map(r => ({
      ...(rosterMap[r.stuffie_key] || { key: r.stuffie_key, emoji: '❓', name: r.stuffie_key }),
      rarity: r.rarity,
    }));

    const isActive = p.id === state.profile.id;
    const gridHtml = stuffies.length
      ? stuffies.map(s => stuffieCard(s, 'small')).join('')
      : `<div class="empty-col-msg">No stuffies yet!<br>Play games to earn coins 🎮</div>`;

    return `
      <div class="family-col ${isActive ? 'family-col--active' : ''}">
        <div class="family-col-header">
          <div class="family-col-avatar">${p.avatar_emoji}</div>
          <div class="family-col-name">${p.username}</div>
          <div class="family-col-count">${stuffies.length} stuffies</div>
          <a href="#collection/${p.id}" class="btn btn-outline btn-xs">Full View</a>
          ${p.id !== state.profile.id ? `<a href="#trade/new/${p.id}" class="btn btn-outline btn-xs btn-trade">📦 Trade</a>` : ''}
        </div>
        <div class="family-col-grid">${gridHtml}</div>
      </div>
    `;
  }).join('');

  setView(`
    <div class="family-collection-screen">
      <h2 style="text-align:center;margin-bottom:16px">🎒 Family Collection</h2>
      ${pendingHtml}
      <div class="family-cols">${columns}</div>
    </div>
  `);
}

// Single-profile collection view (full detail with rarity grouping)
export async function renderCollection(profileId) {
  const isSibling = state.profiles.some(p => p.id === profileId);
  const isOwn = profileId === state.profile.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_emoji, grade')
    .eq('id', profileId)
    .single();

  const { data: rows } = await supabase
    .from('user_stuffies')
    .select('*')
    .eq('profile_id', profileId)
    .order('acquired_at', { ascending: false });

  const stuffies = (rows || []).map(r => ({
    ...(rosterMap[r.stuffie_key] || { key: r.stuffie_key, emoji: '❓', name: r.stuffie_key }),
    rarity: r.rarity,
  }));

  const grouped = groupByRarity(stuffies);

  const rarityHtml = RARITIES.slice().reverse().map(r => {
    const items = grouped[r];
    if (!items || !items.length) return '';
    return `
      <div class="rarity-group">
        <h3 class="rarity-group-title rarity-${r}">${rarityLabel(r)} (${items.length})</h3>
        <div class="collection-grid">
          ${items.map(s => stuffieCard(s)).join('')}
        </div>
      </div>
    `;
  }).join('');

  const emptyHtml = !stuffies.length
    ? `<div class="empty-collection">
        <div style="font-size:4rem">🎒</div>
        <p>${isOwn ? 'No stuffies yet! Play games to earn coins and open bags.' : 'No stuffies yet!'}</p>
        ${isOwn ? '<a href="#shop" class="btn btn-primary">Go to Shop</a>' : ''}
      </div>`
    : rarityHtml;

  setView(`
    <div class="collection-screen">
      <div class="collection-header">
        <button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>
        <h2>${profile?.avatar_emoji || '🎒'} ${profile?.username || 'Collection'}</h2>
        <div class="collection-count">${stuffies.length} stuffies</div>
        ${!isOwn ? `<a href="#trade/new/${profileId}" class="btn btn-primary btn-sm">📦 Trade</a>` : ''}
      </div>
      ${emptyHtml}
    </div>
  `);
}

function groupByRarity(stuffies) {
  const g = {};
  for (const s of stuffies) {
    if (!g[s.rarity]) g[s.rarity] = [];
    g[s.rarity].push(s);
  }
  return g;
}

function rarityLabel(r) {
  const icons = { common:'⚪', uncommon:'🟢', rare:'🔵', epic:'🟣', legendary:'🟡', mythic:'🌈' };
  return `${icons[r] || ''} ${r.charAt(0).toUpperCase() + r.slice(1)}`;
}
