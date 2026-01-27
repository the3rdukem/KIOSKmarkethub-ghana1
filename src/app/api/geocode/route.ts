/**
 * Geocoding API Route
 * 
 * Converts addresses to coordinates using Google Maps Geocoding API
 * Used for courier app deep links with prefilled locations
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';

interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (session.user_role !== 'vendor' && session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS;
    if (!apiKey) {
      console.error('[Geocode] Google Maps API key not configured');
      return NextResponse.json({ error: 'Geocoding service not configured' }, { status: 503 });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;
      
      const geocodeResult: GeocodeResult = {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: result.formatted_address,
      };
      
      return NextResponse.json(geocodeResult);
    } else if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    } else {
      console.error('[Geocode] Google Maps API error:', data.status, data.error_message);
      return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Geocode] Error:', error);
    return NextResponse.json({ error: 'Failed to geocode address' }, { status: 500 });
  }
}
