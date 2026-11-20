import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import type { Song } from '../lib/types';
import { fmtDate } from '../lib/util';
import { Who, Empty } from '../components/Avatar';

const searchLink = (s: Song) => `https://www.youtube.com/results?search_query=${encodeURIComponent([s.title, s.artist].filter(Boolean).join(' '))}`;
const isUrl = (u: string) => /^https?:\/\//i.test(u.trim());

export default function Songs() {
  const { me } = useAuth();
  const songs = useTable<Song>('songs', { order: 'created_at', ascending: false });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await dbWrite({ table: 'songs', kind: 'insert', values: {
      id: newId(), title: title.trim(), artist: artist.trim() || null, url: isUrl(url) ? url.trim() : null,
      note: note.trim() || null, created_by: me?.id, created_at: new Date().toISOString(),
    } });
    setTitle(''); setArtist(''); setUrl(''); setNote(''); setOpen(false); songs.reload();
  }
  async function remove(id: string) {
    await dbWrite({ table: 'songs', kind: 'delete', match: { id } }); songs.reload();
  }

  return (
    <div className="stack-lg narrow">
      <div className="row-between">
        <div>
          <h1>שירי הטיול</h1>
          <p className="muted">שיר שמזכיר לך רגע מהדרך. ביחד זה הפסקול של הטיול.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? 'סגירה' : '🎵 הוספת שיר'}</button>
      </div>
      {open && (
        <form className="card stack" onSubmit={add}>
          <div className="form-grid">
            <label className="field"><span>שם השיר</span><input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: Despacito" /></label>
            <label className="field"><span>מבצע/ת</span><input id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          </div>
          <label className="field"><span>קישור (ספוטיפיי / יוטיוב, לא חובה)</span><input id="song-url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
          <label className="field"><span>למה השיר הזה? (לא חובה)</span><input id="song-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="התנגן באוטובוס ללה פאס ושרנו בצעקות" /></label>
          <button className="btn btn-primary" disabled={!title.trim()}>הוספה לפלייליסט</button>
        </form>
      )}
      {songs.rows.length === 0 ? <Empty title="הפלייליסט ריק">השיר הראשון של הטיול מחכה.</Empty> : (
        <ol className="songs">
          {songs.rows.map((s, i) => (
            <li key={s.id} className={'card song' + ((s as any).__pending ? ' is-pending' : '')}>
              <span className="song-no tnum">{String(songs.rows.length - i).padStart(2, '0')}</span>
              <div className="grow">
                <b>{s.title}</b>{s.artist && <span className="muted"> · {s.artist}</span>}
                {s.note && <p className="small song-note">"{s.note}"</p>}
                <span className="small muted"><Who id={s.created_by} /> · {fmtDate(s.created_at)}</span>
              </div>
              <a className="btn btn-small" href={s.url || searchLink(s)} target="_blank" rel="noopener noreferrer">▶ האזנה</a>
              {s.created_by === me?.id && <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(s.id)}>×</button>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
