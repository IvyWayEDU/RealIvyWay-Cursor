import { z } from 'zod';

/**
 * Session ID validation (UUID format)
 */
export const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

/**
 * Booking state schema for checkout and create-sessions
 */
export const selectedSessionSchema = z.object({
  date: z.union([z.string(), z.date(), z.coerce.date()]),
  time: z.string().min(1, 'Time is required'),
  startMinutes: z.number().int().min(0).max(1439).optional(),
});

export const bookingStateSchema = z.object({
  provider: z.string().min(1, 'Provider ID is required'),
  service: z.enum(['tutoring', 'counseling', 'virtual-tour', 'test-prep'], {
    errorMap: () => ({ message: 'Invalid service type' }),
  }),
  plan: z.string().min(1, 'Plan type is required'),
  subject: z.string().optional(),
  topic: z.string().optional(),
  timezone: z.string().optional(),
  studentNote: z.string().optional(),
  selectedSessions: z.array(selectedSessionSchema).min(1, 'At least one session must be selected'),
});

export const checkoutRequestSchema = z.object({
  bookingState: bookingStateSchema,
  selectedCreditId: z.string().uuid().optional().nullable(),
});

/**
 * Availability schemas
 */
export const timeRangeSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
});

export const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  timeRanges: z.array(timeRangeSchema),
});

export const availabilityBlockSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(0).max(1439),
});

export const availabilityPostSchema = z.object({
  days: z.array(daySchema).length(7).optional(),
  blocks: z.array(availabilityBlockSchema).optional(),
  intent: z.enum(['clear']).optional(),
  timezone: z.string().optional(),
}).refine(
  (data) => data.days || data.blocks || data.intent === 'clear',
  { message: 'Either days, blocks, or intent must be provided' }
);

/**
 * Availability query parameters (GET - all-slots)
 * Validation rules depend on serviceType:
 * - tutoring (+ test_prep): subject REQUIRED
 * - college_counseling: subject OPTIONAL/ignored, schoolId+schoolName REQUIRED, durationMinutes allowed
 * - virtual_tour: subject OPTIONAL/ignored, schoolId+schoolName REQUIRED, durationMinutes NOT allowed
 */
function normalizeAvailabilityServiceTypeForValidation(
  input: string | undefined
): 'tutoring' | 'test_prep' | 'college_counseling' | 'virtual_tour' | null {
  if (!input) return null;

  // Lowercase, replace hyphens with underscores, strip common plan suffixes
  let normalized = input.toLowerCase().replace(/-/g, '_');
  normalized = normalized.replace(/_monthly$/, '');
  normalized = normalized.replace(/_single$/, '');
  normalized = normalized.replace(/_30min$/, '');
  normalized = normalized.replace(/_60min$/, '');
  normalized = normalized.replace(/_30_min$/, '');
  normalized = normalized.replace(/_60_min$/, '');

  // Map to canonical types (do NOT default unknown to tutoring — keep unknown as null)
  if (normalized === 'tutoring') return 'tutoring';
  if (normalized === 'test_prep' || normalized === 'testprep') return 'test_prep';
  if (normalized === 'counseling' || normalized === 'college_counseling') return 'college_counseling';
  if (
    normalized === 'virtual_tour' ||
    normalized === 'virtualtour' ||
    normalized === 'virtual_tours' ||
    normalized === 'virtualtours'
  ) {
    return 'virtual_tour';
  }
  return null;
}

export const availabilityAllSlotsQuerySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    serviceType: z.string().optional(),
    subject: z.string().optional(),
    schoolId: z.string().optional(),
    schoolName: z.string().optional(),
    // Query params are strings; coerce to number when provided.
    durationMinutes: z.coerce.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    const service = normalizeAvailabilityServiceTypeForValidation(data.serviceType);

    // tutoring (+ test_prep): subject required
    if (service === 'tutoring' || service === 'test_prep') {
      if (!data.subject || data.subject.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'subject is required when serviceType is tutoring',
        });
      }
    }

    // college_counseling + virtual_tour: schoolId + schoolName required
    if (service === 'college_counseling' || service === 'virtual_tour') {
      if (!data.schoolId || data.schoolId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schoolId'],
          message: 'schoolId is required when serviceType is college_counseling or virtual_tour',
        });
      }
      if (!data.schoolName || data.schoolName.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schoolName'],
          message: 'schoolName is required when serviceType is college_counseling or virtual_tour',
        });
      }
    }

    // durationMinutes: only allowed for college_counseling
    if (typeof data.durationMinutes !== 'undefined' && service !== 'college_counseling') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationMinutes'],
        message: 'durationMinutes is only allowed when serviceType is college_counseling',
      });
    }

    // Counseling is 60 minutes only: reject any non-60 duration override.
    if (service === 'college_counseling' && typeof data.durationMinutes !== 'undefined') {
      if (data.durationMinutes !== 60) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['durationMinutes'],
          message: 'College counseling durationMinutes must be 60',
        });
      }
    }
  });

/**
 * Availability query parameters (GET - slots)
 */
export const availabilitySlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  serviceType: z.string().optional(),
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
});

/**
 * Providers query parameters (GET)
 * Note: id is optional - if missing, returns empty array
 */
export const providersQuerySchema = z.object({
  id: z.string().optional(),
});

/**
 * Payout schemas
 */
export const withdrawalRequestSchema = z.object({
  amountCents: z.number().int().positive('Amount must be greater than 0'),
});

export const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountHolderName: z.string().min(1, 'Account holder name is required'),
  routingNumber: z.string().regex(/^\d{9}$/, 'Routing number must be exactly 9 digits'),
  accountNumber: z.string().regex(/^\d{4,17}$/, 'Account number must be between 4 and 17 digits'),
  accountType: z.enum(['checking', 'savings'], {
    errorMap: () => ({ message: 'Account type must be "checking" or "savings"' }),
  }),
});

/**
 * Payment intent schema
 */
export const paymentIntentSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  planName: z.string().min(1, 'Plan name is required'),
  bookingId: z.string().uuid().optional(),
});

/**
 * Create sessions schema
 */
export const createSessionsSchema = z.object({
  bookingState: bookingStateSchema,
});

/**
 * Session tracking schemas
 */
export const sessionTrackingSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export const heartbeatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  role: z.enum(['provider', 'student'], {
    errorMap: () => ({ message: 'Role must be "provider" or "student"' }),
  }),
  event: z.enum(['join', 'tick', 'leave']).optional(),
});

/**
 * Session complete schema
 */
export const sessionCompleteSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

/**
 * Check no-shows schema
 */
export const checkNoShowsSchema = z.object({
  sessionId: z.string().uuid().optional(),
}).strict();

/**
 * Platform fees schema
 */
export const platformFeeUpdateSchema = z.object({
  feeId: z.string().min(1, 'feeId is required'),
  calculationType: z.enum(['flat', 'percentage'], {
    errorMap: () => ({ message: 'calculationType must be "flat" or "percentage"' }),
  }),
  amountCents: z.number().int().min(0).optional(),
  percentage: z.number().min(0).max(100).optional(),
}).refine(
  (data) => {
    if (data.calculationType === 'flat') {
      return typeof data.amountCents === 'number';
    } else {
      return typeof data.percentage === 'number';
    }
  },
  {
    message: 'For flat type, amountCents is required. For percentage type, percentage is required.',
  }
);

