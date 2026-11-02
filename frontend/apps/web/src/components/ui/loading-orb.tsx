'use client';

// Client boundary: Canvas capability/token resolution and the WebView app lifecycle.
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { ThinkingOrb } from 'thinking-orbs';

import { onNativeMessage } from '@/lib/bridge/native';

import styles from './loading-indicator.module.css';

type OrbProps = {
  variant: 'block' | 'inline';
  tone: 'inherit' | 'inverse' | 'danger';
};

/** A failed decorative renderer must never replace a page with its error boundary. */
class OrbBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Internal adapter. Screens use LoadingIndicator; its text also survives without JS/Canvas. */
export function LoadingOrb({ variant, tone }: OrbProps) {
  const [color, setColor] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const attach = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node) return;
      try {
        const style = window.getComputedStyle(node);
        const ink =
          tone === 'inverse'
            ? style.getPropertyValue('--color-on-primary').trim()
            : tone === 'danger'
              ? style.getPropertyValue('--color-status-error').trim()
              : style.color;
        const supported =
          typeof CanvasRenderingContext2D !== 'undefined' &&
          document.createElement('canvas').getContext('2d') !== null;
        // The vendor parser accepts resolved hex/rgb, not CSS var()/modern color functions.
        setColor(supported && /^(#[\da-f]{3,8}\b|rgba?\()/i.test(ink) ? ink : null);
      } catch {
        setColor(null);
      }
    },
    [tone],
  );

  useEffect(
    () =>
      onNativeMessage((message) => {
        if (message.type === 'APP_STATE') setPaused(message.state !== 'active');
      }),
    [],
  );

  const fallback = <span className={styles.fallback} />;
  return (
    <span
      ref={attach}
      aria-hidden="true"
      className={`${styles.orb} ${styles[variant]} ${styles[tone]}`}
      data-loading-orb="composing"
    >
      {color ? (
        <OrbBoundary key={`${tone}:${color}`} fallback={fallback}>
          <ThinkingOrb
            state="composing"
            size={variant === 'block' ? 64 : 20}
            theme={tone === 'inverse' ? 'dark' : 'light'}
            color={color}
            speed={1}
            paused={paused}
            aria-hidden="true"
          />
        </OrbBoundary>
      ) : (
        fallback
      )}
    </span>
  );
}
