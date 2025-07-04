import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// Toast Context
const ToastContext = createContext();

// Toast Types
const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    className: 'bg-green-50 border-green-200 text-green-800',
    iconClassName: 'text-green-400'
  },
  error: {
    icon: AlertCircle,
    className: 'bg-red-50 border-red-200 text-red-800',
    iconClassName: 'text-red-400'
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    iconClassName: 'text-yellow-400'
  },
  info: {
    icon: Info,
    className: 'bg-blue-50 border-blue-200 text-blue-800',
    iconClassName: 'text-blue-400'
  }
};

// Individual Toast Component
const Toast = ({ toast, onRemove }) => {
  const { type, title, message, duration } = toast;
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const Icon = config.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onRemove(toast.id), duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, onRemove]);

  return (
    <div className={`flex items-start p-4 mb-3 border rounded-lg shadow-lg animate-in slide-in-from-right-full ${config.className}`}>
      <Icon className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${config.iconClassName}`} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-1">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-sm space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      ...toast
    };
     
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const toast = {
    success: (message, title, options = {}) =>
      addToast({ type: 'success', message, title, ...options }),
     
    error: (message, title, options = {}) =>
      addToast({ type: 'error', message, title, ...options }),
     
    warning: (message, title, options = {}) =>
      addToast({ type: 'warning', message, title, ...options }),
     
    info: (message, title, options = {}) =>
      addToast({ type: 'info', message, title, ...options }),
     
    custom: (options) => addToast(options),
     
    remove: removeToast,
    removeAll: removeAllToasts
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};


export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Optional: Also export ToastContext if you want to use it directly
export { ToastContext };