import { useRef, useState } from 'react';
import L from 'leaflet';
import { useTable } from '../lib/useTable';
import { usePhotoUrls } from '../lib/photos';
import type { Photo, Place } from '../lib/types';
import { fmtDate } from '../lib/util';
import { reducedMotion } from '../lib/fx';

const plane = L.divIcon({ className: 'pin-wrap', html: '<span class="journey-plane">✈️</span>', iconSize: [40, 40], iconAnchor: [20, 20] });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "המסע שלנו": מטוס טס על המפה ממקום למקום לפי הסדר, ובכל עצירה קופצת תמונה */
export default function Journey({ map, route }: { map: L.Map | null; route: Place[] }) {
  const photos = useTable<Photo>('photos', { order: 'created_at' });
  const firstPhoto = (id: string) => photos.rows.find((p) => p.place_id === id);
  const urls = usePhotoUrls(route.map((p) => firstPhoto(p.id)).filter(Boolean) as Photo[]);
  const [stop, setStop] = useState<{ place: Place; n: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const cancel = useRef(false);

  async function fly(m: L.Map, marker: L.Marker, a: Place, b: Place) {
    const steps = reducedMotion() ? 1 : 70;
    const angle = (Math.atan2(-(b.lat - a.lat), b.lng - a.lng) * 180) / Math.PI;
    const el = marker.getElement()?.querySelector('.journey-plane') as HTMLElement | null;
    if (el) el.style.transform = `rotate(${angle + 45}deg)`;
    m.flyToBounds(L.latLngBounds([a.lat, a.lng], [b.lat, b.lng]).pad(0.6), { duration: 1.1, maxZoom: 8 });
    await sleep(1100);
    for (let i = 1; i <= steps && !cancel.current; i++) {
      const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      marker.setLatLng([a.lat + (b.lat - a.lat) * e, a.lng + (b.lng - a.lng) * e]);
      await sleep(22);
    }
  }

  async function play() {
    if (!map || route.length < 2) return;
    cancel.current = false; setPlaying(true);
    map.closePopup();
    const marker = L.marker([route[0].lat, route[0].lng], { icon: plane, zIndexOffset: 2000, interactive: false }).addTo(map);
    try {
      map.flyTo([route[0].lat, route[0].lng], 8, { duration: 1.2 });
      await sleep(1300);
      for (let i = 0; i < route.length && !cancel.current; i++) {
        setStop({ place: route[i], n: i + 1 });
        await sleep(2600);
        setStop(null);
        if (i + 1 < route.length) await fly(map, marker, route[i], route[i + 1]);
      }
      if (!cancel.current) map.flyToBounds(L.latLngBounds(route.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2), { duration: 1.4 });
    } finally {
      await sleep(600);
      marker.remove(); setStop(null); setPlaying(false);
    }
  }

  if (route.length < 2) return null;
  const ph = stop ? firstPhoto(stop.place.id) : undefined;
  return (
    <>
      <button className={'btn btn-small' + (playing ? '' : ' btn-primary')} onClick={() => (playing ? (cancel.current = true) : play())}>
        {playing ? '⏹ עצירה' : `▶️ המסע שלנו (${route.length} עצירות)`}
      </button>
      {stop && (
        <div className="journey-card" key={stop.place.id}>
          {ph && urls[ph.path] && <img src={urls[ph.path]} alt="" />}
          <div>
            <span className="small muted">עצירה {stop.n} מתוך {route.length}</span>
            <b>{stop.place.name}</b>
            {stop.place.visited_on && <span className="small">{fmtDate(stop.place.visited_on)}</span>}
          </div>
        </div>
      )}
    </>
  );
}
