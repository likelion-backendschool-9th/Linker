import type { InstallUrlResponse } from '@linker/api/openAPIDefinition.schemas';

/** Use the server-issued state without turning an arbitrary API URL into a navigation target. */
export function installDestination(response: InstallUrlResponse, origin: string): URL {
  if (!response.installUrl || !response.state) throw new Error('invalid-install-url');
  const destination = new URL(response.installUrl, origin);
  if (destination.username || destination.password || destination.hash)
    throw new Error('invalid-install-url');
  if (
    destination.searchParams.getAll('state').length !== 1 ||
    destination.searchParams.get('state') !== response.state
  ) {
    throw new Error('invalid-install-state');
  }
  // Same-origin callbacks also let the existing development API keep the same cookie context.
  const callback = destination.origin === origin && destination.pathname === '/teams/new/callback';
  const github =
    destination.protocol === 'https:' &&
    destination.hostname === 'github.com' &&
    !destination.port &&
    /^\/apps\/[a-zA-Z0-9-]+\/installations\/new\/?$/.test(destination.pathname);
  if (!callback && !github) throw new Error('invalid-install-url');
  return destination;
}
