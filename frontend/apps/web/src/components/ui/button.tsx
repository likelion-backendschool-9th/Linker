import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import styles from './button.module.css';
import { LoadingIndicator } from './loading-indicator';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'outline' | 'soft' | 'danger';
  /** Full width of the container (sheet actions, forms) */
  block?: boolean;
  /** Render the child (e.g. a `<Link>`) with button styles instead of a `<button>` */
} & (
    | { asChild: true; pending?: never; pendingLabel?: never }
    | { asChild?: false; pending?: boolean; pendingLabel?: string }
  );

/** The pill button of guide ch. 5. Navigation stays a `<Link>` via `asChild`. */
export function Button({
  variant = 'primary',
  block = false,
  asChild = false,
  className,
  type = 'button',
  pending = false,
  pendingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], block && styles.block, className]
    .filter(Boolean)
    .join(' ');
  if (asChild) {
    const slotProps = { ...props, disabled };
    return (
      <Slot.Root className={classes} {...slotProps}>
        {children}
      </Slot.Root>
    );
  }
  const button = (
    <button
      type={type}
      className={classes}
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || props['aria-busy'] || undefined}
    >
      {pending ? (
        <>
          <span className={styles.pendingContent}>{children}</span>
          <span className={styles.pendingOrb} aria-hidden="true">
            <LoadingIndicator
              label={pendingLabel ?? '불러오는 중…'}
              labelHidden
              announce={false}
              tone={variant === 'primary' ? 'inverse' : variant === 'danger' ? 'danger' : 'inherit'}
            />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
  return pending && pendingLabel ? (
    <>
      {button}
      <span className="sr-only" role="status">
        {pendingLabel}
      </span>
    </>
  ) : (
    button
  );
}
