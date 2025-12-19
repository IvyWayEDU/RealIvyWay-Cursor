'use client';

import { useState, useEffect, useRef } from 'react';
import { Session } from '@/lib/auth/types';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  serviceType: 'Tutoring' | 'Counseling' | 'Test Prep' | 'College Planning';
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount?: number;
}

interface MessagesClientProps {
  session: Session;
  userRole: 'student' | 'provider';
}

// Mock conversations data
const getMockConversations = (userId: string, userRole: 'student' | 'provider'): Conversation[] => {
  if (userRole === 'student') {
    return [
      {
        id: '1',
        participantId: 'tutor1',
        participantName: 'Dr. Sarah Chen',
        serviceType: 'Tutoring',
        lastMessage: 'Great work on the practice problems! Let\'s review the next chapter.',
        lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        unreadCount: 0,
      },
      {
        id: '2',
        participantId: 'counselor1',
        participantName: 'Michael Rodriguez',
        serviceType: 'Counseling',
        lastMessage: 'I\'ve reviewed your application materials. They look strong!',
        lastMessageTime: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        unreadCount: 2,
      },
      {
        id: '3',
        participantId: 'tutor2',
        participantName: 'Prof. James Wilson',
        serviceType: 'Test Prep',
        lastMessage: 'The SAT practice test results are in. We can go over them in our next session.',
        lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        unreadCount: 0,
      },
    ];
  } else {
    // Provider view
    return [
      {
        id: '1',
        participantId: 'student1',
        participantName: 'Emma Thompson',
        serviceType: 'Tutoring',
        lastMessage: 'Thank you for the help with calculus! I understand it much better now.',
        lastMessageTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        unreadCount: 0,
      },
      {
        id: '2',
        participantId: 'student2',
        participantName: 'Alex Johnson',
        serviceType: 'Test Prep',
        lastMessage: 'Can we schedule an extra session before the exam?',
        lastMessageTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        unreadCount: 1,
      },
      {
        id: '3',
        participantId: 'student3',
        participantName: 'Maya Patel',
        serviceType: 'Counseling',
        lastMessage: 'I have a question about the essay requirements.',
        lastMessageTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        unreadCount: 0,
      },
    ];
  }
};

// Mock messages for a conversation
const getMockMessages = (conversationId: string, userId: string, participantId: string, userRole: 'student' | 'provider'): Message[] => {
  const isStudent = userRole === 'student';
  const messages: Message[] = [
    {
      id: '1',
      senderId: participantId,
      senderName: conversationId === '1' ? (isStudent ? 'Dr. Sarah Chen' : 'Emma Thompson') : 'Michael Rodriguez',
      text: conversationId === '1' 
        ? 'Hello! I\'m looking forward to working with you.' 
        : 'Hi there! How can I help you today?',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      id: '2',
      senderId: userId,
      senderName: 'You',
      text: conversationId === '1'
        ? 'Thank you! I\'m excited to get started.'
        : 'I have some questions about my application.',
      timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    },
    {
      id: '3',
      senderId: participantId,
      senderName: conversationId === '1' ? (isStudent ? 'Dr. Sarah Chen' : 'Emma Thompson') : 'Michael Rodriguez',
      text: conversationId === '1'
        ? 'Great! Let\'s schedule our first session. What times work best for you?'
        : 'Of course! I\'d be happy to help. What would you like to know?',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      id: '4',
      senderId: userId,
      senderName: 'You',
      text: conversationId === '1'
        ? 'I\'m available most afternoons after 3 PM.'
        : 'I\'m wondering about the essay requirements and deadlines.',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    },
    {
      id: '5',
      senderId: participantId,
      senderName: conversationId === '1' ? (isStudent ? 'Dr. Sarah Chen' : 'Emma Thompson') : 'Michael Rodriguez',
      text: conversationId === '1'
        ? 'Perfect! I have availability this Thursday at 4 PM. Does that work?'
        : 'The essay requirements are detailed in the application portal. The deadline is typically in early January.',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      id: '6',
      senderId: userId,
      senderName: 'You',
      text: conversationId === '1'
        ? 'Yes, that works perfectly! See you then.'
        : 'Thank you for the information. I\'ll check the portal.',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
  ];

  // Add the last message from the conversation
  const conversation = getMockConversations(userId, userRole).find(c => c.id === conversationId);
  if (conversation) {
    messages.push({
      id: '7',
      senderId: conversation.participantId,
      senderName: conversation.participantName,
      text: conversation.lastMessage,
      timestamp: conversation.lastMessageTime,
    });
  }

  return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) {
    return 'Just now';
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const formatMessageTime = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (messageDate.getTime() === today.getTime() - 86400000) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
};

export default function MessagesClient({ session, userRole }: MessagesClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversations = getMockConversations(session.userId, userRole);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      const conversationMessages = getMockMessages(conversationId, session.userId, conversation.participantId, userRole);
      setMessages(conversationMessages);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !selectedConversationId) return;

    const conversation = conversations.find(c => c.id === selectedConversationId);
    if (!conversation) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: session.userId,
      senderName: 'You',
      text: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Update the conversation's last message
    const updatedConversation = conversations.find(c => c.id === selectedConversationId);
    if (updatedConversation) {
      updatedConversation.lastMessage = inputValue.trim();
      updatedConversation.lastMessageTime = new Date();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedConversation = selectedConversationId
    ? conversations.find(c => c.id === selectedConversationId)
    : null;

  return (
    <div className="h-[calc(100vh-16rem)] flex rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
      {/* Left Panel - Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
          <p className="mt-1 text-sm text-gray-500">
            {userRole === 'student' ? 'Chat with your tutors and counselors' : 'Chat with your students'}
          </p>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {conversations.map((conversation) => {
                const isSelected = selectedConversationId === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-[#0088CB] bg-opacity-10 border-l-4 border-[#0088CB]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-[#0088CB]' : 'text-gray-900'
                          }`}>
                            {conversation.participantName}
                          </h3>
                          {conversation.unreadCount && conversation.unreadCount > 0 && !isSelected && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0088CB] text-white text-xs font-medium flex items-center justify-center">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 text-xs font-medium ${
                          isSelected ? 'text-[#0088CB]' : 'text-gray-500'
                        }`}>
                          {conversation.serviceType}
                        </p>
                        <p className={`mt-2 text-sm truncate ${
                          isSelected ? 'text-gray-700' : 'text-gray-600'
                        }`}>
                          {conversation.lastMessage}
                        </p>
                      </div>
                    </div>
                    <p className={`mt-2 text-xs ${
                      isSelected ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {formatTime(conversation.lastMessageTime)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedConversation.participantName}</h3>
                  <p className="text-sm text-gray-500">{selectedConversation.serviceType}</p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isOwnMessage = message.senderId === session.userId;
                  const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                  const showTime = index === messages.length - 1 || 
                    messages[index + 1].senderId !== message.senderId ||
                    new Date(messages[index + 1].timestamp).getTime() - new Date(message.timestamp).getTime() > 5 * 60 * 1000; // 5 minutes

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                        showAvatar ? 'mt-6' : 'mt-1'
                      }`}
                    >
                      {!isOwnMessage && showAvatar && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0088CB] flex items-center justify-center text-white text-xs font-semibold mr-3">
                          {message.senderName.charAt(0)}
                        </div>
                      )}
                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <span className={`text-xs font-medium mb-1 ${
                            isOwnMessage ? 'text-gray-600' : 'text-gray-500'
                          }`}>
                            {isOwnMessage ? 'You' : message.senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isOwnMessage
                              ? 'bg-[#0088CB] text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <p className={`text-sm ${isOwnMessage ? 'text-white' : 'text-gray-900'}`}>
                            {message.text}
                          </p>
                        </div>
                        {showTime && (
                          <span className={`text-xs mt-1 ${
                            isOwnMessage ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {formatMessageTime(message.timestamp)}
                          </span>
                        )}
                      </div>
                      {isOwnMessage && showAvatar && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-semibold ml-3">
                          {session.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message…"
                    rows={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent resize-none text-sm overflow-y-auto"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                    inputValue.trim()
                      ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Select a conversation to start chatting</h3>
              <p className="mt-2 text-sm text-gray-500">
                Choose a conversation from the list to view and send messages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
