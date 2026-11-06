import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'outline' | 'soft' | 'danger';
  /** Full width of the container (sheet actions, forms) */
  block?: boolean;
  /** Render the child (e.g. a `<Link>`) with button styles instead of a `<button>` */
  asChild?: boolean;
};

/** The pill button of guide ch. 5. Navigation stays a `<Link>` via `asChild`. */
export function Button({
  variant = 'primary',
  block = false,
  asChild = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], block && styles.block, className]
    .filter(Boolean)
    .join(' ');
  if (asChild) return <Slot.Root className={classes} {...props} />;
  return <button type={type} className={classes} {...props} />;
}
