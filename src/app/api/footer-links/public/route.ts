import { NextResponse } from 'next/server';
import { getVisibleFooterLinks } from '@/lib/db/dal/footer-links';

export async function GET() {
  try {
    const links = await getVisibleFooterLinks();
    
    const sections: Record<string, Array<{ title: string; url: string; isExternal: boolean }>> = {};
    for (const link of links) {
      if (!sections[link.section]) {
        sections[link.section] = [];
      }
      sections[link.section].push({
        title: link.title,
        url: link.url,
        isExternal: link.is_external,
      });
    }
    
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Failed to get public footer links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
