import { supabase } from './supabase.js';
import { state } from './state.js';
import { setView, showChrome, hideChrome, toast } from './ui.js';

const AVATARS = ['🐱','🐶','🐰','🦊','🐸','🐨','🐼','🦁','🐯','🦄','🐉','🦋'];

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await loadSession(session.user);
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await loadSession(session.user);
    } else {
      state.user = null;
      state.profiles = [];
      state.profile = null;
      hideChrome();
      renderLogin();
    }
  });
}

async function loadSession(user) {
  state.user = user;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('parent_user_id', user.id)
    .order('created_at');
  state.profiles = profiles || [];

  if (state.profiles.length === 0) {
    hideChrome();
    renderAddProfile(true); // first profile — no back button
  } else if (!state.profile || !state.profiles.find(p => p.id === state.profile.id)) {
    // No active profile selected yet — show picker
    hideChrome();
    renderProfilePicker();
  } else {
    // Re-sync active profile from fresh data
    state.profile = state.profiles.find(p => p.id === state.profile.id);
    showChrome(state.profile);
  }
}

export function activateProfile(profile) {
  state.profile = profile;
  showChrome(profile);
  window.location.hash = '#home';
}

export async function logout() {
  state.profile = null;
  await supabase.auth.signOut();
}

// ── Profile Picker ────────────────────────────────────────────────────────────

export function renderProfilePicker() {
  hideChrome();
  setView(`
    <div class="auth-screen">
      <div class="auth-logo">🐻 <span class="auth-logo-text">Stuffie City</span></div>
      <h3 style="text-align:center;margin-bottom:24px;color:var(--purple)">Who's playing?</h3>
      <div class="profile-picker-grid">
        ${state.profiles.map(p => `
          <button class="profile-pick-btn" onclick="pickProfile('${p.id}')">
            <div class="profile-pick-avatar">${p.avatar_emoji}</div>
            <div class="profile-pick-name">${p.username}</div>
            <div class="profile-pick-grade">${gradeLabel(p.grade)}</div>
            <div class="profile-pick-coins">🪙 ${p.coins}</div>
          </button>
        `).join('')}
        <button class="profile-pick-btn profile-pick-add" onclick="addProfile()">
          <div class="profile-pick-avatar">➕</div>
          <div class="profile-pick-name">Add Profile</div>
        </button>
      </div>
      <button class="btn btn-outline" style="margin-top:24px" onclick="doSignOut()">Sign Out</button>
    </div>
  `);

  window.pickProfile = (id) => {
    const profile = state.profiles.find(p => p.id === id);
    if (profile) activateProfile(profile);
  };
  window.addProfile = () => renderAddProfile(false);
  window.doSignOut = () => supabase.auth.signOut();
}

// ── Add Profile form ──────────────────────────────────────────────────────────

export function renderAddProfile(isFirst) {
  setView(`
    <div class="auth-screen">
      <div class="auth-logo">🐻 <span class="auth-logo-text">Stuffie City</span></div>
      <h3 style="text-align:center;margin-bottom:16px;color:var(--purple)">
        ${isFirst ? 'Create your first profile!' : 'Add a new profile!'}
      </h3>
      <div class="auth-form">
        <input class="field" type="text" id="ap-username" placeholder="Name (e.g. Macy)" maxlength="20">
        <label class="field-label">What grade are you in?</label>
        <div class="grade-picker">
          ${[1,2,3,4,5].map(g => `<button class="grade-btn" data-grade="${g}" onclick="apPickGrade(${g})">${g}${ordinal(g)} Grade</button>`).join('')}
        </div>
        <label class="field-label">Pick your avatar!</label>
        <div class="avatar-picker">
          ${AVATARS.map(a => `<button class="avatar-btn" data-av="${a}" onclick="apPickAvatar('${a}')">${a}</button>`).join('')}
        </div>
        <button class="btn btn-primary" onclick="apSave()">
          ${isFirst ? 'Start Playing! 🎉' : 'Add Profile 🎉'}
        </button>
        ${!isFirst ? `<button class="btn btn-outline" style="margin-top:8px" onclick="apBack()">← Back</button>` : ''}
      </div>
    </div>
  `);

  window.apPickGrade  = (g) => document.querySelectorAll('.grade-btn').forEach(b => b.classList.toggle('selected', +b.dataset.grade === g));
  window.apPickAvatar = (a) => document.querySelectorAll('.avatar-btn').forEach(b => b.classList.toggle('selected', b.dataset.av === a));
  window.apBack       = () => renderProfilePicker();

  window.apSave = async () => {
    const username  = document.getElementById('ap-username').value.trim();
    const gradeBtn  = document.querySelector('.grade-btn.selected');
    const avatarBtn = document.querySelector('.avatar-btn.selected');
    if (!username)  return toast("What's your name?", 'error');
    if (!gradeBtn)  return toast('Pick your grade!', 'error');
    if (!avatarBtn) return toast('Pick your avatar!', 'error');

    const { data, error } = await supabase.from('profiles').insert({
      parent_user_id: state.user.id,
      username,
      grade: +gradeBtn.dataset.grade,
      avatar_emoji: avatarBtn.dataset.av,
      coins: 30,
    }).select().single();

    if (error) return toast('Save failed: ' + error.message, 'error');

    state.profiles.push(data);
    toast(`Welcome, ${data.username}! 🎉`, 'success');
    activateProfile(data);
  };
}

// ── Login / Register ──────────────────────────────────────────────────────────

export function renderLogin() {
  hideChrome();
  setView(`
    <div class="auth-screen">
      <div class="auth-logo">🐻 <span class="auth-logo-text">Stuffie City</span></div>
      <div class="auth-tabs">
        <button class="tab-btn active" id="tab-login" onclick="switchTab('login')">Sign In</button>
        <button class="tab-btn" id="tab-register" onclick="switchTab('register')">New Account</button>
      </div>

      <div id="login-form" class="auth-form">
        <input class="field" type="email" id="login-email" placeholder="Parent email address" autocomplete="email">
        <input class="field" type="password" id="login-pwd" placeholder="Password" autocomplete="current-password">
        <button class="btn btn-primary" onclick="doLogin()">Sign In ✨</button>
      </div>

      <div id="register-form" class="auth-form hidden">
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:12px;line-height:1.5">
          Create one account for your family. You'll set up each kid's profile after signing in.
        </p>
        <input class="field" type="email" id="reg-email" placeholder="Parent email address" autocomplete="email">
        <input class="field" type="password" id="reg-pwd" placeholder="Create a password" autocomplete="new-password">
        <button class="btn btn-primary" onclick="doRegister()">Create Family Account 🎉</button>
      </div>
    </div>
  `);

  window.switchTab = (tab) => {
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  };

  window.doLogin = async () => {
    const email = document.getElementById('login-email').value.trim();
    const pwd   = document.getElementById('login-pwd').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) toast('Oops! ' + friendlyError(error.message), 'error');
  };

  window.doRegister = async () => {
    const email = document.getElementById('reg-email').value.trim();
    const pwd   = document.getElementById('reg-pwd').value;
    if (!email || !pwd) return toast('Need an email and password!', 'error');

    const { data, error } = await supabase.auth.signUp({ email, password: pwd });
    if (error) return toast('Oops! ' + friendlyError(error.message), 'error');

    if (!data.session) {
      setView(`
        <div class="auth-screen" style="text-align:center">
          <div style="font-size:4rem;margin-bottom:16px">📬</div>
          <h2 style="color:var(--purple);margin-bottom:12px">Check your email!</h2>
          <p style="color:var(--muted);line-height:1.6;margin-bottom:20px">
            We sent a confirmation link to<br><strong>${email}</strong><br><br>
            Click it to finish creating your account, then come back and sign in.
          </p>
          <button class="btn btn-outline" onclick="switchTab('login')">← Back to Sign In</button>
        </div>
      `);
      return;
    }

    // Email confirm off — session exists, go straight to adding first profile
    state.user = data.user;
    state.profiles = [];
    renderAddProfile(true);
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n) {
  return ['st','nd','rd','th'][Math.min(n-1,3)];
}

function gradeLabel(g) {
  return `${g}${ordinal(g)} Grade`;
}

function friendlyError(msg) {
  if (msg.includes('Invalid login')) return 'Wrong email or password.';
  if (msg.includes('already registered')) return 'That email is already used.';
  if (msg.includes('Password should')) return 'Password needs at least 6 characters.';
  return msg;
}
