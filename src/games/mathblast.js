import { state } from '../state.js';
import { setView } from '../ui.js';
import { handleAnswer, flushCoins } from './rewards.js';
import { supabase } from '../supabase.js';

const TAU = Math.PI * 2;

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderMathBlast() {
  const view = document.getElementById('view');
  view.style.cssText = 'padding:0;overflow:hidden;';
  setView(`<canvas id="blast-canvas" style="display:block;touch-action:none;"></canvas>`);

  const canvas = document.getElementById('blast-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - 60 - 72; // minus top bar + nav

  const game = new MathBlastGame(canvas);
  // Clean up when navigating away
  window.addEventListener('hashchange', () => {
    game.stop();
    document.getElementById('view').style.cssText = '';
  }, { once: true });
}

// ── Game class ────────────────────────────────────────────────────────────────

class MathBlastGame {
  constructor(canvas) {
    this.c   = canvas;
    this.ctx = canvas.getContext('2d');
    this.W   = canvas.width;
    this.H   = canvas.height;
    this.HH  = 82; // HUD height at top

    // State
    this.running  = true;
    this.lives    = 3;
    this.score    = 0;
    this.coins    = 0;
    this.answered = 0;
    this.correct  = 0;
    this.invincible = 0; // frames of invincibility after hit

    // Objects
    this.ship      = { x: this.W/2, y: (this.H+this.HH)/2, vx:0, vy:0, angle:-Math.PI/2, r:14 };
    this.bullets   = [];
    this.asteroids = [];
    this.particles = [];
    this.lastShot  = 0;

    // Question
    this.q          = null;
    this.correctIdx = -1;
    this.qStart     = 0;
    this.transitioning = false;

    // Controls
    this.keys = {};
    this.joy  = { active:false, id:null, bx:85, by:this.H-85, tx:85, ty:this.H-85, r:56 };
    this.fireBtn = { x:this.W-85, y:this.H-85, r:50, active:false, id:null };

    // Stars (decorative background, generated once)
    this.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * (this.H - this.HH) + this.HH,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.6 + 0.2,
    }));

    // Aliens
    this.aliens     = [];
    this.alienTimer = 0; // frames until next alien spawn

    this.high = parseInt(localStorage.getItem(`mathblast_high_g${state.profile.grade}`) || '0');

    this.bindInput();
    this.nextQuestion();
    this.loop();
  }

  // ── Wave helpers ─────────────────────────────────────────────────────────────

  get wave() {
    if (this.correct < 3)  return 0; // no aliens yet
    if (this.correct < 6)  return 1; // 1 alien, slow
    if (this.correct < 10) return 2; // 2 aliens, medium
    return 3;                         // 2 aliens, faster + homing
  }

  get alienMaxCount() { return this.wave < 2 ? 1 : 2; }
  get alienSpeed()    { return 0.55 + this.wave * 0.22; }

  // ── Loop ────────────────────────────────────────────────────────────────────

  loop() {
    if (!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  stop() { this.running = false; this.unbindInput(); }

  // ── Update ──────────────────────────────────────────────────────────────────

  update() {
    if (this.transitioning) return;
    const s = this.ship;

    // -- Thrust from keyboard or joystick
    let tx = 0, ty = 0;
    if (this.keys['ArrowLeft']  || this.keys['a']) tx -= 1;
    if (this.keys['ArrowRight'] || this.keys['d']) tx += 1;
    if (this.keys['ArrowUp']    || this.keys['w']) ty -= 1;
    if (this.keys['ArrowDown']  || this.keys['s']) ty += 1;

    if (this.joy.active) {
      const dx = this.joy.tx - this.joy.bx;
      const dy = this.joy.ty - this.joy.by;
      const len = Math.hypot(dx, dy);
      if (len > 8) { tx = dx / len; ty = dy / len; }
    }
    const tlen = Math.hypot(tx, ty);
    if (tlen > 0) { tx /= tlen; ty /= tlen; }

    s.vx = (s.vx + tx * 0.38) * 0.93;
    s.vy = (s.vy + ty * 0.38) * 0.93;
    s.x += s.vx;
    s.y += s.vy;
    if (Math.hypot(s.vx, s.vy) > 0.15) s.angle = Math.atan2(s.vy, s.vx);

    // Wrap edges
    if (s.x < -s.r)         s.x = this.W + s.r;
    if (s.x > this.W + s.r) s.x = -s.r;
    if (s.y < this.HH)      s.y = this.H;
    if (s.y > this.H)       s.y = this.HH;

    // -- Auto-fire on hold
    const fireHeld = this.keys[' '] || this.keys['z'] || this.keys['x'] || this.fireBtn.active;
    const now = Date.now();
    if (fireHeld && now - this.lastShot > 320) {
      this.shoot();
      this.lastShot = now;
    }

    // -- Move bullets
    this.bullets = this.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy; b.life--;
      return b.life > 0 && b.y > this.HH;
    });

    // -- Move asteroids
    this.asteroids.forEach(a => {
      a.x += a.vx; a.y += a.vy;
      a.rot += a.rotSpeed;
      if (a.x - a.r < 0)       { a.vx =  Math.abs(a.vx); a.x = a.r; }
      if (a.x + a.r > this.W)  { a.vx = -Math.abs(a.vx); a.x = this.W - a.r; }
      if (a.y - a.r < this.HH) { a.vy =  Math.abs(a.vy); a.y = this.HH + a.r; }
      if (a.y + a.r > this.H)  { a.vy = -Math.abs(a.vy); a.y = this.H - a.r; }
    });

    // -- Bullet ↔ asteroid
    outer: for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
        const a = this.asteroids[ai];
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + 5) {
          this.bullets.splice(bi, 1);
          this.hitAsteroid(ai);
          break outer;
        }
      }
    }

    // -- Ship ↔ asteroid (with invincibility window)
    if (this.invincible > 0) {
      this.invincible--;
    } else {
      for (const a of this.asteroids) {
        if (Math.hypot(s.x - a.x, s.y - a.y) < s.r + a.r - 10) {
          this.explode(s.x, s.y, '#f87171');
          this.loseLife();
          break;
        }
      }
    }

    // -- Alien spawn
    if (this.wave > 0 && this.aliens.length < this.alienMaxCount) {
      this.alienTimer--;
      if (this.alienTimer <= 0) {
        this.spawnAlien();
        this.alienTimer = Math.floor(220 - this.wave * 30); // frames between spawns
      }
    }

    // -- Move aliens
    this.aliens = this.aliens.filter(a => {
      a.t += 1;
      a.x  = a.originX + Math.sin(a.t * a.wobble) * 38;
      a.y += a.vy;
      // Wave 3: slight homing toward ship X
      if (this.wave >= 3) {
        const dx = s.x - a.x;
        a.x += Math.sign(dx) * Math.min(0.4, Math.abs(dx) * 0.008);
      }
      return a.y < this.H + a.r; // despawn below screen
    });

    // -- Bullet ↔ alien
    outer2: for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      for (let ai = this.aliens.length - 1; ai >= 0; ai--) {
        const a = this.aliens[ai];
        if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + 5) {
          this.bullets.splice(bi, 1);
          this.aliens.splice(ai, 1);
          this.explode(a.x, a.y, '#a78bfa');
          this.score += 50;
          this.saveHigh();
          break outer2;
        }
      }
    }

    // -- Ship ↔ alien
    if (this.invincible <= 0) {
      for (let ai = this.aliens.length - 1; ai >= 0; ai--) {
        const a = this.aliens[ai];
        if (Math.hypot(s.x - a.x, s.y - a.y) < s.r + a.r - 6) {
          this.aliens.splice(ai, 1);
          this.explode(s.x, s.y, '#f87171');
          this.loseLife();
          break;
        }
      }
    }

    // -- Particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life--;
      return p.life > 0;
    });
  }

  shoot() {
    const s = this.ship;
    this.bullets.push({
      x: s.x + Math.cos(s.angle) * 18,
      y: s.y + Math.sin(s.angle) * 18,
      vx: Math.cos(s.angle) * 9,
      vy: Math.sin(s.angle) * 9,
      life: 52,
    });
  }

  hitAsteroid(ai) {
    if (this.transitioning) return;
    const a = this.asteroids[ai];
    const correct = (ai === this.correctIdx);

    this.explode(a.x, a.y, correct ? '#4ade80' : '#f87171');
    this.asteroids.splice(ai, 1);

    if (correct) {
      const elapsed = (Date.now() - this.qStart) / 1000;
      const speed   = Math.max(0, Math.floor(60 - elapsed * 4));
      this.score   += 100 + speed;
      const earned  = handleAnswer(true);
      this.coins   += earned;
      this.answered++;
      this.correct++;
      this.saveHigh();
      this.transitioning = true;
      setTimeout(() => { this.transitioning = false; this.nextQuestion(); }, 700);
    } else {
      handleAnswer(false);
      this.answered++;
      this.score = Math.max(0, this.score - 25);
      this.loseLife();
    }
  }

  loseLife() {
    if (this.lives <= 0) return;
    this.lives--;
    this.invincible = 80;
    this.ship.vx = 0; this.ship.vy = 0;
    if (this.lives <= 0) {
      this.transitioning = true;
      setTimeout(() => this.gameOver(), 800);
    } else {
      this.aliens = [];
      this.transitioning = true;
      setTimeout(() => { this.transitioning = false; this.nextQuestion(); }, 900);
    }
  }

  explode(x, y, color) {
    for (let i = 0; i < 20; i++) {
      const angle = (TAU / 20) * i + Math.random() * 0.3;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 28 + Math.random() * 22,
        color,
      });
    }
  }

  spawnAlien() {
    const x = rand(50, this.W - 50);
    this.aliens.push({
      x, originX: x,
      y: this.HH - 20,
      vy: this.alienSpeed,
      r: 26,
      wobble: 0.03 + Math.random() * 0.02,
      t: Math.random() * 100,
    });
  }

  nextQuestion() {
    if (!this.running) return;
    const q       = generateQuestion(state.profile.grade);
    const choices = generateChoices(q.answer);
    this.q        = q;
    this.qStart   = Date.now();
    this.bullets  = [];

    const positions = this.spreadPositions(4);
    this.asteroids  = [];

    choices.forEach((val, i) => {
      this.asteroids.push({
        x: positions[i].x, y: positions[i].y,
        vx: (Math.random() - 0.5) * 1.4,
        vy: (Math.random() - 0.5) * 1.4,
        r: 38,
        rot: Math.random() * TAU,
        rotSpeed: (Math.random() - 0.5) * 0.018,
        label: String(val),
      });
      if (val === q.answer) this.correctIdx = i;
    });

    // Move ship to a clear spot away from all asteroids and aliens
    const pos = this.safeSpawnPos();
    this.ship.x  = pos.x;
    this.ship.y  = pos.y;
    this.ship.vx = 0;
    this.ship.vy = 0;
  }

  safeSpawnPos() {
    const SAFE_R = 90; // minimum clear radius around ship
    const candidates = [
      { x: this.W / 2,     y: (this.H + this.HH) / 2 }, // center (preferred)
      { x: this.W / 4,     y: (this.H + this.HH) / 2 },
      { x: this.W * 3 / 4, y: (this.H + this.HH) / 2 },
      { x: this.W / 2,     y: this.HH + (this.H - this.HH) * 0.25 },
      { x: this.W / 2,     y: this.HH + (this.H - this.HH) * 0.75 },
    ];
    // Also try 12 random positions
    for (let i = 0; i < 12; i++) {
      candidates.push({
        x: rand(60, this.W - 60),
        y: rand(this.HH + 60, this.H - 60),
      });
    }
    const obstacles = [...this.asteroids, ...this.aliens];
    for (const c of candidates) {
      const clear = obstacles.every(o => Math.hypot(c.x - o.x, c.y - o.y) > o.r + SAFE_R);
      if (clear) return c;
    }
    // Fallback: return center even if not ideal
    return { x: this.W / 2, y: (this.H + this.HH) / 2 };
  }

  spreadPositions(n) {
    const gH = this.H - this.HH;
    const quads = [
      { x1: 50,       x2: this.W/2-30,  y1: this.HH+50, y2: this.HH+gH/2-20 },
      { x1: this.W/2+30, x2: this.W-50,  y1: this.HH+50, y2: this.HH+gH/2-20 },
      { x1: 50,       x2: this.W/2-30,  y1: this.HH+gH/2+20, y2: this.H-130 },
      { x1: this.W/2+30, x2: this.W-50,  y1: this.HH+gH/2+20, y2: this.H-130 },
    ];
    return shuffle([...quads]).map(q => ({
      x: rand(q.x1, q.x2),
      y: rand(q.y1, q.y2),
    }));
  }

  saveHigh() {
    if (this.score > this.high) {
      this.high = this.score;
      localStorage.setItem(`mathblast_high_g${state.profile.grade}`, this.high);
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Space background
    ctx.fillStyle = '#060614';
    ctx.fillRect(0, 0, this.W, this.H);

    // Stars
    for (const st of this.stars) {
      ctx.globalAlpha = st.a;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.drawHUD();

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / 50;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Aliens
    this.aliens.forEach(a => this.drawAlien(a));

    // Asteroids
    this.asteroids.forEach(a => this.drawAsteroid(a));

    // Bullets
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 6;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Ship (blink when invincible)
    if (this.invincible === 0 || Math.floor(this.invincible / 5) % 2 === 0) {
      this.drawShip();
    }

    this.drawControls();
  }

  drawHUD() {
    const ctx = this.ctx;
    // Background
    ctx.fillStyle = 'rgba(6,6,20,0.88)';
    ctx.fillRect(0, 0, this.W, this.HH);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, this.HH); ctx.lineTo(this.W, this.HH); ctx.stroke();

    // Question
    if (this.q) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(22, this.W / 18)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🔢  ${this.q.display}`, this.W / 2, this.HH / 2 - 4);
    }

    // Score left
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`⭐ ${this.score}`, 12, 8);
    ctx.fillStyle = '#475569';
    ctx.font = '11px system-ui';
    ctx.fillText(`BEST ${Math.max(this.score, this.high)}`, 12, 28);

    // Wave indicator (center-right)
    if (this.wave > 0) {
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`👾 WAVE ${this.wave}`, this.W - 10, 46);
    }

    // Lives right
    ctx.textAlign = 'right';
    ctx.font = '18px system-ui';
    ctx.textBaseline = 'top';
    ctx.fillText('❤️'.repeat(this.lives), this.W - 10, 8);
  }

  drawShip() {
    const ctx = this.ctx;
    const s   = this.ship;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    // Thruster flame
    const spd = Math.hypot(s.vx, s.vy);
    if (spd > 0.25) {
      const fl = 8 + spd * 4;
      const grad = ctx.createLinearGradient(-s.r, 0, -s.r - fl, 0);
      grad.addColorStop(0, 'rgba(251,146,60,0.9)');
      grad.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-s.r + 2, -5);
      ctx.lineTo(-s.r - fl, 0);
      ctx.lineTo(-s.r + 2,  5);
      ctx.fill();
    }

    // Ship body
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo( s.r,     0);
    ctx.lineTo(-s.r,    -s.r * 0.65);
    ctx.lineTo(-s.r * 0.45, 0);
    ctx.lineTo(-s.r,     s.r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawAsteroid(a) {
    const ctx = this.ctx;
    const n   = 9;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);

    // Irregular polygon
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang    = (TAU / n) * i;
      const jitter = 0.72 + Math.abs(Math.sin(i * 5.7 + 1.3)) * 0.28;
      const r      = a.r * jitter;
      i === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
              : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
    }
    ctx.closePath();
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Answer text — undo rotation so text stays upright
    ctx.rotate(-a.rot);
    ctx.fillStyle = '#f1f5f9';
    ctx.font      = `bold ${Math.round(a.r * 0.68)}px system-ui`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.label, 0, 0);
    ctx.restore();
  }

  drawAlien(a) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(a.x, a.y);

    // Glow
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur  = 14;

    // Saucer body (flat ellipse)
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.ellipse(0, 4, a.r, a.r * 0.38, 0, 0, TAU);
    ctx.fill();

    // Saucer rim highlight
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Dome
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(0, 0, a.r * 0.55, a.r * 0.45, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Windows (three small circles on rim)
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#fde68a';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * a.r * 0.42, 5, 3.5, 0, TAU);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawControls() {
    const ctx = this.ctx;
    const j   = this.joy;
    const f   = this.fireBtn;

    // Joystick base ring
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(j.bx, j.by, j.r, 0, TAU); ctx.stroke();

    // Joystick thumb
    ctx.globalAlpha = j.active ? 0.65 : 0.32;
    ctx.fillStyle   = '#60a5fa';
    ctx.beginPath(); ctx.arc(j.tx, j.ty, 26, 0, TAU); ctx.fill();

    // Fire button
    ctx.globalAlpha = f.active ? 0.82 : 0.32;
    ctx.fillStyle   = '#f87171';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 13px system-ui';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('FIRE', f.x, f.y);
    ctx.globalAlpha = 1;
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  bindInput() {
    this._kd = e => { this.keys[e.key] = true; };
    this._ku = e => { this.keys[e.key] = false; };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup',   this._ku);

    this._ts = e => { e.preventDefault(); [...e.changedTouches].forEach(t => this.onTouchStart(t)); };
    this._tm = e => { e.preventDefault(); [...e.changedTouches].forEach(t => this.onTouchMove(t)); };
    this._te = e => { [...e.changedTouches].forEach(t => this.onTouchEnd(t)); };
    this.c.addEventListener('touchstart', this._ts, { passive: false });
    this.c.addEventListener('touchmove',  this._tm, { passive: false });
    this.c.addEventListener('touchend',   this._te);
  }

  unbindInput() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup',   this._ku);
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
    const f = this.fireBtn, j = this.joy;
    if (Math.hypot(x - f.x, y - f.y) < f.r + 22) {
      f.active = true; f.id = t.identifier;
    } else {
      j.active = true; j.id = t.identifier;
      j.tx = x; j.ty = y;
    }
  }

  onTouchMove(t) {
    const { x, y } = this.canvasXY(t);
    const j = this.joy;
    if (t.identifier !== j.id) return;
    const dx = x - j.bx, dy = y - j.by;
    const d  = Math.hypot(dx, dy);
    if (d <= j.r) { j.tx = x; j.ty = y; }
    else          { j.tx = j.bx + dx/d*j.r; j.ty = j.by + dy/d*j.r; }
  }

  onTouchEnd(t) {
    const j = this.joy, f = this.fireBtn;
    if (t.identifier === j.id)  { j.active = false; j.tx = j.bx; j.ty = j.by; }
    if (t.identifier === f.id)  { f.active = false; }
  }

  // ── Game Over ────────────────────────────────────────────────────────────────

  async gameOver() {
    this.stop();
    this.saveHigh();

    // Save to Supabase and flush coins in parallel
    await Promise.all([
      flushCoins({
        game_type: 'mathblast',
        questions_answered: this.answered,
        correct: this.correct,
        coins_earned: this.coins,
      }),
      supabase.from('mathblast_scores').insert({
        profile_id: state.profile.id,
        username:   state.profile.username,
        grade:      state.profile.grade,
        score:      this.score,
        correct:    this.correct,
        answered:   this.answered,
      }),
    ]);

    const isNewHigh = this.score >= this.high && this.score > 0;
    document.getElementById('view').style.cssText = '';
    setView(`
      <div class="game-end">
        <div class="end-emoji">🚀</div>
        <h2>${isNewHigh ? '🏆 New High Score!' : 'Game Over!'}</h2>
        <p>Score: <strong>${this.score}</strong></p>
        <p>Grade ${state.profile.grade} Best: <strong>${this.high}</strong></p>
        <p>${this.correct} / ${this.answered} correct</p>
        <p class="end-coins">+${this.coins} coins earned!</p>
        <div class="end-actions">
          <button class="btn btn-primary"
            onclick="if(window.location.hash==='#game/mathblast'){window.dispatchEvent(new Event('hashchange'))}else{window.location.hash='#game/mathblast'}">
            Play Again 🚀
          </button>
          <a href="#game/mathblast/scores" class="btn btn-outline">🏆 Scores</a>
          <a href="#games" class="btn btn-outline">Other Games</a>
        </div>
      </div>
    `);
  }
}

// ── Math helpers (grade-scaled, same logic as math.js) ───────────────────────

function generateQuestion(grade) {
  if (grade <= 2) return addSub(grade === 1 ? 10 : 20);
  if (grade === 3) return Math.random() < 0.5 ? multiplyDiv(10) : addSub(50);
  if (grade === 4) return Math.random() < 0.4 ? multiplyDiv(12) : addSub(200);
  return Math.random() < 0.3 ? percentOf() : addSub(999);
}

function addSub(max) {
  const a = rand(1, max), b = rand(1, max - 1);
  const sub = Math.random() < 0.5 && a > b;
  return sub ? { display: `${a} − ${b} = ?`, answer: a - b }
             : { display: `${a} + ${b} = ?`, answer: a + b };
}

function multiplyDiv(max) {
  const a = rand(2, max), b = rand(2, max);
  return Math.random() < 0.5
    ? { display: `${a} × ${b} = ?`, answer: a * b }
    : { display: `${a*b} ÷ ${a} = ?`, answer: b };
}

function percentOf() {
  const p = [10,20,25,50][rand(0,3)];
  const n = [20,40,50,60,80,100][rand(0,5)];
  return { display: `${p}% of ${n} = ?`, answer: (p/100)*n };
}

function generateChoices(correct) {
  const set = new Set([correct]);
  while (set.size < 4) {
    const delta = rand(1, Math.max(3, Math.floor(correct * 0.3)));
    const v = correct + (Math.random() < 0.5 ? 1 : -1) * delta;
    if (v >= 0) set.add(v);
  }
  return shuffle([...set]);
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
