export const PERSONAL_CONTACT_INFO_BLOCK_MESSAGE =
  'Sharing personal contact information is not allowed';

type ContactInfoReason = 'phone' | 'email' | 'spelled_numbers';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

// Requirements:
// - sequences like 123-456-7890
// - or 10+ digits
const PHONE_FORMAT_RE =
  /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;
const DIGIT_RUN_RE = /\b\d{10,}\b/;

const NUMBER_WORDS = new Set<string>([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'thousand',
  'million',
  'billion',
]);

function hasSpelledOutNumberRun(text: string): boolean {
  const tokens = (text.toLowerCase().match(/[a-z]+/g) ?? []) as string[];
  let run = 0;
  for (const t of tokens) {
    if (NUMBER_WORDS.has(t)) {
      run += 1;
      // Reduce false positives like "one or two":
      // require at least 3 consecutive number-words (e.g. "one two three").
      if (run >= 3) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

export function detectPersonalContactInfo(text: string): { detected: boolean; reasons: ContactInfoReason[] } {
  const input = (text ?? '').trim();
  if (!input) return { detected: false, reasons: [] };

  const reasons: ContactInfoReason[] = [];

  if (EMAIL_RE.test(input)) reasons.push('email');
  if (PHONE_FORMAT_RE.test(input) || DIGIT_RUN_RE.test(input)) reasons.push('phone');
  if (hasSpelledOutNumberRun(input)) reasons.push('spelled_numbers');

  return { detected: reasons.length > 0, reasons };
}

export function containsPersonalContactInfo(text: string): boolean {
  return detectPersonalContactInfo(text).detected;
}

