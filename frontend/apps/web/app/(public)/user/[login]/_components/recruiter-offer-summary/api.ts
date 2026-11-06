import { apiFetch } from '@/lib/api/api-fetch';

export type OfferDeveloper = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string | null;
};

export type OfferSummary = {
  talkingCount: number;
  waitingCount: number;
  todayUsed: number;
  todayLimit: number;
  scoutTodayLimit: number;
  scoutSubscribed: boolean;
  latest: {
    roomId: number;
    developer: OfferDeveloper | null;
    status: 'TALKING' | 'WAITING' | 'NO_RESPONSE';
    sentAt: string;
  }[];
};

export function fetchOfferSummary() {
  return apiFetch<OfferSummary>('/api/v1/recruiter/offers/summary');
}
