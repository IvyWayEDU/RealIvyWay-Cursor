'use client';

interface ZoomJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  hideConfirm?: boolean;
  hideCancel?: boolean;
}

export default function ZoomJoinModal({
  isOpen,
  onClose,
  title = 'Confirm Join',
  message,
  onConfirm,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  hideConfirm = false,
  hideCancel = false,
}: ZoomJoinModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-[100svh] items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-white/35 backdrop-blur-md backdrop-saturate-150 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-5 sm:p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="-m-2 p-2 text-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-700">{message}</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {!hideCancel && (
              <button
                onClick={onClose}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 sm:py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            {!hideConfirm && (
              <button
                onClick={() => {
                  onConfirm?.();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 sm:py-2 bg-[#0088CB] text-white text-sm font-medium rounded-md hover:bg-[#0077B3] transition-colors"
              >
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

