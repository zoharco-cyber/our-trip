import 'leaflet/dist/leaflet.css';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { LocationUpdate, Photo, Place, Story } from '../lib/types';
import { fmtDateTime } from '../lib/util';
import { placeName } from '../lib/geo';
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

const hereIcon = L.divIcon({ className: 'pin-wrap', html: '<span class="here-pin"><i></i>💖</span>', iconSize: [44, 44], iconAnchor: [22, 22] });

/** מזיז את המפה למקום שנבחר בחיפוש */
function FlyTo({ target }: { target: { lat: number; lng: number; zoom: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 }); }, [target?.n]);
  return null;
}

type Hit = { kind: 'place' | 'world'; name: string; sub?: string; lat: number; lng: number; id?: string };

/** חיפוש מקום: קודם בנקודות שלנו, ואז בעולם (OpenStreetMap) */
function MapSearch({ places, onPick }: { places: Place[]; onPick: (h: Hit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function search(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    setBusy(true); setMsg(null);
    const ours: Hit[] = places.filter((p) => p.name.includes(t)).slice(0, 3).map((p) => ({ kind: 'place', name: p.name, sub: 'נקודה שלנו במפה', lat: p.lat, lng: p.lng, id: p.id }));
    let world: Hit[] = [];
    if (navigator.onLine) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=he&q=${encodeURIComponent(t)}`);
        const j = await r.json();
        world = (j || []).map((x: any) => {
          const parts = String(x.display_name || '').split(',').map((y: string) => y.trim());
          return { kind: 'world', name: x.name || parts[0], sub: parts.slice(1, 3).join(', '), lat: Number(x.lat), lng: Number(x.lon) } as Hit;
        });
      } catch { /* ignore */ }
    }
    const all = [...ours, ...world];
    setHits(all); setBusy(false);
    if (!all.length) setMsg(navigator.onLine ? 'לא נמצא. נסי לכתוב באנגלית או בספרדית.' : 'בלי קליטה אפשר לחפש רק בנקודות שלנו.');
  }
  return (
    <div className="map-search">
      <form className="form-row" onSubmit={search}>
        <input id="map-q" className="grow" placeholder="🔍 חיפוש מקום: קוסקו, Machu Picchu, Salar de Uyuni…" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setHits([]); }} />
        <button className="btn btn-primary" disabled={busy || !q.trim()}>{busy ? 'מחפשת…' : 'חיפוש'}</button>
      </form>
      {msg && <p className="muted small">{msg}</p>}
      {hits.length > 0 && (
        <ul className="map-hits">
          {hits.map((h, i) => (
            <li key={i}><button className="link-like" onClick={() => { onPick(h); setHits([]); }}>
              <b>{h.kind === 'place' ? '📍' : '🌎'} {h.name}</b>{h.sub && <span className="muted small">{h.sub}</span>}
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const locs = useTable<LocationUpdate>('location_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const here = locs.rows[0];
  const [hereName, setHereName] = useState<string | null>(null);
  useEffect(() => {
    if (!here) return;
    if (here.name) { setHereName(here.name); return; }
    placeName(here.lat, here.lng).then(setHereName);
  }, [here?.id]);
  const [locMode, setLocMode] = useState<null | 'menu' | 'pick'>(null);
  const [locName, setLocName] = useState('');
  const [locErr, setLocErr] = useState<string | null>(null);

  async function saveHere(lat: number, lng: number) {
    const name = locName.trim() || (await placeName(lat, lng));
    await supabase.from('location_updates').insert({ lat, lng, name });
    setLocMode(null); setLocName(''); locs.reload();
  }
  function useGps() {
    setLocErr(null);
    if (!navigator.geolocation) { setLocErr('המכשיר לא תומך במיקום. אפשר לבחור על המפה.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => saveHere(p.coords.latitude, p.coords.longitude),
      () => setLocErr('לא הצלחתי לקבל מיקום. צריך לאשר גישה למיקום, או לבחור על המפה.'),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  }
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom: number; n: number } | null>(null);
  const [found, setFound] = useState<Hit | null>(null);
  function pickHit(h: Hit) {
    setFly({ lat: h.lat, lng: h.lng, zoom: h.kind === 'place' ? 10 : 11, n: Date.now() });
    if (h.kind === 'place' && h.id) { setSelected(h.id); setFound(null); } else setFound(h);
  }
  const route = [...places.rows].filter((p) => p.visited_on).sort((a, b) => a.visited_on!.localeCompare(b.visited_on!) || a.created_at.localeCompare(b.created_at));

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
          <p className="muted small">{places.rows.length} נקודות{route.length > 1 ? ' · הקו המנוקד הוא המסלול לפי התאריכים' : ''} · לוחצים על נקודה לתמונות וסיפורים</p>
        </div>
        {!guest && (
          <div className="row gap wrap">
            <button className="btn" onClick={() => setLocMode(locMode ? null : 'menu')}>{locMode ? 'ביטול' : '📍 אנחנו כאן'}</button>
            <button className={'btn' + (adding ? '' : ' btn-primary')} onClick={() => { setAdding((v) => !v); setDraft(null); }}>
              {adding ? 'ביטול' : 'הוספת נקודה'}
            </button>
          </div>
        )}
      </div>
      <MapSearch places={places.rows} onPick={pickHit} />
      {found && (
        <div className="card found-card">
          <span>🌎 <b>{found.name}</b>{found.sub && <span className="muted small"> · {found.sub}</span>}</span>
          <div className="row gap wrap">
            {!guest && <button className="btn btn-primary btn-small" onClick={() => { setDraft({ lat: found.lat, lng: found.lng }); setName(found.name); setFound(null); setAdding(true); }}>הוספת נקודה כאן</button>}
            <button className="btn btn-small" onClick={() => setFound(null)}>סגירה</button>
          </div>
        </div>
      )}
      {here && (
        <p className="here-line">💖 עכשיו: <b>{hereName || 'מיקום עודכן'}</b> <span className="muted small">· {fmtDateTime(here.created_at)}</span></p>
      )}
      {locMode && (
        <div className="card stack">
          <b>עדכון "איפה אנחנו עכשיו"</b>
          <p className="muted small">גם אורחים יראו את המיקום הזה. הוא מתעדכן רק כשלוחצים כאן.</p>
          <input id="loc-name" placeholder="איפה? למשל: קוסקו (לא חובה)" value={locName} onChange={(e) => setLocName(e.target.value)} />
          <div className="row gap wrap">
            <button className="btn btn-primary" onClick={useGps}>לפי המיקום של הטלפון</button>
            <button className="btn" onClick={() => setLocMode('pick')}>בחירה על המפה</button>
          </div>
          {locMode === 'pick' && <p className="hint">לחצי על המפה במקום שבו אתן</p>}
          {locErr && <p className="error">{locErr}</p>}
        </div>
      )}
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
            <FlyTo target={fly} />
            {found && <Marker position={[found.lat, found.lng]} icon={pin('#1f7fb8', true)} />}
            {adding && <ClickCatcher onPick={(lat, lng) => setDraft({ lat, lng })} />}
            {locMode === 'pick' && <ClickCatcher onPick={(lat, lng) => saveHere(lat, lng)} />}
            {route.length > 1 && <>
              <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#ffffff', weight: 7, opacity: .9 }} />
              <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#e0157f', weight: 3.5, dashArray: '2 9', lineCap: 'round' }} />
            </>}
            {here && <Marker position={[here.lat, here.lng]} icon={hereIcon} zIndexOffset={1000}><Tooltip direction="top" offset={[0, -18]} permanent>אנחנו כאן</Tooltip></Marker>}
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
