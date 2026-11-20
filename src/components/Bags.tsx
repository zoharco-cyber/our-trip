import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import { confetti } from '../lib/fx';
import type { BagItem } from '../lib/types';
import { Empty } from './Avatar';

const BAGS = { big: { name: 'תיק גדול', icon: '🎒' }, small: { name: 'תיק קטן', icon: '👜' } } as const;
const IDEAS: Record<'big' | 'small', string[]> = {
  big: ['שק שינה', 'מעיל', 'נעלי הליכה', 'בגדים להחלפה', 'כפכפים', 'מגבת', 'ערכת עזרה ראשונה', 'בגד ים'],
  small: ['דרכון', 'ארנק', 'טלפון', 'מטען', 'סוללה ניידת', 'אוזניות', 'בקבוק מים', 'משקפי שמש', 'קרם הגנה'],
};

/** מה יש בתיקים שלי, ובדיקה לפני מעבר. כל אחת רואה רק את שלה */
export default function Bags() {
  const { me } = useAuth();
  const all = useTable<BagItem>('bag_items', { order: 'created_at', filter: (q) => q.eq('user_id', me?.id || '') }, [me?.id]);
  const [bag, setBag] = useState<'big' | 'small'>('big');
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const rows = all.rows.filter((r) => r.bag === bag);
  const inBag = rows.filter((r) => r.checked_at).length;

  if (!me?.is_traveler) return <Empty title="התיקים הם של המטיילות">כאן כל אחת רושמת מה יש בתיקים שלה.</Empty>;

  async function add(e?: FormEvent, value?: string) {
    e?.preventDefault();
    const v = (value ?? text).trim();
    if (!v) return;
    await dbWrite({ table: 'bag_items', kind: 'insert', values: { id: newId(), user_id: me!.id, bag, text: v, checked_at: null, created_at: new Date().toISOString() } });
    setText(''); all.reload();
  }
  async function remove(id: string) { await dbWrite({ table: 'bag_items', kind: 'delete', match: { id } }); all.reload(); }
  async function move(it: BagItem) {
    await dbWrite({ table: 'bag_items', kind: 'update', values: { bag: it.bag === 'big' ? 'small' : 'big' }, match: { id: it.id } }); all.reload();
  }
  async function toggle(it: BagItem, e: React.MouseEvent) {
    const now = it.checked_at ? null : new Date().toISOString();
    all.setRows((r) => r.map((x) => (x.id === it.id ? { ...x, checked_at: now } : x)));
    await dbWrite({ table: 'bag_items', kind: 'update', values: { checked_at: now }, match: { id: it.id } });
    if (now && inBag + 1 === rows.length) confetti(e.clientX, e.clientY, 120, ['🎒', '✨', '🚌', '💖']);
  }
  async function startCheck() {
    for (const it of rows.filter((r) => r.checked_at)) await dbWrite({ table: 'bag_items', kind: 'update', values: { checked_at: null }, match: { id: it.id } });
    all.reload(); setChecking(true);
  }

  const suggestions = IDEAS[bag].filter((s) => !rows.some((r) => r.text === s));
  const done = rows.length > 0 && inBag === rows.length;

  return (
    <div className="stack-lg">
      <div className="bag-tabs" role="tablist">
        {(['big', 'small'] as const).map((b) => (
          <button key={b} role="tab" aria-selected={bag === b} className={'bag-tab' + (bag === b ? ' on' : '')} onClick={() => { setBag(b); setChecking(false); }}>
            <span className="bag-ico">{BAGS[b].icon}</span>
            <b>{BAGS[b].name}</b>
            <span className="small">{(() => { const n = all.rows.filter((r) => r.bag === b).length; return n === 1 ? 'פריט אחד' : `${n} פריטים`; })()}</span>
          </button>
        ))}
      </div>

      {!checking ? (
        <>
          <form className="form-row" onSubmit={add}>
            <input id="bag-text" className="grow" placeholder={`מה יש ב${BAGS[bag].name}?`} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-primary" disabled={!text.trim()}>הוספה</button>
          </form>
          {suggestions.length > 0 && (
            <div className="chips">
              <span className="small muted">רעיונות:</span>
              {suggestions.map((s) => <button key={s} className="chip" onClick={() => add(undefined, s)}>+ {s}</button>)}
            </div>
          )}
          {rows.length === 0 ? <Empty title={`ה${BAGS[bag].name} ריק`}>הוסיפי את מה שיש בו, ולפני כל מעבר תוכלי לוודא שהכול שם.</Empty> : (
            <>
              <ul className="checklist">
                {rows.map((it) => (
                  <li key={it.id}>
                    <span className="grow">{it.text}</span>
                    <button className="btn btn-small" onClick={() => move(it)} title="העברה לתיק השני">{BAGS[it.bag === 'big' ? 'small' : 'big'].icon} העברה</button>
                    <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(it.id)}>×</button>
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary check-btn" onClick={startCheck}>🔍 בדיקה לפני מעבר</button>
            </>
          )}
        </>
      ) : (
        <section className="stack bag-check">
          <div className="row-between">
            <b>בדיקה: {BAGS[bag].icon} {BAGS[bag].name}</b>
            <span className="bag-count tnum">{inBag}/{rows.length} בתיק</span>
          </div>
          <div className="bar"><i style={{ width: rows.length ? (inBag / rows.length) * 100 + '%' : 0 }} /></div>
          {done && <p className="bag-done">הכול בתיק! אפשר לזוז 🚌✨</p>}
          <ul className="checklist big-checks">
            {rows.map((it) => (
              <li key={it.id} className={it.checked_at ? 'done' : ''}>
                <label className="check">
                  <input type="checkbox" checked={!!it.checked_at} onChange={() => {}} onClick={(e) => toggle(it, e)} />
                  <span>{it.text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!done && rows.length - inBag > 0 && <p className="muted small">{rows.length - inBag === 1 ? 'עוד פריט אחד לא סומן.' : `עוד ${rows.length - inBag} פריטים לא סומנו.`} משהו חסר? כדאי לבדוק לפני שיוצאות.</p>}
          <button className="btn" onClick={() => setChecking(false)}>סיום הבדיקה</button>
        </section>
      )}
    </div>
  );
}
