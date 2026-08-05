import { useState } from 'react';

interface ToastData {
  msg: string;
  kind: 'success' | 'error';
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>
  );
}
