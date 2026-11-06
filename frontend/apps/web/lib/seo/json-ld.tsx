/**
 * `<script type="application/ld+json">` for indexed pages (blueprint §8-3). Server components only;
 * every `<` is escaped so user text can't close the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
