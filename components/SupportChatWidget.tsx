'use client';

import { useState } from 'react';

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      // UI only - no actual sending logic
      setMessage('');
    }
  };

  const handleQuickAction = (action: string) => {
    // UI only - no actual logic
    setMessage(`${action} - `);
  };

  return (
    <>
      {/* Chat Bubble Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#0088CB] text-white shadow-lg hover:bg-[#0077B3] transition-all duration-200 hover:scale-110 flex items-center justify-center"
        aria-label="Open support chat"
      >
        {isOpen ? (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col animate-slide-up">
          {/* Header */}
          <div className="bg-[#0088CB] text-white px-4 py-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">IvyWay Support</h3>
                <p className="text-sm text-blue-100">How can we help you?</p>
              </div>
              <button
                onClick={toggleChat}
                className="text-white hover:text-blue-100 transition-colors"
                aria-label="Close chat"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {/* System Message */}
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200 max-w-[80%]">
                <p className="text-sm text-gray-700">
                  Hi! I'm IvyWay Support. Ask a question or request help.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="px-4 py-2 border-t border-gray-200 bg-white">
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => handleQuickAction('Booking help')}
                className="px-3 py-1.5 text-xs font-medium text-[#0088CB] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Booking help
              </button>
              <button
                onClick={() => handleQuickAction('Account help')}
                className="px-3 py-1.5 text-xs font-medium text-[#0088CB] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Account help
              </button>
              <button
                onClick={() => handleQuickAction('Billing questions')}
                className="px-3 py-1.5 text-xs font-medium text-[#0088CB] bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Billing questions
              </button>
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#0088CB] text-white rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!message.trim()}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
