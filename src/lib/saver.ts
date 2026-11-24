import { useEffect, useState } from 'react';

/** מצב חיסכון בסוללה: כהה, בלי אנימציות ובלי שכבות קישוט.
 *  "אוטומטי" נדלק מתחת ל-15% — רק בטלפונים שמאפשרים לאתר לקרוא את הסוללה (אנדרואיד; אייפון לא). */
export type SaverPref = 'auto' | 'on' | 'off';
export const LOW = 0.15;
const KEY = 'trip:saver';
const listeners = new Set<() => void>();

export function getSaverPref(): SaverPref {
  try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export function setSaverPref(p: SaverPref) {
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
export const saverActive = () => typeof document !== 'undefined' && document.documentElement.dataset.saver === '1';

export function useSaverPref(): SaverPref {
  const [p, setP] = useState(getSaverPref);
  useEffect(() => { const f = () => setP(getSaverPref()); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return p;
}

type Battery = { supported: boolean; level: number; charging: boolean };
export function useBattery(): Battery {
  const [b, setB] = useState<Battery>({ supported: false, level: 1, charging: true });
  useEffect(() => {
    const nav = navigator as any;
    if (typeof nav.getBattery !== 'function') return;
    let bat: any; let alive = true;
    const upd = () => alive && setB({ supported: true, level: bat.level, charging: bat.charging });
    nav.getBattery().then((x: any) => {
      bat = x; upd();
      bat.addEventListener('levelchange', upd); bat.addEventListener('chargingchange', upd);
    }).catch(() => {});
    return () => { alive = false; if (bat) { bat.removeEventListener('levelchange', upd); bat.removeEventListener('chargingchange', upd); } };
  }, []);
  return b;
}

/** האם המצב החסכוני פועל עכשיו, ואם הוא נדלק בגלל סוללה חלשה */
export function useSaver() {
  const pref = useSaverPref();
  const bat = useBattery();
  const low = bat.supported && !bat.charging && bat.level <= LOW;
  const active = pref === 'on' || (pref === 'auto' && low);
  useEffect(() => {
    if (active) document.documentElement.dataset.saver = '1';
    else delete document.documentElement.dataset.saver;
  }, [active]);
  return { pref, active, low, battery: bat };
}
