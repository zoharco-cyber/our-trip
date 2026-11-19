import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fmtDateTime } from '../lib/util';
import { supabase } from '../lib/supabase';
import { OpenButton, useCapsuleOpen } from './Capsule';

export default function Admin() {
  const { travelers } = useAuth();
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
        <ul className="list">{travelers.map((t) => <li key={t.id} className="list-item"><i className="dot" style={{ ['--c' as any]: t.color }} />{t.display_name}</li>)}</ul>
        <p className="muted small">שינוי סיסמה: ב-Supabase, בתפריט Authentication ואז Users.</p>
      </section>
    </div>
  );
}
