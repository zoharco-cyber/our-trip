import { useTable } from './useTable';
import type { Challenge, ChallengeDone, DailyAnswer, Expense, JournalEntry, MedicalCard, Photo, Place, PretripDone, PretripTask, QuizResult, Song, StatusUpdate, Wish } from './types';

export type Badge = { id: string; icon: string; name: string; how: string };

export const BADGES: Badge[] = [
  { id: 'first-pay', icon: '🧾', name: 'הוצאה ראשונה', how: 'לשלם על הוצאה אחת' },
  { id: 'pay-10', icon: '💸', name: 'הארנק של הקבוצה', how: 'לשלם על 10 הוצאות' },
  { id: 'journal-1', icon: '📔', name: 'כותבת', how: 'רשומה ראשונה ביומן' },
  { id: 'streak-3', icon: '🔥', name: '3 ימים ברצף', how: '3 ימים רצופים ביומן' },
  { id: 'streak-7', icon: '🌋', name: 'שבוע ברצף', how: '7 ימים רצופים ביומן' },
  { id: 'journal-30', icon: '📚', name: 'סופרת', how: '30 רשומות ביומן' },
  { id: 'challenge-1', icon: '🕵️', name: 'סוכנת', how: 'אתגר ראשון של זוהר' },
  { id: 'points-100', icon: '🏆', name: '100 נקודות', how: '100 נקודות באתגרים' },
  { id: 'points-500', icon: '👑', name: 'מלכת האתגרים', how: '500 נקודות באתגרים' },
  { id: 'wish-1', icon: '🌠', name: 'חלום שהתגשם', how: 'להגשים חלום אחד' },
  { id: 'photos-10', icon: '📸', name: 'צלמת', how: 'להעלות 10 תמונות' },
  { id: 'photo-prompt', icon: '🎯', name: 'אתגר צילום', how: 'להשתתף באתגר הצילום היומי' },
  { id: 'places-5', icon: '🗺️', name: 'חוקרת', how: 'להוסיף 5 נקודות במפה' },
  { id: 'song', icon: '🎵', name: 'די-ג׳יי', how: 'להוסיף שיר לפלייליסט' },
  { id: 'answers-5', icon: '❓', name: 'סקרנית', how: 'לענות על 5 שאלות יום' },
  { id: 'home', icon: '💖', name: 'בקשר עם הבית', how: 'לשלוח עדכון הביתה' },
  { id: 'quiz', icon: '🗣️', name: '¡Muy bien!', how: '4 ומעלה בחידון הספרדית' },
  { id: 'pretrip', icon: '✈️', name: 'מוכנה לטיסה', how: 'לסגור את כל הצ׳קליסט' },
  { id: 'medical', icon: '🩺', name: 'אחראית', how: 'למלא כרטיס חירום' },
];

function streak(days: string[]) {
  const set = new Set(days);
  let best = 0;
  for (const d of set) {
    const prev = new Date(d + 'T12:00:00Z'); prev.setUTCDate(prev.getUTCDate() - 1);
    if (set.has(prev.toISOString().slice(0, 10))) continue;  // לא תחילת רצף
    let n = 0; const cur = new Date(d + 'T12:00:00Z');
    while (set.has(cur.toISOString().slice(0, 10))) { n++; cur.setUTCDate(cur.getUTCDate() + 1); }
    best = Math.max(best, n);
  }
  return best;
}

/** כל הנתונים שצריך כדי לחשב תגים, וחישוב לכל מטיילת */
export function useBadges() {
  const exp = useTable<Expense>('expenses');
  const jr = useTable<JournalEntry>('journal_entries');
  const ch = useTable<Challenge>('challenges');
  const cd = useTable<ChallengeDone>('challenge_done');
  const wishes = useTable<Wish>('wishes');
  const photos = useTable<Photo>('photos');
  const places = useTable<Place>('places');
  const songs = useTable<Song>('songs');
  const answers = useTable<DailyAnswer>('daily_answers');
  const status = useTable<StatusUpdate>('status_updates');
  const quiz = useTable<QuizResult>('quiz_results');
  const ptTasks = useTable<PretripTask>('pretrip_tasks');
  const ptDone = useTable<PretripDone>('pretrip_done');
  const med = useTable<MedicalCard>('medical_cards');

  const points = (u: string) =>
    cd.rows.filter((d) => d.user_id === u).reduce((s, d) => s + (ch.rows.find((c) => c.id === d.challenge_id)?.points || 0), 0)
    + quiz.rows.filter((q) => q.user_id === u).reduce((s, q) => s + q.score * 5, 0);

  function earned(u: string): Set<string> {
    const s = new Set<string>();
    const paid = exp.rows.filter((e) => e.paid_by === u).length;
    if (paid >= 1) s.add('first-pay');
    if (paid >= 10) s.add('pay-10');
    const days = jr.rows.filter((e) => e.created_by === u).map((e) => e.day);
    if (days.length >= 1) s.add('journal-1');
    const st = streak(days);
    if (st >= 3) s.add('streak-3');
    if (st >= 7) s.add('streak-7');
    if (days.length >= 30) s.add('journal-30');
    if (cd.rows.some((d) => d.user_id === u)) s.add('challenge-1');
    const p = points(u);
    if (p >= 100) s.add('points-100');
    if (p >= 500) s.add('points-500');
    if (wishes.rows.some((w) => w.created_by === u && w.done)) s.add('wish-1');
    const myPhotos = photos.rows.filter((x) => x.created_by === u);
    if (myPhotos.length >= 10) s.add('photos-10');
    if (myPhotos.some((x) => (x as any).prompt_day)) s.add('photo-prompt');
    if (places.rows.filter((x) => x.created_by === u).length >= 5) s.add('places-5');
    if (songs.rows.some((x) => x.created_by === u)) s.add('song');
    if (answers.rows.filter((x) => x.created_by === u).length >= 5) s.add('answers-5');
    if (status.rows.some((x) => x.created_by === u)) s.add('home');
    if (quiz.rows.some((q) => q.user_id === u && q.score >= 4)) s.add('quiz');
    if (ptTasks.rows.length && ptTasks.rows.every((t) => ptDone.rows.some((d) => d.task_id === t.id && d.user_id === u))) s.add('pretrip');
    if (med.rows.some((m) => m.user_id === u && (m.blood_type || m.allergies || m.insurance))) s.add('medical');
    return s;
  }
  const loading = exp.loading || jr.loading || cd.loading;
  return { earned, points, loading };
}
