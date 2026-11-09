import { ApiError } from '@/lib/api/api-error';
import { buildMetadata } from '@/lib/seo/metadata';

import { InviteAcceptArea } from './_components/invite-accept-area/InviteAcceptArea';
import { getInvite, type Invite } from './_lib/get-invite';

/** Static title + root default OG; never team-name OG (POL-T-2 / blueprint §8-3). */
export async function generateMetadata({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  return buildMetadata({ title: '팀 초대', path: `/invite/${code}` });
}

const FALLBACK: Omit<Invite, 'code'> = {
  status: 'REVOKED',
  team: { id: 0 },
  participation: { state: 'ELIGIBLE' },
};

export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  let invite: Invite;
  try {
    invite = await getInvite(code);
  } catch (error) {
    if (!(error instanceof ApiError && [404, 410].includes(error.status))) throw error;
    invite = { code, ...FALLBACK };
  }

  return <InviteAcceptArea invite={invite} />;
}
