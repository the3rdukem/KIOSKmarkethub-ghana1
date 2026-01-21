import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getAllFooterLinks, createFooterLink, updateFooterLink, deleteFooterLink, toggleFooterLinkVisibility } from '@/lib/db/dal/footer-links';
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
    
    const links = await getAllFooterLinks();
    return NextResponse.json({ links });
  } catch (error) {
    console.error('Failed to get footer links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { section, title, url, order_num = 0, is_external = false } = body;
    
    if (!section || !title || !url) {
      return NextResponse.json({ error: 'Section, title, and url are required' }, { status: 400 });
    }
    
    const link = await createFooterLink({
      section,
      title,
      url,
      order_num,
      is_visible: true,
      is_external,
    });
    
    return NextResponse.json({ link });
  } catch (error) {
    console.error('Failed to create footer link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Link ID required' }, { status: 400 });
    }
    
    const link = await updateFooterLink(id, updates);
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    
    return NextResponse.json({ link });
  } catch (error) {
    console.error('Failed to update footer link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Link ID required' }, { status: 400 });
    }
    
    const deleted = await deleteFooterLink(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete footer link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { id, action } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Link ID required' }, { status: 400 });
    }
    
    if (action === 'toggle') {
      const link = await toggleFooterLinkVisibility(id);
      if (!link) {
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
      }
      return NextResponse.json({ link });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to patch footer link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
