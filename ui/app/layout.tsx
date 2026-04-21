import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, ThemeToggle } from './components/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CourseGen AI',
  description: 'Gerador inteligente de pacotes MBZ para Moodle com IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Sync theme before first paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('ifce-theme');
            document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
          })();
        `}} />
      </head>
      <body className="min-h-screen antialiased" style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
        <ThemeProvider>
          {/* Header */}
          <header style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
            <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 font-black text-sm select-none"
                  style={{ background: 'var(--primary)', color: '#fff', letterSpacing: '-0.5px' }}
                >
                  AI
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--header-text)' }}>
                    CourseGen
                    <span style={{ margin: '0 4px', opacity: 0.6, fontSize: '0.7em', verticalAlign: 'middle', letterSpacing: '0.05em' }}>AI</span>
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: 'var(--header-sub)' }}>
                    Gerador inteligente de backup MBZ
                  </span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-6 py-10">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
