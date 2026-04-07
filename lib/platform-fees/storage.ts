'use server';

import { PlatformFee, PlatformFeesConfig, PlatformFeeServiceType, PlatformFeePlanType } from './types';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PLATFORM_FEES_FILE = path.join(DATA_DIR, 'platform-fees.json');

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

// Ensure data directory exists
async function ensureDataDir() {
  if (FS_DISABLED_IN_PROD) return;
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(DATA_DIR, { recursive: true });
  } catch {
    return;
  }
}

/**
 * Get default platform fees (IvyWay launch defaults)
 */
function getDefaultPlatformFees(): PlatformFee[] {
  const now = new Date().toISOString();
  
  return [
    // Tutoring - Single session: $19
    {
      id: 'tutoring-single-session',
      serviceType: 'tutoring',
      planType: 'single-session',
      calculationType: 'flat',
      amountCents: 1900, // $19.00
      percentage: 0,
      updatedAt: now,
    },
    // Tutoring - Monthly package: $49
    {
      id: 'tutoring-monthly-package',
      serviceType: 'tutoring',
      planType: 'monthly-package',
      calculationType: 'flat',
      amountCents: 4900, // $49.00
      percentage: 0,
      updatedAt: now,
    },
    // Test Prep - Single session: $49
    {
      id: 'test-prep-single-session',
      serviceType: 'test-prep',
      planType: 'single-session',
      calculationType: 'flat',
      amountCents: 4900, // $49.00
      percentage: 0,
      updatedAt: now,
    },
    // Test Prep - Monthly package: $99
    {
      id: 'test-prep-monthly-package',
      serviceType: 'test-prep',
      planType: 'monthly-package',
      calculationType: 'flat',
      amountCents: 9900, // $99.00
      percentage: 0,
      updatedAt: now,
    },
    // College Counseling - Single session (60 min): $29
    {
      id: 'college-counseling-single',
      serviceType: 'college-counseling',
      planType: 'counseling-single',
      calculationType: 'flat',
      amountCents: 2900, // $29.00
      percentage: 0,
      updatedAt: now,
    },
    // College Counseling - Monthly plan (4 sessions): $59
    {
      id: 'college-counseling-monthly',
      serviceType: 'college-counseling',
      planType: 'counseling-monthly',
      calculationType: 'flat',
      amountCents: 5900, // $59.00
      percentage: 0,
      updatedAt: now,
    },
    // Virtual College Tours - Single tour: $34
    {
      id: 'virtual-tours-single-tour',
      serviceType: 'virtual-tours',
      planType: 'single-tour',
      calculationType: 'flat',
      amountCents: 3400, // $34.00
      percentage: 0,
      updatedAt: now,
    },
  ];
}

/**
 * Read platform fees from file
 */
export async function getPlatformFeesConfig(): Promise<PlatformFeesConfig> {
  if (FS_DISABLED_IN_PROD) {
    const defaultFees = getDefaultPlatformFees();
    return {
      fees: defaultFees,
      lastUpdatedAt: new Date().toISOString(),
    };
  }
  await ensureDataDir();

  try {
    const fsp = await import('fs/promises');
    const data = await fsp.readFile(PLATFORM_FEES_FILE, 'utf-8');
    const config = JSON.parse(data) as PlatformFeesConfig;
    
    // Ensure all default fees exist (migration for new fee types)
    const defaultFees = getDefaultPlatformFees();
    const existingFeeIds = new Set(config.fees.map(f => f.id));
    const missingFees = defaultFees.filter(f => !existingFeeIds.has(f.id));
    
    if (missingFees.length > 0) {
      config.fees.push(...missingFees);
      await savePlatformFeesConfig(config);
    }
    
    return config;
  } catch (error) {
    // Return defaults on error
    const defaultFees = getDefaultPlatformFees();
    return {
      fees: defaultFees,
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save platform fees to file
 */
export async function savePlatformFeesConfig(config: PlatformFeesConfig): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  await ensureDataDir();
  try {
    const fsp = await import('fs/promises');
    await fsp.writeFile(PLATFORM_FEES_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    return;
  }
}

/**
 * Get platform fee for a specific service and plan
 */
export async function getPlatformFee(
  serviceType: PlatformFee['serviceType'],
  planType: PlatformFee['planType']
): Promise<PlatformFee | null> {
  const config = await getPlatformFeesConfig();
  return config.fees.find(
    fee => fee.serviceType === serviceType && fee.planType === planType
  ) || null;
}

/**
 * Update platform fee
 */
export async function updatePlatformFee(
  feeId: string,
  updates: Partial<Omit<PlatformFee, 'id' | 'serviceType' | 'planType'>>,
  updatedBy?: string
): Promise<boolean> {
  const config = await getPlatformFeesConfig();
  const feeIndex = config.fees.findIndex(fee => fee.id === feeId);
  
  if (feeIndex === -1) {
    return false;
  }
  
  const now = new Date().toISOString();
  config.fees[feeIndex] = {
    ...config.fees[feeIndex],
    ...updates,
    updatedAt: now,
    updatedBy,
  };
  
  config.lastUpdatedAt = now;
  config.lastUpdatedBy = updatedBy;
  
  await savePlatformFeesConfig(config);
  return true;
}

/**
 * Calculate platform fee amount in cents
 * Returns the fee amount in cents based on the fee configuration and base price
 */
export async function calculatePlatformFee(
  serviceType: PlatformFeeServiceType,
  planType: PlatformFeePlanType,
  basePriceCents: number
): Promise<number> {
  const fee = await getPlatformFee(serviceType, planType);
  
  if (!fee) {
    // No fee configured, return 0
    return 0;
  }
  
  if (fee.calculationType === 'flat') {
    return fee.amountCents;
  } else {
    // Percentage calculation
    return Math.round((basePriceCents * fee.percentage) / 100);
  }
}

