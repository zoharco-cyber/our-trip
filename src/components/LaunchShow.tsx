import { useEffect, useRef, useState } from 'react';
import { LOGO_URL } from '../config';
import { confetti } from '../lib/fx';
import { buzz, makeSound } from '../lib/launch';

type Sound = ReturnType<typeof makeSound> | null;
export type Girl = { id: string; name: string; color: string; photo?: string | null };

/** 10 השניות האחרונות: מסך שחור, מספר ענק, פעימת לב (צליל במסך הבמה, רטט בטלפון) */
export function FinalTen({ at, sound, big, onZero }: { at: number; sound?: Sound; big?: boolean; onZero: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);
  const left = at - now;
  const n = Math.max(0, Math.ceil(left / 1000));
  const last = useRef(-1);
  useEffect(() => {
    if (n !== last.current && n > 0 && n <= 10) { last.current = n; sound?.beat((10 - n) / 9); buzz(n <= 3 ? [90, 60, 90] : 70); }
    if (left <= 0 && !fired.current) { fired.current = true; onZero(); }
  }, [n, left]);
  if (left > 10_500 || left <= 0) return null;
  return (
    <div className={'ft' + (big ? ' ft-big' : '')} style={{ ['--k' as any]: (10 - n) / 10 }} role="timer" aria-live="assertive">
      <div className="ft-glow" />
      <div className="ft-ring" key={'r' + n} />
      <b className="ft-num tnum" key={n}>{n}</b>
      <span className="ft-cap">{n > 3 ? 'עוד רגע…' : n > 1 ? 'מוכנות?' : '!'}</span>
    </div>
  );
}

/** דרכון של מטיילת: שם גדול בצבע שלה וחותמת "אושרה" */
export function Passport({ g, i, stamped, dim, flight }: { g: Girl; i: number; stamped: boolean; dim?: boolean; flight?: string }) {
  return (
    <div className={'pp' + (stamped ? ' stamped' : '') + (dim ? ' dim' : '')} style={{ ['--c' as any]: g.color }}>
      <div className="pp-top"><span>דרכון מטיילת</span><span className="tnum">№ 00{i + 1}</span></div>
      {g.photo && <img className="pp-photo" src={g.photo} alt="" />}
      <b className="pp-name">{g.name}</b>
      <div className="pp-line"><span>יעד</span><b>דרום אמריקה</b></div>
      <div className="pp-line"><span>המראה</span><b className="tnum">{flight || '22.12.2026'}</b></div>
      <div className="pp-mrz" dir="ltr" aria-hidden="true">P&lt;ISR&lt;&lt;OUR&lt;TRIP&lt;&lt;{String(i + 1).padStart(3, '0')}&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
      <span className="pp-stamp" aria-hidden="true"><small>APPROVED</small>✈<small>אושרה</small></span>
    </div>
  );
}

/** הרגע של האפס: הבזק, פיצוץ, והדרכונים נחתמים אחד-אחד */
export function Reveal({ girls, sound, big, flight, onDone }: { girls: Girl[]; sound?: Sound; big?: boolean; flight?: string; onDone?: () => void }) {
  const [stage, setStage] = useState(0); // 0 הבזק, 1..n דרכונים, n+1 כותרת
  useEffect(() => {
    sound?.boom(); buzz([200, 80, 300]);
    const colors = girls.map((g) => g.color);
    confetti(undefined, innerHeight / 2.4, big ? 320 : 180);
    const ts: number[] = [];
    const step = big ? 1500 : 1100;
    girls.forEach((g, i) => ts.push(window.setTimeout(() => {
      setStage(i + 1); sound?.stamp(); buzz(60);
      confetti(innerWidth * (girls.length === 1 ? 0.5 : 0.2 + (0.6 * i) / Math.max(1, girls.length - 1)), innerHeight * 0.55, big ? 90 : 50, ['✦', '💖', '✈️']);
    }, 1300 + i * step)));
    ts.push(window.setTimeout(() => { setStage(girls.length + 1); sound?.chime(); confetti(undefined, innerHeight / 3, big ? 260 : 140); void colors; }, 1300 + girls.length * step + 400));
    if (onDone) ts.push(window.setTimeout(onDone, 1300 + girls.length * step + (big ? 3200 : 2600)));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className={'rv' + (big ? ' rv-big' : '')}>
      <div className="rv-flash" />
      <img className={'rv-logo' + (stage > 0 ? ' gone' : '')} src={LOGO_URL} alt="" />
      <div className="rv-cards">
        {girls.map((g, i) => <Passport key={g.id} g={g} i={i} stamped={stage > i} flight={flight} dim={stage <= i} />)}
      </div>
      <h1 className={'rv-title' + (stage > girls.length ? ' on' : '')}>הטיול שלנו</h1>
      <p className={'rv-sub' + (stage > girls.length ? ' on' : '')}>ההרפתקה מתחילה ✈️</p>
    </div>
  );
}
