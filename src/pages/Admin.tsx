import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fmtDateTime } from '../lib/util';
import { supabase } from '../lib/supabase';
import { OpenButton, useCapsuleOpen } from './Capsule';

export default function Admin() {
  const { profiles, travelers } = useAuth();
  const { open, reload } = useCapsuleOpen();
  const [meta, setMeta] = useState<{ created_by: string; created_at: string }[]>([]);
  useEffect(() => {
    supabase.rpc('capsule_meta').then(({ data }) => { if (data) setMeta(data as any); });
  }, [open]);

  async function setOpen(v: boolean) {
    await supabase.from('settings').upsert({ key: 'capsule_open', value: v }); reload();
  }
  return (
    <div className="stack-lg narrow">
      <h1>ניהול</h1>
      <section className="card stack">
        <h2>קפסולת הזמן</h2>
        <p>{open ? 'הקפסולה פתוחה, וכל המטיילות רואות את כל המכתבים.' : 'הקפסולה סגורה. אף אחת לא יכולה לקרוא את המכתבים, גם לא את שלה.'}</p>
        {open ? <button className="btn" onClick={() => setOpen(false)}>סגירה מחדש</button> : <OpenButton onConfirm={() => setOpen(true)} />}
        <h3>מי כתבה ומתי</h3>
        <p className="muted small">רק לך, בלי התוכן. סך הכול {meta.length} מכתבים.</p>
        <div className="grid-3">
          {travelers.map((t) => {
            const mine = meta.filter((m) => m.created_by === t.id);
            return (
              <div key={t.id} className="capsule-meta" style={{ ['--c' as any]: t.color }}>
                <div className="row-between"><b><i className="dot" /> {t.display_name.split(' ')[0]}</b><span className="tnum">{mine.length} מכתבים</span></div>
                {mine.length === 0 ? <p className="muted small">עוד לא כתבה</p> : (
                  <ul className="meta-dates">{[...mine].reverse().map((m, i) => <li key={i} className="small tnum">{fmtDateTime(m.created_at)}</li>)}</ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="card stack">
        <h2>מטיילות</h2>
        <p className="muted small">שינוי סיסמה: כותבים סיסמה חדשה (לפחות 6 תווים) ולוחצים שמירה. הסיסמה הישנה מפסיקה לעבוד מיד.</p>
        <ul className="pw-list">{profiles.map((t) => <PasswordRow key={t.id} id={t.id} name={t.display_name} color={t.color} />)}</ul>
      </section>
    </div>
  );
}

const WORDS = ['lama', 'condor', 'andes', 'tango', 'salsa', 'cusco', 'inca', 'sol', 'mango', 'luna', 'playa', 'cafe'];
const randomPw = () => WORDS[Math.floor(Math.random() * WORDS.length)] + String(1000 + Math.floor(Math.random() * 9000));

function PasswordRow({ id, name, color }: { id: string; name: string; color: string }) {
  const [pw, setPw] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [saved, setSaved] = useState('');
  async function save() {
    if (pw.trim().length < 6) return;
    setState('busy');
    const { data, error } = await supabase.functions.invoke('admin-set-password', { body: { userId: id, password: pw.trim() } });
    if (error || !data?.ok) { setState('err'); return; }
    setSaved(pw.trim()); setPw(''); setState('ok');
  }
  return (
    <li className="pw-row">
      <span className="pw-name"><i className="dot" style={{ ['--c' as any]: color }} /> {name}</span>
      <div className="row gap wrap">
        <input id={`pw-${id}`} dir="ltr" placeholder="סיסמה חדשה" value={pw} onChange={(e) => { setPw(e.target.value); setState('idle'); }} />
        <button type="button" className="btn btn-small" onClick={() => { setPw(randomPw()); setState('idle'); }}>🎲 אקראית</button>
        <button type="button" className="btn btn-small btn-primary" disabled={pw.trim().length < 6 || state === 'busy'} onClick={save}>{state === 'busy' ? 'שומר…' : 'שמירה'}</button>
      </div>
      {state === 'ok' && <p className="ok small">הסיסמה עודכנה. הסיסמה החדשה: <b dir="ltr">{saved}</b> (שלח לה אותה)</p>}
      {state === 'err' && <p className="error">לא הצלחתי לעדכן. בדוק חיבור לאינטרנט ונסה שוב.</p>}
    </li>
  );
}
