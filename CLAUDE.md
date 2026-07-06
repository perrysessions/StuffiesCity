# Stuffie City

Kids learning game (3 girls, grades 1–5). Vanilla ES modules, no build step, Supabase backend.
Run: `python3 -m http.server 8001` → http://localhost:8001
Keys live in `src/config.js` (gitignored). Supabase project: `ggnxoidvhkvzmrslqpqh`.

### Architecture
Hash-based SPA. `src/main.js` boots, lazy-registers routes, calls `initAuth()`. `src/router.js` maps hashes to view functions. `src/state.js` holds `{ user, profile, streak }`. All Supabase calls go through `src/supabase.js` (client from esm.sh CDN).

| File | Role |
|---|---|
| `src/auth.js` | Login/register/logout + multi-profile picker; one parent account → multiple kid profiles |
| `src/ui.js` | `setView()`, `showChrome()`, `hideChrome()`, `toast()`, `updateCoinDisplay()` — shared UI helpers |
| `src/stuffies.js` | 40-animal roster + `BAGS` config + `rollStuffie(bagKey)` + `stuffieCard()` |
| `src/shop.js` | Bag purchase → shake animation → duplicate check → insert `user_stuffies` + deduct coins |
| `src/collection.js` | Fetches `user_stuffies`, merges with `STUFFIE_ROSTER` via `rosterMap[stuffie_key]` |
| `src/home.js` | Shelf (6 newest stuffies), friend requests, quick-action cards |
| `src/friends.js` | Search by username, send/accept requests, link to friend's collection |
| `src/games/menu.js` | Games menu screen; renders cards for English, Math, Reading, Geography |
| `src/games/english.js` | Fill-in-blank + tap-to-order; data in `english-data.js` (10 Qs/grade) |
| `src/games/math.js` | Procedural arithmetic, grade-scaled; 4-choice buttons |
| `src/games/reading.js` | Passage + 4-choice question; data in `reading-data.js` (50 passages/grade, 250 total) |
| `src/games/geography.js` | US map game; D3+topojson from CDN; grade 1-2=recognition, 3-4=click-to-find, 5=capitals; `STATE_INFO` keyed by FIPS code |
| `src/games/rewards.js` | `handleAnswer(correct)` → coins + streak; `flushCoins()` writes to Supabase |
| `styles/main.css` | Warm earthy/safari theme (amber, brown, tan, cream); CSS variables in `:root` |
| `styles/rarity.css` | CSS-only rarity effects: common=plain, uncommon=green, rare=blue pulse, epic=bob, legendary=gold spin, mythic=rainbow float |

### Auth flow (email confirm ON)
1. `signUp` → no session returned → show "check email" screen
2. User clicks email link → `onAuthStateChange` fires → `loadSession` → no profile row → `renderAddProfile`
3. User saves profile → `profiles` INSERT → home
- One parent email account can have multiple kid profiles (`parent_user_id` FK)
- Profile picker shown on login if multiple profiles exist

### DB tables (all RLS-enabled)
`profiles` · `user_stuffies` · `friendships` · `game_sessions`
Friends policies on `profiles` and `user_stuffies` cross-reference `friendships` — tables must all exist before policies are created (see `supabase-schema.sql`).

### Coin economy
+1 attempt · +5 correct · +3/+5/+10 streak bonus at 3/5/10 in a row. Flushed to `profiles.coins` at end of game session via `flushCoins()`. Shop deducts immediately and writes in parallel with stuffie insert. Duplicate stuffie roll = half bag cost refunded, no insert.

### Known issues / next steps
- **Supabase Site URL** must be set to the deployed URL (GitHub Pages or localhost) so confirmation email links redirect correctly
- `stuffie_key` in DB is the roster `key` field; always resolve via `rosterMap[stuffie_key]` before rendering — raw DB rows have no `emoji` or `name`
- GitHub Pages deploys via `.github/workflows/deploy.yml`; Pages source must be set to "GitHub Actions" in repo Settings → Pages
