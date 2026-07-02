import { state } from './state.js';
import { renderLogin } from './auth.js';
import { setActiveNav } from './ui.js';

const handlers = {};

export function registerRoute(hash, fn) {
  handlers[hash] = fn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  const hash = window.location.hash || '#home';

  if (!state.user) {
    renderLogin();
    return;
  }

  if (!state.profile) {
    const { renderProfilePicker } = await import('./auth.js');
    renderProfilePicker();
    return;
  }

  setActiveNav(hash);

  // Dynamic pattern: #collection/userId
  const collectionMatch = hash.match(/^#collection\/(.+)$/);
  if (collectionMatch) {
    const { renderCollection } = await import('./collection.js');
    renderCollection(collectionMatch[1]);
    return;
  }

  const handler = handlers[hash];
  if (handler) {
    handler();
  } else {
    handlers['#home']?.();
  }
}
