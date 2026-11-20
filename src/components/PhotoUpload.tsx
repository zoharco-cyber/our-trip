import { ChangeEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { uploadPhotos } from '../lib/photos';

export default function PhotoUpload({ placeId, onDone }: { placeId?: string | null; onDone: () => void }) {
  const { me } = useAuth();
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!me) return null;

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setMsg(null);
    const { failed, linked } = await uploadPhotos(files, { placeId, isPublic, userId: me!.id });
    setBusy(false);
    setMsg(failed ? `${failed} תמונות לא הועלו. בדקי את החיבור ונסי שוב.` : linked ? `📍 ${linked} ${linked === 1 ? 'תמונה שויכה' : 'תמונות שויכו'} לבד לנקודה במפה לפי המיקום שלהן` : null);
    onDone();
  }
  return (
    <div className="row gap wrap">
      <label className="btn btn-primary upload-btn">
        {busy ? 'מעלה…' : 'העלאת תמונות'}
        <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={busy} />
      </label>
      <label className="check small"><input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} /><span>להציג גם לאורחים</span></label>
      {msg && <p className={msg.startsWith('📍') ? 'ok small' : 'error'}>{msg}</p>}
    </div>
  );
}
