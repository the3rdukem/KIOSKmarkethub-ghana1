/**
 * File Upload API
 * 
 * Handles file uploads with validation and storage abstraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/services/storage';
import { validateSessionToken } from '@/lib/db/dal/auth-service';

export const dynamic = 'force-dynamic';

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

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const uploadResult = await storage.uploadFile(
      buffer,
      file.name,
      file.type,
      {
        directory,
        maxSizeBytes: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }
    );

    return NextResponse.json({
      success: true,
      file: uploadResult,
    });
  } catch (error) {
    console.error('[UPLOAD_API] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
