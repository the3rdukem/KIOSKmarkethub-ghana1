import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface SupabaseStorageFile {
  url: string;
  path: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SupabaseUploadOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  directory?: string;
}

const DEFAULT_OPTIONS: SupabaseUploadOptions = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  directory: 'general',
};

class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private projectUrl: string = '';
  private bucketName: string = '';

  async initFromIntegration(): Promise<boolean> {
    try {
      const response = await fetch('/api/integrations?id=supabase_storage', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.warn('[SUPABASE_STORAGE] Failed to fetch integration config');
        return false;
      }
      
      const data = await response.json();
      const integration = data.integration;
      
      if (!integration || !integration.isConfigured || !integration.isEnabled) {
        console.warn('[SUPABASE_STORAGE] Integration not configured or enabled');
        return false;
      }
      
      const { serviceRoleKey, projectUrl, bucketName } = integration.credentials;
      
      if (!serviceRoleKey || !projectUrl || !bucketName) {
        console.warn('[SUPABASE_STORAGE] Missing required credentials');
        return false;
      }
      
      return this.init(serviceRoleKey, projectUrl, bucketName);
    } catch (error) {
      console.error('[SUPABASE_STORAGE] Failed to init from integration:', error);
      return false;
    }
  }

  init(serviceRoleKey: string, projectUrl: string, bucketName: string): boolean {
    try {
      this.projectUrl = projectUrl;
      this.bucketName = bucketName;
      this.client = createClient(projectUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      return true;
    } catch (error) {
      console.error('[SUPABASE_STORAGE] Failed to initialize:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    options: SupabaseUploadOptions = {}
  ): Promise<SupabaseStorageFile> {
    if (!this.client) {
      throw new Error('Supabase storage not initialized. Please configure the integration in Admin > API Management.');
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.maxSizeBytes && file.length > opts.maxSizeBytes) {
      throw new Error(`File size exceeds maximum allowed (${opts.maxSizeBytes / (1024 * 1024)}MB)`);
    }

    if (opts.allowedTypes && !opts.allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${opts.allowedTypes.join(', ')}`);
    }

    const ext = this.getExtension(mimeType, originalName);
    const hash = crypto.createHash('md5').update(file).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const filename = `${timestamp}_${hash}${ext}`;
    const filePath = `${opts.directory}/${filename}`;

    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('[SUPABASE_STORAGE] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
      filename,
      originalName,
      mimeType,
      size: file.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async uploadBase64(
    base64Data: string,
    originalName: string,
    options: SupabaseUploadOptions = {}
  ): Promise<SupabaseStorageFile> {
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data format');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    return this.uploadFile(buffer, originalName, mimeType, options);
  }

  async deleteFile(filePath: string): Promise<boolean> {
    if (!this.client) {
      console.warn('[SUPABASE_STORAGE] Not initialized, cannot delete');
      return false;
    }

    try {
      const pathToDelete = filePath.includes(this.bucketName) 
        ? filePath.split(`${this.bucketName}/`)[1] 
        : filePath;

      const { error } = await this.client.storage
        .from(this.bucketName)
        .remove([pathToDelete]);

      if (error) {
        console.error('[SUPABASE_STORAGE] Delete failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SUPABASE_STORAGE] Delete error:', error);
      return false;
    }
  }

  async listFiles(directory: string = ''): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(directory);

      if (error) {
        console.error('[SUPABASE_STORAGE] List failed:', error);
        return [];
      }

      return data?.map(file => `${directory}/${file.name}`) || [];
    } catch (error) {
      console.error('[SUPABASE_STORAGE] List error:', error);
      return [];
    }
  }

  getPublicUrl(filePath: string): string {
    return `${this.projectUrl}/storage/v1/object/public/${this.bucketName}/${filePath}`;
  }

  private getExtension(mimeType: string, originalName: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };

    if (mimeToExt[mimeType]) {
      return mimeToExt[mimeType];
    }

    const ext = originalName.split('.').pop();
    return ext ? `.${ext}` : '.bin';
  }

  getMaxFileSize(): number {
    return DEFAULT_OPTIONS.maxSizeBytes || 5 * 1024 * 1024;
  }

  getAllowedTypes(): string[] {
    return DEFAULT_OPTIONS.allowedTypes || [];
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getProjectUrl(): string {
    return this.projectUrl;
  }
}

export const supabaseStorage = new SupabaseStorageService();
