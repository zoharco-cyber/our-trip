import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useMoney } from '../lib/money';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { OpenButton, useCapsuleOpen } from './Capsule';

export default function Admin() {
  const { travelers } = useAuth();
  const { rate, rateSource } = useMoney();
  const { open, reload } = useCapsuleOpen();
  const settings = useTable<{ key: string; value: any }>('settings');
  const manual = settings.rows.find((s) => s.key === 'usd_ils_rate')?.value;
  const [r, setR] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function setOpen(v: boolean) {
    await supabase.from('settings').upsert({ key: 'capsule_open', value: v }); reload();
  }
  async function saveRate(e: FormEvent) {
    e.preventDefault();
    const n = Number(r);
    if (!(n > 0)) return;
    await supabase.from('settings').upsert({ key: 'usd_ils_rate', value: n });
    setR(''); setMsg('השער נשמר'); settings.reload();
  }

  return (
    <div className="stack-lg narrow">
      <h1>ניהול</h1>
      <section className="card stack">
        <h2>קפסולת הזמן</h2>
        <p>{open ? 'הקפסולה פתוחה, וכל המטיילות רואות את כל המכתבים.' : 'הקפסולה סגורה. כל אחת רואה רק את מה שהיא כתבה.'}</p>
        {open ? <button className="btn" onClick={() => setOpen(false)}>סגירה מחדש</button> : <OpenButton onConfirm={() => setOpen(true)} />}
      </section>
      <section className="card stack">
        <h2>שער דולר</h2>
        <p className="muted small">כרגע: ₪{rate.toFixed(3)} {rateSource === 'live' ? '(עדכני, מתעדכן אוטומטית)' : '(קבוע)'}. השער הקבוע ({manual ?? '–'}) משמש רק כשאין גישה לשער העדכני.</p>
        <form className="form-row" onSubmit={saveRate}>
          <input id="admin-rate" type="number" step="0.001" min="0" placeholder="שער קבוע חדש" value={r} onChange={(e) => setR(e.target.value)} />
          <button className="btn btn-primary" disabled={!r}>שמירה</button>
        </form>
        {msg && <p className="ok">{msg}</p>}
      </section>
      <section className="card stack">
        <h2>מטיילות</h2>
        <ul className="list">{travelers.map((t) => <li key={t.id} className="list-item"><i className="dot" style={{ ['--c' as any]: t.color }} />{t.display_name}</li>)}</ul>
        <p className="muted small">שינוי סיסמה: ב-Supabase, בתפריט Authentication ואז Users.</p>
      </section>
    </div>
  );
}
