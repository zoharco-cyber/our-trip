import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import Countdown from '../components/Countdown';
import Slideshow from '../components/Slideshow';
import { NextBooking } from './Bookings';
import { LatestStatus, SendStatus } from '../components/Status';
import Weather from '../components/Weather';
import DualClock from '../components/DualClock';
import HereInfo from '../components/HereInfo';
import { ReplayLetter } from '../components/MyLetter';
import type { LocationUpdate } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { TripEvent } from '../lib/types';
import { fmtDateTime } from '../lib/util';
import { SECTIONS } from '../App';
import { Who } from '../components/Avatar';

const BLURB: Record<string, string> = {
  '/money': 'מי שילמה, מי חייבת למי, וכמה נשאר',
  '/map': 'נקודות, תמונות וסיפורים מכל יעד',
  '/shopping': 'מה קונים בשבוע הקרוב',
  '/wishes': 'חלומות להגשים בהמשך הדרך',
  '/gallery': 'כל התמונות במקום אחד',
  '/docs': 'דרכונים, ביטוחים וכרטיסים, גם בלי אינטרנט',
  '/gear': 'רשימת ציוד שכל אחת מסמנת לעצמה',
  '/capsule': 'מכתבים שייפתחו רק בסוף הטיול',
  '/journal': 'משפט ומצב רוח לכל יום',
  '/bookings': 'טיסות, אוטובוסים ולינות במקום אחד',
  '/help': 'יעדים ואשרות, המרת כסף, חירום וספרדית',
  '/challenges': 'משימות מהצללים 🕵️',
  '/book': 'כל הטיול בדף אחד',
  '/songs': 'הפסקול של הטיול',
  '/meds': 'תזכורות פרטיות לתרופות',
  '/wifi': 'וויי-פיי וקודים של ההוסטלים',
};

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; };

export default function Home() {
  const { guest, me } = useAuth();
  const { rows, reload } = useTable<TripEvent>('events', { order: 'starts_at' });
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [adding, setAdding] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title || !when) return;
    await supabase.from('events').insert({ title, starts_at: new Date(when).toISOString() });
    setTitle(''); setWhen(''); setAdding(false); reload();
  }
  async function remove(id: string) {
    await supabase.from('events').delete().eq('id', id); reload();
  }

  const locs = useTable<LocationUpdate>('location_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const here = locs.rows[0];
  // עד שמישהי מעדכנת "אנחנו כאן": לימה, היעד הראשון
  const spot = here ? { lat: here.lat, lng: here.lng, label: here.name } : { lat: -12.046, lng: -77.043, label: 'לימה (היעד הראשון)' };
  const now = Date.now();
  return (
    <div className="stack-lg">
      <div className="marquee" aria-hidden="true"><div>
        {[0, 1].map((k) => <span key={k}>✨ {me ? `${greet()} ${me.display_name.split(' ')[0]}!` : 'ברוכים הבאים!'} ✨ הטיול של הבנות 💖 דרום אמריקה מחכה לנו 🦙 כל יום הוא הרפתקה 🌸 </span>)}
      </div></div>
      <DualClock />
      <LatestStatus />
      <Slideshow />
      <section className="hero-card">
        <Countdown />
      </section>
      <Weather lat={spot.lat} lng={spot.lng} label={spot.label} />
      <HereInfo lat={spot.lat} lng={spot.lng} />
      {!guest && <ReplayLetter />}
      {!guest && <SendStatus />}
      {!guest && <NextBooking />}

      <section className="stack">
        <div className="row-between">
          <h2>תאריכים חשובים</h2>
          {!guest && <button className="btn btn-small" onClick={() => setAdding((v) => !v)}>{adding ? 'ביטול' : 'הוספת תאריך'}</button>}
        </div>
        {adding && (
          <form className="card form-row" onSubmit={add}>
            <input id="ev-title" placeholder="מה? למשל: טיסה ללימה" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input id="ev-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button className="btn btn-primary" disabled={!title || !when}>שמירה</button>
          </form>
        )}
        <ol className="timeline">
          {rows.map((ev) => (
            <li key={ev.id} className={new Date(ev.starts_at).getTime() < now ? 'past' : ''}>
              <span className="tl-date">{fmtDateTime(ev.starts_at)}</span>
              <span className="tl-title">{ev.title}</span>
              {!guest && ev.created_by && <Who id={ev.created_by} />}
              {!guest && <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(ev.id)}>×</button>}
            </li>
          ))}
        </ol>
      </section>

      <section className="tiles">
        {SECTIONS.filter((s) => s.to !== '/' && (!guest || s.guest)).map((s) => (
          <Link key={s.to} to={s.to} className="tile">
            <b>{s.label}</b>
            <span>{BLURB[s.to]}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
