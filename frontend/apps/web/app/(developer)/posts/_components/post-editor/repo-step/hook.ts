'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useViewer } from '@/lib/auth/viewer-context';

import { editorReposOptions } from './api';

const SEARCH_DELAY_MS = 300;

type RepoStepArgs = {
  teamId: string | null;
  repoId: number | null;
  onSelect: (repoId: number) => void;
};

export function useRepoStep({ teamId, repoId, onSelect }: RepoStepArgs) {
  const id = useId();
  const viewer = useViewer();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);
  const repos = useQuery(editorReposOptions(viewer.login, q, teamId));
  const items = repos.data?.items ?? [];
  const selectable = items.filter((repo) => !repo.alreadyPosted);

  // Coming from a team: preselect when exactly one of its repos can still be posted
  useEffect(() => {
    if (teamId && repoId === null && selectable.length === 1) onSelect(selectable[0]!.repoId);
  }, [teamId, repoId, selectable, onSelect]);

  const [missing, setMissing] = useState(false);

  return {
    id,
    text,
    setText,
    q,
    repos,
    items,
    missing,
    setMissing,
  };
}
