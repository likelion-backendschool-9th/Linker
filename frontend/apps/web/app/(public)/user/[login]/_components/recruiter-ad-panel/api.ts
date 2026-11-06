import {
  getMyJobAd as getMyJobAdApi,
  saveMyJobAd as saveMyJobAdApi,
  updateMyJobAdStatus as updateMyJobAdStatusApi,
} from '@linker/api/p04-profile/p04-profile';
import type { RecruiterAdResponse } from '@linker/api/openAPIDefinition.schemas';

export const RECRUITER_JOB_AD_QUERY_KEY = ['recruiter-job-ad'] as const;

export type JobAdStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'HIDDEN';

export type JobAd = {
  id: number;
  status: JobAdStatus;
  jobCategory: string;
  title: string;
  url: string;
  closesOn: string;
};

export type MyJobAd = {
  subscribed: boolean;
  ad: JobAd | null;
};

export type SaveMyJobAdBody = {
  jobCategory: string;
  title: string;
  url: string;
  closesOn: string;
};

export function readAd(data: RecruiterAdResponse): MyJobAd {
  const ad = data.ad;
  const status = ad?.status;
  if (
    !ad ||
    ad.id == null ||
    (status !== 'ACTIVE' && status !== 'PAUSED' && status !== 'ENDED' && status !== 'HIDDEN') ||
    !ad.jobCategory ||
    !ad.title ||
    !ad.url ||
    !ad.closesOn
  ) {
    return { subscribed: Boolean(data.subscribed), ad: null };
  }
  return {
    subscribed: Boolean(data.subscribed),
    ad: {
      id: ad.id,
      status,
      jobCategory: ad.jobCategory,
      title: ad.title,
      url: ad.url,
      closesOn: ad.closesOn,
    },
  };
}

export async function getMyJobAd() {
  return readAd(await getMyJobAdApi());
}

export async function saveMyJobAd(body: SaveMyJobAdBody) {
  return readAd(await saveMyJobAdApi(body));
}

export async function updateMyJobAdStatus(body: { status: 'ACTIVE' | 'PAUSED' }) {
  return readAd(await updateMyJobAdStatusApi(body));
}
