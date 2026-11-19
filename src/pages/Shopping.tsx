import { FormEvent, useState } from 'react';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { ShoppingItem } from '../lib/types';
import { addDays, fmtDate, weekStart } from '../lib/util';
import { Who, Empty } from '../components/Avatar';

export default function Shopping() {
  const [week, setWeek] = useState(weekStart());
  const { rows, reload, setRows } = useTable<ShoppingItem>('shopping_items',
    { order: 'created_at', filter: (q) => q.eq('week_of', week) }, [week]);
  const [text, setText] = useState('');
  const [qty, setQty] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('shopping_items').insert({ text: text.trim(), qty: qty.trim() || null, week_of: week });
    setText(''); setQty(''); reload();
  }
  async function toggle(it: ShoppingItem) {
    setRows((r) => r.map((x) => x.id === it.id ? { ...x, done: !x.done } : x));
    await supabase.from('shopping_items').update({ done: !it.done }).eq('id', it.id);
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from('shopping_items').delete().eq('id', id);
  }
  async function clearDone() {
    await supabase.from('shopping_items').delete().eq('week_of', week).eq('done', true); reload();
  }
  async function copyOpenToNext() {
    const open = rows.filter((r) => !r.done);
    if (!open.length) return;
    await supabase.from('shopping_items').insert(open.map((r) => ({ text: r.text, qty: r.qty, week_of: addDays(week, 7) })));
    setWeek(addDays(week, 7));
  }

  const isThisWeek = week === weekStart();
  const open = rows.filter((r) => !r.done), done = rows.filter((r) => r.done);

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>קניות לשבוע</h1>
        <div className="week-nav">
          <button className="btn btn-small" onClick={() => setWeek(addDays(week, -7))} aria-label="שבוע קודם">→</button>
          <span><b>{isThisWeek ? 'השבוע' : week === addDays(weekStart(), 7) ? 'שבוע הבא' : 'שבוע'}</b> · {fmtDate(week)} עד {fmtDate(addDays(week, 6))}</span>
          <button className="btn btn-small" onClick={() => setWeek(addDays(week, 7))} aria-label="שבוע הבא">←</button>
        </div>
      </div>
      <form className="form-row" onSubmit={add}>
        <input id="shop-text" className="grow" placeholder="מה צריך? למשל: לחם, אבוקדו" value={text} onChange={(e) => setText(e.target.value)} />
        <input id="shop-qty" style={{ width: '7rem' }} placeholder="כמות" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button className="btn btn-primary" disabled={!text.trim()}>הוספה</button>
      </form>
      {rows.length === 0 ? <Empty title="הרשימה ריקה">הוסיפי פריט ראשון, והוא יופיע אצל כולן.</Empty> : (
        <ul className="checklist">
          {[...open, ...done].map((it) => (
            <li key={it.id} className={it.done ? 'done' : ''}>
              <label className="check">
                <input type="checkbox" checked={it.done} onChange={() => toggle(it)} />
                <span>{it.text}{it.qty && <span className="muted"> · {it.qty}</span>}</span>
              </label>
              <Who id={it.created_by} />
              <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(it.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row gap">
        {done.length > 0 && <button className="btn btn-small" onClick={clearDone}>ניקוי מה שנקנה ({done.length})</button>}
        {open.length > 0 && <button className="btn btn-small" onClick={copyOpenToNext}>העברת מה שלא נקנה לשבוע הבא</button>}
      </div>
    </div>
  );
}
