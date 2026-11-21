import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { WelcomeLetter } from '../lib/types';
import LetterReveal from './LetterReveal';

type Ctx = { letter: WelcomeLetter | null; replay: () => void };
const LetterCtx = createContext<Ctx>({ letter: null, replay: () => {} });
export const useMyLetter = () => useContext(LetterCtx);

/** המכתב האישי: נפתח לבד בכניסה הראשונה אחרי ההשקה (מסד הנתונים מחזיר אותו רק אחרי ההשקה) */
export function LetterProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [letter, setLetter] = useState<WelcomeLetter | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!me?.is_traveler) { setLetter(null); return; }
    supabase.from('welcome_letters').select('*').eq('user_id', me.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setLetter(data as WelcomeLetter);
      if (!data.opened_at) setShow(true);
    });
  }, [me?.id]);
  async function close() {
    setShow(false);
    if (letter && !letter.opened_at) {
      await supabase.rpc('mark_letter_opened');
      setLetter({ ...letter, opened_at: new Date().toISOString() });
    }
  }
  return (
    <LetterCtx.Provider value={{ letter, replay: () => setShow(true) }}>
      {children}
      {show && letter && me && <LetterReveal name={me.display_name.split(' ')[0]} text={letter.content} onClose={close} />}
    </LetterCtx.Provider>
  );
}

/** כפתור לקריאה חוזרת, בדף הבית */
export function ReplayLetter() {
  const { letter, replay } = useMyLetter();
  if (!letter) return null;
  return <button className="replay-letter" onClick={replay}>💌 המכתב מזוהר</button>;
}
