import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import { confetti } from '../lib/fx';
import type { PretripDone, PretripTask, TripEvent } from '../lib/types';
import { FIRST_FLIGHT } from '../config';
import { todayISO } from '../lib/util';
import Reminder from '../components/Reminder';

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
const daysTo = (d: string) => Math.round((new Date(d + 'T12:00:00').getTime() - new Date(todayISO() + 'T12:00:00').getTime()) / 864e5);

export function usePretrip() {
  const { me } = useAuth();
  const tasks = useTable<PretripTask>('pretrip_tasks', { order: 'due_date' });
  const done = useTable<PretripDone>('pretrip_done');
  const isDone = (t: string, u = me?.id) => done.rows.some((d) => d.task_id === t && d.user_id === u);
  const open = tasks.rows.filter((t) => !isDone(t.id));
  return { tasks, done, isDone, open };
}

export default function PreTrip() {
  const { me, travelers, colorOf, nameOf } = useAuth();
  const { tasks, done, isDone, open } = usePretrip();
  const events = useTable<TripEvent>('events', { order: 'starts_at' });
  const flight = (events.rows[0]?.starts_at || FIRST_FLIGHT);
  const daysLeft = Math.max(0, Math.ceil((new Date(flight).getTime() - Date.now()) / 864e5));
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  async function toggle(t: PretripTask, e: React.MouseEvent) {
    if (!me?.is_traveler) return;
    if (isDone(t.id)) {
      done.setRows((r) => r.filter((d) => !(d.task_id === t.id && d.user_id === me.id)));
      await dbWrite({ table: 'pretrip_done', kind: 'delete', match: { task_id: t.id, user_id: me.id } });
    } else {
      done.setRows((r) => [...r, { task_id: t.id, user_id: me.id }]);
      await dbWrite({ table: 'pretrip_done', kind: 'upsert', values: { task_id: t.id, user_id: me.id }, onConflict: 'task_id,user_id' });
      if (open.length === 1) confetti(e.clientX, e.clientY, 200, ['✈️', '✨', '💖', '🎒']);
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !due) return;
    await dbWrite({ table: 'pretrip_tasks', kind: 'insert', values: { id: newId(), title: title.trim(), due_date: due, note: null, created_by: me?.id, created_at: new Date().toISOString() } });
    setTitle(''); setDue(''); tasks.reload();
  }
  async function remove(id: string) { await dbWrite({ table: 'pretrip_tasks', kind: 'delete', match: { id } }); tasks.reload(); }

  const total = tasks.rows.length;
  const mine = total - open.length;
  return (
    <div className="stack-lg narrow">
      <div>
        <h1>לפני הטיסה</h1>
        <p className="muted">כל מה שצריך לסגור לפני שעולות על המטוס. כל אחת מסמנת לעצמה.</p>
      </div>
      <section className="card pretrip-head">
        <div className="pt-days"><b className="tnum">{daysLeft}</b><span>ימים לטיסה ✈️</span></div>
        {me?.is_traveler && <div className="pt-me"><span className="small muted">סגרת</span><b className="tnum">{mine}/{total}</b><div className="bar"><i style={{ width: total ? (mine / total) * 100 + '%' : 0 }} /></div></div>}
        <div className="pt-all">
          {travelers.map((t) => {
            const n = tasks.rows.filter((x) => isDone(x.id, t.id)).length;
            return <span key={t.id} className="small" style={{ ['--c' as any]: t.color }}><i className="dot" /> {t.display_name.split(' ')[0]} {n}/{total}</span>;
          })}
        </div>
      </section>
      {me?.is_traveler && open.length === 0 && total > 0 && <p className="ok pt-done">✨ הכול סגור! אפשר רק לחכות לטיסה</p>}
      <ul className="pt-list">
        {tasks.rows.map((t) => {
          const d = isDone(t.id), left = daysTo(t.due_date);
          const status = d ? 'done' : left < 0 ? 'late' : left <= 3 ? 'soon' : '';
          return (
            <li key={t.id} className={'card pt-item ' + status}>
              <label className="check">
                <input type="checkbox" checked={d} onChange={() => {}} onClick={(e) => toggle(t, e)} disabled={!me?.is_traveler} />
                <span className="grow">
                  <b>{t.title}</b>
                  {t.note && <span className="small muted pt-note">{t.note}</span>}
                </span>
              </label>
              <div className="pt-side">
                <span className={'pt-due small ' + status}>{d ? '✓ סגור' : left < 0 ? `⚠️ איחור ${-left} ימים` : left === 0 ? '⏰ היום!' : `עד ${fmt(t.due_date)}`}</span>
                <span className="dots">{travelers.map((x) => <i key={x.id} title={nameOf(x.id)} className={'dot' + (isDone(t.id, x.id) ? '' : ' off')} style={{ ['--c' as any]: colorOf(x.id) }} />)}</span>
                {t.created_by && t.created_by === me?.id && <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(t.id)}>×</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <form className="card form-row" onSubmit={add}>
        <input id="pt-title" className="grow" placeholder="משימה נוספת" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input id="pt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="עד מתי" />
        <button className="btn btn-primary" disabled={!title.trim() || !due}>הוספה</button>
      </form>
      <Reminder />
      <p className="muted small">עם התראות מופעלות: כל בוקר ב-10:00 תגיע תזכורת על משימות שהדדליין שלהן עבר או מתקרב.</p>
    </div>
  );
}

/** באנר בדף הבית: כמה משימות פתוחות לפני הטיסה */
export function PretripBanner() {
  const { me } = useAuth();
  const { open, tasks } = usePretrip();
  if (!me?.is_traveler || !tasks.rows.length || !open.length) return null;
  const late = open.filter((t) => daysTo(t.due_date) < 0).length;
  return (
    <a href="#/pretrip" className={'card pt-banner' + (late ? ' late' : '')}>
      <span className="pt-b-icon">✈️</span>
      <span className="grow"><b>{open.length} משימות פתוחות לפני הטיסה</b><span className="small">{late ? `⚠️ ${late} באיחור · ` : ''}הבאה: {open[0].title}</span></span>
      <span aria-hidden="true">←</span>
    </a>
  );
}
