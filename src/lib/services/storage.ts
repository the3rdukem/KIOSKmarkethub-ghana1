/**
 * Storage Abstraction Layer
 * 
 * Provider-agnostic file storage service.
 * Supports local filesystem storage with easy migration path to cloud providers (S3, GCS, etc.)
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageFile {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface UploadOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  directory?: string;
}

const DEFAULT_OPTIONS: UploadOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB default
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  directory: 'reviews',
};

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

class StorageService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error('[STORAGE] Failed to initialize uploads directory:', error);
      throw error;
    }
  }

  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    await this.init();

    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Validate file size
    if (opts.maxSizeBytes && file.length > opts.maxSizeBytes) {
      throw new Error(`File size exceeds maximum allowed (${opts.maxSizeBytes / (1024 * 1024)}MB)`);
    }

    // Validate file type
    if (opts.allowedTypes && !opts.allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${opts.allowedTypes.join(', ')}`);
    }

    // Generate unique filename
    const ext = this.getExtension(mimeType, originalName);
    const hash = crypto.createHash('md5').update(file).digest('hex').substring(0, 8);
    const timestamp = Date.now();
    const filename = `${opts.directory}_${timestamp}_${hash}${ext}`;

    // Create subdirectory if specified
    const subDir = opts.directory || 'general';
    const targetDir = path.join(UPLOADS_DIR, subDir);
    await fs.mkdir(targetDir, { recursive: true });

    // Write file
    const filePath = path.join(targetDir, filename);
    await fs.writeFile(filePath, file);

    // Return file info with public URL
    return {
      url: `/uploads/${subDir}/${filename}`,
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
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    // Extract base64 content and mime type
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data format');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    return this.uploadFile(buffer, originalName, mimeType, options);
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Convert URL to filesystem path
      const relativePath = fileUrl.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, relativePath);

      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('[STORAGE] Failed to delete file:', error);
      return false;
    }
  }

  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      const relativePath = fileUrl.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, relativePath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
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

    // Fallback to original extension
    const ext = path.extname(originalName);
    return ext || '.bin';
  }

  getMaxFileSize(): number {
    return DEFAULT_OPTIONS.maxSizeBytes || 5 * 1024 * 1024;
  }

  getAllowedTypes(): string[] {
    return DEFAULT_OPTIONS.allowedTypes || [];
  }
}

export const storage = new StorageService();
