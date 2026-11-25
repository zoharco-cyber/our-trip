import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { checkPin, hasPin, isOpen, lockedFor, lockNow, setPin } from '../lib/pin';

function Keypad({ value, onChange, onDone, disabled }: { value: string; onChange: (v: string) => void; onDone: (v: string) => void; disabled?: boolean }) {
  const press = (d: string) => {
    if (disabled || value.length >= 4) return;
    const v = value + d; onChange(v);
    if (v.length === 4) setTimeout(() => onDone(v), 120);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="pin-pad-wrap">
      <div className="pin-dots" aria-label={`${value.length} מתוך 4 ספרות`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < value.length ? 'on' : ''} />)}</div>
      <div className="pin-pad" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" disabled={disabled} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button type="button" disabled={disabled} onClick={() => press('0')}>0</button>
        <button type="button" className="pin-del" aria-label="מחיקה" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>⌫</button>
      </div>
    </div>
  );
}

/** עוטף עמודים רגישים (מסמכים, סיסמאות): צריך קוד של 4 ספרות כדי לפתוח */
export default function PinGate({ children, what }: { children: ReactNode; what: string }) {
  const { me, session } = useAuth();
  const uid = me?.id || '';
  const [open, setOpen] = useState(isOpen);
  const [mode, setMode] = useState<'enter' | 'new1' | 'new2' | 'forgot'>(() => (uid && hasPin(uid) ? 'enter' : 'new1'));
  const [val, setVal] = useState('');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(() => (uid ? lockedFor(uid) : 0));
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (uid) setMode(hasPin(uid) ? 'enter' : 'new1'); }, [uid]);
  useEffect(() => { const f = () => setOpen(false); window.addEventListener('trip:pinlock', f); return () => window.removeEventListener('trip:pinlock', f); }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setWait(lockedFor(uid)), 1000); return () => clearInterval(t);
  }, [wait, uid]);

  if (!uid) return <>{children}</>;
  if (open) return (
    <>
      <div className="pin-bar">
        <span className="small muted">🔓 פתוח</span>
        <button className="link-btn" onClick={() => { setMode('new1'); setVal(''); setMsg('בחרי קוד חדש'); lockNow(); setOpen(false); }}>שינוי קוד</button>
        <button className="link-btn" onClick={() => { lockNow(); setOpen(false); setVal(''); setMsg(null); setMode('enter'); }}>🔒 נעילה</button>
      </div>
      {children}
    </>
  );

  const bad = (m: string) => { setMsg(m); setShake(true); setTimeout(() => { setShake(false); setVal(''); }, 450); };
  async function done(v: string) {
    if (mode === 'enter') {
      if (await checkPin(uid, v)) { setOpen(true); setVal(''); setMsg(null); return; }
      const w = lockedFor(uid); setWait(w);
      bad(w > 0 ? 'יותר מדי ניסיונות' : 'קוד לא נכון');
    } else if (mode === 'new1') {
      setFirst(v); setVal(''); setMode('new2'); setMsg('עוד פעם, לאישור');
    } else if (mode === 'new2') {
      if (v !== first) { setMode('new1'); bad('הקודים לא תואמים. מתחילים מחדש'); return; }
      await setPin(uid, v); setOpen(true); setVal(''); setMsg(null);
    }
  }
  async function resetWithPassword() {
    const email = session?.user.email;
    if (!email || !pw) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) { setMsg(error.message.includes('Invalid') ? 'הסיסמה לא נכונה' : 'צריך קליטה כדי לאפס את הקוד'); return; }
    setPw(''); setMode('new1'); setVal(''); setMsg('סיסמה נכונה. עכשיו בחרי קוד חדש');
  }

  const title = mode === 'enter' ? 'הקוד שלך' : mode === 'forgot' ? 'שכחת את הקוד?' : mode === 'new2' ? 'אישור הקוד' : 'בחירת קוד';
  return (
    <div className="pin-gate">
      <div className="pin-card">
        <div className="pin-lock" aria-hidden="true">🔒</div>
        <h1>{title}</h1>
        <p className="muted">{mode === 'new1' && !msg ? `כדי ש${what} יישארו שלך גם אם הטלפון נגנב, בחרי קוד של 4 ספרות. רק בטלפון הזה.` : mode === 'forgot' ? 'מאפסים עם הסיסמה של החשבון (צריך קליטה).' : `${what} נעולים`}</p>
        {msg && <p className={'pin-msg' + (shake ? ' shake' : '')}>{msg}</p>}
        {wait > 0 && mode === 'enter' && <p className="pin-msg">אפשר לנסות שוב בעוד {Math.ceil(wait / 1000)} שניות</p>}
        {mode === 'forgot' ? (
          <div className="stack pin-forgot">
            <input id="pin-pw" type="password" autoComplete="current-password" placeholder="הסיסמה של החשבון" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn btn-primary" disabled={!pw || busy} onClick={resetWithPassword}>{busy ? 'בודקת…' : 'איפוס הקוד'}</button>
            <button className="link-btn" onClick={() => { setMode('enter'); setMsg(null); }}>חזרה</button>
          </div>
        ) : (
          <div className={shake ? 'shake' : ''}><Keypad value={val} onChange={setVal} onDone={done} disabled={wait > 0 && mode === 'enter'} /></div>
        )}
        {mode === 'enter' && <button className="link-btn pin-forgot-link" onClick={() => { setMode('forgot'); setMsg(null); }}>שכחתי את הקוד</button>}
      </div>
    </div>
  );
}
