'use client';

// real reuse: profile/report navigation from the stats and admin detail sheets
import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentProps } from 'react';
import type { OverlayControl } from '@/lib/navigation/use-overlay';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Route; overlay: OverlayControl };

/** Real navigation link; closes our sheet history entry before same-tab navigation. */
export function OverlayLink({ overlay, href, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== '_self')
        )
          return;
        event.preventDefault();
        void overlay.closeThen(href);
      }}
    />
  );
}
