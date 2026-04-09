 import { NextRequest, NextResponse } from 'next/server';
 import { getServerSession } from '@/lib/auth/getServerSession';
 import { handleApiError } from '@/lib/errorHandler';
import { resolveOrCreateSchoolByName } from '@/lib/schools/resolveSchool';
 import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
 import { updateUser } from '@/lib/auth/storage';
 import { upsertProviderDataByUserId } from '@/lib/providers/storage';
 
 type Body = {
   schoolName?: string | null;
 };
 
 export async function POST(request: NextRequest) {
   try {
     const session = await getServerSession();
     if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 
     let raw: Body;
     try {
       raw = (await request.json()) as Body;
     } catch {
       return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
     }
 
     const input = typeof raw?.schoolName === 'string' ? raw.schoolName : '';
     const trimmed = input.trim();
 
     // Skip / clear => set provider.school_id = NULL
     if (!trimmed) {
       const supabase = getSupabaseAdmin();
       const { error: upsertErr } = await supabase
         .from('providers')
         .upsert({ id: session.userId, user_id: session.userId, school_id: null } as any, { onConflict: 'id' });
       if (upsertErr) throw upsertErr;
 
       await upsertProviderDataByUserId(session.userId, {
         schoolId: null,
         school: null,
         school_id: null,
         school_name: null,
       } as any);
 
       await updateUser(session.userId, {
         schoolId: null,
         schoolName: null,
         school_id: null,
         school_name: null,
         school: null,
         schoolIds: [],
         schoolNames: [],
       } as any);
 
       return NextResponse.json({ success: true, schoolId: null, schoolName: null });
     }
 
     const resolved = await resolveOrCreateSchoolByName(trimmed);
 
     // Persist relational link
     const supabase = getSupabaseAdmin();
     const { error: upsertErr } = await supabase
       .from('providers')
       .upsert(
         { id: session.userId, user_id: session.userId, school_id: resolved.id } as any,
         { onConflict: 'id' }
       );
     if (upsertErr) throw upsertErr;
 
     // Keep providers.data + users.data in sync for compatibility
     await upsertProviderDataByUserId(session.userId, {
       schoolId: resolved.id,
       school: resolved.name,
       school_id: resolved.id,
       school_name: resolved.name,
     } as any);
 
     await updateUser(session.userId, {
       schoolId: resolved.id,
       schoolName: resolved.name,
       school_id: resolved.id,
       school_name: resolved.name,
       school: resolved.name,
       schoolIds: [resolved.id],
       schoolNames: [resolved.name],
     } as any);
 
     return NextResponse.json({ success: true, schoolId: resolved.id, schoolName: resolved.name });
   } catch (error) {
     return handleApiError(error, { logPrefix: '[api/onboarding/provider-school] POST' });
   }
 }
