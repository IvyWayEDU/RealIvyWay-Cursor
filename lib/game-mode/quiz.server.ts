import 'server-only';

import { getAiSupabaseEnv } from '@/lib/supabase/config.server';
import type { GameModeQuiz } from './store.server';

function safePreviewForLogs(value: string, maxLen = 500): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function stripEmojisFromString(input: string): string {
  return input.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '');
}

function extractJsonObject(text: string): string | null {
  const s = String(text || '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return s.slice(first, last + 1);
}

function normalizeQuiz(raw: unknown): GameModeQuiz | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as any;
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  if (!title || questions.length === 0) return null;

  const normalizedQuestions = questions
    .map((q: any, idx: number) => {
      const prompt = typeof q?.prompt === 'string' ? q.prompt.trim() : '';
      const choices = Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c ?? '').trim()).filter(Boolean) : [];
      const correctIndex = Number.isFinite(q?.correctIndex) ? Number(q.correctIndex) : -1;
      const explanation = typeof q?.explanation === 'string' ? q.explanation.trim() : '';
      if (!prompt || choices.length < 2) return null;
      if (correctIndex < 0 || correctIndex >= choices.length) return null;
      const id = typeof q?.id === 'string' && q.id.trim() ? q.id.trim() : `q_${idx + 1}`;
      return { id, prompt, choices, correctIndex, explanation: explanation || undefined };
    })
    .filter(Boolean) as GameModeQuiz['questions'];

  if (normalizedQuestions.length === 0) return null;
  return { title, questions: normalizedQuestions };
}

export async function generateGameModeQuiz(args: {
  topic: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}): Promise<GameModeQuiz> {
  const topic = String(args.topic || '').trim();
  if (!topic) throw new Error('Topic is required');

  const questionCount = Math.max(5, Math.min(12, Math.floor(args.questionCount || 8)));
  const difficulty = args.difficulty;

  const SYSTEM_PROMPT =
    'Do not use emojis. Output must be valid JSON only. Keep choices concise and unambiguous.';

  const userPrompt = [
    'Create a Kahoot-style multiple-choice quiz for a live study battle.',
    '',
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    `Number of questions: ${questionCount}`,
    '',
    'Return ONLY valid JSON with this exact schema:',
    '{',
    '  "title": string,',
    '  "questions": [',
    '    {',
    '      "id": string,',
    '      "prompt": string,',
    '      "choices": string[],',
    '      "correctIndex": number,',
    '      "explanation": string',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Each question must have 4 choices.',
    '- correctIndex must be 0-3.',
    '- Explanations should be 1-2 sentences.',
    '- No markdown. No extra text outside JSON.',
    '',
  ].join('\n');

  const env = getAiSupabaseEnv();

  const upstreamResponse = await fetch(env.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.serviceRoleKey}`,
      apikey: env.serviceRoleKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!upstreamResponse.ok) {
    const rawText = await upstreamResponse.text().catch(() => '');
    console.error('[game-mode] quiz upstream error:', {
      status: upstreamResponse.status,
      bodyPreview: safePreviewForLogs(rawText, 800),
    });
    throw new Error('AI service request failed');
  }

  const upstreamJson = (await upstreamResponse.json().catch(() => null)) as any;
  const extracted: unknown =
    (typeof upstreamJson === 'string' ? upstreamJson : undefined) ??
    upstreamJson?.message ??
    upstreamJson?.choices?.[0]?.message?.content ??
    upstreamJson?.choices?.[0]?.text ??
    upstreamJson?.output_text ??
    upstreamJson?.content ??
    upstreamJson?.text;

  const messageText = typeof extracted === 'string' ? extracted : '';
  const cleaned = stripEmojisFromString(messageText).trim();
  const jsonText = extractJsonObject(cleaned) ?? cleaned;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error('[game-mode] failed to parse quiz JSON:', {
      preview: safePreviewForLogs(cleaned, 1000),
    });
    throw new Error('AI returned invalid quiz JSON');
  }

  const quiz = normalizeQuiz(parsed);
  if (!quiz) {
    console.error('[game-mode] quiz JSON did not match schema:', {
      preview: safePreviewForLogs(jsonText, 1000),
    });
    throw new Error('AI returned quiz in unexpected format');
  }

  // Enforce exactly 4 choices for UI consistency.
  quiz.questions = quiz.questions.map((q) => ({
    ...q,
    choices: q.choices.slice(0, 4),
    correctIndex: Math.min(3, Math.max(0, q.correctIndex)),
  }));

  return quiz;
}

