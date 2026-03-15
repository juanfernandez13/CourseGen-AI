'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('ifce-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ifce-theme', theme);
  }, [theme]);

  function toggle() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

/* ─── Toggle Button ─────────────────────────────────────────────────────────── */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
      style={{
        background: 'var(--primary-dim)',
        border: '1px solid var(--border)',
        color: 'var(--header-text)',
      }}
    >
      {isDark ? (
        /* Sun */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="2"  x2="12" y2="4"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="2"  y1="12" x2="4"  y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        /* Moon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
