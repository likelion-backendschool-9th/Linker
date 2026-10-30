'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { Role, UserStatus } from './route-access';

/** What client components may know about the viewer (serializable; from the root layout's session). */
export type ClientViewer = {
  role: Role;
  login: string | null;
  status: UserStatus | null;
  suspendedUntil: string | null;
};

const ViewerContext = createContext<ClientViewer>({
  role: 'guest',
  login: null,
  status: null,
  suspendedUntil: null,
});

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: ClientViewer;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ClientViewer {
  return useContext(ViewerContext);
}
