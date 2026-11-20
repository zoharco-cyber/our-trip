// שם של מקום לפי קואורדינטות (שירות חינמי של OpenStreetMap). נשמר בטלפון.
export async function placeName(lat: number, lng: number): Promise<string | null> {
  const key = `geo:${lat.toFixed(3)},${lng.toFixed(3)}`;
  try { const c = localStorage.getItem(key); if (c) return c; } catch { /* ignore */ }
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=he`);
    const j = await r.json();
    const a = j?.address || {};
    const local = a.city || a.town || a.village || a.municipality || a.county || a.state;
    const name = [local, a.country].filter(Boolean).join(', ') || null;
    if (name) try { localStorage.setItem(key, name); } catch { /* ignore */ }
    return name;
  } catch { return null; }
}
