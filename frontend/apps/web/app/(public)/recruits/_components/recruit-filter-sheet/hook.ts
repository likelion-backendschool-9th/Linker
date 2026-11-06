'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueryStates } from 'nuqs';
import { useState } from 'react';

import { techTagsOptions } from '@/features/tech-tags/tech-tag-queries';
import { useOverlay, type OverlayControl } from '@/lib/navigation/use-overlay';

import { recruitFilterParsers, type RecruitFilters } from '../../_lib/recruit-filters';

type Draft = Pick<RecruitFilters, 'role' | 'tech' | 'mode'>;

const CLEARED: Draft = { role: null, tech: null, mode: null };

export function useRecruitFilterSheet() {
  return useOverlay('recruit-filter');
}

export function useFilterFields(overlay: OverlayControl) {
  const [filters, setFilters] = useQueryStates(recruitFilterParsers, { history: 'replace' });
  const [draft, setDraft] = useState<Draft>({
    role: filters.role,
    tech: filters.tech,
    mode: filters.mode,
  });
  const tags = useQuery(techTagsOptions());
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return {
    draft,
    tags,
    change,
    clearDraft: () => setDraft(CLEARED),
    apply: () => void overlay.closeAnd(() => setFilters(draft)),
  };
}
