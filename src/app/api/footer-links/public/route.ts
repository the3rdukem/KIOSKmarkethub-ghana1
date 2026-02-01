import { NextRequest, NextResponse } from 'next/server';
import { getVisibleFooterLinks } from '@/lib/db/dal/footer-links';
import { withRateLimit } from '@/lib/utils/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = await withRateLimit(request, 'api_public_read');
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response;
    }

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
