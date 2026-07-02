export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

export function setView(html) {
  document.getElementById('view').innerHTML = html;
}

export function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-box').innerHTML = html;
  overlay.classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

export function showChrome(profile) {
  document.getElementById('top-bar').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
  document.getElementById('user-display').textContent = profile.avatar_emoji + ' ' + profile.username;
  document.getElementById('coin-count').textContent = profile.coins;
}

export function hideChrome() {
  document.getElementById('top-bar').classList.add('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
}

export function updateCoinDisplay(coins) {
  const el = document.getElementById('coin-count');
  if (el) el.textContent = coins;
}

export function setActiveNav(hash) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const href = btn.getAttribute('href');
    btn.classList.toggle('active', href === hash || (hash.startsWith('#collection') && href === '#collection'));
  });
}
