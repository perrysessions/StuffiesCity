import { initAuth, logout } from './auth.js';
import { initRouter, registerRoute } from './router.js';
import { IS_CONFIGURED } from './supabase.js';

async function boot() {
  if (!IS_CONFIGURED) {
    document.getElementById('view').innerHTML = `
      <div style="max-width:500px;margin:40px auto;font-family:system-ui;padding:20px">
        <div style="font-size:3rem;text-align:center;margin-bottom:16px">🐻 Stuffie City</div>
        <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
          <h2 style="color:#a855f7;margin-bottom:12px">⚙️ Setup Required</h2>
          <p style="margin-bottom:16px;line-height:1.6">To use Stuffie City, connect it to a free Supabase backend:</p>
          <ol style="line-height:2;padding-left:20px;color:#2d1b4e">
            <li>Go to <strong>supabase.com</strong> and create a free account</li>
            <li>Create a new project (any name, pick a region)</li>
            <li>Go to <strong>SQL Editor</strong> and run the contents of <code>supabase-schema.sql</code></li>
            <li>Go to <strong>Settings → API</strong> and copy your Project URL and anon key</li>
            <li>Open <code>stuffie-city/src/config.js</code> and paste them in</li>
            <li>Refresh this page</li>
          </ol>
          <div style="background:#f3e8ff;border-radius:8px;padding:12px;margin-top:16px;font-size:0.85rem;color:#6b21a8">
            💡 Tip: In Supabase → Authentication → Settings, turn off "Confirm email" so your girls can sign up without email verification.
          </div>
        </div>
      </div>
    `;
    return;
  }

  await initAuth();

  // Lazy-load route handlers to keep boot fast
  registerRoute('#home', async () => {
    const { renderHome } = await import('./home.js');
    renderHome();
  });
  registerRoute('#games', async () => {
    const { renderGamesMenu } = await import('./games/menu.js');
    renderGamesMenu();
  });
  registerRoute('#game/english', async () => {
    const { renderEnglish } = await import('./games/english.js');
    renderEnglish();
  });
  registerRoute('#game/math', async () => {
    const { renderMath } = await import('./games/math.js');
    renderMath();
  });
  registerRoute('#game/reading', async () => {
    const { renderReading } = await import('./games/reading.js');
    renderReading();
  });
  registerRoute('#game/geography', async () => {
    const { renderGeography } = await import('./games/geography.js');
    renderGeography();
  });
  registerRoute('#shop', async () => {
    const { renderShop } = await import('./shop.js');
    renderShop();
  });
  registerRoute('#collection', async () => {
    const { renderFamilyCollection } = await import('./collection.js');
    renderFamilyCollection();
  });
  initRouter();

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('switch-btn').addEventListener('click', async () => {
    const { renderProfilePicker } = await import('./auth.js');
    renderProfilePicker();
  });
}

boot();
