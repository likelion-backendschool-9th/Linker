import { installationRequest, isInstalledOrganization } from './installation';

it('passes callback fields only as input to server verification', () => {
  expect(
    installationRequest(
      new URLSearchParams('installation_id=777&state=issued&setup_action=install&org=forged'),
    ),
  ).toEqual({ installationId: '777', state: 'issued', setupAction: 'install' });
  expect(installationRequest(new URLSearchParams('state=issued&setup_action=request'))).toEqual({
    state: 'issued',
    setupAction: 'request',
  });
});

it.each([
  '',
  'installation_id=777',
  'state=',
  'state=issued',
  'state=issued&installation_id=777&installation_id=888',
  'state=issued&state=other&installation_id=777',
  'state=issued&installation_id=1e9',
  'state=issued&installation_id=-1',
  'state=issued&installation_id=777&setup_action=unknown',
  'state=issued&installation_id=777&setup_action=install&setup_action=update',
  `state=${'x'.repeat(129)}&installation_id=777`,
])('rejects incomplete or ambiguous callback input: %s', (search) => {
  expect(installationRequest(new URLSearchParams(search))).toBeNull();
});

it('requires an installed result, installation ID and safe organization login from the API', () => {
  const installed = {
    result: 'INSTALLED',
    installationId: '777',
    org: { id: 501, login: 'my-new-org' },
    teamId: null,
  } as const;
  expect(isInstalledOrganization(installed)).toBe(true);
  expect(isInstalledOrganization(undefined)).toBe(false);
  expect(isInstalledOrganization({ ...installed, result: 'ALREADY_LINKED' })).toBe(false);
  expect(
    isInstalledOrganization({
      ...installed,
      org: { ...installed.org, login: 'github.com/forged' },
    }),
  ).toBe(false);
  expect(isInstalledOrganization({ ...installed, installationId: null })).toBe(false);
});
