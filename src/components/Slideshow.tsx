import { useEffect, useState } from 'react';
import { reducedMotion } from '../lib/fx';
import { supabase } from '../lib/supabase';

/** התמונות של דף הבית: תיקיית home בתוך האחסון (גלויה לכולם), לא הגלריה */
function useHomeSlides() {
  const [urls, setUrls] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache:home-slides') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    (async () => {
      const { data } = await supabase.storage.from('photos').list('home', { limit: 100, sortBy: { column: 'name', order: 'asc' } });
      const paths = (data || []).filter((f) => f.id && /\.(jpe?g|png|webp)$/i.test(f.name)).map((f) => `home/${f.name}`);
      if (!paths.length) return;
      const signed = await supabase.storage.from('photos').createSignedUrls(paths, 60 * 60 * 24 * 7);
      const list = (signed.data || []).map((x) => x.signedUrl).filter(Boolean) as string[];
      if (list.length) {
        setUrls(list);
        try { localStorage.setItem('cache:home-slides', JSON.stringify(list)); } catch { /* ignore */ }
      }
    })();
  }, []);
  return urls;
}

// שקופיות מאוירות עד שיהיו תמונות אמיתיות
const DREAMS = [
  { title: 'מאצ׳ו פיצ׳ו', sub: 'פרו', art: '⛰️🦙', bg: 'linear-gradient(160deg,#ff9ccf,#b56cff 70%,#5a2a8a)' },
  { title: 'סלאר דה אויוני', sub: 'בוליביה', art: '☁️🪞', bg: 'linear-gradient(180deg,#9ee7ff,#ffd1ec 55%,#fff 56%,#ffd1ec)' },
  { title: 'פטגוניה', sub: 'צ׳ילה וארגנטינה', art: '🏔️❄️', bg: 'linear-gradient(170deg,#ffc6e4,#8fb8ff 60%,#3c5aa8)' },
  { title: 'ריו דה ז׳נרו', sub: 'ברזיל', art: '🌴🌅', bg: 'linear-gradient(170deg,#ffc94d,#ff5fa8 60%,#9b2d8a)' },
];

export default function Slideshow() {
  const ready = useHomeSlides();
  const slides = ready.length
    ? ready.map((url, k) => ({ key: 'h' + k, img: url, title: '', sub: '' }))
    : DREAMS.map((d) => ({ key: d.title, img: '', title: d.title, sub: d.sub, art: d.art, bg: d.bg }));
  const [i, setI] = useState(0);
  const n = slides.length;

  useEffect(() => {
    if (n < 2 || reducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n]);

  return (
    <section className="slideshow" aria-roledescription="carousel" aria-label="תמונות מהטיול">
      {slides.map((s: any, k) => (
        <div key={s.key} className={'slide' + (k === i % n ? ' on' : '')} aria-hidden={k !== i % n}
          style={s.img ? undefined : { background: s.bg }}>
          {s.img ? <><img className="slide-bg" src={s.img} alt="" aria-hidden="true" /><img className="slide-img" src={s.img} alt="הבנות" loading={k < 2 ? 'eager' : 'lazy'} /></> : <span className="slide-art">{s.art}</span>}
          {(s.title || !ready.length) && <div className="slide-cap">
            {!ready.length && <span className="slide-kicker">חלומות על הדרך ✨</span>}
            {s.title && <b>{s.title}</b>}
            {s.sub && <span>{s.sub}</span>}
          </div>}
        </div>
      ))}
      {n > 1 && (
        <div className="slide-dots">
          {slides.map((s: any, k) => (
            <button key={s.key} aria-label={`תמונה ${k + 1}`} className={k === i % n ? 'on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
      )}
    </section>
  );
}
