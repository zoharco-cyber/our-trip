import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Money, useMoney } from '../lib/money';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import { dbWrite, newId } from '../lib/offline';
import type { Expense, Transfer } from '../lib/types';
import { EXPENSE_CATEGORIES } from '../config';
import { CURRENCIES } from '../data/currencies';
import { fmtDate, todayISO } from '../lib/util';
import { IMG, shrinkImage, shrunkName } from '../lib/image';
import { Who, Empty } from '../components/Avatar';
import { paidStamp, reducedMotion } from '../lib/fx';
import type { TripEvent } from '../lib/types';
import { FIRST_FLIGHT } from '../config';
import { safeFileName } from '../lib/util';

type Debt = { from: string; to: string; amount: number };

/** חישוב מאזנים: חיובי = מגיע לה כסף, שלילי = היא חייבת */
export function computeBalances(ids: string[], expenses: Expense[], transfers: Transfer[]) {
  const net: Record<string, number> = {};
  const share: Record<string, number> = {};
  const paid: Record<string, number> = {};
  ids.forEach((id) => { net[id] = 0; share[id] = 0; paid[id] = 0; });
  for (const e of expenses) {
    const among = e.split_among.filter((id) => id in net);
    if (!among.length) continue;
    const part = Number(e.amount_usd) / among.length;
    const custom = e.split_amounts && Object.keys(e.split_amounts).length ? e.split_amounts : null;
    if (e.paid_by in net) { net[e.paid_by] += Number(e.amount_usd); paid[e.paid_by] += Number(e.amount_usd); }
    if (custom) {
      // חלוקה לא שווה: כל אחת משלמת את הסכום שנקבע לה
      for (const [id, v] of Object.entries(custom)) if (id in net) { net[id] -= Number(v); share[id] += Number(v); }
    } else among.forEach((id) => { net[id] -= part; share[id] += part; });
  }
  for (const t of transfers) {
    if (t.from_id in net) net[t.from_id] += Number(t.amount_usd);
    if (t.to_id in net) net[t.to_id] -= Number(t.amount_usd);
  }
  // מינימום העברות: החייבת הגדולה משלמת לזו שמגיע לה הכי הרבה
  const debtors = ids.filter((id) => net[id] < -0.005).map((id) => ({ id, v: -net[id] })).sort((a, b) => b.v - a.v);
  const creditors = ids.filter((id) => net[id] > 0.005).map((id) => ({ id, v: net[id] })).sort((a, b) => b.v - a.v);
  const debts: Debt[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0.005) debts.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amt * 100) / 100 });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return { net, share, paid, debts };
}

export default function MoneyPage() {
  const { travelers, me, reloadProfiles } = useAuth();
  const { rate, rateSource, rateAt } = useMoney();
  const exp = useTable<Expense>('expenses', { order: 'spent_on', ascending: false });
  const tr = useTable<Transfer>('transfers', { order: 'created_at', ascending: false });
  const ids = travelers.map((t) => t.id);
  const { net, share, paid, debts } = useMemo(() => computeBalances(ids, exp.rows, tr.rows), [ids.join(), exp.rows, tr.rows]);
  // מי משלמת הבאה: זו שהכי "בחובה" (המאזן הכי נמוך)
  const nextPayer = travelers.length > 1 && exp.rows.length > 0
    ? [...travelers].sort((a, b) => (net[a.id] || 0) - (net[b.id] || 0))[0] : null;
  // תקציב יומי: מה שנשאר חלקי הימים שנותרו עד סוף הטיול
  const settings = useTable<{ key: string; value: any }>('settings', { filter: (q) => q.eq('key', 'trip_end') });
  const events = useTable<TripEvent>('events', { order: 'starts_at' });
  const tripEnd: string | null = settings.rows[0]?.value || null;
  const tripStart = new Date(events.rows[0]?.starts_at || FIRST_FLIGHT).toLocaleDateString('en-CA');
  const daysLeft = (() => {
    if (!tripEnd) return null;
    const from = new Date(Math.max(Date.now(), new Date(tripStart + 'T00:00:00').getTime()));
    from.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((new Date(tripEnd + 'T00:00:00').getTime() - from.getTime()) / 864e5) + 1);
  })();

  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [budget, setBudget] = useState('');
  const [budgetCur, setBudgetCur] = useState<'USD' | 'ILS'>('USD');
  const [filter, setFilter] = useState<string>('all');

  const total = exp.rows.reduce((s, e) => s + Number(e.amount_usd), 0);
  const ranking = [...travelers].sort((a, b) => share[b.id] - share[a.id]);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    c, v: exp.rows.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount_usd), 0),
  })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    const n = Number(budget);
    if (!(n >= 0)) return;
    const usd = budgetCur === 'USD' ? n : n / rate;
    await supabase.from('profiles').update({ initial_budget_usd: Math.round(usd * 100) / 100 }).eq('id', me.id);
    setEditBudget(false); setBudget(''); reloadProfiles();
  }
  async function settle(d: Debt, e: React.MouseEvent) {
    const r = await dbWrite({ table: 'transfers', kind: 'insert', values: { id: newId(), from_id: d.from, to_id: d.to, amount_usd: d.amount, created_at: new Date().toISOString() } });
    if (r !== 'error') paidStamp(e.clientX, e.clientY);
    tr.reload();
  }
  async function removeExpense(id: string) {
    await dbWrite({ table: 'expenses', kind: 'delete', match: { id } }); exp.reload();
  }
  async function openReceipt(path: string) {
    const w = window.open('', '_blank');
    const { data } = await supabase.storage.from('photos').createSignedUrl(path, 600);
    if (data?.signedUrl) { if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl; } else w?.close();
  }
  async function removeTransfer(id: string) {
    await supabase.from('transfers').delete().eq('id', id); tr.reload();
  }

  const list = filter === 'all' ? exp.rows : exp.rows.filter((e) => e.paid_by === filter || e.split_among.includes(filter));

  return (
    <div className="stack-lg money-page">
      <FloatingMoney />
      <div className="row-between">
        <div>
          <h1>כסף</h1>
          <p className="muted">סך הכול הוצאות: <Money usd={total} /> · שער: ₪{rate.toFixed(2)} לדולר{rateSource === 'live' ? ' (עדכני)' : rateAt ? ` (עודכן לאחרונה ${fmtDate(rateAt)})` : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'סגירה' : 'הוצאה חדשה'}</button>
      </div>

      {nextPayer && (
        <div className="card next-payer" style={{ ['--c' as any]: nextPayer.color }}>
          <span className="np-icon" aria-hidden="true">👛</span>
          <div className="grow">
            <span className="small muted">מי משלמת הבאה?</span>
            <b><Who id={nextPayer.id} /></b>
            <span className="small muted">{(net[nextPayer.id] || 0) < -0.5 ? 'היא הכי בחובה כרגע, אז התור שלה' : 'כולן כמעט מאוזנות, אבל התור שלה'}</span>
          </div>
        </div>
      )}
      {showForm && <ExpenseForm suggested={nextPayer?.id} onDone={() => { setShowForm(false); exp.reload(); }} />}

      <section className="stack">
        <h2>כמה נשאר לכל אחת</h2>
        <div className="grid-3">
          {travelers.map((t) => {
            const left = Number(t.initial_budget_usd) - share[t.id];
            const perDay = daysLeft && Number(t.initial_budget_usd) > 0 ? Math.max(0, left) / daysLeft : null;
            const pct = t.initial_budget_usd > 0 ? Math.max(0, Math.min(100, (left / t.initial_budget_usd) * 100)) : 0;
            return (
              <div key={t.id} className="card budget-card" style={{ ['--c' as any]: t.color }}>
                <div className="row-between"><Who id={t.id} />{me?.id === t.id && (
                  <button className="link-btn" onClick={() => setEditBudget((v) => !v)}>עריכת סכום התחלתי</button>
                )}</div>
                <div className="budget-left"><span className="muted small">נשאר</span><Money usd={left} big /></div>
                <div className="bar"><i style={{ width: pct + '%' }} /></div>
                {perDay !== null && <div className="per-day"><span>אפשר להוציא בערך</span><Money usd={perDay} /><span>ליום</span><span className="muted small">({daysLeft} ימים)</span></div>}
                <dl className="kv">
                  <dt>סכום התחלתי</dt><dd><Money usd={Number(t.initial_budget_usd)} /></dd>
                  <dt>החלק שלה בהוצאות</dt><dd><Money usd={share[t.id]} /></dd>
                  <dt>שילמה מכיסה</dt><dd><Money usd={paid[t.id]} /></dd>
                </dl>
              </div>
            );
          })}
        </div>
        {editBudget && (
          <form className="card form-row" onSubmit={saveBudget}>
            <label className="field grow"><span>הסכום שאיתו יצאתי לטיול</span>
              <input id="budget" type="number" inputMode="decimal" min="0" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            <CurrencyToggle value={budgetCur} onChange={setBudgetCur} />
            <button className="btn btn-primary" disabled={!budget}>שמירה</button>
          </form>
        )}
      </section>

      <section className="stack">
        <h2>מי חייבת למי</h2>
        {debts.length === 0 ? (
          <Empty title="הכול מאוזן">אף אחת לא חייבת כסף לאף אחת.</Empty>
        ) : (
          <ul className="debts">
            {debts.map((d, i) => (
              <li key={i} className="card debt">
                <Who id={d.from} /><span className="arrow">חייבת ל</span><Who id={d.to} />
                <Money usd={d.amount} />
                <button className="btn btn-small" onClick={(e) => settle(d, e)}>סימון כשולם</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <h2>טבלת ההוצאות</h2>
        <p className="muted small">לפי החלק של כל אחת בהוצאות. מי במקום הראשון?</p>
        <ol className="ranking">
          {ranking.map((t, i) => {
            const max = share[ranking[0]?.id] || 1;
            return (
              <li key={t.id} style={{ ['--c' as any]: t.color }}>
                <span className="rank">{i + 1}</span>
                <Who id={t.id} />
                <span className="rank-bar"><i style={{ width: (share[t.id] / max) * 100 + '%' }} /></span>
                <Money usd={share[t.id]} />
                <span className="rank-title">{i === 0 && ranking.length > 1 ? 'מלכת ההוצאות' : i === ranking.length - 1 && ranking.length > 1 ? 'הכי חסכנית' : ''}</span>
              </li>
            );
          })}
        </ol>
        {byCat.length > 0 && (
          <div className="cats">
            {byCat.map((x) => (
              <div key={x.c} className="cat"><span>{x.c}</span><Money usd={x.v} /></div>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <div className="row-between">
          <h2>כל ההוצאות</h2>
          <select id="exp-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">כולן</option>
            {travelers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </select>
        </div>
        {list.length === 0 ? <Empty title="עוד אין הוצאות">הוסיפי את ההוצאה הראשונה בכפתור "הוצאה חדשה".</Empty> : (
          <ul className="list">
            {list.map((e) => (
              <li key={e.id} className="list-item">
                <div className="grow">
                  <b className={(e as any).__pending ? 'is-pending' : ''}>{e.description}</b>
                  <div className="muted small">{fmtDate(e.spent_on)} · {e.category} · שילמה <Who id={e.paid_by} /> · {e.split_amounts && Object.keys(e.split_amounts).length ? '⚖️ חלוקה לא שווה' : `מתחלק בין ${e.split_among.length}`}
                    {e.orig_currency !== 'USD' && <> · הוזן כ-{Number(e.orig_amount).toLocaleString('he-IL')} {CURRENCIES.find((c) => c.code === e.orig_currency)?.name || e.orig_currency}</>}
                  </div>
                </div>
                {(e as any).receipt_path && <button className="icon-btn receipt-open" aria-label="הצגת הקבלה" title="קבלה" onClick={() => openReceipt((e as any).receipt_path)}>🧾</button>}
                <Money usd={Number(e.amount_usd)} />
                <button className="icon-btn" aria-label="מחיקה" onClick={() => removeExpense(e.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
        {tr.rows.length > 0 && (
          <details>
            <summary>החזרים שסומנו ({tr.rows.length})</summary>
            <ul className="list">
              {tr.rows.map((t) => (
                <li key={t.id} className="list-item">
                  <div className="grow"><Who id={t.from_id} /> החזירה ל<Who id={t.to_id} /> <span className="muted small">· {fmtDate(t.created_at)}</span></div>
                  <Money usd={Number(t.amount_usd)} />
                  <button className="icon-btn" aria-label="ביטול" onClick={() => removeTransfer(t.id)}>×</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function CurrencyToggle({ value, onChange }: { value: 'USD' | 'ILS'; onChange: (v: 'USD' | 'ILS') => void }) {
  return (
    <div className="seg" role="group" aria-label="מטבע">
      <button type="button" className={value === 'USD' ? 'on' : ''} onClick={() => onChange('USD')}>$ דולר</button>
      <button type="button" className={value === 'ILS' ? 'on' : ''} onClick={() => onChange('ILS')}>₪ שקל</button>
    </div>
  );
}

function ExpenseForm({ onDone, suggested }: { onDone: () => void; suggested?: string }) {
  const { travelers, me } = useAuth();
  const { usd, ils, toUsd } = useMoney();
  const [description, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState<string>(() => { try { return localStorage.getItem('trip:lastCur') || 'USD'; } catch { return 'USD'; } });
  const [paidBy, setPaidBy] = useState(me?.is_traveler ? me.id : travelers[0]?.id || '');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [uneven, setUneven] = useState(false);
  const [parts, setParts] = useState<Record<string, string>>({});
  const [among, setAmong] = useState<string[]>(travelers.map((t) => t.id));
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState<string | null>(null);

  const n = Number(amount);
  const conv = toUsd(n, cur);
  const amountUsd = conv ?? 0;
  // חלוקה לא שווה: הסכומים מוזנים במטבע של ההוצאה וחייבים להסתכם בסכום הכולל
  const partsSum = among.reduce((s, id) => s + (Number(parts[id]) || 0), 0);
  const partsLeft = Math.round((n - partsSum) * 100) / 100;
  const unevenOk = !uneven || (n > 0 && Math.abs(partsLeft) < 0.01);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description || !(n > 0) || !among.length || !paidBy || conv === null || !unevenOk) return;
    // המרה לדולר; האחרונה מקבלת את השארית כדי שהסכום יהיה מדויק עד הסנט
    let split_amounts: Record<string, number> | null = null;
    if (uneven) {
      const total = Math.round(amountUsd * 100) / 100;
      const out: Record<string, number> = {};
      let acc = 0;
      among.forEach((id, i) => {
        const v = i === among.length - 1 ? Math.round((total - acc) * 100) / 100 : Math.round(((Number(parts[id]) || 0) / n) * total * 100) / 100;
        out[id] = v; acc += v;
      });
      split_amounts = out;
    }
    try { localStorage.setItem('trip:lastCur', cur); } catch { /* ignore */ }
    // קבלה (לא חובה): עולה רק כשיש קליטה
    let receipt_path: string | null = null;
    if (receipt && navigator.onLine && me) {
      const blob = await shrinkImage(receipt, IMG.receipt);
      const path = `receipts/${me.id}/${Date.now()}-${safeFileName(shrunkName(receipt.name, blob, receipt))}`;
      const up = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (!up.error) receipt_path = path;
    }
    const r = await dbWrite({ table: 'expenses', kind: 'insert', values: {
      id: newId(), receipt_path, split_amounts, description, amount_usd: Math.round(amountUsd * 100) / 100, orig_amount: n, orig_currency: cur,
      paid_by: paidBy, split_among: among, category, spent_on: date, created_at: new Date().toISOString(),
    } });
    if (r === 'error') setErr('ההוצאה לא נשמרה. נסי שוב.');
    else onDone();
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="form-grid">
        <label className="field"><span>על מה?</span>
          <input id="exp-desc" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="למשל: הוסטל בקוסקו" />
        </label>
        <label className="field"><span>סכום</span>
          <input id="exp-amount" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field"><span>מטבע</span>
          <select id="exp-cur" value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
          </select>
        </label>
        <label className="field"><span>מי שילמה</span>
          <select id="exp-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {travelers.map((t) => <option key={t.id} value={t.id}>{t.display_name}{t.id === suggested ? ' 👛 (התור שלה)' : ''}</option>)}
          </select>
        </label>
        <label className="field"><span>קטגוריה</span>
          <select id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>תאריך</span>
          <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="field"><span>מתחלק בין</span>
        <div className="chips">
          {travelers.map((t) => (
            <label key={t.id} className={'chip' + (among.includes(t.id) ? ' on' : '')} style={{ ['--c' as any]: t.color }}>
              <input type="checkbox" checked={among.includes(t.id)}
                onChange={(e) => setAmong((a) => e.target.checked ? [...a, t.id] : a.filter((x) => x !== t.id))} />
              {t.display_name.split(' ')[0]}
            </label>
          ))}
        </div>
      </div>
      <label className="check small"><input type="checkbox" checked={uneven} onChange={(e) => setUneven(e.target.checked)} /><span>⚖️ חלוקה לא שווה (למשל מישהי אכלה מנה כפולה)</span></label>
      {uneven && (
        <div className="uneven card">
          {travelers.filter((t) => among.includes(t.id)).map((t) => (
            <label key={t.id} className="uneven-row" style={{ ['--c' as any]: t.color }}>
              <span><i className="dot" /> {t.display_name.split(' ')[0]}</span>
              <input id={`part-${t.id}`} type="number" inputMode="decimal" min="0" step="any" value={parts[t.id] || ''} onChange={(e) => setParts((p) => ({ ...p, [t.id]: e.target.value }))} placeholder="0" />
              <span className="muted small">{cur}</span>
            </label>
          ))}
          <div className="row gap wrap small">
            <span className={Math.abs(partsLeft) < 0.01 ? 'ok' : 'error'}>{Math.abs(partsLeft) < 0.01 ? '✓ הסכומים מתאימים לסך הכול' : partsLeft > 0 ? `נשאר לחלק: ${partsLeft} ${cur}` : `עברתן את הסכום ב-${-partsLeft} ${cur}`}</span>
            {partsLeft > 0.009 && <button type="button" className="link-btn" onClick={() => {
              const empty = among.filter((id) => !(Number(parts[id]) > 0));
              if (!empty.length) return;
              const each = Math.floor((partsLeft / empty.length) * 100) / 100;
              setParts((p) => { const q = { ...p }; empty.forEach((id, i) => { q[id] = String(i === empty.length - 1 ? Math.round((partsLeft - each * (empty.length - 1)) * 100) / 100 : each); }); return q; });
            }}>לחלק את השאר שווה בין מי שלא מילאה</button>}
          </div>
        </div>
      )}
      {n > 0 && conv === null && <p className="error">אין עדיין שער למטבע הזה. צריך חיבור לאינטרנט פעם אחת כדי לטעון שערים.</p>}
      {n > 0 && conv !== null && !uneven && <p className="muted small">{usd(amountUsd)} · {ils(amountUsd)} · {among.length ? `כל אחת: ${usd(amountUsd / among.length)} · ${ils(amountUsd / among.length)}` : 'בחרי לפחות אחת'}</p>}
      <label className="btn btn-small upload-btn receipt-btn">
        {receipt ? `🧾 קבלה נבחרה ✓` : '🧾 צילום קבלה (לא חובה)'}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
      </label>
      {receipt && !navigator.onLine && <p className="muted small">אין קליטה כרגע, אז הקבלה לא תישמר. ההוצאה עצמה כן תישמר.</p>}
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary" disabled={!description || !(n > 0) || !among.length || conv === null || !unevenOk}>הוספה</button>
    </form>
  );
}

/** דולרים שמרחפים ברקע */
function FloatingMoney() {
  if (reducedMotion()) return null;
  const items = ['💵', '💸', '🪙', '💰', '💵', '💖', '💵', '🪙', '💸', '💵', '✨', '💵'];
  return (
    <div className="floating-money" aria-hidden="true">
      {items.map((x, i) => (
        <span key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${(i * 1.7) % 12}s`, animationDuration: `${11 + (i % 5) * 2}s`, fontSize: `${1.2 + (i % 3) * .5}rem` }}>{x}</span>
      ))}
    </div>
  );
}
