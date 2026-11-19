import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { OpenButton, useCapsuleOpen } from './Capsule';

export default function Admin() {
  const { travelers } = useAuth();
  const { open, reload } = useCapsuleOpen();

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
      </section>
      <section className="card stack">
        <h2>מטיילות</h2>
        <ul className="list">{travelers.map((t) => <li key={t.id} className="list-item"><i className="dot" style={{ ['--c' as any]: t.color }} />{t.display_name}</li>)}</ul>
        <p className="muted small">שינוי סיסמה: ב-Supabase, בתפריט Authentication ואז Users.</p>
      </section>
    </div>
  );
}
