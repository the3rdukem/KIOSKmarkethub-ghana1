import { useOrdersStore, Order } from './orders-store';
import { useNotificationsStore } from './notifications-store';

/**
 * Helper hook that provides order operations with integrated notifications
 */
export function useOrderOperations() {
  const { updateOrder, getOrderById } = useOrdersStore();
  const {
    notifyOrderStatusChange,
    notifyNewOrder,
    notifyPaymentReceived,
  } = useNotificationsStore();

  /**
   * Update order status and send notifications to both buyer and relevant vendors
   */
  const updateOrderStatus = (
    orderId: string,
    newStatus: Order['status'],
    updatedBy: { id: string; role: 'buyer' | 'vendor' | 'admin' }
  ) => {
    const order = getOrderById(orderId);
    if (!order) return false;

    const oldStatus = order.status;
    const orderNumber = orderId.slice(-8).toUpperCase();

    // Update the order
    updateOrder(orderId, { status: newStatus });

    // Notify the buyer
    notifyOrderStatusChange(
      order.buyerId,
      orderId,
      orderNumber,
      oldStatus,
      newStatus,
      'buyer'
    );

    // Notify all vendors involved in this order
    const vendorIds = [...new Set(order.items.map(item => item.vendorId))];
    for (const vendorId of vendorIds) {
      // Don't notify the vendor who made the update
      if (updatedBy.role === 'vendor' && updatedBy.id === vendorId) continue;

      notifyOrderStatusChange(
        vendorId,
        orderId,
        orderNumber,
        oldStatus,
        newStatus,
        'vendor'
      );
    }

    return true;
  };

  /**
   * Create an order and notify vendors
   */
  const processNewOrder = (order: Order) => {
    const orderNumber = order.id.slice(-8).toUpperCase();

    // Get unique vendors
    const vendorIds = [...new Set(order.items.map(item => item.vendorId))];

    for (const vendorId of vendorIds) {
      const vendorItems = order.items.filter(item => item.vendorId === vendorId);
      const vendorTotal = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      notifyNewOrder(
        vendorId,
        order.id,
        orderNumber,
        order.buyerName,
        vendorTotal
      );
    }
  };

  /**
   * Confirm payment and notify vendor
   */
  const confirmPayment = (orderId: string) => {
    const order = getOrderById(orderId);
    if (!order) return false;

    // Update payment status
    updateOrder(orderId, { paymentStatus: 'paid' });

    // Notify each vendor
    const vendorIds = [...new Set(order.items.map(item => item.vendorId))];
    for (const vendorId of vendorIds) {
      const vendorItems = order.items.filter(item => item.vendorId === vendorId);
      const vendorAmount = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      notifyPaymentReceived(vendorId, orderId, vendorAmount);
    }

    return true;
  };

  /**
   * Cancel order with notifications
   */
  const cancelOrderWithNotification = (
    orderId: string,
    cancelledBy: { id: string; role: 'buyer' | 'vendor' | 'admin' }
  ) => {
    return updateOrderStatus(orderId, 'cancelled', cancelledBy);
  };

  return {
    updateOrderStatus,
    processNewOrder,
    confirmPayment,
    cancelOrderWithNotification,
  };
}

/**
 * Phase 7B: Normalize legacy status to display status
 */
export function normalizeStatusForDisplay(status: string): string {
  const legacyMap: Record<string, string> = {
    'pending_payment': 'created',
    'processing': 'confirmed',
    'shipped': 'out_for_delivery',
    'fulfilled': 'delivered',
  };
  return legacyMap[status] || status;
}

/**
 * Get order status display info
 * Phase 7B: Updated with new status lifecycle
 */
export function getOrderStatusInfo(status: Order['status'] | string) {
  const statusMap: Record<string, { label: string; color: string; description: string }> = {
    // Phase 7B: New statuses
    created: {
      label: 'Awaiting Payment',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Order created, awaiting payment',
    },
    confirmed: {
      label: 'Payment Confirmed',
      color: 'bg-blue-100 text-blue-800',
      description: 'Payment received, awaiting preparation',
    },
    preparing: {
      label: 'Preparing',
      color: 'bg-purple-100 text-purple-800',
      description: 'Vendor is preparing your order',
    },
    ready_for_pickup: {
      label: 'Ready for Pickup',
      color: 'bg-indigo-100 text-indigo-800',
      description: 'Order is ready for courier pickup',
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      color: 'bg-cyan-100 text-cyan-800',
      description: 'Order is on its way to you',
    },
    delivered: {
      label: 'Delivered',
      color: 'bg-green-100 text-green-800',
      description: 'Order has been delivered',
    },
    completed: {
      label: 'Completed',
      color: 'bg-emerald-100 text-emerald-800',
      description: 'Order completed successfully',
    },
    delivery_failed: {
      label: 'Delivery Failed',
      color: 'bg-orange-100 text-orange-800',
      description: 'Delivery attempt was unsuccessful',
    },
    disputed: {
      label: 'Disputed',
      color: 'bg-amber-100 text-amber-800',
      description: 'Buyer has raised a dispute',
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-red-100 text-red-800',
      description: 'Order was cancelled',
    },
    // Legacy statuses (for backward compatibility)
    pending: {
      label: 'Pending',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Order is awaiting confirmation',
    },
    pending_payment: {
      label: 'Awaiting Payment',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Order created, awaiting payment',
    },
    processing: {
      label: 'Payment Confirmed',
      color: 'bg-blue-100 text-blue-800',
      description: 'Payment received, vendor preparing',
    },
    shipped: {
      label: 'Shipped',
      color: 'bg-indigo-100 text-indigo-800',
      description: 'Order has been shipped',
    },
    fulfilled: {
      label: 'Delivered',
      color: 'bg-green-100 text-green-800',
      description: 'Order has been delivered',
    },
    refunded: {
      label: 'Refunded',
      color: 'bg-gray-100 text-gray-800',
      description: 'Order was refunded',
    },
  };

  return statusMap[status] || statusMap.pending;
}

/**
 * Get available status transitions based on current status
 * Phase 7B: Updated with new status lifecycle
 */
export function getAvailableStatusTransitions(currentStatus: Order['status'] | string, userRole: 'buyer' | 'vendor' | 'admin'): string[] {
  const transitions: Record<string, Record<string, string[]>> = {
    // Phase 7B: New status transitions
    created: {
      vendor: [],
      admin: ['cancelled'],
      buyer: ['cancelled'],
    },
    confirmed: {
      vendor: ['preparing'],
      admin: ['preparing', 'cancelled'],
      buyer: [],
    },
    preparing: {
      vendor: ['ready_for_pickup'],
      admin: ['ready_for_pickup', 'cancelled'],
      buyer: [],
    },
    ready_for_pickup: {
      vendor: ['out_for_delivery'],
      admin: ['out_for_delivery', 'cancelled'],
      buyer: [],
    },
    out_for_delivery: {
      vendor: ['delivered', 'delivery_failed'],
      admin: ['delivered', 'delivery_failed', 'cancelled'],
      buyer: [],
    },
    delivered: {
      vendor: [],
      admin: ['completed', 'cancelled'],
      buyer: ['disputed'],
    },
    delivery_failed: {
      vendor: ['out_for_delivery'],
      admin: ['out_for_delivery', 'cancelled'],
      buyer: [],
    },
    disputed: {
      vendor: [],
      admin: ['completed', 'cancelled'],
      buyer: [],
    },
    completed: {
      vendor: [],
      admin: [],
      buyer: [],
    },
    cancelled: {
      vendor: [],
      admin: [],
      buyer: [],
    },
    // Legacy statuses
    pending: {
      vendor: ['confirmed', 'cancelled'],
      admin: ['confirmed', 'cancelled'],
      buyer: ['cancelled'],
    },
    pending_payment: {
      vendor: [],
      admin: ['cancelled'],
      buyer: [],
    },
    processing: {
      vendor: ['preparing'],
      admin: ['preparing', 'cancelled'],
      buyer: [],
    },
    shipped: {
      vendor: ['delivered'],
      admin: ['delivered'],
      buyer: [],
    },
    fulfilled: {
      vendor: [],
      admin: [],
      buyer: ['disputed'],
    },
    refunded: {
      vendor: [],
      admin: [],
      buyer: [],
    },
  };

  return transitions[currentStatus]?.[userRole] || [];
}
