import type {
  VerifyInstallationRequest,
  VerifyInstallationResponse,
} from '@linker/api/openAPIDefinition.schemas';

export const verifiedInstallationKey = (login: string | null) =>
  ['team-setup', 'verified-installation', login] as const;
export const createdSetupTeamKey = (login: string | null) =>
  ['team-setup', 'created-team', login] as const;

export type InstalledOrganization = VerifyInstallationResponse & {
  result: 'INSTALLED';
  installationId: string;
  org: { id: number; login: string; avatarUrl?: string };
};

export function isInstalledOrganization(
  value: VerifyInstallationResponse | undefined,
): value is InstalledOrganization {
  return !!(
    value?.result === 'INSTALLED' &&
    value.installationId &&
    /^[0-9]{1,19}$/.test(value.installationId) &&
    value.org?.id &&
    value.org.login &&
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value.org.login)
  );
}

/** URL fields are input to server verification, never proof of an installation. */
export function installationRequest(params: URLSearchParams): VerifyInstallationRequest | null {
  const state = params.get('state');
  const installationId = params.get('installation_id');
  const setupAction = params.get('setup_action');
  if (!state || state.length > 128 || params.getAll('state').length !== 1) return null;
  if (
    installationId !== null &&
    (params.getAll('installation_id').length !== 1 || !/^[0-9]{1,19}$/.test(installationId))
  )
    return null;
  if (
    setupAction !== null &&
    (params.getAll('setup_action').length !== 1 || !/^(install|update|request)$/.test(setupAction))
  )
    return null;
  if (!installationId && setupAction !== 'request') return null;
  return {
    state,
    ...(installationId ? { installationId } : {}),
    ...(setupAction ? { setupAction } : {}),
  };
}
