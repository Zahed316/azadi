interface ErrorStateProps {
  /** The error message from TanStack Query */
  message?: string;
  /** Callback for retry button — typically () => queryClient.invalidateQueries(...) */
  onRetry?: () => void;
  /** Optional secondary text */
  detail?: string;
}

export default function ErrorState({ message, onRetry, detail }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert" aria-live="assertive">
      <svg
        className="error-state__icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <p className="error-state__message">{message || 'خطا در بارگذاری'}</p>
      {detail && <p className="error-state__detail">{detail}</p>}
      {onRetry && (
        <button
          className="btn-primary"
          onClick={() => {
            void onRetry();
          }}
        >
          تلاش مجدد
        </button>
      )}
    </section>
  );
}
