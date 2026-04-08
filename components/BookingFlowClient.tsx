'use client';

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SCHOOLS, School, searchSchools } from '@/data/schools';
import { PRICING_CATALOG, formatUsdFromCents } from '@/lib/pricing/catalog';

type Service = 'tutoring' | 'counseling' | 'virtual-tour' | 'test-prep' | null;
type Plan = string | null;
type Subject = string | null;
type Topic = string | null;
type SelectedSchool = School | null;
type TimeSlot = string | null;
type ProviderId = string | null;

interface SelectedSession {
  // Canonical slot identity (UTC)
  startTimeUTC: string;
  endTimeUTC: string;
  providerId: string | null;
  // For UI/calendar convenience
  date: Date;
  displayTime: string;
  displayString: string;
}

// Check if two schools match by ID
function schoolsMatch(school1: SelectedSchool, school2: SelectedSchool): boolean {
  if (!school1 || !school2) return false;
  return school1.id === school2.id;
}

// Check if there are any providers available for a given school
// For virtual tours: Only providers tagged with the school (strict matching by schoolId, no fallback)
// For counseling: Providers tagged with the school OR general counselors (fallback allowed)
function hasProviderForSchool(school: SelectedSchool, service: Service): boolean {
  if (!school) return false;
  
  if (service === 'virtual-tour') {
    // STRICT: Virtual tours require exact schoolId match, no fallback
    return MOCK_PROVIDERS.some((provider) => {
      // Must be a Counselor (virtual tour guides are counselors)
      if (provider.role !== 'Counselor') return false;
      // Must be tagged for virtual tours
      if (normalizeSubjectName(provider.subject) !== 'virtual tour') return false;
      // Check if provider is tagged with this school by schoolId
      // Provider schoolTags should contain school IDs from the canonical list
      if (!provider.schoolTags || provider.schoolTags.length === 0) return false;
      return provider.schoolTags.some((tag) => {
        // Try to match by schoolId (canonical ID)
        const tagSchool = SCHOOLS.find(s => s.id === tag || s.name === tag);
        return tagSchool && tagSchool.id === school.id;
      });
    });
  } else if (service === 'counseling') {
    // Counseling: Check for school-tagged counselors OR general counselors (fallback)
    return MOCK_PROVIDERS.some((provider) => {
      // Must be a Counselor
      if (provider.role !== 'Counselor') return false;
      // Must be tagged for college counseling
      if (normalizeSubjectName(provider.subject) !== 'college counseling') return false;
      // Check if provider is tagged with this school OR is a general counselor (empty schoolTags)
      if (!provider.schoolTags || provider.schoolTags.length === 0) {
        return true; // General counselor (fallback)
      }
      // Match by schoolId
      return provider.schoolTags.some((tag) => {
        const tagSchool = SCHOOLS.find(s => s.id === tag || s.name === tag);
        return tagSchool && tagSchool.id === school.id;
      });
    });
  }
  
  return false;
}

interface BookingState {
  service: Service;
  plan: Plan;
  subject: Subject;
  topic: Topic;
  school: SelectedSchool;
  // Explicit school identity for counseling flows (more reliable than relying solely on nested `school`)
  schoolId: string | null;
  schoolName: string | null;
  timeSlot: TimeSlot;
  selectedSessions: SelectedSession[];
  provider: ProviderId;
}

// Helper function to determine required number of sessions based on plan
function getRequiredSessionsCount(plan: Plan): number {
  if (!plan) return 1;
  
  // Monthly plans requiring 4 sessions
  if (plan === 'tutoring-monthly' || plan === 'test-prep-monthly' || plan === 'counseling-monthly') {
    return 4;
  }
  
  // All other plans (single sessions)
  return 1;
}

const SERVICES = [
  {
    id: 'tutoring' as const,
    name: 'Tutoring',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'counseling' as const,
    name: 'College Counseling',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    id: 'virtual-tour' as const,
    name: 'Virtual College Tour',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'test-prep' as const,
    name: 'Test Prep',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

// Tutoring subjects - academic subjects only (no test prep)
const TUTORING_SUBJECTS = [
  'Math',
  'Science',
  'History & Social Studies',
  'English & Language Arts',
  'Foreign Languages',
  'Computer Science',
];

// Topic lists for each tutoring subject
const TUTORING_TOPICS: Record<string, string[]> = {
  'Math': [
    'Arithmetic',
    'Pre-Algebra',
    'Algebra I',
    'Algebra II',
    'Geometry',
    'Trigonometry',
    'Pre-Calculus',
    'Calculus AB',
    'Calculus BC',
    'Multivariable Calculus',
    'Linear Algebra',
    'Probability',
    'Statistics',
    'Discrete Math',
    'Differential Equations',
    'Number Theory',
    'IB Math',
    'AP Math',
    'Competition Math',
  ],
  'Science': [
    'General Science',
    'Biology',
    'Chemistry',
    'Physics',
    'Environmental Science',
    'Earth Science',
    'Anatomy & Physiology',
    'Organic Chemistry',
    'Inorganic Chemistry',
    'Physical Chemistry',
    'Biochemistry',
    'Molecular Biology',
    'Genetics',
    'Cell Biology',
    'Astronomy',
    'AP Biology',
    'AP Chemistry',
    'AP Physics',
    'IB Science',
  ],
  'History & Social Studies': [
    'World History',
    'U.S. History',
    'European History',
    'Government & Civics',
    'Economics',
    'Psychology',
    'Sociology',
    'Anthropology',
    'Geography',
    'Political Science',
    'AP World History',
    'AP U.S. History',
    'AP European History',
    'AP Government',
    'AP Economics',
    'IB History',
    'IB Social Studies',
  ],
  'English & Language Arts': [
    'Reading Comprehension',
    'Writing Fundamentals',
    'Grammar',
    'Vocabulary',
    'Essay Writing',
    'Literary Analysis',
    'Creative Writing',
    'Research Papers',
    'Public Speaking',
    'Speech & Debate',
    'AP English Language',
    'AP English Literature',
    'IB English',
  ],
  'Foreign Languages': [
    'Spanish',
    'French',
    'Mandarin',
    'Cantonese',
    'German',
    'Italian',
    'Portuguese',
    'Japanese',
    'Korean',
    'Arabic',
    'Russian',
    'Hindi',
    'Latin',
    'ESL / ELL',
    'Conversation Practice',
    'Grammar & Writing',
    'Reading Comprehension',
    'AP Language Prep',
    'IB Language Prep',
  ],
  'Computer Science': [
    'Computer Basics',
    'Programming Fundamentals',
    'Python',
    'Java',
    'C++',
    'JavaScript',
    'Web Development',
    'HTML & CSS',
    'React',
    'Data Structures',
    'Algorithms',
    'Object-Oriented Programming',
    'Databases',
    'SQL',
    'Cybersecurity',
    'Machine Learning Basics',
    'Artificial Intelligence Basics',
    'AP Computer Science A',
    'AP Computer Science Principles',
    'IB Computer Science',
  ],
};

// Test Prep subjects - standardized tests only
const TEST_PREP_SUBJECTS = [
  'SAT',
  'ACT',
  'PSAT',
  'AP Exams',
  'IB Exams',
  'GRE',
  'GMAT',
  'SSAT',
  'ISEE',
  'Regents Exams',
  'TOEFL',
  'IELTS',
  'Other',
];

function normalizeServiceQueryParam(raw: string | null): Service {
  if (!raw) return null;
  const v = raw
    .trim()
    .toLowerCase()
    // Allow pretty labels like "Test Prep" / "Virtual Tour" / "College Counseling"
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  switch (v) {
    case 'tutoring':
    case 'tutoring_services':
    case 'tutoring_service':
      return 'tutoring';
    case 'test_prep':
    case 'testprep':
    case 'test_prep_services':
    case 'test_prep_service':
    case 'test_prep_tutoring':
    case 'test_prep_session':
      return 'test-prep';
    case 'college_counseling':
    case 'counseling':
    case 'college-counseling':
    case 'college_counseling_services':
    case 'college_counseling_service':
    case 'college_counseling_session':
    case 'college_counseling_1_1':
    case 'college':
      return 'counseling';
    case 'virtual_tour':
    case 'virtual-tour':
    case 'virtual_tours':
    case 'virtual_tour_services':
    case 'virtual_tour_service':
    case 'virtual_college_tour':
      return 'virtual-tour';
    default:
      return null;
  }
}

function normalizeSubjectParam(raw: string | null, allowed: string[]): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = allowed.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

const TIME_SLOTS = [
  'Monday, Jan 15 - 10:00 AM',
  'Monday, Jan 15 - 2:00 PM',
  'Tuesday, Jan 16 - 10:00 AM',
  'Tuesday, Jan 16 - 2:00 PM',
  'Wednesday, Jan 17 - 10:00 AM',
  'Wednesday, Jan 17 - 2:00 PM',
  'Thursday, Jan 18 - 10:00 AM',
  'Thursday, Jan 18 - 2:00 PM',
  'Friday, Jan 19 - 10:00 AM',
  'Friday, Jan 19 - 2:00 PM',
];

// Extended provider type to support language capabilities for Foreign Languages and topic capabilities for Computer Science
type Provider = {
  id: string;
  name: string;
  school: string;
  rating: number;
  role: 'Tutor' | 'Counselor'; // Role-based filtering: Tutors for tutoring/test-prep, Counselors for counseling
  subject: string; // Subject for tutors/test-prep, or school tag for counselors
  languages?: string[]; // Only for Foreign Languages tutors
  topics?: string[]; // Only for Computer Science tutors
  schoolTags?: string[]; // Schools the counselor is tagged with (for college counseling)
};

const MOCK_PROVIDERS: Provider[] = [
  // Tutors for Tutoring Services
  { id: '1', name: 'Dr. Sarah Johnson', school: 'Harvard University', rating: 4.9, role: 'Tutor', subject: 'Math' },
  { id: '2', name: 'Prof. Michael Chen', school: 'MIT', rating: 4.8, role: 'Tutor', subject: 'Science' },
  { id: '5', name: 'Dr. Lisa Wang', school: 'Princeton University', rating: 4.9, role: 'Tutor', subject: 'History & Social Studies' },
  { id: '6', name: 'Prof. James Wilson', school: 'Columbia University', rating: 4.8, role: 'Tutor', subject: 'English & Language Arts' },
  { id: '7', name: 'Dr. Maria Garcia', school: 'UCLA', rating: 4.7, role: 'Tutor', subject: 'Foreign Languages', languages: ['Spanish', 'French', 'Portuguese'] },
  { id: '8', name: 'Prof. Robert Taylor', school: 'Carnegie Mellon', rating: 4.9, role: 'Tutor', subject: 'Computer Science', topics: ['Python', 'Java', 'Data Structures', 'Algorithms', 'AP Computer Science A'] },
  { id: '11', name: 'Dr. Yuki Tanaka', school: 'UC Berkeley', rating: 4.8, role: 'Tutor', subject: 'Foreign Languages', languages: ['Japanese', 'Korean', 'Mandarin'] },
  { id: '12', name: 'Prof. Hans Mueller', school: 'Cornell University', rating: 4.9, role: 'Tutor', subject: 'Foreign Languages', languages: ['German', 'French', 'Russian'] },
  
  // Tutors for Test Prep
  { id: '3', name: 'Dr. Emily Rodriguez', school: 'Stanford University', rating: 4.9, role: 'Tutor', subject: 'SAT' },
  { id: '4', name: 'Prof. David Kim', school: 'Yale University', rating: 4.7, role: 'Tutor', subject: 'ACT' },
  { id: '9', name: 'Dr. Jennifer Lee', school: 'Duke University', rating: 4.8, role: 'Tutor', subject: 'PSAT' },
  { id: '10', name: 'Prof. Christopher Brown', school: 'Northwestern University', rating: 4.7, role: 'Tutor', subject: 'AP Exams' },
  
  // Counselors for College Counseling (tagged with schools)
  { id: '13', name: 'Dr. Amanda Foster', school: 'Harvard University', rating: 4.9, role: 'Counselor', subject: 'College Counseling', schoolTags: ['Harvard University'] },
  { id: '14', name: 'Prof. Mark Thompson', school: 'Stanford University', rating: 4.8, role: 'Counselor', subject: 'College Counseling', schoolTags: ['Stanford University', 'UC Berkeley'] },
  { id: '15', name: 'Dr. Patricia Martinez', school: 'Yale University', rating: 4.7, role: 'Counselor', subject: 'College Counseling', schoolTags: ['Yale University'] },
  { id: '16', name: 'Prof. General Advisor', school: 'Various', rating: 4.6, role: 'Counselor', subject: 'College Counseling', schoolTags: [] }, // General counselor (no specific school tags)
  
  // Providers for Virtual College Tours (tagged with schools)
  { id: '17', name: 'Campus Guide - Harvard', school: 'Harvard University', rating: 4.9, role: 'Counselor', subject: 'Virtual Tour', schoolTags: ['Harvard University'] },
  { id: '18', name: 'Campus Guide - Stanford', school: 'Stanford University', rating: 4.8, role: 'Counselor', subject: 'Virtual Tour', schoolTags: ['Stanford University'] },
  { id: '19', name: 'Campus Guide - MIT', school: 'MIT', rating: 4.9, role: 'Counselor', subject: 'Virtual Tour', schoolTags: ['MIT'] },
];

// Normalize subject/test name for case-insensitive matching
function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase();
}

function formatSubjectLabel(subject: string): string {
  const s = String(subject || '').trim().toLowerCase().replace(/-/g, '_');
  if (!s) return '';
  if (s === 'test_prep') return 'Test Prep';
  if (s === 'english') return 'English';
  if (s === 'math') return 'Math';
  if (s === 'science') return 'Science';
  if (s === 'history') return 'History';
  if (s === 'languages') return 'Languages';
  // Fallback: Title Case words
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

// Check if at least one active tutor is available for a given subject or test
// STRICT MATCHING: Only Tutors with exact subject/test match
// For tutoring: subject-only matching (except Foreign Languages and Computer Science which require topic-level matching)
function hasTutorAvailableForSubject(service: Service, subject: Subject, topic: Topic = null): boolean {
  if (!subject || !service) return false;
  
  // Only check for Tutoring and Test Prep services
  if (service !== 'tutoring' && service !== 'test-prep') return true;
  
  const normalizedSubject = normalizeSubjectName(subject);
  
  // Foreign Languages require topic-level (language) matching
  if (service === 'tutoring' && normalizedSubject === 'foreign languages') {
    if (!topic) return false; // Need a specific language selected
    
    // Normalize topic (language name) for matching
    const normalizedTopic = topic.trim().toLowerCase();
    
    // STRICT: Check if any TUTOR teaches Foreign Languages AND has the specific language
    return MOCK_PROVIDERS.some((provider) => {
      // Must be a Tutor
      if (provider.role !== 'Tutor') return false;
      
      const providerSubjectNormalized = normalizeSubjectName(provider.subject);
      if (providerSubjectNormalized !== 'foreign languages') return false;
      
      // Check if provider teaches this specific language
      if (!provider.languages || provider.languages.length === 0) return false;
      
      return provider.languages.some((lang) => {
        return normalizeSubjectName(lang) === normalizedTopic;
      });
    });
  }
  
  // Computer Science requires topic-level matching
  if (service === 'tutoring' && normalizedSubject === 'computer science') {
    if (!topic) return false; // Need a specific CS topic selected
    
    // Normalize topic (CS topic name) for matching
    const normalizedTopic = topic.trim().toLowerCase();
    
    // STRICT: Check if any TUTOR teaches Computer Science AND has the specific topic
    return MOCK_PROVIDERS.some((provider) => {
      // Must be a Tutor
      if (provider.role !== 'Tutor') return false;
      
      const providerSubjectNormalized = normalizeSubjectName(provider.subject);
      if (providerSubjectNormalized !== 'computer science') return false;
      
      // Check if provider teaches this specific CS topic
      if (!provider.topics || provider.topics.length === 0) return false;
      
      return provider.topics.some((csTopic) => {
        return normalizeSubjectName(csTopic) === normalizedTopic;
      });
    });
  }
  
  // For all other subjects (non-language, non-CS), check subject-level matching only
  // Topic is ignored - selecting a subject means tutor can teach all topics
  // STRICT: Only Tutors with exact subject match
  return MOCK_PROVIDERS.some((provider) => {
    // Must be a Tutor
    if (provider.role !== 'Tutor') return false;
    
    // Exact subject match (case-insensitive)
    const providerSubjectNormalized = normalizeSubjectName(provider.subject);
    return providerSubjectNormalized === normalizedSubject;
  });
}

export default function BookingFlowClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const appliedQueryPrefillRef = useRef<string>('');
  // Prevent initial localStorage persistence from clobbering query-driven "Book Again" prefills.
  const didInitRef = useRef<boolean>(false);
  const [bookingState, setBookingState] = useState<BookingState>({
    service: null,
    plan: null,
    subject: null,
    topic: null,
    school: null,
    schoolId: null,
    schoolName: null,
    timeSlot: null,
    selectedSessions: [],
    provider: null,
  });

  // Virtual Tours: provider count check after school selection (prevents proceeding to Step 4 with 0 providers)
  const [virtualTourProviderCheck, setVirtualTourProviderCheck] = useState<{
    status: 'idle' | 'loading' | 'loaded' | 'error';
    count: number | null;
    suggestedSchools: School[];
    notifyRequested: boolean;
  }>({ status: 'idle', count: null, suggestedSchools: [], notifyRequested: false });

  const totalSteps = 5;

  // Contextual rebooking: if `service`/`serviceType` query param exists, prefill state and skip Step 1 UI.
  // IMPORTANT: this must run BEFORE any localStorage hydration/reset to avoid clobbering "Book Again" state.
  useEffect(() => {
    const serviceRaw = searchParams.get('service') || searchParams.get('serviceType');
    const normalizedService = normalizeServiceQueryParam(serviceRaw);
    if (!normalizedService) return;

    // Avoid re-applying and clobbering user input on subsequent renders.
    const fingerprint = [
      `service=${serviceRaw || ''}`,
      `subject=${searchParams.get('subject') || ''}`,
      `topic=${searchParams.get('topic') || ''}`,
      `schoolId=${searchParams.get('schoolId') || ''}`,
      `schoolName=${searchParams.get('schoolName') || ''}`,
      `providerId=${searchParams.get('providerId') || ''}`,
    ].join('&');
    if (appliedQueryPrefillRef.current === fingerprint) return;
    appliedQueryPrefillRef.current = fingerprint;

    const explicitStepParam = searchParams.get('step');
    const subjectParam = searchParams.get('subject');
    const topicParam = searchParams.get('topic');
    const schoolIdParam = searchParams.get('schoolId');
    const schoolNameParam = searchParams.get('schoolName');

    const normalizedSubject =
      normalizedService === 'tutoring'
        ? normalizeSubjectParam(subjectParam, TUTORING_SUBJECTS)
        : normalizedService === 'test-prep'
          ? normalizeSubjectParam(subjectParam, TEST_PREP_SUBJECTS)
          : null;

    const schoolId = typeof schoolIdParam === 'string' && schoolIdParam.trim() ? schoolIdParam.trim() : null;
    const schoolName = typeof schoolNameParam === 'string' && schoolNameParam.trim() ? schoolNameParam.trim() : null;
    const resolvedSchool =
      schoolId || schoolName
        ? (SCHOOLS.find((s) => (schoolId ? s.id === schoolId : false)) ||
            SCHOOLS.find((s) => (schoolName ? s.name.toLowerCase() === schoolName.toLowerCase() : false)) ||
            (schoolId && schoolName ? ({ id: schoolId, name: schoolName } as School) : null))
        : null;

    setBookingState((prev) => ({
      ...prev,
      service: normalizedService,
      // Do not force a plan selection; user still chooses plan normally.
      // Clear dependent fields unless they are provided by query params.
      subject:
        normalizedService === 'tutoring' || normalizedService === 'test-prep' ? (normalizedSubject ?? null) : null,
      topic:
        normalizedService === 'tutoring' || normalizedService === 'test-prep'
          ? (topicParam && topicParam.trim() ? topicParam.trim() : null)
          : null,
      school:
        normalizedService === 'counseling' || normalizedService === 'virtual-tour' ? (resolvedSchool ?? null) : null,
      schoolId:
        normalizedService === 'counseling' || normalizedService === 'virtual-tour'
          ? (resolvedSchool?.id ?? schoolId ?? null)
          : null,
      schoolName:
        normalizedService === 'counseling' || normalizedService === 'virtual-tour'
          ? (resolvedSchool?.name ?? schoolName ?? null)
          : null,
      // Always reset downstream selection for a clean rebooking flow.
      selectedSessions: [],
      provider: null,
      timeSlot: null,
    }));

    // Skip service selection UI unless an explicit step is requested (e.g., summary edit links).
    if (!explicitStepParam && currentStep === 1) {
      setCurrentStep(2);
    }
    didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load booking state from localStorage on mount (but do NOT override query-prefilled rebooking state).
  useEffect(() => {
    const serviceRaw = searchParams.get('service') || searchParams.get('serviceType');
    const hasPrefill = !!normalizeServiceQueryParam(serviceRaw);

    if (hasPrefill) {
      // Query params are the source of truth for "Book Again" entry.
      // We still consider initialization done so persistence can proceed on the next render.
      didInitRef.current = true;
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ivyway_booking_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert date strings back to Date objects
          if (parsed.selectedSessions) {
            parsed.selectedSessions = parsed.selectedSessions.map((session: any) => ({
              ...session,
              date: new Date(session.date),
            }));
          }

          // Normalize school fields so checkout never "forgets" the selected school
          const parsedSchool = parsed?.school as any;
          const parsedSchoolId =
            (typeof parsed?.schoolId === 'string' ? parsed.schoolId : '') ||
            (typeof parsedSchool?.id === 'string' ? parsedSchool.id : '');
          const parsedSchoolName =
            (typeof parsed?.schoolName === 'string' ? parsed.schoolName : '') ||
            (typeof parsedSchool?.name === 'string' ? parsedSchool.name : '');

          // If we have id/name but `school` object is missing, reconstruct it (canonical shape).
          if (!parsedSchool && (parsedSchoolId || parsedSchoolName)) {
            let resolved: School | undefined;
            if (parsedSchoolId) resolved = SCHOOLS.find((s) => s.id === parsedSchoolId);
            if (!resolved && parsedSchoolName) {
              resolved = SCHOOLS.find((s) => s.name.toLowerCase() === parsedSchoolName.toLowerCase());
            }
            parsed.school =
              resolved || (parsedSchoolId && parsedSchoolName ? { id: parsedSchoolId, name: parsedSchoolName } : null);
          }

          // Always keep top-level `schoolId`/`schoolName` in sync for downstream payloads.
          const finalSchool = parsed?.school as any;
          parsed.schoolId = (typeof finalSchool?.id === 'string' ? finalSchool.id : '') || (parsedSchoolId || null);
          parsed.schoolName =
            (typeof finalSchool?.name === 'string' ? finalSchool.name : '') || (parsedSchoolName || null);

          setBookingState(parsed);
        }
      } catch (error) {
        console.error('Error loading booking state:', error);
      }
    }

    didInitRef.current = true;
    // We only want to decide "prefill vs storage" once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle step from URL params
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const step = parseInt(stepParam, 10);
      if (step >= 1 && step <= totalSteps) {
        setCurrentStep(step);
      }
    }
  }, [searchParams, totalSteps]);

  // Persist booking state to localStorage whenever it changes
  useEffect(() => {
    if (!didInitRef.current) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ivyway_booking_state', JSON.stringify(bookingState));
      } catch (error) {
        console.error('Error saving booking state:', error);
      }
    }
  }, [bookingState]);

  const canProceed = () => {
    const resolvedSchool: SelectedSchool =
      bookingState.school ||
      (bookingState.schoolId && bookingState.schoolName ? { id: bookingState.schoolId, name: bookingState.schoolName } : null);

    switch (currentStep) {
      case 1:
        return bookingState.service !== null;
      case 2:
        return bookingState.plan !== null;
      case 3:
        // Step 3 collects inputs only. Availability is resolved in Step 4 (time slots),
        // and provider selection happens in Step 5.
        if (bookingState.service === 'tutoring') {
          return bookingState.subject !== null && bookingState.topic !== null;
        }
        if (bookingState.service === 'test-prep') {
          return bookingState.subject !== null && bookingState.topic !== null;
        }
        if (bookingState.service === 'counseling') {
          return !!(bookingState.school?.name || bookingState.schoolName);
        }
        if (bookingState.service === 'virtual-tour') {
          const schoolName = String(bookingState.school?.name || bookingState.schoolName || '').trim();
          if (!schoolName) return false;
          // BLOCK: Virtual tours must have at least 1 provider at this school.
          return virtualTourProviderCheck.status === 'loaded' && (virtualTourProviderCheck.count ?? 0) > 0;
        }
        return false;
      case 4:
        const requiredSessions = getRequiredSessionsCount(bookingState.plan);
        return bookingState.selectedSessions.length === requiredSessions;
      case 5:
        return bookingState.provider !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      if (currentStep === totalSteps) {
        // Step 5 complete - navigate to summary
        // Save state one more time before navigation
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('ivyway_booking_state', JSON.stringify(bookingState));
          } catch (error) {
            console.error('Error saving booking state:', error);
          }
        }
        router.push('/dashboard/book/summary');
      } else if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateBookingState = (updates: Partial<BookingState>) => {
    setBookingState((prev) => ({ ...prev, ...updates }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1ChooseService bookingState={bookingState} updateBookingState={updateBookingState} />;
      case 2:
        return <Step2ChoosePlan bookingState={bookingState} updateBookingState={updateBookingState} />;
      case 3:
        return (
          <Step3ChooseSubjectOrSchool
            bookingState={bookingState}
            updateBookingState={updateBookingState}
            virtualTourProviderCheck={virtualTourProviderCheck}
            setVirtualTourProviderCheck={setVirtualTourProviderCheck}
          />
        );
      case 4:
        return <Step4ChooseTimeSlot bookingState={bookingState} updateBookingState={updateBookingState} />;
      case 5:
        return <Step5SelectProvider bookingState={bookingState} updateBookingState={updateBookingState} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Book a Session</h1>
        <p className="mt-2 text-sm text-gray-600">
          Follow the steps below to book your session
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="relative">
          {/* Progress Line Background */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
          
          {/* Progress Line Fill */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-[#0088CB] transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
          
          {/* Steps */}
          <div className="relative grid grid-cols-5 gap-0">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    step === currentStep
                      ? 'bg-[#0088CB] text-white'
                      : step < currentStep
                      ? 'bg-[#0088CB] text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step < currentStep ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <div className="mt-2 text-xs text-center text-gray-600">
                  {step === 1 && 'Service'}
                  {step === 2 && 'Plan'}
                  {step === 3 && 'Subject/School'}
                  {step === 4 && 'Time'}
                  {step === 5 && 'Provider'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`px-6 py-2.5 font-medium rounded-md transition-colors ${
            currentStep === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Back
        </button>
        <div className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </div>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={`px-6 py-2.5 font-medium rounded-md transition-colors ${
            canProceed()
              ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {currentStep === totalSteps ? 'Review Booking' : 'Next'}
        </button>
      </div>
    </div>
  );
}

// Step 1: Choose Service
function Step1ChooseService({
  bookingState,
  updateBookingState,
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Choose a Service</h2>
        <p className="mt-1 text-sm text-gray-600">Select the type of session you'd like to book</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            onClick={() =>
              updateBookingState({
                service: service.id,
                plan: null,
                subject: null,
                topic: null,
                school: null,
                schoolId: null,
                schoolName: null,
                selectedSessions: [],
              })
            }
            className={`p-6 rounded-lg border-2 transition-all text-left ${
              bookingState.service === service.id
                ? 'border-[#0088CB] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                  bookingState.service === service.id
                    ? 'bg-[#0088CB] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {service.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              </div>
              {bookingState.service === service.id && (
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 2: Choose Plan
function Step2ChoosePlan({
  bookingState,
  updateBookingState,
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
}) {
  // Define plans for each service
  const getPlansForService = (service: Service) => {
    switch (service) {
      case 'tutoring':
        return [
          {
            id: 'tutoring-single',
            title: 'Single Tutoring Session',
            details: '1 hour session',
            price: formatUsdFromCents(PRICING_CATALOG.tutoring_single.purchase_price_cents),
          },
          {
            id: 'tutoring-monthly',
            title: 'Monthly Tutoring Plan',
            details: '4 sessions per month',
            price: formatUsdFromCents(PRICING_CATALOG.tutoring_monthly.purchase_price_cents),
          },
        ];
      case 'test-prep':
        return [
          {
            id: 'test-prep-single',
            title: 'Single Test Prep Session',
            details: '1 hour session',
            price: formatUsdFromCents(PRICING_CATALOG.test_prep_single.purchase_price_cents),
          },
          {
            id: 'test-prep-monthly',
            title: 'Monthly Test Prep Bundle',
            details: '4 sessions per month',
            price: formatUsdFromCents(PRICING_CATALOG.test_prep_monthly.purchase_price_cents),
          },
        ];
      case 'counseling':
        return [
          {
            id: 'counseling-single',
            title: 'College Counseling',
            details: '60 minutes',
            price: formatUsdFromCents(PRICING_CATALOG.counseling_single.purchase_price_cents),
          },
          {
            id: 'counseling-monthly',
            title: 'Monthly Counseling Plan',
            details: '4 sessions per month',
            price: formatUsdFromCents(PRICING_CATALOG.counseling_monthly.purchase_price_cents),
          },
        ];
      case 'virtual-tour':
        return [
          {
            id: 'virtual-tour-single',
            title: 'Virtual College Tour',
            details: 'Live guided tour with a current student',
            price: formatUsdFromCents(PRICING_CATALOG.virtual_tour_single.purchase_price_cents),
          },
        ];
      default:
        return [];
    }
  };

  const plans = getPlansForService(bookingState.service);

  if (!bookingState.service) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Choose a Plan</h2>
          <p className="mt-1 text-sm text-gray-600">Please select a service first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Choose a Plan</h2>
        <p className="mt-1 text-sm text-gray-600">Select your preferred booking option</p>
      </div>
      <div className={`grid grid-cols-1 ${plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => updateBookingState({ plan: plan.id, selectedSessions: [], timeSlot: null })}
            className={`p-6 rounded-lg border-2 transition-all text-left ${
              bookingState.plan === plan.id
                ? 'border-[#0088CB] bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{plan.details}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  {bookingState.plan === plan.id && (
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 3: Choose Subject or School
function Step3ChooseSubjectOrSchool({
  bookingState,
  updateBookingState,
  virtualTourProviderCheck,
  setVirtualTourProviderCheck,
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
  virtualTourProviderCheck: {
    status: 'idle' | 'loading' | 'loaded' | 'error';
    count: number | null;
    suggestedSchools: School[];
    notifyRequested: boolean;
  };
  setVirtualTourProviderCheck: Dispatch<
    SetStateAction<{
      status: 'idle' | 'loading' | 'loaded' | 'error';
      count: number | null;
      suggestedSchools: School[];
      notifyRequested: boolean;
    }>
  >;
}) {
  // Initialize search query with selected school name if it exists
  const [searchQuery, setSearchQuery] = useState(bookingState.schoolName || bookingState.school?.name || '');
  const isConfirmed = !!bookingState.school;
  const [recentSchoolIds, setRecentSchoolIds] = useState<string[]>(() => {
    // Load recent school IDs from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ivyway_recent_school_ids');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const needsSubject = bookingState.service === 'tutoring' || bookingState.service === 'test-prep';
  const needsSchool = bookingState.service === 'counseling' || bookingState.service === 'virtual-tour';
  const isTutoring = bookingState.service === 'tutoring';
  const isTestPrep = bookingState.service === 'test-prep';
  const isVirtualTour = bookingState.service === 'virtual-tour';
  const availableTopics = bookingState.subject && isTutoring ? TUTORING_TOPICS[bookingState.subject] || [] : [];

  // Provider availability flags (standardized across ALL services).
  // IMPORTANT: Keep this in sync with the same provider list used for any provider UI/cards in this step.
  const providersAtSelectedTime: Provider[] = (() => {
    if (!bookingState.service) return [];

    const service = bookingState.service;
    const school = bookingState.school || (bookingState.schoolId && bookingState.schoolName ? { id: bookingState.schoolId, name: bookingState.schoolName } : null);
    const subject = bookingState.subject;

    if (service === 'virtual-tour') {
      if (!school) return [];
      // STRICT: Virtual tours require exact schoolId match, no fallback.
      return MOCK_PROVIDERS.filter((provider) => {
        if (provider.role !== 'Counselor') return false;
        if (normalizeSubjectName(provider.subject) !== 'virtual tour') return false;
        if (!provider.schoolTags || provider.schoolTags.length === 0) return false;
        return provider.schoolTags.some((tag) => {
          const tagSchool = SCHOOLS.find((s) => s.id === tag || s.name === tag);
          return tagSchool?.id === school.id;
        });
      });
    }

    if (service === 'counseling') {
      if (!school) return [];
      // Counseling: school-tagged counselors OR general counselors (fallback).
      return MOCK_PROVIDERS.filter((provider) => {
        if (provider.role !== 'Counselor') return false;
        if (normalizeSubjectName(provider.subject) !== 'college counseling') return false;
        if (!provider.schoolTags || provider.schoolTags.length === 0) return true;
        return provider.schoolTags.some((tag) => {
          const tagSchool = SCHOOLS.find((s) => s.id === tag || s.name === tag);
          return tagSchool?.id === school.id;
        });
      });
    }

    if (service === 'tutoring' || service === 'test-prep') {
      if (!subject) return [];
      const normalized = normalizeSubjectName(subject);
      return MOCK_PROVIDERS.filter((provider) => {
        if (provider.role !== 'Tutor') return false;
        return normalizeSubjectName(provider.subject) === normalized;
      });
    }

    return [];
  })();

  const noProvidersAvailable =
    isVirtualTour && virtualTourProviderCheck.status === 'loaded' && (virtualTourProviderCheck.count ?? 0) === 0;

  // Keep input value in sync with the stored school name.
  useEffect(() => {
    setSearchQuery(bookingState.schoolName || bookingState.school?.name || '');
  }, [bookingState.school, bookingState.schoolName]);

  // Virtual tours: block progression when the selected school has 0 providers.
  useEffect(() => {
    if (!isVirtualTour) return;
    const schoolId = String(bookingState.school?.id || bookingState.schoolId || '').trim();
    const schoolName = String(bookingState.school?.name || bookingState.schoolName || '').trim();

    if (!schoolId && !schoolName) {
      setVirtualTourProviderCheck({ status: 'idle', count: null, suggestedSchools: [], notifyRequested: false });
      return;
    }

    let cancelled = false;
    setVirtualTourProviderCheck((prev) => ({
      ...prev,
      status: 'loading',
      count: null,
      suggestedSchools: [],
    }));

    const params = new URLSearchParams({ serviceType: 'virtual_tour' });
    if (schoolId) params.set('schoolId', schoolId);
    if (schoolName) params.set('schoolName', schoolName);

    fetch(`/api/providers?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to check providers'))))
      .then((json) => {
        if (cancelled) return;
        const count = Array.isArray(json) ? json.length : 0;
        setVirtualTourProviderCheck((prev) => ({
          ...prev,
          status: 'loaded',
          count,
          suggestedSchools: count === 0 ? searchSchools(schoolName).slice(0, 5) : [],
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setVirtualTourProviderCheck((prev) => ({ ...prev, status: 'error', count: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [isVirtualTour, bookingState.school, bookingState.schoolId, bookingState.schoolName, setVirtualTourProviderCheck]);

  const handleSubjectChange = (subject: string | null) => {
    // When subject changes, clear the topic
    updateBookingState({ subject, topic: null });
  };

  // Save school to recent selections (store school ID)
  const saveRecentSchool = (school: School) => {
    if (!school) return;
    setRecentSchoolIds((prev) => {
      const updated = [school.id, ...prev.filter((id) => id !== school.id)].slice(0, 5); // Keep last 5
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ivyway_recent_school_ids', JSON.stringify(updated));
        } catch {
          // Ignore localStorage errors
        }
      }
      return updated;
    });
  };

  // Confirm school selection from the canonical list (optional; free text is allowed too).
  const confirmSchool = (school: School) => {
    if (school) {
      updateBookingState({ school, schoolId: school.id, schoolName: school.name });
      saveRecentSchool(school);
      setSearchQuery(school.name);
      setShowSuggestions(false);
    }
  };

  // Get filtered schools from canonical list
  const filteredSchools = searchQuery.trim()
    ? searchSchools(searchQuery)
    : [];

  // Get recent schools from IDs
  const recentSchools = recentSchoolIds
    .map(id => SCHOOLS.find(s => s.id === id))
    .filter((s): s is School => s !== undefined);

  // Get suggestions: recent schools + filtered schools (excluding already selected)
  const getSuggestions = (): School[] => {
    const allSuggestions: School[] = [];
    
    // Add recent schools first
    recentSchools.forEach(school => {
      if (!allSuggestions.find(s => s.id === school.id)) {
        allSuggestions.push(school);
      }
    });
    
    // Add filtered schools
    filteredSchools.forEach(school => {
      if (!allSuggestions.find(s => s.id === school.id)) {
        allSuggestions.push(school);
      }
    });
    
    return allSuggestions.slice(0, 10); // Limit to 10 suggestions
  };

  // Handle input change (free text allowed)
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    const trimmed = value.trim();

    // Free text is the source of truth unless the user explicitly chooses from the list.
    updateBookingState({
      school: null,
      schoolId: null,
      schoolName: trimmed ? trimmed : null,
    });

    if (!trimmed && isVirtualTour) {
      setVirtualTourProviderCheck({ status: 'idle', count: null, suggestedSchools: [], notifyRequested: false });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          {needsSubject ? 'Choose a Subject' : 'Choose a School'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {needsSubject
            ? isTutoring
              ? 'Select the subject you need help with'
              : 'Select the subject you need help with'
            : 'Search for your target school'}
        </p>
      </div>
      {needsSubject ? (
        <div className="space-y-6">
          {/* Subject Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <select
              value={bookingState.subject || ''}
              onChange={(e) => handleSubjectChange(e.target.value || null)}
              className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none border-gray-300"
            >
              <option value="">Select a subject...</option>
              {(bookingState.service === 'tutoring' ? TUTORING_SUBJECTS : TEST_PREP_SUBJECTS).map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Input (free text) - Tutoring + Test Prep, and only after subject is selected */}
          {(isTutoring || isTestPrep) && bookingState.subject && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">What topic do you need help with?</label>
              <input
                type="text"
                value={bookingState.topic || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateBookingState({ topic: v.trim() ? v.trim() : null });
                }}
                placeholder={
                  isTestPrep
                    ? 'e.g. SAT Reading, ACT Science, AP Biology FRQs'
                    : 'e.g. Quadratic equations, Photosynthesis, Essay writing'
                }
                list={isTutoring ? 'ivyway-topic-suggestions' : undefined}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none"
              />
              {isTutoring && availableTopics.length > 0 && (
                <datalist id="ivyway-topic-suggestions">
                  {availableTopics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}
              <p className="text-sm text-gray-500">Required — type anything.</p>
            </div>
          )}

          {/* Summary for Tutoring/Test Prep */}
          {(isTutoring || isTestPrep) && bookingState.subject && bookingState.topic && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[#0088CB] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Selected:</p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{bookingState.subject}</span>
                    {' — '}
                    <span className="font-semibold">{bookingState.topic}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Search for your school</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type any college or university name (e.g., Harvard, Oxford)..."
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => {
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicks
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none transition-colors ${
                  isConfirmed ? 'border-[#0088CB] bg-blue-50 text-gray-900' : 'border-gray-300 bg-white'
                }`}
              />
              {!isConfirmed && filteredSchools.length === 1 && (
                <button
                  onClick={() => confirmSchool(filteredSchools[0])}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#0088CB] text-white rounded-md text-sm font-medium hover:bg-[#0077B3] transition-colors"
                >
                  Select
                </button>
              )}
              {isConfirmed && (
                <button
                  onClick={() => {
                    updateBookingState({ school: null, schoolId: null, schoolName: null });
                    if (isVirtualTour) {
                      setVirtualTourProviderCheck({ status: 'idle', count: null, suggestedSchools: [], notifyRequested: false });
                    }
                    setSearchQuery('');
                    setShowSuggestions(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 text-[#0088CB] hover:text-[#0077B3] text-sm font-medium transition-colors"
                  aria-label="Change school"
                >
                  Change
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {isConfirmed
                ? 'School confirmed. Click "Change" to select a different school.'
                : 'Type any school name. Selecting from the dropdown (if available) improves matching.'}
            </p>
          </div>

          {/* Suggestions Dropdown - Show schools from canonical list (only when not confirmed) */}
          {showSuggestions && getSuggestions().length > 0 && (
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
              {getSuggestions().map((school) => {
                const isRecent = recentSchoolIds.includes(school.id);
                return (
                  <button
                    key={school.id}
                    onClick={() => confirmSchool(school)}
                    className="w-full p-3 rounded-md text-left transition-all hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{school.name}</span>
                        {isRecent && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Recent</span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* No results message */}
          {!isConfirmed && showSuggestions && searchQuery.trim() && filteredSchools.length === 0 && (
            <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-900">
                No matches in our school list for &quot;{searchQuery}&quot; — you can still continue with this school.
              </p>
            </div>
          )}

          {/* Selected School Summary */}
          {!!(bookingState.school?.name || bookingState.schoolName) && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              isVirtualTour && noProvidersAvailable
                ? 'bg-amber-50 border-amber-300'
                : 'bg-blue-50 border-[#0088CB]'
            }`}>
              <div className="flex items-start gap-2">
                {isVirtualTour && noProvidersAvailable ? (
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-[#0088CB] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Selected School:</p>
                  <p className="text-sm text-gray-700 font-semibold mt-1">
                    {bookingState.school?.name || bookingState.schoolName}
                  </p>
                  {isVirtualTour ? (
                    virtualTourProviderCheck.status === 'loading' ? (
                      <p className="text-xs text-gray-500 mt-1">Checking virtual tour availability…</p>
                    ) : virtualTourProviderCheck.status === 'error' ? (
                      <p className="text-xs text-amber-700 mt-1">Unable to verify virtual tour availability. Please try again.</p>
                    ) : noProvidersAvailable ? (
                      <p className="text-xs text-amber-700 mt-1">We currently don’t offer virtual tours for this school yet.</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">You can proceed to the next step</p>
                    )
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">You can proceed to the next step</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    updateBookingState({ school: null, schoolId: null, schoolName: null });
                    if (isVirtualTour) {
                      setVirtualTourProviderCheck({ status: 'idle', count: null, suggestedSchools: [], notifyRequested: false });
                    }
                    setSearchQuery('');
                    setShowSuggestions(true);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Change school"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Step 4: Choose Time Slot
function Step4ChooseTimeSlot({
  bookingState,
  updateBookingState,
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ startTimeUTC: string; endTimeUTC: string; displayTime: string }>
  >([]);
  const [noSchoolMatch, setNoSchoolMatch] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const requiredSessions = getRequiredSessionsCount(bookingState.plan);
  const selectedCount = bookingState.selectedSessions.length;
  const nextSessionNumber = Math.min(requiredSessions, selectedCount + 1);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Generate calendar days
  const days: (number | null)[] = [];
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  // Helper to format date string for display
  const formatDateString = (date: Date, time: string): string => {
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();
    const dateYear = date.getFullYear();
    return `${monthNames[dateMonth]} ${dateDay}, ${dateYear} - ${time}`;
  };

  // Check if a date has a selected session
  const dateHasSelectedSession = (day: number): boolean => {
    const date = new Date(year, month, day);
    return bookingState.selectedSessions.some(session => {
      return (
        session.date.getDate() === date.getDate() &&
        session.date.getMonth() === date.getMonth() &&
        session.date.getFullYear() === date.getFullYear()
      );
    });
  };

  const isSlotSelected = (startTimeUTC: string, endTimeUTC: string): boolean => {
    return bookingState.selectedSessions.some(
      (s) => s.startTimeUTC === startTimeUTC && s.endTimeUTC === endTimeUTC
    );
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
  };

  const handleTimeSlotClick = (slot: { startTimeUTC: string; endTimeUTC: string; displayTime: string }) => {
    const slotDate = new Date(slot.startTimeUTC);
    if (isNaN(slotDate.getTime())) return;

    const existingIndex = bookingState.selectedSessions.findIndex(
      (s) =>
        s.startTimeUTC === slot.startTimeUTC && s.endTimeUTC === slot.endTimeUTC
    );

    if (existingIndex !== -1) {
      // Remove if already selected
      const updatedSessions = bookingState.selectedSessions
        .filter((_, index) => index !== existingIndex)
        .map((s) => ({ ...s, providerId: null }));
      // Any time changes require re-confirming provider.
      updateBookingState({ selectedSessions: updatedSessions, provider: null });
    } else {
      // Add if not at limit and not already selected
      if (selectedCount < requiredSessions) {
        const newSession: SelectedSession = {
          providerId: null,
          startTimeUTC: slot.startTimeUTC,
          endTimeUTC: slot.endTimeUTC,
          date: slotDate,
          displayTime: slot.displayTime,
          displayString: formatDateString(slotDate, slot.displayTime),
        };
        const updatedSessions = [...bookingState.selectedSessions, newSession].map((s) => ({ ...s, providerId: null }));
        // Any time changes require re-confirming provider.
        updateBookingState({ selectedSessions: updatedSessions, provider: null });
      }
    }
  };

  const handleRemoveSession = (index: number) => {
    const updatedSessions = bookingState.selectedSessions
      .filter((_, i) => i !== index)
      .map((s) => ({ ...s, providerId: null }));
    updateBookingState({ selectedSessions: updatedSessions, provider: null });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const isToday = (day: number | null) => {
    if (day === null) return false;
    const date = new Date(year, month, day);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number | null) => {
    if (day === null || !selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const isPastDate = (day: number | null) => {
    if (day === null) return false;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart;
  };

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setNoSchoolMatch(false);
      return;
    }

    console.log("Selected date:", selectedDate);

    // Build API request
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    
    // Determine serviceType for API
    let serviceType: string | null = null;
    if (bookingState.service === 'tutoring') {
      serviceType = 'tutoring';
    } else if (bookingState.service === 'test-prep') {
      serviceType = 'test_prep';
    } else if (bookingState.service === 'counseling') {
      serviceType = 'college_counseling';
    } else if (bookingState.service === 'virtual-tour') {
      serviceType = 'virtual_tour';
    }

    // Build query params
    const schoolId = String(bookingState.school?.id || bookingState.schoolId || '').trim();
    const schoolName = String(bookingState.school?.name || bookingState.schoolName || '').trim();
    const params = new URLSearchParams({ date: dateStr });
    if (serviceType) params.set('serviceType', serviceType);
    if (bookingState.subject) params.set('subject', bookingState.subject);
    if (schoolId) params.set('schoolId', schoolId);
    if (schoolName) params.set('schoolName', schoolName);

    // Counseling is 60 minutes only; pass duration so API returns correct endTimeUTC.
    if (bookingState.service === 'counseling') {
      params.set('durationMinutes', '60');
    }

    // Fetch slots from API
    setLoadingSlots(true);
    setSlotsError(null);
    fetch(`/api/availability/all-slots?${params.toString()}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Unable to load available time slots. Please try again.');
        }
        return res.json();
      })
      .then(data => {
        const slots = Array.isArray(data?.slots) ? data.slots : [];
        console.log("Slots returned:", slots);
        setNoSchoolMatch(Boolean(data?.noSchoolMatch));

        // Convert API slots to display format (time-first).
        const rawSlots: Array<{ startTimeUTC: string; endTimeUTC: string; displayTime: string }> = (data.slots || [])
          .map((slot: any) => {
          const startDate = new Date(slot.startTimeUTC);
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          return {
            startTimeUTC: slot.startTimeUTC,
            endTimeUTC: slot.endTimeUTC,
            displayTime: formatter.format(startDate),
          };
          })
          .filter((s: any) => typeof s.startTimeUTC === 'string' && typeof s.endTimeUTC === 'string');

        setAvailableSlots(rawSlots);
      })
      .catch(err => {
        console.error('Error fetching slots:', err);
        setSlotsError('Unable to load available time slots. Please try again.');
        setAvailableSlots([]);
        setNoSchoolMatch(false);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [
    selectedDate,
    bookingState.service,
    bookingState.subject,
    bookingState.school,
    bookingState.schoolId,
    bookingState.schoolName,
    year,
    month,
  ]);

  // Get helper text based on plan
  const getHelperText = (): string => {
    if (requiredSessions === 1) {
      return 'Select 1 session time';
    } else if (requiredSessions === 4) {
      return 'Select 4 session times for your monthly plan';
    }
    return `Select ${requiredSessions} session times`;
  };

  const isComplete = selectedCount === requiredSessions;
  const shouldShowCounter = requiredSessions > 1 || (requiredSessions === 1 && selectedCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          {requiredSessions > 1 && selectedCount < requiredSessions
            ? `Select Session ${nextSessionNumber} of ${requiredSessions}`
            : 'Choose a Time'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{getHelperText()}</p>
        {/* Session Selection Progress Counter */}
        {shouldShowCounter && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                isComplete
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-[#0088CB] border border-[#0088CB]'
              }`}
            >
              {selectedCount}/{requiredSessions}
            </span>
            {isComplete && (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[month]} {year}
          </h3>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const past = isPastDate(day);
              const todayClass = isToday(day);
              const selected = isSelected(day);
              const hasSession = dateHasSelectedSession(day);

              return (
                <button
                  key={day}
                  onClick={() => !past && handleDateClick(day)}
                  disabled={past}
                  className={`aspect-square rounded-md font-medium transition-all ${
                    past
                      ? 'text-gray-300 cursor-not-allowed'
                      : selected
                      ? 'bg-[#0088CB] text-white hover:bg-[#0077B3]'
                      : hasSession
                      ? 'bg-blue-100 text-[#0088CB] hover:bg-blue-200 border border-[#0088CB]'
                      : todayClass
                      ? 'bg-blue-50 text-[#0088CB] hover:bg-blue-100 border border-[#0088CB]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Available times for {monthNames[month]} {selectedDate.getDate()}, {year}
          </h3>
          {noSchoolMatch ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                We currently don’t have a provider from this school. You can still book a session with one of our available counselors.
              </p>
            </div>
          ) : null}

          {loadingSlots ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
              <p className="mt-4 text-sm text-gray-500">Loading available time slots...</p>
            </div>
          ) : slotsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{slotsError}</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">No available time slots for this date. Please select another date.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {availableSlots.map((slot) => {
                const isSelectedTime = isSlotSelected(slot.startTimeUTC, slot.endTimeUTC);
                const isDisabled = selectedCount >= requiredSessions && !isSelectedTime;

                return (
                  <button
                    key={`${slot.startTimeUTC}|${slot.endTimeUTC}`}
                    onClick={() => handleTimeSlotClick(slot)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      isDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isSelectedTime
                        ? 'border-[#0088CB] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-gray-900">{slot.displayTime}</span>
                      {isSelectedTime && (
                        <svg className="w-5 h-5 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Sessions List */}
      {bookingState.selectedSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Selected Sessions</h3>
            {shouldShowCounter && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                  isComplete
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-blue-50 text-[#0088CB] border border-[#0088CB]'
                }`}
              >
                {selectedCount}/{requiredSessions}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {bookingState.selectedSessions.map((session, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-gray-900">{session.displayString}</span>
                </div>
                <button
                  onClick={() => handleRemoveSession(index)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remove session"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 5: Select Provider
function Step5SelectProvider({
  bookingState,
  updateBookingState,
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
}) {
  const [eligibleProviders, setEligibleProviders] = useState<
    Array<{
      providerId: string;
      name: string;
      profileImageUrl: string | null;
      schoolName?: string | null;
      subjects?: string[];
    }>
  >([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const selectedProviderId = bookingState.provider;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setProvidersError(null);
      setEligibleProviders([]);

      setLoadingProviders(true);
      try {
        const selectedSlots = bookingState.selectedSessions || [];
        if (selectedSlots.length === 0) {
          setProvidersError('Please select at least one time slot.');
          return;
        }

        // Determine serviceType for provider availability query (backend expects canonical types).
        const serviceType =
          bookingState.service === 'tutoring'
            ? 'tutoring'
            : bookingState.service === 'test-prep'
              ? 'test_prep'
              : bookingState.service === 'counseling'
                ? 'college_counseling'
                : bookingState.service === 'virtual-tour'
                  ? 'virtual_tour'
                  : null;

        if (!serviceType) {
          setProvidersError('Service type not set. Please go back and try again.');
          return;
        }

        const schoolId = bookingState.school?.id || bookingState.schoolId || '';
        const schoolName = bookingState.school?.name || bookingState.schoolName || '';
        const subject = bookingState.subject || '';

        let noSchoolMatch = false;
        let intersection: Map<string, (typeof eligibleProviders)[number]> | null = null;

        for (const s of selectedSlots) {
          const startTimeUTC = String((s as any)?.startTimeUTC || '').trim();
          if (!startTimeUTC) continue;

          const params = new URLSearchParams({ startTimeUTC, serviceType });
          if (subject) params.set('subject', subject);
          const sid = String(schoolId || '').trim();
          const sname = String(schoolName || '').trim();
          if (sid) params.set('schoolId', sid);
          if (sname) params.set('schoolName', sname);

          const res = await fetch(`/api/availability/providers-at-time?${params.toString()}`, { cache: 'no-store' });
          if (!res.ok) throw new Error('Failed to load providers');
          const json = await res.json();

          if (json?.noSchoolMatch === true) noSchoolMatch = true;

          const providers: any[] = Array.isArray(json?.providers) ? json.providers : [];
          const current = new Map<string, (typeof eligibleProviders)[number]>();
          for (const p of providers) {
            const providerId = String(p?.providerId || '').trim();
            if (!providerId) continue;
            current.set(providerId, {
              providerId,
              name: typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : 'Provider',
              profileImageUrl: typeof p?.profileImageUrl === 'string' && p.profileImageUrl.trim() ? p.profileImageUrl.trim() : null,
              schoolName: typeof p?.school === 'string' && p.school.trim() ? p.school.trim() : null,
              subjects: Array.isArray(p?.subjects) ? p.subjects : [],
            });
          }

          if (intersection === null) {
            intersection = current;
          } else {
            for (const id of Array.from(intersection.keys())) {
              if (!current.has(id)) intersection.delete(id);
            }
          }
        }

        const providersOut = intersection ? Array.from(intersection.values()) : [];
        const providerIds = providersOut.map((p) => p.providerId);

        console.log('[BOOKING_FLOW]', {
          selectedService: serviceType,
          selectedTime: selectedSlots.length === 1 ? selectedSlots[0]?.startTimeUTC : selectedSlots.map((s) => s.startTimeUTC),
          providerIds,
          noSchoolMatch,
        });

        if (!cancelled) {
          if (providersOut.length === 0) {
            setProvidersError('No providers are available for all selected times. Please go back and adjust your times.');
            return;
          }
          setEligibleProviders(providersOut);
        }
      } catch (e) {
        if (!cancelled) setProvidersError('Unable to load providers. Please try again.');
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    };

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    bookingState.selectedSessions,
    bookingState.service,
    bookingState.subject,
    bookingState.school,
    bookingState.schoolId,
    bookingState.schoolName,
    bookingState.plan,
  ]);

  // Keep provider cards consistent across ALL services (college counseling UI is the reference).
  const showProviderSchool = true;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Confirm Provider</h2>
        <p className="mt-1 text-sm text-gray-600">
          We’ll use the provider attached to your selected time{bookingState.selectedSessions.length === 1 ? '' : 's'}.
        </p>
      </div>

      {loadingProviders ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0088CB]"></div>
          <p className="mt-4 text-sm text-gray-500">Loading eligible providers...</p>
        </div>
      ) : providersError ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{providersError}</p>
        </div>
      ) : eligibleProviders.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">No eligible providers found. Please go back and adjust your selection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eligibleProviders.map((p) => {
            const selected = selectedProviderId === p.providerId;
            const subjects = Array.isArray(p.subjects) ? p.subjects.filter((s) => typeof s === 'string' && s.trim()) : [];
            return (
              <button
                key={p.providerId}
                type="button"
                onClick={() => {
                  updateBookingState({
                    provider: p.providerId,
                    selectedSessions: (bookingState.selectedSessions || []).map((s) => ({ ...s, providerId: p.providerId })),
                  });
                }}
                className={`w-full text-left p-5 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#0088CB]/40 ${
                  selected
                    ? 'border-[#0088CB] bg-[#0088CB]/10 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {p.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.profileImageUrl}
                        alt={p.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-gray-900">{p.name}</div>
                        {showProviderSchool && typeof p.schoolName === 'string' && p.schoolName.trim() ? (
                          <div className="mt-0.5 text-sm text-gray-500">{p.schoolName.trim()}</div>
                        ) : null}

                        {subjects.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {subjects.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700"
                              >
                                {formatSubjectLabel(s)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {selected ? (
                        <div className="w-6 h-6 rounded-full bg-[#0088CB] flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
