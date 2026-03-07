'use client';

import { useEffect } from 'react';

interface CancelSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isCancelling?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export default function CancelSessionModal({
  isOpen,
  onClose,
  onConfirm,
  isCancelling = false,
  disabled = false,
  disabledReason,
}: CancelSessionModalProps) {
  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCancelling) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isCancelling, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={disabled ? undefined : onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-slide-up">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Cancel Session?
            </h3>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {disabled && disabledReason ? (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 font-medium mb-1">
                  Cancellation Not Available
                </p>
                <p className="text-sm text-yellow-700">{disabledReason}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                This action cannot be undone.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Keep Session
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled || isCancelling}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCancelling ? (
                <span className="flex items-center gap-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Cancelling...
                </span>
              ) : (
                'Cancel Session'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}







