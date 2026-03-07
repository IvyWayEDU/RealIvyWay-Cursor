'use client';

/**
 * Notifications Component
 * 
 * Displays dismissible dashboard notifications.
 * Notifications appear once and don't reappear after dismissal.
 */

import { useState, useEffect } from 'react';
import { getNotifications, dismissNotificationAction } from '@/lib/notifications/actions';
import { Notification } from '@/lib/notifications/storage';

interface NotificationsProps {
  userId: string;
}

export default function Notifications({ userId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadNotifications();
    }
  }, [userId]);

  async function loadNotifications() {
    try {
      const notifs = await getNotifications(userId);
      setNotifications(notifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss(notificationId: string) {
    try {
      const success = await dismissNotificationAction(notificationId, userId);
      if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  }

  if (loading || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`rounded-lg shadow-lg p-4 border-l-4 ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-500'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-500'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-500'
              : 'bg-blue-50 border-blue-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <p
              className={`text-sm font-medium ${
                notification.type === 'success'
                  ? 'text-green-800'
                  : notification.type === 'error'
                  ? 'text-red-800'
                  : notification.type === 'warning'
                  ? 'text-amber-800'
                  : 'text-blue-800'
              }`}
            >
              {notification.message}
            </p>
            <button
              onClick={() => handleDismiss(notification.id)}
              className={`ml-4 flex-shrink-0 ${
                notification.type === 'success'
                  ? 'text-green-600 hover:text-green-800'
                  : notification.type === 'error'
                  ? 'text-red-600 hover:text-red-800'
                  : notification.type === 'warning'
                  ? 'text-amber-600 hover:text-amber-800'
                  : 'text-blue-600 hover:text-blue-800'
              }`}
              aria-label="Dismiss notification"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
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
      ))}
    </div>
  );
}

