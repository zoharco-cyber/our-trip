import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type MoneyState = { rate: number; rateSource: 'live' | 'saved'; rateAt: string | null; usd: (n: number) => string; ils: (n: number) => string };
const Ctx = createContext<MoneyState>(null as any);
export const useMoney = () => useContext(Ctx);

const fmtUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtIls = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** שער דולר-שקל עדכני מהאינטרנט (שירות חינמי). בלי חיבור: השער האחרון שנשמר במכשיר */
export function MoneyProvider({ children }: { children: ReactNode }) {
  const [rate, setRate] = useState<number>(() => Number(read('trip:rate')) || 3.6);
  const [rateAt, setRateAt] = useState<string | null>(() => read('trip:rateAt'));
  const [rateSource, setSource] = useState<'live' | 'saved'>('saved');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        const j = await r.json();
        const v = Number(j?.rates?.ILS);
        if (!cancelled && v > 0) {
          const at = new Date().toISOString();
          setRate(v); setSource('live'); setRateAt(at);
          write('trip:rate', String(v)); write('trip:rateAt', at);
        }
      } catch { /* בלי חיבור: נשאר השער האחרון שנשמר */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Ctx.Provider value={{ rate, rateSource, rateAt, usd: (n) => fmtUsd.format(n), ils: (n) => fmtIls.format(n * rate) }}>
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
