import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { confetti } from '../lib/fx';
import { makeSound, useLaunchAt } from '../lib/launch';
import { COUNTRIES, SCENES, expChannel, useExpSetting, type Answer, type StageState } from '../lib/experience';
import { FinalTen, Passport, Reveal, type Girl } from '../components/LaunchShow';

type Saved = { scene: number; joined: string[]; ans: Record<string, Record<string, any>> };
const k = (scene: number, key = '') => `${scene}${key ? ':' + key : ''}`;

function ShadowMan({ big }: { big?: boolean }) {
  return (
    <svg className={'xs-man' + (big ? ' big' : '')} viewBox="0 0 200 320" aria-hidden="true">
      <path fill="#050307" d="M40 70 Q100 52 160 70 L150 78 Q100 70 50 78 Z M62 72 Q66 30 100 28 Q134 30 138 72 Z M74 76 Q100 84 126 76 Q126 112 100 120 Q74 112 74 76 Z M100 116 L60 132 Q30 160 34 230 L42 320 L158 320 L166 230 Q170 160 140 132 Z" />
      <circle className="xs-eye" cx="90" cy="96" r="3" fill="#ff2d8a" /><circle className="xs-eye" cx="110" cy="96" r="3" fill="#ff2d8a" />
    </svg>
  );
}
function Typed({ text, speed = 45 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const t = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(t), x) : x + 1)), speed); return () => clearInterval(t); }, [text]);
  return <span>{text.slice(0, n)}<i className="xs-caret">▍</i></span>;
}

export default function ExpStage() {
  const { profiles, travelers, isAdmin, me } = useAuth();
  const exp = useExpSetting();
  const launchAt = useLaunchAt();
  const epoch = exp?.epoch || 0;
  const store = `trip:expStage:${epoch}`;
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'launch' | 'reveal' | 'exp'>('exp');
  const [now, setNow] = useState(Date.now());
  const [s, setS] = useState<Saved>({ scene: 0, joined: [], ans: {} });
  const [destInfo, setDestInfo] = useState<{ country: string; city: string } | null>(null);
  const [vaultTotal, setVaultTotal] = useState<number | null>(null);
  const sound = useRef<ReturnType<typeof makeSound> | null>(null);
  const ch = useRef<ReturnType<typeof expChannel> | null>(null);
  const sRef = useRef(s); sRef.current = s;
  const girls: Girl[] = useMemo(() => travelers.map((t) => ({ id: t.id, name: t.display_name.split(' ')[0], color: t.color })), [travelers]);
  const bySlug = (slug?: string) => profiles.find((p) => p.slug === slug);
  const nameOf = (id?: string) => profiles.find((p) => p.id === id)?.display_name.split(' ')[0] || '';
  const colorOf = (id?: string) => profiles.find((p) => p.id === id)?.color || '#fff';

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => { if (!epoch) return; try { const v = localStorage.getItem(store); if (v) setS(JSON.parse(v)); } catch { /* ignore */ } }, [epoch]);
  useEffect(() => { if (epoch) try { localStorage.setItem(store, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);

  const sc = SCENES[s.scene];
  const present = s.joined.filter((u) => travelers.some((t) => t.id === u));
  const A = (scene: number, key = '') => s.ans[k(scene, key)] || {};

  // ---- שידור מצב לטלפונים ----
  function shared(st: Saved) {
    const c = SCENES[st.scene]; const a = st.ans;
    if (c.kind === 'vault') return { locks: Object.keys(a[k(st.scene, 'lock')] || {}), opened: !!Object.keys(a[k(st.scene, 'open')] || {}).length };
    if (c.kind === 'spot') { const who = profiles.find((p) => p.slug === c.who)?.id; return { spot: who ? (a[k(st.scene)] || {})[who] : undefined }; }
    if (c.kind === 'takeoff') return { fail: (a[k(st.scene, 'fail')] || {}).n || 0 };
    return {};
  }
  function broadcast(st = sRef.current) {
    if (!ch.current || !epoch) return;
    const c = SCENES[st.scene];
    const answered = Object.keys(st.ans[k(st.scene, c.kind === 'vault' ? 'lock' : '')] || {});
    const payload: StageState = { epoch, scene: st.scene, joined: st.joined, answered, shared: shared(st) };
    ch.current.send({ type: 'broadcast', event: 'state', payload });
  }
  useEffect(() => {
    if (!epoch || !isAdmin) return;
    ch.current = expChannel(null, (a) => onAnswer(a), (uid) => setS((x) => (x.joined.includes(uid) ? x : (sound.current?.stamp(), { ...x, joined: [...x.joined, uid] }))));
    const t = setInterval(() => broadcast(), 2000);
    return () => { clearInterval(t); if (ch.current) supabase.removeChannel(ch.current); };
  }, [epoch, isAdmin, profiles.length]);
  useEffect(() => { broadcast(s); }, [s]);

  // ---- קבלת תשובה ----
  function onAnswerReal(a: Answer) { onAnswer(a); }
  function onAnswer(a: Answer) {
    setS((x) => {
      if (a.scene !== x.scene && !(a.key === 'c')) return x;
      const key = k(a.scene, a.key || '');
      if (x.ans[key]?.[a.uid] !== undefined && SCENES[a.scene].kind !== 'takeoff') return x;
      const ans = { ...x.ans, [key]: { ...(x.ans[key] || {}), [a.uid]: a.v } };
      const joined = x.joined.includes(a.uid) ? x.joined : [...x.joined, a.uid];
      sideEffects(a);
      return { ...x, ans, joined };
    });
  }
  function sideEffects(a: Answer) {
    const c = SCENES[a.scene];
    sound.current?.stamp();
    const i = girls.findIndex((g) => g.id === a.uid);
    if (c.kind !== 'takeoff') confetti(innerWidth * (0.2 + 0.3 * Math.max(0, i)), innerHeight * 0.7, 40, ['✦', '💖']);
    // תשובות של סימולציה (חזרה גנרלית) לא נשמרות בנתונים האמיתיים
    if (c.kind === 'flight' && !a.sim) saveFlight(a.v);
    if (c.kind === 'dest') { setDestInfo(a.v); if (!a.sim) saveDest(a.v); }
    if (c.kind === 'vault' && a.key === 'open') openVault(!!a.sim);
  }
  async function saveFlight(v: { date: string; time: string }) {
    const at = new Date(`${v.date}T${v.time || '00:00'}:00+02:00`).toISOString();
    const { data } = await supabase.from('events').select('id, title, starts_at').order('starts_at').limit(20);
    const ev = (data || []).find((e: any) => /טיסה|המראה/.test(e.title));
    if (ev) await supabase.from('events').update({ starts_at: at }).eq('id', ev.id);
    else await supabase.from('events').insert({ title: 'טיסה ראשונה ✈️', starts_at: at });
  }
  async function saveDest(v: { country: string; city: string }) {
    const c = COUNTRIES.find((x) => x.n === v.country);
    let lat = c?.lat, lng = c?.lng;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=he&q=${encodeURIComponent(`${v.city}, ${c?.c || v.country}`)}`);
      const j = await r.json(); if (j?.[0]) { lat = Number(j[0].lat); lng = Number(j[0].lon); }
    } catch { /* ignore */ }
    await supabase.from('settings').upsert({ key: 'first_destination', value: { country: v.country, city: v.city, lat, lng } });
  }
  async function openVault(sim: boolean) {
    const { data } = sim ? { data: [{ initial_budget_usd: 16500 }] } : await supabase.from('profiles').select('id, initial_budget_usd').eq('is_traveler', true);
    const total = (data || []).reduce((t: number, p: any) => t + Number(p.initial_budget_usd || 0), 0);
    setVaultTotal(total); sound.current?.boom();
    confetti(undefined, innerHeight / 2.5, 260, ['💰', '🪙', '💵', '✨']);
  }

  // ---- התקדמות אוטומטית ----
  const curAns = A(s.scene);
  useEffect(() => {
    if (!present.length) return;
    const all = present.every((u) => curAns[u] !== undefined);
    if ((sc.kind === 'finger' || sc.kind === 'hotline') && all) { const t = setTimeout(() => go(1), 2200); return () => clearTimeout(t); }
    if (sc.kind === 'takeoff') {
      const presses = present.map((u) => curAns[u]).filter((x) => typeof x === 'number') as number[];
      if (presses.length === present.length && !A(s.scene, 'ok')[me?.id || 'x']) {
        const ok = Math.max(...presses) - Math.min(...presses) <= 2000;
        if (ok) {
          setS((x) => ({ ...x, ans: { ...x.ans, [k(x.scene, 'ok')]: { [me?.id || 'x']: true } } }));
          sound.current?.boom(); confetti(undefined, undefined, 420);
          const t = setTimeout(() => go(1), 7000); return () => clearTimeout(t);
        }
        sound.current?.beat(0.2);
        setS((x) => ({ ...x, ans: { ...x.ans, [k(x.scene)]: {}, [k(x.scene, 'fail')]: { n: ((x.ans[k(x.scene, 'fail')] || {}).n || 0) + 1 } } }));
      }
    }
  }, [JSON.stringify(curAns), present.length, s.scene]);

  function go(d: number) {
    setS((x) => ({ ...x, scene: Math.max(0, Math.min(SCENES.length - 1, x.scene + d)) }));
    sound.current?.beat(0.3);
  }
  /** חזרה גנרלית: ממלא תשובות מדומות לכל מי שעוד לא ענתה */
  function simulate() {
    const onAnswer = (a: Answer) => onAnswerReal({ ...a, sim: true });
    const ids = girls.map((g) => g.id);
    setS((x) => ({ ...x, joined: Array.from(new Set([...x.joined, ...ids])) }));
    const c = SCENES[sRef.current.scene]; const sc0 = sRef.current.scene;
    const who = profiles.find((p) => p.slug === c.who)?.id; const about = profiles.find((p) => p.slug === c.about)?.id;
    const fake: Record<string, (id: string) => any> = {
      finger: () => true, hotline: () => 'on', likely: () => ids[Math.floor(Math.random() * ids.length)],
      waiting: (id) => ['לראות את מאצ׳ו פיצ׳ו בזריחה', 'לרקוד טנגו בבואנוס איירס', 'לישון במלון של מלח'][ids.indexOf(id) % 3],
      forget: (id) => ['המטען של הטלפון', 'הדרכון', 'כרית צוואר'][ids.indexOf(id) % 3], takeoff: () => Date.now(),
    };
    if (c.kind === 'flight' && who) onAnswer({ uid: who, scene: sc0, v: { date: '2026-12-22', time: '06:30' } });
    else if (c.kind === 'dest' && who) onAnswer({ uid: who, scene: sc0, v: { country: 'פרו', city: 'לימה' } });
    else if (c.kind === 'vault') {
      if (!Object.keys(A(sc0, 'lock')).length) ids.forEach((id) => onAnswer({ uid: id, scene: sc0, key: 'lock', v: true }));
      else if (who) onAnswer({ uid: who, scene: sc0, key: 'open', v: true });
    } else if (c.kind === 'spot' && who) {
      if (!A(sc0)[who]) onAnswer({ uid: who, scene: sc0, v: 'תשובה לדוגמה 😅' });
      else if (about) onAnswer({ uid: about, scene: sc0, key: 'c', v: true });
    } else if (fake[c.kind]) ids.forEach((id) => onAnswer({ uid: id, scene: sc0, v: fake[c.kind](id) }));
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowRight') go(-1);
      if (e.key === 's' || e.key === 'ד') simulate();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });

  async function start() {
    sound.current = makeSound(); sound.current.unlock();
    try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
    try { await (navigator as any).wakeLock?.request('screen'); } catch { /* ignore */ }
    if (launchAt && launchAt > Date.now() && s.scene === 0) setPhase('launch');
    setStarted(true);
  }

  if (!me) return <div className="xs xs-center"><p>טוען…</p></div>;
  if (!isAdmin) return <div className="xs xs-center"><p>המסך הזה למנהל בלבד.</p></div>;
  if (exp === undefined) return <div className="xs xs-center"><p>טוען…</p></div>;
  if (!exp?.active) return <div className="xs xs-center"><h1>החוויה כבויה</h1><p>מפעילים אותה בעמוד הניהול, ב"🎬 חוויית הפתיחה".</p><a className="xs-btn" href="#/admin">לעמוד הניהול</a></div>;
  if (!started) return (
    <div className="xs xs-center">
      <ShadowMan big />
      <h1>התדריך</h1>
      <p>{launchAt && launchAt > Date.now() ? `קודם הספירה להשקה (${new Date(launchAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}), ואז הלובי.` : 'הבנות שמתחברות עכשיו נכנסות ישר לחוויה.'}</p>
      <button className="xs-btn xs-go" onClick={start}>▶ התחלה (מסך מלא + סאונד)</button>
      <small>רווח / ← = הסצנה הבאה · → = אחורה · S = סימולציה של תשובות (לחזרה גנרלית)</small>
    </div>
  );

  // ---- ההשקה (ספירה + דרכונים) לפני הלובי ----
  if (phase === 'launch' && launchAt) {
    const left = Math.max(0, launchAt - now); const H = Math.floor(left / 36e5), M = Math.floor((left % 36e5) / 6e4), S = Math.floor((left % 6e4) / 1e3);
    return (
      <div className="stage stage-wait-wrap">
        <div className="stage-wait">
          <span className="stage-kicker">ההשקה הגדולה</span>
          {left > 10_500 && <div className="stage-clock tnum" dir="ltr">{H > 0 && <><b>{String(H).padStart(2, '0')}</b><i>:</i></>}<b>{String(M).padStart(2, '0')}</b><i>:</i><b key={S}>{String(S).padStart(2, '0')}</b></div>}
          <div className="stage-slots">{girls.map((g) => <span key={g.id} style={{ ['--c' as any]: g.color }}>{g.name}</span>)}</div>
        </div>
        <FinalTen at={launchAt} big sound={sound.current} onZero={() => setPhase('reveal')} />
      </div>
    );
  }
  if (phase === 'reveal') return <Reveal girls={girls} big sound={sound.current} onDone={() => setPhase('exp')} />;

  // ---- הסצנות ----
  const W = (slug?: string) => bySlug(slug);
  let view: JSX.Element;
  switch (sc.kind) {
    case 'lobby': view = (<><h1 className="xs-h">הסוכנות מתכנסות</h1>
      <div className="xs-cards">{girls.map((g, i) => <div key={g.id} className={'stage-card' + (s.joined.includes(g.id) ? ' in' : '')}><Passport g={g} i={i} stamped={s.joined.includes(g.id)} dim={!s.joined.includes(g.id)} /><span className="stage-tag">{s.joined.includes(g.id) ? 'בפנים ✓' : 'מתחברת…'}</span></div>)}</div>
      <p className="xs-sub">{present.length === girls.length ? 'כולן בפנים. ▶ רווח כדי להתחיל' : 'מתחברות עם השם והסיסמה בטלפון'}</p></>); break;
    case 'recruit': view = (<div className="xs-recruit"><ShadowMan big /><p className="xs-type"><Typed text={`${girls.map((g) => g.name).join('. ')}.\nנבחרתן למשימה המסווגת ביותר של השנה.\nיעד: דרום אמריקה.\nלפני שיוצאים לדרך, צריך תדריך.`} /></p></div>); break;
    case 'finger': view = (<><h1 className="xs-h">זיהוי ביומטרי</h1><div className="xs-row">{girls.map((g) => { const ok = curAns[g.id] !== undefined; return (
      <div key={g.id} className={'xs-fp' + (ok ? ' ok' : '')} style={{ ['--c' as any]: g.color }}><span className="xs-fp-ico">🫆</span><b>{g.name}</b><small>{ok ? 'אומתה ✓' : 'סורקת…'}</small></div>); })}</div>
      {present.length > 0 && present.every((u) => curAns[u] !== undefined) && <p className="xs-granted">ACCESS GRANTED</p>}</>); break;
    case 'hotline': view = (<><h1 className="xs-h">קו חם לסוכנות</h1><p className="xs-sub">הסוכנות צריכה דרך להשיג אתכן בכל מקום ביבשת</p><div className="xs-row">{girls.map((g) => { const v = curAns[g.id]; return (
      <div key={g.id} className={'xs-bell' + (v === 'on' ? ' on' : v ? ' warn' : '')} style={{ ['--c' as any]: g.color }}><span>{v === 'on' ? '🔔' : v ? '⚠️' : '🔕'}</span><b>{g.name}</b><small>{v === 'on' ? 'הקו פעיל' : v === 'install' ? 'צריך להתקין' : v ? 'אחר כך' : 'מחכה…'}</small></div>); })}</div></>); break;
    case 'flight': { const v = curAns[W(sc.who)?.id || ''] as { date: string; time: string } | undefined;
      const chars = v ? `${v.date.slice(8, 10)}.${v.date.slice(5, 7)} ${v.time}`.split('') : '--.-- --:--'.split('');
      view = (<><span className="xs-kick">פרטי המבצע · 1 / 3</span><h1 className="xs-h">מועד ההמראה, לפי <b style={{ color: W(sc.who)?.color }}>{nameOf(W(sc.who)?.id)}</b></h1>
        <div className="xs-board" dir="ltr">{chars.map((c, i) => c === '.' || c === ':' || c === ' ' ? <span key={i} className="xs-f sep">{c}</span> : <span key={i + c} className={'xs-f' + (v ? ' flip' : ' spin')} style={{ animationDelay: `${i * 90}ms` }}>{v ? c : '0'}</span>)}</div>
        <p className="xs-sub">{v ? `✈ TLV → ??? · ${v.date.slice(0, 4)}` : `${nameOf(W(sc.who)?.id)} בוחרת…`}</p></>); break; }
    case 'dest': { const v = curAns[W(sc.who)?.id || ''] as { country: string; city: string } | undefined;
      view = (<><span className="xs-kick">פרטי המבצע · 2 / 3</span><h1 className="xs-h">היעד הראשון, לפי <b style={{ color: W(sc.who)?.color }}>{nameOf(W(sc.who)?.id)}</b></h1>
        <div className={'xs-route' + (v ? ' go' : '')}><span className="xs-pt">TLV<small>ישראל</small></span><span className="xs-arc"><i>✈️</i></span><span className="xs-pt dst">{v ? v.city : '???'}<small>{v ? v.country : 'בוחרת…'}</small></span></div>
        {v && <p className="xs-stampline">📍 {v.city}, {v.country}</p>}</>); break; }
    case 'vault': { const locks = Object.keys(A(s.scene, 'lock')); const opened = Object.keys(A(s.scene, 'open')).length > 0;
      view = (<><span className="xs-kick">פרטי המבצע · 3 / 3</span><h1 className="xs-h">הכספת של <b style={{ color: W(sc.who)?.color }}>{nameOf(W(sc.who)?.id)}</b></h1>
        <div className={'xs-vault' + (opened ? ' open' : '')}><div className="xs-door"><span className="xs-dial" />
          <div className="xs-locks">{girls.map((g) => <span key={g.id} className={locks.includes(g.id) ? 'on' : ''} style={{ ['--c' as any]: g.color }}>{locks.includes(g.id) ? '🔒' : '🔓'}<small>{g.name}</small></span>)}</div></div>
          {opened && <div className="xs-total"><small>בקופה של שלושתכן</small><b className="tnum">${(vaultTotal ?? 0).toLocaleString('en-US')}</b></div>}</div>
        <p className="xs-sub">{opened ? 'הסכומים נשמרו בעמוד הכסף, כל אחת יכולה לעדכן' : locks.length < present.length ? 'כל אחת מקלידה בסוד את התקציב שלה' : `כל המנעולים סגורים. ${nameOf(W(sc.who)?.id)}, פתחי!`}</p></>); break; }
    case 'likely': { const votes = curAns as Record<string, string>; const n = Object.keys(votes).length; const done = present.length > 0 && present.every((u) => votes[u]);
      const count = (id: string) => Object.values(votes).filter((v) => v === id).length; const max = Math.max(0, ...girls.map((g) => count(g.id)));
      view = (<><span className="xs-kick">מי הכי סביר ש…</span><h1 className="xs-h">{sc.q}</h1>
        <div className="xs-row">{girls.map((g) => <div key={g.id} className={'xs-cand' + (done && count(g.id) === max ? ' win' : '')} style={{ ['--c' as any]: g.color }}>
          <span className="xs-av">{g.name[0]}</span><b>{g.name}</b><div className="xs-dots">{Object.entries(votes).filter(([, v]) => v === g.id).map(([u]) => <i key={u} style={{ background: colorOf(u) }} />)}</div>
          {done && count(g.id) === max && <span className="xs-crown">👑</span>}</div>)}</div>
        <p className="xs-sub">{done ? '🥁 התוצאות!' : `${n} / ${present.length} הצביעו`}</p></>); break; }
    case 'spot': { const wid = W(sc.who)?.id || ''; const aid = W(sc.about)?.id || ''; const ans = curAns[wid] as string | undefined; const conf = A(s.scene, 'c')[aid];
      view = (<><span className="xs-kick">זרקור · {nameOf(wid)}</span><h1 className="xs-h">{sc.q}</h1>
        <div className="xs-spot" style={{ ['--c' as any]: colorOf(wid) }}>{ans ? <p className="xs-quote"><Typed text={`"${ans}"`} speed={55} /></p> : <p className="xs-sub">{nameOf(wid)} כותבת…</p>}</div>
        {conf !== undefined && <span className={'xs-verdict ' + (conf ? 'yes' : 'no')}>{conf ? `✅ ${nameOf(aid)}: צדקה!` : `❌ ${nameOf(aid)}: ממש לא`}</span>}
        {ans && conf === undefined && <p className="xs-sub">{nameOf(aid)}, צדקה?</p>}</>); break; }
    case 'waiting': view = (<><h1 className="xs-h">למה הכי מחכות?</h1><div className="xs-stars">{girls.map((g) => curAns[g.id] ? <div key={g.id} className="xs-star" style={{ ['--c' as any]: g.color }}><b>{g.name}</b><p>{curAns[g.id]}</p></div> : <div key={g.id} className="xs-star empty" style={{ ['--c' as any]: g.color }}><b>{g.name}</b><p>כותבת…</p></div>)}</div><p className="xs-sub">🌠 נשמר בחלומות</p></>); break;
    case 'forget': view = (<><h1 className="xs-h">החפץ שאסור לשכוח</h1><div className="xs-row">{girls.map((g) => <div key={g.id} className={'xs-bag' + (curAns[g.id] ? ' in' : '')} style={{ ['--c' as any]: g.color }}><span className="xs-item">{curAns[g.id] || ''}</span><span className="xs-pack">🎒</span><b>{g.name}</b></div>)}</div><p className="xs-sub">⭐ נוסף לתיק הקטן של כל אחת</p></>); break;
    case 'takeoff': { const ok = !!Object.keys(A(s.scene, 'ok')).length; const fails = (A(s.scene, 'fail') as any).n || 0;
      view = ok ? (<div className="xs-lift"><span className="xs-plane-go">✈️</span><h1 className="xs-h">ההמראה הצליחה!</h1></div>) : (<><h1 className="xs-h">התדריך הושלם.</h1><p className="xs-sub big">כל מה שנשאר: להמריא. לחצו ביחד, באותו רגע.</p>
        <div className="xs-row">{girls.map((g) => <span key={g.id} className={'xs-press' + (curAns[g.id] ? ' on' : '')} style={{ ['--c' as any]: g.color }}>{g.name}</span>)}</div>
        {fails > 0 && <p className="xs-warn">לא מסונכרנות! עוד פעם 😅 ({fails})</p>}</>); break; }
    default: { const f = A(SCENES.findIndex((x) => x.kind === 'flight'))[W('t1')?.id || ''] as any; const d = A(SCENES.findIndex((x) => x.kind === 'dest'))[W('t2')?.id || ''] as any || destInfo;
      const wi = SCENES.findIndex((x) => x.kind === 'waiting'), fo = SCENES.findIndex((x) => x.kind === 'forget');
      const days = f ? Math.max(0, Math.ceil((new Date(`${f.date}T${f.time}:00+02:00`).getTime() - now) / 864e5)) : null;
      view = (<div className="xs-sum"><h1 className="xs-h">המשימה מתחילה 💖</h1>
        <div className="xs-sum-grid">
          <div><small>המראה</small><b>{f ? `${f.date.slice(8, 10)}.${f.date.slice(5, 7)} · ${f.time}` : '—'}</b></div>
          <div><small>יעד ראשון</small><b>{d ? `${d.city}, ${d.country}` : '—'}</b></div>
          <div><small>בקופה</small><b>{vaultTotal != null ? `$${vaultTotal.toLocaleString('en-US')}` : '—'}</b></div>
          <div className="xs-days"><small>ימים להמראה</small><b className="tnum">{days ?? '—'}</b></div>
        </div>
        <div className="xs-sum-list">{girls.map((g) => <div key={g.id} style={{ ['--c' as any]: g.color }}><b>{g.name}</b><span>🌠 {A(wi)[g.id] || '—'}</span><span>🎒 {A(fo)[g.id] || '—'}</span></div>)}</div>
      </div>); }
  }

  return (
    <div className={'xs xs-' + sc.kind}>
      <div className="xs-hud"><span>MISSION · SOUTH AMERICA</span><div className="xs-prog">{SCENES.slice(1, -1).map((_, i) => <i key={i} className={i + 1 <= s.scene ? 'on' : ''} />)}</div><span>CLASSIFIED</span></div>
      <div className="xs-stage" key={s.scene}>{view}</div>
      <div className="xs-agents">{girls.map((g) => <span key={g.id} className={present.includes(g.id) ? 'on' : ''} style={{ ['--c' as any]: g.color }}>{g.name}</span>)}</div>
      <div className="xs-ctl"><button onClick={() => go(-1)}>→</button><span>{s.scene} · {sc.title}</span><button onClick={() => go(1)}>←</button><button onClick={simulate} title="חזרה גנרלית">סימולציה</button></div>
    </div>
  );
}
