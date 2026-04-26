import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, ThemeToggle } from './components/ThemeProvider';
import SettingsButton from './components/SettingsButton';

export const metadata: Metadata = {
  title: 'CourseGen AI',
  description: 'Gerador inteligente de pacotes MBZ para Moodle com IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('ifce-theme');
            document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
          })();
        `}} />
      </head>
      <body className="min-h-screen antialiased bg-[var(--bg)] text-[var(--text-1)]">
        <ThemeProvider>
          {/* BNav — dir-b: dense top bar, logo + links + utilities */}
          <header
            className="h-12 flex items-center px-4 border-b shrink-0 sticky top-0 z-30 backdrop-blur-sm"
            style={{
              background: 'color-mix(in srgb, var(--header-bg) 92%, transparent)',
              borderColor: 'var(--header-border)',
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-6">
              <div
                className="relative w-[18px] h-[18px] rounded-[4px]"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              >
                <div
                  className="absolute inset-[4px] rounded-[1.5px]"
                  style={{ background: 'var(--header-bg)' }}
                />
              </div>
              <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--header-text)' }}>
                CourseGen
              </span>
              <span
                className="font-mono-ui text-[10.5px] px-1.5 py-px rounded-[3px]"
                style={{ color: 'var(--ink-3)', border: '1px solid var(--line)' }}
              >
                v0.4
              </span>
            </div>

            {/* Nav links (purely visual; single page app) */}
            <nav className="hidden sm:flex items-center gap-0.5 text-[12.5px]">
              {[
                { label: 'Disciplinas', active: true },
                { label: 'Nova',        active: false },
                { label: 'Templates',   active: false },
                { label: 'Atividade',   active: false },
              ].map(({ label, active }) => (
                <button
                  key={label}
                  type="button"
                  className="px-2.5 py-1.5 rounded-[5px] transition-colors"
                  style={{
                    background: active ? 'var(--surface-3)' : 'transparent',
                    color:      active ? 'var(--ink)'        : 'var(--ink-2)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Right utilities */}
            <div className="ml-auto flex items-center gap-2.5">
              <div
                className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-[5px] text-[11.5px]"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink-3)',
                }}
              >
                <span className="font-mono-ui">⌘K</span>
                <span className="w-px h-3" style={{ background: 'var(--line)' }} />
                <span>buscar…</span>
              </div>
              <SettingsButton />
              <ThemeToggle />
              <div
                className="w-[22px] h-[22px] rounded-full text-[10px] text-white grid place-items-center font-semibold"
                style={{ background: 'linear-gradient(135deg, #f472b6, var(--accent))' }}
                title="Sua conta"
              >
                JF
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
