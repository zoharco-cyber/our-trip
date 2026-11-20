import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite, newId } from '../lib/offline';
import type { WifiPassword } from '../lib/types';
import { fmtDate } from '../lib/util';
import { Who, Empty } from '../components/Avatar';

export default function Wifi() {
  const { me } = useAuth();
  const rows = useTable<WifiPassword>('wifi_passwords', { order: 'created_at', ascending: false });
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [network, setNetwork] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!place.trim()) return;
    await dbWrite({ table: 'wifi_passwords', kind: 'insert', values: {
      id: newId(), place: place.trim(), network: network.trim() || null, password: password || null,
      note: note.trim() || null, created_by: me?.id, created_at: new Date().toISOString(),
    } });
    setPlace(''); setNetwork(''); setPassword(''); setNote(''); setOpen(false); rows.reload();
  }
  async function remove(id: string) { await dbWrite({ table: 'wifi_passwords', kind: 'delete', match: { id } }); rows.reload(); }

  const t = q.trim();
  const list = rows.rows.filter((r) => !t || [r.place, r.network, r.note].some((x) => (x || '').includes(t)));

  return (
    <div className="stack-lg narrow">
      <div className="row-between">
        <div>
          <h1>סיסמאות</h1>
          <p className="muted">וויי-פיי של הוסטלים, קודים של לוקרים ודלתות. זמין גם בלי קליטה.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? 'סגירה' : '🔐 הוספה'}</button>
      </div>
      {open && (
        <form className="card stack" onSubmit={add}>
          <label className="field"><span>איפה?</span><input id="wf-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="למשל: Pariwana Hostel, קוסקו" /></label>
          <div className="form-grid">
            <label className="field"><span>שם הרשת / מה זה</span><input id="wf-net" dir="ltr" value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Pariwana_Guest / קוד לוקר" /></label>
            <label className="field"><span>סיסמה / קוד</span><input id="wf-pw" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></label>
          </div>
          <label className="field"><span>הערה (לא חובה)</span><input id="wf-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="הוויי-פיי עובד רק בלובי" /></label>
          <button className="btn btn-primary" disabled={!place.trim()}>שמירה</button>
        </form>
      )}
      {rows.rows.length > 3 && <input id="wf-q" placeholder="חיפוש לפי מקום…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {list.length === 0 ? <Empty title="עוד אין סיסמאות">שמרו כאן את הוויי-פיי של ההוסטל הראשון.</Empty> : (
        <ul className="wifi-list">
          {list.map((r) => <WifiCard key={r.id} r={r} mine={r.created_by === me?.id} onRemove={() => remove(r.id)} />)}
        </ul>
      )}
      <p className="muted small">🔒 רק המטיילות והמנהל רואים את הסיסמאות. לא לשמור כאן סיסמאות של בנק או של כרטיס אשראי.</p>
    </div>
  );
}

function WifiCard({ r, mine, onRemove }: { r: WifiPassword; mine: boolean; onRemove: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(what: string, v: string) {
    try { await navigator.clipboard.writeText(v); setCopied(what); setTimeout(() => setCopied(null), 1500); } catch { setShow(true); }
  }
  return (
    <li className={'card wifi' + ((r as any).__pending ? ' is-pending' : '')}>
      <div className="row-between">
        <b>📶 {r.place}</b>
        {mine && <button className="icon-btn" aria-label="מחיקה" onClick={onRemove}>×</button>}
      </div>
      {r.network && (
        <div className="wf-row"><span className="muted small">רשת</span><code dir="ltr">{r.network}</code>
          <button className="btn btn-small" onClick={() => copy('net', r.network!)}>{copied === 'net' ? '✓ הועתק' : 'העתקה'}</button></div>
      )}
      {r.password && (
        <div className="wf-row"><span className="muted small">סיסמה</span><code dir="ltr">{show ? r.password : '•'.repeat(Math.min(12, r.password.length))}</code>
          <button className="btn btn-small" onClick={() => setShow((v) => !v)}>{show ? 'הסתרה' : 'הצגה'}</button>
          <button className="btn btn-small btn-primary" onClick={() => copy('pw', r.password!)}>{copied === 'pw' ? '✓ הועתק' : 'העתקה'}</button></div>
      )}
      {r.note && <p className="small muted">{r.note}</p>}
      <span className="small muted"><Who id={r.created_by} /> · {fmtDate(r.created_at)}</span>
    </li>
  );
}
