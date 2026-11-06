import type { MockRoute } from './core/define';
import { routes as p00 } from './pages/p00-common';
import { routes as p01 } from './pages/p01-login';
import { routes as p02 } from './pages/p02-onboarding';
import { routes as p03 } from './pages/p03-legal';
import { routes as p04 } from './pages/p04-profile';
import { routes as p05 } from './pages/p05-profile-edit';
import { routes as p06 } from './pages/p06-settings';
import { routes as p07 } from './pages/p07-workspace';
import { routes as p08 } from './pages/p08-team-create';
import { routes as p09 } from './pages/p09-team-settings';
import { routes as p10 } from './pages/p10-invite';
import { routes as p11 } from './pages/p11-issue-list';
import { routes as p12 } from './pages/p12-issue-detail';
import { routes as p13 } from './pages/p13-issue-create';
import { routes as p14 } from './pages/p14-board';
import { routes as p15 } from './pages/p15-calendar';
import { routes as p16 } from './pages/p16-chat-list';
import { routes as p17 } from './pages/p17-chat-room';
import { routes as p18 } from './pages/p18-notifications';
import { routes as p19 } from './pages/p19-recruit-list';
import { routes as p20 } from './pages/p20-recruit-editor';
import { routes as p21 } from './pages/p21-recruit-detail';
import { routes as p22 } from './pages/p22-post-editor';
import { routes as p23 } from './pages/p23-post-detail';
import { routes as p24 } from './pages/p24-feed';
import { routes as p25 } from './pages/p25-admin-reports';
import { routes as p26 } from './pages/p26-admin-users';
import { routes as p27 } from './pages/p27-admin-audit';
import { routes as p28 } from './pages/p28-subscribe';
import { routes as p29 } from './pages/p29-subscription-manage';
import { routes as p30 } from './pages/p30-stats';
import { routes as p31 } from './pages/p31-recruiter-signup';
import { routes as p32 } from './pages/p32-recruiter-login';
import { routes as p33 } from './pages/p33-recruiter-offers';

/** Every mock route, one file per page (blueprint §1-2). A new page adds its file here. */
export const routes: MockRoute[] = [
  ...p00,
  ...p01,
  ...p02,
  ...p03,
  ...p04,
  ...p05,
  ...p06,
  ...p07,
  ...p08,
  ...p09,
  ...p10,
  ...p11,
  ...p12,
  ...p13,
  ...p14,
  ...p15,
  ...p16,
  ...p17,
  ...p18,
  ...p19,
  ...p20,
  ...p21,
  ...p22,
  ...p23,
  ...p24,
  ...p25,
  ...p26,
  ...p27,
  ...p28,
  ...p29,
  ...p30,
  ...p31,
  ...p32,
  ...p33,
];
