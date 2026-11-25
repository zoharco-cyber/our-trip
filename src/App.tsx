import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from './lib/auth';
import { isConfigured, supabase } from './lib/supabase';
import Login from './pages/Login';
import Home from './pages/Home';
import { LOGO_URL } from './config';
import { LetterProvider } from './components/MyLetter';
import { onQueueChange, readQueue, startQueueSync } from './lib/offline';
import { LOW, setSaverPref, useSaver, type SaverPref } from './lib/saver';
import { postStatus } from './components/Status';
import { deviceLabel } from './lib/health';
import { ErrorBoundary, ReportProblem } from './components/Problems';
import PinGate from './components/PinGate';

// כל עמוד נטען רק כשנכנסים אליו
const MoneyPage = lazy(() => import('./pages/Money'));
const Stage = lazy(() => import('./pages/Stage'));
const Shopping = lazy(() => import('./pages/Shopping'));
const Wishes = lazy(() => import('./pages/Wishes'));
const Documents = lazy(() => import('./pages/Documents'));
const Capsule = lazy(() => import('./pages/Capsule'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Gear = lazy(() => import('./pages/Gear'));
const Admin = lazy(() => import('./pages/Admin'));
const Journal = lazy(() => import('./pages/Journal'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Help = lazy(() => import('./pages/Help'));
const Challenges = lazy(() => import('./pages/Challenges'));
const Book = lazy(() => import('./pages/Book'));
const Songs = lazy(() => import('./pages/Songs'));
const Meds = lazy(() => import('./pages/Meds'));
const Wifi = lazy(() => import('./pages/Wifi'));
const PreTrip = lazy(() => import('./pages/PreTrip'));
const Medical = lazy(() => import('./pages/Medical'));
const Badges = lazy(() => import('./pages/Badges'));
const Features = lazy(() => import('./pages/Features'));

export const SECTIONS = [
  { to: '/', icon: '🏠', label: 'בית', short: 'בית', guest: true },
  { to: '/pretrip', icon: '✈️', label: 'לפני הטיסה', short: 'טיסה' },
  { to: '/money', icon: '💸', label: 'כסף', short: 'כסף' },
  { to: '/map', icon: '🗺️', label: 'מפה', short: 'מפה', guest: true },
  { to: '/shopping', icon: '🛒', label: 'קניות לשבוע', short: 'קניות' },
  { to: '/wishes', icon: '🌠', label: 'חלומות', short: 'חלומות' },
  { to: '/gallery', icon: '📸', label: 'גלריה', short: 'גלריה', guest: true },
  { to: '/docs', icon: '📂', label: 'מסמכים', short: 'מסמכים' },
  { to: '/gear', icon: '🎒', label: 'ציוד', short: 'ציוד' },
  { to: '/journal', icon: '📔', label: 'יומן', short: 'יומן' },
  { to: '/bookings', icon: '🎫', label: 'הזמנות', short: 'הזמנות' },
  { to: '/help', icon: '🆘', label: 'עזרה בדרך', short: 'עזרה' },
  { to: '/challenges', icon: '🕵️', label: 'האתגרים של זוהר', short: 'אתגרים' },
  { to: '/songs', icon: '🎵', label: 'שירי הטיול', short: 'שירים', guest: true },
  { to: '/badges', icon: '🏅', label: 'תגים', short: 'תגים' },
  { to: '/medical', icon: '🩺', label: 'כרטיס חירום', short: 'חירום' },
  { to: '/wifi', icon: '🔐', label: 'סיסמאות', short: 'סיסמאות' },
  { to: '/meds', icon: '💊', label: 'תרופות', short: 'תרופות' },
  { to: '/capsule', icon: '💌', label: 'קפסולת זמן', short: 'קפסולה' },
  { to: '/book', icon: '📖', label: 'ספר הטיול', short: 'ספר' },
];

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}


export default function App() {
  const { ready, session, guest, me, isAdmin, signOut } = useAuth();
  const online = useOnline();
  const [queued, setQueued] = useState(() => readQueue().length);
  useEffect(() => startQueueSync(), []);
  // ערכת העיצוב של מי שמחוברת (המנהל קובע). מסך הכניסה ואורחים: ורוד
  const saver = useSaver();
  const baseSkin = guest ? 'guest-sky' : session && me?.theme ? me.theme : 'pink';
  // במצב חיסכון: הערכה הכהה (מסך כהה חוסך סוללה במסכי OLED)
  const skin = saver.active && session && !guest ? 'midnight' : baseSkin;
  // נטענה מעל הסף: הפס של "סוללה חלשה" יחזור בפעם הבאה שתרד
  useEffect(() => { if (!saver.low) try { sessionStorage.removeItem('trip:lowbat'); } catch { /* ignore */ } }, [saver.low]);
  useEffect(() => {
    if (skin === 'pink') delete document.documentElement.dataset.skin;
    else document.documentElement.dataset.skin = skin;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ({ pink: '#e0157f', red: '#d61f3a', purple: '#7b2ff7', midnight: '#0b1026', 'guest-sky': '#1f7fb8' } as Record<string, string>)[skin] || '#e0157f');
  }, [skin]);
  useEffect(() => onQueueChange(() => setQueued(readQueue().length)), []);
  // "נראתה לאחרונה" לבדיקת המערכת של המנהל (פעם ב-10 דקות לכל היותר, ורק כשיש קליטה)
  useEffect(() => {
    if (!me?.id || !online) return;
    const touch = () => {
      if (document.visibilityState !== 'visible') return;
      let last = 0; try { last = Number(localStorage.getItem('trip:seen')) || 0; } catch { /* ignore */ }
      if (Date.now() - last < 10 * 60e3) return;
      try { localStorage.setItem('trip:seen', String(Date.now())); } catch { /* ignore */ }
      supabase.rpc('touch_seen', { device: deviceLabel() }).then(() => {}, () => {});
    };
    touch();
    document.addEventListener('visibilitychange', touch);
    return () => document.removeEventListener('visibilitychange', touch);
  }, [me?.id, online]);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); countVisit(pathname); }, [pathname]);

  if (!isConfigured) return <SetupNeeded />;
  if (!ready) return <div className="splash">רגע…</div>;
  // מסך הבמה של ההשקה: פתוח לכולם, בלי התחברות ובלי תפריטים
  if (pathname === '/stage') return <Suspense fallback={<div className="splash">…</div>}><Stage /></Suspense>;
  if (!session && !guest) return <Login />;

  const sections = SECTIONS.filter((s) => !guest || s.guest);
  const primary = guest ? sections : sections.filter((s) => ['/', '/money', '/map', '/shopping'].includes(s.to));

  return (
    <LetterProvider>
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand"><img className="brand-logo" src={LOGO_URL} alt="" />הטיול שלנו</NavLink>
          <nav className="topnav" aria-label="ניווט ראשי">
            {sections.map((s) => (
              <NavLink key={s.to} to={s.to} end={s.to === '/'}>{s.label}</NavLink>
            ))}
            {isAdmin && <NavLink to="/admin">ניהול</NavLink>}
          </nav>
          <div className="who">
            {guest ? <span className="pill">אורח/ת</span> : me && (
              <span className="pill" style={{ ['--c' as any]: me.color }}><i className="dot" />{me.display_name.split(' ')[0]}</span>
            )}
            <button className="link-btn" onClick={signOut}>{guest ? 'כניסה' : 'יציאה'}</button>
          </div>
        </div>
      </header>
      {!online && <div className="offline-bar">אין קליטה כרגע. אפשר להמשיך להוסיף הוצאות, קניות, יומן ועוד. הכול יישלח לבד כשהקליטה תחזור.</div>}
      {me?.is_traveler && saver.low && <LowBattery level={saver.battery.level} saverOn={saver.active} />}
      {queued > 0 && <div className="queue-bar">⏳ {queued} {queued === 1 ? 'שינוי מחכה' : 'שינויים מחכים'} לשליחה{online ? '… שולחת עכשיו' : ' עד שתחזור קליטה'}</div>}
      <main className="page" ref={mainRef}>
        <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<div className="page-loading" aria-label="טוען">✨</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/songs" element={<Songs />} />
          {!guest && <>
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/wishes" element={<Wishes />} />
            <Route path="/docs" element={<PinGate what="המסמכים"><Documents /></PinGate>} />
            <Route path="/gear" element={<Gear />} />
            <Route path="/guide" element={<Navigate to="/help" replace />} />
            <Route path="/capsule" element={<Capsule />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/book" element={<Book />} />
            <Route path="/meds" element={<Meds />} />
            <Route path="/wifi" element={<PinGate what="הסיסמאות"><Wifi /></PinGate>} />
            <Route path="/pretrip" element={<PreTrip />} />
            <Route path="/medical" element={<Medical />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/more" element={<MoreSheet />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/features" element={<Features />} />
          </>}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <nav className="bottomnav" aria-label="ניווט מהיר">
        {primary.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.to === '/'}>{s.short}</NavLink>
        ))}
        {!guest && <NavLink to="/more">עוד</NavLink>}
      </nav>
    </div>
    </LetterProvider>
  );
}

// כמה פעמים כל אחת נכנסה לכל עמוד (רק בטלפון שלה), בשביל "הכי בשימוש אצלך"
const VISITS = 'trip:visits';
function readVisits(): Record<string, number> { try { return JSON.parse(localStorage.getItem(VISITS) || '{}'); } catch { return {}; } }
function countVisit(path: string) {
  if (path === '/more' || path === '/') return;
  const v = readVisits(); v[path] = (v[path] || 0) + 1;
  try { localStorage.setItem(VISITS, JSON.stringify(v)); } catch { /* ignore */ }
}

const PRIMARY = ['/', '/money', '/map', '/shopping'];
const GROUPS: { title: string; items: string[] }[] = [
  { title: '🧭 בדרך', items: ['/help', '/bookings', '/wifi', '/pretrip', '/gear'] },
  { title: '💼 סידורים ובריאות', items: ['/docs', '/meds', '/medical'] },
  { title: '📸 זיכרונות', items: ['/journal', '/gallery', '/songs', '/book', '/capsule'] },
  { title: '🎉 כיף', items: ['/challenges', '/wishes', '/badges'] },
];

function MoreLink({ s }: { s: (typeof SECTIONS)[number] }) {
  return s.to === '/challenges' ? (
    <NavLink to={s.to} className="more-shadow">
      <span className="ms-man" aria-hidden="true"><svg viewBox="0 0 60 80"><path fill="#050307" d="M12 20 Q30 15 48 20 L45 22 Q30 20 15 22 Z M18 21 Q19 8 30 8 Q41 8 42 21 Z M22 22 Q30 25 38 22 Q38 33 30 35 Q22 33 22 22 Z M30 34 L17 39 Q8 48 10 66 L12 80 L48 80 L50 66 Q52 48 43 39 Z" /><circle className="ms-eye" cx="27" cy="28" r="1" fill="#ff2d8a" /><circle className="ms-eye" cx="33" cy="28" r="1" fill="#ff2d8a" /></svg></span>
      <span className="ms-text"><small>תיק מסווג</small>{s.label}</span>
    </NavLink>
  ) : <NavLink to={s.to}><span className="more-ico" aria-hidden="true">{s.icon}</span>{s.label}</NavLink>;
}

function LowBattery({ level, saverOn }: { level: number; saverOn: boolean }) {
  const { me } = useAuth();
  const pct = Math.round(level * 100);
  // נסגר עד שהסוללה נטענת ויורדת שוב
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('trip:lowbat') === '1'; } catch { return false; } });
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (hidden) return null;
  const hide = () => { setHidden(true); try { sessionStorage.setItem('trip:lowbat', '1'); } catch { /* ignore */ } };
  async function send() {
    if (!me) return;
    setBusy(true);
    const { r, located } = await postStatus(me.id, `🔋 הסוללה כמעט נגמרת (${pct}%). אחזור כשאטען`, { withLoc: true });
    setBusy(false);
    setSent(r === 'error' ? 'לא נשלח. נסי שוב.' : r === 'queued' ? 'נשמר, ויישלח כשתחזור קליטה.' : located ? 'נשלח, עם המיקום 📍' : 'נשלח (בלי מיקום).');
  }
  return (
    <div className="lowbat" role="status">
      <div className="lowbat-head">
        <b>🪫 נשארו {pct}% סוללה</b>
        <button className="icon-btn" aria-label="סגירה" onClick={hide}>×</button>
      </div>
      <p className="small">{saverOn ? 'עברתי למצב חיסכון: כהה ובלי אנימציות.' : 'אפשר לעבור למצב חיסכון: כהה ובלי אנימציות.'}</p>
      {sent ? <p className="small"><b>{sent}</b></p> : (
        <div className="row gap wrap">
          <button className="btn btn-small btn-primary" disabled={busy} onClick={send}>{busy ? 'שולחת…' : '📍 לשלוח לבנות ולבית איפה אני'}</button>
          {saverOn
            ? <button className="btn btn-small" onClick={() => { setSaverPref('off'); hide(); }}>בלי מצב חיסכון</button>
            : <button className="btn btn-small" onClick={() => setSaverPref('on')}>🔋 הפעלת חיסכון</button>}
        </div>
      )}
    </div>
  );
}

function SaverToggle() {
  const { pref, active, battery } = useSaver();
  const opts: [SaverPref, string][] = [['auto', 'אוטומטי'], ['on', 'פועל'], ['off', 'כבוי']];
  return (
    <section className="more-group">
      <h2>🔋 מצב חיסכון בסוללה</h2>
      <div className="card saver-card">
        <div className="saver-seg" role="group" aria-label="מצב חיסכון">
          {opts.map(([k, l]) => <button key={k} className={pref === k ? 'on' : ''} onClick={() => setSaverPref(k)}>{l}</button>)}
        </div>
        <p className="small muted">
          {active ? '✅ פועל עכשיו: מסך כהה, בלי אנימציות וקונפטי. ' : 'כהה ובלי אנימציות, כדי שהטלפון יחזיק עוד קצת. '}
          {battery.supported
            ? `במצב אוטומטי נדלק לבד מתחת ל-${Math.round(LOW * 100)}% (עכשיו ${Math.round(battery.level * 100)}%${battery.charging ? ', בטעינה' : ''}).`
            : 'הטלפון הזה (אייפון) לא מאפשר לאתר לראות את הסוללה, אז "אוטומטי" לא יידלק לבד. כשהסוללה נמוכה, לוחצים "פועל".'}
        </p>
      </div>
    </section>
  );
}

function MoreSheet() {
  const { isAdmin } = useAuth();
  const byPath = new Map(SECTIONS.map((s) => [s.to, s]));
  const visits = readVisits();
  const top = Object.entries(visits)
    .filter(([p, n]) => n >= 3 && byPath.has(p) && !PRIMARY.includes(p))
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p]) => byPath.get(p)!);
  // עמוד חדש שנוסף ולא שובץ בקבוצה לא ייעלם
  const grouped = new Set(GROUPS.flatMap((g) => g.items));
  const rest = SECTIONS.filter((s) => !PRIMARY.includes(s.to) && !grouped.has(s.to));
  const groups = rest.length ? [...GROUPS, { title: '✨ עוד', items: rest.map((s) => s.to) }] : GROUPS;
  return (
    <div className="more-sheet">
      {top.length >= 2 && (
        <section className="more-group more-top">
          <h2>⭐ הכי בשימוש אצלך</h2>
          <div className="more-quick">
            {top.map((s) => <NavLink key={s.to} to={s.to}><span className="more-ico" aria-hidden="true">{s.icon}</span><span>{s.short}</span></NavLink>)}
          </div>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.title} className="more-group">
          <h2>{g.title}</h2>
          <div className="more-grid">
            {g.items.map((p) => byPath.get(p)).filter(Boolean).map((s) => <MoreLink key={s!.to} s={s!} />)}
          </div>
        </section>
      ))}
      <SaverToggle />
      <section className="more-group">
        <h2>🛠️ עזרה טכנית</h2>
        <ReportProblem />
      </section>
      {isAdmin && <div className="more-grid"><NavLink to="/admin" className="more-admin"><span className="more-ico" aria-hidden="true">⚙️</span>ניהול</NavLink></div>}
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="card" style={{ maxWidth: 520 }}>
        <h1>כמעט מוכן</h1>
        <p>האתר עוד לא מחובר למסד הנתונים. צריך להגדיר את <code>VITE_SUPABASE_URL</code> ואת <code>VITE_SUPABASE_ANON_KEY</code>. ההוראות נמצאות בקובץ README.</p>
      </div>
    </div>
  );
}
