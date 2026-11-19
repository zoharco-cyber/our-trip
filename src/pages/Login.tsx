import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import Countdown from '../components/Countdown';

export default function Login() {
  const { signIn, enterAsGuest, profiles } = useAuth();
  const accounts = [...profiles].sort((a, b) => Number(a.is_admin) - Number(b.is_admin) || a.slug.localeCompare(b.slug));
  const firstNames = profiles.filter((p) => p.is_traveler).map((p) => p.display_name.split(' ')[0]);
  const [slug, setSlug] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setBusy(true); setErr(null);
    const msg = await signIn(slug, pw);
    setBusy(false);
    if (msg) setErr(msg);
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <p className="eyebrow">{firstNames.join(' · ') || '\u00a0'}</p>
        <h1 className="login-title">הטיול שלנו</h1>
        <p className="login-sub">דרום אמריקה ומה שיבוא אחריה</p>
        <Countdown compact />
      </div>

      <form className="card login-card" onSubmit={submit}>
        <h2>מי נכנסת?</h2>
        <div className="who-grid">
          {accounts.length === 0 && <p className="muted small">טוען את רשימת המטיילות… (צריך חיבור לאינטרנט בכניסה הראשונה)</p>}
          {accounts.map((a) => (
            <button type="button" key={a.slug} className={'who-btn' + (slug === a.slug ? ' on' : '')}
              onClick={() => { setSlug(a.slug); setErr(null); }}>
              {a.display_name}
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
        <button type="button" className="btn btn-ghost" onClick={enterAsGuest}>כניסה כאורח/ת: מפה, תמונות וספירה לאחור</button>
      </form>
    </div>
  );
}
