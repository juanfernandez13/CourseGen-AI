'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'coursegen.ui.version';

export type UiVersion = 'v1' | 'v2';

export function getStoredVersion(): UiVersion {
  if (typeof localStorage === 'undefined') return 'v1';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'v2' ? 'v2' : 'v1';
}

export default function VersionToggle() {
  const pathname = usePathname() || '/';
  const isV2 = pathname.startsWith('/v2');
  const current: UiVersion = isV2 ? 'v2' : 'v1';

  function persist(v: UiVersion) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  }

  const items: { v: UiVersion; href: string; label: string }[] = [
    { v: 'v1', href: '/',   label: 'v1' },
    { v: 'v2', href: '/v2', label: 'v2' },
  ];

  return (
    <div
      className="flex items-center overflow-hidden rounded-[5px] font-mono-ui text-[10.5px]"
      style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
    >
      {items.map((item, i) => {
        const on = current === item.v;
        return (
          <Link
            key={item.v}
            href={item.href}
            onClick={() => persist(item.v)}
            className="px-2 py-1 transition-colors"
            style={{
              background: on ? 'var(--surface-3)' : 'transparent',
              color:      on ? 'var(--ink)'        : 'var(--ink-3)',
              borderRight: i === 0 ? '1px solid var(--line)' : 'none',
              fontWeight: on ? 600 : 400,
              letterSpacing: 0.4,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
