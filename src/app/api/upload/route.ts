/**
 * File Upload API
 * 
 * Handles file uploads with validation and storage abstraction.
 * Uses Supabase Storage when configured, falls back to local storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/services/storage';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getIntegrationById } from '@/lib/db/dal/integrations';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const directory = (formData.get('directory') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `File type ${file.type} not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}` 
      }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size: ${MAX_SIZE / (1024 * 1024)}MB` 
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Try Supabase Storage first
    const integration = await getIntegrationById('supabase_storage');
    
    if (integration && integration.isConfigured && integration.isEnabled) {
      const { serviceRoleKey, projectUrl, bucketName } = integration.credentials;
      
      if (serviceRoleKey && projectUrl && bucketName) {
        try {
          const supabase = createClient(projectUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          const ext = getExtension(file.type, file.name);
          const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
          const timestamp = Date.now();
          const filename = `${timestamp}_${hash}${ext}`;
          const filePath = `${directory}/${filename}`;

          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, buffer, {
              contentType: file.type,
              upsert: false,
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);

            return NextResponse.json({
              success: true,
              url: urlData.publicUrl,
              file: {
                url: urlData.publicUrl,
                path: filePath,
                filename,
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                storage: 'supabase',
              },
            });
          }

          console.error('[UPLOAD_API] Supabase upload failed, falling back to local:', uploadError);
        } catch (supabaseError) {
          console.error('[UPLOAD_API] Supabase error, falling back to local:', supabaseError);
        }
      }
    }

    // Fallback to local storage
    const uploadResult = await storage.uploadFile(
      buffer,
      file.name,
      file.type,
      {
        directory,
        maxSizeBytes: MAX_SIZE,
        allowedTypes: ALLOWED_TYPES,
      }
    );

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      file: {
        ...uploadResult,
        storage: 'local',
      },
    });
  } catch (error) {
    console.error('[UPLOAD_API] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function getExtension(mimeType: string, originalName: string): string {
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
