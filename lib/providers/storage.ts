'use server';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ProviderProfile } from '@/lib/models/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROVIDERS_FILE = path.join(DATA_DIR, 'providers.json');

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Read all providers from file
export async function getProviders(): Promise<ProviderProfile[]> {
  await ensureDataDir();
  
  if (!existsSync(PROVIDERS_FILE)) {
    return [];
  }
  
  try {
    const data = await readFile(PROVIDERS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle both array and object formats
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    // If object format, convert to array
    return Object.values(parsed);
  } catch (error) {
    console.error('Error reading providers file:', error);
    return [];
  }
}

// Write providers to file
export async function saveProviders(providers: ProviderProfile[]): Promise<void> {
  await ensureDataDir();
  await writeFile(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf-8');
}

// Get provider by ID
export async function getProviderById(id: string): Promise<ProviderProfile | null> {
  const providers = await getProviders();
  return providers.find(provider => provider.id === id) || null;
}

// Get provider by userId
export async function getProviderByUserId(userId: string): Promise<ProviderProfile | null> {
  const providers = await getProviders();
  return providers.find(provider => provider.userId === userId) || null;
}

// Create new provider
export async function createProvider(provider: Omit<ProviderProfile, 'createdAt' | 'updatedAt'>): Promise<ProviderProfile> {
  const providers = await getProviders();
  const now = new Date().toISOString();
  const newProvider: ProviderProfile = {
    ...provider,
    createdAt: now,
    updatedAt: now,
  };
  providers.push(newProvider);
  await saveProviders(providers);
  return newProvider;
}

// Update provider
export async function updateProvider(id: string, updates: Partial<Omit<ProviderProfile, 'id' | 'userId' | 'createdAt'>>): Promise<ProviderProfile | null> {
  const providers = await getProviders();
  const index = providers.findIndex(provider => provider.id === id);
  
  if (index === -1) {
    return null;
  }
  
  providers[index] = {
    ...providers[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveProviders(providers);
  return providers[index];
}

// Delete provider
export async function deleteProvider(id: string): Promise<boolean> {
  const providers = await getProviders();
  const initialLength = providers.length;
  const filtered = providers.filter(provider => provider.id !== id);
  
  if (filtered.length === initialLength) {
    return false; // Provider not found
  }
  
  await saveProviders(filtered);
  return true;
}


