// שמירת אזור במפה בטלפון, כדי שיעבוד בלי קליטה.
// המשבצות נשמרות באותו מקום שה-Service Worker מגיש ממנו משבצות מפה (map-tiles).
const TILE = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const lon2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
export const MAX_TILES = 600;  // שומרים על שימוש הוגן בשרת המפות החינמי

export function tilesFor(b: { north: number; south: number; east: number; west: number }, zFrom: number, zTo: number) {
  const list: string[] = [];
  for (let z = zFrom; z <= zTo; z++) {
    const x0 = lon2x(b.west, z), x1 = lon2x(b.east, z);
    const y0 = lat2y(b.north, z), y1 = lat2y(b.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push(TILE(z, x, y));
    if (list.length > MAX_TILES * 4) break;
  }
  return list;
}

export async function saveTiles(urls: string[], onProgress: (done: number) => void) {
  const cache = await caches.open('map-tiles');
  let done = 0, failed = 0, i = 0;
  async function worker() {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        if (!(await cache.match(u))) {
          const r = await fetch(u, { mode: 'no-cors' });
          await cache.put(u, r);
        }
      } catch { failed++; }
      onProgress(++done);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { failed };
}

export type SavedArea = { name: string; tiles: number; at: string };
export const readAreas = (): SavedArea[] => { try { return JSON.parse(localStorage.getItem('trip:mapAreas') || '[]'); } catch { return []; } };
export const writeAreas = (a: SavedArea[]) => { try { localStorage.setItem('trip:mapAreas', JSON.stringify(a)); } catch { /* ignore */ } };
