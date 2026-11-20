import { FormEvent, useState } from 'react';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';
import { fmtDateTime } from '../lib/util';
import { Empty } from '../components/Avatar';

export const BOOKING_KINDS: Record<string, string> = { 'טיסה': '✈️', 'אוטובוס': '🚌', 'לינה': '🛏️', 'סיור': '🧭', 'אחר': '📌' };

export default function Bookings() {
  const { rows, reload } = useTable<Booking>('bookings', { order: 'starts_at' });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('טיסה');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [until, setUntil] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [showPast, setShowPast] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) return;
    await supabase.from('bookings').insert({ kind, title: title.trim(), starts_at: new Date(when).toISOString(), ends_at: until ? new Date(until).toISOString() : null, ref_code: ref.trim() || null, notes: notes.trim() || null });
    setTitle(''); setWhen(''); setUntil(''); setRef(''); setNotes(''); setOpen(false); reload();
  }
  async function remove(id: string) { await supabase.from('bookings').delete().eq('id', id); reload(); }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); } catch { /* ignore */ } }

  const now = Date.now();
  const upcoming = rows.filter((b) => new Date(b.ends_at || b.starts_at).getTime() >= now);
  const past = rows.filter((b) => new Date(b.ends_at || b.starts_at).getTime() < now);

  const Card = (b: Booking) => (
    <li key={b.id} className="card booking">
      <span className="b-icon">{BOOKING_KINDS[b.kind] || '📌'}</span>
      <div className="grow stack" style={{ gap: '.2rem' }}>
        <b>{b.title}</b>
        <span className="small">{fmtDateTime(b.starts_at)}{b.ends_at && <> עד {fmtDateTime(b.ends_at)}</>}</span>
        {b.ref_code && <button className="ref" onClick={() => copy(b.ref_code!)} title="העתקה">מספר הזמנה: <b dir="ltr">{b.ref_code}</b> ⧉</button>}
        {b.notes && <span className="muted small">{b.notes}</span>}
      </div>
      <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(b.id)}>×</button>
    </li>
  );

  return (
    <div className="stack-lg narrow">
      <div className="row-between">
        <div><h1>כרטיסים והזמנות</h1><p className="muted">טיסות, אוטובוסים, לינות וסיורים. זמין גם בלי אינטרנט.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? 'סגירה' : 'הזמנה חדשה'}</button>
      </div>
      {open && (
        <form className="card stack" onSubmit={add}>
          <div className="chips">{Object.keys(BOOKING_KINDS).map((k) => <button type="button" key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{BOOKING_KINDS[k]} {k}</button>)}</div>
          <div className="form-grid">
            <label className="field"><span>מה?</span><input id="bk-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: לימה ← קוסקו, LATAM" /></label>
            <label className="field"><span>מתי</span><input id="bk-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            <label className="field"><span>עד (לא חובה)</span><input id="bk-until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
            <label className="field"><span>מספר הזמנה</span><input id="bk-ref" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
          </div>
          <label className="field"><span>הערות</span><input id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="טרמינל, כתובת, צ׳ק אין…" /></label>
          <button className="btn btn-primary" disabled={!title.trim() || !when}>שמירה</button>
        </form>
      )}
      {upcoming.length === 0 ? <Empty title="אין הזמנות קרובות">הוסיפי טיסה, אוטובוס או הוסטל.</Empty> : <ul className="bookings">{upcoming.map(Card)}</ul>}
      {past.length > 0 && <button className="link-btn muted" onClick={() => setShowPast((v) => !v)}>{showPast ? 'הסתרת' : 'הצגת'} הזמנות שעברו ({past.length})</button>}
      {showPast && <ul className="bookings past">{past.map(Card)}</ul>}
    </div>
  );
}

/** ההזמנה הבאה, לדף הבית */
export function NextBooking() {
  const { rows } = useTable<Booking>('bookings', { order: 'starts_at' });
  const next = rows.find((b) => new Date(b.starts_at).getTime() >= Date.now());
  if (!next) return null;
  return (
    <a href="#/bookings" className="card next-booking">
      <span className="b-icon">{BOOKING_KINDS[next.kind] || '📌'}</span>
      <div className="grow"><span className="muted small">הדבר הבא</span><b>{next.title}</b><span className="small">{fmtDateTime(next.starts_at)}{next.ref_code && <> · {next.ref_code}</>}</span></div>
    </a>
  );
}
