import { FormEvent, useState } from 'react';
import { useMoney } from '../lib/money';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Contact } from '../lib/types';
import { CURRENCIES } from '../data/currencies';
import { EMERGENCY, PHRASES } from '../data/help';
import { fmtDate } from '../lib/util';

type Tab = 'convert' | 'emergency' | 'spanish';

export default function Help() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.includes('spanish') ? 'spanish' : 'convert'));
  return (
    <div className="stack-lg narrow">
      <div>
        <h1>עזרה בדרך</h1>
        <p className="muted">הכול כאן עובד גם בלי אינטרנט, אחרי שפותחים את האתר פעם אחת עם חיבור.</p>
      </div>
      <div className="seg" role="tablist">
        <button className={tab === 'convert' ? 'on' : ''} onClick={() => setTab('convert')}>המרת כסף</button>
        <button className={tab === 'emergency' ? 'on' : ''} onClick={() => setTab('emergency')}>חירום</button>
        <button className={tab === 'spanish' ? 'on' : ''} onClick={() => setTab('spanish')}>ספרדית</button>
      </div>
      {tab === 'convert' && <Converter />}
      {tab === 'emergency' && <Emergency />}
      {tab === 'spanish' && <Spanish />}
    </div>
  );
}

function Converter() {
  const { rates, rateAt, rateSource } = useMoney();
  const [cur, setCur] = useState(() => { try { return localStorage.getItem('trip:convCur') || 'PEN'; } catch { return 'PEN'; } });
  const [amount, setAmount] = useState('100');
  const n = Number(amount) || 0;
  const r = rates[cur];
  const usd = r ? n / r : null;
  const fmt = (v: number, code: string) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: code, maximumFractionDigits: v < 100 ? 2 : 0 }).format(v);
  return (
    <section className="card stack converter">
      <div className="conv-row">
        <input id="conv-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="סכום" />
        <select id="conv-cur" value={cur} onChange={(e) => { setCur(e.target.value); try { localStorage.setItem('trip:convCur', e.target.value); } catch { /* ignore */ } }}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.country}</option>)}
        </select>
      </div>
      {usd === null ? <p className="error">אין עדיין שער למטבע הזה. צריך להתחבר לאינטרנט פעם אחת.</p> : (
        <div className="conv-out">
          <div><span className="muted small">בדולר</span><b dir="ltr">{fmt(usd, 'USD')}</b></div>
          <div><span className="muted small">בשקל</span><b dir="ltr">{fmt(usd * (rates.ILS || 0), 'ILS')}</b></div>
        </div>
      )}
      <div className="chips">
        {[10, 50, 100, 500, 1000].map((v) => <button key={v} className="chip" onClick={() => setAmount(String(v))}>{v}</button>)}
      </div>
      <p className="muted small">{rateSource === 'live' ? 'שער עדכני' : rateAt ? `שער מ-${fmtDate(rateAt)}` : 'שער משוער'}{r ? ` · 1$ = ${r.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${cur}` : ''}</p>
    </section>
  );
}

function Emergency() {
  const contacts = useTable<Contact>('contacts', { order: 'created_at' });
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !phone.trim()) return;
    await supabase.from('contacts').insert({ label: label.trim(), phone: phone.trim() });
    setLabel(''); setPhone(''); contacts.reload();
  }
  async function remove(id: string) { await supabase.from('contacts').delete().eq('id', id); contacts.reload(); }
  return (
    <div className="stack-lg">
      <section className="stack">
        <h2>אנשי קשר שלנו</h2>
        <p className="muted small">ביטוח, שגרירות ישראל במדינה שבה אתן, משפחה. שמרו כאן כדי שיהיה זמין בלי אינטרנט.</p>
        {contacts.rows.length > 0 && (
          <ul className="list">
            {contacts.rows.map((c) => (
              <li key={c.id} className="list-item">
                <div className="grow"><b>{c.label}</b></div>
                <a className="phone" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} dir="ltr">{c.phone}</a>
                <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(c.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
        <form className="form-row" onSubmit={add}>
          <input id="ct-label" placeholder="למשל: חברת הביטוח" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input id="ct-phone" placeholder="+972..." dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn btn-primary" disabled={!label.trim() || !phone.trim()}>הוספה</button>
        </form>
      </section>
      <section className="stack">
        <h2>מספרי חירום מקומיים</h2>
        <div className="grid-2">
          {EMERGENCY.map((c) => (
            <div key={c.country} className="card emergency">
              <b>{c.country}</b>
              <div className="em-nums">
                {c.numbers.map((x) => <a key={x.label} href={`tel:${x.n}`} className="em-num"><span>{x.label}</span><b dir="ltr">{x.n}</b></a>)}
              </div>
            </div>
          ))}
        </div>
        <p className="muted small">כדאי לוודא את המספרים כשמגיעים לכל מדינה (בהוסטל או באתר הרשמי). בחו"ל, 112 מחייג לחירום מרוב הטלפונים הניידים גם בלי SIM מקומי.</p>
      </section>
    </div>
  );
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES'; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('es'));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* הדפדפן לא תומך בהקראה */ }
}

function Spanish() {
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return (
    <div className="stack-lg">
      {PHRASES.map((g) => (
        <section key={g.group} className="stack">
          <h2>{g.group}</h2>
          <ul className="phrases">
            {g.items.map((p) => (
              <li key={p.es} className="phrase">
                <div className="grow">
                  <b>{p.he}</b>
                  <span className="es" dir="ltr" lang="es">{p.es}</span>
                  <span className="muted small">{p.say}</span>
                </div>
                {canSpeak && <button className="btn btn-small" onClick={() => speak(p.es)} aria-label={`הקראה: ${p.es}`}>🔊</button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
