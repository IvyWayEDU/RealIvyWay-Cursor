'use server';

/**
 * Notification Actions
 * 
 * Server actions for managing notifications
 */

import { getUserNotifications, dismissNotification, Notification } from './storage';

/**
 * Get active notifications for the current user
 */
export async function getNotifications(userId: string): Promise<Notification[]> {
  return await getUserNotifications(userId);
}

/**
 * Dismiss a notification
 */
export async function dismissNotificationAction(
  notificationId: string,
  userId: string
): Promise<boolean> {
  return await dismissNotification(notificationId, userId);
}

// Re-export Notification type for convenience
export type { Notification };

