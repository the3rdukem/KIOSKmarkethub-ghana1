/**
 * Seed Default Email Templates API
 * 
 * POST /api/admin/email/templates/seed - Seed default transactional templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { createEmailTemplate, getEmailTemplateByName } from '@/lib/db/dal/email';

const DEFAULT_TEMPLATES = [
  {
    name: 'password_reset',
    subject: 'Reset Your Password - {{siteName}}',
    category: 'auth' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Reset Your Password</h2>
  <p>Hello {{userName}},</p>
  <p>You requested to reset your password for your {{siteName}} account. Click the button below to set a new password:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{resetLink}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
  </p>
  <p>Or copy and paste this link into your browser:</p>
  <p style="word-break: break-all; color: #666;">{{resetLink}}</p>
  <p>This link expires in 30 minutes.</p>
  <p>If you didn't request this, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">This email was sent by {{siteName}}. If you have questions, contact us at {{supportEmail}}.</p>
</div>
    `.trim(),
    bodyText: `Reset Your Password

Hello {{userName}},

You requested to reset your password for your {{siteName}} account. 

Visit this link to set a new password:
{{resetLink}}

This link expires in 30 minutes.

If you didn't request this, you can safely ignore this email.

--
{{siteName}}
{{supportEmail}}`,
    isActive: true,
  },
  {
    name: 'order_confirmation',
    subject: 'Order Confirmed - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Order Confirmed!</h2>
  <p>Hello {{userName}},</p>
  <p>Thank you for your order! We've received your order and it's being processed.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Total:</strong> {{orderTotal}}</p>
  </div>
  <p>You'll receive another email when your order ships with tracking information.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Thank you for shopping with {{siteName}}.</p>
</div>
    `.trim(),
    bodyText: `Order Confirmed!

Hello {{userName}},

Thank you for your order! We've received your order and it's being processed.

Order Number: {{orderNumber}}
Total: {{orderTotal}}

You'll receive another email when your order ships with tracking information.

--
Thank you for shopping with {{siteName}}.`,
    isActive: true,
  },
  {
    name: 'order_shipped',
    subject: 'Your Order Has Shipped - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Your Order Has Shipped!</h2>
  <p>Hello {{userName}},</p>
  <p>Great news! Your order has been shipped and is on its way to you.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Tracking Number:</strong> {{trackingNumber}}</p>
  </div>
  <p>You can track your package using the tracking number above.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Thank you for shopping with {{siteName}}.</p>
</div>
    `.trim(),
    bodyText: `Your Order Has Shipped!

Hello {{userName}},

Great news! Your order has been shipped and is on its way to you.

Order Number: {{orderNumber}}
Tracking Number: {{trackingNumber}}

You can track your package using the tracking number above.

--
Thank you for shopping with {{siteName}}.`,
    isActive: true,
  },
  {
    name: 'vendor_approved',
    subject: 'Your Vendor Application Has Been Approved! - {{siteName}}',
    category: 'notification' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #22c55e;">Congratulations! You're Approved!</h2>
  <p>Hello {{vendorName}},</p>
  <p>We're excited to let you know that your vendor application has been approved! You can now start selling on {{siteName}}.</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{siteUrl}}/vendor/dashboard" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Vendor Dashboard</a>
  </p>
  <p>Here's what you can do next:</p>
  <ul>
    <li>Add your products to start selling</li>
    <li>Complete your store profile</li>
    <li>Set up your payment information</li>
  </ul>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Welcome to {{siteName}}! If you have questions, contact us at {{supportEmail}}.</p>
</div>
    `.trim(),
    bodyText: `Congratulations! You're Approved!

Hello {{vendorName}},

We're excited to let you know that your vendor application has been approved! You can now start selling on {{siteName}}.

Visit your vendor dashboard: {{siteUrl}}/vendor/dashboard

Here's what you can do next:
- Add your products to start selling
- Complete your store profile
- Set up your payment information

--
Welcome to {{siteName}}!
{{supportEmail}}`,
    isActive: true,
  },
  {
    name: 'payment_received',
    subject: 'Payment Received - {{orderNumber}}',
    category: 'payment' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Payment Received</h2>
  <p>Hello {{userName}},</p>
  <p>We've received your payment for order {{orderNumber}}.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Amount Paid:</strong> {{orderTotal}}</p>
  </div>
  <p>Your order is now being processed by the vendor(s) and will ship soon.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Thank you for shopping with {{siteName}}.</p>
</div>
    `.trim(),
    bodyText: `Payment Received

Hello {{userName}},

We've received your payment for order {{orderNumber}}.

Order Number: {{orderNumber}}
Amount Paid: {{orderTotal}}

Your order is now being processed by the vendor(s) and will ship soon.

--
Thank you for shopping with {{siteName}}.`,
    isActive: true,
  },
  {
    name: 'vendor_new_order',
    subject: 'New Order Received - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #22c55e;">New Order Received!</h2>
  <p>Hello {{vendorName}},</p>
  <p>Great news! You've received a new order from <strong>{{buyerName}}</strong>.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Items Total:</strong> {{itemsTotal}}</p>
    <p style="margin: 10px 0 0;"><strong>Number of Items:</strong> {{itemCount}}</p>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{siteUrl}}/vendor/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Order Details</a>
  </p>
  <p>Please process this order as soon as possible to ensure a great customer experience.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">You received this email because you're a vendor on {{siteName}}.</p>
</div>
    `.trim(),
    bodyText: `New Order Received!

Hello {{vendorName}},

Great news! You've received a new order from {{buyerName}}.

Order Number: {{orderNumber}}
Items Total: {{itemsTotal}}
Number of Items: {{itemCount}}

Visit your vendor dashboard to view order details: {{siteUrl}}/vendor/orders

Please process this order as soon as possible.

--
{{siteName}}`,
    isActive: true,
  },
  {
    name: 'order_delivered',
    subject: 'Your Order Has Been Delivered - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #22c55e;">Order Delivered!</h2>
  <p>Hello {{userName}},</p>
  <p>Great news! Your order has been delivered.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Order Total:</strong> {{orderTotal}}</p>
  </div>
  <p>We hope you enjoy your purchase! If you have any issues with your order, you can open a dispute within 48 hours.</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{siteUrl}}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Your Orders</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Thank you for shopping with {{siteName}}!</p>
</div>
    `.trim(),
    bodyText: `Order Delivered!

Hello {{userName}},

Great news! Your order has been delivered.

Order Number: {{orderNumber}}
Order Total: {{orderTotal}}

We hope you enjoy your purchase! If you have any issues, you can open a dispute within 48 hours.

View your orders: {{siteUrl}}/orders

--
Thank you for shopping with {{siteName}}!`,
    isActive: true,
  },
  {
    name: 'order_cancelled',
    subject: 'Order Cancelled - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #ef4444;">Order Cancelled</h2>
  <p>Hello {{userName}},</p>
  <p>We're sorry to inform you that your order has been cancelled.</p>
  <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>Order Total:</strong> {{orderTotal}}</p>
    <p style="margin: 10px 0 0;"><strong>Reason:</strong> {{reason}}</p>
  </div>
  <p>If you paid for this order, a refund will be processed to your original payment method within 3-5 business days.</p>
  <p>If you have any questions, please contact us at {{supportEmail}}.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">{{siteName}}</p>
</div>
    `.trim(),
    bodyText: `Order Cancelled

Hello {{userName}},

We're sorry to inform you that your order has been cancelled.

Order Number: {{orderNumber}}
Order Total: {{orderTotal}}
Reason: {{reason}}

If you paid for this order, a refund will be processed to your original payment method within 3-5 business days.

If you have any questions, please contact us at {{supportEmail}}.

--
{{siteName}}`,
    isActive: true,
  },
  {
    name: 'order_status_update',
    subject: 'Order Update - {{orderNumber}}',
    category: 'order' as const,
    bodyHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Order Status Update</h2>
  <p>Hello {{userName}},</p>
  <p>Your order status has been updated.</p>
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 10px 0 0;"><strong>New Status:</strong> {{newStatus}}</p>
  </div>
  <p>{{statusMessage}}</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{siteUrl}}/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Track Your Order</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #666; font-size: 12px;">Thank you for shopping with {{siteName}}.</p>
</div>
    `.trim(),
    bodyText: `Order Status Update

Hello {{userName}},

Your order status has been updated.

Order Number: {{orderNumber}}
New Status: {{newStatus}}

{{statusMessage}}

Track your order: {{siteUrl}}/orders

--
Thank you for shopping with {{siteName}}.`,
    isActive: true,
  },
];

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const template of DEFAULT_TEMPLATES) {
      const existing = await getEmailTemplateByName(template.name);
      if (existing) {
        skipped.push(template.name);
        continue;
      }

      await createEmailTemplate(template);
      created.push(template.name);
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `Created ${created.length} templates, skipped ${skipped.length} existing`,
    });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATES_SEED] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed templates' },
      { status: 500 }
    );
  }
}
