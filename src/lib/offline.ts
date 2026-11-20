// תור של שינויים שנעשו בלי קליטה. נשמר בטלפון ונשלח לבד כשהחיבור חוזר.
import { supabase } from './supabase';

export type Op = {
  qid: string;
  table: string;
  kind: 'insert' | 'upsert' | 'update' | 'delete';
  values?: Record<string, any>;
  match?: Record<string, any>;
  onConflict?: string;
  at: number;
};

const KEY = 'trip:queue';
const EVT = 'trip-queue';

export function readQueue(): Op[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeQueue(q: Op[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}
export function onQueueChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

export const newId = () =>
  (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

async function run(op: Op) {
  let q: any = supabase.from(op.table);
  if (op.kind === 'insert') q = q.insert(op.values);
  else if (op.kind === 'upsert') q = q.upsert(op.values, op.onConflict ? { onConflict: op.onConflict } : undefined);
  else if (op.kind === 'update') q = q.update(op.values);
  else q = q.delete();
  if (op.match && op.kind !== 'insert' && op.kind !== 'upsert') for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v);
  return (await q) as { error: { code?: string; message?: string } | null };
}

// שגיאת רשת (אין קליטה) ולא שגיאה אמיתית של המסד
const isNetwork = (e: { code?: string; message?: string } | null) =>
  !!e && (!e.code || /fetch|network|load failed/i.test(e.message || ''));

/** כתיבה למסד: אם אין קליטה, השינוי נשמר בתור ונשלח אחר כך */
export async function dbWrite(op: Omit<Op, 'qid' | 'at'>): Promise<'ok' | 'queued' | 'error'> {
  const full: Op = { ...op, qid: newId(), at: Date.now() };
  if (navigator.onLine) {
    try {
      const { error } = await run(full);
      if (!error) return 'ok';
      if (!isNetwork(error)) return 'error';
    } catch { /* נופלים לתור */ }
  }
  writeQueue([...readQueue(), full]);
  return 'queued';
}

let flushing = false;
/** שליחת כל מה שמחכה בתור, לפי הסדר */
export async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let q = readQueue();
    while (q.length) {
      const op = q[0];
      let res: { error: any };
      try { res = await run(op); } catch { break; }
      if (res.error && isNetwork(res.error)) break;       // עדיין אין קליטה: ננסה שוב אחר כך
      // הצלחה, או שגיאה קבועה (למשל כבר נשמר): מורידים מהתור
      q = readQueue().filter((x) => x.qid !== op.qid);
      writeQueue(q);
    }
  } finally {
    flushing = false;
  }
}

export function startQueueSync() {
  flushQueue();
  window.addEventListener('online', flushQueue);
  const t = setInterval(flushQueue, 30_000);
  return () => { window.removeEventListener('online', flushQueue); clearInterval(t); };
}

/** מחיל על רשימה שנטענה את השינויים שעוד מחכים בתור, כדי שיופיעו מיד */
export function applyPending<T extends Record<string, any>>(table: string, rows: T[], accept?: (row: T) => boolean): T[] {
  const ops = readQueue().filter((o) => o.table === table);
  if (!ops.length) return rows;
  let out = [...rows];
  const matches = (row: T, m?: Record<string, any>) => !!m && Object.entries(m).every(([k, v]) => row[k] === v);
  for (const o of ops) {
    if ((o.kind === 'insert' || o.kind === 'upsert') && o.values) {
      const v = { ...o.values, __pending: true } as unknown as T;
      if (accept && !accept(v)) continue;
      const key = o.onConflict ? o.onConflict.split(',') : ['id'];
      const i = out.findIndex((r) => key.every((k) => r[k] !== undefined && r[k] === (v as any)[k]));
      if (i >= 0) out[i] = { ...out[i], ...v }; else out = [...out, v];
    } else if (o.kind === 'update') {
      out = out.map((r) => (matches(r, o.match) ? { ...r, ...o.values, __pending: true } : r));
    } else if (o.kind === 'delete') {
      out = out.filter((r) => !matches(r, o.match));
    }
  }
  return out;
}
