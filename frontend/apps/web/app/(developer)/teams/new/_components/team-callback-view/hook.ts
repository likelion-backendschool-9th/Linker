'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { SETUP_OUTCOMES } from '../team-setup-outcome';

export function useTeamCallbackView() {
  const [preview, setPreview] = useQueryState(
    'preview',
    parseAsStringLiteral(SETUP_OUTCOMES).withDefault('UNVERIFIED'),
  );

  return {
    preview,
    setPreview: (value: (typeof SETUP_OUTCOMES)[number]) => void setPreview(value),
  };
}
