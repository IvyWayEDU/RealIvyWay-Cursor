export type SupportAIDashboardRole = 'student' | 'provider';

type FaqEntry = {
  id: string;
  question: string;
  answer: (role: SupportAIDashboardRole) => string;
  keywords: string[];
};

const SESSIONS_PATH_BY_ROLE: Record<SupportAIDashboardRole, string> = {
  student: '/dashboard/student/sessions',
  provider: '/dashboard/sessions',
};

const FAQ: FaqEntry[] = [
  {
    id: 'book_session',
    question: 'How do I book a session?',
    keywords: ['book', 'booking', 'schedule', 'session', 'provider', 'time', 'availability'],
    answer: () =>
      [
        'To book a session:',
        `1) Go to /dashboard/book`,
        '2) Choose a provider and an available time',
        '3) Complete payment to confirm the booking',
      ].join('\n'),
  },
  {
    id: 'join_session',
    question: 'How do I join my session?',
    keywords: ['join', 'zoom', 'link', 'meeting', 'session', 'upcoming', 'start'],
    answer: (role) =>
      [
        'To join an upcoming session:',
        `1) Go to ${SESSIONS_PATH_BY_ROLE[role]}`,
        '2) Open your upcoming session',
        '3) Click “Join” to enter the meeting',
      ].join('\n'),
  },
  {
    id: 'payments',
    question: 'How do payments work?',
    keywords: ['payment', 'pay', 'card', 'stripe', 'charge', 'invoice', 'receipt'],
    answer: () =>
      [
        'Payments are handled securely through Stripe.',
        'Your session is only confirmed after payment succeeds.',
        'If you need a receipt or see a payment issue, I can help you create a support ticket.',
      ].join('\n'),
  },
  {
    id: 'bundles',
    question: 'How do bundles work?',
    keywords: ['bundle', 'package', 'credits', 'multiple', 'sessions', 'remaining'],
    answer: () =>
      [
        'Bundles include a set number of sessions at a package rate.',
        'As you book, your remaining bundle sessions (credits) are applied automatically when eligible.',
        'If something doesn’t look right (remaining count, eligibility, or pricing), I can create a ticket for the team to review.',
      ].join('\n'),
  },
  {
    id: 'refunds',
    question: 'How do refunds work?',
    keywords: ['refund', 'refunds', 'cancel', 'cancellation', 'credit', 'chargeback'],
    answer: () =>
      [
        'Refunds/credits depend on timing and the session’s status.',
        'If you share the session details (date/time and what happened), I can create a support ticket so a human team member can review eligibility.',
      ].join('\n'),
  },
  {
    id: 'contact_support',
    question: 'How do I contact support?',
    keywords: ['contact', 'support', 'help', 'ticket', 'email', 'admin'],
    answer: () =>
      [
        'You can contact support by creating a support ticket.',
        'Go to /dashboard/support to submit a request, or /dashboard/support/tickets to view your existing tickets.',
      ].join('\n'),
  },
  {
    id: 'withdrawals',
    question: 'How do withdrawals work?',
    keywords: ['withdraw', 'withdrawal', 'payout', 'earnings', 'balance', 'transfer'],
    answer: (role) =>
      role === 'provider'
        ? [
            'To withdraw earnings:',
            '1) Go to /dashboard/earnings',
            '2) Click Withdraw (or go to /dashboard/earnings/withdraw)',
            '3) Submit your withdrawal request',
            'Pending withdrawals reduce your available balance until processed.',
          ].join('\n')
        : [
            'Withdrawals apply to provider earnings. If you’re a provider, go to /dashboard/earnings.',
            'If you think you’re seeing the wrong page for your account type, I can help create a ticket.',
          ].join('\n'),
  },
  {
    id: 'profile_settings',
    question: 'Where do I find profile settings?',
    keywords: ['profile', 'settings', 'account', 'edit', 'photo', 'password', 'name'],
    answer: () =>
      [
        'You can update your profile here:',
        '- /dashboard/profile',
      ].join('\n'),
  },
  {
    id: 'messages',
    question: 'Where do I find messages?',
    keywords: ['message', 'messages', 'chat', 'inbox', 'dm', 'conversation'],
    answer: () =>
      [
        'Your messages are here:',
        '- /dashboard/messages',
      ].join('\n'),
  },
  {
    id: 'support_tickets',
    question: 'Where do I view support tickets?',
    keywords: ['tickets', 'ticket', 'support', 'request', 'status', 'reply'],
    answer: () =>
      [
        'You can view and reply to your support tickets here:',
        '- /dashboard/support/tickets',
      ].join('\n'),
  },
];

const ESCALATION_TRIGGERS = [
  'human',
  'talk to support',
  'real help',
  'did not solve',
  "didn't solve",
  'create a ticket',
  'create ticket',
  'contact admin',
  'speak to someone',
  'agent',
  'representative',
  'call me',
];

export function shouldEscalateToHuman(text: string): boolean {
  const t = normalize(text);
  return ESCALATION_TRIGGERS.some((k) => t.includes(k));
}

export function isAffirmative(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (t === 'y' || t === 'yes') return true;
  return (
    t.includes('yes') ||
    t.includes('yeah') ||
    t.includes('yep') ||
    t.includes('sure') ||
    t.includes('please do') ||
    t.includes('ok') ||
    t.includes('okay') ||
    t.includes('go ahead') ||
    t.includes('do it')
  );
}

export function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreEntry(entry: FaqEntry, userText: string): { score: number; matched: string[] } {
  const t = normalize(userText);
  if (!t) return { score: 0, matched: [] };
  const matched = entry.keywords.filter((k) => t.includes(k));
  const score = matched.length / Math.max(1, entry.keywords.length);
  return { score, matched };
}

export function matchFaq(args: {
  message: string;
  role: SupportAIDashboardRole;
}): { entry: FaqEntry; confidence: number } | null {
  const t = normalize(args.message);
  if (!t) return null;

  let best: { entry: FaqEntry; confidence: number; matchedCount: number } | null = null;
  for (const entry of FAQ) {
    const { score, matched } = scoreEntry(entry, t);
    const matchedCount = matched.length;
    const confidence = Math.min(0.98, score + Math.min(0.35, matchedCount * 0.08));
    if (!best || confidence > best.confidence) best = { entry, confidence, matchedCount };
  }

  if (!best) return null;

  // Guardrail: require at least 2 keyword hits OR a moderate confidence score.
  if (best.matchedCount < 2 && best.confidence < 0.55) return null;
  return { entry: best.entry, confidence: best.confidence };
}

export function generateTicketSubject(args: {
  role: SupportAIDashboardRole;
  lastUserMessage: string;
  matchedFaqId?: string | null;
}): string {
  const msg = String(args.lastUserMessage || '').trim();
  const short = msg.length > 80 ? `${msg.slice(0, 77)}…` : msg;

  const prefix =
    args.matchedFaqId === 'payments'
      ? 'Payment help'
      : args.matchedFaqId === 'refunds'
        ? 'Refund help'
        : args.matchedFaqId === 'bundles'
          ? 'Bundle help'
          : args.matchedFaqId === 'withdrawals'
            ? 'Withdrawal help'
            : args.matchedFaqId === 'join_session'
              ? 'Joining a session'
              : args.matchedFaqId === 'book_session'
                ? 'Booking a session'
                : 'Support request';

  const roleLabel = args.role === 'provider' ? 'Provider' : 'Student';
  return short ? `${prefix} (${roleLabel}): ${short}` : `${prefix} (${roleLabel})`;
}

export function buildTicketBody(args: {
  role: SupportAIDashboardRole;
  transcript: Array<{ role: 'user' | 'assistant'; text: string }>;
}): string {
  const lines: string[] = [];
  lines.push('Created via AI Support chat.');
  lines.push(`Dashboard role: ${args.role}`);
  lines.push('');
  lines.push('Transcript:');

  const last = args.transcript.slice(-12);
  for (const m of last) {
    const who = m.role === 'user' ? 'User' : 'AI';
    lines.push(`${who}: ${String(m.text || '').trim()}`);
  }
  return lines.join('\n');
}

