import React from 'react';
import { useToastStore } from '../store/useToastStore';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-lg border ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-100 text-red-800'
                : toast.type === 'success'
                ? 'bg-green-50 border-green-100 text-green-800'
                : 'bg-surface-container-lowest border-surface-container-highest text-on-surface'
            }`}
          >
            <div className="flex-1 whitespace-pre-wrap text-sm font-medium leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-on-surface-variant hover:text-on-surface mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
