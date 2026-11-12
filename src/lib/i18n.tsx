import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'id' | 'en';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'id', setLang: () => {} });

const KEY = 'gx_lang';

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** L('teks indonesia', 'english text') */
export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const L = useCallback((id: string, en: string) => (lang === 'en' ? en : id), [lang]);
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  return { lang, setLang, L, locale };
}
