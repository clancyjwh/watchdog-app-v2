import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in-right">
      <div className="bg-gray-900 text-white px-5 py-3.5 shadow-lg border border-gray-700 flex items-center gap-3 min-w-[280px]">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
