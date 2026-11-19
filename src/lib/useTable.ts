import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

type Opts = { order?: string; ascending?: boolean; filter?: (q: any) => any; enabled?: boolean };

const cacheKey = (k: string) => `cache:${k}`;

/** טוען טבלה, מתעדכן בזמן אמת, ושומר עותק אחרון לשימוש בלי אינטרנט */
export function useTable<T>(table: string, opts: Opts = {}, deps: unknown[] = []) {
  const key = table + JSON.stringify(deps);
  const [rows, setRows] = useState<T[]>(() => {
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

  return { rows, setRows, loading, offline, reload: load };
}
