'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Session } from '@/lib/auth/types';
import ClearDevSessionsButton from '@/components/admin/ClearDevSessionsButton';
import { Bell } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface DashboardHeaderProps {
  session: Session;
}

function getPageTitle(pathname: string): string {
  // Handle role-based dashboard routes
  if (pathname === '/dashboard/student' || pathname === '/dashboard/provider' || pathname === '/dashboard/admin') {
    return 'Dashboard';
  }

  // Handle specific routes
  const routeMap: Record<string, string> = {
    '/dashboard/book': 'Book Session',
    '/dashboard/sessions': 'Sessions',
    '/dashboard/messages': 'Messages',
    '/dashboard/ai': 'IvyWay AI',
    '/dashboard/availability': 'Availability',
    '/dashboard/earnings': 'Earnings',
    '/dashboard/profile': 'Profile',
    '/dashboard/support': 'Support',
    '/dashboard/admin/support-inbox': 'Support Inbox',
  };

  // Check exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  // Handle sub-routes (e.g., /dashboard/book/...)
  for (const [route, title] of Object.entries(routeMap)) {
    if (pathname.startsWith(route + '/')) {
      return title;
    }
  }

  // Default fallback
  return 'Dashboard';
}

export default function DashboardHeader({ session }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      read: boolean;
      created_at: string;
    }>
  >([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const unreadBadgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotificationsDropdown(false);
      }
    };

    if (showNotificationsDropdown) {
      document.addEventListener('mousedown', onClickOutside);
    }

    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showNotificationsDropdown]);

  useEffect(() => {
    if (!session?.userId) return;
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  async function loadNotifications() {
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10', { method: 'GET' });
      if (!res.ok) return;

      const json = (await res.json()) as { notifications?: any[] };
      const loaded = Array.isArray(json.notifications) ? json.notifications : [];
      console.log("Notifications loaded:", loaded);

      setNotifications(
        loaded.map(n => ({
          id: String(n.id),
          title: String(n.title ?? ''),
          message: String(n.message ?? ''),
          read: Boolean(n.read),
          created_at: String(n.created_at ?? ''),
        }))
      );
    } catch (e) {
      // best-effort; header should still render
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } finally {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    }
  }

  function formatNotificationTime(createdAt: string): string {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.round(diffMs / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return d.toLocaleString();
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <ClearDevSessionsButton />
        <div className="flex items-center gap-3" ref={notificationsRef}>
          <div className="relative">
            <button
              type="button"
              onClick={async () => {
                const next = !showNotificationsDropdown;
                setShowNotificationsDropdown(next);
                if (next) {
                  await loadNotifications();
                }
              }}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 text-gray-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0088CB] px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadBadgeText}
                </span>
              )}
            </button>

            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-[300px] rounded-lg bg-white shadow-lg ring-1 ring-black/5 z-[80]">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-900">Notifications</div>
                </div>

                <div className={`${notifications.length > 5 ? 'max-h-80 overflow-y-auto' : ''}`}>
                  {notificationsLoading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-gray-500">No notifications yet</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            await markAsRead(n.id);
                            setShowNotificationsDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                            n.read ? 'opacity-75' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {n.title || 'Notification'}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5 overflow-hidden text-ellipsis">
                                {n.message}
                              </div>
                            </div>
                            <div className="text-[11px] text-gray-500 whitespace-nowrap">
                              {formatNotificationTime(n.created_at)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard/profile')}
            className="h-8 w-8 rounded-full bg-[#0088CB] flex items-center justify-center cursor-pointer transition will-change-transform hover:opacity-90 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/40"
            aria-label="Profile"
          >
            <span className="text-sm font-medium text-white">
              {session.name.charAt(0).toUpperCase()}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

