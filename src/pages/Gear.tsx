import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import { dbWrite } from '../lib/offline';
import type { GearCheck, GearItem } from '../lib/types';
import { GEAR_CATEGORIES } from '../config';
import { Empty } from '../components/Avatar';
import Bags from '../components/Bags';

function GearList() {
  const { me, travelers, colorOf, nameOf } = useAuth();
  const items = useTable<GearItem>('gear_items', { order: 'created_at' });
  const checks = useTable<GearCheck>('gear_checks');
  const [text, setText] = useState('');
  const [cat, setCat] = useState(GEAR_CATEGORIES[0]);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const has = (item: string, user: string) => checks.rows.some((c) => c.item_id === item && c.user_id === user);

  async function toggle(itemId: string) {
    if (!me) return;
    if (has(itemId, me.id)) {
      checks.setRows((r) => r.filter((c) => !(c.item_id === itemId && c.user_id === me.id)));
      await dbWrite({ table: 'gear_checks', kind: 'delete', match: { item_id: itemId, user_id: me.id } });
    } else {
      checks.setRows((r) => [...r, { item_id: itemId, user_id: me.id }]);
      await dbWrite({ table: 'gear_checks', kind: 'upsert', values: { item_id: itemId, user_id: me.id }, onConflict: 'item_id,user_id' });
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('gear_items').insert({ text: text.trim(), category: cat });
    setText(''); items.reload();
  }
  async function remove(id: string) {
    await supabase.from('gear_items').delete().eq('id', id); items.reload();
  }

  const total = items.rows.length;
  const cats = [...new Set([...GEAR_CATEGORIES, ...items.rows.map((i) => i.category)])];

  return (
    <div className="stack-lg">
      <div>
        <h1>רשימת ציוד</h1>
        <p className="muted">רשימה אחת לכולן, וכל אחת מסמנת מה כבר יש לה.</p>
      </div>
      <div className="grid-3">
        {travelers.map((t) => {
          const n = items.rows.filter((i) => has(i.id, t.id)).length;
          return (
            <div key={t.id} className="card progress-card" style={{ ['--c' as any]: t.color }}>
              <div className="row-between"><b>{t.display_name.split(' ')[0]}</b><span className="tnum">{n}/{total}</span></div>
              <div className="bar"><i style={{ width: total ? (n / total) * 100 + '%' : 0 }} /></div>
            </div>
          );
        })}
      </div>
      <form className="form-row" onSubmit={add}>
        <input id="gear-text" className="grow" placeholder="פריט חדש" value={text} onChange={(e) => setText(e.target.value)} />
        <select id="gear-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
          {GEAR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!text.trim()}>הוספה</button>
      </form>
      <label className="check"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /><span>להציג רק מה שעוד חסר לי</span></label>
      {total === 0 && <Empty title="הרשימה ריקה">הוסיפי את הפריט הראשון.</Empty>}
      {cats.map((c) => {
        const list = items.rows.filter((i) => i.category === c && (!onlyMissing || !me || !has(i.id, me.id)));
        if (!list.length) return null;
        return (
          <section key={c} className="stack">
            <h3>{c}</h3>
            <ul className="checklist">
              {list.map((i) => (
                <li key={i.id} className={me && has(i.id, me.id) ? 'done' : ''}>
                  <label className="check">
                    <input type="checkbox" checked={!!me && has(i.id, me.id)} onChange={() => toggle(i.id)} disabled={!me?.is_traveler} />
                    <span>{i.text}</span>
                  </label>
                  <span className="dots" aria-label="מי כבר סימנה">
                    {travelers.map((t) => (
                      <i key={t.id} title={nameOf(t.id)} className={'dot' + (has(i.id, t.id) ? '' : ' off')} style={{ ['--c' as any]: colorOf(t.id) }} />
                    ))}
                  </span>
                  <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(i.id)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function Gear() {
  const [tab, setTab] = useState<'list' | 'bags'>(() => { try { return (sessionStorage.getItem('trip:gearTab') as 'list' | 'bags') || 'list'; } catch { return 'list'; } });
  const pick = (t: 'list' | 'bags') => { setTab(t); try { sessionStorage.setItem('trip:gearTab', t); } catch { /* ignore */ } };
  return (
    <div className="stack-lg">
      <div className="seg gear-tabs" role="tablist">
        <button className={tab === 'list' ? 'on' : ''} onClick={() => pick('list')}>📋 רשימת ציוד</button>
        <button className={tab === 'bags' ? 'on' : ''} onClick={() => pick('bags')}>🎒 התיקים שלי</button>
      </div>
      {tab === 'list' ? <GearList /> : (
        <div className="stack-lg">
          <div>
            <h1>התיקים שלי</h1>
            <p className="muted">מה יש בכל תיק, ובדיקה מהירה לפני כל מעבר. רק את רואה את הרשימה שלך.</p>
          </div>
          <Bags />
        </div>
      )}
    </div>
  );
}
