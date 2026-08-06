import { toPersianDigits } from '../utils/numbers';

interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
}

export default function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{toPersianDigits(String(value))}</div>
      {hint && <div className="stat-tile-hint">{hint}</div>}
    </div>
  );
}
