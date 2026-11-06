import { apiFetch } from '@/lib/api/api-fetch';

/**
 * `[Included]` job ads of WBS 24 (blueprint ch. 15). The item carries no URL: a tap records the
 * click and returns it. Shared by 24 feed and 04's job ad sheet (blueprint §3-3).
 */
export type RecruiterAd = {
  adId: number;
  companyName: string;
  title: string;
  /** `JobCategory` key (ERD) */
  jobCategory: string;
  /** `yyyy-MM-dd` */
  closesOn: string;
};

const adPath = (adId: number) => `/api/v1/user/ads/${adId}`;

export function clickAd(adId: number) {
  return apiFetch<{ url: string }>(`${adPath(adId)}/click`, { method: 'POST' });
}

/** X: hidden for 7 days; the toast's "되돌리기" undoes it */
export function dismissAd(adId: number, dismiss: boolean) {
  return apiFetch<void>(`${adPath(adId)}/dismiss`, { method: dismiss ? 'POST' : 'DELETE' });
}

/** "이 광고 숨기기": never shown again */
export function hideAd(adId: number) {
  return apiFetch<void>(`${adPath(adId)}/hide`, { method: 'POST' });
}
