/** Accepts only same-origin paths: starts with `/`, never `//` or `/\` (blueprint §4-3). */
export function safeReturnTo(value: string | null | undefined, fallback = '/feed'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
