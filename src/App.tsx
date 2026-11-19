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

export const SECTIONS = [
  { to: '/', label: 'בית', short: 'בית', guest: true },
  { to: '/money', label: 'כסף', short: 'כסף' },
  { to: '/map', label: 'מפה', short: 'מפה', guest: true },
  { to: '/shopping', label: 'קניות לשבוע', short: 'קניות' },
  { to: '/wishes', label: 'חלומות', short: 'חלומות' },
  { to: '/gallery', label: 'גלריה', short: 'גלריה', guest: true },
  { to: '/docs', label: 'מסמכים', short: 'מסמכים' },
  { to: '/gear', label: 'ציוד', short: 'ציוד' },
  { to: '/guide', label: 'מדריך יעדים', short: 'מדריך' },
  { to: '/capsule', label: 'קפסולת זמן', short: 'קפסולה' },
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
          <NavLink to="/" className="brand">הטיול שלנו</NavLink>
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
        {SECTIONS.map((s) => <NavLink key={s.to} to={s.to}>{s.label}</NavLink>)}
        {isAdmin && <NavLink to="/admin">ניהול</NavLink>}
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
