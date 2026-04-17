export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect', dir: 'ltr' },
  { code: 'en',   label: 'English', dir: 'ltr' },
  { code: 'ur',   label: 'Urdu — اردو', dir: 'rtl' },
  { code: 'ar',   label: 'Arabic — العربية', dir: 'rtl' },
  { code: 'so',   label: 'Somali — Soomaali', dir: 'ltr' },
  { code: 'pl',   label: 'Polish — Polski', dir: 'ltr' },
  { code: 'ro',   label: 'Romanian — Română', dir: 'ltr' },
  { code: 'pa',   label: 'Punjabi — ਪੰਜਾਬੀ', dir: 'ltr' },
];

export function getLanguageByCode(code) {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
}

export function isRTL(code) {
  const lang = getLanguageByCode(code);
  return lang.dir === 'rtl';
}
