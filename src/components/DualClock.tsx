import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import type { LocationUpdate } from '../lib/types';

const IL = 'Asia/Jerusalem';
const fmt = (tz: string) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const hourIn = (tz: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const icon = (h: number) => (h >= 23 || h < 6 ? '😴' : h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌙');

/** אזור הזמן של המקום האחרון שעודכן (מ-Open-Meteo), נשמר בטלפון */
function useTripTz(lat?: number, lng?: number) {
  const key = lat !== undefined && lng !== undefined ? `tz:${lat.toFixed(1)},${lng.toFixed(1)}` : '';
  const [tz, setTz] = useState<string | null>(() => { try { return key ? localStorage.getItem(key) : null; } catch { return null; } });
  useEffect(() => {
    if (!key || tz) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&current=temperature_2m`)
      .then((r) => r.json()).then((j) => { if (j?.timezone) { setTz(j.timezone); try { localStorage.setItem(key, j.timezone); } catch { /* ignore */ } } })
      .catch(() => {});
  }, [key]);
  return tz;
}

/** שעון כפול: ישראל מול איפה שהבנות נמצאות */
export default function DualClock() {
  const { me } = useAuth();
  const locs = useTable<LocationUpdate>('location_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const here = locs.rows[0];
  const fromLocation = useTripTz(here?.lat, here?.lng);
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // מטיילת: השעון של הטלפון שלה. הורים ומנהל: לפי המיקום האחרון שהבנות עדכנו
  const tripTz = me?.is_traveler ? device : fromLocation || device;
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);

  const ilH = hourIn(IL);
  const same = fmt(IL) === fmt(tripTz);
  const callOk = ilH >= 8 && ilH < 22;
  return (
    <section className="dual-clock" aria-label="שעון">
      <div className="dc-side">
        <span className="dc-label">🇮🇱 בישראל</span>
        <b className="dc-time tnum">{fmt(IL)}</b>
        <span className="dc-ico" aria-hidden="true">{icon(ilH)}</span>
      </div>
      <div className="dc-mid" aria-hidden="true">✈️</div>
      <div className="dc-side">
        <span className="dc-label">📍 {me?.is_traveler ? 'אצלך' : 'אצל הבנות'}</span>
        <b className="dc-time tnum">{fmt(tripTz)}</b>
        <span className="dc-ico" aria-hidden="true">{icon(hourIn(tripTz))}</span>
      </div>
      <p className="dc-hint small">{same ? 'אותה שעה כמו בישראל' : callOk ? '📞 זמן טוב להתקשר הביתה' : '🤫 בישראל עכשיו לילה'}</p>
    </section>
  );
}
