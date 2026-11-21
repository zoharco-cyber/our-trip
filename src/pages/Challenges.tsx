import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Challenge, ChallengeDone, QuizResult } from '../lib/types';
import { confetti } from '../lib/fx';

/** איש הצללים: דמות בכובע ומעיל, מצוירת ב-SVG */
function ShadowMan() {
  return (
    <svg className="shadow-man" viewBox="0 0 200 320" aria-hidden="true">
      <defs>
        <radialGradient id="sm-glow" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#ff2d8a" stopOpacity=".35" /><stop offset="1" stopColor="#ff2d8a" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="100" cy="150" rx="100" ry="150" fill="url(#sm-glow)" />
      <path fill="#050307" d="M40 70 Q100 52 160 70 L150 78 Q100 70 50 78 Z M62 72 Q66 30 100 28 Q134 30 138 72 Z" />
      <path fill="#050307" d="M74 76 Q100 84 126 76 Q126 112 100 120 Q74 112 74 76 Z" />
      <path fill="#050307" d="M100 116 L60 132 Q30 160 34 230 L42 320 L158 320 L166 230 Q170 160 140 132 Z" />
      <path fill="#1a0f1c" d="M100 120 L86 132 L100 210 L114 132 Z" />
      <circle cx="90" cy="96" r="2.4" fill="#ff2d8a"><animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.9;.95;1" dur="4s" repeatCount="indefinite" /></circle>
      <circle cx="110" cy="96" r="2.4" fill="#ff2d8a"><animate attributeName="opacity" values="1;1;0;1" keyTimes="0;.9;.95;1" dur="4s" repeatCount="indefinite" /></circle>
    </svg>
  );
}

export default function Challenges() {
  const { me, isAdmin, travelers, nameOf, colorOf } = useAuth();
  const ch = useTable<Challenge>('challenges', { order: 'points' });
  const done = useTable<ChallengeDone>('challenge_done');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [points, setPoints] = useState('10');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');
  const [q, setQ] = useState('');

  const isDone = (c: string, u: string) => done.rows.some((d) => d.challenge_id === c && d.user_id === u);
  const quiz = useTable<QuizResult>('quiz_results');
  // נקודות: אתגרים + חידון הספרדית השבועי (5 לכל תשובה נכונה)
  const score = (u: string) => done.rows.filter((d) => d.user_id === u).reduce((s, d) => s + (ch.rows.find((c) => c.id === d.challenge_id)?.points || 0), 0)
    + quiz.rows.filter((q) => q.user_id === u).reduce((s, q) => s + q.score * 5, 0);
  const board = [...travelers].sort((a, b) => score(b.id) - score(a.id));

  async function toggle(c: Challenge, e: React.MouseEvent) {
    if (!me) return;
    if (isDone(c.id, me.id)) {
      done.setRows((r) => r.filter((d) => !(d.challenge_id === c.id && d.user_id === me.id)));
      await supabase.from('challenge_done').delete().eq('challenge_id', c.id).eq('user_id', me.id);
    } else {
      done.setRows((r) => [...r, { challenge_id: c.id, user_id: me.id, note: null, created_at: new Date().toISOString() }]);
      confetti(e.clientX, e.clientY, 70, ['🕵️', '⭐', '💀', '✨']);
      await supabase.from('challenge_done').insert({ challenge_id: c.id });
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from('challenges').insert({ title: title.trim(), details: details.trim() || null, points: Math.max(1, Number(points) || 10) });
    setTitle(''); setDetails(''); setPoints('10'); ch.reload();
  }
  async function remove(id: string) { await supabase.from('challenges').delete().eq('id', id); ch.reload(); }

  return (
    <div className="shadow-page">
      <div className="fog" aria-hidden="true" />
      <header className="shadow-head">
        <ShadowMan />
        <div>
          <p className="shadow-kicker">תיק מסווג · לעיני המטיילות בלבד</p>
          <h1 className="shadow-title">האתגרים של זוהר</h1>
          <p className="shadow-sub">מישהו צופה בכן מהצללים. כל משימה שתבצעו תירשם בתיק.<br />אל תאכזבו אותו.</p>
        </div>
      </header>

      <section className="shadow-board">
        <h2>טבלת המובילות</h2>
        <ol>
          {board.map((t, i) => (
            <li key={t.id} style={{ ['--c' as any]: t.color }}>
              <span className="sb-rank">{i + 1}</span>
              <span className="sb-name">{t.display_name.split(' ')[0]}</span>
              <span className="sb-pts">{score(t.id)} נק׳</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="shadow-filters">
        <div className="sh-seg" role="group" aria-label="סינון">
          {([['open', 'מחכים לי'], ['done', 'ביצעתי'], ['all', 'הכול']] as const).map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input id="ch-q" className="sh-search" placeholder="חיפוש: לאמה, בוליביה, טנגו…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="sh-count">{ch.rows.length} תיקים · {ch.rows.reduce((s, c) => s + c.points, 0)} נק׳ בסך הכול</span>
      </div>

      <ul className="dossiers">
        {ch.rows.map((c, i) => ({ c, i })).filter(({ c }) => {
          const d = !!me && isDone(c.id, me.id);
          if (me?.is_traveler && filter === 'open' && d) return false;
          if (me?.is_traveler && filter === 'done' && !d) return false;
          const t = q.trim();
          return !t || c.title.includes(t) || (c.details || '').includes(t);
        }).map(({ c, i }) => {
          const mine = !!me && isDone(c.id, me.id);
          return (
            <li key={c.id} className={'dossier' + (mine ? ' done' : '')}>
              <div className="dos-top">
                <span className="dos-no">תיק #{String(i + 1).padStart(3, '0')}</span>
                <span className="dos-pts">{c.points} נק׳</span>
              </div>
              <b className="dos-title">{c.title}</b>
              {c.details && <p className="dos-details">{c.details}</p>}
              <div className="dos-foot">
                <span className="dos-who">
                  {travelers.map((t) => <i key={t.id} className={'dot' + (isDone(c.id, t.id) ? '' : ' off')} title={nameOf(t.id)} style={{ ['--c' as any]: colorOf(t.id) }} />)}
                </span>
                {me?.is_traveler && <button className="dos-btn" onClick={(e) => toggle(c, e)}>{mine ? 'ביטול' : 'בוצע'}</button>}
                {isAdmin && <button className="dos-del" onClick={() => remove(c.id)} aria-label="מחיקת האתגר">×</button>}
              </div>
              {mine && <span className="dos-stamp">בוצע</span>}
            </li>
          );
        })}
      </ul>

      {isAdmin && (
        <form className="shadow-form" onSubmit={add}>
          <h2>משימה חדשה מהצללים</h2>
          <input id="ch-title" placeholder="המשימה" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input id="ch-details" placeholder="פרטים (לא חובה)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="row gap"><input id="ch-points" type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: '6rem' }} /><span>נקודות</span>
            <button className="dos-btn" disabled={!title.trim()}>שליחה לתיק</button></div>
        </form>
      )}
    </div>
  );
}
