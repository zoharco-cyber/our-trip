import { supabase } from './supabase';
import { dbWrite, newId, readQueue } from './offline';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function deviceLabel() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'אייפון' : /iPad/.test(ua) ? 'אייפד' : /Android/.test(ua) ? 'אנדרואיד' : 'מחשב';
  const app = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone ? 'אפליקציה' : 'דפדפן';
  return `${kind} · ${app}`;
}

type Recent = { at: string; msg: string; where: string };
const RECENT = 'trip:errors';
const SENT = 'trip:errSent';

function readRecent(): Recent[] { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } }
function remember(msg: string) {
  const r = [...readRecent(), { at: new Date().toISOString(), msg: msg.slice(0, 300), where: location.hash || '#/' }].slice(-10);
  try { localStorage.setItem(RECENT, JSON.stringify(r)); } catch { /* ignore */ }
}

/** כל מה שעוזר להבין תקלה: טלפון, גרסה, עמוד, קליטה, שינויים שמחכים ושגיאות אחרונות */
export function snapshot() {
  return {
    version: APP_VERSION,
    device: deviceLabel(),
    ua: navigator.userAgent.slice(0, 200),
    path: location.hash || '#/',
    online: navigator.onLine,
    queue: readQueue().length,
    screen: `${innerWidth}x${innerHeight}`,
    saver: document.documentElement.dataset.saver === '1',
    recent: readRecent(),
  };
}

// רעש שאינו תקלה אמיתית
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Failed to fetch$/i, /NetworkError/i, /Load failed/i, /AbortError/i, /The operation was aborted/i, /Network request failed/i, /The Internet connection appears to be offline/i];
// אחרי עדכון גרסה: קובץ ישן של עמוד כבר לא קיים בשרת
const STALE = [/dynamically imported module/i, /Importing a module script failed/i, /error loading dynamically imported module/i, /Unable to preload CSS/i];

export function isStaleChunk(msg: string) { return STALE.some((r) => r.test(msg)); }

/** טעינה מחדש פעם אחת אם הגרסה בטלפון ישנה. מחזיר true אם טוען מחדש. */
export function reloadIfStale(msg: string) {
  if (!isStaleChunk(msg)) return false;
  let last = 0; try { last = Number(sessionStorage.getItem('trip:staleReload')) || 0; } catch { /* ignore */ }
  if (Date.now() - last < 60_000) return false; // כבר ניסינו לפני רגע: זו תקלה אמיתית
  try { sessionStorage.setItem('trip:staleReload', String(Date.now())); } catch { /* ignore */ }
  location.reload();
  return true;
}

/** שולח תקלה אוטומטית למנהל (פעם בשעה לכל תקלה, רק עם קליטה ומשתמשת מחוברת) */
export async function autoReport(message: string, extra?: Record<string, unknown>) {
  const msg = message.replace(/\s+/g, ' ').trim().slice(0, 500) || 'תקלה לא ידועה';
  remember(msg);
  if (!navigator.onLine || NOISE.some((r) => r.test(msg))) return;
  let sent: Record<string, number> = {};
  try { sent = JSON.parse(localStorage.getItem(SENT) || '{}'); } catch { /* ignore */ }
  if (Date.now() - (sent[msg] || 0) < 60 * 60e3) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  sent[msg] = Date.now();
  // שומרים רק את 30 האחרונות
  sent = Object.fromEntries(Object.entries(sent).sort((a, b) => b[1] - a[1]).slice(0, 30));
  try { localStorage.setItem(SENT, JSON.stringify(sent)); } catch { /* ignore */ }
  await supabase.from('app_errors').insert({ kind: 'auto', message: msg, details: { ...snapshot(), ...extra } }).then(() => {}, () => {});
}

/** דיווח ידני "משהו לא עובד". בלי קליטה: נשמר ונשלח כשתחזור */
export async function sendReport(text: string) {
  return dbWrite({ table: 'app_errors', kind: 'insert', values: { id: newId(), kind: 'report', message: text.trim().slice(0, 2000), details: snapshot() } });
}

let installed = false;
export function installErrorHandlers() {
  if (installed) return; installed = true;
  window.addEventListener('error', (e) => {
    const msg = e.message || String(e.error || '');
    if (reloadIfStale(msg)) return;
    if (!msg && !e.error) return; // קובץ תמונה שלא נטען וכד׳
    autoReport(msg, { stack: String(e.error?.stack || '').slice(0, 1500), src: `${e.filename || ''}:${e.lineno || ''}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r: any = e.reason;
    const msg = r?.message || (typeof r === 'string' ? r : '');
    if (!msg) return;
    if (reloadIfStale(msg)) return;
    autoReport(msg, { stack: String(r?.stack || '').slice(0, 1500), promise: true });
  });
  // vite: קובץ עמוד שלא נמצא (אחרי עדכון)
  window.addEventListener('vite:preloadError', (e: any) => { if (reloadIfStale('Unable to preload CSS ' + (e?.payload?.message || ''))) e.preventDefault?.(); });
}
