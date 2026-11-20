import { FormEvent, useState } from 'react';
import { DESTINATIONS, GENERAL_TIPS, findDestination } from '../data/guide';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Tip } from '../lib/types';
import { fmtDate } from '../lib/util';
import { Who } from '../components/Avatar';

export default function Guide({ embedded }: { embedded?: boolean } = {}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string | null>(null); // slug או שם חופשי
  const tips = useTable<Tip>('destination_tips', { order: 'created_at' });

  const dest = active ? DESTINATIONS.find((d) => d.slug === active) : undefined;
  const freeName = active && !dest ? active : null;

  function search(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const d = findDestination(term);
    setActive(d ? d.slug : term);
  }

  const customNames = [...new Set(tips.rows.map((t) => t.destination).filter((n) => !DESTINATIONS.some((d) => d.slug === n)))];

  return (
    <div className="stack-lg">
      {embedded ? <p className="muted">כתבי מדינה, עיר או אתר ותקבלי דגשים: כניסה ואשרות, עונה, מה לא לפספס. אפשר גם להוסיף טיפים משלכן.</p> : (
        <div>
          <h1>מדריך יעדים</h1>
          <p className="muted">כתבי מדינה, עיר או אתר ותקבלי דגשים: כניסה ואשרות, עונה, מה לא לפספס. אפשר גם להוסיף טיפים משלכן.</p>
        </div>
      )}
      <form className="form-row" onSubmit={search}>
        <input id="guide-q" className="grow" placeholder="למשל: קוסקו, פטגוניה, בוליביה" value={q} onChange={(e) => setQ(e.target.value)} list="guide-list" />
        <datalist id="guide-list">{DESTINATIONS.map((d) => <option key={d.slug} value={d.name} />)}</datalist>
        <button className="btn btn-primary" disabled={!q.trim()}>חיפוש</button>
      </form>
      <div className="chips">
        {DESTINATIONS.map((d) => (
          <button key={d.slug} className={'chip' + (active === d.slug ? ' on' : '')} onClick={() => { setActive(d.slug); setQ(d.name); }}>{d.name}</button>
        ))}
        {customNames.map((n) => (
          <button key={n} className={'chip' + (active === n ? ' on' : '')} onClick={() => { setActive(n); setQ(n); }}>{n}</button>
        ))}
      </div>

      {dest && (
        <article className="card dest stack">
          <h2>{dest.name}</h2>
          <div className="dest-entry">
            <b>כניסה עם דרכון ישראלי</b>
            <p>{dest.entry}</p>
          </div>
          <div className="dest-grid">
            <div><h3>עונה (סביב דצמבר עד מרץ)</h3><p>{dest.season}</p></div>
            {dest.health && <div><h3>בריאות</h3><p>{dest.health}</p></div>}
            <div><h3>לא לפספס</h3><ul>{dest.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>
            <div><h3>דגשים</h3><ul>{dest.tips.map((h) => <li key={h}>{h}</li>)}</ul></div>
          </div>
          <p className="muted small">המידע כללי ונכתב מראש. דרישות כניסה משתנות, אז לבדוק באתר משרד החוץ ובאתר השגרירות לפני הטיסה.</p>
        </article>
      )}
      {freeName && (
        <div className="card">
          <h2>{freeName}</h2>
          <p className="muted">היעד הזה לא נמצא במדריך. אפשר להוסיף עליו טיפים כאן למטה, והם יישמרו לכולן.</p>
        </div>
      )}
      {active && <TipsBox destination={active} rows={tips.rows.filter((t) => t.destination === active)} reload={tips.reload} />}

      {!active && (
        <section className="stack">
          <h2>לפני שיוצאות</h2>
          <div className="grid-2">
            {GENERAL_TIPS.map((t) => (
              <div key={t.title} className="card"><h3>{t.title}</h3><p>{t.text}</p></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TipsBox({ destination, rows, reload }: { destination: string; rows: Tip[]; reload: () => void }) {
  const [text, setText] = useState('');
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('destination_tips').insert({ destination, content: text.trim() });
    setText(''); reload();
  }
  async function remove(id: string) {
    await supabase.from('destination_tips').delete().eq('id', id); reload();
  }
  return (
    <section className="stack">
      <h3>הטיפים שלנו</h3>
      {rows.length === 0 && <p className="muted small">עוד אין טיפים. שמעתן משהו ממטיילים אחרים? כתבו כאן.</p>}
      <ul className="stories">
        {rows.map((t) => (
          <li key={t.id}><p>{t.content}</p>
            <footer className="small muted"><Who id={t.created_by} /> · {fmtDate(t.created_at)} <button className="link-btn" onClick={() => remove(t.id)}>מחיקה</button></footer>
          </li>
        ))}
      </ul>
      <form className="form-row" onSubmit={add}>
        <input id="tip-text" className="grow" placeholder="טיפ חדש" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" disabled={!text.trim()}>הוספה</button>
      </form>
    </section>
  );
}
