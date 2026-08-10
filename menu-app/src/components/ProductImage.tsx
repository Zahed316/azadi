import { useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

/**
 * Renders a product image with monogram fallback.
 * Falls back to a first-letter monogram tile when:
 * - src is null/undefined
 * - the image fails to load (onError)
 */
export default function ProductImage({ src, alt, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const initial = alt.trim().charAt(0) || '?';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--accent-light, #d4a574)',
        color: '#fff',
        fontSize: 28,
        fontWeight: 700,
        borderRadius: 8,
        aspectRatio: '3 / 2',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
