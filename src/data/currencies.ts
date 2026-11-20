// מטבעות מקומיים בדרך
export const CURRENCIES: { code: string; name: string; symbol: string; country: string }[] = [
  { code: 'USD', name: 'דולר', symbol: '$', country: 'ארה"ב, אקוודור' },
  { code: 'ILS', name: 'שקל', symbol: '₪', country: 'ישראל' },
  { code: 'PEN', name: 'סול', symbol: 'S/', country: 'פרו' },
  { code: 'BOB', name: 'בוליביאנו', symbol: 'Bs', country: 'בוליביה' },
  { code: 'ARS', name: 'פסו ארגנטינאי', symbol: '$', country: 'ארגנטינה' },
  { code: 'CLP', name: 'פסו צ׳יליאני', symbol: '$', country: 'צ׳ילה' },
  { code: 'BRL', name: 'ריאל', symbol: 'R$', country: 'ברזיל' },
  { code: 'COP', name: 'פסו קולומביאני', symbol: '$', country: 'קולומביה' },
  { code: 'MXN', name: 'פסו מקסיקני', symbol: '$', country: 'מקסיקו' },
  { code: 'UYU', name: 'פסו אורוגוואי', symbol: '$', country: 'אורוגוואי' },
  { code: 'GTQ', name: 'קצאל', symbol: 'Q', country: 'גואטמלה' },
  { code: 'CRC', name: 'קולון', symbol: '₡', country: 'קוסטה ריקה' },
];
export const currencyName = (c: string) => CURRENCIES.find((x) => x.code === c)?.name || c;
