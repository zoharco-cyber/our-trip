import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

type MoneyState = { rate: number; rateSource: 'live' | 'manual'; usd: (n: number) => string; ils: (n: number) => string };
const Ctx = createContext<MoneyState>(null as any);
export const useMoney = () => useContext(Ctx);

const fmtUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtIls = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

/** שער דולר-שקל: קודם שער חי (שירות חינמי), אחרת השער שהמנהל הגדיר */
export function MoneyProvider({ children }: { children: ReactNode }) {
  const [rate, setRate] = useState<number>(() => Number(localStorage.getItem('trip:rate')) || 3.6);
  const [rateSource, setSource] = useState<'live' | 'manual'>('manual');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        const j = await r.json();
        const v = Number(j?.rates?.ILS);
        if (!cancelled && v > 0) {
          setRate(v); setSource('live');
          localStorage.setItem('trip:rate', String(v));
          return;
        }
      } catch { /* fall back */ }
      const { data } = await supabase.from('settings').select('value').eq('key', 'usd_ils_rate').maybeSingle();
      const v = Number(data?.value);
      if (!cancelled && v > 0) { setRate(v); localStorage.setItem('trip:rate', String(v)); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Ctx.Provider value={{ rate, rateSource, usd: (n) => fmtUsd.format(n), ils: (n) => fmtIls.format(n * rate) }}>
      {children}
    </Ctx.Provider>
  );
}

/** סכום בדולר ובשקל ביחד */
export function Money({ usd, big }: { usd: number; big?: boolean }) {
  const m = useMoney();
  return (
    <span className={big ? 'money money-big' : 'money'}>
      <span className="money-usd" dir="ltr">{m.usd(usd)}</span>
      <span className="money-ils" dir="ltr">{m.ils(usd)}</span>
    </span>
  );
}
