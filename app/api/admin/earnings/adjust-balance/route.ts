import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/middleware';
import path from 'path';
import { handleApiError } from '@/lib/errorHandler';

type Balances = Record<string, { balanceCents: number; updatedAt: string }>;

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

async function readBalances(): Promise<Balances> {
  if (FS_DISABLED_IN_PROD) return {};
  const file = path.join(process.cwd(), 'data', 'provider-earnings.json');
  try {
    const fsp = await import('fs/promises');
    const raw = await fsp.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Balances) : {};
  } catch {
    return {};
  }
}

async function writeBalances(balances: Balances): Promise<void> {
  if (FS_DISABLED_IN_PROD) return;
  const dir = path.join(process.cwd(), 'data');
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(dir, { recursive: true });
  } catch {
    return;
  }
  const file = path.join(dir, 'provider-earnings.json');
  try {
    const fsp = await import('fs/promises');
    await fsp.writeFile(file, JSON.stringify(balances, null, 2), 'utf-8');
  } catch {
    return;
  }
}

export async function POST(request: NextRequest) {
  const authResult = await auth.requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json().catch(() => ({}));
    const providerId = String((body as any)?.providerId ?? '').trim();
    const deltaCents = Number((body as any)?.deltaCents ?? 0);
    if (!providerId) return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    if (!Number.isFinite(deltaCents) || !Number.isInteger(deltaCents)) {
      return NextResponse.json({ error: 'deltaCents must be an integer' }, { status: 400 });
    }

    const balances = await readBalances();
    const prev = balances[providerId]?.balanceCents ?? 0;
    const nowISO = new Date().toISOString();
    balances[providerId] = {
      balanceCents: Math.max(0, prev + deltaCents),
      updatedAt: nowISO,
    };
    await writeBalances(balances);

    return NextResponse.json({ success: true, providerId, balance: balances[providerId] });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/admin/earnings/adjust-balance]' });
  }
}


