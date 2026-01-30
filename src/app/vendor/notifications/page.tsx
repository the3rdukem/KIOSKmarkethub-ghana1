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
  AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistance } from "date-fns";
import { toast } from "sonner";
import { VendorAuthGuard } from "@/components/auth/auth-guard";

type NotificationType = 
  | 'order_status'
  | 'order_new'
  | 'order_created'
  | 'order_paid'
  | 'order_cancelled'
  | 'order_fulfilled'
  | 'order_disputed'
  | 'payment'
  | 'review'
  | 'message'
  | 'system'
  | 'low_stock';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  productId?: string;
  disputeId?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

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
  low_stock: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100" },
};

const defaultNotificationConfig = { icon: Bell, color: "text-gray-600", bg: "bg-gray-100" };

function VendorNotificationsContent() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState({
    inApp: true,
    email: true,
    sms: false,
    orderUpdates: true,
    lowStockAlerts: true,
    reviewNotifications: true,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/vendor/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isHydrated || !isAuthenticated || !user) return;
      
      setIsLoading(true);
      try {
        const response = await fetch('/api/notifications', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
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
            createdAt: n.createdAt,
          }));
          setNotifications(mappedNotifications);
        }

        const userResponse = await fetch(`/api/users/${user.id}`, {
          credentials: 'include',
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const storeSettings = userData.user?.storeSettings || {};
          const notifSettings = storeSettings.notifications || {};
          setPreferences({
            inApp: true,
            email: notifSettings.emailNotifications !== false,
            sms: notifSettings.smsNotifications === true,
            orderUpdates: notifSettings.orderAlerts !== false,
            lowStockAlerts: notifSettings.lowStockAlerts !== false,
            reviewNotifications: true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [isHydrated, isAuthenticated, user]);

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </SiteLayout>
    );
  }

  if (!user) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notification deleted");
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error("Failed to delete notification");
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      const storeSettingsResponse = await fetch(`/api/users/${user.id}`, {
        credentials: 'include',
      });
      
      if (storeSettingsResponse.ok) {
        const userData = await storeSettingsResponse.json();
        const currentStoreSettings = userData.user?.storeSettings || {};
        
        const updatedSettings = {
          ...currentStoreSettings,
          notifications: {
            ...currentStoreSettings.notifications,
            emailNotifications: newPreferences.email,
            smsNotifications: newPreferences.sms,
            orderAlerts: newPreferences.orderUpdates,
            lowStockAlerts: newPreferences.lowStockAlerts,
          },
        };
        
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ storeSettings: updatedSettings }),
        });
        
        toast.success("Preferences saved");
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error("Failed to save preferences");
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
            {notification.link ? (
              <Link
                href={notification.link}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Details
              </Link>
            ) : notification.disputeId ? (
              <Link
                href={`/vendor/disputes`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Dispute
              </Link>
            ) : notification.orderId ? (
              <Link
                href={`/vendor/orders/${notification.orderId}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Order
              </Link>
            ) : notification.productId ? (
              <Link
                href={`/vendor/products/${notification.productId}`}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                View Product
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SiteLayout>
      <div className="container py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/vendor">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
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
              <p className="text-muted-foreground text-sm sm:text-base">Stay updated on your store activities</p>
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
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Notifications</CardTitle>
                <CardDescription>
                  {notifications.length === 0
                    ? "No notifications yet"
                    : `${notifications.length} notification${notifications.length === 1 ? '' : 's'}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <BellOff className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">No notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      You&apos;re all caught up! New notifications will appear here.
                    </p>
                  </div>
                ) : (
                  <div>
                    {filteredNotifications.map((notification) => (
                      <NotificationItem key={notification.id} notification={notification} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Delivery Methods</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <Label htmlFor="inApp" className="font-medium">In-App Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive notifications within the app</p>
                        </div>
                      </div>
                      <Switch
                        id="inApp"
                        checked={preferences.inApp}
                        disabled
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Mail className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <Label htmlFor="email" className="font-medium">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Get notified via email</p>
                        </div>
                      </div>
                      <Switch
                        id="email"
                        checked={preferences.email}
                        onCheckedChange={(checked) => handlePreferenceChange("email", checked)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <Label htmlFor="sms" className="font-medium">SMS Notifications</Label>
                          <p className="text-sm text-muted-foreground">Get important alerts via SMS</p>
                        </div>
                      </div>
                      <Switch
                        id="sms"
                        checked={preferences.sms}
                        onCheckedChange={(checked) => handlePreferenceChange("sms", checked)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-4">Notification Types</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <Label htmlFor="orderUpdates" className="font-medium">Order Updates</Label>
                          <p className="text-sm text-muted-foreground">New orders, payments, and status changes</p>
                        </div>
                      </div>
                      <Switch
                        id="orderUpdates"
                        checked={preferences.orderUpdates}
                        onCheckedChange={(checked) => handlePreferenceChange("orderUpdates", checked)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <Label htmlFor="lowStockAlerts" className="font-medium">Low Stock Alerts</Label>
                          <p className="text-sm text-muted-foreground">Get notified when products are running low</p>
                        </div>
                      </div>
                      <Switch
                        id="lowStockAlerts"
                        checked={preferences.lowStockAlerts}
                        onCheckedChange={(checked) => handlePreferenceChange("lowStockAlerts", checked)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Star className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <Label htmlFor="reviewNotifications" className="font-medium">Review Notifications</Label>
                          <p className="text-sm text-muted-foreground">New reviews on your products</p>
                        </div>
                      </div>
                      <Switch
                        id="reviewNotifications"
                        checked={preferences.reviewNotifications}
                        onCheckedChange={(checked) => handlePreferenceChange("reviewNotifications", checked)}
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

export default function VendorNotificationsPage() {
  return (
    <VendorAuthGuard>
      <VendorNotificationsContent />
    </VendorAuthGuard>
  );
}
