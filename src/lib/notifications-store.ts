import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'order_status' | 'order_new' | 'order_created' | 'order_paid' | 'order_cancelled' | 'order_fulfilled' | 'order_disputed' | 'payment' | 'review' | 'message' | 'system';
export type NotificationChannel = 'in_app' | 'email' | 'sms';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  productId?: string;
  read: boolean;
  channels: NotificationChannel[];
  createdAt: string;
}

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  orderUpdates: boolean;
  newOrders: boolean;
  paymentAlerts: boolean;
  reviewAlerts: boolean;
  marketingMessages: boolean;
}

interface NotificationsState {
  notifications: Notification[];
  preferences: Record<string, NotificationPreferences>;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Notification;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (userId: string) => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: (userId: string) => void;
  getNotificationsByUser: (userId: string) => Notification[];
  getUnreadCount: (userId: string) => number;

  // Preferences
  updatePreferences: (userId: string, prefs: Partial<NotificationPreferences>) => void;
  getPreferences: (userId: string) => NotificationPreferences;

  // Order notification helpers
  notifyOrderStatusChange: (
    userId: string,
    orderId: string,
    orderNumber: string,
    oldStatus: string,
    newStatus: string,
    userRole: 'buyer' | 'vendor'
  ) => void;
  notifyNewOrder: (vendorId: string, orderId: string, orderNumber: string, buyerName: string, total: number) => void;
  notifyPaymentReceived: (vendorId: string, orderId: string, amount: number) => void;
  notifyNewReview: (vendorId: string, productName: string, rating: number) => void;
}

const defaultPreferences: NotificationPreferences = {
  email: true,
  sms: true,
  inApp: true,
  orderUpdates: true,
  newOrders: true,
  paymentAlerts: true,
  reviewAlerts: true,
  marketingMessages: false,
};

const getStatusMessage = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'is awaiting confirmation';
    case 'confirmed':
      return 'has been confirmed';
    case 'processing':
      return 'is being processed';
    case 'shipped':
      return 'has been shipped';
    case 'out_for_delivery':
      return 'is out for delivery';
    case 'delivered':
      return 'has been delivered';
    case 'cancelled':
      return 'has been cancelled';
    case 'refunded':
      return 'has been refunded';
    default:
      return `status changed to ${status}`;
  }
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      preferences: {},

      addNotification: (notificationData) => {
        const newNotification: Notification = {
          ...notificationData,
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
        }));

        return newNotification;
      },

      markAsRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: (userId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.userId === userId ? { ...n, read: true } : n
          ),
        }));
      },

      deleteNotification: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== notificationId),
        }));
      },

      clearAllNotifications: (userId) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.userId !== userId),
        }));
      },

      getNotificationsByUser: (userId) => {
        return get().notifications
          .filter((n) => n.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      getUnreadCount: (userId) => {
        return get().notifications.filter((n) => n.userId === userId && !n.read).length;
      },

      updatePreferences: (userId, prefs) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [userId]: {
              ...defaultPreferences,
              ...state.preferences[userId],
              ...prefs,
            },
          },
        }));
      },

      getPreferences: (userId) => {
        return get().preferences[userId] || defaultPreferences;
      },

      notifyOrderStatusChange: (userId, orderId, orderNumber, oldStatus, newStatus, userRole) => {
        const prefs = get().getPreferences(userId);
        if (!prefs.orderUpdates) return;

        const channels: NotificationChannel[] = ['in_app'];
        if (prefs.email) channels.push('email');
        if (prefs.sms) channels.push('sms');

        const title = userRole === 'buyer'
          ? `Order #${orderNumber} Update`
          : `Order #${orderNumber} Status Changed`;

        const message = userRole === 'buyer'
          ? `Your order ${getStatusMessage(newStatus)}`
          : `Order #${orderNumber} ${getStatusMessage(newStatus)}`;

        get().addNotification({
          userId,
          type: 'order_status',
          title,
          message,
          orderId,
          channels,
        });
      },

      notifyNewOrder: (vendorId, orderId, orderNumber, buyerName, total) => {
        const prefs = get().getPreferences(vendorId);
        if (!prefs.newOrders) return;

        const channels: NotificationChannel[] = ['in_app'];
        if (prefs.email) channels.push('email');
        if (prefs.sms) channels.push('sms');

        get().addNotification({
          userId: vendorId,
          type: 'order_new',
          title: 'New Order Received',
          message: `You have a new order #${orderNumber} from ${buyerName} for GHS ${total.toLocaleString()}`,
          orderId,
          channels,
        });
      },

      notifyPaymentReceived: (vendorId, orderId, amount) => {
        const prefs = get().getPreferences(vendorId);
        if (!prefs.paymentAlerts) return;

        const channels: NotificationChannel[] = ['in_app'];
        if (prefs.email) channels.push('email');

        get().addNotification({
          userId: vendorId,
          type: 'payment',
          title: 'Payment Received',
          message: `You received a payment of GHS ${amount.toLocaleString()}`,
          orderId,
          channels,
        });
      },

      notifyNewReview: (vendorId, productName, rating) => {
        const prefs = get().getPreferences(vendorId);
        if (!prefs.reviewAlerts) return;

        const channels: NotificationChannel[] = ['in_app'];
        if (prefs.email) channels.push('email');

        get().addNotification({
          userId: vendorId,
          type: 'review',
          title: 'New Product Review',
          message: `${productName} received a ${rating}-star review`,
          channels,
        });
      },
    }),
    {
      name: 'marketplace-notifications',
    }
  )
);
