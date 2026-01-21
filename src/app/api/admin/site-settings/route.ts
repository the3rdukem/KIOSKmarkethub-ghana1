import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getAllSettings, setSettings } from '@/lib/db/dal/site-settings';
import { cookies } from 'next/headers';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  
  const result = await validateSessionToken(token);
  if (!result.success || !result.data) return null;
  
  return result.data;
}

export async function GET() {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get site settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session, user } = sessionData;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { settings } = body;
    
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings object required' }, { status: 400 });
    }
    
    await setSettings(settings, user?.id || session.userId);
    
    const updatedSettings = await getAllSettings();
    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    console.error('Failed to update site settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
