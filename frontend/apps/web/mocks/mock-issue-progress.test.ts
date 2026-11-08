let mockFetch: typeof import('./mock-fetch').mockFetch;

beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  document.cookie = 'linker_mock_role=developer; path=/';
  mockFetch = (await import('./mock-fetch')).mockFetch;
});

afterEach(() => {
  document.cookie = 'linker_mock_role=; path=/; max-age=0';
  sessionStorage.clear();
});

type Day = { date: string; done: number; inProgress: number; blocked: number };

/** 11 demo trend (Figma 11 "최근 추이"): the shape rules the mock has to keep */
it('ends on the status-card counts and keeps the three lines apart before today', async () => {
  const progress = (await mockFetch('/api/v1/user/teams/1/progress?days=14')) as {
    counts: { done: number; inProgress: number; blocked: number };
    history: Day[];
  };
  const { history, counts } = progress;
  expect(history).toHaveLength(14);
  const today = history.at(-1)!;
  expect({ done: today.done, inProgress: today.inProgress, blocked: today.blocked }).toEqual({
    done: counts.done,
    inProgress: counts.inProgress,
    blocked: counts.blocked,
  });
  for (const day of history.slice(0, -1)) {
    expect(day.done).toBeGreaterThan(day.inProgress);
    expect(day.inProgress).toBeGreaterThan(day.blocked);
    expect(day.blocked).toBeGreaterThanOrEqual(0);
  }
  // Not flat: each line moves up and down at least once
  for (const key of ['done', 'inProgress', 'blocked'] as const) {
    const steps = history.slice(1).map((day, i) => day[key] - history[i]![key]);
    expect(steps.some((step) => step > 0)).toBe(true);
    expect(steps.some((step) => step < 0)).toBe(true);
  }
});
