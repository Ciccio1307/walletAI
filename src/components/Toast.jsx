import { useState, useCallback, createContext, useContext, useRef } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success', action = null) => {
    clearTimeout(timerRef.current);
    setToast({ message, type, id: Date.now(), action });
    timerRef.current = setTimeout(() => setToast(null), action ? 4500 : 2600);
  }, []);

  function handleAction() {
    toast?.action?.fn?.();
    clearTimeout(timerRef.current);
    setToast(null);
  }

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.type}${toast.action ? ' toast-with-action' : ''}`}>
          <span>{toast.type === 'success' ? '✓' : '✕'} {toast.message}</span>
          {toast.action && (
            <button className="toast-action-btn" onClick={handleAction}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
