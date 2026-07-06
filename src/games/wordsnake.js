import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';
import { ENGLISH_QUESTIONS } from './english-data.js';

const TAU = Math.PI * 2;

// Extra distractors to pad choices to 4 when a question only has 3
const EXTRA_WORDS = ['the','and','but','run','big','was','had','has','can','said'];

export function renderWordSnake() {
  const view = document.getElementById('view');
  view.style.cssText = 'padding:0;overflow:hidden;';
  setView(`<canvas id="snake-canvas" style="display:block;touch-action:none;"></canvas>`);

  const canvas = document.getElementById('snake-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - 60 - 72;

  const game = new WordSnakeGame(canvas);
  window.addEventListener('hashchange', () => {
    game.stop();
    document.getElementById('view').style.cssText = '';
  }, { once: true });
}

// ── Game ──────────────────────────────────────────────────────────────────────

class WordSnakeGame {
  constructor(canvas) {
    this.c   = canvas;
    this.ctx = canvas.getContext('2d');
    this.W   = canvas.width;
    this.H   = canvas.height;
    this.HH  = 88; // HUD height (sentence display)
    this.PAD = 0;  // no d-pad — swipe controls

    // Grid sizing — fewer cols = bigger cells = easier to read words
    const gameH   = this.H - this.HH - this.PAD;
    this.COLS     = 14;
    this.CELL     = Math.floor(Math.min(this.W / this.COLS, gameH / 14));
    this.ROWS     = Math.floor(gameH / this.CELL);
    this.gridX    = Math.floor((this.W - this.COLS * this.CELL) / 2);
    this.gridY    = this.HH;

    // Snake
    const midC = Math.floor(this.COLS / 2);
    const midR = Math.floor(this.ROWS / 2);
    this.snake   = [{ c: midC, r: midR }, { c: midC-1, r: midR }, { c: midC-2, r: midR }];
    this.dir     = { dc: 1, dr: 0 };
    this.nextDir = null;

    // State
    this.running  = true;
    this.score    = 0;
    this.coins    = 0;
    this.answered = 0;
    this.correct  = 0;
    this.flashFrames = 0;
    this.flashColor  = '#4ade80';

    // Speed: interval in ms between snake steps
    this.interval = 220;
    this.lastStep = 0;

    // Question pool (fill-type only, current grade)
    this.pool = shuffle(
      ENGLISH_QUESTIONS.filter(q => q.grade === state.profile.grade && q.type === 'fill')
    );
    this.poolIdx  = 0;
    this.apples   = [];
    this.correctWord = '';

    // Obstacles — start empty, added every 3 correct answers, max 5
    this.obstacles  = [];
    this.MAX_OBS    = 5;
    // Each obstacle blinks: visible ~3.5s, hidden ~1.8s (at 60fps)
    this.OBS_SHOW   = 210;
    this.OBS_HIDE   = 110;

    this.swipeHint = 90; // frames to show "swipe to move" hint
    this.bindInput();
    this.nextQuestion();
    this.loop();
  }

  // ── Loop ────────────────────────────────────────────────────────────────────

  loop() {
    if (!this.running) return;
    const now = Date.now();
    if (now - this.lastStep >= this.interval) {
      this.step();
      this.lastStep = now;
    }
    if (this.flashFrames > 0) this.flashFrames--;
    this.tickObstacles();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  stop() { this.running = false; this.unbindInput(); }

  // ── Step (one snake move) ───────────────────────────────────────────────────

  step() {
    if (this.nextDir) {
      this.dir     = this.nextDir;
      this.nextDir = null;
    }

    const head = this.snake[0];
    const nc   = head.c + this.dir.dc;
    const nr   = head.r + this.dir.dr;

    // Wall collision
    if (nc < 0 || nc >= this.COLS || nr < 0 || nr >= this.ROWS) {
      this.endGame(); return;
    }

    // Self-collision
    if (this.snake.some(s => s.c === nc && s.r === nr)) {
      this.endGame(); return;
    }

    // Visible obstacle collision
    const hitObs = this.obstacles.some(o => o.visible && o.c === nc && o.r === nr);
    if (hitObs) { this.endGame(); return; }

    this.snake.unshift({ c: nc, r: nr });

    // Check apple collision
    const hitIdx = this.apples.findIndex(a => a.c === nc && a.r === nr);
    if (hitIdx !== -1) {
      const apple = this.apples[hitIdx];
      this.apples.splice(hitIdx, 1);
      this.eatApple(apple);
    } else {
      this.snake.pop(); // normal move, remove tail
    }
  }

  eatApple(apple) {
    if (apple.word === this.correctWord) {
      // Correct — keep head (already added), snake grew by 1
      this.score += 100 + Math.max(0, 40 - this.answered * 2);
      const earned = handleAnswer(true);
      this.coins  += earned;
      this.answered++;
      this.correct++;
      this.flashFrames = 18;
      this.flashColor  = '#4ade80';
      this.speedUp();
      this.nextQuestion();
    } else {
      // Wrong — shrink by 2, remove tail twice (head already added so net = -1)
      this.snake.pop();
      if (this.snake.length > 1) this.snake.pop();
      if (this.snake.length <= 1) { this.endGame(); return; }
      handleAnswer(false);
      this.answered++;
      this.flashFrames = 22;
      this.flashColor  = '#f87171';
      // Respawn eaten wrong apple with a fresh word from remaining choices
      this.respawnApple(apple);
    }
  }

  respawnApple(eaten) {
    // Put a new apple back using a word not already on the board
    const usedWords = new Set(this.apples.map(a => a.word));
    usedWords.add(eaten.word);
    // Find an unused choice from current question choices
    const leftover = this.currentChoices.filter(w => !usedWords.has(w));
    if (leftover.length > 0) {
      const pos = this.freeCell();
      if (pos) this.apples.push({ ...pos, word: leftover[0] });
    }
  }

  speedUp() {
    this.interval = Math.max(85, this.interval - 10);
    // Add a new obstacle every 3 correct answers, up to max
    if (this.correct % 3 === 0 && this.obstacles.length < this.MAX_OBS) {
      this.spawnObstacle();
    }
  }

  spawnObstacle() {
    const head     = this.snake[0];
    const blocked  = new Set([
      ...this.snake.map(s => `${s.c},${s.r}`),
      ...this.apples.map(a => `${a.c},${a.r}`),
      ...this.obstacles.map(o => `${o.c},${o.r}`),
    ]);
    for (let attempt = 0; attempt < 60; attempt++) {
      const c = rand(1, this.COLS - 2);
      const r = rand(1, this.ROWS - 2);
      // Keep at least 4 cells away from snake head
      if (Math.abs(c - head.c) + Math.abs(r - head.r) < 4) continue;
      if (blocked.has(`${c},${r}`)) continue;
      this.obstacles.push({ c, r, visible: true, timer: this.OBS_SHOW });
      return;
    }
  }

  tickObstacles() {
    for (const o of this.obstacles) {
      o.timer--;
      if (o.timer <= 0) {
        o.visible = !o.visible;
        o.timer   = o.visible ? this.OBS_SHOW : this.OBS_HIDE;
      }
    }
  }

  // ── Question ────────────────────────────────────────────────────────────────

  nextQuestion() {
    if (this.poolIdx >= this.pool.length) {
      // Reshuffle and loop
      this.pool    = shuffle([...this.pool]);
      this.poolIdx = 0;
    }
    const q = this.pool[this.poolIdx++];

    // Ensure exactly 4 choices
    let choices = [...q.choices];
    while (choices.length < 4) {
      const w = EXTRA_WORDS[Math.floor(Math.random() * EXTRA_WORDS.length)];
      if (!choices.includes(w)) choices.push(w);
    }
    choices = shuffle(choices.slice(0, 4));

    this.currentQ       = q;
    this.correctWord    = q.blank;
    this.currentChoices = choices;
    this.apples         = [];

    // Place 4 apples, avoiding snake body
    const positions = this.spreadApplePositions(4);
    choices.forEach((word, i) => {
      this.apples.push({ ...positions[i], word });
    });
  }

  // ── Positioning ─────────────────────────────────────────────────────────────

  spreadApplePositions(n) {
    // Divide grid into quadrants, pick one cell per quadrant away from snake
    const halfC = Math.floor(this.COLS / 2);
    const halfR = Math.floor(this.ROWS / 2);
    const quads = [
      { c1:1,     c2:halfC-1,   r1:1,     r2:halfR-1   },
      { c1:halfC, c2:this.COLS-2, r1:1,   r2:halfR-1   },
      { c1:1,     c2:halfC-1,   r1:halfR, r2:this.ROWS-2 },
      { c1:halfC, c2:this.COLS-2, r1:halfR, r2:this.ROWS-2 },
    ];
    const snakeSet = new Set(this.snake.map(s => `${s.c},${s.r}`));
    return shuffle([...quads]).map(q => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const c = rand(q.c1, q.c2);
        const r = rand(q.r1, q.r2);
        if (!snakeSet.has(`${c},${r}`)) return { c, r };
      }
      return { c: rand(q.c1, q.c2), r: rand(q.r1, q.r2) }; // fallback
    });
  }

  freeCell() {
    const blocked = new Set([
      ...this.snake.map(s => `${s.c},${s.r}`),
      ...this.apples.map(a => `${a.c},${a.r}`),
      ...this.obstacles.map(o => `${o.c},${o.r}`),
    ]);
    for (let attempt = 0; attempt < 40; attempt++) {
      const c = rand(1, this.COLS - 2);
      const r = rand(1, this.ROWS - 2);
      if (!blocked.has(`${c},${r}`)) return { c, r };
    }
    return null;
  }

  // ── End game ────────────────────────────────────────────────────────────────

  async endGame() {
    this.stop();
    await flushCoins({
      game_type: 'english',
      questions_answered: this.answered,
      correct: this.correct,
      coins_earned: this.coins,
    });
    document.getElementById('view').style.cssText = '';
    setView(`
      <div class="game-end">
        <div class="end-emoji">🐍</div>
        <h2>Game Over!</h2>
        <p>Score: <strong>${this.score}</strong></p>
        <p>${this.correct} / ${this.answered} correct</p>
        <p class="end-coins">+${this.coins} coins earned!</p>
        <div class="end-actions">
          <button class="btn btn-primary"
            onclick="if(window.location.hash==='#game/wordsnake'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/wordsnake'}">
            Play Again 🐍
          </button>
          <a href="#games" class="btn btn-outline">Other Games</a>
        </div>
      </div>
    `);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Background
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, this.W, this.H);

    this.drawHUD();
    this.drawGrid();
    this.drawObstacles();
    this.drawApples();
    this.drawSnake();
    this.drawSwipeHint();

    // Flash overlay
    if (this.flashFrames > 0) {
      ctx.globalAlpha = (this.flashFrames / 22) * 0.18;
      ctx.fillStyle   = this.flashColor;
      ctx.fillRect(this.gridX, this.gridY, this.COLS * this.CELL, this.ROWS * this.CELL);
      ctx.globalAlpha = 1;
    }
  }

  drawHUD() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,26,10,0.92)';
    ctx.fillRect(0, 0, this.W, this.HH);
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, this.HH); ctx.lineTo(this.W, this.HH); ctx.stroke();

    if (this.currentQ) {
      // Sentence with blank highlighted
      const sentence = this.currentQ.sentence.replace('___', '______');
      ctx.fillStyle    = '#d1fae5';
      ctx.font         = `bold ${Math.min(16, this.W / 24)}px system-ui`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sentence, this.W / 2, this.HH / 2 - 4, this.W - 24);
    }

    // Score left
    ctx.fillStyle    = '#4ade80';
    ctx.font         = 'bold 13px system-ui';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`⭐ ${this.score}`, 12, 8);

    // Snake length right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#86efac';
    ctx.fillText(`🐍 ${this.snake.length}`, this.W - 12, 8);
  }

  drawGrid() {
    const ctx = this.ctx;
    const gx  = this.gridX, gy = this.gridY, cs = this.CELL;
    const gw  = this.COLS * cs, gh = this.ROWS * cs;

    // Inner grid lines
    ctx.strokeStyle = '#111e11';
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= this.COLS; c++) {
      ctx.beginPath(); ctx.moveTo(gx + c*cs, gy); ctx.lineTo(gx + c*cs, gy + gh); ctx.stroke();
    }
    for (let r = 0; r <= this.ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(gx, gy + r*cs); ctx.lineTo(gx + gw, gy + r*cs); ctx.stroke();
    }

    // Wall border — solid bright line
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth   = 3;
    ctx.strokeRect(gx + 1.5, gy + 1.5, gw - 3, gh - 3);

    // Corner accents
    ctx.fillStyle = '#4ade80';
    const corners = [[gx, gy],[gx+gw, gy],[gx, gy+gh],[gx+gw, gy+gh]];
    for (const [cx, cy] of corners) {
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
    }
  }

  drawObstacles() {
    const ctx = this.ctx;
    const cs  = this.CELL;
    const gx  = this.gridX, gy = this.gridY;

    for (const o of this.obstacles) {
      if (!o.visible) continue;
      const x = gx + o.c * cs, y = gy + o.r * cs;
      const pad = 2;

      // Rock shape — dark brownish grey
      ctx.fillStyle   = '#78350f';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, cs - pad*2, cs - pad*2, 4);
      ctx.fill();
      ctx.stroke();

      // Rock texture lines
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x + pad + 4, y + cs*0.4);
      ctx.lineTo(x + cs - pad - 4, y + cs*0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + cs*0.35, y + pad + 3);
      ctx.lineTo(x + cs*0.35, y + cs - pad - 3);
      ctx.stroke();
    }
  }

  drawSnake() {
    const ctx = this.ctx;
    const cs  = this.CELL;
    const gx  = this.gridX, gy = this.gridY;

    this.snake.forEach((seg, i) => {
      const x  = gx + seg.c * cs;
      const y  = gy + seg.r * cs;
      const pad = i === 0 ? 1 : 2;
      const t  = i / this.snake.length;

      // Body gradient: bright head → darker tail
      const green = Math.round(220 - t * 100);
      ctx.fillStyle = i === 0 ? '#4ade80' : `rgb(30,${green},50)`;

      if (i === 0) {
        // Head: rounded rect with eyes
        ctx.beginPath();
        ctx.roundRect(x + pad, y + pad, cs - pad*2, cs - pad*2, 5);
        ctx.fill();

        // Eyes
        const head = this.snake[0];
        const ex1  = x + cs * 0.3, ex2 = x + cs * 0.7;
        const ey   = y + cs * 0.35;
        ctx.fillStyle = '#0a1a0a';
        ctx.beginPath(); ctx.arc(ex1, ey, 2.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey, 2.5, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(x + pad, y + pad, cs - pad*2, cs - pad*2, 3);
        ctx.fill();
      }
    });
  }

  drawApples() {
    const ctx = this.ctx;
    const cs  = this.CELL;
    const gx  = this.gridX, gy = this.gridY;

    for (const a of this.apples) {
      const x = gx + a.c * cs + cs / 2;
      const y = gy + a.r * cs + cs / 2;
      const r = cs * 0.44;

      // Apple glow + body
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = '#dc2626';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

      // Lighter top highlight
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#f87171';
      ctx.beginPath(); ctx.arc(x - r*0.25, y - r*0.28, r*0.42, 0, TAU); ctx.fill();

      // Stem
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - r + 1);
      ctx.quadraticCurveTo(x + 6, y - r - 5, x + 5, y - r - 9);
      ctx.stroke();

      // Word — dark pill background first so text is always readable
      const fontSize = Math.max(11, Math.min(15, Math.floor(cs * 0.52)));
      ctx.font        = `bold ${fontSize}px system-ui`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      const tw   = ctx.measureText(a.word).width;
      const ph   = fontSize + 4;
      const pw   = tw + 10;
      // Pill background
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath();
      ctx.roundRect(x - pw/2, y - ph/2, pw, ph, ph/2);
      ctx.fill();
      // White text with subtle shadow
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 3;
      ctx.fillStyle   = '#ffffff';
      ctx.fillText(a.word, x, y);
      ctx.shadowBlur  = 0;
    }
  }

  drawSwipeHint() {
    if (this.swipeHint <= 0) return;
    const ctx = this.ctx;
    const alpha = Math.min(1, this.swipeHint / 30);
    ctx.globalAlpha  = alpha * 0.7;
    ctx.fillStyle    = 'rgba(0,0,0,0.5)';
    const tx = this.W / 2, ty = this.H - 28;
    ctx.font         = 'bold 13px system-ui';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const label = '👆 Swipe to steer';
    const tw    = ctx.measureText(label).width + 20;
    ctx.beginPath(); ctx.roundRect(tx - tw/2, ty - 14, tw, 28, 14); ctx.fill();
    ctx.fillStyle = '#d1fae5';
    ctx.fillText(label, tx, ty);
    ctx.globalAlpha = 1;
    this.swipeHint--;
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  bindInput() {
    this._kd = e => {
      const map = { ArrowUp:{dc:0,dr:-1}, ArrowDown:{dc:0,dr:1}, ArrowLeft:{dc:-1,dr:0}, ArrowRight:{dc:1,dr:0},
                    w:{dc:0,dr:-1}, s:{dc:0,dr:1}, a:{dc:-1,dr:0}, d:{dc:1,dr:0} };
      const d = map[e.key];
      if (d) { e.preventDefault(); this.tryDir(d); }
    };
    window.addEventListener('keydown', this._kd);

    this._swipeStart = null;
    this._ts = e => { e.preventDefault(); [...e.changedTouches].forEach(t => this.onTouchStart(t)); };
    this._te = e => { [...e.changedTouches].forEach(t => this.onTouchEnd(t)); };
    this.c.addEventListener('touchstart', this._ts, { passive: false });
    this.c.addEventListener('touchend',   this._te);
  }

  unbindInput() {
    window.removeEventListener('keydown', this._kd);
    this.c.removeEventListener('touchstart', this._ts);
    this.c.removeEventListener('touchend',   this._te);
  }

  canvasXY(t) {
    const rect = this.c.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  onTouchStart(t) {
    this.swipeHint = 0; // dismiss hint on first touch
    const { x, y } = this.canvasXY(t);
    this._swipeStart = { x, y, id: t.identifier };
  }

  onTouchEnd(t) {
    if (!this._swipeStart || this._swipeStart.id !== t.identifier) return;
    const { x, y } = this.canvasXY(t);
    const dx = x - this._swipeStart.x;
    const dy = y - this._swipeStart.y;
    this._swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; // tap, ignore
    if (Math.abs(dx) > Math.abs(dy)) {
      this.tryDir(dx > 0 ? { dc:1, dr:0 } : { dc:-1, dr:0 });
    } else {
      this.tryDir(dy > 0 ? { dc:0, dr:1 } : { dc:0, dr:-1 });
    }
  }

  tryDir(d) {
    // Prevent reversing directly into self
    if (d.dc === -this.dir.dc && d.dr === -this.dir.dr) return;
    this.nextDir = d;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
