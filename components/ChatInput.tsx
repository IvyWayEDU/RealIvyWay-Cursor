'use client';

import React, { useEffect, useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';

const BRAND = '#0088CB';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function ChatInput(props: {
  inputId: string;
  input: string;
  onInputChange: (value: string, el: HTMLTextAreaElement) => void;
  canSend: boolean;
  sendLabel: string;
  onSend: (raw: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  error?: string | null;
  formClassName?: string;
  formStyle?: React.CSSProperties;
  rowClassName?: string;
}) {
  const {
    inputId,
    input,
    onInputChange,
    canSend,
    sendLabel,
    onSend,
    fileInputRef,
    error,
    formClassName,
    formStyle,
    rowClassName,
  } = props;

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className={classNames(
        'sticky bottom-0 z-50 w-full',
        'bg-white',
        'border-t border-[#e5e7eb]',
        formClassName
      )}
      style={formStyle}
      onSubmit={(e) => {
        e.preventDefault();
        void onSend(input);
      }}
    >
      <div
        className={classNames(
          'flex w-full items-end gap-3 px-6 py-3',
          rowClassName
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.txt,.doc,.docx"
          aria-label="Attach a file"
        />

        <button
          type="button"
          className={classNames(
            'inline-flex h-11 w-11 items-center justify-center rounded-xl',
            'border border-[#e5e7eb] bg-[#f9fafb] text-gray-700',
            'transition-colors hover:bg-white',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
          )}
          style={{ outlineColor: BRAND }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a file or photo"
        >
          <Paperclip className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            Ask me anything
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (e.shiftKey) return;
              if ((e.nativeEvent as unknown as { isComposing?: boolean } | null)?.isComposing) return;
              e.preventDefault();
              if (!canSend) return;
              void onSend(input);
            }}
            placeholder="Ask me anything..."
            rows={1}
            className={classNames(
              'w-full',
              'min-h-11 rounded-2xl px-4 py-3 text-base',
              'bg-[#f9fafb] text-[#111827]',
              'border border-[#e5e7eb]',
              'placeholder:text-[#9ca3af]',
              'focus:outline-none focus:ring-2 focus:ring-[#0088CB]/25 focus:border-[#0088CB]',
              'resize-none overflow-y-auto leading-6'
            )}
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          className={classNames(
            'inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm',
            'transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            canSend ? 'bg-[#0088cb] hover:bg-[#007ab8]' : 'cursor-not-allowed bg-[#0088cb] opacity-50'
          )}
          style={{ outlineColor: BRAND }}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={sendLabel}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="px-6 pb-3">
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </div>
      ) : null}
    </form>
  );
}

export default React.memo(ChatInput);

