'use server';

/**
 * Notification Storage
 * 
 * Manages dashboard notifications for users.
 * Notifications are dismissible and won't reappear after dismissal.
 */

import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'data', 'notifications.json');

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  dismissedAt?: string;
  dismissed: boolean;
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(STORAGE_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

/**
 * Read all notifications from storage
 */
async function getNotifications(): Promise<Notification[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    }
    throw error;
  }
}

/**
 * Save notifications to storage
 */
async function saveNotifications(notifications: Notification[]): Promise<void> {
  await ensureDataDirectory();
  await fs.writeFile(STORAGE_FILE, JSON.stringify(notifications, null, 2), 'utf-8');
}

/**
 * Get active (non-dismissed) notifications for a user
 */
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const allNotifications = await getNotifications();
  return allNotifications.filter(
    notification => notification.userId === userId && !notification.dismissed
  );
}

/**
 * Create a new notification
 */
export async function createNotification(
  userId: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<Notification> {
  const notification: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    message,
    type,
    createdAt: new Date().toISOString(),
    dismissed: false,
  };

  const notifications = await getNotifications();
  notifications.push(notification);
  await saveNotifications(notifications);

  return notification;
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(notificationId: string, userId: string): Promise<boolean> {
  const notifications = await getNotifications();
  const notification = notifications.find(n => n.id === notificationId && n.userId === userId);

  if (!notification || notification.dismissed) {
    return false;
  }

  notification.dismissed = true;
  notification.dismissedAt = new Date().toISOString();
  await saveNotifications(notifications);

  return true;
}






