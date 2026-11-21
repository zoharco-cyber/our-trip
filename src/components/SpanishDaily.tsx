import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite } from '../lib/offline';
import { confetti } from '../lib/fx';
import { WORDS, weekKey, weekWords, wordFor } from '../data/daily';
import type { QuizResult } from '../lib/types';
import { todayISO } from '../lib/util';

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('es')); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/** מילה בספרדית ליום, לדף הבית */
export function WordOfDay() {
  const w = wordFor(todayISO());
  return (
    <section className="word-day">
      <span className="wd-kicker">🗣️ המילה של היום</span>
      <div className="wd-row">
        <b dir="ltr" lang="es">{w.es}</b>
        {'speechSynthesis' in window && <button className="btn btn-small" onClick={() => speak(w.es)} aria-label="הקראה">🔊</button>}
      </div>
      <span>{w.he} <span className="muted small">· {w.say}</span></span>
    </section>
  );
}

// ערבוב קבוע לפי מחרוזת (כדי שכולן יקבלו את אותו חידון)
function seeded(seed: string) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return () => { h = (h * 1103515245 + 12345) | 0; return ((h >>> 0) % 10000) / 10000; };
}

/** חידון שבועי: 5 מילים מהשבוע האחרון. כל תשובה נכונה = 5 נקודות לטבלת האתגרים */
export function WeeklyQuiz() {
  const { me, travelers } = useAuth();
  const day = todayISO();
  const week = weekKey(day);
  const results = useTable<QuizResult>('quiz_results', { filter: (q) => q.eq('week', week) }, [week]);
  const mine = results.rows.find((r) => r.user_id === me?.id);
  const questions = useMemo(() => {
    const rnd = seeded(week);
    const pool = [...new Map(weekWords(day).map((w) => [w.es, w])).values()];
    return pool.slice(0, 5).map((w) => {
      const wrong = WORDS.filter((x) => x.es !== w.es).sort(() => rnd() - 0.5).slice(0, 3).map((x) => x.he);
      const opts = [w.he, ...wrong].sort(() => rnd() - 0.5);
      return { es: w.es, answer: w.he, opts };
    });
  }, [week]);
  const [i, setI] = useState(-1);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  async function choose(opt: string, e: React.MouseEvent) {
    if (picked) return;
    setPicked(opt);
    const ok = opt === questions[i].answer;
    const s = score + (ok ? 1 : 0);
    if (ok) confetti(e.clientX, e.clientY, 30, ['✨']);
    setTimeout(async () => {
      setPicked(null);
      if (i + 1 < questions.length) { setScore(s); setI(i + 1); }
      else {
        setScore(s); setI(questions.length);
        if (me) await dbWrite({ table: 'quiz_results', kind: 'upsert', values: { user_id: me.id, week, score: s }, onConflict: 'user_id,week' });
        results.reload();
      }
    }, 800);
  }

  const board = travelers.map((t) => ({ t, r: results.rows.find((x) => x.user_id === t.id) })).sort((a, b) => (b.r?.score ?? -1) - (a.r?.score ?? -1));
  return (
    <section className="card quiz">
      <div className="row-between"><b>🏆 החידון השבועי</b><span className="small muted">כל תשובה נכונה = 5 נקודות לאתגרים</span></div>
      {!me?.is_traveler ? null : mine || i === questions.length ? (
        <p className="quiz-done">ענית נכון על <b>{mine?.score ?? score}</b> מתוך {questions.length} השבוע {(mine?.score ?? score) >= 4 ? '🎉' : '💪'}. חידון חדש בשבוע הבא.</p>
      ) : i < 0 ? (
        <button className="btn btn-primary" onClick={() => setI(0)}>להתחיל ({questions.length} שאלות, פעם אחת בשבוע)</button>
      ) : (
        <div className="stack">
          <span className="small muted">שאלה {i + 1} מתוך {questions.length}</span>
          <b className="quiz-q" dir="ltr" lang="es">{questions[i].es}</b>
          <div className="quiz-opts">
            {questions[i].opts.map((o) => (
              <button key={o} className={'quiz-opt' + (picked ? (o === questions[i].answer ? ' right' : o === picked ? ' wrong' : '') : '')} onClick={(e) => choose(o, e)}>{o}</button>
            ))}
          </div>
        </div>
      )}
      <div className="quiz-board">
        {board.map(({ t, r }) => <span key={t.id} className="small" style={{ ['--c' as any]: t.color }}><i className="dot" /> {t.display_name.split(' ')[0]}: {r ? `${r.score}/5` : '—'}</span>)}
      </div>
    </section>
  );
}
