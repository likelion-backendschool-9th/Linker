export type PublicProfile = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string | null;
  githubUrl: string;
  userType: 'DEVELOPER' | 'RECRUITER';
  kind: 'DEVELOPER' | 'RECRUITER';
  bio: string | null;
  blogUrl: string | null;
  techStack: string[];
  lookingForTeam: boolean;
  jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
  followerCount: number;
  followingCount: number;
  completion: { projectCount: number; issueCompletionRate: number };
  joinedAt: string;
  isMe: boolean;
  isFollowing: boolean;
  isBlockedByMe: boolean;
  redirectedFrom: string | null;
  company: string | null;
  jobTitle: string | null;
  companyEmailDomain: string | null;
  websiteUrl: string | null;
  pinnedPostIds: number[];
};

export type ProfilePerson = {
  user: Pick<PublicProfile, 'id' | 'login' | 'name' | 'avatarUrl' | 'userType' | 'jobStatus'>;
  isFollowing: boolean;
};

export type ProfilePeopleResponse = { items: ProfilePerson[]; nextCursor: string | null };

export const profileQueryKey = (login: string) => ['public-profile', login] as const;
