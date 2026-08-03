'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* Navegação real do header. Os itens anteriores (Disciplinas, Nova, Templates,
 * Atividade) eram decorativos: <button> sem handler e sem destino. */
const LINKS = [
  { href: '/',              label: 'Gerador' },
  { href: '/cadastro-lote', label: 'Cadastro em lote' },
  { href: '/datas',         label: 'Datas das aulas' },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex items-center gap-0.5 text-[12.5px]">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="px-2.5 py-1.5 rounded-[5px] transition-colors"
            style={{
              background: active ? 'var(--surface-3)' : 'transparent',
              color:      active ? 'var(--ink)'        : 'var(--ink-2)',
              fontWeight: active ? 500 : 400,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
