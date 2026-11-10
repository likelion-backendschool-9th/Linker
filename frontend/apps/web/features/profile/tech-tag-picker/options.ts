export type TechTagOption = { id: number; name: string };
export type VisibleTechTag = TechTagOption & { label: string };

/** Keep profile and onboarding sheets in the same curated order and with the same labels. */
export const TECH_TAG_SUGGESTIONS = [
  { name: 'TypeScript', label: 'TypeScript' },
  { name: 'React', label: 'React' },
  { name: 'Next.js', label: 'Next.js' },
  { name: 'Expo', label: 'Expo' },
  { name: 'React Native', label: 'React Native' },
  { name: 'Java', label: 'Java' },
  { name: 'Spring Boot', label: 'Spring Boot' },
  { name: 'Spring Security', label: 'Spring Security' },
  { name: 'JPA', label: 'JPA' },
  { name: 'PostgreSQL', label: 'PostgreSQL' },
  { name: 'Redis', label: 'Redis' },
  { name: 'WebSocket', label: 'WebSocket' },
  { name: 'STOMP', label: 'STOMP' },
  { name: 'CSS Modules', label: 'CSS Modules' },
  { name: 'TanStack Query', label: 'TanStack Query' },
  { name: 'Docker', label: 'Docker' },
  { name: 'Nginx', label: 'Nginx' },
  { name: 'Figma', label: 'Figma' },
  { name: 'Node.js', label: 'node.js' },
  { name: 'Kubernetes', label: 'kubernetes' },
] as const;

export function getVisibleTechTags(tags: TechTagOption[]): VisibleTechTag[] {
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
  const included = new Set<string>();

  return TECH_TAG_SUGGESTIONS.flatMap(({ name, label }) => {
    const tag = tagByName.get(name);
    if (!tag || included.has(tag.name)) return [];
    included.add(tag.name);
    return [{ ...tag, label }];
  });
}
