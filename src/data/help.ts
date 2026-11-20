// מספרי חירום מקומיים. לבדוק שוב בכל מדינה כשמגיעות (בהוסטל או באתר הרשמי).
export const EMERGENCY: { country: string; numbers: { label: string; n: string }[] }[] = [
  { country: 'פרו', numbers: [{ label: 'משטרה', n: '105' }, { label: 'אמבולנס', n: '106' }, { label: 'כבאות', n: '116' }] },
  { country: 'בוליביה', numbers: [{ label: 'משטרה', n: '110' }, { label: 'אמבולנס', n: '118' }, { label: 'כבאות', n: '119' }] },
  { country: 'צ׳ילה', numbers: [{ label: 'משטרה', n: '133' }, { label: 'אמבולנס', n: '131' }, { label: 'כבאות', n: '132' }] },
  { country: 'ארגנטינה', numbers: [{ label: 'חירום', n: '911' }, { label: 'אמבולנס', n: '107' }, { label: 'כבאות', n: '100' }] },
  { country: 'ברזיל', numbers: [{ label: 'משטרה', n: '190' }, { label: 'אמבולנס', n: '192' }, { label: 'כבאות', n: '193' }] },
  { country: 'קולומביה', numbers: [{ label: 'חירום', n: '123' }] },
  { country: 'אקוודור', numbers: [{ label: 'חירום', n: '911' }] },
  { country: 'מקסיקו', numbers: [{ label: 'חירום', n: '911' }] },
  { country: 'קוסטה ריקה', numbers: [{ label: 'חירום', n: '911' }] },
  { country: 'אורוגוואי', numbers: [{ label: 'חירום', n: '911' }] },
  { country: 'ארה"ב', numbers: [{ label: 'חירום', n: '911' }] },
];

export const PHRASES: { group: string; items: { he: string; es: string; say: string }[] }[] = [
  { group: 'בסיס', items: [
    { he: 'שלום', es: 'Hola', say: 'אולה' },
    { he: 'תודה רבה', es: 'Muchas gracias', say: 'מוצ׳אס גרסיאס' },
    { he: 'בבקשה', es: 'Por favor', say: 'פור פבור' },
    { he: 'סליחה', es: 'Disculpe', say: 'דיסקולפה' },
    { he: 'אני לא מדברת ספרדית טוב', es: 'No hablo bien español', say: 'נו אבלו ביין אספניול' },
    { he: 'את/ה מדבר/ת אנגלית?', es: '¿Habla inglés?', say: 'אבלה אינגלס?' },
  ]},
  { group: 'קניות', items: [
    { he: 'כמה זה עולה?', es: '¿Cuánto cuesta?', say: 'קואנטו קואסטה?' },
    { he: 'זה יקר מדי', es: 'Es muy caro', say: 'אס מוי קארו' },
    { he: 'אפשר הנחה?', es: '¿Me hace un descuento?', say: 'מה אסה און דסקואנטו?' },
    { he: 'אפשר לשלם בכרטיס?', es: '¿Puedo pagar con tarjeta?', say: 'פואדו פגאר קון טרחטה?' },
  ]},
  { group: 'אוכל', items: [
    { he: 'אני צמחונית', es: 'Soy vegetariana', say: 'סוי וחטריאנה' },
    { he: 'החשבון, בבקשה', es: 'La cuenta, por favor', say: 'לה קואנטה, פור פבור' },
    { he: 'בלי חריף', es: 'Sin picante', say: 'סין פיקנטה' },
    { he: 'מים בבקבוק', es: 'Agua embotellada', say: 'אגואה אמבוטיז׳אדה' },
  ]},
  { group: 'התמצאות', items: [
    { he: 'איפה השירותים?', es: '¿Dónde está el baño?', say: 'דונדה אסטה אל באניו?' },
    { he: 'איפה תחנת האוטובוס?', es: '¿Dónde está la terminal de buses?', say: 'דונדה אסטה לה טרמינל דה בוסס?' },
    { he: 'כמה זמן לוקח להגיע?', es: '¿Cuánto tiempo se tarda?', say: 'קואנטו טיימפו סה טרדה?' },
    { he: 'שמאלה / ימינה / ישר', es: 'Izquierda / derecha / recto', say: 'איסקיירדה / דרצ׳ה / רקטו' },
  ]},
  { group: 'לינה', items: [
    { he: 'יש לי הזמנה', es: 'Tengo una reserva', say: 'טנגו אונה רסרבה' },
    { he: 'יש חדר פנוי?', es: '¿Hay una habitación libre?', say: 'אי אונה אביטסיון ליברה?' },
    { he: 'הסיסמה לוויי-פיי?', es: '¿Cuál es la clave del wifi?', say: 'קואל אס לה קלבה דל וויפי?' },
  ]},
  { group: 'חירום', items: [
    { he: 'עזרה!', es: '¡Ayuda!', say: 'איודה!' },
    { he: 'צריך רופא', es: 'Necesito un médico', say: 'נססיטו און מדיקו' },
    { he: 'גנבו לי את התיק', es: 'Me robaron la mochila', say: 'מה רובארון לה מוצ׳ילה' },
    { he: 'אני מרגישה רע (גובה)', es: 'Me siento mal, es la altura', say: 'מה סיינטו מאל, אס לה אלטורה' },
    { he: 'תתקשר/י למשטרה', es: 'Llame a la policía', say: 'יאמה א לה פוליסיה' },
  ]},
];
