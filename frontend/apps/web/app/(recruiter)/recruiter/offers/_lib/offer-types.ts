export const OFFER_STATUSES = ['TALKING', 'WAITING', 'NO_RESPONSE'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type OfferDeveloper = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  userType: 'DEVELOPER';
  jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
};

export type Offer = {
  roomId: number;
  status: OfferStatus;
  developer: OfferDeveloper | null;
  unavailable: boolean;
  techStack: string[];
  firstMessage: string;
  sentAt: string;
};

export type OffersResponse = { items: Offer[] };
export type OfferCounts = Record<OfferStatus, number>;
export type OfferFirstMessage = { roomId: number; text: string; sentAt: string | null };

export function isOfferStatus(value: string | undefined): value is OfferStatus {
  return OFFER_STATUSES.includes(value as OfferStatus);
}
