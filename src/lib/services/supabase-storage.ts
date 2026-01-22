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

const SUPABASE_URL = 'https://riwmdjgqhrehglvuzhkp.supabase.co';
const BUCKET_NAME = 'KIOSK-IMAGES';

class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private serviceRoleKey: string | null = null;

  async init(serviceRoleKey?: string): Promise<boolean> {
    const key = serviceRoleKey || this.serviceRoleKey;
    
    if (!key) {
      console.warn('[SUPABASE_STORAGE] No service role key provided');
      return false;
    }

    try {
      this.serviceRoleKey = key;
      this.client = createClient(SUPABASE_URL, key, {
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
      throw new Error('Supabase storage not initialized. Please configure the service role key in Admin > API Management.');
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
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('[SUPABASE_STORAGE] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = this.client.storage
      .from(BUCKET_NAME)
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
      const pathToDelete = filePath.includes(BUCKET_NAME) 
        ? filePath.split(`${BUCKET_NAME}/`)[1] 
        : filePath;

      const { error } = await this.client.storage
        .from(BUCKET_NAME)
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
        .from(BUCKET_NAME)
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
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
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
    return BUCKET_NAME;
  }

  getSupabaseUrl(): string {
    return SUPABASE_URL;
  }
}

export const supabaseStorage = new SupabaseStorageService();
