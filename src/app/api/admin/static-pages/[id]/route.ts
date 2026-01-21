import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  getStaticPageById,
  updateStaticPage,
  deleteStaticPage,
  UpdateStaticPageInput
} from '@/lib/db/dal/static-pages';
import { cookies } from 'next/headers';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  if (!token) return null;
  
  const result = await validateSessionToken(token);
  if (!result.success || !result.data) return null;
  
  return result.data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { id } = await params;
    const page = await getStaticPageById(id);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ page });
  } catch (error) {
    console.error('Failed to get static page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session, user } = sessionData;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { id } = await params;
    const body = await request.json();
    const { slug, title, content, metaTitle, metaDescription, isPublished, showInFooter, showInHeader, orderIndex } = body;
    
    if (slug) {
      const slugPattern = /^[a-z0-9-]+$/;
      if (!slugPattern.test(slug)) {
        return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 });
      }
    }
    
    const input: UpdateStaticPageInput = {
      ...(slug !== undefined && { slug }),
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(metaTitle !== undefined && { metaTitle }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(isPublished !== undefined && { isPublished }),
      ...(showInFooter !== undefined && { showInFooter }),
      ...(showInHeader !== undefined && { showInHeader }),
      ...(orderIndex !== undefined && { orderIndex }),
      updatedBy: user?.id || session.userId
    };
    
    const page = await updateStaticPage(id, input);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ page });
  } catch (error) {
    console.error('Failed to update static page:', error);
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { session } = sessionData;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { id } = await params;
    const deleted = await deleteStaticPage(id);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete static page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
