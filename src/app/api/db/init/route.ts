/**
 * Database Initialization API Route
 *
 * Initializes the database on first load.
 * This should be called once when the application starts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDbSchema, getDatabaseStats, isDatabaseHealthy } from '@/lib/db/dal';

let initialized = false;

export async function GET(request: NextRequest) {
  try {
    if (!initialized) {
      await initializeDbSchema();
      initialized = true;
    }

    const stats = await getDatabaseStats();
    const healthy = await isDatabaseHealthy();

    return NextResponse.json({
      success: true,
      initialized: true,
      healthy,
      stats: {
        poolSize: stats.poolSize,
        connected: stats.connected,
        tables: stats.tables,
      },
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDbSchema();
    initialized = true;

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: String(error) },
      { status: 500 }
    );
  }
}
