import { clear as idbClear } from 'idb-keyval';
import { supabase } from './supabase';

/** מוחק מהטלפון את כל המידע של האפליקציה (מסמכים שמורים, סיסמאות, רשימות, תור שינויים) ומנתק.
 *  משמש כשהמנהל ניתק את המשתמשת מרחוק (טלפון שנגנב). המפות הלא-מקוונות והגופנים נשארים: אין בהם מידע אישי. */
let wiping = false;
export const isWiping = () => wiping;
export async function wipeThisDevice(reason: 'revoked' | 'expired') {
  if (wiping) return; // ההתנתקות עצמה מפעילה אירוע "יצאת"; לא מוחקים פעמיים
  wiping = true;
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
  try { await idbClear(); } catch { /* ignore */ }
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try { localStorage.setItem('trip:wipedNotice', reason); } catch { /* ignore */ }
  location.replace(location.pathname + '#/');
  location.reload();
}
