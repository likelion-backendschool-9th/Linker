import styles from './Icon.module.css';

type IconProps = {
  /** Raw SVG markup string exported by a `@solar-icons/static/*` module (`stroke="currentColor"`). */
  svg: string;
  className?: string;
};

/** Sizes a Solar Icons SVG string via CSS (`--icon-size`) instead of the module's baked-in width/height. */
export function Icon({ svg, className }: IconProps) {
  return (
    <span
      aria-hidden
      className={`${styles.icon} ${className ?? ''}`}
      // Solar's multi-path icons ship a newline between tags; strip it so it doesn't leak into
      // an ancestor link/button's textContent as a stray whitespace node.
      dangerouslySetInnerHTML={{ __html: svg.replace(/>\s+</g, '><') }}
    />
  );
}
