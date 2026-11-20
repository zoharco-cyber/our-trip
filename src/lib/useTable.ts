import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyPending, onQueueChange, readQueue } from './offline';
import { supabase } from './supabase';

type Opts = { order?: string; ascending?: boolean; filter?: (q: any) => any; enabled?: boolean; pendingAccept?: (row: any) => boolean };

const cacheKey = (k: string) => `cache:${k}`;

/** טוען טבלה, מתעדכן בזמן אמת, ושומר עותק אחרון לשימוש בלי אינטרנט */
export function useTable<T>(table: string, opts: Opts = {}, deps: unknown[] = []) {
  const key = table + JSON.stringify(deps);
  const [raw, setRows] = useState<T[]>(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey(key)) || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const load = useCallback(async () => {
    const o = optsRef.current;
    if (o.enabled === false) { setLoading(false); return; }
    let q = supabase.from(table).select('*');
    if (o.filter) q = o.filter(q);
    if (o.order) q = q.order(o.order, { ascending: o.ascending ?? true });
    const { data, error } = await q;
    if (error) { setOffline(!navigator.onLine); }
    else {
      setRows(data as T[]);
      setOffline(false);
      try { localStorage.setItem(cacheKey(key), JSON.stringify(data)); } catch { /* ignore */ }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [load, table]);

  // שינויים שנעשו בלי קליטה ועוד מחכים לשליחה, מוצגים כבר עכשיו
  const [qTick, setQTick] = useState(0);
  const pendingCount = useRef(readQueue().length);
  useEffect(() => onQueueChange(() => {
    const n = readQueue().length;
    if (n < pendingCount.current) load();  // משהו נשלח: טוענים מחדש מהשרת
    pendingCount.current = n;
    setQTick((t) => t + 1);
  }), [load]);
  const rows = useMemo(() => applyPending(table, raw as any[], optsRef.current.pendingAccept) as T[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, qTick, table]);

  return { rows, setRows, loading, offline, reload: load };
}
