import { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import { usePhotoUrls } from '../lib/photos';
import type { JournalEntry, Photo } from '../lib/types';
import { fmtDate, safeFileName, todayISO } from '../lib/util';
import { Who, Empty } from '../components/Avatar';

export const MOODS = ['🤩', '😍', '😂', '😌', '🥱', '🥶', '🤢', '😭', '😤', '🥳'];

export default function Journal() {
  const { me, travelers } = useAuth();
  const entries = useTable<JournalEntry>('journal_entries', { order: 'day', ascending: false });
  const [day, setDay] = useState(todayISO());
  const mine = entries.rows.find((e) => e.day === day && e.created_by === me?.id);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

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
    if (file) {
      const path = `journal/${me.id}/${day}-${Date.now()}-${safeFileName(file.name)}`;
      const up = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (!up.error) photo_path = path;
    }
    await supabase.from('journal_entries').upsert({ day, content: text.trim(), mood, photo_path, created_by: me.id }, { onConflict: 'day,created_by' });
    setBusy(false); setEditing(false); entries.reload();
  }

  const days = [...new Set(entries.rows.map((e) => e.day))];
  const canWrite = !!me?.is_traveler;

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>יומן מסע</h1>
        <p className="muted">משפט אחד ביום, מצב רוח, ואם בא לך: תמונת היום. בסוף הטיול יש יומן שלם.</p>
      </div>
      {canWrite && (
        <section className="card stack">
          <div className="row-between">
            <b>{day === todayISO() ? 'היום' : fmtDate(day)}</b>
            <input id="j-day" type="date" value={day} max={todayISO()} onChange={(e) => { setDay(e.target.value); setEditing(false); }} style={{ width: 'auto' }} />
          </div>
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
