'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { chatReposOptions, issueCardOptions, mentionCandidatesOptions } from '../_lib/chat-reference-api';
import { activeMention, canMentionAll, issueNumbers, mentionTokens, resolveMentions } from '../_lib/chat-references';
import type { ChatReferences } from '../_lib/chat-reference-types';
import type { RoomInfo } from '../_lib/room-api';

export function useChatReferences(room: RoomInfo | undefined, login: string | null, text: string, caret: number, disabled: boolean) {
  const team = room?.kind === 'TEAM' ? room.team : null;
  const enabled = !!team && !disabled;
  const tokens = mentionTokens(text);
  const active = enabled ? activeMention(text, caret) : null;
  const candidates = useQuery(mentionCandidatesOptions(login, room?.id ?? 0, enabled && (!!active || tokens.length > 0)));
  const numbers = team ? issueNumbers(text) : [];
  const repos = useQuery(chatReposOptions(login, team?.id ?? null, enabled && numbers.length > 0));
  const [choices, setChoices] = useState<Record<number, number>>({});
  const picker = useOverlay('chat-issue-repo');
  const getRepo = (number: number) => {
    const items = repos.data?.repos ?? [];
    return items.length === 1 ? items[0]!.id : items.find((repo) => repo.id === choices[number])?.id ?? null;
  };
  const cards = useQueries({ queries: numbers.map((number) => issueCardOptions(login, room!.id, number, getRepo(number), enabled && getRepo(number) !== null)) });
  const resolved = team ? resolveMentions(text, candidates.data?.items ?? []) : { mentionedUserIds: [], mentionAll: false };
  const forbiddenAll = resolved.mentionAll && !canMentionAll(team?.myRole);
  const needsCandidates = enabled && tokens.length > 0;
  const payload: ChatReferences = {
    ...resolved,
    issueRefs: numbers.flatMap((number, index) => cards[index]?.isSuccess ? [{ number, repoId: getRepo(number)! }] : []),
  };
  return {
    team, active, candidates, repos, cards, numbers, picker, getRepo, forbiddenAll, payload,
    canAll: canMentionAll(team?.myRole),
    blocked: forbiddenAll || (needsCandidates && !candidates.isSuccess) || numbers.some((_, index) => !cards[index]?.isSuccess),
    chooseRepo: (number: number, repoId: number) => {
      setChoices((previous) => ({ ...previous, [number]: repoId }));
      picker.close();
    },
    reset: () => setChoices({}),
  };
}
export type ChatReferenceControl = ReturnType<typeof useChatReferences>;
