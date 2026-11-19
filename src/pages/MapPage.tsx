import { FormEvent, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Photo, Place, Story } from '../lib/types';
import { fmtDate } from '../lib/util';
import PhotoGrid from '../components/PhotoGrid';
import PhotoUpload from '../components/PhotoUpload';
import { Who } from '../components/Avatar';

const pin = (color: string, active: boolean) =>
  L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin${active ? ' active' : ''}" style="--c:${color}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapPage() {
  const { guest, colorOf } = useAuth();
  const places = useTable<Place>('places', { order: 'created_at' });
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || !name.trim()) return;
    const { data } = await supabase.from('places').insert({ name: name.trim(), lat: draft.lat, lng: draft.lng, visited_on: date || null }).select().single();
    setDraft(null); setName(''); setDate(''); setAdding(false);
    await places.reload();
    if (data) setSelected(data.id);
  }

  const place = places.rows.find((p) => p.id === selected) || null;
  const icons = useMemo(() => new Map<string, L.DivIcon>(), []);
  const iconFor = (p: Place) => {
    const key = `${p.created_by}-${p.id === selected}`;
    if (!icons.has(key)) icons.set(key, pin(colorOf(p.created_by), p.id === selected));
    return icons.get(key)!;
  };

  return (
    <div className="map-page">
      <div className="row-between wrap map-head">
        <div>
          <h1>המפה שלנו</h1>
          <p className="muted small">{places.rows.length} נקודות · לוחצים על נקודה כדי לראות תמונות וסיפורים</p>
        </div>
        {!guest && (
          <button className={'btn' + (adding ? '' : ' btn-primary')} onClick={() => { setAdding((v) => !v); setDraft(null); }}>
            {adding ? 'ביטול' : 'הוספת נקודה'}
          </button>
        )}
      </div>
      {adding && !draft && <p className="hint">לחצי על המקום במפה</p>}
      {draft && (
        <form className="card form-row" onSubmit={save}>
          <input id="place-name" autoFocus className="grow" placeholder="שם המקום, למשל: קוסקו" value={name} onChange={(e) => setName(e.target.value)} />
          <input id="place-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="מתי היינו" />
          <button className="btn btn-primary" disabled={!name.trim()}>שמירה</button>
        </form>
      )}
      <div className="map-layout">
        <div className="map-box" dir="ltr">
          <MapContainer center={[-14, -64]} zoom={3} minZoom={2} worldCopyJump style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {adding && <ClickCatcher onPick={(lat, lng) => setDraft({ lat, lng })} />}
            {draft && <Marker position={[draft.lat, draft.lng]} icon={pin('#111', true)} />}
            {places.rows.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={iconFor(p)}
                eventHandlers={{ click: () => setSelected(p.id) }} title={p.name} />
            ))}
          </MapContainer>
        </div>
        {place ? <PlacePanel place={place} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); places.reload(); }} />
          : places.rows.length > 0 && (
            <aside className="place-list">
              <h3>כל הנקודות</h3>
              <ul>
                {[...places.rows].sort((a, b) => (a.visited_on || a.created_at).localeCompare(b.visited_on || b.created_at)).map((p) => (
                  <li key={p.id}><button className="link-like" onClick={() => setSelected(p.id)}>
                    <i className="dot" style={{ ['--c' as any]: colorOf(p.created_by) }} /> {p.name}
                    {p.visited_on && <span className="muted small"> · {fmtDate(p.visited_on)}</span>}
                  </button></li>
                ))}
              </ul>
            </aside>
          )}
      </div>
    </div>
  );
}

function PlacePanel({ place, onClose, onDeleted }: { place: Place; onClose: () => void; onDeleted: () => void }) {
  const { guest } = useAuth();
  const stories = useTable<Story>('stories', { order: 'created_at', filter: (q) => q.eq('place_id', place.id) }, [place.id]);
  const photos = useTable<Photo>('photos', { order: 'created_at', filter: (q) => q.eq('place_id', place.id) }, [place.id]);
  const [text, setText] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  async function addStory(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('stories').insert({ place_id: place.id, content: text.trim() });
    setText(''); stories.reload();
  }
  async function removeStory(id: string) {
    await supabase.from('stories').delete().eq('id', id); stories.reload();
  }
  async function removePlace() {
    await supabase.from('places').delete().eq('id', place.id); onDeleted();
  }

  return (
    <aside className="place-panel card">
      <div className="row-between">
        <div>
          <h2>{place.name}</h2>
          <p className="muted small">{place.visited_on ? fmtDate(place.visited_on) : 'בלי תאריך'}{!guest && <> · נוסף ע"י <Who id={place.created_by} /></>}</p>
        </div>
        <button className="icon-btn" aria-label="סגירה" onClick={onClose}>×</button>
      </div>

      {photos.rows.length > 0 && <PhotoGrid photos={photos.rows} onChange={photos.reload} />}
      {!guest && <PhotoUpload placeId={place.id} onDone={photos.reload} />}

      <h3>סיפורים</h3>
      {stories.rows.length === 0 && <p className="muted small">{guest ? 'עוד אין כאן סיפורים.' : 'מה קרה כאן? ספרי.'}</p>}
      <ul className="stories">
        {stories.rows.map((s) => (
          <li key={s.id}>
            <p>{s.content}</p>
            <footer className="small muted"><Who id={s.created_by} /> · {fmtDate(s.created_at)}
              {!guest && <button className="link-btn" onClick={() => removeStory(s.id)}>מחיקה</button>}
            </footer>
          </li>
        ))}
      </ul>
      {!guest && (
        <form className="stack" onSubmit={addStory}>
          <textarea id="story-text" rows={3} placeholder="סיפור מהמקום הזה" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" disabled={!text.trim()}>הוספת סיפור</button>
        </form>
      )}
      {!guest && (confirmDel
        ? <div className="row gap"><button className="btn btn-small danger" onClick={removePlace}>למחוק את הנקודה?</button><button className="btn btn-small" onClick={() => setConfirmDel(false)}>ביטול</button></div>
        : <button className="link-btn" onClick={() => setConfirmDel(true)}>מחיקת הנקודה</button>)}
    </aside>
  );
}
