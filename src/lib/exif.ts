// קורא את המיקום (GPS) מתוך תמונת JPEG, אם הטלפון שמר אותו בקובץ.

export async function readGps(file: Blob): Promise<{ lat: number; lng: number } | null> {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null; // לא JPEG
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + size;
    }
  } catch { /* קובץ לא תקין */ }
  return null;
}

function parseTiff(v: DataView, start: number) {
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, le);
  const u32 = (o: number) => v.getUint32(start + o, le);
  const ifd0 = u32(4);
  let gpsOff = 0;
  const n0 = u16(ifd0);
  for (let i = 0; i < n0; i++) {
    const e = ifd0 + 2 + i * 12;
    if (u16(e) === 0x8825) gpsOff = u32(e + 8);
  }
  if (!gpsOff) return null;
  const tags: Record<number, number[] | string> = {};
  const n = u16(gpsOff);
  for (let i = 0; i < n; i++) {
    const e = gpsOff + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    if (type === 2) tags[tag] = String.fromCharCode(v.getUint8(start + e + 8));
    else if (type === 5) {
      const p = u32(e + 8), vals: number[] = [];
      for (let k = 0; k < count; k++) vals.push(u32(p + k * 8) / (u32(p + k * 8 + 4) || 1));
      tags[tag] = vals;
    }
  }
  const dms = (a: number[] | string | undefined) => (Array.isArray(a) ? a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600 : NaN);
  let lat = dms(tags[2]), lng = dms(tags[4]);
  if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (tags[1] === 'S') lat = -lat;
  if (tags[3] === 'W') lng = -lng;
  return { lat, lng };
}

/** מרחק בקילומטרים בין שתי נקודות */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
