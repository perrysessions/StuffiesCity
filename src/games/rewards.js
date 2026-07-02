import { state, bumpStreak, resetStreak } from '../state.js';
import { supabase } from '../supabase.js';
import { updateCoinDisplay, toast } from '../ui.js';

const ATTEMPT_COINS = 1;
const CORRECT_COINS = 5;
const STREAK_BONUS = { 3: 3, 5: 5, 10: 10 };

export function handleAnswer(correct) {
  let earned = ATTEMPT_COINS;
  let msg = `+${ATTEMPT_COINS} coin for trying!`;

  if (correct) {
    earned += CORRECT_COINS;
    bumpStreak();
    const bonus = STREAK_BONUS[state.streak];
    if (bonus) {
      earned += bonus;
      msg = `⭐ ${state.streak} in a row! +${earned} coins!`;
    } else {
      msg = `✅ Correct! +${earned} coins!`;
    }
  } else {
    resetStreak();
    msg = `Not quite — keep going! +${ATTEMPT_COINS} coin`;
  }

  state.profile.coins += earned;
  updateCoinDisplay(state.profile.coins);
  toast(msg, correct ? 'success' : 'info');
  return earned;
}

export async function flushCoins(sessionData) {
  if (!state.profile) return;
  await supabase
    .from('profiles')
    .update({ coins: state.profile.coins })
    .eq('id', state.profile.id);

  if (sessionData) {
    await supabase.from('game_sessions').insert({
      profile_id: state.profile.id,
      ...sessionData,
    });
  }
}
