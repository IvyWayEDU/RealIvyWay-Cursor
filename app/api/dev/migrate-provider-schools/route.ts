import { NextRequest, NextResponse } from 'next/server';
import { getUsers, updateUser } from '@/lib/auth/storage';
import { findSchoolByDisplayName, mapLegacySchoolNameToId, SCHOOLS_LIST } from '@/lib/models/schools';
import { handleApiError } from '@/lib/errorHandler';

/**
 * Dev-only migration helper to map provider schoolNames to schoolIds
 * POST /api/dev/migrate-provider-schools
 * 
 * Scans all providers and attempts to map schoolNames to schoolIds using:
 * 1. Exact match by displayName
 * 2. Legacy name mapping function
 * 
 * Only updates providers who have schoolNames but no schoolIds
 */
export async function POST(request: NextRequest) {
  // Require dev mode only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    console.log('[MIGRATE_PROVIDER_SCHOOLS] Starting migration');
    
    const allUsers = await getUsers();
    const providers = allUsers.filter(u => 
      u.roles.includes('counselor') || u.roles.includes('tutor')
    );
    
    let updatedCount = 0;
    const updates: Array<{ userId: string; name: string; schools: string[] }> = [];
    
    for (const provider of providers) {
      // Skip if already has schoolIds
      if (provider.schoolIds && provider.schoolIds.length > 0) {
        continue;
      }
      
      // Check if has schoolNames or legacy schools
      const schoolNames = provider.schoolNames || [];
      const legacySchools = provider.schools || [];
      
      if (schoolNames.length === 0 && legacySchools.length === 0) {
        continue; // No schools to migrate
      }
      
      // Attempt to map each school name to a schoolId
      const mappedSchools: Array<{ id: string; name: string }> = [];
      const schoolsToCheck = schoolNames.length > 0 ? schoolNames : legacySchools;
      
      for (const schoolName of schoolsToCheck) {
        if (!schoolName || !schoolName.trim()) continue;
        
        // Try to find by display name first
        const school = findSchoolByDisplayName(schoolName);
        if (school) {
          mappedSchools.push({ id: school.id, name: school.displayName });
          continue;
        }
        
        // Try mapping function for variations
        const mappedId = mapLegacySchoolNameToId(schoolName);
        if (mappedId) {
          const mappedSchool = SCHOOLS_LIST.find(s => s.id === mappedId);
          if (mappedSchool) {
            mappedSchools.push({ id: mappedSchool.id, name: mappedSchool.displayName });
            continue;
          }
        }
        
        // If no match found, log it but continue
        console.log(`[MIGRATE_PROVIDER_SCHOOLS] Could not map school name: "${schoolName}" for provider ${provider.id}`);
      }
      
      // If we found any matches, update the provider
      if (mappedSchools.length > 0) {
        const schoolIds = mappedSchools.map(s => s.id);
        const schoolNames = mappedSchools.map(s => s.name);
        
        await updateUser(provider.id, {
          schoolIds,
          schoolNames,
        });
        
        updatedCount++;
        updates.push({
          userId: provider.id,
          name: provider.name,
          schools: schoolNames,
        });
        
        console.log(`[MIGRATE_PROVIDER_SCHOOLS] Updated provider ${provider.id} (${provider.name}) with ${schoolIds.length} schools`);
      }
    }
    
    const result = {
      success: true,
      totalProviders: providers.length,
      providersUpdated: updatedCount,
      updates: updates.map(u => ({
        userId: u.userId,
        name: u.name,
        schools: u.schools,
      })),
    };
    
    console.log(`[MIGRATE_PROVIDER_SCHOOLS] Migration complete: ${updatedCount} providers updated`);
    
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/dev/migrate-provider-schools]' });
  }
}



