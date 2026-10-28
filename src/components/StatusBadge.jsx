import { STATUS_TONE, statusLabel } from '../utils/format.js';

export default function StatusBadge({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${STATUS_TONE[status]} ${className}`}>
      <span className="led" aria-hidden="true" />
      <span className="text-ink">{statusLabel(status)}</span>
    </span>
  );
}
