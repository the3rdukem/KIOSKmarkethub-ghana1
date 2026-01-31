/**
 * Health Check API
 * 
 * Simple endpoint for Render.com health checks and load balancer verification.
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1');
    
    if (result.rows.length > 0) {
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      status: 'degraded',
      database: 'query_failed',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  } catch (error) {
    console.error('[HEALTH] Database connection failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
