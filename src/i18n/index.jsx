import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import bn from './bn.js';

const Ctx = createContext({ t: (s) => s, lang: 'en', setLang: () => {} });

const detect = () => {
  try {
    const saved = localStorage.getItem('em-lang');
    if (saved === 'bn' || saved === 'en') return saved;
    return (navigator.language || '').toLowerCase().startsWith('bn') ? 'bn' : 'en';
  } catch (e) { return 'en'; }
};

// English strings are the keys. Bengali comes from ./bn.js; a missing translation falls back to English.
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => {
    try { localStorage.setItem('em-lang', l); } catch (e) { /* ignore */ }
    setLangState(l);
  }, []);
  const t = useCallback((text, vars) => {
    let s = lang === 'bn' && bn[text] ? bn[text] : text;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ t, lang, setLang }), [t, lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
