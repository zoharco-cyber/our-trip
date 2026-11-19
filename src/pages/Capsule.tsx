import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { CapsuleEntry } from '../lib/types';
import { fmtDate } from '../lib/util';
import { Who } from '../components/Avatar';

export function useCapsuleOpen() {
  const { rows, reload } = useTable<{ key: string; value: any }>('settings', { filter: (q) => q.eq('key', 'capsule_open') });
  return { open: rows[0]?.value === true, reload };
}

export default function Capsule() {
  const { me, isAdmin } = useAuth();
  const { open, reload: reloadOpen } = useCapsuleOpen();
  const entries = useTable<CapsuleEntry>('capsule_entries', { order: 'created_at' }, [open]);
  const [count, setCount] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  async function loadCount() {
    const { data } = await supabase.rpc('capsule_count');
    if (typeof data === 'number') setCount(data);
  }
  useEffect(() => { loadCount(); }, [entries.rows.length]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('capsule_entries').insert({ content: text.trim() });
    setText(''); setSent(true); entries.reload(); loadCount();
    setTimeout(() => setSent(false), 3000);
  }
  async function setOpen(v: boolean) {
    await supabase.from('settings').upsert({ key: 'capsule_open', value: v });
    reloadOpen(); entries.reload();
  }

  const mine = entries.rows.filter((e) => e.created_by === me?.id);

  if (open) {
    return (
      <div className="stack-lg narrow">
        <div className="capsule-head open">
          <h1>הקפסולה נפתחה</h1>
          <p>{entries.rows.length} מכתבים מכל הטיול</p>
        </div>
        <ul className="letters">
          {entries.rows.map((e) => (
            <li key={e.id} className="letter">
              <p>{e.content}</p>
              <footer><Who id={e.created_by} /> · {fmtDate(e.created_at)}</footer>
            </li>
          ))}
        </ul>
        {isAdmin && <button className="btn" onClick={() => setOpen(false)}>סגירת הקפסולה מחדש</button>}
      </div>
    );
  }

  return (
    <div className="stack-lg narrow">
      <div className="capsule-head">
        <h1>קפסולת זמן</h1>
        <p>מה שנכתב כאן נשאר סודי עד סוף הטיול. רק המנהל יכול לפתוח את הקפסולה, ואז כולן יקראו הכול.</p>
        <p className="capsule-count"><b className="tnum">{count ?? '–'}</b> מכתבים חתומים</p>
      </div>
      {me?.is_traveler && (
        <form className="card stack" onSubmit={add}>
          <textarea id="capsule-text" rows={6} placeholder="מכתב לעצמך, לבנות, לעתיד…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" disabled={!text.trim()}>חתימה בקפסולה</button>
          {sent && <p className="ok">נחתם. ייפתח בסוף הטיול.</p>}
        </form>
      )}
      {mine.length > 0 && (
        <details>
          <summary>המכתבים שלי ({mine.length})</summary>
          <ul className="letters">
            {mine.map((e) => <li key={e.id} className="letter"><p>{e.content}</p><footer>{fmtDate(e.created_at)}</footer></li>)}
          </ul>
        </details>
      )}
      {isAdmin && (
        <div className="card admin-box">
          <b>ניהול</b>
          <p className="muted small">הפתיחה חושפת את כל המכתבים לכל המטיילות.</p>
          <OpenButton onConfirm={() => setOpen(true)} />
        </div>
      )}
    </div>
  );
}

export function OpenButton({ onConfirm }: { onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <div className="row gap">
      <button className="btn btn-primary" onClick={onConfirm}>כן, לפתוח עכשיו</button>
      <button className="btn" onClick={() => setSure(false)}>ביטול</button>
    </div>
  ) : <button className="btn" onClick={() => setSure(true)}>פתיחת הקפסולה</button>;
}
