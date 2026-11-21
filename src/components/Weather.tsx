import { useEffect, useState } from 'react';
import { placeName } from '../lib/geo';

// תחזית חינמית מ-Open-Meteo (בלי מפתח). נשמרת בטלפון לשעה, ומוצגת גם בלי קליטה.
type Day = { date: string; code: number; max: number; min: number; rain: number; sunrise?: string; sunset?: string };

const ICON = (c: number) =>
  c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '☁️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌧️' : c <= 86 ? '🌨️' : '⛈️';
const DESC = (c: number) =>
  c === 0 ? 'שמשי' : c <= 2 ? 'מעונן חלקית' : c === 3 ? 'מעונן' : c <= 48 ? 'ערפל' : c <= 57 ? 'טפטוף' : c <= 67 ? 'גשם' : c <= 77 ? 'שלג' : c <= 82 ? 'ממטרים' : c <= 86 ? 'שלג' : 'סופות רעמים';

export default function Weather({ lat, lng, label }: { lat: number; lng: number; label?: string | null }) {
  const [name, setName] = useState<string | null>(label || null);
  useEffect(() => {
    if (label) { setName(label); return; }
    let on = true;
    placeName(lat, lng).then((n) => { if (on) setName(n); });
    return () => { on = false; };
  }, [lat, lng, label]);
  const key = `wx2:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const [days, setDays] = useState<Day[] | null>(() => {
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); return c?.days || null; } catch { return null; }
  });
  useEffect(() => {
    let cached: { at: number } | null = null;
    try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    if (cached && Date.now() - cached.at < 36e5) return;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=5`;
    fetch(url).then((r) => r.json()).then((j) => {
      const d = j?.daily;
      if (!d?.time) return;
      const list: Day[] = d.time.map((t: string, i: number) => ({ date: t, code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? 0, sunrise: d.sunrise?.[i], sunset: d.sunset?.[i] }));
      setDays(list);
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), days: list })); } catch { /* ignore */ }
    }).catch(() => { /* בלי קליטה: נשארת התחזית האחרונה */ });
  }, [key, lat, lng]);

  if (!days) return null;
  const today = days[0];
  return (
    <section className="weather">
      <div className="wx-now">
        <span className="wx-big">{ICON(today.code)}</span>
        <div>
          <span className="small muted">{name ? <>מזג האוויר ב{name} 📍</> : 'מזג האוויר איפה שהבנות נמצאות'}</span>
          <b>{today.max}° / {today.min}°</b>
          <span className="small">{DESC(today.code)}{today.rain >= 30 && ` · ${today.rain}% גשם`}</span>
        </div>
      </div>
      {today.sunrise && today.sunset && (
        <div className="wx-sun">
          <span>🌅 זריחה <b className="tnum">{today.sunrise.slice(11, 16)}</b></span>
          <span>🌇 שקיעה <b className="tnum">{today.sunset.slice(11, 16)}</b></span>
        </div>
      )}
      <ol className="wx-days">
        {days.slice(1).map((d) => (
          <li key={d.date}>
            <span className="small muted">{new Date(d.date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short' })}</span>
            <span className="wx-ico">{ICON(d.code)}</span>
            <span className="small tnum">{d.max}°<span className="muted">/{d.min}°</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
