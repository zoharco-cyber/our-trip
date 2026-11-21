import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fmtDateTime } from '../lib/util';
import { supabase } from '../lib/supabase';
import { OpenButton, useCapsuleOpen } from './Capsule';
import Reminder from '../components/Reminder';
import LetterReveal from '../components/LetterReveal';
import type { WelcomeLetter } from '../lib/types';

export default function Admin() {
  const { profiles, travelers, isAdmin, me } = useAuth();
  const { open, reload } = useCapsuleOpen();
  const [meta, setMeta] = useState<{ created_by: string; created_at: string }[]>([]);
  useEffect(() => {
    supabase.rpc('capsule_meta').then(({ data }) => { if (data) setMeta(data as any); });
  }, [open]);

  async function setOpen(v: boolean) {
    await supabase.from('settings').upsert({ key: 'capsule_open', value: v }); reload();
  }
  if (!me) return <p className="muted">טוען…</p>;
  if (!isAdmin) return <p className="muted">העמוד הזה רק למנהל.</p>;
  return (
    <div className="stack-lg narrow">
      <h1>ניהול</h1>
      <a href="#/features" className="card admin-link">📋 <b>הפיצ׳רים של הטיול</b><span className="small muted">כל פיצ׳ר ואיך משתמשים בו, עם סימון של מה כבר הסברת לבנות</span></a>
      <Reminder />
      <section className="card stack">
        <h2>קפסולת הזמן</h2>
        <p>{open ? 'הקפסולה פתוחה, וכל המטיילות רואות את כל המכתבים.' : 'הקפסולה סגורה. אף אחת לא יכולה לקרוא את המכתבים, גם לא את שלה.'}</p>
        {open ? <button className="btn" onClick={() => setOpen(false)}>סגירה מחדש</button> : <OpenButton onConfirm={() => setOpen(true)} />}
        <h3>מי כתבה ומתי</h3>
        <p className="muted small">רק לך, בלי התוכן. סך הכול {meta.length} מכתבים.</p>
        <div className="grid-3">
          {travelers.map((t) => {
            const mine = meta.filter((m) => m.created_by === t.id);
            return (
              <div key={t.id} className="capsule-meta" style={{ ['--c' as any]: t.color }}>
                <div className="row-between"><b><i className="dot" /> {t.display_name.split(' ')[0]}</b><span className="tnum">{mine.length} מכתבים</span></div>
                {mine.length === 0 ? <p className="muted small">עוד לא כתבה</p> : (
                  <ul className="meta-dates">{[...mine].reverse().map((m, i) => <li key={i} className="small tnum">{fmtDateTime(m.created_at)}</li>)}</ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <LaunchAdmin />
      <LettersAdmin />
      <TripEnd />
      <section className="card stack">
        <h2>ערכות עיצוב</h2>
        <p className="muted small">כל אחת רואה את האתר בערכה שלה. רק אתה יכול לשנות.</p>
        <ul className="pw-list">{profiles.map((t) => <ThemeRow key={t.id} id={t.id} name={t.display_name} color={t.color} theme={t.theme || 'pink'} />)}</ul>
      </section>
      <section className="card stack">
        <h2>מטיילות</h2>
        <p className="muted small">שינוי סיסמה: כותבים סיסמה חדשה (לפחות 6 תווים) ולוחצים שמירה. הסיסמה הישנה מפסיקה לעבוד מיד.</p>
        <ul className="pw-list">{profiles.map((t) => <PasswordRow key={t.id} id={t.id} name={t.display_name} color={t.color} />)}</ul>
      </section>
    </div>
  );
}

const WORDS = ['lama', 'condor', 'andes', 'tango', 'salsa', 'cusco', 'inca', 'sol', 'mango', 'luna', 'playa', 'cafe'];
const randomPw = () => WORDS[Math.floor(Math.random() * WORDS.length)] + String(1000 + Math.floor(Math.random() * 9000));

function PasswordRow({ id, name, color }: { id: string; name: string; color: string }) {
  const [pw, setPw] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [saved, setSaved] = useState('');
  async function save() {
    if (pw.trim().length < 6) return;
    setState('busy');
    const { data, error } = await supabase.functions.invoke('admin-set-password', { body: { userId: id, password: pw.trim() } });
    if (error || !data?.ok) { setState('err'); return; }
    setSaved(pw.trim()); setPw(''); setState('ok');
  }
  return (
    <li className="pw-row">
      <span className="pw-name"><i className="dot" style={{ ['--c' as any]: color }} /> {name}</span>
      <div className="row gap wrap">
        <input id={`pw-${id}`} dir="ltr" placeholder="סיסמה חדשה" value={pw} onChange={(e) => { setPw(e.target.value); setState('idle'); }} />
        <button type="button" className="btn btn-small" onClick={() => { setPw(randomPw()); setState('idle'); }}>🎲 אקראית</button>
        <button type="button" className="btn btn-small btn-primary" disabled={pw.trim().length < 6 || state === 'busy'} onClick={save}>{state === 'busy' ? 'שומר…' : 'שמירה'}</button>
      </div>
      {state === 'ok' && <p className="ok small">הסיסמה עודכנה. הסיסמה החדשה: <b dir="ltr">{saved}</b> (שלח לה אותה)</p>}
      {state === 'err' && <p className="error">לא הצלחתי לעדכן. בדוק חיבור לאינטרנט ונסה שוב.</p>}
    </li>
  );
}

const THEMES: { id: string; name: string; sw: string[] }[] = [
  { id: 'pink', name: 'ורוד נצנצים', sw: ['#ff4fa8', '#e0157f', '#a855f7'] },
  { id: 'red', name: 'אדום', sw: ['#ff4d5e', '#d61f3a', '#ff9f1c'] },
  { id: 'purple', name: 'סגול', sw: ['#9d5cff', '#7b2ff7', '#e05cff'] },
  { id: 'midnight', name: 'חצות', sw: ['#0b1026', '#4b63d8', '#ffd36b'] },
];

function ThemeRow({ id, name, color, theme }: { id: string; name: string; color: string; theme: string }) {
  const { reloadProfiles } = useAuth();
  const [cur, setCur] = useState(theme);
  const [err, setErr] = useState(false);
  async function pick(t: string) {
    setCur(t); setErr(false);
    const { error } = await supabase.from('profiles').update({ theme: t }).eq('id', id);
    if (error) { setErr(true); setCur(theme); } else reloadProfiles();
  }
  return (
    <li className="pw-row">
      <span className="pw-name"><i className="dot" style={{ ['--c' as any]: color }} /> {name}</span>
      <div className="theme-picks">
        {THEMES.map((t) => (
          <button key={t.id} type="button" className={'theme-pick' + (cur === t.id ? ' on' : '')} onClick={() => pick(t.id)} aria-pressed={cur === t.id}>
            <span className="sw">{t.sw.map((c) => <i key={c} style={{ background: c }} />)}</span>{t.name}
          </button>
        ))}
      </div>
      {err && <p className="error">לא נשמר. בדוק חיבור ונסה שוב.</p>}
    </li>
  );
}

function TripEnd() {
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'trip_end').maybeSingle().then(({ data }) => {
      if (data?.value) { setVal(data.value); setSaved(data.value); }
    });
  }, []);
  async function save() {
    const { error } = await supabase.from('settings').upsert({ key: 'trip_end', value: val || null });
    if (!error) setSaved(val || null);
  }
  return (
    <section className="card stack">
      <h2>סוף הטיול</h2>
      <p className="muted small">משמש לחישוב "כמה אפשר להוציא ליום" בעמוד הכסף. אפשר לשנות בכל רגע.</p>
      <div className="form-row">
        <input id="trip-end" type="date" value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn btn-primary" disabled={val === (saved || '')} onClick={save}>שמירה</button>
      </div>
      {saved && <p className="ok small">נשמר: {new Date(saved + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
    </section>
  );
}

/** מועד ההשקה וסיסמת האורחים */
function LaunchAdmin() {
  const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const [val, setVal] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [gpw, setGpw] = useState('');
  const [gState, setGState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [gSaved, setGSaved] = useState('');
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'launch_at').maybeSingle().then(({ data }) => {
      if (data?.value) { setVal(toLocal(data.value)); setSaved(data.value); }
    });
  }, []);
  async function save(v: string | null) {
    const value = v ? new Date(v).toISOString() : null;
    const { error } = await supabase.from('settings').upsert({ key: 'launch_at', value });
    if (!error) setSaved(value);
  }
  async function saveGuest() {
    if (gpw.trim().length < 6) return;
    setGState('busy');
    const { data, error } = await supabase.functions.invoke('admin-set-password', { body: { guest: true, password: gpw.trim() } });
    if (error || !data?.ok) { setGState('err'); return; }
    setGSaved(gpw.trim()); setGpw(''); setGState('ok');
  }
  const launched = !saved || new Date(saved).getTime() <= Date.now();
  return (
    <section className="card stack">
      <h2>🚀 ההשקה</h2>
      <p className="muted small">עד המועד הזה, מסך הכניסה מציג ספירה לאחור, ואורחים נכנסים רק עם סיסמה. אחרי המועד, כניסת אורחים פתוחה.</p>
      <p className={launched ? 'ok small' : 'small'}>{launched ? '✓ האתר הושק, אורחים נכנסים בלי סיסמה' : `🔒 נעול לאורחים עד ${new Date(saved!).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}</p>
      <div className="form-row">
        <input id="launch-at" type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} />
        <button className="btn btn-primary" disabled={!val} onClick={() => save(val)}>שמירה</button>
        {!launched && <button className="btn" onClick={() => { const n = toLocal(new Date().toISOString()); setVal(n); save(n); }}>להשיק עכשיו</button>}
      </div>
      <div className="field"><span>סיסמת אורחים (עד ההשקה)</span>
        <div className="row gap wrap">
          <input id="guest-pw-admin" dir="ltr" placeholder="סיסמה חדשה" value={gpw} onChange={(e) => { setGpw(e.target.value); setGState('idle'); }} style={{ flex: '1 1 140px', width: 'auto' }} />
          <button type="button" className="btn btn-small" onClick={() => { setGpw(randomPw()); setGState('idle'); }}>🎲 אקראית</button>
          <button type="button" className="btn btn-small btn-primary" disabled={gpw.trim().length < 6 || gState === 'busy'} onClick={saveGuest}>{gState === 'busy' ? 'שומר…' : 'שמירה'}</button>
        </div>
        {gState === 'ok' && <p className="ok small">עודכן. סיסמת האורחים החדשה: <b dir="ltr">{gSaved}</b></p>}
        {gState === 'err' && <p className="error">לא הצלחתי לעדכן. בדוק חיבור ונסה שוב.</p>}
      </div>
    </section>
  );
}

/** מכתבי הפתיחה: המנהל כותב מכתב סודי לכל אחת */
function LettersAdmin() {
  const { travelers } = useAuth();
  const [letters, setLetters] = useState<Record<string, WelcomeLetter>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  useEffect(() => {
    supabase.from('welcome_letters').select('*').then(({ data }) => {
      const m: Record<string, WelcomeLetter> = {};
      (data || []).forEach((l: any) => { m[l.user_id] = l; });
      setLetters(m);
      setDrafts(Object.fromEntries(Object.values(m).map((l) => [l.user_id, l.content])));
    });
  }, []);
  async function save(id: string) {
    const content = (drafts[id] || '').trim();
    if (!content) return;
    const { data, error } = await supabase.from('welcome_letters').upsert({ user_id: id, content, updated_at: new Date().toISOString() }).select().single();
    if (!error && data) { setLetters((m) => ({ ...m, [id]: data as WelcomeLetter })); setSaved(id); setTimeout(() => setSaved(null), 2000); }
  }
  async function resend(id: string) {
    const { data } = await supabase.from('welcome_letters').update({ opened_at: null }).eq('user_id', id).select().single();
    if (data) setLetters((m) => ({ ...m, [id]: data as WelcomeLetter }));
  }
  return (
    <section className="card stack">
      <h2>💌 מכתבי פתיחה</h2>
      <p className="muted small">מכתב סודי לכל אחת. הוא נפתח לה בהפקה מלאה בכניסה הראשונה אחרי ההשקה, ולא יכול להיפתח לפני. אף אחת לא רואה את המכתב של האחרות.</p>
      {travelers.map((t) => {
        const l = letters[t.id];
        const draft = drafts[t.id] ?? '';
        return (
          <div key={t.id} className="letter-edit" style={{ ['--c' as any]: t.color }}>
            <div className="row-between">
              <b><i className="dot" /> ל{t.display_name.split(' ')[0]}</b>
              <span className="small muted">{!l ? 'עוד לא נכתב' : l.opened_at ? `✓ נפתח ${new Date(l.opened_at).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '✉️ מחכה לה'}</span>
            </div>
            <textarea id={`letter-${t.id}`} rows={5} placeholder={`מה תרצה לכתוב ל${t.display_name.split(' ')[0]} לפני הטיול?`} value={draft} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} />
            <div className="row gap wrap">
              <button className="btn btn-small btn-primary" disabled={!draft.trim() || draft.trim() === l?.content} onClick={() => save(t.id)}>{saved === t.id ? '✓ נשמר' : 'שמירה'}</button>
              <button className="btn btn-small" disabled={!draft.trim()} onClick={() => setPreview({ name: t.display_name.split(' ')[0], text: draft.trim() })}>🎬 תצוגה מקדימה</button>
              {l?.opened_at && <button className="link-btn small" onClick={() => resend(t.id)}>להציג לה שוב בכניסה הבאה</button>}
            </div>
          </div>
        );
      })}
      {preview && <LetterReveal name={preview.name} text={preview.text} preview onClose={() => setPreview(null)} />}
    </section>
  );
}
