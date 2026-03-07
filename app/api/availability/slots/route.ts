import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { generateSlots } from '@/lib/availability/slots';
import { normalizeServiceType } from '@/lib/availability/engine';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const timezone = searchParams.get('timezone') || 'America/New_York';
    const serviceType = searchParams.get('serviceType') || undefined;
    const subject = searchParams.get('subject') || undefined;
    const school = searchParams.get('school') || undefined;
    
    // Validate input
    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    // Validate serviceType is provided
    if (!serviceType) {
      return NextResponse.json(
        { error: 'serviceType parameter is required' },
        { status: 400 }
      );
    }

    // Validate/normalize serviceType early to return 400 on bad inputs (not 500)
    try {
      normalizeServiceType(serviceType);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid serviceType parameter' },
        { status: 400 }
      );
    }
    
    // Validate subject is required for tutoring and test_prep
    const normalizedServiceType = serviceType.toLowerCase().replace(/-/g, '_');
    if ((normalizedServiceType === 'tutoring' || normalizedServiceType === 'test_prep' || normalizedServiceType === 'testprep') && !subject) {
      return NextResponse.json(
        { error: 'subject parameter is required for tutoring and test prep services' },
        { status: 400 }
      );
    }
    
    // Generate slots (server-filtered; excludes RESERVED slots)
    const slots = await generateSlots(date, timezone, serviceType, subject, school);
    
    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Get slots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
