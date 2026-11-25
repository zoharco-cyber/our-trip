import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LOGO_URL } from '../config';
import { confetti } from '../lib/fx';
import { makeSound, onArrival, useLaunchAt } from '../lib/launch';
import { FinalTen, Passport, Reveal, type Girl } from '../components/LaunchShow';

/** מסך הבמה להשקה: לטלוויזיה/מחשב בחדר. פתוח בלי התחברות.
 *  #/stage        — לפי שעת ההשקה האמיתית
 *  #/stage?demo=1 — חזרה גנרלית: השקה 20 שניות אחרי הלחיצה, ומקשים 1/2/3 מדמים כניסה */
export default function Stage() {
  const { travelers } = useAuth();
  const demo = new URLSearchParams(useLocation().search).get('demo') === '1';
  const realAt = useLaunchAt();
  const [started, setStarted] = useState(false);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const at = demo ? demoAt : realAt;
  const [phase, setPhase] = useState<'wait' | 'reveal' | 'arrivals' | 'all'>('wait');
  const [now, setNow] = useState(Date.now());
  const [arrived, setArrived] = useState<string[]>([]);
  const [flight, setFlight] = useState<{ at: number; label: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const sound = useRef<ReturnType<typeof makeSound> | null>(null);
  const girls: Girl[] = useMemo(() => travelers.map((t) => ({ id: t.id, name: t.display_name.split(' ')[0], color: t.color })), [travelers]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => { document.documentElement.dataset.noconfetti = '1'; return () => { delete document.documentElement.dataset.noconfetti; }; }, []);
  useEffect(() => { document.documentElement.classList.add('stage-lock'); return () => document.documentElement.classList.remove('stage-lock'); }, []);
  useEffect(() => {
    supabase.from('events').select('starts_at').order('starts_at').limit(1).then(({ data }) => {
      const s = data?.[0]?.starts_at; const t = s ? new Date(s).getTime() : new Date('2026-12-22T06:30:00+02:00').getTime();
      setFlight({ at: t, label: new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem' }) });
    });
    import('qrcode').then((Q) => Q.toDataURL(location.origin + location.pathname, { margin: 1, width: 360, color: { dark: '#0b0710', light: '#ffffff' } })).then(setQr).catch(() => {});
  }, []);
  // אם ההשקה כבר עברה (פתחו את המסך באיחור): ישר לכניסות
  useEffect(() => { if (started && at && at < Date.now() - 1500 && phase === 'wait') setPhase('arrivals'); }, [started, at]);

  function arrive(id: string) {
    setArrived((a) => {
      if (a.includes(id)) return a;
      const g = girls.find((x) => x.id === id);
      sound.current?.chime();
      const i = girls.findIndex((x) => x.id === id);
      confetti(innerWidth * (0.2 + (0.6 * i) / Math.max(1, girls.length - 1)), innerHeight * 0.45, 110, ['💖', '✨', '✈️']);
      void g;
      return [...a, id];
    });
  }
  useEffect(() => onArrival((p) => arrive(p.id)), [girls]);
  useEffect(() => {
    if (!demo) return;
    const k = (e: KeyboardEvent) => { const i = Number(e.key) - 1; if (girls[i]) arrive(girls[i].id); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [demo, girls]);
  useEffect(() => {
    if (phase === 'arrivals' && girls.length && arrived.length >= girls.length) {
      const t = setTimeout(() => { setPhase('all'); sound.current?.boom(); confetti(undefined, undefined, 400); }, 1600);
      return () => clearTimeout(t);
    }
  }, [arrived, phase, girls.length]);

  async function start() {
    sound.current = makeSound(); sound.current.unlock();
    try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
    try { await (navigator as any).wakeLock?.request('screen'); } catch { /* ignore */ }
    if (demo) setDemoAt(Date.now() + 20_000);
    setStarted(true);
  }

  if (!started) return (
    <div className="stage stage-start">
      <img className="stage-logo" src={LOGO_URL} alt="" />
      <h1>מסך ההשקה</h1>
      <p>{demo ? 'חזרה גנרלית: ההשקה תתחיל 20 שניות אחרי הלחיצה. מקשים 1, 2, 3 מדמים כניסה של כל אחת.' : at ? `ההשקה: ${new Date(at).toLocaleString('he-IL', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}` : 'לא נקבעה שעת השקה'}</p>
      <button className="stage-go" onClick={start}>▶ התחלת ההקרנה</button>
      <small>מסך מלא + סאונד. כדאי לחבר לרמקול ולהשאיר את המחשב בטעינה.</small>
    </div>
  );

  const left = at ? at - now : 0;
  const d = Math.max(0, left);
  const H = Math.floor(d / 36e5), M = Math.floor((d % 36e5) / 6e4), S = Math.floor((d % 6e4) / 1e3);
  const fl = flight ? Math.max(0, Math.ceil((flight.at - now) / 864e5)) : null;

  return (
    <div className={'stage stage-' + phase}>
      {phase === 'wait' && at && (
        <>
          <div className="stage-wait">
            <span className="stage-kicker">ההשקה הגדולה</span>
            {left > 10_500 && (
              <div className="stage-clock tnum" dir="ltr">
                {H > 0 && <><b>{String(H).padStart(2, '0')}</b><i>:</i></>}<b>{String(M).padStart(2, '0')}</b><i>:</i><b key={S}>{String(S).padStart(2, '0')}</b>
              </div>
            )}
            <div className="stage-slots">{girls.map((g) => <span key={g.id} style={{ ['--c' as any]: g.color }}>{g.name}</span>)}</div>
          </div>
          <FinalTen at={at} big sound={sound.current} onZero={() => setPhase('reveal')} />
        </>
      )}
      {phase === 'reveal' && <Reveal girls={girls} big sound={sound.current} flight={flight?.label} onDone={() => setPhase('arrivals')} />}
      {(phase === 'arrivals' || phase === 'all') && (
        <div className="stage-arr">
          <h1 className="stage-h">{phase === 'all' ? 'כולן בפנים. ההרפתקה מתחילה 💖' : 'עכשיו תורכן: להתחבר!'}</h1>
          <div className="stage-cards">
            {girls.map((g, i) => (
              <div key={g.id} className={'stage-card' + (arrived.includes(g.id) ? ' in' : '')}>
                <Passport g={g} i={i} stamped={arrived.includes(g.id)} dim={!arrived.includes(g.id)} flight={flight?.label} />
                <span className="stage-tag">{arrived.includes(g.id) ? 'נכנסה! 💖' : 'מחכה…'}</span>
              </div>
            ))}
          </div>
          {phase === 'arrivals' ? (
            qr && <div className="stage-qr"><img src={qr} alt="קוד QR לאתר" /><span>סורקות, נכנסות עם השם והסיסמה</span></div>
          ) : (
            fl !== null && <div className="stage-flight"><b className="tnum">{fl}</b><span>ימים להמראה ✈️ {flight?.label}</span></div>
          )}
          {demo && phase === 'arrivals' && <div className="stage-demo">{girls.map((g, i) => <button key={g.id} onClick={() => arrive(g.id)}>{i + 1} · {g.name}</button>)}</div>}
        </div>
      )}
    </div>
  );
}
