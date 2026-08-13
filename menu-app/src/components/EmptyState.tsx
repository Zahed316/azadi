interface EmptyStateProps {
  /** Primary message — e.g. "محصولی یافت نشد" */
  message: string;
  /** Optional secondary explanation */
  detail?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional icon character or emoji — defaults to coffee cup */
  icon?: string;
}

export default function EmptyState({ message, detail, action, icon = '☕' }: EmptyStateProps) {
  return (
    <section className="empty-state" role="status" aria-live="polite">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state__message">{message}</p>
      {detail && <p className="empty-state__detail">{detail}</p>}
      {action && (
        <button className="btn-ghost" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}
