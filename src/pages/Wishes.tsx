import { FormEvent, useState } from 'react';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Wish } from '../lib/types';
import { fmtDate } from '../lib/util';
import { Who, Empty } from '../components/Avatar';
import { confetti } from '../lib/fx';

export default function Wishes() {
  const { rows, reload, setRows } = useTable<Wish>('wishes', { order: 'created_at', ascending: false });
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [tab, setTab] = useState<'open' | 'done'>('open');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('wishes').insert({ text: text.trim(), place: place.trim() || null });
    setText(''); setPlace(''); reload();
  }
  async function toggle(w: Wish, e?: React.MouseEvent) {
    const done = !w.done;
    if (done) confetti(e?.clientX, e?.clientY, 160);
    setRows((r) => r.map((x) => x.id === w.id ? { ...x, done } : x));
    await supabase.from('wishes').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', w.id);
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from('wishes').delete().eq('id', id);
  }

  const open = rows.filter((w) => !w.done), done = rows.filter((w) => w.done);
  const list = tab === 'open' ? open : done;

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>חלומות</h1>
        <p className="muted">מה עוד רוצות לעשות בטיול? כתבו כאן, וסמנו כשזה קורה.</p>
      </div>
      <form className="card stack" onSubmit={add}>
        <textarea id="wish-text" rows={2} placeholder="למשל: לישון תחת כוכבים במדבר אטקמה" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="form-row">
          <input id="wish-place" className="grow" placeholder="איפה? (לא חובה)" value={place} onChange={(e) => setPlace(e.target.value)} />
          <button className="btn btn-primary" disabled={!text.trim()}>הוספת חלום</button>
        </div>
      </form>
      <div className="seg" role="tablist">
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>מחכים ({open.length})</button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>הוגשמו ({done.length})</button>
      </div>
      {list.length === 0 ? (
        <Empty title={tab === 'open' ? 'אין עדיין חלומות' : 'עוד לא הוגשם חלום'}>{tab === 'open' ? 'החלום הראשון מחכה לך.' : 'זה יגיע.'}</Empty>
      ) : (
        <ul className="wishes">
          {list.map((w) => (
            <li key={w.id} className={'card wish' + (w.done ? ' done' : '')}>
              <p className="wish-text">{w.text}</p>
              <div className="row-between small">
                <span className="muted"><Who id={w.created_by} />{w.place && <> · {w.place}</>}{w.done && w.done_at && <> · הוגשם ב-{fmtDate(w.done_at)}</>}</span>
                <span className="row gap">
                  <button className={'btn btn-small' + (w.done ? '' : ' btn-primary')} onClick={(e) => toggle(w, e)}>{w.done ? 'החזרה לרשימה' : 'הגשמנו!'}</button>
                  <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(w.id)}>×</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
