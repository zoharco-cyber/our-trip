import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import { placeName } from '../lib/geo';
import { usePhotoUrls } from '../lib/photos';
import type { JournalEntry, LocationUpdate, Photo, StatusUpdate } from '../lib/types';
import { fmtDate } from '../lib/util';

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 2) return 'עכשיו';
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}
const KIND_ICON: Record<string, string> = { 'טיסה': '✈️', 'אוטובוס': '🚌', 'לינה': '🛏️', 'סיור': '🧭', 'אחר': '📌' };

/** "מה שלום הבנות?": כל מה שהורה רוצה לדעת, בשנייה */
export default function ParentsCard() {
  const { nameOf } = useAuth();
  const status = useTable<StatusUpdate>('status_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const locs = useTable<LocationUpdate>('location_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const s = status.rows[0], here = locs.rows[0];
  const [where, setWhere] = useState<string | null>(null);
  const [wx, setWx] = useState<{ temp: number; elev: number } | null>(null);
  const [moves, setMoves] = useState<{ kind: string; title: string; starts_at: string }[]>([]);

  useEffect(() => {
    if (!here) return;
    if (here.name) setWhere(here.name); else placeName(here.lat, here.lng).then(setWhere);
    const key = `pc:${here.lat.toFixed(2)},${here.lng.toFixed(2)}`;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < 30 * 6e4) { setWx(c.v); return; } } catch { /* ignore */ }
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${here.lat}&longitude=${here.lng}&current=temperature_2m&timezone=auto`)
      .then((r) => r.json()).then((j) => {
        const v = { temp: Math.round(j?.current?.temperature_2m), elev: Math.round(j?.elevation) };
        if (isFinite(v.temp)) { setWx(v); try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* ignore */ } }
      }).catch(() => {});
  }, [here?.id]);
  useEffect(() => { supabase.rpc('next_moves').then(({ data }) => setMoves((data as any) || [])); }, []);

  const last = [s?.created_at, here?.created_at].filter(Boolean).sort().pop() as string | undefined;
  if (!s && !here && !moves.length) return null;
  const next = moves.find((m) => new Date(m.starts_at).getTime() > Date.now()) || moves[0];
  return (
    <section className="parents-card">
      <h2 className="pc-title">מה שלום הבנות?</h2>
      {s && <p className="pc-msg">{s.message} <span className="pc-by">· {nameOf(s.created_by)}</span></p>}
      <div className="pc-facts">
        {last && <span>🕐 עדכון אחרון {ago(last)}</span>}
        {where && <span>📍 {where.split(',')[0]}</span>}
        {wx && wx.elev > 50 && <span>⛰️ {wx.elev.toLocaleString('he-IL')} מ׳</span>}
        {wx && <span>🌡️ {wx.temp}°</span>}
      </div>
      {next && (
        <p className="pc-next">{KIND_ICON[next.kind] || '📌'} <b>הבא:</b> {next.title} · {new Date(next.starts_at).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      )}
    </section>
  );
}

/** קטעי יומן שהבנות בחרו לשתף עם הבית */
export function SharedJournal() {
  const { nameOf, colorOf } = useAuth();
  const rows = useTable<JournalEntry>('journal_entries', { order: 'day', ascending: false, filter: (q) => q.eq('shared', true).limit(6) });
  const urls = usePhotoUrls(rows.rows.filter((r) => r.photo_path).map((r) => ({ path: r.photo_path! } as Photo)));
  if (!rows.rows.length) return null;
  return (
    <section className="stack">
      <h2>מהיומן של הבנות</h2>
      <ul className="shared-journal">
        {rows.rows.map((e) => (
          <li key={e.id} className="sj-item" style={{ ['--c' as any]: colorOf(e.created_by) }}>
            {e.photo_path && urls[e.photo_path] && <img src={urls[e.photo_path]} alt="" loading="lazy" />}
            <div>
              <span className="small muted">{fmtDate(e.day)} · {nameOf(e.created_by)} {e.mood}</span>
              <p>{e.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
