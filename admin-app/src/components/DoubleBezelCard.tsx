import type { ReactNode, ElementType } from 'react';

type AsTag = 'div' | 'section' | 'article';

interface DoubleBezelCardProps<T extends AsTag = 'div'> {
  children: ReactNode;
  className?: string;
  as?: T;
}

export default function DoubleBezelCard<T extends AsTag = 'div'>({
  children,
  className,
  as,
}: DoubleBezelCardProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag className={`card-shell${className ? ` ${className}` : ''}`}>
      <div className="card-core">{children}</div>
    </Tag>
  );
}
