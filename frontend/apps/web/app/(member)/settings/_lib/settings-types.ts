export type SettingsData = {
  github: { login: string; connected: boolean } | null;
  notificationEmail: string;
  pushEnabled: boolean;
  plan: { name: string; label: string; kind: 'PRO' | 'FLEX' | 'SCOUT'; renewsOn?: string };
};

export type WithdrawalCheck = { ownedTeams: { id: number; name: string }[] };
