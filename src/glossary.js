import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView } from './ui.js';
import { STUFFIE_ROSTER, RARITIES } from './stuffies.js';

const RARITY_INFO = {
  common:    { label: 'Common',    icon: '⚪', color: '#999',    desc: 'Found in every bag. Great starters!' },
  uncommon:  { label: 'Uncommon',  icon: '🟢', color: '#4caf50', desc: 'A little harder to find.' },
  rare:      { label: 'Rare',      icon: '🔵', color: '#2196f3', desc: 'Not everyone has these!' },
  epic:      { label: 'Epic',      icon: '🟣', color: '#9c27b0', desc: 'Pretty special. Show them off!' },
  legendary: { label: 'Legendary', icon: '🟡', color: '#ff9800', desc: 'Super rare and super cool.' },
  mythic:    { label: 'Mythic',    icon: '🌈', color: '#e91e63', desc: 'The rarest of them all!' },
};

export async function renderGlossary() {
  setView(`<div style="text-align:center;padding:40px">Loading glossary… 📖</div>`);

  const { data: owned } = await supabase
    .from('user_stuffies')
    .select('stuffie_key')
    .eq('profile_id', state.profile.id);

  const ownedKeys = new Set((owned || []).map(r => r.stuffie_key));
  const totalOwned = STUFFIE_ROSTER.filter(s => ownedKeys.has(s.key)).length;
  const total = STUFFIE_ROSTER.length;

  // Rarity legend
  const legendHtml = RARITIES.map(r => {
    const info = RARITY_INFO[r];
    const count = STUFFIE_ROSTER.filter(s => s.rarity === r).length;
    const got   = STUFFIE_ROSTER.filter(s => s.rarity === r && ownedKeys.has(s.key)).length;
    return `
      <div class="gloss-legend-row">
        <span class="gloss-rarity-icon">${info.icon}</span>
        <div class="gloss-legend-text">
          <strong style="color:${info.color}">${info.label}</strong>
          <span class="gloss-legend-desc">${info.desc}</span>
        </div>
        <span class="gloss-legend-count">${got}/${count}</span>
      </div>`;
  }).join('');

  // Stuffie grid per rarity (reversed: mythic first)
  const gridHtml = [...RARITIES].reverse().map(r => {
    const items = STUFFIE_ROSTER.filter(s => s.rarity === r);
    if (!items.length) return '';
    const info = RARITY_INFO[r];
    const got  = items.filter(s => ownedKeys.has(s.key)).length;

    const cards = items.map(s => {
      const have = ownedKeys.has(s.key);
      const display = s.img
        ? `<img src="${s.img}" alt="${s.name}" class="gloss-card-img ${have ? '' : 'gloss-unseen-img'}">`
        : `<span class="gloss-card-emoji ${have ? '' : 'gloss-unseen-emoji'}">${have ? s.emoji : '❓'}</span>`;
      return `
        <div class="gloss-card ${have ? 'gloss-card--owned' : 'gloss-card--unseen'}">
          ${display}
          <div class="gloss-card-name">${have ? s.name : '???'}</div>
          ${have ? `<div class="gloss-card-check">✓</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="gloss-section">
        <div class="gloss-section-header" style="border-color:${info.color}">
          <span>${info.icon} ${info.label}</span>
          <span class="gloss-section-count" style="color:${info.color}">${got} / ${items.length}</span>
        </div>
        <div class="gloss-grid">${cards}</div>
      </div>`;
  }).join('');

  setView(`
    <div class="glossary-screen">
      <div class="gloss-header">
        <button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>
        <h2>📖 Stuffie Glossary</h2>
        <div class="gloss-total">${totalOwned} / ${total} collected</div>
      </div>

      <div class="gloss-progress-bar">
        <div class="gloss-progress-fill" style="width:${Math.round(totalOwned/total*100)}%"></div>
      </div>

      <div class="gloss-legend">
        <h3 class="gloss-legend-title">Rarity Guide</h3>
        ${legendHtml}
      </div>

      ${gridHtml}
    </div>
  `);
}
