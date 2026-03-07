export function shouldEscalateByKeyword(text: string): boolean {
  const t = (text || '').toLowerCase();
  // Intentionally specific to avoid escalating for normal "support" wording.
  // (Users often say "support" as part of their question.)
  const triggers = [
    'talk to human',
    'talk to a human',
    'speak to human',
    'speak to a human',
    'human agent',
    'live agent',
    'agent',
    'representative',
    'contact support',
    'connect me to support',
    'connect me with support',
    "this didn't help",
    'this did not help',
    'not helpful',
  ];

  if (triggers.some(k => t.includes(k))) return true;

  // Single-word shortcuts (common UI instruction)
  if (/\bhuman\b/.test(t)) return true;

  return false;
}

export function shouldEscalateByConfidence(confidence: number | null | undefined, threshold: number = 0.55): boolean {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return true;
  return confidence < threshold;
}


