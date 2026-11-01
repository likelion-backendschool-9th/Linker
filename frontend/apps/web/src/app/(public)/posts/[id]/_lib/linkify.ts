/**
 * Post bodies are plain text with only line breaks and links (POL-P-2): split a line into text and
 * `https://` URLs so the URLs can become links. Trailing punctuation stays text.
 */
export type BodyPart = { kind: 'text' | 'link'; value: string };

const URL_PATTERN = /https:\/\/[^\s<>"]+[^\s<>".,!?)\]}'"]/g;

export function linkify(text: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) });
    parts.push({ kind: 'link', value: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}
