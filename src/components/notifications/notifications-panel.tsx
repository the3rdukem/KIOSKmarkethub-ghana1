"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Package,
  CreditCard,
  Star,
  MessageSquare,
  Settings,
  CheckCheck,
  ShoppingCart,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

type NotificationType = 
  | 'order_created'
  | 'order_paid'
  | 'order_cancelled'
  | 'order_fulfilled'
  | 'review_reply'
  | 'moderation_action'
  | 'system';

interface Notification {
  id: string;
  userId: string;
  role: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'order_created':
      return <ShoppingCart className="w-4 h-4 text-green-500" />;
    case 'order_paid':
      return <CreditCard className="w-4 h-4 text-green-600" />;
    case 'order_cancelled':
      return <Package className="w-4 h-4 text-red-500" />;
    case 'order_fulfilled':
      return <Package className="w-4 h-4 text-blue-500" />;
    case 'review_reply':
      return <Star className="w-4 h-4 text-yellow-500" />;
    case 'moderation_action':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getNotificationLink = (notification: Notification, userRole: string) => {
  const payload = notification.payload as Record<string, string> | undefined;
  
  if (payload?.orderId) {
    if (userRole === 'vendor') {
      return `/vendor?tab=orders`;
    }
    return `/buyer/dashboard?tab=orders`;
  }
  if (payload?.productId) {
    return `/product/${payload.productId}`;
  }
  return null;
};

export function NotificationsPanel() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/notifications?limit=20');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('[NotificationsPanel] Fetch error:', error);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/notifications/unread');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('[NotificationsPanel] Unread count error:', error);
    }
  }, [user]);

  useEffect(() => {
    if (isHydrated && user) {
      fetchUnreadCount();
    }
  }, [isHydrated, user, fetchUnreadCount]);

  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));
    }
  }, [isOpen, user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[NotificationsPanel] Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[NotificationsPanel] Mark all as read error:', error);
    }
  };

  if (!isHydrated || !user) {
    return (
      <Button variant="ghost" size="sm" className="relative">
        <Bell className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see order updates and messages here
              </p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => {
                const link = getNotificationLink(notification, user.role);

                const notificationContent = (
                  <div className="flex gap-3 w-full">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.isRead ? 'font-medium' : ''}`}>
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );

                return link ? (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`p-3 cursor-pointer ${!notification.isRead ? 'bg-blue-50' : ''}`}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    asChild
                  >
                    <Link href={link}>
                      {notificationContent}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`p-3 cursor-pointer ${!notification.isRead ? 'bg-blue-50' : ''}`}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                  >
                    {notificationContent}
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                asChild
              >
                <Link href="/buyer/notifications">
                  View All
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                asChild
              >
                <Link href="/buyer/notifications">
                  <Settings className="w-3 h-3 mr-1" />
                  Settings
                </Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
