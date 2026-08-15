import { useState, useRef, useEffect } from 'react';

interface BranchOption {
  id: number;
  name: string;
}

interface BranchSelectorProps {
  branches: BranchOption[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

export default function BranchSelector({ branches, selectedId, onChange }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedName = branches.find((b) => b.id === selectedId)?.name;

  return (
    <div className="branch-selector" ref={containerRef}>
      <button
        type="button"
        className="branch-selector-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span dir="auto">📍 {selectedName ?? 'همه شعب'}</span>
        <span className="branch-selector-arrow">{isOpen ? '▴' : '▾'}</span>
      </button>
      {isOpen && (
        <div className="branch-selector-dropdown" role="listbox">
          <button
            type="button"
            className={`branch-selector-option${selectedId === null ? ' active' : ''}`}
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            role="option"
            aria-selected={selectedId === null}
          >
            همه شعب
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`branch-selector-option${selectedId === b.id ? ' active' : ''}`}
              onClick={() => {
                onChange(b.id);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={selectedId === b.id}
              dir="auto"
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
