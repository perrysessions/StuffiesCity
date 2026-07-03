import { state } from './state.js';
import { supabase } from './supabase.js';
import { setView, showModal, closeModal, toast, updateCoinDisplay } from './ui.js';
import { BAGS, rollStuffie, stuffieCard } from './stuffies.js';

export function renderShop() {
  const coins = state.profile.coins;

  const bagCards = Object.entries(BAGS).map(([key, bag]) => {
    const canAfford = coins >= bag.cost;
    return `
      <div class="bag-card ${canAfford ? '' : 'bag-card--locked'}">
        <div class="bag-emoji">${bag.emoji}</div>
        <div class="bag-name">${bag.name}</div>
        <div class="bag-desc">${bag.desc}</div>
        <div class="bag-cost">🪙 ${bag.cost}</div>
        <button class="btn btn-primary${canAfford ? '' : ' btn-disabled'}"
          onclick="openBag('${key}')" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'Open!' : 'Need more coins'}
        </button>
      </div>
    `;
  }).join('');

  setView(`
    <div class="shop-screen">
      <h2>🛍️ Blind Bag Shop</h2>
      <p class="shop-balance">You have 🪙 <strong>${coins}</strong> coins</p>
      <div class="bag-grid">${bagCards}</div>
    </div>
  `);

  window.openBag = (bagKey) => openBag(bagKey);
}

async function openBag(bagKey) {
  const bag = BAGS[bagKey];
  if (state.profile.coins < bag.cost) return toast('Not enough coins!', 'error');

  // Deduct coins optimistically
  state.profile.coins -= bag.cost;
  updateCoinDisplay(state.profile.coins);

  // Roll the stuffie
  const stuffie = rollStuffie(bagKey);

  // Check if already owned
  const { data: existing } = await supabase
    .from('user_stuffies')
    .select('id')
    .eq('profile_id', state.profile.id)
    .eq('stuffie_key', stuffie.key)
    .limit(1);

  const isDuplicate = existing && existing.length > 0;
  const refund = isDuplicate ? Math.floor(bag.cost / 2) : 0;

  if (isDuplicate) {
    state.profile.coins += refund;
    updateCoinDisplay(state.profile.coins);
  }

  // Show opening animation
  showModal(`
    <div class="bag-opening">
      <div class="bag-shake" id="bag-shaking">${bag.emoji}</div>
      <div class="bag-reveal hidden" id="bag-reveal">
        ${stuffieCard(stuffie, 'large')}
        ${isDuplicate
          ? `<div class="reveal-title">You already have this one! 😅</div>
             <div class="reveal-refund">Got 🪙 ${refund} coins back</div>`
          : `<div class="reveal-title">You got a ${stuffie.rarity.toUpperCase()}!</div>`
        }
        <button class="btn btn-primary" onclick="confirmStuffie()">
          ${isDuplicate ? 'OK!' : 'Add to Collection! 🎉'}
        </button>
      </div>
    </div>
  `);

  setTimeout(() => {
    document.getElementById('bag-shaking')?.classList.add('hidden');
    document.getElementById('bag-reveal')?.classList.remove('hidden');
  }, 1400);

  // Save coins; only insert stuffie if not a duplicate
  const ops = [
    supabase.from('profiles').update({ coins: state.profile.coins }).eq('id', state.profile.id),
  ];
  if (!isDuplicate) {
    ops.push(supabase.from('user_stuffies').insert({
      profile_id: state.profile.id,
      stuffie_key: stuffie.key,
      rarity: stuffie.rarity,
    }));
  }
  const results = await Promise.all(ops);
  if (results.some(r => r.error)) toast('Something went wrong saving!', 'error');

  window.confirmStuffie = () => {
    closeModal();
    renderShop();
  };
}
