'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function useHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = pathname === '/feed' ? params.get('q') ?? '' : '';
  const source = `${pathname}?${query}`;
  const [draft, setDraft] = useState({ source, value: query });
  // Reset only when URL navigation changes the source (including browser back/forward).
  if (draft.source !== source) setDraft({ source, value: query });
  const value = draft.source === source ? draft.value : query;
  const setValue = (next: string) => setDraft({ source, value: next });

  function search() {
    const title = value.trim();
    setValue(title);
    router.push((title ? `/feed?${new URLSearchParams({ q: title })}` : '/feed') as Route);
  }

  function clear() {
    setValue('');
    if (query) router.push('/feed');
  }

  return { value, setValue, search, clear };
}
