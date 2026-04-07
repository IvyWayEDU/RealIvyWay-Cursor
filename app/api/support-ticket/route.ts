import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import crypto from 'crypto';

import { requireAuth } from '@/lib/auth/requireAuth';
import { getDisplayRole } from '@/lib/auth/utils';
import { addSupportMessage, createSupportTicket } from '@/lib/support/ticketingStorage';
import { handleApiError } from '@/lib/errorHandler';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

const FS_DISABLED_IN_PROD = process.env.NODE_ENV === 'production';

function safeExtFromName(name: string): string {
  const base = (name || '').trim();
  const idx = base.lastIndexOf('.');
  if (idx === -1) return '';
  const ext = base.slice(idx + 1).toLowerCase();
  if (!ext || ext.length > 10) return '';
  // Whitelist common image extensions
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return '';
  return ext;
}

async function saveUpload(file: File): Promise<string | null> {
  if (FS_DISABLED_IN_PROD) return null;
  const uploadsDir = path.join(process.cwd(), 'public', 'support-uploads');
  try {
    const fsp = await import('fs/promises');
    await fsp.mkdir(uploadsDir, { recursive: true });
  } catch {
    return null;
  }

  const ext = safeExtFromName(file.name);
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filename = ext ? `ticket_${id}.${ext}` : `ticket_${id}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const fsp = await import('fs/promises');
    await fsp.writeFile(path.join(uploadsDir, filename), bytes);
  } catch {
    return null;
  }

  // Public URL
  return `/support-uploads/${filename}`;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    const rl = enforceRateLimit(request, {
      session,
      endpoint: '/api/support-ticket',
      body: { error: RATE_LIMIT_MESSAGE },
    });
    if (rl) return rl;

    const form = await request.formData();
    const rawSubject = String(form.get('subject') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();
    const attachment = form.get('attachment');

    if (!rawSubject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (rawSubject.length > 140) {
      return NextResponse.json({ error: 'Subject is too long (max 140 characters)' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // The ticket title should always match what the user entered.
    const subject = rawSubject;

    const role = getDisplayRole(session.roles) === 'provider' ? 'provider' : 'student';

    let attachmentUrl: string | null = null;
    if (attachment && attachment instanceof File && attachment.size > 0) {
      // Simple size guard (~5MB)
      if (attachment.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Attachment too large (max 5MB)' }, { status: 400 });
      }
      attachmentUrl = await saveUpload(attachment);
    }

    const ticket = await createSupportTicket({
      userId: session.userId,
      role,
      subject,
      status: 'open',
    });

    const fullMessage = attachmentUrl
      ? `${message}\n\nAttachment: ${attachmentUrl}`
      : message;

    await addSupportMessage({
      ticketId: ticket.id,
      senderId: session.userId,
      senderRole: role,
      message: fullMessage,
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handleApiError(error, { logPrefix: '[api/support-ticket]' });
  }
}


