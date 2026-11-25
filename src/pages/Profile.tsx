import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/avatar';

/** הפרופיל שלי: שינוי סיסמה עצמאי (מאמתים קודם את הסיסמה הנוכחית) */
export default function Profile() {
  const { me, session, isAdmin, reloadProfiles } = useAuth();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f || !me) return;
    if (!navigator.onLine) { setPhotoMsg('צריך קליטה כדי להעלות תמונה.'); return; }
    setPhotoBusy(true); setPhotoMsg(null);
    const url = await uploadAvatar(me.id, f);
    setPhotoBusy(false);
    if (!url) { setPhotoMsg('לא הצלחתי להעלות. נסי שוב.'); return; }
    await reloadProfiles(); setPhotoMsg('התמונה עודכנה ✓');
  }
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!me || !session) return null;
  const email = session.user.email || '';
  const tooShort = pw.length > 0 && pw.length < 6;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSave = cur && pw.length >= 6 && pw === pw2 && pw !== cur && !busy;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true); setMsg(null);
    if (!navigator.onLine) { setBusy(false); setMsg({ ok: false, text: 'צריך קליטה כדי לשנות סיסמה.' }); return; }
    const check = await supabase.auth.signInWithPassword({ email, password: cur });
    if (check.error) { setBusy(false); setMsg({ ok: false, text: check.error.message.includes('Invalid') ? 'הסיסמה הנוכחית לא נכונה.' : 'אין חיבור כרגע. נסי שוב בעוד רגע.' }); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /different|same/i.test(error.message) ? 'הסיסמה החדשה זהה לישנה.' : /weak|short|least/i.test(error.message) ? 'הסיסמה חלשה מדי. נסי ארוכה יותר.' : 'לא הצלחתי לשנות. נסי שוב.' }); return; }
    setCur(''); setPw(''); setPw2('');
    setMsg({ ok: true, text: 'הסיסמה שונתה ✓ מהכניסה הבאה משתמשים בסיסמה החדשה.' });
  }

  return (
    <div className="stack-lg narrow">
      <div className="profile-head" style={{ ['--c' as any]: me.color }}>
        <label className={'profile-av' + (photoBusy ? ' busy' : '')} title="החלפת תמונה">
          {me.avatar_url ? <img src={me.avatar_url} alt="" /> : me.display_name[0]}
          <span className="profile-cam" aria-hidden="true">📷</span>
          <input type="file" accept="image/*" hidden onChange={pickPhoto} disabled={photoBusy} />
        </label>
        <div><h1>{me.display_name}</h1><p className="muted">{isAdmin ? 'מנהל' : 'מטיילת'}</p>
          <p className="small">{photoBusy ? 'מעלה…' : photoMsg || 'לחיצה על העיגול: צילום או בחירת תמונה'}</p></div>
      </div>

      <form className="card stack" onSubmit={save}>
        <h2>🔑 שינוי סיסמה</h2>
        <p className="muted small">הסיסמה שאיתה נכנסים לאפליקציה. לפחות 6 תווים.</p>
        <label className="field"><span>הסיסמה הנוכחית</span>
          <input id="pf-cur" type={show ? 'text' : 'password'} dir="ltr" autoComplete="current-password" value={cur} onChange={(e) => { setCur(e.target.value); setMsg(null); }} /></label>
        <label className="field"><span>סיסמה חדשה</span>
          <input id="pf-new" type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(null); }} /></label>
        {tooShort && <p className="small bad">לפחות 6 תווים</p>}
        <label className="field"><span>שוב הסיסמה החדשה</span>
          <input id="pf-new2" type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(null); }} /></label>
        {mismatch && <p className="small bad">הסיסמאות לא תואמות</p>}
        <label className="check small"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>להציג את הסיסמאות</span></label>
        <button className="btn btn-primary" disabled={!canSave}>{busy ? 'שומרת…' : 'שמירת הסיסמה החדשה'}</button>
        {msg && <p className={msg.ok ? 'ok' : 'bad'}><b>{msg.text}</b></p>}
        {!isAdmin && <p className="muted small">שכחת את הסיסמה? זוהר יכול להגדיר לך חדשה מעמוד הניהול.</p>}
      </form>
    </div>
  );
}
