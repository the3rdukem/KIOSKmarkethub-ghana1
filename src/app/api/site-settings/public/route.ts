import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db/dal/site-settings';

const PUBLIC_SETTING_KEYS = [
  'site_name',
  'tagline',
  'logo_url',
  'favicon_url',
  'primary_color',
  'secondary_color',
  'accent_color',
  'contact_email',
  'contact_phone',
  'contact_address',
  'footer_text',
  'copyright_text',
  'hero_headline',
  'hero_subheadline',
  'hero_image',
  'hero_cta_text',
  'hero_cta_link',
  'promo_banner_text',
  'promo_banner_enabled',
  'social_facebook',
  'social_twitter',
  'social_instagram',
  'social_linkedin'
];

export async function GET() {
  try {
    const settings = await getSettings(PUBLIC_SETTING_KEYS);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get public site settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
