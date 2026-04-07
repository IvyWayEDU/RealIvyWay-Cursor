import { NextRequest } from 'next/server';
import { getAiSupabaseEnv } from '@/lib/supabase/config.server';

export const runtime = 'nodejs';

type AiChatRequestBody = {
  message?: unknown;
};

const SYSTEM_PROMPT =
  'Do not use emojis in responses. Keep responses clean and professional.';

function safePreviewForLogs(value: string, maxLen = 500): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function stripEmojisFromString(input: string): string {
  // Best-effort: remove most emoji glyphs and joiner/variation characters.
  return input.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '');
}

export async function POST(request: NextRequest) {
  try {
    let body: AiChatRequestBody | null = null;
    try {
      body = (await request.json()) as AiChatRequestBody;
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    console.log('[api/ai/chat] incoming message:', safePreviewForLogs(message));

    let supabaseAiUrl = '';
    let serviceRoleKey = '';
    try {
      const env = getAiSupabaseEnv();
      supabaseAiUrl = env.url;
      serviceRoleKey = env.serviceRoleKey;
    } catch (e) {
      console.error('[api/ai/chat] AI env misconfigured:', e);
      return new Response('AI service not configured', { status: 500 });
    }

    const upstreamResponse = await fetch(supabaseAiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        stream: false,
      }),
    });

    console.log('[api/ai/chat] response status:', upstreamResponse.status);

    if (!upstreamResponse.ok) {
      const rawText = await upstreamResponse.text().catch(() => '');
      console.error('[api/ai/chat] upstream error:', {
        status: upstreamResponse.status,
        bodyPreview: safePreviewForLogs(rawText, 800),
      });
      return Response.json({ message: 'AI service request failed' }, { status: 502 });
    }

    let upstreamJson: unknown = null;
    try {
      upstreamJson = await upstreamResponse.json();
    } catch {
      const rawText = await upstreamResponse.text().catch(() => '');
      console.error('[api/ai/chat] upstream returned non-JSON:', {
        contentType: upstreamResponse.headers.get('content-type') ?? '',
        bodyPreview: safePreviewForLogs(rawText, 800),
      });
      return Response.json({ message: 'AI service returned an invalid response' }, { status: 502 });
    }

    // Best-effort: support a few common non-streaming shapes.
    const maybe = upstreamJson as any;
    const extracted: unknown =
      (typeof upstreamJson === 'string' ? upstreamJson : undefined) ??
      maybe?.message ??
      maybe?.choices?.[0]?.message?.content ??
      maybe?.choices?.[0]?.text ??
      maybe?.output_text ??
      maybe?.content ??
      maybe?.text;

    const messageText = typeof extracted === 'string' ? extracted : '';
    const cleaned = stripEmojisFromString(messageText).trim();

    if (!cleaned) {
      console.error('[api/ai/chat] could not extract message from upstream:', {
        keys: upstreamJson && typeof upstreamJson === 'object' ? Object.keys(upstreamJson as any) : [],
      });
      return Response.json({ message: 'AI service returned an empty response' }, { status: 502 });
    }

    return Response.json({ message: cleaned }, { status: 200 });
  } catch (error) {
    console.error('[api/ai/chat] error:', error);
    return new Response('Unexpected error', { status: 500 });
  }
}

