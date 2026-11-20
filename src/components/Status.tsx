import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import type { StatusUpdate } from '../lib/types';
import { confetti } from '../lib/fx';

const PRESETS = ['הגענו בשלום 💖', 'הכול טוב אצלנו 😊', 'בדרך, באוטובוס 🚌', 'בלי קליטה כמה ימים 📵', 'עייפות ומאושרות 😴', 'מתגעגעות! 🥹'];

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

/** העדכון האחרון מהבנות. גלוי גם לאורחים */
export function LatestStatus() {
  const { nameOf } = useAuth();
  const { rows } = useTable<StatusUpdate>('status_updates', { order: 'created_at', ascending: false, filter: (q) => q.limit(1) });
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60_000); return () => clearInterval(t); }, []);
  const s = rows[0];
  if (!s) return null;
  return (
    <section className="latest-status">
      <span className="ls-heart" aria-hidden="true">💖</span>
      <div className="grow">
        <span className="small muted">העדכון האחרון מהבנות · {ago(s.created_at)}</span>
        <b>{s.message}</b>
        <span className="small">{nameOf(s.created_by)}{s.place && <> · 📍 {s.place}</>}</span>
      </div>
    </section>
  );
}

/** שליחת עדכון "אנחנו בסדר" להורים ולמנהל */
export function SendStatus() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [place, setPlace] = useState('');
  const [withLoc, setWithLoc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (!me?.is_traveler) return null;

  async function send(text: string, e?: React.MouseEvent) {
    if (!text.trim()) return;
    setBusy(true); setDone(null);
    let lat: number | null = null, lng: number | null = null;
    if (withLoc && navigator.geolocation) {
      await new Promise<void>((res) => navigator.geolocation.getCurrentPosition(
        (p) => { lat = p.coords.latitude; lng = p.coords.longitude; res(); }, () => res(), { timeout: 10000, maximumAge: 300000 }));
    }
    const now = new Date().toISOString();
    const r = await dbWrite({ table: 'status_updates', kind: 'insert', values: { id: newId(), message: text.trim(), place: place.trim() || null, lat, lng, created_by: me!.id, created_at: now } });
    if (lat !== null && lng !== null) await dbWrite({ table: 'location_updates', kind: 'insert', values: { id: newId(), lat, lng, name: place.trim() || null, created_by: me!.id, created_at: now } });
    setBusy(false);
    if (r === 'error') { setDone('לא נשלח. נסי שוב.'); return; }
    confetti(e?.clientX, e?.clientY, 40, ['💖', '✨']);
    setDone(r === 'queued' ? 'נשמר, ויישלח ברגע שתחזור קליטה 💖' : 'נשלח! ההורים יראו את זה באתר 💖');
    setMsg(''); setOpen(false);
  }

  return (
    <section className="card send-status">
      <div className="row-between">
        <b>📣 עדכון לבית</b>
        <button className="btn btn-small" onClick={() => { setOpen((v) => !v); setDone(null); }}>{open ? 'סגירה' : 'שליחת עדכון'}</button>
      </div>
      {done && <p className="ok small">{done}</p>}
      {open && (
        <div className="stack">
          <div className="chips">
            {PRESETS.map((p) => <button key={p} className="chip" disabled={busy} onClick={(e) => send(p, e)}>{p}</button>)}
          </div>
          <div className="form-row">
            <input id="st-msg" className="grow" placeholder="או משהו משלך…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !msg.trim()} onClick={(e) => send(msg, e)}>{busy ? 'שולחת…' : 'שליחה'}</button>
          </div>
          <input id="st-place" placeholder="איפה אתן? (לא חובה, למשל: לה פאס)" value={place} onChange={(e) => setPlace(e.target.value)} />
          <label className="check small"><input type="checkbox" checked={withLoc} onChange={(e) => setWithLoc(e.target.checked)} /><span>לעדכן גם את "אנחנו כאן" במפה לפי המיקום של הטלפון</span></label>
          <p className="muted small">ההורים והאורחים יראו את העדכון בדף הבית, ומי שהפעילה התראות תקבל הודעה.</p>
        </div>
      )}
    </section>
  );
}
