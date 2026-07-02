export const state = {
  user: null,      // Supabase auth user
  profiles: [],    // all child profiles under this account
  profile: null,   // active child profile { id, parent_user_id, username, grade, coins, avatar_emoji }
  streak: 0,
};

export function resetStreak() { state.streak = 0; }
export function bumpStreak()  { state.streak++; }
