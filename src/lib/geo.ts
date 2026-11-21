// שם של מקום וקוד מדינה לפי קואורדינטות (שירות חינמי של OpenStreetMap). נשמר בטלפון.
type Info = { name: string | null; cc: string | null };

export async function placeInfo(lat: number, lng: number): Promise<Info> {
  const key = `geo2:${lat.toFixed(3)},${lng.toFixed(3)}`;
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch { /* ignore */ }
  if (!navigator.onLine) return { name: null, cc: null };
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=he`);
    const j = await r.json();
    const a = j?.address || {};
    const local = a.city || a.town || a.village || a.municipality || a.county || a.state;
    const info: Info = { name: [local, a.country].filter(Boolean).join(', ') || null, cc: a.country_code || null };
    if (info.name) try { localStorage.setItem(key, JSON.stringify(info)); } catch { /* ignore */ }
    return info;
  } catch { return { name: null, cc: null }; }
}

export async function placeName(lat: number, lng: number): Promise<string | null> {
  return (await placeInfo(lat, lng)).name;
}
