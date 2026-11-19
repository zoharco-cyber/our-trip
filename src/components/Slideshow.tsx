import { useEffect, useState } from 'react';
import { reducedMotion } from '../lib/fx';
import { HOME_SLIDES } from '../data/slides';

// שקופיות מאוירות עד שיהיו תמונות אמיתיות
const DREAMS = [
  { title: 'מאצ׳ו פיצ׳ו', sub: 'פרו', art: '⛰️🦙', bg: 'linear-gradient(160deg,#ff9ccf,#b56cff 70%,#5a2a8a)' },
  { title: 'סלאר דה אויוני', sub: 'בוליביה', art: '☁️🪞', bg: 'linear-gradient(180deg,#9ee7ff,#ffd1ec 55%,#fff 56%,#ffd1ec)' },
  { title: 'פטגוניה', sub: 'צ׳ילה וארגנטינה', art: '🏔️❄️', bg: 'linear-gradient(170deg,#ffc6e4,#8fb8ff 60%,#3c5aa8)' },
  { title: 'ריו דה ז׳נרו', sub: 'ברזיל', art: '🌴🌅', bg: 'linear-gradient(170deg,#ffc94d,#ff5fa8 60%,#9b2d8a)' },
];

export default function Slideshow() {
  const ready = HOME_SLIDES;
  const slides = ready.length
    ? ready.map((p) => ({ key: p.file, img: import.meta.env.BASE_URL + 'slides/' + p.file, title: p.caption || '', sub: '' }))
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
          {s.img ? <img src={s.img} alt={s.title} /> : <span className="slide-art">{s.art}</span>}
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
