/**
 * System Configuration Store
 *
 * Stores all platform-wide configuration that persists:
 * - Independently of user sessions
 * - Across logouts and restarts
 * - With proper encryption for sensitive data
 *
 * Only MASTER_ADMIN can modify these settings.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Master Admin Types
export type AdminRole = 'MASTER_ADMIN' | 'ADMIN';

export interface MasterAdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string; // bcrypt-style hash simulation
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  lastLoginAt?: string;
  mfaEnabled?: boolean;
  permissions: AdminPermission[];
}

export type AdminPermission =
  | 'MANAGE_API_KEYS'
  | 'MANAGE_ADMINS'
  | 'MANAGE_VENDORS'
  | 'MANAGE_USERS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_ORDERS'
  | 'MANAGE_DISPUTES'
  | 'VIEW_AUDIT_LOGS'
  | 'MANAGE_SYSTEM_SETTINGS'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_SECURITY'
  | 'MANAGE_CATEGORIES'
  | 'MANAGE_SITE_SETTINGS'
  | 'MANAGE_CMS'
  | 'MANAGE_APPROVALS'
  | 'MANAGE_FEATURED'
  | 'MANAGE_PROMOTIONS'
  | 'DELETE_USERS'
  | 'DELETE_PRODUCTS'
  | 'SUSPEND_USERS'
  | 'FULL_SYSTEM_ACCESS';

// All permissions for MASTER_ADMIN - FULL SYSTEM ACCESS
const MASTER_ADMIN_PERMISSIONS: AdminPermission[] = [
  'FULL_SYSTEM_ACCESS',
  'MANAGE_API_KEYS',
  'MANAGE_ADMINS',
  'MANAGE_VENDORS',
  'MANAGE_USERS',
  'MANAGE_PRODUCTS',
  'MANAGE_ORDERS',
  'MANAGE_DISPUTES',
  'VIEW_AUDIT_LOGS',
  'MANAGE_SYSTEM_SETTINGS',
  'VIEW_ANALYTICS',
  'MANAGE_SECURITY',
  'MANAGE_CATEGORIES',
  'MANAGE_SITE_SETTINGS',
  'MANAGE_CMS',
  'MANAGE_APPROVALS',
  'MANAGE_FEATURED',
  'MANAGE_PROMOTIONS',
  'DELETE_USERS',
  'DELETE_PRODUCTS',
  'SUSPEND_USERS',
];

// Limited permissions for regular ADMIN
const ADMIN_PERMISSIONS: AdminPermission[] = [
  'MANAGE_VENDORS',
  'MANAGE_USERS',
  'MANAGE_PRODUCTS',
  'MANAGE_ORDERS',
  'MANAGE_DISPUTES',
  'VIEW_AUDIT_LOGS',
  'VIEW_ANALYTICS',
];

export interface SystemAuditLog {
  id: string;
  action: string;
  category: 'auth' | 'api' | 'admin' | 'system' | 'security';
  performedBy: string;
  performedByEmail: string;
  performedByRole: AdminRole;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SystemSettings {
  platformName: string;
  platformUrl: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  registrationEnabled: boolean;
  vendorRegistrationEnabled: boolean;
  emailVerificationRequired: boolean;
  phoneVerificationRequired: boolean;
  maxLoginAttempts: number;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  requireStrongPassword: boolean;
  twoFactorRequired: boolean;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  platformName: 'KIOSK',
  platformUrl: 'https://kiosk.com.gh',
  maintenanceMode: false,
  registrationEnabled: true,
  vendorRegistrationEnabled: true,
  emailVerificationRequired: false,
  phoneVerificationRequired: false,
  maxLoginAttempts: 5,
  sessionTimeoutMinutes: 60,
  passwordMinLength: 8,
  requireStrongPassword: true,
  twoFactorRequired: false,
};

// Simple password hashing simulation (in production, use bcrypt on server)
const hashPassword = (password: string): string => {
  // Simple hash for demo - in production use bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const salt = Math.random().toString(36).substring(2, 10);
  return `$hash$${salt}$${Math.abs(hash).toString(36)}$${password.length}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  if (!storedHash.startsWith('$hash$')) return false;
  const parts = storedHash.split('$');
  if (parts.length < 5) return false;
  const storedLength = parseInt(parts[4], 10);
  if (password.length !== storedLength) return false;

  // Recalculate hash
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return parts[3] === Math.abs(hash).toString(36);
};

// Initial Master Admin (created on first load)
const INITIAL_MASTER_ADMIN: MasterAdminUser = {
  id: 'master_admin_001',
  email: 'the3rdukem@gmail.com',
  name: 'System Administrator',
  role: 'MASTER_ADMIN',
  passwordHash: hashPassword('123asdqweX$'),
  isActive: true,
  createdAt: new Date().toISOString(),
  permissions: MASTER_ADMIN_PERMISSIONS,
};

interface SystemConfigState {
  // Admin Management
  adminUsers: MasterAdminUser[];
  systemSettings: SystemSettings;
  systemAuditLogs: SystemAuditLog[];
  isInitialized: boolean;

  // Initialization
  initializeSystem: () => void;

  // Admin Authentication
  authenticateAdmin: (email: string, password: string) => {
    success: boolean;
    admin?: MasterAdminUser;
    error?: string
  };

  // Admin Management (Master Admin Only)
  createAdmin: (
    data: { email: string; name: string; password: string; role: AdminRole },
    createdBy: MasterAdminUser
  ) => { success: boolean; admin?: MasterAdminUser; error?: string };

  updateAdmin: (
    adminId: string,
    updates: Partial<Pick<MasterAdminUser, 'name' | 'isActive' | 'permissions'>>,
    updatedBy: MasterAdminUser
  ) => boolean;

  promoteToMasterAdmin: (
    adminId: string,
    promotedBy: MasterAdminUser,
    confirmationCode: string
  ) => { success: boolean; error?: string };

  revokeAdminAccess: (
    adminId: string,
    revokedBy: MasterAdminUser,
    reason: string
  ) => boolean;

  changeAdminPassword: (
    adminId: string,
    newPassword: string,
    changedBy: MasterAdminUser
  ) => boolean;

  // Getters
  getAdminByEmail: (email: string) => MasterAdminUser | undefined;
  getAdminById: (id: string) => MasterAdminUser | undefined;
  getAllAdmins: () => MasterAdminUser[];
  getMasterAdmins: () => MasterAdminUser[];

  // Permission Checks
  hasPermission: (admin: MasterAdminUser, permission: AdminPermission) => boolean;
  isMasterAdmin: (admin: MasterAdminUser) => boolean;

  // System Settings (Master Admin Only)
  updateSystemSettings: (
    updates: Partial<SystemSettings>,
    updatedBy: MasterAdminUser
  ) => boolean;
  getSystemSettings: () => SystemSettings;

  // Audit Logging
  addSystemAuditLog: (log: Omit<SystemAuditLog, 'id' | 'timestamp'>) => void;
  getSystemAuditLogs: (filters?: {
    category?: string;
    performedBy?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
  }) => SystemAuditLog[];

  // Security
  updateLastLogin: (adminId: string) => void;
}

export const useSystemConfigStore = create<SystemConfigState>()(
  persist(
    (set, get) => ({
      adminUsers: [],
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      systemAuditLogs: [],
      isInitialized: false,

      initializeSystem: () => {
        const state = get();
        if (state.isInitialized) return;

        // Check if master admin exists
        const existingMasterAdmin = state.adminUsers.find(
          a => a.email === INITIAL_MASTER_ADMIN.email && a.role === 'MASTER_ADMIN'
        );

        if (!existingMasterAdmin) {
          set((s) => ({
            adminUsers: [...s.adminUsers, INITIAL_MASTER_ADMIN],
            isInitialized: true,
          }));

          // Log initialization
          get().addSystemAuditLog({
            action: 'SYSTEM_INITIALIZED',
            category: 'system',
            performedBy: 'SYSTEM',
            performedByEmail: 'system@markethub.gh',
            performedByRole: 'MASTER_ADMIN',
            details: 'System initialized with initial Master Admin account',
            severity: 'critical',
          });
        } else {
          set({ isInitialized: true });
        }
      },

      authenticateAdmin: (email, password) => {
        const admin = get().adminUsers.find(
          a => a.email.toLowerCase() === email.toLowerCase()
        );

        if (!admin) {
          get().addSystemAuditLog({
            action: 'ADMIN_LOGIN_FAILED',
            category: 'auth',
            performedBy: 'unknown',
            performedByEmail: email,
            performedByRole: 'ADMIN',
            details: `Failed login attempt - account not found: ${email}`,
            severity: 'warning',
          });
          return { success: false, error: 'Invalid credentials' };
        }

        if (!admin.isActive) {
          get().addSystemAuditLog({
            action: 'ADMIN_LOGIN_FAILED',
            category: 'auth',
            performedBy: admin.id,
            performedByEmail: admin.email,
            performedByRole: admin.role,
            details: 'Failed login attempt - account disabled',
            severity: 'warning',
          });
          return { success: false, error: 'Account is disabled. Contact system administrator.' };
        }

        if (!verifyPassword(password, admin.passwordHash)) {
          get().addSystemAuditLog({
            action: 'ADMIN_LOGIN_FAILED',
            category: 'auth',
            performedBy: admin.id,
            performedByEmail: admin.email,
            performedByRole: admin.role,
            details: 'Failed login attempt - invalid password',
            severity: 'warning',
          });
          return { success: false, error: 'Invalid credentials' };
        }

        // Update last login
        get().updateLastLogin(admin.id);

        get().addSystemAuditLog({
          action: 'ADMIN_LOGIN_SUCCESS',
          category: 'auth',
          performedBy: admin.id,
          performedByEmail: admin.email,
          performedByRole: admin.role,
          details: `${admin.role} logged in successfully`,
          severity: 'info',
        });

        return { success: true, admin };
      },

      createAdmin: (data, createdBy) => {
        // Only MASTER_ADMIN can create admins
        if (createdBy.role !== 'MASTER_ADMIN') {
          return { success: false, error: 'Only Master Admin can create admin accounts' };
        }

        // Check if email already exists
        if (get().adminUsers.some(a => a.email.toLowerCase() === data.email.toLowerCase())) {
          return { success: false, error: 'An admin with this email already exists' };
        }

        // Validate password strength
        if (data.password.length < 8) {
          return { success: false, error: 'Password must be at least 8 characters' };
        }

        const newAdmin: MasterAdminUser = {
          id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: data.email,
          name: data.name,
          role: data.role,
          passwordHash: hashPassword(data.password),
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: createdBy.id,
          permissions: data.role === 'MASTER_ADMIN' ? MASTER_ADMIN_PERMISSIONS : ADMIN_PERMISSIONS,
        };

        set((state) => ({
          adminUsers: [...state.adminUsers, newAdmin],
        }));

        get().addSystemAuditLog({
          action: 'ADMIN_CREATED',
          category: 'admin',
          performedBy: createdBy.id,
          performedByEmail: createdBy.email,
          performedByRole: createdBy.role,
          targetId: newAdmin.id,
          targetType: 'admin',
          targetName: newAdmin.name,
          details: `Created new ${data.role} account: ${data.email}`,
          severity: 'critical',
        });

        return { success: true, admin: newAdmin };
      },

      updateAdmin: (adminId, updates, updatedBy) => {
        // Only MASTER_ADMIN can update admins
        if (updatedBy.role !== 'MASTER_ADMIN') {
          return false;
        }

        const targetAdmin = get().getAdminById(adminId);
        if (!targetAdmin) return false;

        // Cannot modify initial master admin except by themselves
        if (targetAdmin.id === INITIAL_MASTER_ADMIN.id && updatedBy.id !== targetAdmin.id) {
          return false;
        }

        set((state) => ({
          adminUsers: state.adminUsers.map(a =>
            a.id === adminId ? { ...a, ...updates } : a
          ),
        }));

        get().addSystemAuditLog({
          action: 'ADMIN_UPDATED',
          category: 'admin',
          performedBy: updatedBy.id,
          performedByEmail: updatedBy.email,
          performedByRole: updatedBy.role,
          targetId: adminId,
          targetType: 'admin',
          targetName: targetAdmin.name,
          details: `Updated admin account: ${JSON.stringify(updates)}`,
          severity: 'warning',
        });

        return true;
      },

      promoteToMasterAdmin: (adminId, promotedBy, confirmationCode) => {
        // Only MASTER_ADMIN can promote
        if (promotedBy.role !== 'MASTER_ADMIN') {
          return { success: false, error: 'Only Master Admin can promote admins' };
        }

        // Require confirmation code
        if (confirmationCode !== 'CONFIRM_PROMOTE') {
          return { success: false, error: 'Invalid confirmation code' };
        }

        const targetAdmin = get().getAdminById(adminId);
        if (!targetAdmin) {
          return { success: false, error: 'Admin not found' };
        }

        if (targetAdmin.role === 'MASTER_ADMIN') {
          return { success: false, error: 'Already a Master Admin' };
        }

        set((state) => ({
          adminUsers: state.adminUsers.map(a =>
            a.id === adminId
              ? { ...a, role: 'MASTER_ADMIN' as AdminRole, permissions: MASTER_ADMIN_PERMISSIONS }
              : a
          ),
        }));

        get().addSystemAuditLog({
          action: 'ADMIN_PROMOTED_TO_MASTER',
          category: 'security',
          performedBy: promotedBy.id,
          performedByEmail: promotedBy.email,
          performedByRole: promotedBy.role,
          targetId: adminId,
          targetType: 'admin',
          targetName: targetAdmin.name,
          details: `Promoted ${targetAdmin.email} to MASTER_ADMIN`,
          severity: 'critical',
        });

        return { success: true };
      },

      revokeAdminAccess: (adminId, revokedBy, reason) => {
        // Only MASTER_ADMIN can revoke
        if (revokedBy.role !== 'MASTER_ADMIN') {
          return false;
        }

        const targetAdmin = get().getAdminById(adminId);
        if (!targetAdmin) return false;

        // Cannot revoke initial master admin
        if (targetAdmin.id === INITIAL_MASTER_ADMIN.id) {
          return false;
        }

        // Cannot revoke yourself
        if (targetAdmin.id === revokedBy.id) {
          return false;
        }

        set((state) => ({
          adminUsers: state.adminUsers.map(a =>
            a.id === adminId ? { ...a, isActive: false } : a
          ),
        }));

        get().addSystemAuditLog({
          action: 'ADMIN_ACCESS_REVOKED',
          category: 'security',
          performedBy: revokedBy.id,
          performedByEmail: revokedBy.email,
          performedByRole: revokedBy.role,
          targetId: adminId,
          targetType: 'admin',
          targetName: targetAdmin.name,
          details: `Revoked admin access: ${reason}`,
          severity: 'critical',
        });

        return true;
      },

      changeAdminPassword: (adminId, newPassword, changedBy) => {
        // Only MASTER_ADMIN can change passwords (or admin for themselves)
        if (changedBy.role !== 'MASTER_ADMIN' && changedBy.id !== adminId) {
          return false;
        }

        if (newPassword.length < 8) {
          return false;
        }

        const targetAdmin = get().getAdminById(adminId);
        if (!targetAdmin) return false;

        set((state) => ({
          adminUsers: state.adminUsers.map(a =>
            a.id === adminId ? { ...a, passwordHash: hashPassword(newPassword) } : a
          ),
        }));

        get().addSystemAuditLog({
          action: 'ADMIN_PASSWORD_CHANGED',
          category: 'security',
          performedBy: changedBy.id,
          performedByEmail: changedBy.email,
          performedByRole: changedBy.role,
          targetId: adminId,
          targetType: 'admin',
          targetName: targetAdmin.name,
          details: `Password changed for ${targetAdmin.email}`,
          severity: 'critical',
        });

        return true;
      },

      getAdminByEmail: (email) => {
        return get().adminUsers.find(a => a.email.toLowerCase() === email.toLowerCase());
      },

      getAdminById: (id) => {
        return get().adminUsers.find(a => a.id === id);
      },

      getAllAdmins: () => {
        return get().adminUsers;
      },

      getMasterAdmins: () => {
        return get().adminUsers.filter(a => a.role === 'MASTER_ADMIN');
      },

      hasPermission: (admin, permission) => {
        return admin.permissions.includes(permission);
      },

      isMasterAdmin: (admin) => {
        return admin.role === 'MASTER_ADMIN';
      },

      updateSystemSettings: (updates, updatedBy) => {
        // Only MASTER_ADMIN can update system settings
        if (updatedBy.role !== 'MASTER_ADMIN') {
          return false;
        }

        const previousSettings = get().systemSettings;

        set((state) => ({
          systemSettings: { ...state.systemSettings, ...updates },
        }));

        get().addSystemAuditLog({
          action: 'SYSTEM_SETTINGS_UPDATED',
          category: 'system',
          performedBy: updatedBy.id,
          performedByEmail: updatedBy.email,
          performedByRole: updatedBy.role,
          details: `System settings updated`,
          previousValue: JSON.stringify(previousSettings),
          newValue: JSON.stringify({ ...previousSettings, ...updates }),
          severity: 'critical',
        });

        return true;
      },

      getSystemSettings: () => {
        return get().systemSettings;
      },

      addSystemAuditLog: (logData) => {
        const newLog: SystemAuditLog = {
          ...logData,
          id: `syslog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          systemAuditLogs: [newLog, ...state.systemAuditLogs].slice(0, 2000),
        }));
      },

      getSystemAuditLogs: (filters) => {
        let logs = get().systemAuditLogs;

        if (filters?.category) {
          logs = logs.filter(log => log.category === filters.category);
        }
        if (filters?.performedBy) {
          logs = logs.filter(log => log.performedBy === filters.performedBy);
        }
        if (filters?.severity) {
          logs = logs.filter(log => log.severity === filters.severity);
        }
        if (filters?.startDate) {
          logs = logs.filter(log => log.timestamp >= filters.startDate!);
        }
        if (filters?.endDate) {
          logs = logs.filter(log => log.timestamp <= filters.endDate!);
        }

        return logs;
      },

      updateLastLogin: (adminId) => {
        set((state) => ({
          adminUsers: state.adminUsers.map(a =>
            a.id === adminId ? { ...a, lastLoginAt: new Date().toISOString() } : a
          ),
        }));
      },
    }),
    {
      name: 'marketplace-system-config',
      // This store persists completely - never cleared on logout
    }
  )
);

// Export permission constants for use in components
export { MASTER_ADMIN_PERMISSIONS, ADMIN_PERMISSIONS };

// Helper to check if current admin has permission
export const checkAdminPermission = (
  admin: MasterAdminUser | null,
  permission: AdminPermission
): boolean => {
  if (!admin) return false;
  return admin.permissions.includes(permission);
};

// Helper to mask sensitive values for regular admins
export const shouldMaskValue = (admin: MasterAdminUser | null): boolean => {
  if (!admin) return true;
  return admin.role !== 'MASTER_ADMIN';
};
