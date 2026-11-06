'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useOpenExternal } from '@/features/external-link/use-open-external';

import { readmeOptions } from '../../_lib/post-detail-queries';

export function useReadmeSection(postId: string) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const readme = useQuery({ ...readmeOptions(postId), enabled: open });
  const openExternal = useOpenExternal();

  return {
    bodyId: `${id}-body`,
    open,
    toggle: () => setOpen((current) => !current),
    readme,
    openExternal,
  };
}
