import { z } from 'zod';

/**
 * Web ↔ app message contract (blueprint §11-2). Both sides import these types and schemas.
 * The JWT never crosses the bridge; the app keeps only `userId` / `userType`.
 */

export const BRIDGE_VERSION = 1;
export const BRIDGE_SOURCE = 'linker';

const id = z.string().min(1);

export const sessionSchema = z.object({
  userId: z.number(),
  userType: z.enum(['DEVELOPER', 'RECRUITER']),
});

export const webToNativeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('READY') }),
  z.object({ type: z.literal('BACK_RESULT'), id, handled: z.boolean() }),
  z.object({ type: z.literal('EXIT_APP') }),
  z.object({ type: z.literal('AUTH_GITHUB_START'), id, authorizeUrl: z.url() }),
  z.object({ type: z.literal('AUTH_SESSION_SAVE'), session: sessionSchema }),
  z.object({ type: z.literal('AUTH_SESSION_CLEAR') }),
  z.object({
    type: z.literal('SHARE'),
    id,
    title: z.string(),
    text: z.string().optional(),
    url: z.url(),
  }),
  z.object({ type: z.literal('PUSH_PERMISSION_REQUEST'), id }),
  z.object({ type: z.literal('OPEN_EXTERNAL'), url: z.url({ protocol: /^https$/ }) }),
  z.object({ type: z.literal('HAPTIC'), style: z.enum(['light', 'success', 'error']) }),
]);

export const nativeToWebSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BACK_PRESSED'), id }),
  // ok: true carries `payload`, ok: false carries `error` (e.g. 'cancelled', 'timeout')
  z.object({
    type: z.literal('RESULT'),
    id,
    ok: z.boolean(),
    payload: z.unknown().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('PUSH_TOKEN'),
    token: z.string(),
    platform: z.enum(['ios', 'android']),
  }),
  // Same-origin path only: starts with `/`, never `//` or `/\`
  z.object({ type: z.literal('DEEP_LINK'), path: z.string().regex(/^\/(?![/\\])/) }),
  z.object({ type: z.literal('APP_STATE'), state: z.enum(['active', 'background']) }),
]);

export type WebToNative = z.infer<typeof webToNativeSchema>;
export type NativeToWeb = z.infer<typeof nativeToWebSchema>;
export type BridgeSession = z.infer<typeof sessionSchema>;

/** One JSON string per message: `{ v, source: 'linker', msg }` */
const webToNativeEnvelope = z.object({
  v: z.literal(BRIDGE_VERSION),
  source: z.literal(BRIDGE_SOURCE),
  msg: webToNativeSchema,
});
const nativeToWebEnvelope = z.object({
  v: z.literal(BRIDGE_VERSION),
  source: z.literal(BRIDGE_SOURCE),
  msg: nativeToWebSchema,
});

export function encodeEnvelope(msg: WebToNative | NativeToWeb): string {
  return JSON.stringify({ v: BRIDGE_VERSION, source: BRIDGE_SOURCE, msg });
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** App side: `null` for anything that isn't a valid Linker message from the web. */
export function decodeWebToNative(raw: unknown): WebToNative | null {
  const parsed = webToNativeEnvelope.safeParse(parseJson(raw));
  return parsed.success ? parsed.data.msg : null;
}

/** Web side: `null` for anything that isn't a valid Linker message from the app. */
export function decodeNativeToWeb(raw: unknown): NativeToWeb | null {
  const parsed = nativeToWebEnvelope.safeParse(parseJson(raw));
  return parsed.success ? parsed.data.msg : null;
}
