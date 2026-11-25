// אפקטים: קונפטי, חותמות, נצנצים. הכול מכבד "הפחתת תנועה" של המכשיר.

export const reducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.saver === '1');

const PALETTE = ['#ff3fa4', '#ff8fd0', '#ffc94d', '#b56cff', '#ffffff', '#6fd6ff'];

/** קונפטי: שכבה אחת ולולאה אחת לכל הפיצוצים, אימוג׳ים מצוירים מראש, ותנועה לפי זמן אמיתי
 *  (מחשב איטי מדלג על פריימים במקום להאט). אם המחשב נחנק — החלקיקים מתמעטים לבד. */
type Part = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; color: string; shape: string; age: number };
const MAX_PARTS = 320;
let layer: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; parts: Part[]; last: number; slow: number; raf: number } | null = null;
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(ch: string, px: number) {
  const size = Math.max(12, Math.round(px / 6) * 6); // מעט גדלים = מעט ציורים
  const key = ch + size;
  let c = sprites.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = size * 1.4;
    const x = c.getContext('2d')!; x.font = `${size}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, c.width / 2, c.height / 2); sprites.set(key, c);
  }
  return c;
}
function ensureLayer() {
  if (layer) return layer;
  const c = document.createElement('canvas'); c.className = 'fx-canvas';
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
  layer = { c, ctx, parts: [], last: performance.now(), slow: 0, raf: 0 };
  const tick = (now: number) => {
    const L = layer!; const dt = Math.min(3, (now - L.last) / 16.7); L.last = now;
    if (dt > 2.2) { L.slow++; if (L.slow > 4) L.parts = L.parts.filter((_, i) => i % 2 === 0); } else L.slow = Math.max(0, L.slow - 1);
    const g = L.ctx; g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of L.parts) {
      p.age += dt; p.vy += .28 * dt; p.vx *= Math.pow(.985, dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      g.globalAlpha = Math.max(0, 1 - p.age / 160);
      if (p.shape === 'rect' || p.shape === 'star') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
        if (p.shape === 'rect') g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else star(g, p.r * 1.4);
        g.restore();
      } else {
        const sp = sprite(p.shape, p.r * 3.2); const w = sp.width;
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        g.setTransform(Math.cos(p.rot) * dpr, Math.sin(p.rot) * dpr, -Math.sin(p.rot) * dpr, Math.cos(p.rot) * dpr, p.x * dpr, p.y * dpr);
        g.drawImage(sp, -w / 2, -w / 2);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    g.globalAlpha = 1;
    L.parts = L.parts.filter((p) => p.age < 160 && p.y < innerHeight + 60);
    if (L.parts.length) L.raf = requestAnimationFrame(tick);
    else { L.c.remove(); layer = null; }
  };
  layer.raf = requestAnimationFrame(tick);
  return layer;
}

/** קונפטי מנקודה במסך (או ממרכז המסך) */
export function confetti(x?: number, y?: number, count = 140, shapes: string[] = []) {
  if (reducedMotion()) return;
  if (document.documentElement.dataset.noconfetti) return; // בחוויה ובמסך הבמה: בלי קונפטי (כבד מדי)
  const L = ensureLayer();
  const room = Math.max(0, MAX_PARTS - L.parts.length);
  const n = Math.min(room, shapes.length ? Math.round(count * .6) : count); // אימוג׳ים כבדים יותר: פחות מהם
  const ox = x ?? innerWidth / 2, oy = y ?? innerHeight / 3;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
    L.parts.push({
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, age: 0,
      r: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
      shape: shapes.length ? shapes[(Math.random() * shapes.length) | 0] : Math.random() < .3 ? 'star' : 'rect',
    });
  }
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * .35 : r, a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

/** חותמת שעווה שנוחתת על מעטפה */
export function waxSeal() {
  const el = document.createElement('div');
  el.className = 'fx-overlay fx-seal';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="seal-stage">
      <div class="envelope"><div class="env-flap"></div><div class="env-body"></div></div>
      <div class="wax"><svg viewBox="0 0 100 100"><path d="M50 4c8 0 10 6 17 8s14-1 18 6-2 12 0 19 8 11 5 18-10 7-14 13-3 14-10 17-12-3-16-3-11 6-18 3-6-10-11-14S5 76 4 68s6-11 6-18-6-11-4-18 10-6 15-11S42 4 50 4z"/><text x="50" y="62" text-anchor="middle">♥</text></svg></div>
      <p class="seal-text">ננעל בקפסולה ✨</p>
    </div>`;
  document.body.appendChild(el);
  if (!reducedMotion()) setTimeout(() => confetti(innerWidth / 2, innerHeight / 2, 60, ['✨', '💌']), 900);
  setTimeout(() => el.classList.add('out'), 2300);
  setTimeout(() => el.remove(), 2800);
}

/** חותמת "שולם!" עם מטבעות */
export function paidStamp(x?: number, y?: number) {
  const el = document.createElement('div');
  el.className = 'fx-overlay fx-paid';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="paid-stamp">שולם! 💸</div>`;
  document.body.appendChild(el);
  confetti(x, y, 50, ['🪙', '💵', '💖', '✨']);
  setTimeout(() => el.classList.add('out'), 1500);
  setTimeout(() => el.remove(), 2000);
}
