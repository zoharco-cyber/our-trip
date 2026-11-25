import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import Countdown from '../components/Countdown';
import { LOGO_URL } from '../config';
import { supabase } from '../lib/supabase';
import { confetti } from '../lib/fx';

/** מועד ההשקה (המנהל קובע). null = אין השקה, האתר פתוח */
function useLaunch() {
  const [at, setAt] = useState<number | null>(() => { try { const v = localStorage.getItem('trip:launch'); return v ? Number(v) : null; } catch { return null; } });
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'launch_at').maybeSingle().then(({ data }) => {
      const t = data?.value ? new Date(data.value).getTime() : null;
      setAt(t);
      try { if (t) localStorage.setItem('trip:launch', String(t)); else localStorage.removeItem('trip:launch'); } catch { /* ignore */ }
    });
  }, []);
  return at;
}

function LaunchCountdown({ at, onDone }: { at: number; onDone: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  let ms = Math.max(0, at - now);
  useEffect(() => { if (ms === 0) onDone(); }, [ms === 0]);
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.floor(ms / 6e4); ms -= m * 6e4;
  const sec = Math.floor(ms / 1e3);
  const when = new Date(at).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const left = at - now;
  const mood = left <= 10_000 ? ' final' : left <= 3_600_000 ? ' close' : '';
  const units: [number, string][] = [[d, 'ימים'], [h, 'שעות'], [m, 'דקות'], [sec, 'שניות']];
  return (
    <section className={'launch' + mood} aria-label="ספירה לאחור להשקה">
      <span className="launch-kicker">ההשקה הגדולה</span>
      <div className="launch-units" dir="ltr">
        {units.slice().reverse().map(([n, l], i) => (
          <div key={l} className="launch-group">
            {i > 0 && <span className="launch-sep" aria-hidden="true">:</span>}
            <div className="launch-unit">
              <b className="tnum" key={l === 'שניות' ? n : undefined}>{String(n).padStart(2, '0')}</b>
              <span>{l}</span>
            </div>
          </div>
        ))}
      </div>
      <span className="launch-when">{when}</span>
    </section>
  );
}

export default function Login() {
  const { signIn, enterAsGuest, signInGuest, profiles } = useAuth();
  const launchAt = useLaunch();
  const [launchedNow, setLaunchedNow] = useState(false);
  const locked = !!launchAt && launchAt > Date.now() && !launchedNow;
  const [guestOpen, setGuestOpen] = useState(false);
  const [gpw, setGpw] = useState('');
  const [gErr, setGErr] = useState<string | null>(null);
  async function guestIn(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    if (!gpw) return;
    setBusy(true); setGErr(null);
    const msg = await signInGuest(gpw);
    setBusy(false);
    if (msg) setGErr(msg);
  }
  const accounts = [...profiles].sort((a, b) => Number(a.is_admin) - Number(b.is_admin) || a.slug.localeCompare(b.slug));
  const firstNames = profiles.filter((p) => p.is_traveler).map((p) => p.display_name.split(' ')[0]);
  const [slug, setSlug] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.screen = 'login';
    return () => { delete document.documentElement.dataset.screen; };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setBusy(true); setErr(null);
    const msg = await signIn(slug, pw);
    setBusy(false);
    if (msg) setErr(msg);
  }

  const [wiped, setWiped] = useState(() => { try { return localStorage.getItem('trip:wipedNotice'); } catch { return null; } });
  return (
    <div className="login-wrap">
      {wiped && (
        <div className="wiped-note" role="status">
          <b>🔒 נותקת מהטלפון הזה</b>
          <span className="small">{wiped === 'revoked' ? 'המנהל ניתק את החשבון מכל המכשירים, והמידע שנשמר בטלפון נמחק ליתר ביטחון.' : 'החיבור פג, והמידע שנשמר בטלפון נמחק ליתר ביטחון.'} אפשר להתחבר מחדש עם הסיסמה (אם היא שונתה, זוהר ישלח לך את החדשה). הכול חוזר מהשרת.</span>
          <button className="link-btn" onClick={() => { setWiped(null); try { localStorage.removeItem('trip:wipedNotice'); } catch { /* ignore */ } }}>הבנתי</button>
        </div>
      )}
      <div className="login-hero">
        <div className="logo-ring">
          <img className="login-logo" src={LOGO_URL} alt="הלוגו של הטיול" />
          <span className="spark s1" aria-hidden="true">✦</span><span className="spark s2" aria-hidden="true">✦</span><span className="spark s3" aria-hidden="true">✦</span>
        </div>
        <p className="eyebrow">{firstNames.join(' · ') || '\u00a0'}</p>
        <h1 className="login-title">הטיול שלנו</h1>
        <p className="login-sub">דרום אמריקה ומה שיבוא אחריה</p>
        {locked
          ? <LaunchCountdown at={launchAt!} onDone={() => { setLaunchedNow(true); confetti(undefined, undefined, 220); }} />
          : launchedNow ? <p className="launch-done">🎉 האפליקציה הושקה! ברוכים הבאים</p> : <Countdown compact />}
      </div>

      <form className="card login-card" onSubmit={submit}>
        <h2>מי נכנסת?</h2>
        <div className="who-grid">
          {accounts.length === 0 && <p className="muted small">טוען את רשימת המטיילות… (צריך חיבור לאינטרנט בכניסה הראשונה)</p>}
          {accounts.map((a) => (
            <button type="button" key={a.slug} className={'who-btn' + (slug === a.slug ? ' on' : '')} style={{ ['--c' as any]: a.is_admin ? '#1a1a1a' : a.color }}
              onClick={() => { setSlug(a.slug); setErr(null); }}>
              <i className="dot" aria-hidden="true" />{a.display_name}
            </button>
          ))}
        </div>
        {slug && (
          <>
            <label className="field">
              <span>סיסמה</span>
              <input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            </label>
            {err && <p className="error">{err}</p>}
            <button className="btn btn-primary" disabled={busy || !pw}>{busy ? 'נכנסת…' : 'כניסה'}</button>
          </>
        )}
        <div className="divider"><span>או</span></div>
        {!locked ? (
          <button type="button" className="btn btn-ghost" onClick={enterAsGuest}>כניסה כאורח/ת: מפה, תמונות וספירה לאחור</button>
        ) : !guestOpen ? (
          <button type="button" className="btn btn-ghost" onClick={() => setGuestOpen(true)}>🔒 כניסה כאורח/ת (עד ההשקה, עם סיסמה)</button>
        ) : (
          <div className="stack">
            <label className="field"><span>סיסמת אורחים</span>
              <input id="guest-pw" type="password" autoFocus value={gpw} onChange={(e) => setGpw(e.target.value)} autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') guestIn(e); }} />
            </label>
            {gErr && <p className="error">{gErr}</p>}
            <button type="button" className="btn btn-primary" disabled={busy || !gpw} onClick={() => guestIn()}>{busy ? 'נכנסים…' : 'כניסה כאורח/ת'}</button>
            <p className="muted small">אחרי ההשקה תהיה כניסה לאורחים בלי סיסמה.</p>
          </div>
        )}
      </form>
    </div>
  );
}
