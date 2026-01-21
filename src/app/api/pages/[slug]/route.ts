import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPageBySlug, getFooterPages, getHeaderPages } from '@/lib/db/dal/static-pages';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    if (slug === '_footer') {
      const pages = await getFooterPages();
      return NextResponse.json({ pages });
    }
    
    if (slug === '_header') {
      const pages = await getHeaderPages();
      return NextResponse.json({ pages });
    }
    
    const page = await getPublishedPageBySlug(slug);
    
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    return NextResponse.json({ page });
  } catch (error) {
    console.error('Failed to get static page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
