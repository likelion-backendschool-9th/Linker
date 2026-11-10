'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOpenExternal } from '@/features/external-link/use-open-external';
import type { RoomMessage } from '../../_lib/room-api';
import { myTeamsOptions } from './api';
import { continuesPrGroup, prEventDetails } from './model';

export function usePrEventCard(message: RoomMessage, previousMessage?: RoomMessage) {
  const details = prEventDetails(message);
  const showOrganization = !continuesPrGroup(previousMessage, message);
  const teams = useQuery({
    ...myTeamsOptions(),
    enabled: showOrganization && !!details.organization,
    // Multiple visible groups reuse one team-list query instead of refetching on every card mount.
    refetchOnMount: false,
  });
  const avatarUrl = teams.data?.items.find(
    (team) => team.chatRoomId === message.roomId,
  )?.orgAvatarUrl;
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  return {
    ...details,
    showOrganization,
    avatarUrl: avatarUrl && failedAvatar !== avatarUrl ? avatarUrl : null,
    onAvatarError: () => setFailedAvatar(avatarUrl ?? null),
    openExternal: useOpenExternal(),
  };
}
