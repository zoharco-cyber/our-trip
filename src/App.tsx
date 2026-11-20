import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import Login from './pages/Login';
import Home from './pages/Home';
import MoneyPage from './pages/Money';
import Shopping from './pages/Shopping';
import Wishes from './pages/Wishes';
import Documents from './pages/Documents';
import Capsule from './pages/Capsule';
import MapPage from './pages/MapPage';
import Gallery from './pages/Gallery';
import Gear from './pages/Gear';
import Guide from './pages/Guide';
import Admin from './pages/Admin';
import Journal from './pages/Journal';
import Bookings from './pages/Bookings';
import Help from './pages/Help';
import Challenges from './pages/Challenges';
import Book from './pages/Book';
import { LOGO_URL } from './config';

export const SECTIONS = [
  { to: '/', icon: '🏠', label: 'בית', short: 'בית', guest: true },
  { to: '/money', icon: '💸', label: 'כסף', short: 'כסף' },
  { to: '/map', icon: '🗺️', label: 'מפה', short: 'מפה', guest: true },
  { to: '/shopping', icon: '🛒', label: 'קניות לשבוע', short: 'קניות' },
  { to: '/wishes', icon: '🌠', label: 'חלומות', short: 'חלומות' },
  { to: '/gallery', icon: '📸', label: 'גלריה', short: 'גלריה', guest: true },
  { to: '/docs', icon: '📂', label: 'מסמכים', short: 'מסמכים' },
  { to: '/gear', icon: '🎒', label: 'ציוד', short: 'ציוד' },
  { to: '/guide', icon: '🧭', label: 'מדריך יעדים', short: 'מדריך' },
  { to: '/journal', icon: '📔', label: 'יומן', short: 'יומן' },
  { to: '/bookings', icon: '🎫', label: 'הזמנות', short: 'הזמנות' },
  { to: '/help', icon: '🆘', label: 'עזרה בדרך', short: 'עזרה' },
  { to: '/challenges', icon: '🕵️', label: 'האתגרים של זוהר', short: 'אתגרים' },
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

  if (!isConfigured) return <SetupNeeded />;
  if (!ready) return <div className="splash">רגע…</div>;
  if (!session && !guest) return <Login />;

  const sections = SECTIONS.filter((s) => !guest || s.guest);
  const primary = guest ? sections : sections.filter((s) => ['/', '/money', '/map', '/shopping'].includes(s.to));

  return (
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
      {!online && <div className="offline-bar">אין אינטרנט כרגע. מוצגים הנתונים האחרונים שנשמרו, והמסמכים זמינים בתיקיות.</div>}
      <main className="page">
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
            <Route path="/guide" element={<Guide />} />
            <Route path="/capsule" element={<Capsule />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/book" element={<Book />} />
            <Route path="/more" element={<MoreSheet />} />
            {isAdmin && <Route path="/admin" element={<Admin />} />}
          </>}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="bottomnav" aria-label="ניווט מהיר">
        {primary.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.to === '/'}>{s.short}</NavLink>
        ))}
        {!guest && <NavLink to="/more">עוד</NavLink>}
      </nav>
    </div>
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
