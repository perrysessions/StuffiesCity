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
    this.HH  = 88;  // HUD height (sentence display)
    this.PAD = 130; // d-pad area at bottom

    // Grid sizing — ~18 cols, square cells
    const gameH   = this.H - this.HH - this.PAD;
    this.COLS     = 18;
    this.CELL     = Math.floor(Math.min(this.W / this.COLS, gameH / 16));
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

    this.dpad = this.buildDpad();
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

    const head    = this.snake[0];
    let nc = (head.c + this.dir.dc + this.COLS) % this.COLS;
    let nr = (head.r + this.dir.dr + this.ROWS) % this.ROWS;

    // Self-collision → game over
    if (this.snake.some(s => s.c === nc && s.r === nr)) {
      this.endGame();
      return;
    }

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
    // Decrease interval (faster) with each correct answer, capped at 85ms
    this.interval = Math.max(85, this.interval - 10);
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
    const snakeSet  = new Set(this.snake.map(s => `${s.c},${s.r}`));
    const appleSet  = new Set(this.apples.map(a => `${a.c},${a.r}`));
    for (let attempt = 0; attempt < 40; attempt++) {
      const c = rand(1, this.COLS - 2);
      const r = rand(1, this.ROWS - 2);
      const key = `${c},${r}`;
      if (!snakeSet.has(key) && !appleSet.has(key)) return { c, r };
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
    this.drawApples();
    this.drawSnake();
    this.drawDpad();

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
    ctx.strokeStyle = '#111e11';
    ctx.lineWidth   = 0.5;
    const gx = this.gridX, gy = this.gridY, cs = this.CELL;
    for (let c = 0; c <= this.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(gx + c * cs, gy);
      ctx.lineTo(gx + c * cs, gy + this.ROWS * cs);
      ctx.stroke();
    }
    for (let r = 0; r <= this.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + r * cs);
      ctx.lineTo(gx + this.COLS * cs, gy + r * cs);
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
      const x   = gx + a.c * cs + cs / 2;
      const y   = gy + a.r * cs + cs / 2;
      const r   = cs * 0.42;

      // Apple circle
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = '#ef4444';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

      // Stem
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x + 5, y - r - 6, x + 4, y - r - 10);
      ctx.stroke();

      // Word label — scale horizontally if the word is wider than the apple
      ctx.shadowBlur   = 0;
      ctx.fillStyle    = '#fff';
      const fontSize   = Math.max(9, Math.min(13, Math.floor(cs * 0.45)));
      ctx.font         = `bold ${fontSize}px system-ui`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const maxW = cs * 0.88;
      const tw   = ctx.measureText(a.word).width;
      ctx.save();
      ctx.translate(x, y);
      if (tw > maxW) ctx.scale(maxW / tw, 1);
      ctx.fillText(a.word, 0, 0);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  drawDpad() {
    const ctx  = this.ctx;
    const btns = this.dpad;
    for (const b of btns) {
      ctx.globalAlpha = b.pressed ? 0.75 : 0.3;
      ctx.fillStyle   = '#4ade80';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 8);
      ctx.fill();

      ctx.globalAlpha = 0.9;
      ctx.fillStyle   = '#fff';
      ctx.font        = 'bold 18px system-ui';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2);
    }
    ctx.globalAlpha = 1;
  }

  // ── D-pad layout ────────────────────────────────────────────────────────────

  buildDpad() {
    const bw  = 52, bh = 46, gap = 6;
    const cx  = 90;  // center X of dpad
    const cy  = this.H - this.PAD / 2 + 6;
    return [
      { label:'▲', x: cx - bw/2,       y: cy - bh - gap,   w: bw, h: bh, dc: 0, dr:-1, pressed:false },
      { label:'▼', x: cx - bw/2,       y: cy + gap,         w: bw, h: bh, dc: 0, dr: 1, pressed:false },
      { label:'◀', x: cx - bw - gap,    y: cy - bh/2,        w: bw, h: bh, dc:-1, dr: 0, pressed:false },
      { label:'▶', x: cx + gap,         y: cy - bh/2,        w: bw, h: bh, dc: 1, dr: 0, pressed:false },
    ];
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

    this._ts = e => { e.preventDefault(); [...e.changedTouches].forEach(t => this.onTouchStart(t)); };
    this._tm = e => { e.preventDefault(); [...e.changedTouches].forEach(t => this.onTouchMove(t)); };
    this._te = e => { [...e.changedTouches].forEach(t => this.onTouchEnd(t)); };
    this.c.addEventListener('touchstart', this._ts, { passive: false });
    this.c.addEventListener('touchmove',  this._tm, { passive: false });
    this.c.addEventListener('touchend',   this._te);

    // Track swipe start for swipe gesture
    this._swipeStart = null;
  }

  unbindInput() {
    window.removeEventListener('keydown', this._kd);
    this.c.removeEventListener('touchstart', this._ts);
    this.c.removeEventListener('touchmove',  this._tm);
    this.c.removeEventListener('touchend',   this._te);
  }

  canvasXY(t) {
    const rect = this.c.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  onTouchStart(t) {
    const { x, y } = this.canvasXY(t);
    // Check dpad buttons
    for (const b of this.dpad) {
      if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
        b.pressed = true; b.touchId = t.identifier;
        this.tryDir({ dc: b.dc, dr: b.dr });
        return;
      }
    }
    // Store swipe start for game area
    if (y > this.HH && y < this.H - this.PAD) {
      this._swipeStart = { x, y, id: t.identifier };
    }
  }

  onTouchMove(t) {
    const { x, y } = this.canvasXY(t);
    // Update dpad pressed state
    for (const b of this.dpad) {
      if (b.touchId === t.identifier) {
        const inside = x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h;
        if (inside) { this.tryDir({ dc: b.dc, dr: b.dr }); }
      }
    }
  }

  onTouchEnd(t) {
    for (const b of this.dpad) {
      if (b.touchId === t.identifier) { b.pressed = false; b.touchId = null; }
    }
    // Swipe detection
    if (this._swipeStart && this._swipeStart.id === t.identifier) {
      const { x, y } = this.canvasXY(t);
      const dx = x - this._swipeStart.x;
      const dy = y - this._swipeStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.tryDir(dx > 0 ? { dc:1, dr:0 } : { dc:-1, dr:0 });
        } else {
          this.tryDir(dy > 0 ? { dc:0, dr:1 } : { dc:0, dr:-1 });
        }
      }
      this._swipeStart = null;
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
