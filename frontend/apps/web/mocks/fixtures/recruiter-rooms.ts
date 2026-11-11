import type { MockRoom } from './chat';
import { ROOMS } from './chat';
import { OFFERS, type Offer } from '../pages/p33-recruiter-offers';

const CREATED_COOKIE = 'linker_mock_recruiter_rooms';
const CREATED_STORAGE = 'linker_mock_recruiter_rooms';

type CreatedRecruiterRoom = { room: MockRoom; offer: Offer };

function createdRooms(): CreatedRecruiterRoom[] {
  return ROOMS.filter((room) => room.id >= 9000).flatMap((room) => {
    const offer = OFFERS.find((item) => item.roomId === room.id);
    return offer ? [{ room, offer }] : [];
  });
}

function parseCreated(raw: string | null): CreatedRecruiterRoom[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CreatedRecruiterRoom[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeCreated(extras: CreatedRecruiterRoom[]) {
  for (const extra of extras) {
    const index = ROOMS.findIndex((room) => room.id === extra.room.id);
    if (index === -1) ROOMS.push(extra.room);
    else ROOMS[index] = extra.room;
    const offerIndex = OFFERS.findIndex((offer) => offer.roomId === extra.offer.roomId);
    if (offerIndex === -1) OFFERS.unshift(extra.offer);
    else OFFERS[offerIndex] = extra.offer;
  }
}

async function readCreated(): Promise<CreatedRecruiterRoom[]> {
  if (typeof window !== 'undefined') {
    const match = document.cookie.match(new RegExp(`(?:^|; )${CREATED_COOKIE}=([^;]*)`));
    const fromCookie = parseCreated(match?.[1] ? decodeURIComponent(match[1]) : null);
    if (fromCookie.length > 0) return fromCookie;
    try {
      return parseCreated(sessionStorage.getItem(CREATED_STORAGE));
    } catch {
      return [];
    }
  }
  try {
    const { cookies } = await import('next/headers');
    const raw = (await cookies()).get(CREATED_COOKIE)?.value;
    return parseCreated(raw ? decodeURIComponent(raw) : null);
  } catch {
    return [];
  }
}

/** Server renders of `/chats/{id}` see rooms the browser mock just created. */
export async function syncCreatedRecruiterRooms() {
  mergeCreated(await readCreated());
}

/** Browser only: keep rooms created from a profile across the next server render. */
export function persistCreatedRecruiterRooms() {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(createdRooms());
  try {
    sessionStorage.setItem(CREATED_STORAGE, payload);
  } catch {
    /* optional */
  }
  try {
    document.cookie = `${CREATED_COOKIE}=${encodeURIComponent(payload)}; path=/; samesite=lax`;
  } catch {
    /* optional */
  }
}
