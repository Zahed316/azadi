import { useState, useRef, useEffect } from 'react';

interface ToastData {
  msg: string;
  kind: 'success' | 'error';
}

// eslint-disable-next-line react-refresh/only-export-components -- useToast hook intentionally co-located with the Toast component export
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, kind });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  };

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role="alert" aria-live="assertive">
      {toast.msg}
    </div>
  );
}
