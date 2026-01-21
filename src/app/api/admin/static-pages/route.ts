import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  getAllStaticPages,
  createStaticPage,
  CreateStaticPageInput
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
    
    const pages = await getAllStaticPages();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Failed to get static pages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const { slug, title, content, metaTitle, metaDescription, isPublished, showInFooter, showInHeader } = body;
    
    if (!slug || !title || !content) {
      return NextResponse.json({ error: 'Slug, title, and content are required' }, { status: 400 });
    }
    
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug)) {
      return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 });
    }
    
    const input: CreateStaticPageInput = {
      slug,
      title,
      content,
      metaTitle,
      metaDescription,
      isPublished: isPublished ?? false,
      showInFooter: showInFooter ?? false,
      showInHeader: showInHeader ?? false,
      createdBy: user?.id || session.userId
    };
    
    const page = await createStaticPage(input);
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('Failed to create static page:', error);
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
