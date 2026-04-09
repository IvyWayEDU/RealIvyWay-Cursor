 import { NextResponse } from 'next/server';
 import { getServerSession } from '@/lib/auth/getServerSession';
 import { getSupabaseAdmin } from '@/lib/supabase/admin.server';
 import { handleApiError } from '@/lib/errorHandler';
 
 export async function GET() {
   try {
     const session = await getServerSession();
     if (!session) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
 
     const supabase = getSupabaseAdmin();
     const { data, error } = await supabase
       .from('schools')
       .select('id, name')
       .order('name', { ascending: true });
     if (error) throw error;
 
     const schools = (data ?? [])
       .map((s: any) => ({
         id: String(s?.id ?? '').trim(),
         name: String(s?.name ?? '').trim(),
       }))
       .filter((s) => s.id && s.name);
 
     return NextResponse.json({ schools });
   } catch (error) {
     return handleApiError(error, { logPrefix: '[api/schools] GET' });
   }
 }
