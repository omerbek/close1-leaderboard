// Close Call Arena — particle effects (fireworks, confetti, sparks, coin fountains).
// One full-screen canvas above the page, pointer-events off. The loop runs only while
// particles are alive, pauses with the tab, caps the particle count, and does nothing at
// all under prefers-reduced-motion.

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX = 900;
const TAU = Math.PI * 2;

let canvas = null, ctx = null, dpr = 1, running = false, last = 0;
const particles = [];

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export const palette = () => ({
  gold: [css("--flop") || "#f5b700", css("--flop-2") || "#ffd766", "#fff4c2"],
  bull: [css("--bull") || "#22d39a", "#8ff5cf", "#ffffff"],
  bear: [css("--bear") || "#ff5d6c", "#ffb0b8", "#ffffff"],
  party: [css("--flop") || "#f5b700", css("--bull") || "#22d39a", css("--bear") || "#ff5d6c", css("--accent") || "#7cc4ff", "#c58bff", "#ffffff"],
  hl: [css("--s-hl") || "#3987e5", "#9cc8ff", "#ffffff"],
  mark: [css("--s-mark") || "#d95926", "#ffb08a", "#ffffff"],
});

function ensure() {
  if (canvas || REDUCED) return !REDUCED;
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  ctx = canvas.getContext("2d");
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  size();
  addEventListener("resize", size);
  document.addEventListener("visibilitychange", () => { if (document.hidden) particles.length = 0; });
  return true;
}

function add(p) {
  if (particles.length >= MAX) particles.shift();
  particles.push(p);
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); if (p.onDeath) p.onDeath(p); continue; }
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.spin * dt;
    const a = Math.min(1, p.life / p.fade);
    ctx.globalAlpha = a;
    if (p.kind === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
    } else if (p.kind === "confetti") {
      ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color; ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9); ctx.restore();
    } else if (p.kind === "coin") {
      ctx.globalCompositeOperation = "source-over";
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.abs(Math.cos(p.rot)) + 0.12, 1);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(-p.size * 0.15, -p.size * 0.6, p.size * 0.3, p.size * 1.2);
      ctx.restore();
    } else if (p.kind === "ring") {
      ctx.globalCompositeOperation = "lighter";
      const r = p.size + (1 - p.life / p.max) * p.grow;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.5 * a;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
    } else if (p.kind === "rocket") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, TAU); ctx.fill();
      if (Math.random() < 0.45) add(spark(p.x, p.y, (Math.random() - 0.5) * 40, 40 + Math.random() * 60, p.color, 0.45, 1.4));
    } else {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, p.color); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  if (particles.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function spark(x, y, vx, vy, color, life = 1, size = 2) {
  return { kind: "spark", x, y, vx, vy, color, life, max: life, fade: life * 0.6, size, gravity: 260, drag: 0.985, rot: 0, spin: 0 };
}

// ------------------------------------------------------------------ public effects

/** Radial explosion of glowing streaks. */
export function burst(x, y, { colors = palette().party, count = 60, speed = 420, life = 1.1, size = 2.2, ring = true } = {}) {
  if (!ensure()) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.75);
    add(spark(x, y, Math.cos(a) * s, Math.sin(a) * s, pick(colors), life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8)));
  }
  add({ kind: "glow", x, y, vx: 0, vy: 0, color: colors[0], life: 0.45, max: 0.45, fade: 0.45, size: 18, gravity: 0, drag: 1, rot: 0, spin: 0 });
  if (ring) add({ kind: "ring", x, y, vx: 0, vy: 0, color: colors[0], life: 0.7, max: 0.7, fade: 0.7, size: 6, grow: speed * 0.22, gravity: 0, drag: 1, rot: 0, spin: 0 });
}

/** A rocket climbs from below and explodes at (x, y). */
export function firework(x, y, colors = palette().party, delay = 0) {
  if (!ensure()) return;
  setTimeout(() => {
    const startY = innerHeight + 10, dist = startY - y, t = 0.75;
    add({ kind: "rocket", x: x + (Math.random() - 0.5) * 60, y: startY, vx: (Math.random() - 0.5) * 30, vy: -dist / t - 130 * t, color: colors[0],
      life: t, max: t, fade: 0.1, size: 2, gravity: 260, drag: 1, rot: 0, spin: 0,
      onDeath: (p) => burst(p.x, p.y, { colors, count: 90, speed: 480, life: 1.4 }) });
  }, delay);
}

/** Confetti rain across the viewport (or from an element's top edge). */
export function confetti({ colors = palette().party, count = 160, from = null } = {}) {
  if (!ensure()) return;
  const box = from ? from.getBoundingClientRect() : { left: 0, width: innerWidth, top: -20 };
  for (let i = 0; i < count; i++) {
    add({ kind: "confetti", x: box.left + Math.random() * box.width, y: box.top - Math.random() * 120, vx: (Math.random() - 0.5) * 160, vy: 60 + Math.random() * 160,
      color: pick(colors), life: 2.6 + Math.random() * 1.6, max: 4, fade: 0.8, size: 4 + Math.random() * 4, gravity: 120, drag: 0.992, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 12 });
  }
}

/** Gold coins spray upward out of an element. */
export function coins(el, count = 26) {
  if (!ensure() || !el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const g = palette().gold;
  for (let i = 0; i < count; i++) {
    add({ kind: "coin", x: r.left + r.width * (0.2 + Math.random() * 0.6), y: r.top + r.height * 0.5, vx: (Math.random() - 0.5) * 320, vy: -260 - Math.random() * 320,
      color: pick(g), life: 1.6 + Math.random() * 0.8, max: 2.4, fade: 0.6, size: 5 + Math.random() * 4, gravity: 720, drag: 0.99, rot: Math.random() * TAU, spin: 8 + Math.random() * 10 });
  }
  burst(r.left + r.width / 2, r.top + r.height / 2, { colors: g, count: 40, speed: 300, life: 0.9, ring: false });
}

/** Explosion centred on an element (or a point inside it). */
export function burstAt(el, opts = {}, fx = 0.5, fy = 0.5) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return;
  burst(r.left + r.width * fx, r.top + r.height * fy, opts);
}

/** A short celebratory show: fireworks across the top plus confetti. */
export function celebrate() {
  if (!ensure()) return;
  const p = palette();
  const sets = [p.gold, p.bull, p.party, p.bear, p.gold];
  sets.forEach((c, i) => firework(innerWidth * (0.15 + 0.7 * (i / (sets.length - 1))), innerHeight * (0.18 + Math.random() * 0.2), c, i * 260));
  setTimeout(() => confetti({ count: 140 }), 500);
}

export const enabled = !REDUCED;
