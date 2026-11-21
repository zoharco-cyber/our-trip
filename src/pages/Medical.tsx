import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { dbWrite } from '../lib/offline';
import type { MedicalCard } from '../lib/types';

const FIELDS: { k: keyof MedicalCard; label: string; ph?: string; ltr?: boolean; tel?: boolean }[] = [
  { k: 'blood_type', label: 'סוג דם', ph: 'למשל A+' },
  { k: 'allergies', label: 'אלרגיות', ph: 'תרופות, מזון, עקיצות… או "אין"' },
  { k: 'meds', label: 'תרופות קבועות', ph: 'שם ומינון' },
  { k: 'conditions', label: 'מצב רפואי שחשוב לדעת', ph: 'אסתמה, סכרת… או "אין"' },
  { k: 'insurance', label: 'חברת הביטוח' },
  { k: 'policy_no', label: 'מספר פוליסה', ltr: true },
  { k: 'insurance_phone', label: 'טלפון חירום של הביטוח', ltr: true, tel: true },
  { k: 'emergency_name', label: 'איש קשר בבית', ph: 'שם וקרבה, למשל: אמא, רונית' },
  { k: 'emergency_phone', label: 'הטלפון שלו', ltr: true, tel: true },
  { k: 'notes', label: 'הערות לרופא', ph: 'לא חובה' },
];

export default function Medical() {
  const { me, travelers } = useAuth();
  const cards = useTable<MedicalCard>('medical_cards');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<MedicalCard>>({});
  const [open, setOpen] = useState<string | null>(null);
  const mine = cards.rows.find((c) => c.user_id === me?.id);

  function startEdit() { setForm(mine || {}); setEditing(true); }
  async function save() {
    if (!me) return;
    const values: Record<string, any> = { user_id: me.id, updated_at: new Date().toISOString() };
    FIELDS.forEach((f) => { values[f.k] = ((form[f.k] as string) || '').trim() || null; });
    await dbWrite({ table: 'medical_cards', kind: 'upsert', values, onConflict: 'user_id' });
    setEditing(false); cards.reload();
  }

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>כרטיס חירום</h1>
        <p className="muted">🩺 אם חלילה קורה משהו, החברות יודעות מה להגיד לרופא. זמין גם בלי קליטה. רק המטיילות והמנהל רואים.</p>
      </div>
      {me?.is_traveler && (editing ? (
        <section className="card stack">
          <b>הכרטיס שלי</b>
          {FIELDS.map((f) => (
            <label key={f.k} className="field"><span>{f.label}</span>
              <input id={`med-${f.k}`} dir={f.ltr ? 'ltr' : undefined} inputMode={f.tel ? 'tel' : undefined} placeholder={f.ph} value={(form[f.k] as string) || ''} onChange={(e) => setForm((x) => ({ ...x, [f.k]: e.target.value }))} />
            </label>
          ))}
          <div className="row gap"><button className="btn btn-primary" onClick={save}>שמירה</button><button className="btn" onClick={() => setEditing(false)}>ביטול</button></div>
        </section>
      ) : (
        <button className="btn btn-primary" onClick={startEdit}>{mine ? '✏️ עריכת הכרטיס שלי' : '➕ מילוי הכרטיס שלי'}</button>
      ))}
      <div className="stack">
        {travelers.map((t) => {
          const c = cards.rows.find((x) => x.user_id === t.id);
          const isOpen = open === t.id;
          return (
            <section key={t.id} className="card med-card" style={{ ['--c' as any]: t.color }}>
              <button className="med-head" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}>
                <span className="med-cross" aria-hidden="true">✚</span>
                <b className="grow">{t.display_name}</b>
                {c?.blood_type && <span className="med-blood">🩸 {c.blood_type}</span>}
                <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (c ? (
                <dl className="med-dl">
                  {FIELDS.filter((f) => c[f.k]).map((f) => (
                    <div key={f.k}><dt>{f.label}</dt><dd dir={f.ltr ? 'ltr' : undefined}>
                      {f.tel ? <a href={`tel:${String(c[f.k]).replace(/[^\d+]/g, '')}`}>{c[f.k] as string}</a> : (c[f.k] as string)}
                    </dd></div>
                  ))}
                </dl>
              ) : <p className="muted small">עוד לא מילאה את הכרטיס.</p>)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
