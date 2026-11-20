import { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import { dbWrite, newId } from '../lib/offline';
import { usePhotoUrls } from '../lib/photos';
import type { JournalEntry, Photo, TripEvent } from '../lib/types';
import { FIRST_FLIGHT } from '../config';
import { addDays, fmtDate, safeFileName, todayISO } from '../lib/util';
import { Who, Empty } from '../components/Avatar';
import Reminder from '../components/Reminder';

export const MOODS = ['🤩', '😍', '😂', '😌', '🥱', '🥶', '🤢', '😭', '😤', '🥳'];

// רשומות לדוגמה, רק לתצוגה של המנהל (לא נשמרות)
const DEMO: { content: string; mood: string }[][] = [
  [{ content: 'נחתנו בלימה! עייפות אבל מאושרות, וכבר אכלנו סביצ׳ה', mood: '🤩' }, { content: 'המזוודה שלי הגיעה אחרונה. כמעט בכיתי', mood: '😅' }, { content: 'האוקיינוס פה ענק, ישבנו על הצוק עד השקיעה', mood: '😍' }, { content: 'גיליתי שאני מכורה לאינקה קולה', mood: '🥳' }],
  [{ content: 'הגענו לקוסקו. אין אוויר אבל יש קסם', mood: '🥶' }, { content: 'תה קוקה ונרדמתי בשמונה בערב', mood: '🥱' }, { content: 'מצאנו שוק מטורף וקניתי סוודר עם לאמות', mood: '😂' }, { content: 'כאב לי הראש מהגובה, אבל הנוף שווה הכול', mood: '😌' }],
  [{ content: 'מאצ׳ו פיצ׳ו!!! אין מילים', mood: '😭' }, { content: 'קמנו בארבע בבוקר וזה היה שווה כל שנייה', mood: '🤩' }, { content: 'לאמה ליקקה לי את התיק. אתגר הושלם', mood: '🥳' }, { content: 'צילמתי 400 תמונות. אחת מהן טובה', mood: '😂' }],
];

export default function Journal() {
  const { me, travelers, isAdmin } = useAuth();
  const real = useTable<JournalEntry>('journal_entries', { order: 'day', ascending: false });
  const events = useTable<TripEvent>('events', { order: 'starts_at' });
  const tripStart = new Date(events.rows[0]?.starts_at || FIRST_FLIGHT).toLocaleDateString('en-CA');
  const started = todayISO() >= tripStart;
  const daysLeft = Math.ceil((new Date(tripStart + 'T00:00:00').getTime() - Date.now()) / 864e5);
  const [demo, setDemo] = useState(false);
  const demoRows: JournalEntry[] = DEMO.flatMap((day, d) => travelers.slice(0, 4).map((t, i) => ({
    id: `demo-${d}-${i}`, day: addDays(tripStart, d), content: day[i]?.content || '', mood: day[i]?.mood || null, photo_path: null, created_by: t.id, created_at: '',
  }))).reverse();
  const entries = demo ? { ...real, rows: demoRows } : real;
  const [day, setDay] = useState(todayISO());
  const mine = entries.rows.find((e) => e.day === day && e.created_by === me?.id);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const photoRows = entries.rows.filter((e) => e.photo_path).map((e) => ({ path: e.photo_path! } as Photo));
  const urls = usePhotoUrls(photoRows);

  function startEdit() {
    setText(mine?.content || ''); setMood(mine?.mood || null); setFile(null); setEditing(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!me || !text.trim()) return;
    setBusy(true);
    let photo_path = mine?.photo_path || null;
    let photoSkipped = false;
    if (file && !navigator.onLine) photoSkipped = true;
    else if (file) {
      const path = `journal/${me.id}/${day}-${Date.now()}-${safeFileName(file.name)}`;
      const up = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (!up.error) photo_path = path;
    }
    const r = await dbWrite({ table: 'journal_entries', kind: 'upsert', values: { day, content: text.trim(), mood, photo_path, created_by: me.id }, onConflict: 'day,created_by' });
    setBusy(false); setEditing(false); entries.reload();
    if (r === 'queued') setNote(photoSkipped ? 'נשמר בטלפון ויישלח כשתחזור קליטה. את התמונה צריך להוסיף שוב כשיש חיבור.' : 'נשמר בטלפון ויישלח כשתחזור קליטה.');
    else setNote(null);
  }

  const days = [...new Set(entries.rows.map((e) => e.day))];
  const canWrite = !!me?.is_traveler && started && !demo;

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>יומן מסע</h1>
        <p className="muted">משפט אחד ביום, מצב רוח, ואם בא לך: תמונת היום. בסוף הטיול יש יומן שלם.</p>
      </div>
      {!started && (
        <div className="card journal-locked">
          <b>📔 היומן נפתח ביום הראשון של הטיול</b>
          <p>{fmtDate(tripStart)}{daysLeft > 0 && <> · עוד {daysLeft} ימים</>}</p>
        </div>
      )}
      {isAdmin && (
        <div className="row gap wrap">
          <button className={'btn btn-small' + (demo ? ' btn-primary' : '')} onClick={() => setDemo((v) => !v)}>{demo ? 'חזרה ליומן האמיתי' : '👀 איך זה ייראה כשהבנות ימלאו'}</button>
          {demo && <span className="muted small">תצוגה לדוגמה. רק אתה רואה אותה, ושום דבר לא נשמר.</span>}
        </div>
      )}
      <Reminder />
      {canWrite && (
        <section className="card stack">
          <div className="row-between">
            <b>{day === todayISO() ? 'היום' : fmtDate(day)}</b>
            <input id="j-day" type="date" value={day} min={tripStart} max={todayISO()} onChange={(e) => { setDay(e.target.value); setEditing(false); }} style={{ width: 'auto' }} />
          </div>
          {note && <p className="small ok">{note}</p>}
          {mine && !editing ? (
            <div className="stack">
              <p className="journal-text"><span className="mood">{mine.mood}</span> {mine.content}</p>
              <button className="btn btn-small" onClick={startEdit}>עריכה</button>
            </div>
          ) : (!mine && !editing) ? (
            <button className="btn btn-primary" onClick={startEdit}>כתיבה ליומן</button>
          ) : (
            <form className="stack" onSubmit={save}>
              <div className="moods" role="group" aria-label="מצב רוח">
                {MOODS.map((m) => <button type="button" key={m} className={'mood-btn' + (mood === m ? ' on' : '')} onClick={() => setMood(m)}>{m}</button>)}
              </div>
              <textarea id="j-text" rows={2} placeholder="מה היה היום במשפט אחד?" value={text} onChange={(e) => setText(e.target.value)} />
              <label className="btn upload-btn">{file ? 'תמונה נבחרה ✓' : 'תמונת היום (לא חובה)'}<input type="file" accept="image/*" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)} /></label>
              <button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? 'שומרת…' : 'שמירה'}</button>
            </form>
          )}
        </section>
      )}
      {days.length === 0 ? <Empty title="היומן ריק">היום הראשון מחכה.</Empty> : (
        <ol className="journal">
          {days.map((d) => (
            <li key={d} className="journal-day">
              <h3>{fmtDate(d)}</h3>
              <div className="stack">
                {travelers.map((t) => {
                  const e = entries.rows.find((x) => x.day === d && x.created_by === t.id);
                  if (!e) return null;
                  return (
                    <div key={t.id} className="journal-entry" style={{ ['--c' as any]: t.color }}>
                      <div className="row gap"><span className="mood big">{e.mood || '•'}</span><Who id={t.id} /></div>
                      <p>{e.content}</p>
                      {e.photo_path && urls[e.photo_path] && <img className="journal-photo" src={urls[e.photo_path]} alt={`תמונת היום של ${t.display_name}`} loading="lazy" />}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
