import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import type { Med } from '../lib/types';
import Reminder from '../components/Reminder';
import { Empty } from '../components/Avatar';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
const PRESET_TIMES = ['07:00', '08:00', '09:00', '12:00', '14:00', '18:00', '20:00', '21:00', '22:00'];

export default function Meds() {
  const { me } = useAuth();
  // מסד הנתונים מחזיר רק את התרופות של מי שמחוברת. אף אחת אחרת לא רואה, גם לא המנהל
  const meds = useTable<Med>('meds', { order: 'created_at', filter: (q) => q.eq('user_id', me?.id || '') }, [me?.id]);
  const [name, setName] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [custom, setCustom] = useState('');

  function toggleTime(t: string) {
    setTimes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t].sort()));
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!me || !name.trim() || !times.length) return;
    await dbWrite({ table: 'meds', kind: 'insert', values: { id: newId(), user_id: me.id, name: name.trim(), times, tz: tz(), active: true, created_at: new Date().toISOString() } });
    setName(''); setTimes(['08:00']); meds.reload();
  }
  async function toggleActive(m: Med) {
    await dbWrite({ table: 'meds', kind: 'update', values: { active: !m.active, tz: tz() }, match: { id: m.id } }); meds.reload();
  }
  async function remove(id: string) {
    await dbWrite({ table: 'meds', kind: 'delete', match: { id } }); meds.reload();
  }

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>תזכורת לתרופות</h1>
        <p className="muted">🔒 פרטי לגמרי: רק את רואה את הרשימה הזו. גם הבנות וגם המנהל לא רואים אותה.</p>
      </div>
      <Reminder />
      <form className="card stack" onSubmit={add}>
        <b>תזכורת חדשה</b>
        <input id="med-name" placeholder="שם התרופה, למשל: מלרון" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="field"><span>באילו שעות?</span>
          <div className="chips">
            {[...new Set([...PRESET_TIMES, ...times])].sort().map((t) => (
              <button type="button" key={t} className={'chip' + (times.includes(t) ? ' on' : '')} onClick={() => toggleTime(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <input id="med-custom" type="time" step="900" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="שעה אחרת" />
          <button type="button" className="btn btn-small" disabled={!custom} onClick={() => { if (custom) { toggleTime(custom.slice(0, 5)); setCustom(''); } }}>הוספת שעה אחרת</button>
        </div>
        <p className="muted small">ההתראה מגיעה לפי השעון של הטלפון, ברבע השעה של השעה שבחרת.</p>
        <button className="btn btn-primary" disabled={!name.trim() || !times.length}>שמירה</button>
      </form>
      {meds.rows.length === 0 ? <Empty title="אין תזכורות">כאן יופיעו התרופות שלך.</Empty> : (
        <ul className="list">
          {meds.rows.map((m) => (
            <li key={m.id} className={'list-item' + (m.active ? '' : ' med-off')}>
              <span className="med-ico" aria-hidden="true">💊</span>
              <div className="grow">
                <b>{m.name}</b>
                <span className="small muted"> · {m.times.join(' · ')}</span>
              </div>
              <button className="btn btn-small" onClick={() => toggleActive(m)}>{m.active ? 'השהיה' : 'הפעלה'}</button>
              <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(m.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
