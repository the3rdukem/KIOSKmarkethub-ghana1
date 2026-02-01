"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Bell,
  Package,
  CreditCard,
  Star,
  MessageSquare,
  Settings,
  Trash2,
  CheckCircle,
  Check,
  Loader2,
  BellOff,
  Mail,
  Smartphone,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useNotificationsStore, Notification, NotificationType, NotificationChannel } from "@/lib/notifications-store";
import { formatDistance } from "date-fns";
import { toast } from "sonner";

const notificationTypeConfig: Record<NotificationType, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  order_status: { icon: Package, color: "text-blue-600", bg: "bg-blue-100" },
  order_new: { icon: Package, color: "text-green-600", bg: "bg-green-100" },
  order_created: { icon: Package, color: "text-green-600", bg: "bg-green-100" },
  order_paid: { icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" },
  order_cancelled: { icon: Package, color: "text-red-600", bg: "bg-red-100" },
  order_fulfilled: { icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
  order_disputed: { icon: Package, color: "text-amber-600", bg: "bg-amber-100" },
  payment: { icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" },
  review: { icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" },
  message: { icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-100" },
  system: { icon: Bell, color: "text-gray-600", bg: "bg-gray-100" },
};

const defaultNotificationConfig = { icon: Bell, color: "text-gray-600", bg: "bg-gray-100" };

export default function BuyerNotificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    getNotificationsByUser,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getUnreadCount,
    getPreferences,
    updatePreferences,
  } = useNotificationsStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<Notification[]>([]);
  const [dbPreferences, setDbPreferences] = useState<{
    inApp: boolean;
    email: boolean;
    sms: boolean;
    orderUpdates: boolean;
    paymentAlerts: boolean;
    marketingMessages: boolean;
  } | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  // Fetch notifications and preferences from database API
  useEffect(() => {
    const fetchData = async () => {
      if (!isHydrated || !isAuthenticated || !user) return;
      
      setIsLoadingNotifications(true);
      try {
        // Fetch notifications
        const notifResponse = await fetch('/api/notifications', {
          credentials: 'include',
        });
        
        if (notifResponse.ok) {
          const data = await notifResponse.json();
          const mappedNotifications: Notification[] = (data.notifications || []).map((n: { id: string; userId: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; payload?: { orderId?: string; productId?: string; disputeId?: string; link?: string } }) => ({
            id: n.id,
            userId: n.userId,
            type: n.type as NotificationType,
            title: n.title,
            message: n.message,
            orderId: n.payload?.orderId,
            productId: n.payload?.productId,
            disputeId: n.payload?.disputeId,
            link: n.payload?.link,
            read: n.isRead,
            channels: ['in_app'] as NotificationChannel[],
            createdAt: n.createdAt,
          }));
          setDbNotifications(mappedNotifications);
        }

        // Fetch user notification settings from API
        const userResponse = await fetch(`/api/users/${user.id}`, {
          credentials: 'include',
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const notifSettings = userData.user?.notificationSettings || {};
          setDbPreferences({
            inApp: notifSettings.inApp !== false,
            email: notifSettings.email !== false,
            sms: notifSettings.sms !== false,
            orderUpdates: notifSettings.orderUpdates !== false,
            paymentAlerts: notifSettings.paymentAlerts !== false,
            marketingMessages: notifSettings.marketingMessages === true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    };
    
    fetchData();
  }, [isHydrated, isAuthenticated, user]);

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Combine store notifications with database notifications, prefer DB
  const storeNotifications = getNotificationsByUser(user.id);
  const allNotifications = [...dbNotifications, ...storeNotifications.filter(
    sn => !dbNotifications.some(dn => dn.id === sn.id)
  )].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const notifications = allNotifications;
  const unreadCount = notifications.filter(n => !n.read).length;
  const storePreferences = getPreferences(user.id);
  const preferences = dbPreferences || storePreferences;

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead(user.id);
    toast.success("All marked as read!");
  };

  const handleDeleteNotification = (id: string) => {
    deleteNotification(id);
    toast.success("Notification deleted");
  };

  const handleClearAll = () => {
    clearAllNotifications(user.id);
    toast.success("All notifications cleared");
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    // Update local store for immediate UI feedback
    updatePreferences(user.id, { [key]: value });
    
    // Update local dbPreferences state
    if (dbPreferences) {
      setDbPreferences({ ...dbPreferences, [key]: value });
    }
    
    // Save to database
    try {
      const newSettings = { ...preferences, [key]: value };
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notificationSettings: newSettings }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }
      toast.success("Preferences saved!");
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error("Could not save preferences. Please try again.");
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const config = notificationTypeConfig[notification.type] || defaultNotificationConfig;
    const Icon = config.icon;

    return (
      <div
        className={`p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
          !notification.read ? "bg-blue-50/50" : ""
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                  {notification.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistance(new Date(notification.createdAt), new Date(), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteNotification(notification.id)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {(notification as Notification & { link?: string }).link ? (
              <Link
                href={(notification as Notification & { link?: string }).link!}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Details
              </Link>
            ) : (notification as Notification & { disputeId?: string }).disputeId ? (
              <Link
                href={`/buyer/disputes`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Dispute
              </Link>
            ) : notification.orderId && (
              <Link
                href={`/buyer/orders/${notification.orderId}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Order
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SiteLayout>
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/buyer/dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500">{unreadCount}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">Stay updated on your orders and activities</p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                  <CheckCircle className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Mark All Read</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              All
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">{notifications.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="all">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Notifications</CardTitle>
                  {notifications.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={handleClearAll}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
                {/* Filter Pills */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === "order_status" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("order_status")}
                  >
                    <Package className="w-4 h-4 mr-1" />
                    Orders
                  </Button>
                  <Button
                    variant={filter === "payment" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("payment")}
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Payments
                  </Button>
                  <Button
                    variant={filter === "message" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("message")}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Messages
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
                    <p className="text-muted-foreground">
                      {filter === "all"
                        ? "You're all caught up! Check back later for updates."
                        : `No ${filter.replace("_", " ")} notifications.`}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredNotifications.map((notification) => (
                      <NotificationItem key={notification.id} notification={notification} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">Notification Channels</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Bell className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">In-App Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications in the app</p>
                        </div>
                      </div>
                      <Switch
                        checked={preferences.inApp}
                        onCheckedChange={(checked) => handlePreferenceChange("inApp", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">Email Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                      </div>
                      <Switch
                        checked={preferences.email}
                        onCheckedChange={(checked) => handlePreferenceChange("email", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">SMS Notifications</p>
                          <p className="text-sm text-muted-foreground">Receive important alerts via SMS</p>
                        </div>
                      </div>
                      <Switch
                        checked={preferences.sms}
                        onCheckedChange={(checked) => handlePreferenceChange("sms", checked)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-4">Notification Types</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order Updates</p>
                        <p className="text-sm text-muted-foreground">Status changes, shipping updates</p>
                      </div>
                      <Switch
                        checked={preferences.orderUpdates}
                        onCheckedChange={(checked) => handlePreferenceChange("orderUpdates", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Payment Alerts</p>
                        <p className="text-sm text-muted-foreground">Payment confirmations, refunds</p>
                      </div>
                      <Switch
                        checked={preferences.paymentAlerts}
                        onCheckedChange={(checked) => handlePreferenceChange("paymentAlerts", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Marketing Messages</p>
                        <p className="text-sm text-muted-foreground">Promotions, deals, and recommendations</p>
                      </div>
                      <Switch
                        checked={preferences.marketingMessages}
                        onCheckedChange={(checked) => handlePreferenceChange("marketingMessages", checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}
