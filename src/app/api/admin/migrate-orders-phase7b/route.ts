/**
 * Phase 7B: One-time migration endpoint to add new order columns
 * 
 * Adds: courier_provider, courier_reference, delivered_at, disputed_at, dispute_reason
 * Migrates legacy statuses: pending_payment→created, processing→confirmed, shipped→out_for_delivery, fulfilled→delivered
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { query } from '@/lib/db';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getUserById } from '@/lib/db/dal/users';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results: string[] = [];

    // Step 1: Add new columns to orders table if they don't exist
    const columnsToAdd = [
      { name: 'courier_provider', type: 'TEXT' },
      { name: 'courier_reference', type: 'TEXT' },
      { name: 'delivered_at', type: 'TEXT' },
      { name: 'disputed_at', type: 'TEXT' },
      { name: 'dispute_reason', type: 'TEXT' },
    ];

    for (const col of columnsToAdd) {
      try {
        const checkCol = await query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = $1`,
          [col.name]
        );
        
        if (checkCol.rows.length === 0) {
          await query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`);
          results.push(`Added column: ${col.name}`);
        } else {
          results.push(`Column already exists: ${col.name}`);
        }
      } catch (e) {
        results.push(`Error adding ${col.name}: ${(e as Error).message}`);
      }
    }

    // Step 2: Migrate legacy order statuses (optional - only if status hasn't been migrated)
    // We keep legacy statuses working but offer migration option
    const body = await request.json().catch(() => ({}));
    
    if (body.migrateStatuses === true) {
      const statusMigrations = [
        { from: 'pending_payment', to: 'created' },
        { from: 'processing', to: 'confirmed' },
        { from: 'shipped', to: 'out_for_delivery' },
        { from: 'fulfilled', to: 'delivered' },
      ];

      for (const migration of statusMigrations) {
        try {
          const result = await query(
            `UPDATE orders SET status = $1, updated_at = $3 WHERE status = $2`,
            [migration.to, migration.from, new Date().toISOString()]
          );
          const count = result.rowCount || 0;
          if (count > 0) {
            results.push(`Migrated ${count} orders: ${migration.from} → ${migration.to}`);
          }
        } catch (e) {
          results.push(`Error migrating ${migration.from}: ${(e as Error).message}`);
        }
      }

      // Also migrate item fulfillment statuses
      const itemMigrations = [
        { from: 'shipped', to: 'handed_to_courier' },
        { from: 'fulfilled', to: 'delivered' },
      ];

      for (const migration of itemMigrations) {
        try {
          const result = await query(
            `UPDATE order_items SET fulfillment_status = $1, updated_at = $3 WHERE fulfillment_status = $2`,
            [migration.to, migration.from, new Date().toISOString()]
          );
          const count = result.rowCount || 0;
          if (count > 0) {
            results.push(`Migrated ${count} order items: ${migration.from} → ${migration.to}`);
          }
        } catch (e) {
          results.push(`Error migrating items ${migration.from}: ${(e as Error).message}`);
        }
      }

      // Set delivered_at for orders that are already delivered/fulfilled but don't have the timestamp
      try {
        const result = await query(
          `UPDATE orders SET delivered_at = updated_at 
           WHERE status IN ('delivered', 'fulfilled', 'completed') 
           AND delivered_at IS NULL`,
          []
        );
        const count = result.rowCount || 0;
        if (count > 0) {
          results.push(`Set delivered_at for ${count} orders`);
        }
      } catch (e) {
        results.push(`Error setting delivered_at: ${(e as Error).message}`);
      }
    }

    // Log the migration
    const user = await getUserById(session.user_id);
    await createAuditLog({
      action: 'PHASE_7B_MIGRATION',
      category: 'system',
      adminId: session.user_id,
      adminName: user?.name || 'Admin',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetType: 'orders',
      targetName: 'Order Schema',
      details: JSON.stringify({ results, migrateStatuses: body.migrateStatuses || false }),
    });

    return NextResponse.json({
      success: true,
      message: 'Phase 7B migration completed',
      results,
    });
  } catch (error) {
    console.error('Phase 7B migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}
