/** קוד של 4 ספרות למסמכים ולסיסמאות. נשמר רק בטלפון הזה (כגיבוב), לכל משתמשת בנפרד.
 *  זו נעילת מסך נגד מי שמחזיק בטלפון, לא הצפה: המידע עצמו מוגן בשרת בהרשאות. */
const key = (uid: string) => `trip:pin:${uid}`;
const failKey = (uid: string) => `trip:pinFails:${uid}`;
const OPEN = 'trip:pinOpen';
const AWAY_MS = 30_000;       // יציאה מהאפליקציה ליותר מ-30 שניות נועלת
const OPEN_MS = 10 * 60_000;  // ובכל מקרה נועל אחרי 10 דקות

async function digest(salt: string, uid: string, pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${uid}:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin(uid: string) { try { return !!localStorage.getItem(key(uid)); } catch { return false; } }

export async function setPin(uid: string, pin: string) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(key(uid), JSON.stringify({ salt, hash: await digest(salt, uid, pin) }));
  localStorage.removeItem(failKey(uid));
  markOpen();
}

type Fails = { n: number; until: number };
export function lockedFor(uid: string): number {
  try { const f: Fails = JSON.parse(localStorage.getItem(failKey(uid)) || '{"n":0,"until":0}'); return Math.max(0, f.until - Date.now()); } catch { return 0; }
}

/** true = נכון. אחרי 5 טעויות: המתנה של דקה, ומכפילה את עצמה בכל טעות נוספת */
export async function checkPin(uid: string, pin: string): Promise<boolean> {
  if (lockedFor(uid) > 0) return false;
  const raw = localStorage.getItem(key(uid));
  if (!raw) return false;
  const { salt, hash } = JSON.parse(raw);
  if ((await digest(salt, uid, pin)) === hash) { localStorage.removeItem(failKey(uid)); markOpen(); return true; }
  let f: Fails = { n: 0, until: 0 };
  try { f = JSON.parse(localStorage.getItem(failKey(uid)) || '{"n":0,"until":0}'); } catch { /* ignore */ }
  f.n += 1;
  if (f.n >= 5) f.until = Date.now() + 60_000 * 2 ** Math.min(6, f.n - 5);
  localStorage.setItem(failKey(uid), JSON.stringify(f));
  return false;
}

export function markOpen() { try { sessionStorage.setItem(OPEN, String(Date.now() + OPEN_MS)); } catch { /* ignore */ } }
export function lockNow() { try { sessionStorage.removeItem(OPEN); } catch { /* ignore */ } }
export function isOpen() { try { return Number(sessionStorage.getItem(OPEN) || 0) > Date.now(); } catch { return false; } }

// נעילה כשיוצאים מהאפליקציה
let hiddenAt = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) { lockNow(); window.dispatchEvent(new Event('trip:pinlock')); }
  });
}
