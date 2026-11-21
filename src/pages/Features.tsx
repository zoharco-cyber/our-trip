import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { FEATURES } from '../data/features';

/** כל הפיצ׳רים, עם סימון "הוסבר לבנות". רק למנהל. הסימונים נשמרים בחשבון */
export default function Features() {
  const { isAdmin, me } = useAuth();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [saved, setSaved] = useState<string>('');
  const total = FEATURES.reduce((s, c) => s + c.items.length, 0);

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'features_checked').maybeSingle().then(({ data }) => {
      if (Array.isArray(data?.value)) setChecked(new Set(data!.value as string[]));
    });
  }, []);
  async function toggle(id: string, on: boolean) {
    const next = new Set(checked); on ? next.add(id) : next.delete(id);
    setChecked(next); setSaved('שומר…');
    const { error } = await supabase.from('settings').upsert({ key: 'features_checked', value: [...next] });
    setSaved(error ? 'לא נשמר. בדוק חיבור.' : '✓ נשמר');
  }

  if (!me) return <p className="muted">טוען…</p>;
  if (!isAdmin) return <p className="muted">העמוד הזה רק למנהל.</p>;
  return (
    <div className="stack-lg narrow">
      <div>
        <h1>הפיצ׳רים של הטיול</h1>
        <p className="muted">כל פיצ׳ר, מה הוא עושה ואיך משתמשים בו. מסמנים ✓ אחרי שהסברת לבנות.</p>
      </div>
      <div className="feat-bar">
        <div className="row-between">
          <b className="feat-count tnum">{checked.size}/{total} <span className="small muted">הוסברו</span></b>
          <div className="seg"><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>הכול</button><button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>מה שנשאר</button></div>
        </div>
        <div className="bar"><i style={{ width: (checked.size / total) * 100 + '%' }} /></div>
        <span className="small muted">{saved}</span>
      </div>
      {FEATURES.map((c) => {
        const items = c.items.filter((i) => filter === 'all' || !checked.has(i.id));
        if (!items.length) return null;
        const n = c.items.filter((i) => checked.has(i.id)).length;
        return (
          <section key={c.title} className="stack">
            <div className="row-between"><h2>{c.icon} {c.title}</h2><span className={'small tnum ' + (n === c.items.length ? 'ok' : 'muted')}>{n}/{c.items.length}</span></div>
            <ul className="feat-list">
              {items.map((it) => (
                <li key={it.id} className={'feat' + (checked.has(it.id) ? ' done' : '')}>
                  <label className="feat-head">
                    <input type="checkbox" checked={checked.has(it.id)} onChange={(e) => toggle(it.id, e.target.checked)} />
                    <span className="feat-main">
                      <b>{it.t}</b>
                      {it.where && <span className="feat-where">📍 {it.where}</span>}
                      <span>{it.what}</span>
                    </span>
                  </label>
                  {it.how.length > 0 && <ol className="feat-how">{it.how.map((h) => <li key={h}>{h}</li>)}</ol>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
