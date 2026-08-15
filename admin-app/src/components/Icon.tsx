interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

/**
 * Renders an SVG icon by referencing a symbol in the inline sprite.
 * The <IconSprite> component must be rendered once at the app root.
 */
export default function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <use href={`#icon-${name}`} />
    </svg>
  );
}
