import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';

// ── State data: name, capital, SVG path in 960×580 viewBox ───────────────────

const STATES = [
  { key:'ME', name:'Maine',          capital:'Augusta',        path:'M 893,35 L 948,35 L 948,118 L 895,120 Z' },
  { key:'NH', name:'New Hampshire',  capital:'Concord',        path:'M 872,35 L 893,35 L 895,120 L 868,132 Z' },
  { key:'VT', name:'Vermont',        capital:'Montpelier',     path:'M 847,38 L 872,35 L 868,132 L 843,130 Z' },
  { key:'MA', name:'Massachusetts',  capital:'Boston',         path:'M 843,130 L 947,118 L 950,142 L 898,150 L 867,150 L 843,134 Z' },
  { key:'RI', name:'Rhode Island',   capital:'Providence',     path:'M 898,150 L 930,145 L 932,165 L 898,165 Z' },
  { key:'CT', name:'Connecticut',    capital:'Hartford',       path:'M 862,150 L 898,150 L 898,168 L 862,168 Z' },
  { key:'NY', name:'New York',       capital:'Albany',         path:'M 728,68 L 845,50 L 843,130 L 868,132 L 867,150 L 862,168 L 758,172 L 730,120 Z' },
  { key:'NJ', name:'New Jersey',     capital:'Trenton',        path:'M 862,168 L 882,162 L 888,208 L 862,212 Z' },
  { key:'PA', name:'Pennsylvania',   capital:'Harrisburg',     path:'M 755,155 L 862,148 L 862,168 L 758,172 Z' },
  { key:'DE', name:'Delaware',       capital:'Dover',          path:'M 868,198 L 882,195 L 886,222 L 868,225 Z' },
  { key:'MD', name:'Maryland',       capital:'Annapolis',      path:'M 818,192 L 868,185 L 868,198 L 868,225 L 818,218 L 800,208 Z' },
  { key:'VA', name:'Virginia',       capital:'Richmond',       path:'M 788,210 L 868,188 L 882,248 L 830,272 L 800,255 Z' },
  { key:'WV', name:'West Virginia',  capital:'Charleston',     path:'M 778,228 L 818,218 L 830,272 L 790,282 L 762,255 Z' },
  { key:'NC', name:'North Carolina', capital:'Raleigh',        path:'M 800,255 L 892,238 L 906,272 L 868,295 L 800,285 Z' },
  { key:'SC', name:'South Carolina', capital:'Columbia',       path:'M 868,295 L 906,272 L 924,342 L 878,355 Z' },
  { key:'GA', name:'Georgia',        capital:'Atlanta',        path:'M 755,342 L 812,338 L 878,355 L 840,305 L 800,285 L 785,310 Z' },
  { key:'FL', name:'Florida',        capital:'Tallahassee',    path:'M 755,342 L 812,338 L 840,500 L 820,575 L 780,580 L 757,545 L 750,498 Z' },
  { key:'AL', name:'Alabama',        capital:'Montgomery',     path:'M 720,345 L 778,340 L 782,455 L 720,458 Z' },
  { key:'MS', name:'Mississippi',    capital:'Jackson',        path:'M 663,345 L 720,345 L 720,458 L 665,460 Z' },
  { key:'TN', name:'Tennessee',      capital:'Nashville',      path:'M 663,310 L 790,295 L 790,330 L 778,340 L 663,345 Z' },
  { key:'KY', name:'Kentucky',       capital:'Frankfort',      path:'M 660,268 L 782,255 L 785,295 L 790,295 L 790,310 L 663,310 Z' },
  { key:'OH', name:'Ohio',           capital:'Columbus',       path:'M 730,158 L 782,155 L 790,248 L 738,252 Z' },
  { key:'IN', name:'Indiana',        capital:'Indianapolis',   path:'M 698,162 L 730,158 L 738,252 L 703,255 Z' },
  { key:'IL', name:'Illinois',       capital:'Springfield',    path:'M 660,162 L 698,162 L 703,255 L 667,268 L 660,235 Z' },
  { key:'MI', name:'Michigan',       capital:'Lansing',        path:'M 693,80 L 748,75 L 760,100 L 755,162 L 728,155 L 718,128 L 693,120 Z' },
  { key:'WI', name:'Wisconsin',      capital:'Madison',        path:'M 648,65 L 698,62 L 693,120 L 718,128 L 728,155 L 695,158 L 660,162 L 648,112 Z' },
  { key:'MN', name:'Minnesota',      capital:'Saint Paul',     path:'M 560,35 L 650,35 L 650,65 L 648,112 L 563,118 Z' },
  { key:'IA', name:'Iowa',           capital:'Des Moines',     path:'M 563,118 L 648,112 L 660,162 L 660,202 L 563,205 Z' },
  { key:'MO', name:'Missouri',       capital:'Jefferson City', path:'M 563,205 L 660,202 L 667,268 L 660,312 L 563,315 Z' },
  { key:'AR', name:'Arkansas',       capital:'Little Rock',    path:'M 563,315 L 660,312 L 665,382 L 563,385 Z' },
  { key:'LA', name:'Louisiana',      capital:'Baton Rouge',    path:'M 563,385 L 665,382 L 672,445 L 620,462 L 575,452 L 563,422 Z' },
  { key:'ND', name:'North Dakota',   capital:'Bismarck',       path:'M 405,35 L 563,35 L 563,118 L 408,122 Z' },
  { key:'SD', name:'South Dakota',   capital:'Pierre',         path:'M 408,122 L 563,118 L 563,205 L 410,208 Z' },
  { key:'NE', name:'Nebraska',       capital:'Lincoln',        path:'M 410,208 L 563,205 L 563,262 L 413,265 Z' },
  { key:'KS', name:'Kansas',         capital:'Topeka',         path:'M 413,265 L 563,262 L 563,315 L 415,318 Z' },
  { key:'OK', name:'Oklahoma',       capital:'Oklahoma City',  path:'M 415,318 L 563,315 L 563,382 L 490,382 L 490,402 L 415,402 Z' },
  { key:'TX', name:'Texas',          capital:'Austin',         path:'M 415,402 L 490,402 L 490,382 L 563,382 L 572,458 L 468,535 L 380,465 L 378,418 Z' },
  { key:'MT', name:'Montana',        capital:'Helena',         path:'M 180,35 L 405,35 L 408,132 L 295,135 L 295,82 L 180,82 Z' },
  { key:'WY', name:'Wyoming',        capital:'Cheyenne',       path:'M 295,132 L 413,128 L 415,235 L 298,238 Z' },
  { key:'CO', name:'Colorado',       capital:'Denver',         path:'M 298,235 L 415,232 L 415,318 L 300,322 Z' },
  { key:'ID', name:'Idaho',          capital:'Boise',          path:'M 180,35 L 295,35 L 295,132 L 255,135 L 258,200 L 182,200 L 182,82 Z' },
  { key:'UT', name:'Utah',           capital:'Salt Lake City', path:'M 255,135 L 300,132 L 300,322 L 255,318 Z' },
  { key:'AZ', name:'Arizona',        capital:'Phoenix',        path:'M 182,390 L 300,388 L 302,465 L 130,462 Z' },
  { key:'NV', name:'Nevada',         capital:'Carson City',    path:'M 182,200 L 258,200 L 255,318 L 182,390 Z' },
  { key:'NM', name:'New Mexico',     capital:'Santa Fe',       path:'M 300,318 L 415,315 L 418,438 L 302,435 Z' },
  { key:'WA', name:'Washington',     capital:'Olympia',        path:'M 60,35 L 180,35 L 182,82 L 152,122 L 60,122 Z' },
  { key:'OR', name:'Oregon',         capital:'Salem',          path:'M 60,122 L 152,122 L 182,82 L 185,202 L 60,200 Z' },
  { key:'CA', name:'California',     capital:'Sacramento',     path:'M 60,200 L 185,202 L 182,390 L 100,462 L 58,385 Z' },
  { key:'AK', name:'Alaska',         capital:'Juneau',         path:'M 28,480 L 175,480 L 175,575 L 28,575 Z' },
  { key:'HI', name:'Hawaii',         capital:'Honolulu',       path:'M 188,512 L 300,512 L 300,568 L 188,568 Z' },
];

// States by difficulty tier (for grades 1-2 recognition mode)
const EASY_STATES   = ['TX','CA','FL','AK','HI','MT','MN','WA','OR','GA','NY','CO','AZ','OH','MI'];
const MEDIUM_STATES = EASY_STATES.concat(['PA','IL','WI','MO','TN','NC','AL','MS','LA','AR','KY',
                                          'VA','IN','IA','WY','UT','ID','ND','SD','NE','KS','OK','NM','NV']);

// Capitals for grade 5
const CAPITAL_DISTRACTORS = [
  'Springfield','Columbus','Salem','Dover','Albany','Annapolis','Augusta','Austin',
  'Baton Rouge','Bismarck','Boise','Carson City','Charleston','Cheyenne','Columbia',
  'Columbus','Concord','Denver','Des Moines','Dover','Frankfort','Harrisburg',
  'Hartford','Helena','Honolulu','Indianapolis','Jackson','Jefferson City','Juneau',
  'Lansing','Lincoln','Little Rock','Madison','Montgomery','Montpelier','Nashville',
  'Oklahoma City','Olympia','Phoenix','Pierre','Providence','Raleigh','Richmond',
  'Sacramento','Saint Paul','Salem','Salt Lake City','Santa Fe','Topeka','Trenton',
];

// ── Game state ─────────────────────────────────────────────────────────────────
let queue = [];
let current = 0;
let phase = 'locate'; // 'locate' or 'capital'
let sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };

export function renderGeography() {
  const grade = state.profile.grade;
  queue = buildQueue(grade);
  current = 0;
  sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
  phase = 'locate';
  showQuestion();
}

function buildQueue(grade) {
  let pool;
  if (grade <= 2)      pool = STATES.filter(s => EASY_STATES.includes(s.key));
  else if (grade <= 4) pool = STATES.filter(s => MEDIUM_STATES.includes(s.key));
  else                 pool = [...STATES];
  return shuffle(pool).slice(0, 8);
}

function showQuestion() {
  if (current >= queue.length) { endGame(); return; }
  const grade = state.profile.grade;
  const target = queue[current];

  if (grade <= 2) {
    showRecognitionQuestion(target);
  } else if (phase === 'locate') {
    showLocateQuestion(target);
  } else {
    showCapitalQuestion(target);
  }
}

// ── Mode 1: highlighted state, choose name ─────────────────────────────────────
function showRecognitionQuestion(target) {
  const distractors = shuffle(STATES.filter(s => s.key !== target.key)).slice(0, 3);
  const choices = shuffle([target, ...distractors]);
  const correctIdx = choices.indexOf(target);

  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">Which state is highlighted? 🗺️</div>
      ${buildSVG(target.key, 'highlight')}
      <div class="choices-grid choices-grid--2col">
        ${choices.map((c, i) => `
          <button class="choice-btn" onclick="geoPickName(${i},${correctIdx})">${c.name}</button>
        `).join('')}
      </div>
    </div>
  `);

  window.geoPickName = (idx, ci) => {
    const isRight = idx === ci;
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === ci) btn.classList.add('correct');
      else if (i === idx && !isRight) btn.classList.add('wrong');
    });
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    setTimeout(() => { current++; showQuestion(); }, 1100);
  };
}

// ── Mode 2: click the named state on the map ──────────────────────────────────
function showLocateQuestion(target) {
  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">Tap <strong>${target.name}</strong> on the map! 🗺️</div>
      ${buildSVG(null, 'click')}
      <div class="geo-hint" id="geo-hint"></div>
    </div>
  `);

  window.geoClickState = (key) => {
    const isRight = key === target.key;
    highlightResult(key, target.key, isRight);
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;

    const hint = document.getElementById('geo-hint');
    if (hint) hint.textContent = isRight ? `✅ Correct!` : `❌ That's ${STATES.find(s=>s.key===key)?.name}. ${target.name} is highlighted.`;

    const grade = state.profile.grade;
    if (grade >= 5 && isRight) {
      setTimeout(() => { phase = 'capital'; showQuestion(); }, 1200);
    } else {
      setTimeout(() => { phase = 'locate'; current++; showQuestion(); }, 1400);
    }
  };
}

// ── Mode 3 (grade 5): pick the capital after locating the state ───────────────
function showCapitalQuestion(target) {
  const allCaps = CAPITAL_DISTRACTORS.filter(c => c !== target.capital);
  const distractors = shuffle(allCaps).slice(0, 3);
  const choices = shuffle([target.capital, ...distractors]);
  const correctIdx = choices.indexOf(target.capital);

  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">What is the capital of <strong>${target.name}</strong>? 🏛️</div>
      ${buildSVG(target.key, 'highlight')}
      <div class="choices-grid choices-grid--2col">
        ${choices.map((c, i) => `
          <button class="choice-btn" onclick="geoPickCapital(${i},${correctIdx})">${c}</button>
        `).join('')}
      </div>
    </div>
  `);

  window.geoPickCapital = (idx, ci) => {
    const isRight = idx === ci;
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === ci) btn.classList.add('correct');
      else if (i === idx && !isRight) btn.classList.add('wrong');
    });
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;
    setTimeout(() => { phase = 'locate'; current++; showQuestion(); }, 1100);
  };
}

// ── SVG builder ────────────────────────────────────────────────────────────────
function buildSVG(highlightKey, mode) {
  const paths = STATES.map(s => {
    const isTarget = s.key === highlightKey;
    const cls = isTarget ? 'geo-state geo-state--highlight' : 'geo-state';
    const click = mode === 'click' ? `onclick="geoClickState('${s.key}')"` : '';
    const tip = `<title>${s.name}</title>`;
    return `<path id="geo-${s.key}" class="${cls}" d="${s.path}" ${click}>${tip}</path>`;
  }).join('\n');

  // Alaska label
  const akLabel = '<text x="100" y="535" class="geo-inset-label">Alaska</text>';
  const hiLabel = '<text x="244" y="508" class="geo-inset-label">Hawaii</text>';
  const akBox = '<rect x="25" y="476" width="152" height="4" fill="#bbb" rx="1"/>';
  const hiBox = '<rect x="185" y="476" width="118" height="4" fill="#bbb" rx="1"/>';

  return `
    <div class="geo-map-wrap">
      <svg viewBox="0 0 960 590" class="geo-map" xmlns="http://www.w3.org/2000/svg">
        ${akBox}${hiBox}
        ${paths}
        ${akLabel}${hiLabel}
        ${STATES.map(s => {
          const cx = svgCenter(s.path);
          if (!cx) return '';
          return `<text x="${cx[0]}" y="${cx[1]}" class="geo-abbr" style="pointer-events:none">${s.key}</text>`;
        }).join('\n')}
      </svg>
    </div>
  `;
}

function highlightResult(clickedKey, targetKey, isRight) {
  const clickedEl = document.getElementById(`geo-${clickedKey}`);
  const targetEl  = document.getElementById(`geo-${targetKey}`);
  document.querySelectorAll('.geo-state').forEach(el => {
    el.style.pointerEvents = 'none';
  });
  if (isRight) {
    if (clickedEl) clickedEl.classList.add('geo-state--correct');
  } else {
    if (clickedEl) clickedEl.classList.add('geo-state--wrong');
    if (targetEl)  targetEl.classList.add('geo-state--highlight');
  }
}

// Rough centroid from a simple polygon path string
function svgCenter(pathStr) {
  const nums = pathStr.match(/[\d.]+/g);
  if (!nums || nums.length < 4) return null;
  const coords = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    coords.push([parseFloat(nums[i]), parseFloat(nums[i+1])]);
  }
  const cx = coords.reduce((s,c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s,c) => s + c[1], 0) / coords.length;
  return [Math.round(cx), Math.round(cy)];
}

// ── End screen ─────────────────────────────────────────────────────────────────
async function endGame() {
  await flushCoins({ game_type: 'geography', ...sessionStats });
  setView(`
    <div class="game-end">
      <div class="end-emoji">🗺️</div>
      <h2>Geography done!</h2>
      <p>${sessionStats.correct} out of ${sessionStats.questions_answered} correct</p>
      <p class="end-coins">+${sessionStats.coins_earned} coins earned!</p>
      <div class="end-actions">
        <button class="btn btn-primary" onclick="window.location.hash='#game/geography'">Play Again</button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}

function progressBar() {
  const total = state.profile.grade >= 5 ? queue.length * 2 : queue.length;
  const done = state.profile.grade >= 5 ? current * 2 + (phase === 'capital' ? 1 : 0) : current;
  const pct = Math.round((done / total) * 100);
  return `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${done}/${total}</span>
    </div>
  `;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
