// אפקטים: קונפטי, חותמות, נצנצים. הכול מכבד "הפחתת תנועה" של המכשיר.

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PALETTE = ['#ff3fa4', '#ff8fd0', '#ffc94d', '#b56cff', '#ffffff', '#6fd6ff'];

/** קונפטי מנקודה במסך (או ממרכז המסך) */
export function confetti(x?: number, y?: number, count = 140, shapes: string[] = []) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'fx-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const ox = x ?? innerWidth / 2, oy = y ?? innerHeight / 3;
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
      r: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
      shape: shapes.length ? shapes[(Math.random() * shapes.length) | 0] : Math.random() < .3 ? 'star' : 'rect',
    };
  });
  let t = 0;
  const tick = () => {
    t++;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / 160);
      if (p.shape === 'rect') { ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); }
      else if (p.shape === 'star') { ctx.fillStyle = p.color; star(ctx, p.r * 1.4); }
      else { ctx.font = `${p.r * 3.2}px serif`; ctx.textAlign = 'center'; ctx.fillText(p.shape, 0, 0); }
      ctx.restore();
    }
    if (t < 170) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
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
