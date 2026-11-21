import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import Login from './pages/Login';
import Home from './pages/Home';
import { LOGO_URL } from './config';
import { LetterProvider } from './components/MyLetter';
import { onQueueChange, readQueue, startQueueSync } from './lib/offline';

// כל עמוד נטען רק כשנכנסים אליו
const MoneyPage = lazy(() => import('./pages/Money'));
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

export const SECTIONS = [
  { to: '/', icon: '🏠', label: 'בית', short: 'בית', guest: true },
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
  { to: '/songs', icon: '🎵', label: 'שירי הטיול', short: 'שירים' },
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
  const skin = guest ? 'guest-sky' : session && me?.theme ? me.theme : 'pink';
  useEffect(() => {
    if (skin === 'pink') delete document.documentElement.dataset.skin;
    else document.documentElement.dataset.skin = skin;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ({ pink: '#e0157f', red: '#d61f3a', purple: '#7b2ff7', midnight: '#0b1026', 'guest-sky': '#1f7fb8' } as Record<string, string>)[skin] || '#e0157f');
  }, [skin]);
  useEffect(() => onQueueChange(() => setQueued(readQueue().length)), []);

  if (!isConfigured) return <SetupNeeded />;
  if (!ready) return <div className="splash">רגע…</div>;
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
      {queued > 0 && <div className="queue-bar">⏳ {queued} {queued === 1 ? 'שינוי מחכה' : 'שינויים מחכים'} לשליחה{online ? '… שולחת עכשיו' : ' עד שתחזור קליטה'}</div>}
      <main className="page">
        <Suspense fallback={<div className="page-loading" aria-label="טוען">✨</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/gallery" element={<Gallery />} />
          {!guest && <>
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/wishes" element={<Wishes />} />
            <Route path="/docs" element={<Documents />} />
            <Route path="/gear" element={<Gear />} />
            <Route path="/guide" element={<Navigate to="/help" replace />} />
            <Route path="/capsule" element={<Capsule />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/book" element={<Book />} />
            <Route path="/songs" element={<Songs />} />
            <Route path="/meds" element={<Meds />} />
            <Route path="/wifi" element={<Wifi />} />
            <Route path="/more" element={<MoreSheet />} />
            <Route path="/admin" element={<Admin />} />
          </>}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
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

function MoreSheet() {
  const { isAdmin } = useAuth();
  return (
    <div className="more-sheet">
      <div className="more-grid">
        {SECTIONS.map((s) => s.to === '/challenges' ? (
          <NavLink key={s.to} to={s.to} className="more-shadow">
            <span className="ms-man" aria-hidden="true"><svg viewBox="0 0 60 80"><path fill="#050307" d="M12 20 Q30 15 48 20 L45 22 Q30 20 15 22 Z M18 21 Q19 8 30 8 Q41 8 42 21 Z M22 22 Q30 25 38 22 Q38 33 30 35 Q22 33 22 22 Z M30 34 L17 39 Q8 48 10 66 L12 80 L48 80 L50 66 Q52 48 43 39 Z" /><circle className="ms-eye" cx="27" cy="28" r="1" fill="#ff2d8a" /><circle className="ms-eye" cx="33" cy="28" r="1" fill="#ff2d8a" /></svg></span>
            <span className="ms-text"><small>תיק מסווג</small>{s.label}</span>
          </NavLink>
        ) : <NavLink key={s.to} to={s.to}><span className="more-ico" aria-hidden="true">{s.icon}</span>{s.label}</NavLink>)}
        {isAdmin && <NavLink to="/admin" className="more-admin"><span className="more-ico" aria-hidden="true">⚙️</span>ניהול</NavLink>}
      </div>
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
