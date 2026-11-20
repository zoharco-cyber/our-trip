import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { MapContainer, Polyline, TileLayer, CircleMarker } from 'react-leaflet';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { Money } from '../lib/money';
import { usePhotoUrls } from '../lib/photos';
import type { CapsuleEntry, Challenge, ChallengeDone, Expense, JournalEntry, Photo, Place, TripEvent, Wish } from '../lib/types';
import { fmtDate } from '../lib/util';
import { LOGO_URL, FIRST_FLIGHT } from '../config';
import { computeBalances } from './Money';
import { useCapsuleOpen } from './Capsule';
import { Who } from '../components/Avatar';

export default function Book() {
  const { travelers, colorOf } = useAuth();
  const events = useTable<TripEvent>('events', { order: 'starts_at' });
  const places = useTable<Place>('places', { order: 'visited_on' });
  const photos = useTable<Photo>('photos', { order: 'created_at' });
  const expenses = useTable<Expense>('expenses');
  const wishes = useTable<Wish>('wishes', { order: 'done_at' });
  const journal = useTable<JournalEntry>('journal_entries', { order: 'day' });
  const ch = useTable<Challenge>('challenges');
  const chDone = useTable<ChallengeDone>('challenge_done');
  const { open: capsuleOpen } = useCapsuleOpen();
  const letters = useTable<CapsuleEntry>('capsule_entries', { order: 'created_at' }, [capsuleOpen]);

  const start = new Date(events.rows[0]?.starts_at || FIRST_FLIGHT);
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 864e5) + 1);
  const route = places.rows.filter((p) => p.visited_on).sort((a, b) => a.visited_on!.localeCompare(b.visited_on!));
  const total = expenses.rows.reduce((s, e) => s + Number(e.amount_usd), 0);
  const ids = travelers.map((t) => t.id);
  const { share } = useMemo(() => computeBalances(ids, expenses.rows, []), [ids.join(), expenses.rows]);
  const fulfilled = wishes.rows.filter((w) => w.done);
  const score = (u: string) => chDone.rows.filter((d) => d.user_id === u).reduce((s, d) => s + (ch.rows.find((c) => c.id === d.challenge_id)?.points || 0), 0);
  const champ = [...travelers].sort((a, b) => score(b.id) - score(a.id))[0];
  const topCat = Object.entries(expenses.rows.reduce((m: Record<string, number>, e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount_usd); return m; }, {})).sort((a, b) => b[1] - a[1])[0];
  const moodCount = journal.rows.reduce((m: Record<string, number>, e) => { if (e.mood) m[e.mood] = (m[e.mood] || 0) + 1; return m; }, {});
  const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
  const picks = photos.rows.filter((_, i) => i % Math.max(1, Math.ceil(photos.rows.length / 12)) === 0).slice(0, 12);
  const urls = usePhotoUrls(picks);
  const bounds = route.length ? route.map((p) => [p.lat, p.lng] as [number, number]) : null;

  const stats = [
    { n: days, l: 'ימים בדרך' },
    { n: places.rows.length, l: 'מקומות במפה' },
    { n: photos.rows.length, l: 'תמונות' },
    { n: journal.rows.length, l: 'רשומות ביומן' },
    { n: fulfilled.length, l: 'חלומות שהוגשמו' },
    { n: chDone.rows.length, l: 'אתגרים שבוצעו' },
  ];

  return (
    <div className="book stack-lg">
      <header className="book-cover">
        <img src={LOGO_URL} alt="" className="book-logo" />
        <p className="eyebrow">{travelers.map((t) => t.display_name.split(' ')[0]).join(' · ')}</p>
        <h1 className="book-title">ספר הטיול</h1>
        <p>{fmtDate(start)} {days > 0 ? `· ${days} ימים` : '· עוד לא יצאנו'}</p>
      </header>

      <section className="book-stats">
        {stats.map((s) => <div key={s.l} className="book-stat"><b className="tnum">{s.n}</b><span>{s.l}</span></div>)}
      </section>

      <section className="stack">
        <h2>המסלול</h2>
        {bounds && bounds.length > 0 ? (
          <div className="book-map" dir="ltr">
            <MapContainer bounds={bounds.length > 1 ? bounds : undefined} center={bounds.length === 1 ? bounds[0] : undefined} zoom={bounds.length === 1 ? 6 : undefined}
              boundsOptions={{ padding: [30, 30] }} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <Polyline positions={bounds} pathOptions={{ color: '#e0157f', weight: 3.5, dashArray: '2 9', lineCap: 'round' }} />
              {route.map((p) => <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: colorOf(p.created_by), fillOpacity: 1 }} />)}
            </MapContainer>
          </div>
        ) : <p className="muted">כשתוסיפו נקודות עם תאריך במפה, המסלול יופיע כאן.</p>}
        {route.length > 0 && <p className="book-route">{route.map((p) => p.name).join('  ←  ')}</p>}
      </section>

      {picks.length > 0 && (
        <section className="stack">
          <h2>רגעים</h2>
          <div className="book-photos">{picks.map((p) => urls[p.path] && <img key={p.id} src={urls[p.path]} alt={p.caption || ''} loading="lazy" />)}</div>
        </section>
      )}

      <section className="grid-2">
        <div className="card stack">
          <h2>הכסף</h2>
          <p>סך הכול הוצאנו <Money usd={total} /></p>
          {topCat && <p className="muted small">הכי הרבה הלך על {topCat[0]}</p>}
          <ul className="list">{travelers.map((t) => <li key={t.id} className="list-item"><Who id={t.id} /><span className="grow" /><Money usd={share[t.id] || 0} /></li>)}</ul>
        </div>
        <div className="card stack">
          <h2>האתגרים של זוהר</h2>
          {champ && score(champ.id) > 0 ? <p>👑 אלופת האתגרים: <Who id={champ.id} /> עם {score(champ.id)} נקודות</p> : <p className="muted">עוד לא בוצעו אתגרים.</p>}
          <h2>היומן</h2>
          {topMood ? <p>מצב הרוח הכי נפוץ: <span className="mood big">{topMood[0]}</span> ({topMood[1]} פעמים)</p> : <p className="muted">היומן עוד ריק.</p>}
        </div>
      </section>

      {fulfilled.length > 0 && (
        <section className="stack">
          <h2>חלומות שהגשמנו</h2>
          <ul className="book-wishes">{fulfilled.map((w) => <li key={w.id}>🌟 {w.text}{w.place && <span className="muted"> · {w.place}</span>}</li>)}</ul>
        </section>
      )}

      <section className="stack">
        <h2>קפסולת הזמן</h2>
        {capsuleOpen ? (
          <ul className="letters">{letters.rows.map((e) => <li key={e.id} className="letter"><p>{e.content}</p><footer><Who id={e.created_by} /> · {fmtDate(e.created_at)}</footer></li>)}</ul>
        ) : <p className="muted">הקפסולה עוד נעולה. כשהמנהל יפתח אותה, המכתבים יופיעו כאן.</p>}
      </section>
    </div>
  );
}
