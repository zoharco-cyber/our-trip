import { useEffect, useRef, useState } from 'react';
import { confetti, reducedMotion } from '../lib/fx';

/**
 * מכתב הפתיחה: הפקה קולנועית מוגזמת.
 * חושך → זרקור → "יש לך הודעה סודית" → זיקוקים ומעטפת זהב ענקית → החותם נשבר → המכתב נפרש והטקסט נכתב.
 */
export default function LetterReveal({ name, text, from = 'זוהר', onClose, preview }: {
  name: string; text: string; from?: string; onClose: () => void; preview?: boolean;
}) {
  const quick = reducedMotion();
  const [stage, setStage] = useState<'dark' | 'tease' | 'envelope' | 'open' | 'letter'>(quick ? 'letter' : 'dark');
  const [typed, setTyped] = useState(quick ? text.split(/\s+/).length : 0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const words = text.split(/(\s+)/);

  // ציר הזמן של הפתיחה
  useEffect(() => {
    if (quick) return;
    const t1 = setTimeout(() => setStage('tease'), 1300);
    const t2 = setTimeout(() => setStage('envelope'), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // זיקוקים ברקע מהרגע שהמעטפה מופיעה
  useEffect(() => {
    if (quick || (stage !== 'envelope' && stage !== 'open' && stage !== 'letter')) return;
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string };
    let parts: P[] = [];
    const colors = ['#ffd36b', '#fff4c2', '#ff7cc4', '#ffffff', '#e6b450'];
    const burst = () => {
      const x = innerWidth * (0.15 + Math.random() * 0.7), y = innerHeight * (0.1 + Math.random() * 0.35);
      const color = colors[(Math.random() * colors.length) | 0];
      for (let i = 0; i < 70; i++) {
        const a = (Math.PI * 2 * i) / 70, v = 2 + Math.random() * 3.5;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };
    let raf = 0, frame = 0;
    const loop = () => {
      frame++;
      if (frame % (stage === 'letter' ? 70 : 28) === 0) burst();
      ctx.fillStyle = 'rgba(5, 3, 8, 0.22)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.vy += 0.035; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.012;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    burst(); loop();
    return () => cancelAnimationFrame(raf);
  }, [stage === 'envelope' || stage === 'open' || stage === 'letter']);

  // הטקסט נכתב מילה אחרי מילה
  useEffect(() => {
    if (stage !== 'letter' || quick) return;
    const total = words.length;
    if (typed >= total) return;
    const t = setTimeout(() => setTyped((n) => n + 1), words[typed]?.trim() ? 75 : 0);
    return () => clearTimeout(t);
  }, [stage, typed]);

  function openEnvelope() {
    setStage('open');
    confetti(innerWidth / 2, innerHeight / 2, 200, ['✨', '💛', '💖', '⭐']);
    setTimeout(() => setStage('letter'), 1700);
  }

  const done = typed >= words.length;
  return (
    <div className={'lr lr-s-' + stage} role="dialog" aria-modal="true" aria-label="מכתב פתיחה">
      <canvas ref={canvas} className="lr-fireworks" aria-hidden="true" />
      <div className="lr-spot" aria-hidden="true" />
      <div className="lr-grain" aria-hidden="true" />

      {(stage === 'dark' || stage === 'tease') && (
        <div className="lr-tease">
          {stage === 'tease' && <>
            <p className="lr-kicker">✦ ✦ ✦</p>
            <h2 className="lr-type">{name},</h2>
            <p className="lr-type lr-type2">יש לך הודעה סודית</p>
          </>}
        </div>
      )}

      {(stage === 'envelope' || stage === 'open') && (
        <div className="lr-stage">
          <div className="lr-rays" aria-hidden="true" />
          <div className="lr-env">
            <div className="lr-env-back" />
            <div className="lr-env-flap" />
            <div className="lr-env-front"><span className="lr-env-to">ל{name}</span></div>
            <div className="lr-seal" aria-hidden="true">
              <span className="lr-seal-half a" /><span className="lr-seal-half b" />
              <span className="lr-seal-mark">Z</span>
            </div>
          </div>
          {stage === 'envelope' && <button className="lr-open-btn" onClick={openEnvelope}>לפתוח ✨</button>}
        </div>
      )}

      {stage === 'letter' && (
        <article className="lr-letter">
          <div className="lr-foil" aria-hidden="true" />
          <header>
            <span className="lr-crest" aria-hidden="true">✦</span>
            <h2>{name} היקרה</h2>
            <span className="lr-rule" aria-hidden="true" />
          </header>
          <p className="lr-body">
            {words.slice(0, typed).join('')}
            {!done && <span className="lr-caret" aria-hidden="true" />}
          </p>
          {done && (
            <footer className="lr-sign">
              <span>באהבה,</span>
              <b>{from} 🕵️</b>
            </footer>
          )}
          {done
            ? <button className="lr-close" onClick={onClose}>{preview ? 'סגירת התצוגה' : '💛 יאללה, מתחילות!'}</button>
            : <button className="lr-skip" onClick={() => setTyped(words.length)}>דילוג לסוף</button>}
        </article>
      )}
      {stage !== 'letter' && <button className="lr-skip lr-skip-top" onClick={() => { setStage('letter'); setTyped(words.length); }}>דילוג</button>}
    </div>
  );
}
