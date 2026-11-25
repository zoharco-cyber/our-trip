import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useMoney } from '../lib/money';
import { buzz } from '../lib/launch';
import { CODE_HINT, COUNTRIES, DIAL_MAX, SCENES, doneKey, enablePush, expChannel, isIOS, isStandalone, type StageState } from '../lib/experience';
import { Passport } from './LaunchShow';

/** הטלפון של כל בת בזמן "התדריך" */
export default function ExpPhone({ epoch, onFinish }: { epoch: number; onFinish: () => void }) {
  const { me, profiles, travelers } = useAuth();
  const [st, setSt] = useState<StageState | null>(null);
  const ch = useRef<ReturnType<typeof expChannel> | null>(null);
  const sentKey = (scene: number, key = '') => `trip:expSent:${epoch}:${scene}:${key}`;
  const [, force] = useState(0);
  const [fixing, setFixing] = useState(false);
  const wasSent = (scene: number, key = '') => { try { return !!localStorage.getItem(sentKey(scene, key)); } catch { return false; } };

  useEffect(() => {
    ch.current = expChannel((s) => { if (s.epoch === epoch) setSt(s); }, null, null);
    const test = (e: Event) => setSt((e as CustomEvent).detail);
    window.addEventListener('exp-test-state', test);
    const join = () => ch.current?.send({ type: 'broadcast', event: 'join', payload: { uid: me!.id } });
    const t = setInterval(join, 3000); setTimeout(join, 600);
    return () => { clearInterval(t); window.removeEventListener('exp-test-state', test); if (ch.current) supabase.removeChannel(ch.current); };
  }, [epoch, me?.id]);

  function send(scene: number, v: unknown, key = '') {
    ch.current?.send({ type: 'broadcast', event: 'ans', payload: { uid: me!.id, scene, key, v } });
    try { localStorage.setItem(sentKey(scene, key), JSON.stringify(v ?? true)); } catch { /* ignore */ }
    buzz(40); force((x) => x + 1);
  }
  // שליחה חוזרת כל כמה שניות עד שהמסך מאשר (אם הודעה הלכה לאיבוד)
  useEffect(() => {
    if (!st || !me) return;
    const raw = (() => { try { return localStorage.getItem(sentKey(st.scene)); } catch { return null; } })();
    if (raw && !st.answered.includes(me.id)) { const t = setTimeout(() => send(st.scene, JSON.parse(raw)), 2500); return () => clearTimeout(t); }
    // גם פריצה והפקדה בכספת: נשלחות שוב עד שהמסך מאשר
    for (const [key, list] of [['crack', 'cracked'], ['lock', 'locks']] as const) {
      const ack = (st.shared?.[list] as string[] | undefined) || [];
      if (SCENES[st.scene]?.kind === 'vault' && wasSent(st.scene, key) && !ack.includes(me.id)) { const t = setTimeout(() => send(st.scene, true, key), 2500); return () => clearTimeout(t); }
    }
  }, [st]);

  useEffect(() => {
    if (st && SCENES[st.scene]?.kind === 'done') {
      try { localStorage.setItem(doneKey(epoch), 'done'); } catch { /* ignore */ }
      const t = setTimeout(onFinish, 8600); return () => clearTimeout(t);
    }
  }, [st?.scene]);

  if (!me) return null;
  const meIdx = travelers.findIndex((t) => t.id === me.id);
  const first = (slug?: string) => profiles.find((p) => p.slug === slug)?.display_name.split(' ')[0] || '';
  const sc = st ? SCENES[st.scene] : SCENES[0];
  const mine = (slug?: string) => me.slug === slug;
  const sent = st ? wasSent(st.scene) || st.answered.includes(me.id) : false;
  const Look = ({ who, sub }: { who: string; sub?: string }) => (<><span className="xp-eye">👀</span><p className="xp-look">תסתכלי אצל <b>{who}</b><br />בטלפון</p>{sub && <span className="xp-small">{sub}</span>}</>);
  const Screen = () => (<><span className="xp-eye">📺</span><p className="xp-look">תסתכלי על<br /><b>המסך הגדול</b></p></>);
  const Sent = ({ text }: { text?: string }) => (<><span className="xp-eye">✅</span><p className="xp-look">{text || 'נשלח למסך!'}</p><span className="xp-small">תסתכלי על המסך הגדול</span></>);

  let body: JSX.Element;
  if (!st) body = (<><Passport g={{ id: me.id, name: me.display_name.split(' ')[0], color: me.color }} i={Math.max(0, meIdx)} stamped /><p className="xp-look">את בפנים ✅</p><span className="xp-small">מתחברת לסוכנות…</span></>);
  else switch (sc.kind) {
    case 'lobby': body = (<><Passport g={{ id: me.id, name: me.display_name.split(' ')[0], color: me.color }} i={Math.max(0, meIdx)} stamped /><p className="xp-look">את בפנים ✅</p><span className="xp-small">מחכות לשאר הסוכנות…</span>{isIOS() && !isStandalone() && <InstallHint />}</>); break;
    case 'recruit': body = <Screen />; break;
    case 'finger': body = sent ? <Sent text="זוהית ✓" /> : <Finger onDone={() => send(st.scene, true)} />; break;
    case 'hotline': body = sent ? <Sent text="הקו נבדק ✓" /> : <Hotline uid={me.id} onDone={(r) => send(st.scene, r)} />; break;
    case 'flight': case 'dest': {
      const val = st.shared?.val as any; const conf = (st.shared?.conf as Record<string, boolean>) || {};
      const label = val ? (sc.kind === 'flight' ? `${val.date.slice(8, 10)}.${val.date.slice(5, 7)}, בשעה ${val.time}` : `${val.city}, ${val.country}`) : '';
      if (mine(sc.who)) body = sent && !fixing ? (<><Sent /><button className="xp-skip" onClick={() => { try { localStorage.removeItem(sentKey(st.scene)); } catch { /* ignore */ } setFixing(true); }}>✏️ לתקן</button></>)
        : sc.kind === 'flight' ? <FlightPick onSend={(v) => { setFixing(false); send(st.scene, v); }} /> : <DestPick onSend={(v) => { setFixing(false); send(st.scene, v); }} />;
      else if (val && conf[me.id] === undefined) body = (<><p className="xp-q">{first(sc.who)} אומרת:</p><p className="xp-quote">{label}</p><p className="xp-q">נכון?</p>
        <div className="xp-yn"><button onClick={() => send(st.scene, true, 'c')}>✅ נכון</button><button onClick={() => send(st.scene, false, 'c')}>🤔 לא בטוח</button></div></>);
      else if (val) body = <Sent text={conf[me.id] ? 'אישרת ✓' : 'סימנת שלא בטוח 🤔'} />;
      else body = <Look who={first(sc.who)} sub={sc.kind === 'flight' ? 'היא קובעת את מועד ההמראה' : 'היא בוחרת את היעד הראשון'} />;
      break;
    }
    case 'vault': {
      const locks = (st.shared?.locks as string[]) || [];
      const all = st.joined.every((u) => locks.includes(u));
      const cracked = (st.shared?.cracked as string[]) || [];
      const code = ((st.shared?.codes as Record<string, number>) || {})[me.id];
      const allCracked = st.joined.every((u) => cracked.includes(u));
      if (!cracked.includes(me.id) && !wasSent(st.scene, 'crack') && code !== undefined) body = <Dial code={code} hint={CODE_HINT[me.slug] || ''} onMove={(v) => ch.current?.send({ type: 'broadcast', event: 'dial', payload: { uid: me.id, v } })} onCrack={() => send(st.scene, true, 'crack')} />;
      else if (!allCracked) body = (<><span className="xp-eye">🔓</span><p className="xp-look">פרצת! ✓</p><span className="xp-small">מחכות שכל החוגות ייפרצו</span></>);
      else if (!wasSent(st.scene, 'lock') && !locks.includes(me.id)) body = <VaultInput uid={me.id} onLock={() => send(st.scene, true, 'lock')} />;
      else if (mine(sc.who)) body = st.shared?.opened ? <Sent text="הכספת נפתחה!" /> : all
        ? (<><p className="xp-q">כולן הפקידו.<br />את שומרת הכספת.</p><button className="xp-go xp-huge" onClick={() => send(st.scene, true, 'open')}>💰 חשפי את הקופה</button></>)
        : (<><span className="xp-eye">💰</span><p className="xp-look">הפקדת ✓</p><span className="xp-small">מחכות לשאר, ואז את חושפת את הקופה</span></>);
      else body = all ? <Look who={first(sc.who)} sub="היא חושפת את הקופה" /> : (<><span className="xp-eye">💰</span><p className="xp-look">הפקדת ✓</p><span className="xp-small">הסכום נשאר סודי</span></>);
      break;
    }
    case 'likely': body = sent ? <Sent text="ההצבעה נשלחה" /> : (<><p className="xp-q">{sc.q}</p><div className="xp-vote">{travelers.map((t) => <button key={t.id} style={{ ['--c' as any]: t.color }} onClick={() => send(st.scene, t.id)}>{t.display_name.split(' ')[0]}{t.id === me.id ? ' (אני)' : ''}</button>)}</div></>); break;
    case 'spot': {
      const answer = st.shared?.spot as string | undefined;
      if (mine(sc.who)) body = answer ? <Sent /> : <TextAsk q={sc.q!} ph="התשובה שלך…" onSend={(v) => send(st.scene, v)} />;
      else if (mine(sc.about) && answer) body = wasSent(st.scene, 'c') ? <Sent text="נענה ✓" /> : (<><p className="xp-q">{first(sc.who)} ענתה:</p><p className="xp-quote">"{answer}"</p><p className="xp-q">צדקה?</p><div className="xp-yn"><button onClick={() => send(st.scene, true, 'c')}>✅ כן!</button><button onClick={() => send(st.scene, false, 'c')}>❌ ממש לא</button></div></>);
      else body = <Look who={first(sc.who)} sub={mine(sc.about) ? 'היא עונה עלייך 😏' : undefined} />;
      break;
    }
    case 'waiting': body = sent ? <Sent text="נשמר בחלומות שלך 🌠" /> : <TextAsk q={sc.q!} ph="למשל: לראות את מאצ׳ו פיצ׳ו בזריחה" onSend={async (v) => { await supabase.from('wishes').insert({ text: v, created_by: me.id }); send(st.scene, v); }} />; break;
    case 'forget': body = sent ? <Sent text="נוסף לתיק הקטן שלך ⭐" /> : <TextAsk q={sc.q!} ph="למשל: המטען של הטלפון" onSend={async (v) => { await supabase.from('bag_items').insert({ text: '⭐ ' + v, bag: 'small', user_id: me.id }); send(st.scene, v); }} />; break;
    case 'takeoff': body = (<><p className="xp-q">כולכן ביחד, בדיוק באותו רגע:</p><button className="xp-go xp-huge xp-plane" onClick={() => send(st.scene, Date.now())}>✈️ המראה</button>{(st.shared?.fail as number) > 0 && <p className="xp-warn">לא מסונכרנות! עוד פעם 😅</p>}</>); break;
    default: body = <SelfDestruct />;
  }
  return (
    <div className="xp" style={{ ['--c' as any]: me.color }}>
      <span className="xp-top" />
      <span className="xp-who">הסוכנת {me.display_name.split(' ')[0]}</span>
      {st && <div className="xp-dots">{SCENES.slice(1, -1).map((_, i) => <i key={i} className={i + 1 <= st.scene ? 'on' : ''} />)}</div>}
      <div className="xp-body" key={st ? st.scene : -1}>{body}</div>
    </div>
  );
}

function InstallHint() {
  return <p className="xp-hint">📲 חשוב: כדי לקבל התראות, הוסיפי את האתר למסך הבית (שיתוף ← "הוספה למסך הבית") ופתחי משם. נמשיך בדיוק מאותה נקודה.</p>;
}

function Finger({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  const t = useRef<number | null>(null);
  const start = () => { buzz(20); const t0 = Date.now() - p * 30; t.current = window.setInterval(() => { const v = Math.min(100, (Date.now() - t0) / 30); setP(v); if (v >= 100) { stop(); buzz([60, 40, 120]); onDone(); } }, 30); };
  const stop = () => { if (t.current) clearInterval(t.current); t.current = null; };
  useEffect(() => stop, []);
  return (<><p className="xp-q">כדי להצטרף למשימה:<br />לחצי והחזיקי</p>
    <button className="xp-finger" style={{ ['--p' as any]: p }} onPointerDown={start} onPointerUp={() => { stop(); if (p < 100) setP(0); }} onPointerLeave={() => { stop(); if (p < 100) setP(0); }} onContextMenu={(e) => e.preventDefault()}>
      <span>🫆</span></button>
    <span className="xp-small">{p > 0 && p < 100 ? 'סורקת…' : '3 שניות'}</span></>);
}

function Hotline({ uid, onDone }: { uid: string; onDone: (r: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<string | null>(null);
  const needInstall = isIOS() && !isStandalone();
  async function go() { setBusy(true); const res = await enablePush(uid); setBusy(false); setR(res); if (res === 'on') onDone('on'); }
  return (<><p className="xp-q">הסוכנות צריכה דרך להשיג אותך בכל מקום ביבשת</p>
    {needInstall ? <InstallHint /> : <button className="xp-go xp-huge" disabled={busy} onClick={go}>{busy ? '…' : '🔔 פתחי קו חם'}</button>}
    {r && r !== 'on' && <p className="xp-warn">{r === 'denied' ? 'ההתראות חסומות בהגדרות הטלפון. נסדר את זה אחר כך.' : 'לא הצליח כרגע.'}</p>}
    <button className="xp-skip" onClick={() => onDone(needInstall ? 'install' : r || 'skip')}>אחר כך</button></>);
}

function FlightPick({ onSend }: { onSend: (v: { date: string; time: string }) => void }) {
  const [date, setDate] = useState('2026-12-22');
  const [time, setTime] = useState('06:30');
  return (<><p className="xp-q">מתי ממריאות?</p>
    <label className="xp-field"><span>תאריך</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <label className="xp-field"><span>שעה</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
    <button className="xp-go" disabled={!date} onClick={() => onSend({ date, time: time || '00:00' })}>שליחה למסך ✦</button></>);
}

function DestPick({ onSend }: { onSend: (v: { country: string; city: string }) => void }) {
  const [c, setC] = useState('');
  const [city, setCity] = useState('');
  const def = COUNTRIES.find((x) => x.n === c);
  return (<><p className="xp-q">איפה נוחתות?</p>
    <div className="xp-countries">{COUNTRIES.map((x) => <button key={x.n} className={c === x.n ? 'on' : ''} onClick={() => setC(x.n)}>{x.n}</button>)}</div>
    {c && <label className="xp-field"><span>עיר</span><input value={city} placeholder={def?.city} onChange={(e) => setCity(e.target.value)} /></label>}
    <button className="xp-go" disabled={!c} onClick={() => onSend({ country: c, city: city.trim() || def?.city || '' })}>שליחה למסך ✦</button></>);
}

function VaultInput({ uid, onLock }: { uid: string; onLock: () => void }) {
  const { toUsd } = useMoney();
  const [n, setN] = useState('');
  const [cur, setCur] = useState<'USD' | 'ILS'>('USD');
  const [busy, setBusy] = useState(false);
  async function lock() {
    const usd = toUsd(Number(n), cur); if (!usd) return;
    setBusy(true);
    await supabase.from('profiles').update({ initial_budget_usd: Math.round(usd) }).eq('id', uid);
    setBusy(false); onLock();
  }
  return (<><span className="xp-eye">💰</span><p className="xp-q">כמה את מפקידה?<br /><small>התקציב שלך לטיול. סודי, רק הסכום המשותף ייחשף</small></p>
    <div className="xp-money"><input inputMode="decimal" value={n} onChange={(e) => setN(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
      <div className="xp-cur">{(['USD', 'ILS'] as const).map((k) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => setCur(k)}>{k === 'USD' ? '$' : '₪'}</button>)}</div></div>
    <button className="xp-go" disabled={!Number(n) || busy} onClick={lock}>💰 הפקדה בכספת</button>
    <span className="xp-small">אפשר לשנות אחר כך בעמוד הכסף</span></>);
}

function TextAsk({ q, ph, onSend }: { q: string; ph: string; onSend: (v: string) => void }) {
  const [v, setV] = useState('');
  return (<><p className="xp-q">{q}</p>
    <textarea className="xp-text" rows={3} value={v} placeholder={ph} maxLength={120} onChange={(e) => setV(e.target.value)} />
    <button className="xp-go" disabled={!v.trim()} onClick={() => onSend(v.trim())}>שליחה למסך ✦</button></>);
}

/** חוגת כספת: מסובבים באצבע, "חם/קר" לפי הקרבה, ומחזיקים שנייה על הספרה הנכונה */
function Dial({ code, hint, onMove, onCrack }: { code: number; hint: string; onMove: (v: number) => void; onCrack: () => void }) {
  const [v, setV] = useState(0);
  const [hold, setHold] = useState(0);
  const [late, setLate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ sent: 0, v: -1 });
  const done = useRef(false);
  const dist = Math.min(Math.abs(v - code), DIAL_MAX - Math.abs(v - code));
  const heat = Math.max(0, 1 - dist / 10); // 0 קר … 1 בדיוק
  useEffect(() => { const t = setTimeout(() => setLate(true), 40_000); return () => clearTimeout(t); }, []);
  // מחזיקה על הספרה הנכונה שנייה אחת = נפרץ
  useEffect(() => {
    if (dist !== 0 || done.current) { setHold(0); return; }
    buzz(25);
    const t0 = Date.now();
    const t = setInterval(() => { const p = Math.min(1, (Date.now() - t0) / 1000); setHold(p); if (p >= 1 && !done.current) { done.current = true; clearInterval(t); buzz([80, 40, 160]); onCrack(); } }, 50);
    return () => clearInterval(t);
  }, [dist === 0]);
  function at(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    const n = Math.round((((a + 90) % 360 + 360) % 360) / (360 / DIAL_MAX)) % DIAL_MAX;
    if (n !== v) { setV(n); if (Math.abs(n - code) <= 2) buzz(8); }
    const now = Date.now();
    if (n !== last.current.v && now - last.current.sent > 110) { last.current = { sent: now, v: n }; onMove(n); }
  }
  const lo = Math.max(0, code - 3), hi = Math.min(DIAL_MAX - 1, code + 3);
  return (<>
    <p className="xp-q">פצחי את החוגה שלך<br /><small>הספרה שלך: {hint}</small></p>
    <div ref={ref} className={'xp-dial' + (dist === 0 ? ' hit' : '')} style={{ ['--heat' as any]: heat, ['--hold' as any]: hold }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); at(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') at(e); }} onContextMenu={(e) => e.preventDefault()}>
      <div className="xp-dial-face" style={{ transform: `rotate(${-v * (360 / DIAL_MAX)}deg)` }}>
        {Array.from({ length: DIAL_MAX }, (_, n) => <span key={n} style={{ transform: `rotate(${(n * 360) / DIAL_MAX}deg)` }}><i className={n % 5 === 0 ? 'big' : ''} />{n % 5 === 0 && <b>{n}</b>}</span>)}
      </div>
      <span className="xp-dial-ptr">▼</span>
      <b className="xp-dial-num tnum">{String(v).padStart(2, '0')}</b>
    </div>
    <span className="xp-small">{dist === 0 ? 'החזיקי… 🔓' : heat > .7 ? '🔥 חם מאוד!' : heat > .3 ? '♨️ מתחמם' : '❄️ קר'}</span>
    {late && dist !== 0 && <span className="xp-hint">רמז: בין {lo} ל־{hi}</span>}
  </>);
}

/** "ההודעה הזאת תושמד": ספירה, שריפה, ומתחת לאפר — האפליקציה */
function SelfDestruct() {
  const [n, setN] = useState(5);
  useEffect(() => { const t = setInterval(() => setN((x) => { if (x <= 1) { clearInterval(t); buzz([300]); return 0; } buzz(40); return x - 1; }), 1000); return () => clearInterval(t); }, []);
  return (
    <div className={'xp-sd' + (n === 0 ? ' burn' : '')}>
      <div className="xp-sd-paper">
        <span className="xp-sd-stamp">TOP SECRET</span>
        <p className="xp-q">התדריך הושלם.</p>
        <p className="xp-sd-text">ההודעה הזאת תושמד בעוד</p>
        <b className="xp-sd-num tnum" key={n}>{n}</b>
        <span className="xp-small">ברוכה הבאה לאפליקציה 💖</span>
      </div>
      {n === 0 && <div className="xp-sd-fire">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.08}s` }} />)}</div>}
    </div>
  );
}
