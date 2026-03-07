'use server';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BANK_ACCOUNTS_FILE = path.join(DATA_DIR, 'bank-accounts.json');

/**
 * Bank account metadata for a provider
 * Only stores non-sensitive metadata - no full account numbers, routing numbers, or account holder names
 */
export interface BankAccount {
  providerId: string;
  bankName: string;
  last4: string; // Last 4 digits of account number only
  accountType: 'checking' | 'savings';
  connectedAt: string; // ISO timestamp when account was connected
  status: 'active' | 'disconnected'; // Account status
}

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Read bank accounts from file
async function getBankAccounts(): Promise<BankAccount[]> {
  await ensureDataDir();
  
  if (!existsSync(BANK_ACCOUNTS_FILE)) {
    return [];
  }
  
  try {
    const data = await readFile(BANK_ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading bank accounts file:', error);
    return [];
  }
}

// Write bank accounts to file
async function saveBankAccounts(accounts: BankAccount[]): Promise<void> {
  await ensureDataDir();
  await writeFile(BANK_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
}

/**
 * Set bank account for a provider
 * Only stores metadata - extracts last4 from account number, does not store sensitive data
 * 
 * @param providerId - The provider ID
 * @param accountData - Bank account data (will extract last4, discard sensitive fields)
 * @returns Bank account metadata
 */
export async function setBankAccount(
  providerId: string,
  accountData: {
    bankName: string;
    accountNumber: string; // Full account number (will extract last4 only)
    accountType: 'checking' | 'savings';
  }
): Promise<BankAccount> {
  const now = new Date().toISOString();
  const accounts = await getBankAccounts();
  
  // Extract last 4 digits from account number
  const last4 = accountData.accountNumber.length >= 4 
    ? accountData.accountNumber.slice(-4)
    : '****';
  
  // Find existing account
  const existingIndex = accounts.findIndex(acc => acc.providerId === providerId);
  
  const bankAccount: BankAccount = {
    providerId,
    bankName: accountData.bankName.trim(),
    last4,
    accountType: accountData.accountType,
    connectedAt: existingIndex >= 0 ? accounts[existingIndex].connectedAt : now,
    status: 'active',
  };
  
  if (existingIndex >= 0) {
    // Update existing account
    accounts[existingIndex] = bankAccount;
  } else {
    // Add new account
    accounts.push(bankAccount);
  }
  
  await saveBankAccounts(accounts);
  return bankAccount;
}

/**
 * Get bank account for a provider
 * Returns metadata only (no sensitive data)
 */
export async function getBankAccount(providerId: string): Promise<BankAccount | null> {
  const accounts = await getBankAccounts();
  return accounts.find(acc => acc.providerId === providerId && acc.status === 'active') || null;
}

/**
 * Get bank account for display (same as getBankAccount, but kept for backward compatibility)
 */
export async function getBankAccountForDisplay(providerId: string): Promise<BankAccount | null> {
  return getBankAccount(providerId);
}

/**
 * Delete/disconnect bank account for a provider
 * Marks account as disconnected rather than deleting it
 */
export async function deleteBankAccount(providerId: string): Promise<boolean> {
  const accounts = await getBankAccounts();
  const index = accounts.findIndex(acc => acc.providerId === providerId);
  
  if (index >= 0) {
    accounts[index] = {
      ...accounts[index],
      status: 'disconnected',
    };
    await saveBankAccounts(accounts);
    return true;
  }
  
  return false;
}
