/**
 * TEMP_ADMIN_MODE: In-memory withdrawal request storage for local testing
 * 
 * This is a temporary storage solution for local development without Supabase.
 * Withdrawal requests are stored in memory (Map) and will be lost on server restart.
 * DO NOT use in production. This will be replaced with database storage.
 */

/**
 * Withdrawal request entry
 */
export interface WithdrawalRequest {
  id: string;
  providerId: string;
  amountCents: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: string;
  updatedAt?: string;
}

// TEMP_ADMIN_MODE: In-memory storage (Map)
// Key: providerId, Value: Array of withdrawal requests
const withdrawalStore = new Map<string, WithdrawalRequest[]>();

/**
 * TEMP_ADMIN_MODE: Create a withdrawal request
 */
export function createWithdrawalRequest(request: Omit<WithdrawalRequest, 'id' | 'createdAt'>): WithdrawalRequest {
  const id = `withdrawal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const createdAt = new Date().toISOString();
  
  const withdrawalRequest: WithdrawalRequest = {
    ...request,
    id,
    createdAt,
  };

  const existing = withdrawalStore.get(request.providerId) || [];
  existing.push(withdrawalRequest);
  withdrawalStore.set(request.providerId, existing);

  return withdrawalRequest;
}

/**
 * TEMP_ADMIN_MODE: Get all withdrawal requests for a provider
 */
export function getProviderWithdrawalRequests(providerId: string): WithdrawalRequest[] {
  const requests = withdrawalStore.get(providerId) || [];
  return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * TEMP_ADMIN_MODE: Get all withdrawal requests (for admin)
 */
export function getAllWithdrawalRequests(): WithdrawalRequest[] {
  const allRequests: WithdrawalRequest[] = [];
  withdrawalStore.forEach((requests) => {
    allRequests.push(...requests);
  });
  return allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * TEMP_ADMIN_MODE: Get withdrawal request by ID
 */
export function getWithdrawalRequestById(id: string): WithdrawalRequest | null {
  for (const requests of withdrawalStore.values()) {
    const request = requests.find(r => r.id === id);
    if (request) {
      return request;
    }
  }
  return null;
}

/**
 * TEMP_ADMIN_MODE: Update withdrawal request status
 */
export function updateWithdrawalRequestStatus(
  id: string,
  status: WithdrawalRequest['status']
): boolean {
  for (const [providerId, requests] of withdrawalStore.entries()) {
    const index = requests.findIndex(r => r.id === id);
    if (index >= 0) {
      requests[index] = {
        ...requests[index],
        status,
        updatedAt: new Date().toISOString(),
      };
      withdrawalStore.set(providerId, requests);
      return true;
    }
  }
  return false;
}

