/** First external preview and first Linker card are counted separately (POL-C-7). */
export function messageUrls(text: string) {
  return [...text.matchAll(/https?:\/\/[^\s<>"']+/g)].flatMap(([value]) => {
    try {
      const url = new URL(value.replace(/[.,!?;:)\]}]+$/, ''));
      return url.username || url.password ? [] : [url];
    } catch {
      return [];
    }
  });
}

export function firstExternalUrl(text: string, origins: string[]) {
  return (
    messageUrls(text).find((url) => url.protocol === 'https:' && !origins.includes(url.origin))
      ?.href ?? null
  );
}

export function firstLinkerPath(text: string, origins: string[]) {
  return (
    messageUrls(text)
      .find(
        (url) =>
          origins.includes(url.origin) &&
          /^\/(?:posts\/\d+|recruits\/\d+|user\/[\w-]+)\/?$/.test(url.pathname),
      )
      ?.pathname.replace(/\/$/, '') ?? null
  );
}
