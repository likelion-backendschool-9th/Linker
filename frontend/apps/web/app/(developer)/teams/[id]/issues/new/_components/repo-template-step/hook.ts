'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';

import { createReposOptions, templatesOptions, type TemplateSummary } from './api';

export const SOURCE_HINT: Record<TemplateSummary['source'], string> = {
  REPO: '레포 템플릿',
  ORG: '조직 템플릿',
  DEFAULT: '기본 템플릿',
};

export type RepoTemplateStepProps = {
  teamId: string;
  /** Selection kept in the URL, so back from step 2 shows it again */
  repoId: number | null;
  templateKey: string | null;
  /** Writes the choice to the URL (replace), so back from step 2 shows it again */
  onSelect: (repoId: number | null, templateKey: string | null) => void;
  onNext: (repoId: number, templateKey: string) => void;
};

export function useRepoTemplateStep({
  teamId,
  repoId,
  templateKey,
  onSelect,
  onNext,
}: RepoTemplateStepProps) {
  const repos = useQuery(createReposOptions(teamId));
  const writable = repos.data?.items.filter((repo) => repo.canWrite) ?? [];
  const [picked, setRepo] = useState<number | null>(repoId);
  // With one writable repo it's chosen already, also when the list arrives after the first render
  const repo = picked ?? (writable.length === 1 ? writable[0]!.id : null);
  const [template, setTemplate] = useState<string | null>(templateKey);
  const [missing, setMissing] = useState<'repo' | 'template' | null>(null);
  const templates = useQuery({ ...templatesOptions(teamId, repo ?? 0), enabled: repo !== null });
  const id = useId();

  // Repo templates on top, the 3 defaults below (POL-I-1)
  const items = templates.data?.items ?? [];
  const groups = [
    { title: '레포 템플릿', items: items.filter((item) => item.source !== 'DEFAULT') },
    { title: '기본 템플릿', items: items.filter((item) => item.source === 'DEFAULT') },
  ].filter((group) => group.items.length > 0);

  function pickRepo(itemId: number) {
    setRepo(itemId);
    setTemplate(null);
    setMissing(null);
    onSelect(itemId, null);
  }

  function pickTemplate(key: string) {
    setTemplate(key);
    setMissing(null);
    if (repo !== null) onSelect(repo, key);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (repo === null) return setMissing('repo');
    if (!template || !items.some((item) => item.key === template)) return setMissing('template');
    onNext(repo, template);
  }

  return {
    repos,
    writable,
    repo,
    template,
    missing,
    templates,
    id,
    groups,
    pickRepo,
    pickTemplate,
    submit,
  };
}
