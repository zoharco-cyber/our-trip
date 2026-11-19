import { useEffect, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { TripEvent } from '../lib/types';
import { FIRST_FLIGHT } from '../config';
import { fmtDateTime } from '../lib/util';

/** ספירה לאחור לאירוע הקרוב, או מונה ימים מאז היציאה */
export default function Countdown({ compact }: { compact?: boolean }) {
  const { rows } = useTable<TripEvent>('events', { order: 'starts_at' });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const events = rows.length ? rows : [{ id: 'x', title: 'טיסה ראשונה', starts_at: FIRST_FLIGHT, created_by: null }];
  const first = events[0];
  const next = events.find((e) => new Date(e.starts_at).getTime() > now);

  if (!next) {
    const day = Math.floor((now - new Date(first.starts_at).getTime()) / 864e5) + 1;
    return (
      <div className={'countdown' + (compact ? ' compact' : '')}>
        <p className="cd-label">אנחנו בטיול</p>
        <div className="cd-units"><Unit n={day} l="יום" /></div>
      </div>
    );
  }
  let ms = new Date(next.starts_at).getTime() - now;
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.floor(ms / 6e4); ms -= m * 6e4;
  const s = Math.floor(ms / 1e3);
  return (
    <div className={'countdown' + (compact ? ' compact' : '')}>
      <p className="cd-label">עד {next.title} <span className="muted">· {fmtDateTime(next.starts_at)}</span></p>
      <div className="cd-units">
        <Unit n={d} l="ימים" /><Unit n={h} l="שעות" /><Unit n={m} l="דקות" />{!compact && <Unit n={s} l="שניות" />}
      </div>
    </div>
  );
}
function Unit({ n, l }: { n: number; l: string }) {
  return <div className="cd-unit"><b>{n}</b><span>{l}</span></div>;
}
