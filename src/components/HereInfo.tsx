import { useEffect, useState } from 'react';
import { placeInfo } from '../lib/geo';
import { factFor } from '../data/facts';
import { todayISO } from '../lib/util';

/** גובה (עם טיפים למחלת גבהים) ועובדה יומית על המדינה, לפי "אנחנו כאן" */
export default function HereInfo({ lat, lng }: { lat: number; lng: number }) {
  const key = `elev:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const [elev, setElev] = useState<number | null>(() => { try { const v = localStorage.getItem(key); return v ? Number(v) : null; } catch { return null; } });
  const [cc, setCc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (elev === null && navigator.onLine) {
      fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`).then((r) => r.json()).then((j) => {
        const v = Number(j?.elevation?.[0]);
        if (isFinite(v)) { setElev(v); try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } }
      }).catch(() => {});
    }
    placeInfo(lat, lng).then((i) => setCc(i.cc));
  }, [lat, lng]);

  const fact = cc ? factFor(cc, todayISO()) : null;
  const high = elev !== null && elev >= 2500;
  if (elev === null && !fact) return null;
  return (
    <section className="here-info">
      {elev !== null && (
        <div className={'altitude' + (high ? ' high' : '')}>
          <div className="row-between">
            <span>⛰️ אתן בגובה <b className="tnum">{Math.round(elev).toLocaleString('he-IL')} מ׳</b></span>
            {high && <button className="link-btn" onClick={() => setOpen((v) => !v)}>{open ? 'הסתרה' : 'טיפים לגובה'}</button>}
          </div>
          {high && !open && <span className="small">גובה רב. כדאי לשתות הרבה ולקחת את זה לאט 💧</span>}
          {high && open && (
            <ul className="alt-tips small">
              <li>💧 לשתות הרבה מים, ותה קוקה אם יש</li>
              <li>🐢 יום-יומיים בלי מאמץ גדול לפני טרקים</li>
              <li>🍷 בלי אלכוהול בימים הראשונים בגובה</li>
              <li>😴 לישון בגובה נמוך יותר אם אפשר</li>
              <li>⚠️ כאב ראש חזק, בחילה, בלבול או קוצר נשימה במנוחה: לרדת לגובה נמוך ולפנות לרופא</li>
            </ul>
          )}
        </div>
      )}
      {fact && (
        <div className="fun-fact">
          <span className="ff-kicker">💡 הידעתן?</span>
          <p>{fact}</p>
        </div>
      )}
    </section>
  );
}
