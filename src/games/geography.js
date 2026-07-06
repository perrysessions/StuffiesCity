import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';

// FIPS code → state info
const STATE_INFO = {
  '01':{ key:'AL', name:'Alabama',        capital:'Montgomery' },
  '02':{ key:'AK', name:'Alaska',          capital:'Juneau' },
  '04':{ key:'AZ', name:'Arizona',         capital:'Phoenix' },
  '05':{ key:'AR', name:'Arkansas',        capital:'Little Rock' },
  '06':{ key:'CA', name:'California',      capital:'Sacramento' },
  '08':{ key:'CO', name:'Colorado',        capital:'Denver' },
  '09':{ key:'CT', name:'Connecticut',     capital:'Hartford' },
  '10':{ key:'DE', name:'Delaware',        capital:'Dover' },
  '12':{ key:'FL', name:'Florida',         capital:'Tallahassee' },
  '13':{ key:'GA', name:'Georgia',         capital:'Atlanta' },
  '15':{ key:'HI', name:'Hawaii',          capital:'Honolulu' },
  '16':{ key:'ID', name:'Idaho',           capital:'Boise' },
  '17':{ key:'IL', name:'Illinois',        capital:'Springfield' },
  '18':{ key:'IN', name:'Indiana',         capital:'Indianapolis' },
  '19':{ key:'IA', name:'Iowa',            capital:'Des Moines' },
  '20':{ key:'KS', name:'Kansas',          capital:'Topeka' },
  '21':{ key:'KY', name:'Kentucky',        capital:'Frankfort' },
  '22':{ key:'LA', name:'Louisiana',       capital:'Baton Rouge' },
  '23':{ key:'ME', name:'Maine',           capital:'Augusta' },
  '24':{ key:'MD', name:'Maryland',        capital:'Annapolis' },
  '25':{ key:'MA', name:'Massachusetts',   capital:'Boston' },
  '26':{ key:'MI', name:'Michigan',        capital:'Lansing' },
  '27':{ key:'MN', name:'Minnesota',       capital:'Saint Paul' },
  '28':{ key:'MS', name:'Mississippi',     capital:'Jackson' },
  '29':{ key:'MO', name:'Missouri',        capital:'Jefferson City' },
  '30':{ key:'MT', name:'Montana',         capital:'Helena' },
  '31':{ key:'NE', name:'Nebraska',        capital:'Lincoln' },
  '32':{ key:'NV', name:'Nevada',          capital:'Carson City' },
  '33':{ key:'NH', name:'New Hampshire',   capital:'Concord' },
  '34':{ key:'NJ', name:'New Jersey',      capital:'Trenton' },
  '35':{ key:'NM', name:'New Mexico',      capital:'Santa Fe' },
  '36':{ key:'NY', name:'New York',        capital:'Albany' },
  '37':{ key:'NC', name:'North Carolina',  capital:'Raleigh' },
  '38':{ key:'ND', name:'North Dakota',    capital:'Bismarck' },
  '39':{ key:'OH', name:'Ohio',            capital:'Columbus' },
  '40':{ key:'OK', name:'Oklahoma',        capital:'Oklahoma City' },
  '41':{ key:'OR', name:'Oregon',          capital:'Salem' },
  '42':{ key:'PA', name:'Pennsylvania',    capital:'Harrisburg' },
  '44':{ key:'RI', name:'Rhode Island',    capital:'Providence' },
  '45':{ key:'SC', name:'South Carolina',  capital:'Columbia' },
  '46':{ key:'SD', name:'South Dakota',    capital:'Pierre' },
  '47':{ key:'TN', name:'Tennessee',       capital:'Nashville' },
  '48':{ key:'TX', name:'Texas',           capital:'Austin' },
  '49':{ key:'UT', name:'Utah',            capital:'Salt Lake City' },
  '50':{ key:'VT', name:'Vermont',         capital:'Montpelier' },
  '51':{ key:'VA', name:'Virginia',        capital:'Richmond' },
  '53':{ key:'WA', name:'Washington',      capital:'Olympia' },
  '54':{ key:'WV', name:'West Virginia',   capital:'Charleston' },
  '55':{ key:'WI', name:'Wisconsin',       capital:'Madison' },
  '56':{ key:'WY', name:'Wyoming',         capital:'Cheyenne' },
};

const ALL_STATES = Object.values(STATE_INFO);

// Grade-based state pools (easier/larger states first)
const EASY_KEYS  = new Set(['TX','CA','FL','AK','HI','MT','MN','WA','OR','GA','NY','CO','AZ','OH','MI','IL']);
const MEDIUM_KEYS = new Set([...EASY_KEYS, 'PA','WI','MO','TN','NC','AL','MS','LA','AR','KY',
                              'VA','IN','IA','WY','UT','ID','ND','SD','NE','KS','OK','NM','NV','SC']);

// Capitals for distractor pool
const ALL_CAPITALS = ALL_STATES.map(s => s.capital);

// ── Game state ─────────────────────────────────────────────────────────────────
let queue = [];
let current = 0;
let phase = 'locate';
let sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
let d3Ref = null;
let topoRef = null;
let usDataRef = null;

export async function renderGeography() {
  const grade = state.profile.grade;
  queue = buildQueue(grade);
  current = 0;
  sessionStats = { questions_answered: 0, correct: 0, coins_earned: 0 };
  phase = 'locate';

  // Show loading state while assets fetch
  setView(`<div class="game-screen" style="text-align:center;padding:40px">
    <div style="font-size:2rem">🗺️</div>
    <p style="color:var(--muted);margin-top:12px">Loading map…</p>
  </div>`);

  // Load D3 + topojson + US Atlas (cached after first load)
  try {
    if (!d3Ref) {
      [d3Ref, topoRef] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/d3@7/+esm'),
        import('https://cdn.jsdelivr.net/npm/topojson-client@3/+esm'),
      ]);
    }
    if (!usDataRef) {
      usDataRef = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r => r.json());
    }
  } catch (e) {
    setView(`<div class="game-screen" style="text-align:center;padding:40px">
      <p style="color:red">Could not load map. Check your internet connection.</p>
      <a href="#games" class="btn btn-outline" style="margin-top:16px">Back</a>
    </div>`);
    return;
  }

  showQuestion();
}

function buildQueue(grade) {
  let pool;
  if (grade <= 2)      pool = ALL_STATES.filter(s => EASY_KEYS.has(s.key));
  else if (grade <= 4) pool = ALL_STATES.filter(s => MEDIUM_KEYS.has(s.key));
  else                 pool = [...ALL_STATES];
  const fipsLookup = Object.fromEntries(
    Object.entries(STATE_INFO).map(([fips, info]) => [info.key, fips])
  );
  return shuffle(pool).slice(0, 8).map(s => ({ ...s, fips: fipsLookup[s.key] }));
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

// ── Mode 1: state highlighted → pick name ─────────────────────────────────────
function showRecognitionQuestion(target) {
  const distractors = shuffle(ALL_STATES.filter(s => s.key !== target.key)).slice(0, 3);
  const choices = shuffle([target, ...distractors]);
  const correctIdx = choices.indexOf(target);

  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">Which state is highlighted? 🗺️</div>
      <div class="geo-map-wrap" id="geo-map-wrap"></div>
      <div class="choices-grid choices-grid--2col" style="margin-top:12px">
        ${choices.map((c, i) => `
          <button class="choice-btn" onclick="geoPickName(${i},${correctIdx})">${c.name}</button>
        `).join('')}
      </div>
    </div>
  `);

  renderD3Map('geo-map-wrap', target.key, 'highlight');

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

// ── Mode 2: click the named state ─────────────────────────────────────────────
function showLocateQuestion(target) {
  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">Tap <strong>${target.name}</strong> on the map! 🗺️</div>
      <div class="geo-map-wrap" id="geo-map-wrap"></div>
      <div class="geo-hint" id="geo-hint"></div>
    </div>
  `);

  renderD3Map('geo-map-wrap', null, 'click');

  window.geoClickState = (fips) => {
    const clicked = STATE_INFO[fips];
    if (!clicked) return;
    const isRight = fips === target.fips;
    markMapResult(fips, target.fips, isRight);

    const hint = document.getElementById('geo-hint');
    if (hint) {
      hint.textContent = isRight
        ? '✅ Correct!'
        : `❌ That's ${clicked.name}. ${target.name} is now highlighted.`;
    }
    const earned = handleAnswer(isRight);
    sessionStats.questions_answered++;
    if (isRight) sessionStats.correct++;
    sessionStats.coins_earned += earned;

    const grade = state.profile.grade;
    if (grade >= 5 && isRight) {
      setTimeout(() => { phase = 'capital'; showQuestion(); }, 1300);
    } else {
      setTimeout(() => { phase = 'locate'; current++; showQuestion(); }, 1500);
    }
  };
}

// ── Mode 3: pick the capital (grade 5) ────────────────────────────────────────
function showCapitalQuestion(target) {
  const distractors = shuffle(ALL_CAPITALS.filter(c => c !== target.capital)).slice(0, 3);
  const choices = shuffle([target.capital, ...distractors]);
  const correctIdx = choices.indexOf(target.capital);

  setView(`
    <div class="game-screen geo-screen">
      ${progressBar()}
      <div class="geo-prompt">What is the capital of <strong>${target.name}</strong>? 🏛️</div>
      <div class="geo-map-wrap" id="geo-map-wrap"></div>
      <div class="choices-grid choices-grid--2col" style="margin-top:12px">
        ${choices.map((c, i) => `
          <button class="choice-btn" onclick="geoPickCapital(${i},${correctIdx})">${c}</button>
        `).join('')}
      </div>
    </div>
  `);

  renderD3Map('geo-map-wrap', target.key, 'highlight');

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

// ── D3 map renderer ───────────────────────────────────────────────────────────
function renderD3Map(containerId, highlightKey, mode) {
  const d3 = d3Ref;
  const topojson = topoRef;
  const us = usDataRef;

  const container = document.getElementById(containerId);
  if (!container) return;

  const width = 960;
  const height = 600;

  const projection = d3.geoAlbersUsa()
    .scale(1280)
    .translate([width / 2, height / 2]);

  const pathGen = d3.geoPath().projection(projection);

  const stateFeatures = topojson.feature(us, us.objects.states).features;

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'geo-map');

  // State mesh (borders between states)
  svg.append('path')
    .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
    .attr('class', 'geo-mesh')
    .attr('d', pathGen);

  // Nation outline
  svg.append('path')
    .datum(topojson.feature(us, us.objects.nation))
    .attr('class', 'geo-nation')
    .attr('d', pathGen);

  // State fills
  const statePaths = svg.selectAll('.geo-state')
    .data(stateFeatures)
    .enter()
    .append('path')
    .attr('class', d => {
      const info = STATE_INFO[d.id.toString().padStart(2,'0')];
      if (!info) return 'geo-state';
      return info.key === highlightKey ? 'geo-state geo-state--highlight' : 'geo-state';
    })
    .attr('id', d => {
      const fips = d.id.toString().padStart(2,'0');
      return `geo-path-${fips}`;
    })
    .attr('d', pathGen);

  // State abbreviation labels
  svg.selectAll('.geo-label')
    .data(stateFeatures)
    .enter()
    .append('text')
    .attr('class', 'geo-abbr')
    .attr('transform', d => {
      const c = pathGen.centroid(d);
      return c && !isNaN(c[0]) ? `translate(${c})` : 'translate(-100,-100)';
    })
    .text(d => {
      if (state.profile.grade >= 2) return '';
      const info = STATE_INFO[d.id.toString().padStart(2,'0')];
      return info ? info.key : '';
    });

  if (mode === 'click') {
    statePaths
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        const fips = d.id.toString().padStart(2,'0');
        if (STATE_INFO[fips]) window.geoClickState(fips);
      });
  }
}

function markMapResult(clickedFips, targetFips, isRight) {
  const clickedEl = document.getElementById(`geo-path-${clickedFips}`);
  const targetEl  = document.getElementById(`geo-path-${targetFips}`);

  // Disable all clicks
  document.querySelectorAll('.geo-state').forEach(el => el.style.pointerEvents = 'none');

  if (isRight) {
    clickedEl?.classList.add('geo-state--correct');
  } else {
    clickedEl?.classList.add('geo-state--wrong');
    targetEl?.classList.add('geo-state--highlight');
  }
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
        <button class="btn btn-primary" onclick="if(window.location.hash==='#game/geography'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/geography'}">Play Again</button>
        <a href="#games" class="btn btn-outline">Other Games</a>
      </div>
    </div>
  `);
}

function progressBar() {
  const total = state.profile.grade >= 5 ? queue.length * 2 : queue.length;
  const done = state.profile.grade >= 5
    ? current * 2 + (phase === 'capital' ? 1 : 0)
    : current;
  const pct = Math.round((done / total) * 100);
  return `
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="progress-label">${done}/${total}</span>
    </div>
  `;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
