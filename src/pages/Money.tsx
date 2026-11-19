import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Money, useMoney } from '../lib/money';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Expense, Transfer } from '../lib/types';
import { EXPENSE_CATEGORIES } from '../config';
import { fmtDate, todayISO } from '../lib/util';
import { Who, Empty } from '../components/Avatar';

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
    if (e.paid_by in net) { net[e.paid_by] += Number(e.amount_usd); paid[e.paid_by] += Number(e.amount_usd); }
    among.forEach((id) => { net[id] -= part; share[id] += part; });
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
  const { rate, rateSource } = useMoney();
  const exp = useTable<Expense>('expenses', { order: 'spent_on', ascending: false });
  const tr = useTable<Transfer>('transfers', { order: 'created_at', ascending: false });
  const ids = travelers.map((t) => t.id);
  const { share, paid, debts } = useMemo(() => computeBalances(ids, exp.rows, tr.rows), [ids.join(), exp.rows, tr.rows]);

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
  async function settle(d: Debt) {
    await supabase.from('transfers').insert({ from_id: d.from, to_id: d.to, amount_usd: d.amount });
    tr.reload();
  }
  async function removeExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id); exp.reload();
  }
  async function removeTransfer(id: string) {
    await supabase.from('transfers').delete().eq('id', id); tr.reload();
  }

  const list = filter === 'all' ? exp.rows : exp.rows.filter((e) => e.paid_by === filter || e.split_among.includes(filter));

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>כסף</h1>
          <p className="muted">סך הכול הוצאות: <Money usd={total} /> · שער: ₪{rate.toFixed(2)} לדולר{rateSource === 'live' ? ' (עדכני)' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? 'סגירה' : 'הוצאה חדשה'}</button>
      </div>

      {showForm && <ExpenseForm onDone={() => { setShowForm(false); exp.reload(); }} />}

      <section className="stack">
        <h2>כמה נשאר לכל אחת</h2>
        <div className="grid-3">
          {travelers.map((t) => {
            const left = Number(t.initial_budget_usd) - share[t.id];
            const pct = t.initial_budget_usd > 0 ? Math.max(0, Math.min(100, (left / t.initial_budget_usd) * 100)) : 0;
            return (
              <div key={t.id} className="card budget-card" style={{ ['--c' as any]: t.color }}>
                <div className="row-between"><Who id={t.id} />{me?.id === t.id && (
                  <button className="link-btn" onClick={() => setEditBudget((v) => !v)}>עריכת סכום התחלתי</button>
                )}</div>
                <div className="budget-left"><span className="muted small">נשאר</span><Money usd={left} big /></div>
                <div className="bar"><i style={{ width: pct + '%' }} /></div>
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
                <button className="btn btn-small" onClick={() => settle(d)}>סימון כשולם</button>
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
                  <b>{e.description}</b>
                  <div className="muted small">{fmtDate(e.spent_on)} · {e.category} · שילמה <Who id={e.paid_by} /> · מתחלק בין {e.split_among.length}
                    {e.orig_currency === 'ILS' && <> · הוזן כ-₪{Number(e.orig_amount).toLocaleString('he-IL')}</>}
                  </div>
                </div>
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

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const { travelers, me } = useAuth();
  const { rate, usd, ils } = useMoney();
  const [description, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState<'USD' | 'ILS'>('USD');
  const [paidBy, setPaidBy] = useState(me?.is_traveler ? me.id : travelers[0]?.id || '');
  const [among, setAmong] = useState<string[]>(travelers.map((t) => t.id));
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState<string | null>(null);

  const n = Number(amount);
  const amountUsd = cur === 'USD' ? n : n / rate;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description || !(n > 0) || !among.length || !paidBy) return;
    const { error } = await supabase.from('expenses').insert({
      description, amount_usd: Math.round(amountUsd * 100) / 100, orig_amount: n, orig_currency: cur,
      paid_by: paidBy, split_among: among, category, spent_on: date,
    });
    if (error) setErr('ההוצאה לא נשמרה. בדקי את החיבור לאינטרנט ונסי שוב.');
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
        <div className="field"><span>מטבע</span><CurrencyToggle value={cur} onChange={setCur} /></div>
        <label className="field"><span>מי שילמה</span>
          <select id="exp-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {travelers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
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
      {n > 0 && <p className="muted small">{usd(amountUsd)} · {ils(amountUsd)} · {among.length ? `כל אחת: ${usd(amountUsd / among.length)} · ${ils(amountUsd / among.length)}` : 'בחרי לפחות אחת'}</p>}
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary" disabled={!description || !(n > 0) || !among.length}>הוספה</button>
    </form>
  );
}
