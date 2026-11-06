'use client';

import { useQuery } from '@tanstack/react-query';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { myTeamsOptions } from './api';

export function useTeamSwitcher() {
  const overlay = useOverlay('team-switcher');
  const teams = useQuery({ ...myTeamsOptions(), enabled: overlay.isOpen });

  return { overlay, teams };
}
