'use server';

/**
 * Notification Storage
 *
 * Manages dashboard notifications for users.
 * Notifications are dismissible and won't reappear after dismissal.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin.server';

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
 * Map a DB row to the frontend Notification shape.
 */
function toNotification(row: {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    message: row.message,
    type: row.type as Notification['type'],
    createdAt: row.created_at,
    dismissed: row.read,
  };
}

function titleFromType(type: Notification['type']): string {
  switch (type) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
    default:
      return 'Info';
  }
}

/**
 * Get active (non-dismissed) notifications for a user
 */
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  const all = (data ?? []).map(toNotification);
  return all.filter(n => n.userId === userId && !n.dismissed);
}

/**
 * Create a new notification
 */
export async function createNotification(
  userId: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<Notification> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const supabase = getSupabaseAdmin();

  const payload = {
    id,
    user_id: userId,
    type,
    title: titleFromType(type),
    message,
    read: false,
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    console.error('Error creating notification:', error);
    return {
      id,
      userId,
      message,
      type,
      createdAt: new Date().toISOString(),
      dismissed: false,
    };
  }

  const notification = toNotification(data as any);
  console.log("Notification created:", notification);
  return notification;
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(notificationId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // MARK AS READ
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}






