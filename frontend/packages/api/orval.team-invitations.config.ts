import { createOrvalConfig } from './orval.config';

if (!process.env.TEAM_INVITATIONS_OPENAPI_FILE) {
  throw new Error('Run pnpm --filter @linker/api generate:team-invitations');
}
export default createOrvalConfig(process.env.TEAM_INVITATIONS_OPENAPI_FILE, 'src/team-invitations');
