import 'server-only';

import { cache } from 'react';

import { apiFetch } from '@/lib/api/api-fetch';
import type { PublicProfile } from '@/features/profile/profile-types';

export const getPublicProfile = cache((login: string) =>
  apiFetch<PublicProfile>(`/api/v1/public/users/${encodeURIComponent(login)}`),
);
