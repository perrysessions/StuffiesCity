import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView, toast } from './ui.js';
import { STUFFIE_ROSTER } from './stuffies.js';

const rosterMap = Object.fromEntries(STUFFIE_ROSTER.map(s => [s.key, s]));
const MAX_EACH  = 5;

// ── Wizard state (persists across step re-renders) ────────────────────────────
let wTarget    = null;
let wTheirRows = [];
let wMyRows    = [];
let wWantIds   = new Set(); // their stuffie ids I want  → receiver_stuffie_ids
let wOfferIds  = new Set(); // my stuffie ids I offer    → proposer_stuffie_ids
let wStep      = 1;

// ── Start a new trade ─────────────────────────────────────────────────────────

export async function renderNewTrade(targetProfileId) {
  setView(`<div class="trade-loading">Loading stuffies… 📦</div>`);

  const { data: target } = await supabase
    .from('profiles').select('id, username, avatar_emoji')
    .eq('id', targetProfileId).single();

  if (!target) { toast('Could not load profile', 'error'); return; }

  const [theirRes, myRes] = await Promise.all([
    supabase.from('user_stuffies').select('id, stuffie_key, rarity')
      .eq('profile_id', targetProfileId).order('acquired_at', { ascending: false }),
    supabase.from('user_stuffies').select('id, stuffie_key, rarity')
      .eq('profile_id', state.profile.id).order('acquired_at', { ascending: false }),
  ]);

  wTarget    = target;
  wTheirRows = theirRes.data || [];
  wMyRows    = myRes.data    || [];
  wWantIds   = new Set();
  wOfferIds  = new Set();
  wStep      = 1;
  renderWizard();
}

function renderWizard() {
  if      (wStep === 1) renderStep1();
  else if (wStep === 2) renderStep2();
  else                  renderStep3();
}

// Step 1 — pick what you WANT from their collection
function renderStep1() {
  const cards = wTheirRows.length
    ? wTheirRows.map(r => selectCard(r, wWantIds.has(r.id), `_tradeToggleWant('${r.id}')`)).join('')
    : `<p class="trade-empty">They don't have any stuffies yet!</p>`;

  setView(`
    <div class="trade-wizard">
      <div class="trade-wiz-header">
        <button class="btn btn-outline btn-xs" onclick="history.back()">← Back</button>
        <span class="trade-step-pill">1 / 3</span>
      </div>
      <h3 class="trade-heading">📦 Trade with ${wTarget.avatar_emoji} ${wTarget.username}</h3>
      <p class="trade-subhead">Pick up to ${MAX_EACH} stuffies you <strong>want</strong></p>
      <div class="trade-sel-count">
        ${wWantIds.size} / ${MAX_EACH} selected
        <button class="btn btn-primary btn-xs" ${wWantIds.size === 0 ? 'disabled' : ''}
          onclick="_tradeGoStep2()">Next →</button>
      </div>
      <div class="trade-grid">${cards}</div>
      <div class="trade-actions">
        <button class="btn btn-primary" ${wWantIds.size === 0 ? 'disabled' : ''}
          onclick="_tradeGoStep2()">Next: Choose what to offer →</button>
      </div>
    </div>
  `);

  window._tradeToggleWant = id => {
    wWantIds.has(id) ? wWantIds.delete(id) : (wWantIds.size < MAX_EACH && wWantIds.add(id));
    renderWizard();
  };
  window._tradeGoStep2 = () => { wStep = 2; renderWizard(); };
}

// Step 2 — pick what you'll OFFER
function renderStep2() {
  const cards = wMyRows.length
    ? wMyRows.map(r => selectCard(r, wOfferIds.has(r.id), `_tradeToggleOffer('${r.id}')`)).join('')
    : `<p class="trade-empty">You don't have any stuffies to offer!</p>`;

  setView(`
    <div class="trade-wizard">
      <div class="trade-wiz-header">
        <button class="btn btn-outline btn-xs" onclick="_tradeGoStep1()">← Back</button>
        <span class="trade-step-pill">2 / 3</span>
      </div>
      <h3 class="trade-heading">What will you offer?</h3>
      <p class="trade-subhead">Pick up to ${MAX_EACH} stuffies from <strong>your</strong> collection</p>
      <div class="trade-sel-count">
        ${wOfferIds.size} / ${MAX_EACH} selected
        <button class="btn btn-primary btn-xs" ${wOfferIds.size === 0 ? 'disabled' : ''}
          onclick="_tradeGoStep3()">Next →</button>
      </div>
      <div class="trade-grid">${cards}</div>
      <div class="trade-actions">
        <button class="btn btn-primary" ${wOfferIds.size === 0 ? 'disabled' : ''}
          onclick="_tradeGoStep3()">Next: Review trade →</button>
      </div>
    </div>
  `);

  window._tradeToggleOffer = id => {
    wOfferIds.has(id) ? wOfferIds.delete(id) : (wOfferIds.size < MAX_EACH && wOfferIds.add(id));
    renderWizard();
  };
  window._tradeGoStep1 = () => { wStep = 1; renderWizard(); };
  window._tradeGoStep3 = () => { wStep = 3; renderWizard(); };
}

// Step 3 — review & send
function renderStep3() {
  const wantRows  = wTheirRows.filter(r => wWantIds.has(r.id));
  const offerRows = wMyRows.filter(r => wOfferIds.has(r.id));

  setView(`
    <div class="trade-wizard">
      <div class="trade-wiz-header">
        <button class="btn btn-outline btn-xs" onclick="_tradeGoStep2b()">← Back</button>
        <span class="trade-step-pill">3 / 3</span>
      </div>
      <h3 class="trade-heading">Review your trade</h3>

      <div class="trade-review">
        <div class="trade-review-side">
          <div class="trade-review-label">You get 🎁</div>
          <div class="trade-review-pills">${wantRows.map(stuffiePill).join('')}</div>
        </div>
        <div class="trade-review-arrow">⇄</div>
        <div class="trade-review-side">
          <div class="trade-review-label">You give 📤</div>
          <div class="trade-review-pills">${offerRows.map(stuffiePill).join('')}</div>
        </div>
      </div>

      <p class="trade-confirm-note">
        Sends a request to ${wTarget.avatar_emoji} ${wTarget.username}.<br>
        The swap only happens if they accept.
      </p>
      <div class="trade-actions">
        <button class="btn btn-primary" onclick="_tradeSend()">📨 Send Trade Request</button>
        <button class="btn btn-outline" onclick="_tradeGoStep2b()">Cancel</button>
      </div>
    </div>
  `);

  window._tradeGoStep2b = () => { wStep = 2; renderWizard(); };
  window._tradeSend = async () => {
    const btn = document.querySelector('.trade-actions .btn-primary');
    if (btn) btn.disabled = true;
    const { error } = await supabase.from('trade_requests').insert({
      proposer_id:          state.profile.id,
      receiver_id:          wTarget.id,
      proposer_stuffie_ids: [...wOfferIds],
      receiver_stuffie_ids: [...wWantIds],
    });
    if (error) {
      toast('Failed to send request', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    toast(`Trade request sent to ${wTarget.username}! 📨`, 'success');
    window.location.hash = '#collection';
  };
}

// ── View / accept / decline a trade ──────────────────────────────────────────

export async function renderTradeView(tradeId) {
  setView(`<div class="trade-loading">Loading trade… 📦</div>`);

  const { data: trade } = await supabase
    .from('trade_requests').select('*').eq('id', tradeId).single();

  if (!trade) { toast('Trade not found', 'error'); history.back(); return; }

  const [profilesRes, stuffiesRes] = await Promise.all([
    supabase.from('profiles').select('id, username, avatar_emoji')
      .in('id', [trade.proposer_id, trade.receiver_id]),
    supabase.from('user_stuffies').select('id, stuffie_key, rarity, profile_id')
      .in('id', [...trade.proposer_stuffie_ids, ...trade.receiver_stuffie_ids]),
  ]);

  const pMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));
  const sMap = Object.fromEntries((stuffiesRes.data || []).map(s => [s.id, s]));

  const proposer   = pMap[trade.proposer_id] || { username: 'Unknown', avatar_emoji: '❓' };
  const receiver   = pMap[trade.receiver_id] || { username: 'Unknown', avatar_emoji: '❓' };
  const isReceiver = state.profile.id === trade.receiver_id;
  const isProposer = state.profile.id === trade.proposer_id;
  const isPending  = trade.status === 'pending';

  const offerPills = trade.proposer_stuffie_ids.map(id => stuffiePill(sMap[id])).join('');
  const wantPills  = trade.receiver_stuffie_ids.map(id => stuffiePill(sMap[id])).join('');

  const badge = { pending:'⏳ Pending', accepted:'✅ Accepted', declined:'❌ Declined', cancelled:'🚫 Cancelled' }[trade.status] || '';

  let actions = '';
  if (isPending && isReceiver) {
    actions = `
      <button class="btn btn-primary" onclick="_tradeAccept('${tradeId}')">✅ Accept Trade</button>
      <button class="btn btn-outline" onclick="_tradeDecline('${tradeId}')">❌ Decline</button>`;
  } else if (isPending && isProposer) {
    actions = `<button class="btn btn-outline" onclick="_tradeCancel('${tradeId}')">🚫 Cancel Request</button>`;
  }

  setView(`
    <div class="trade-view">
      <div class="trade-wiz-header">
        <button class="btn btn-outline btn-xs" onclick="history.back()">← Back</button>
        <span class="trade-status-badge">${badge}</span>
      </div>
      <h3 class="trade-heading">
        ${proposer.avatar_emoji} ${proposer.username} → ${receiver.avatar_emoji} ${receiver.username}
      </h3>
      <div class="trade-review">
        <div class="trade-review-side">
          <div class="trade-review-label">${proposer.username} gives</div>
          <div class="trade-review-pills">${offerPills}</div>
        </div>
        <div class="trade-review-arrow">⇄</div>
        <div class="trade-review-side">
          <div class="trade-review-label">${receiver.username} gives</div>
          <div class="trade-review-pills">${wantPills}</div>
        </div>
      </div>
      <div class="trade-actions">${actions}</div>
    </div>
  `);

  window._tradeAccept = async id => {
    document.querySelectorAll('.trade-actions button').forEach(b => b.disabled = true);
    const { error } = await supabase.rpc('accept_trade', { p_trade_id: id });
    if (error) {
      toast(error.message || 'Trade failed — stuffies may have already moved', 'error');
      document.querySelectorAll('.trade-actions button').forEach(b => b.disabled = false);
    } else {
      toast('Trade accepted! Stuffies swapped 🎉', 'success');
      window.location.hash = '#collection';
    }
  };
  window._tradeDecline = async id => {
    await supabase.from('trade_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', id);
    toast('Trade declined', 'info');
    window.location.hash = '#collection';
  };
  window._tradeCancel = async id => {
    await supabase.from('trade_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    toast('Trade cancelled', 'info');
    window.location.hash = '#collection';
  };
}

// ── Pending trades section HTML (used by collection.js) ──────────────────────

export async function pendingTradesHtml() {
  const myId = state.profile.id;
  const { data: trades } = await supabase
    .from('trade_requests')
    .select('id, proposer_id, receiver_id, proposer_stuffie_ids, receiver_stuffie_ids')
    .or(`proposer_id.eq.${myId},receiver_id.eq.${myId}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!trades?.length) return '';

  const counterIds = [...new Set(trades.map(t =>
    t.proposer_id === myId ? t.receiver_id : t.proposer_id))];
  const { data: profiles } = await supabase
    .from('profiles').select('id, username, avatar_emoji').in('id', counterIds);
  const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  const rows = trades.map(t => {
    const incoming = t.receiver_id === myId;
    const other    = pMap[incoming ? t.proposer_id : t.receiver_id] || { username: '?', avatar_emoji: '❓' };
    const give     = incoming ? t.proposer_stuffie_ids.length : t.receiver_stuffie_ids.length;
    const get      = incoming ? t.receiver_stuffie_ids.length : t.proposer_stuffie_ids.length;
    const label    = incoming
      ? `📦 <strong>${other.avatar_emoji} ${other.username}</strong> wants to trade — ${give} for ${get}`
      : `⏳ Awaiting <strong>${other.avatar_emoji} ${other.username}</strong> — ${give} for ${get}`;
    return `
      <div class="pending-trade-row ${incoming ? 'pending-trade-row--in' : ''}">
        <span class="pending-trade-label">${label}</span>
        <a href="#trade/view/${t.id}" class="btn btn-xs btn-outline">View</a>
      </div>`;
  }).join('');

  return `
    <div class="pending-trades-section">
      <h3 class="pending-trades-title">📦 Pending Trades (${trades.length})</h3>
      ${rows}
    </div>`;
}

// ── Shared card/pill helpers ──────────────────────────────────────────────────

function selectCard(row, selected, onClickFn) {
  const info    = rosterMap[row.stuffie_key] || { name: row.stuffie_key, emoji: '❓' };
  const display = info.img
    ? `<img src="${info.img}" alt="${info.name}" class="stuffie-img">`
    : `<span>${info.emoji}</span>`;
  return `
    <div class="trade-sel-card ${selected ? 'trade-sel-card--on' : ''}"
         onclick="${onClickFn}">
      <div class="trade-sel-check">${selected ? '✓' : ''}</div>
      <div class="stuffie-emoji">${display}</div>
      <div class="trade-sel-name">${info.name}</div>
      <div class="rarity-dot rarity-${row.rarity}"></div>
    </div>`;
}

function stuffiePill(row) {
  if (!row) return '<span class="stuffie-pill">❓</span>';
  const info    = rosterMap[row.stuffie_key] || { name: row.stuffie_key || '?', emoji: '❓' };
  const display = info.img
    ? `<img src="${info.img}" alt="${info.name}" style="width:1.3rem;height:1.3rem;object-fit:contain;vertical-align:middle;">`
    : info.emoji;
  return `<span class="stuffie-pill rarity-${row.rarity}">${display} ${info.name}</span>`;
}
