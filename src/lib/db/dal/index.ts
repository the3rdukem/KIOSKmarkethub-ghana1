/**
 * Data Access Layer Index
 *
 * Exports all DAL modules for server-side data access.
 * These functions should ONLY be used in:
 * - API routes
 * - Server components
 * - Server actions
 *
 * NEVER import these in client components.
 */

// Database core functions
export { 
  query, 
  runTransaction, 
  isDatabaseHealthy, 
  getDatabaseStats, 
  closeDatabase,
  initializeDatabase as initializeDbSchema
} from '../index';

// Re-export individual modules with namespace imports to avoid conflicts
export * as users from './users';
export * as sessions from './sessions';
export * as products from './products';
export * as orders from './orders';
export * as vendors from './vendors';
export * as categories from './categories';
export * as integrations from './integrations';
export * as audit from './audit';
export * as admin from './admin';
export * as authService from './auth-service';

/**
 * Initialize the entire database system
 * Call this on application startup
 */
export async function initializeFullDatabase(): Promise<void> {
  const dbModule = await import('../index');
  await dbModule.initializeDatabase();

  const adminModule = await import('./admin');
  await adminModule.initializeAdminSystem();

  const integrationsModule = await import('./integrations');
  await integrationsModule.initializeIntegrations();

  console.log('[DB] Database system initialized');
}
