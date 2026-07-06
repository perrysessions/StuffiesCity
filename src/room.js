import { state } from './state.js';
import { supabase } from './supabase.js';
import { stuffieCard, STUFFIE_ROSTER } from './stuffies.js';
import { toast } from './ui.js';

const rosterMap = Object.fromEntries(STUFFIE_ROSTER.map(s => [s.key, s]));

const ROOM_COLORS = {
  pink:   { label: '🩷 Pink',   file: 'pink kids room.png' },
  purple: { label: '💜 Purple', file: 'purple kids room.png' },
  blue:   { label: '💙 Blue',   file: 'blue kids room.png' },
};

// x,y = % of image dimensions (3168×1344). scale = perspective size factor.
// y is the SURFACE level — stuffie bottoms align here via transform translate(-50%,-100%)
const ZONES = [
  { id: 'shelf-top',      label: 'Top Shelf',         x: 12,  y: 32, scale: 0.48, zIndex: 4 },
  { id: 'shelf-mid',      label: 'Middle Shelf',       x: 12,  y: 42, scale: 0.50, zIndex: 4 },
  { id: 'shelf-low',      label: 'Lower Shelf',        x: 12,  y: 52, scale: 0.52, zIndex: 4 },
  { id: 'bed',               label: 'On the Bed',            x: 17,  y: 72, scale: 0.78, zIndex: 6, maxCount: 8 },
  { id: 'desk',              label: 'On the Desk',           x: 43,  y: 65, scale: 0.65, zIndex: 6 },
  { id: 'desk-shelf-top',    label: 'Desk Shelf (Top)',      x: 45,  y: 37, scale: 0.385, zIndex: 4 },
  { id: 'desk-shelf-mid',    label: 'Desk Shelf (Middle)',   x: 45,  y: 45, scale: 0.385, zIndex: 4 },
  { id: 'desk-shelf-low',    label: 'Desk Shelf (Bottom)',   x: 45,  y: 52, scale: 0.385, zIndex: 4 },
  { id: 'dresser-top',    label: 'Top of Dresser',     x: 56,  y: 53, scale: 0.58, zIndex: 5, maxCount: 7 },
  { id: 'dresser-mid',    label: 'Dresser Shelf',      x: 55,  y: 77, scale: 0.50, zIndex: 5, maxCount: 5, diagonal: true },
  // diagonal:true — each stuffie steps left 2% and up 1% from the rightmost anchor
  { id: 'closet-1', label: 'Closet Shelf 1', x: 81, y: 85, scale: 0.50, zIndex: 5, maxCount: 7, diagonal: true },
  { id: 'closet-2', label: 'Closet Shelf 2', x: 81, y: 74, scale: 0.50, zIndex: 5, maxCount: 7, diagonal: true },
  { id: 'closet-3', label: 'Closet Shelf 3', x: 81, y: 64, scale: 0.50, zIndex: 5, maxCount: 7, diagonal: true, diagYStep: 0.1 },
  { id: 'closet-4', label: 'Closet Shelf 4', x: 81, y: 55, scale: 0.50, zIndex: 5, maxCount: 7, diagonal: true, diagYStep: 0.1 },
  { id: 'closet-5', label: 'Closet Shelf 5', x: 81, y: 45, scale: 0.50, zIndex: 5, maxCount: 7, diagonal: true, diagYStep: 0.1 },
  { id: 'closet-6', label: 'Closet Shelf 6', x: 81, y: 34, scale: 0.48, zIndex: 5 },
  { id: 'armchair',       label: 'Couch',              x: 90,  y: 86, scale: 0.577, zIndex: 6, maxCount: 4, diagonal: true },
  { id: 'floor',          label: 'On the Floor',       x: 44,  y: 99, scale: 1.00, zIndex: 7 },
];

const BASE_PX = 52; // stuffie size at scale 1.0
const SNAP_RADIUS = 130; // px — how close drop must be to snap

let dragState = null; // { key, rarity, ghost }
let currentPlacements = [];
let allStuffies = [];

// ── Entry point ──────────────────────────────────────────────────────────────

export async function renderRoom() {
  const profile = state.profile;
  const color   = profile.room_color || 'pink';

  const [{ data: stuffies }, { data: placements }] = await Promise.all([
    supabase.from('user_stuffies').select('*').eq('profile_id', profile.id).order('acquired_at', { ascending: false }),
    supabase.from('room_placements').select('*').eq('profile_id', profile.id),
  ]);

  allStuffies = (stuffies || []).map(r => ({
    ...(rosterMap[r.stuffie_key] || { emoji: '❓', name: r.stuffie_key, rarity: 'common' }),
    rarity: r.rarity,
  }));

  currentPlacements = placements || [];

  document.getElementById('view').innerHTML = buildRoomHTML(profile, color);
  renderPlacements(currentPlacements);
  renderDock();
  initPan();
  initDock();
  initColorPicker(color);
}

// ── HTML ─────────────────────────────────────────────────────────────────────

function buildRoomHTML(profile, color) {
  return `
    <div class="room-screen">
      <div class="room-bg-wrap" id="room-bg-wrap">
        <div class="room-canvas" id="room-canvas">
          <img class="room-bg-img" id="room-bg-img"
            src="stuffieskidsrooms/${encodeURIComponent(ROOM_COLORS[color].file)}"
            alt="${color} kids room" draggable="false" />
          <div class="room-stuffie-layer" id="room-stuffie-layer"></div>
        </div>
      </div>

      <div class="room-hud">
        <div class="room-hud-name">${profile.avatar_emoji} ${profile.username}'s Room</div>
        <div class="room-hud-coins">🪙 ${profile.coins}</div>
        <button class="room-color-btn" id="room-color-btn" title="Change room color">🎨</button>
      </div>

      <div class="room-dock" id="room-dock">
        <button class="dock-handle" id="dock-handle">
          <span class="dock-handle-bar"></span>
          <span class="dock-label" id="dock-label">🧸 My Stuffies</span>
          <span class="dock-handle-bar"></span>
        </button>
        <div class="dock-tray" id="dock-tray"></div>
        <div class="dock-hint" id="dock-hint">Drag a stuffie into your room ☝️</div>
      </div>

      <div class="room-color-picker hidden" id="room-color-picker">
        <div class="color-picker-box">
          <div class="color-picker-title">Choose Your Room</div>
          ${Object.entries(ROOM_COLORS).map(([key, val]) => `
            <button class="color-option ${key === color ? 'active' : ''}" data-color="${key}">${val.label}</button>
          `).join('')}
          <button class="btn btn-outline btn-sm" id="close-color-picker">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function renderDock() {
  const placedKeys = new Set(currentPlacements.map(p => p.stuffie_key));
  const available  = allStuffies.filter(s => !placedKeys.has(s.key));

  const tray = document.getElementById('dock-tray');
  const label = document.getElementById('dock-label');
  if (!tray) return;

  label.textContent = `🧸 My Stuffies (${available.length} left)`;

  if (!available.length) {
    tray.innerHTML = `<div class="dock-empty">All stuffies are in your room! 🎉</div>`;
    return;
  }

  tray.innerHTML = available.map(s => {
    const card = stuffieCard(s, 'small');
    return card.replace('<div class="stuffie-card',
      `<div data-key="${s.key}" data-rarity="${s.rarity}" class="stuffie-card`);
  }).join('');

  // Re-attach drag listeners to new cards
  tray.querySelectorAll('[data-key]').forEach(card => {
    const key    = card.dataset.key;
    const rarity = card.dataset.rarity;
    card.addEventListener('mousedown', e => { e.preventDefault(); startDrag(e, key, rarity); });
    card.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0], key, rarity); }, { passive: false });
  });
}

// ── Place stuffies on the room ────────────────────────────────────────────────

function renderPlacements(placements) {
  const layer = document.getElementById('room-stuffie-layer');
  if (!layer) return;

  // Group by zone
  const byZone = {};
  placements.forEach(p => {
    if (!byZone[p.zone_id]) byZone[p.zone_id] = [];
    byZone[p.zone_id].push(p);
  });

  layer.innerHTML = '';

  ZONES.forEach(zone => {
    const items = byZone[zone.id];
    if (!items || !items.length) return;

    const fontSize = Math.round(BASE_PX * zone.scale);

    if (zone.diagonal) {
      // Each stuffie is individually positioned, stepping left 2% and up 1% per step
      // Rightmost stuffie anchors at zone.x, zone.y; others spread leftward + upward
      const n = items.length;
      items.forEach((p, i) => {
        const stuffie = rosterMap[p.stuffie_key];
        const xPct = zone.x - (n - 1 - i) * 2;
        const yPct = zone.y - (n - 1 - i) * (zone.diagYStep ?? 0.5);
        const el = document.createElement('div');
        el.className = 'room-placed-stuffie room-placed-diag';
        el.style.cssText = `font-size:${fontSize}px;left:${xPct}%;top:${yPct}%;z-index:${zone.zIndex}`;
        if (stuffie?.img) {
          el.innerHTML = `<img src="${stuffie.img}" alt="${stuffie.name}" style="width:${fontSize}px;height:${fontSize}px;object-fit:contain;">`;
        } else {
          el.textContent = stuffie?.emoji || '❓';
        }
        el.title = stuffie?.name || p.stuffie_key;
        el.addEventListener('click', e => { e.stopPropagation(); showPlacedMenu(p, e); });
        layer.appendChild(el);
      });
      return;
    }

    const group = document.createElement('div');
    group.className = 'room-zone-group';
    group.style.cssText = `left:${zone.x}%;top:${zone.y}%;z-index:${zone.zIndex}`;

    items.forEach(p => {
      const stuffie = rosterMap[p.stuffie_key];
      const el = document.createElement('div');
      el.className = 'room-placed-stuffie';
      el.style.fontSize = fontSize + 'px';
      if (stuffie?.img) {
        el.innerHTML = `<img src="${stuffie.img}" alt="${stuffie.name}" style="width:${fontSize}px;height:${fontSize}px;object-fit:contain;">`;
      } else {
        el.textContent = stuffie?.emoji || '❓';
      }
      el.title = stuffie?.name || p.stuffie_key;
      el.addEventListener('click', (e) => { e.stopPropagation(); showPlacedMenu(p, e); });
      group.appendChild(el);
    });

    layer.appendChild(group);
  });
}

// ── Tap menu for placed stuffie ───────────────────────────────────────────────

function showPlacedMenu(placement, e) {
  dismissPlacedMenu();
  const stuffie = rosterMap[placement.stuffie_key];
  const menu = document.createElement('div');
  menu.id = 'placed-menu';
  menu.className = 'placed-stuffie-menu';
  menu.innerHTML = `
    <div class="psm-name">${stuffie?.emoji || '❓'} ${stuffie?.name || placement.stuffie_key}</div>
    <button class="psm-btn psm-remove">🗑️ Remove from room</button>
    <button class="psm-btn psm-cancel">✕ Cancel</button>
  `;

  // Position near tap
  const x = Math.min(e.clientX, window.innerWidth - 180);
  const y = Math.max(e.clientY - 110, 10);
  menu.style.cssText = `left:${x}px;top:${y}px`;
  document.body.appendChild(menu);

  menu.querySelector('.psm-remove').addEventListener('click', async () => {
    dismissPlacedMenu();
    await supabase.from('room_placements').delete().eq('id', placement.id);
    currentPlacements = currentPlacements.filter(p => p.id !== placement.id);
    renderPlacements(currentPlacements);
    renderDock();
  });
  menu.querySelector('.psm-cancel').addEventListener('click', dismissPlacedMenu);
  document.addEventListener('click', dismissPlacedMenu, { once: true });
}

function dismissPlacedMenu() {
  document.getElementById('placed-menu')?.remove();
}

// ── Pan ──────────────────────────────────────────────────────────────────────

function initPan() {
  const wrap = document.getElementById('room-bg-wrap');
  let startX = 0, startScrollX = 0, isPanning = false;

  wrap.addEventListener('mousedown', e => {
    if (dragState) return;
    isPanning = true;
    startX = e.pageX;
    startScrollX = wrap.scrollLeft;
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!isPanning || dragState) return;
    wrap.scrollLeft = startScrollX - (e.pageX - startX);
  });
  window.addEventListener('mouseup', () => { isPanning = false; wrap.style.cursor = 'grab'; });

  let touchStartX = 0, touchScrollX = 0;
  wrap.addEventListener('touchstart', e => {
    if (dragState) return;
    touchStartX = e.touches[0].pageX;
    touchScrollX = wrap.scrollLeft;
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (dragState) return;
    wrap.scrollLeft = touchScrollX - (e.touches[0].pageX - touchStartX);
  }, { passive: true });
}

// ── Dock ─────────────────────────────────────────────────────────────────────

function initDock() {
  const dock   = document.getElementById('room-dock');
  const handle = document.getElementById('dock-handle');
  handle.addEventListener('click', () => {
    dock.classList.toggle('open');
    document.getElementById('dock-hint').style.display =
      dock.classList.contains('open') ? 'block' : 'none';
  });
}

// ── Drag from dock ────────────────────────────────────────────────────────────
// Drag listeners are attached inside renderDock() so they stay fresh after re-renders.

function startDrag(pt, key, rarity) {
  dismissPlacedMenu();
  const stuffie = rosterMap[key];
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  if (stuffie?.img) {
    ghost.innerHTML = `<img src="${stuffie.img}" style="width:2.6rem;height:2.6rem;object-fit:contain;">`;
  } else {
    ghost.textContent = stuffie?.emoji || '❓';
  }
  ghost.style.left = pt.clientX + 'px';
  ghost.style.top  = pt.clientY + 'px';
  document.body.appendChild(ghost);

  showZoneTargets();

  dragState = { key, rarity, ghost };

  // Attach move/end to document so drag works outside the card
  const onMove = e => {
    e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    ghost.style.left = p.clientX + 'px';
    ghost.style.top  = p.clientY + 'px';
    highlightNearestZone(p.clientX, p.clientY);
  };
  const onEnd = e => {
    const p = e.changedTouches ? e.changedTouches[0] : e;
    endDrag(p.clientX, p.clientY);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

async function endDrag(clientX, clientY) {
  if (!dragState) return;
  const { key, rarity, ghost } = dragState;
  ghost.remove();
  hideZoneTargets();
  dragState = null;

  const zone = findNearestZone(clientX, clientY);
  if (!zone) return;

  if (zone.maxCount) {
    const count = currentPlacements.filter(p => p.zone_id === zone.id).length;
    if (count >= zone.maxCount) {
      toast(`${zone.label} is full! (max ${zone.maxCount})`, 'info');
      return;
    }
  }

  // Save to DB
  const { data: newRow } = await supabase.from('room_placements').insert({
    profile_id: state.profile.id,
    zone_id:    zone.id,
    stuffie_key: key,
  }).select().single();

  if (newRow) {
    currentPlacements.push(newRow);
    renderPlacements(currentPlacements);
    renderDock();
  }
}

// ── Zone helpers ──────────────────────────────────────────────────────────────

function zoneScreenPos(zone) {
  const canvas = document.getElementById('room-canvas');
  const rect   = canvas.getBoundingClientRect();
  return {
    x: rect.left + (zone.x / 100) * rect.width,
    y: rect.top  + (zone.y / 100) * rect.height,
  };
}

function findNearestZone(clientX, clientY) {
  const wrap = document.getElementById('room-bg-wrap');
  const rect = wrap.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return null;

  let best = null, bestDist = Infinity;
  ZONES.forEach(zone => {
    const pos = zoneScreenPos(zone);
    const d = Math.hypot(pos.x - clientX, pos.y - clientY);
    if (d < bestDist) { bestDist = d; best = zone; }
  });
  return bestDist < SNAP_RADIUS ? best : null;
}

function showZoneTargets() {
  const layer = document.getElementById('room-stuffie-layer');
  if (!layer) return;
  ZONES.forEach(zone => {
    const el = document.createElement('div');
    el.className = 'room-zone-target';
    el.id = 'zt-' + zone.id;
    el.style.cssText = `left:${zone.x}%;top:${zone.y}%;z-index:99`;
    el.title = zone.label;
    layer.appendChild(el);
  });
}

function hideZoneTargets() {
  document.querySelectorAll('.room-zone-target').forEach(el => el.remove());
}

function highlightNearestZone(clientX, clientY) {
  let best = null, bestDist = Infinity;
  ZONES.forEach(zone => {
    const pos = zoneScreenPos(zone);
    const d = Math.hypot(pos.x - clientX, pos.y - clientY);
    if (d < bestDist) { bestDist = d; best = zone; }
  });
  document.querySelectorAll('.room-zone-target').forEach(el => el.classList.remove('nearest'));
  if (best && bestDist < SNAP_RADIUS) {
    document.getElementById('zt-' + best.id)?.classList.add('nearest');
  }
}

// ── Color picker ──────────────────────────────────────────────────────────────

function initColorPicker(currentColor) {
  const btn    = document.getElementById('room-color-btn');
  const picker = document.getElementById('room-color-picker');
  const close  = document.getElementById('close-color-picker');

  btn.addEventListener('click', () => picker.classList.remove('hidden'));
  close.addEventListener('click', () => picker.classList.add('hidden'));

  picker.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const newColor = opt.dataset.color;
      picker.classList.add('hidden');
      document.getElementById('room-bg-img').src =
        `stuffieskidsrooms/${encodeURIComponent(ROOM_COLORS[newColor].file)}`;
      picker.querySelectorAll('.color-option').forEach(o =>
        o.classList.toggle('active', o.dataset.color === newColor));
      state.profile.room_color = newColor;
      await supabase.from('profiles').update({ room_color: newColor }).eq('id', state.profile.id);
    });
  });
}
