import { ChangeEvent, useEffect, useState } from 'react';
import { get, set, del, keys } from 'idb-keyval';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { supabase } from '../lib/supabase';
import type { Doc } from '../lib/types';
import { fmtDate, fmtSize, safeFileName } from '../lib/util';
import { IMG, shrinkImage, shrunkName } from '../lib/image';
import { Empty } from '../components/Avatar';

const k = (id: string) => `doc:${id}`;

/** מוריד למכשיר כל מסמך שעוד לא נשמר בו, ומוחק מהמכשיר מסמכים שנמחקו */
async function syncOffline(docs: Doc[], onProgress: (ids: Set<string>) => void) {
  const saved = new Set((await keys()).map(String).filter((x) => x.startsWith('doc:')).map((x) => x.slice(4)));
  onProgress(new Set(saved));
  if (!navigator.onLine) return;
  const live = new Set(docs.map((d) => d.id));
  for (const id of saved) if (!live.has(id)) { await del(k(id)); saved.delete(id); }
  for (const d of docs) {
    if (saved.has(d.id)) continue;
    const { data } = await supabase.storage.from('documents').download(d.path);
    if (data) { await set(k(d.id), data); saved.add(d.id); onProgress(new Set(saved)); }
  }
  onProgress(new Set(saved));
}

export default function Documents() {
  const { me, travelers, colorOf } = useAuth();
  const { rows, reload } = useTable<Doc>('documents', { order: 'created_at', ascending: false });
  const [folder, setFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = folder || (me?.is_traveler ? me.id : travelers[0]?.id) || null;
  const docs = rows.filter((d) => d.owner === current);

  useEffect(() => { syncOffline(rows, setSaved); }, [rows]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!me || !files.length) return;
    setBusy(true); setErr(null);
    for (const orig of files) {
      const blob = await shrinkImage(orig, IMG.doc);
      const f = blob === orig ? orig : new File([blob], shrunkName(orig.name, blob, orig), { type: 'image/jpeg' });
      const path = `${me.id}/${Date.now()}-${safeFileName(f.name)}`;
      const up = await supabase.storage.from('documents').upload(path, f, { contentType: f.type || undefined });
      if (up.error) { setErr(`"${f.name}" לא הועלה. קבצים עד 50MB, ובחיבור לאינטרנט.`); continue; }
      const ins = await supabase.from('documents').insert({ name: f.name, path, mime: f.type || null, size: f.size }).select().single();
      if (ins.data) await set(k(ins.data.id), f);
    }
    setBusy(false); reload();
  }

  async function open(d: Doc) {
    let blob: Blob | undefined = await get(k(d.id));
    if (!blob) {
      const { data } = await supabase.storage.from('documents').download(d.path);
      if (data) { blob = data; await set(k(d.id), data); }
    }
    if (!blob) { setErr('המסמך עוד לא נשמר במכשיר הזה, וכרגע אין חיבור.'); return; }
    const typed = d.mime && !blob.type ? new Blob([blob], { type: d.mime }) : blob;
    const url = URL.createObjectURL(typed);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    if (!/^(image\/|application\/pdf)/.test(typed.type)) a.download = d.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function remove(d: Doc) {
    await supabase.storage.from('documents').remove([d.path]);
    await supabase.from('documents').delete().eq('id', d.id);
    await del(k(d.id));
    reload();
  }

  const allSaved = rows.length > 0 && rows.every((d) => saved.has(d.id));

  return (
    <div className="stack-lg">
      <div>
        <h1>מסמכים</h1>
        <p className="muted">תיקייה לכל אחת. כל מסמך נשמר גם בטלפון, כך שאפשר לפתוח אותו בלי אינטרנט.</p>
        <p className={'small ' + (allSaved ? 'ok' : 'muted')}>
          {rows.length === 0 ? '' : allSaved ? `כל ${rows.length} המסמכים שמורים במכשיר הזה` : `שמורים במכשיר: ${saved.size} מתוך ${rows.length}`}
        </p>
      </div>
      <div className="folders" role="tablist">
        {travelers.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} className={'folder' + (current === t.id ? ' on' : '')}
            style={{ ['--c' as any]: colorOf(t.id) }} onClick={() => setFolder(t.id)}>
            <b>{t.display_name.split(' ')[0]}</b>
            <span className="muted small">{rows.filter((d) => d.owner === t.id).length} מסמכים</span>
          </button>
        ))}
      </div>
      {current === me?.id && (
        <label className="btn btn-primary upload-btn">
          {busy ? 'מעלה…' : 'העלאת מסמך'}
          <input type="file" multiple hidden onChange={upload} accept="image/*,application/pdf,.doc,.docx" />
        </label>
      )}
      {err && <p className="error">{err}</p>}
      {docs.length === 0 ? (
        <Empty title="התיקייה ריקה">{current === me?.id ? 'כדאי להעלות צילום דרכון, ביטוח וכרטיסי טיסה.' : 'עוד לא הועלו כאן מסמכים.'}</Empty>
      ) : (
        <ul className="list">
          {docs.map((d) => (
            <li key={d.id} className="list-item">
              <span className="file-badge">{(d.name.split('.').pop() || '').slice(0, 4).toUpperCase()}</span>
              <button className="grow link-like" onClick={() => open(d)}>
                <b>{d.name}</b>
                <span className="muted small">{fmtDate(d.created_at)} · {fmtSize(d.size)} · {saved.has(d.id) ? 'זמין בלי אינטרנט' : 'נשמר במכשיר…'}</span>
              </button>
              {d.owner === me?.id && <button className="icon-btn" aria-label="מחיקה" onClick={() => remove(d)}>×</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
