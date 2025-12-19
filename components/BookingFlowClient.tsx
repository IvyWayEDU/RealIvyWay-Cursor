'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Service = 'tutoring' | 'counseling' | 'virtual-tour' | 'test-prep' | null;
type Plan = string | null;
type Subject = string | null;
type Topic = string | null;
type School = {
  displayName: string;
  normalizedName: string;
} | null;
type TimeSlot = string | null;
type Provider = string | null;

interface SelectedSession {
  date: Date;
  time: string;
  displayString: string;
}

// Normalization utilities for school names
function normalizeSchoolName(name: string): string {
  return name.trim().toLowerCase();
}

function createSchool(displayName: string): School {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  return {
    displayName: trimmed,
    normalizedName: normalizeSchoolName(trimmed),
  };
}

// Check if two school names match (case-insensitive, partial matching)
function schoolsMatch(school1: School, school2: School): boolean {
  if (!school1 || !school2) return false;
  return school1.normalizedName === school2.normalizedName;
}

// Check if a query matches a school (partial, case-insensitive)
function queryMatchesSchool(query: string, school: School): boolean {
  if (!school) return false;
  const normalizedQuery = normalizeSchoolName(query);
  return school.normalizedName.includes(normalizedQuery) || normalizedQuery.includes(school.normalizedName);
}

// Check if there are any providers available for a given school
// For virtual tours: Only providers tagged with the school (strict matching, no fallback)
// For counseling: Providers tagged with the school OR general counselors (fallback allowed)
function hasProviderForSchool(school: School, service: Service): boolean {
  if (!school) return false;
  
  if (service === 'virtual-tour') {
    // STRICT: Virtual tours require exact school match, no fallback
    return MOCK_PROVIDERS.some((provider) => {
      // Must be a Counselor (virtual tour guides are counselors)
      if (provider.role !== 'Counselor') return false;
      // Must be tagged for virtual tours
      if (normalizeSubjectName(provider.subject) !== 'virtual tour') return false;
      // Check if provider is tagged with this school
      if (!provider.schoolTags || provider.schoolTags.length === 0) return false;
      return provider.schoolTags.some((tag) => {
        return normalizeSchoolName(tag) === school.normalizedName;
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
      return provider.schoolTags.some((tag) => {
        return normalizeSchoolName(tag) === school.normalizedName;
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
  school: School;
  timeSlot: TimeSlot;
  selectedSessions: SelectedSession[];
  provider: Provider;
}

// Helper function to determine required number of sessions based on plan
function getRequiredSessionsCount(plan: Plan): number {
  if (!plan) return 1;
  
  // Monthly plans requiring 4 sessions
  if (plan === 'tutoring-monthly' || plan === 'test-prep-monthly') {
    return 4;
  }
  
  // Monthly Counseling Plan requiring 2 sessions
  if (plan === 'counseling-monthly') {
    return 2;
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
  const [bookingState, setBookingState] = useState<BookingState>({
    service: null,
    plan: null,
    subject: null,
    topic: null,
    school: null,
    timeSlot: null,
    selectedSessions: [],
    provider: null,
  });

  const totalSteps = 5;

  // Load booking state from localStorage on mount
  useEffect(() => {
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
          setBookingState(parsed);
        }
      } catch (error) {
        console.error('Error loading booking state:', error);
      }
    }
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ivyway_booking_state', JSON.stringify(bookingState));
      } catch (error) {
        console.error('Error saving booking state:', error);
      }
    }
  }, [bookingState]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return bookingState.service !== null;
      case 2:
        return bookingState.plan !== null;
      case 3:
        // For tutoring, both subject and topic are required (topic for context/preparation)
        // Availability checking: subject-only for non-specialized subjects, subject+topic for Foreign Languages and Computer Science
        if (bookingState.service === 'tutoring') {
          const hasSubjectAndTopic = bookingState.subject !== null && bookingState.topic !== null;
          if (!hasSubjectAndTopic) return false;
          
          // Check if this is Foreign Languages or Computer Science (requires topic-level matching)
          const isForeignLanguages = bookingState.subject && normalizeSubjectName(bookingState.subject) === 'foreign languages';
          const isComputerScience = bookingState.subject && normalizeSubjectName(bookingState.subject) === 'computer science';
          
          // For Foreign Languages and Computer Science, availability requires both subject AND topic
          // For all other subjects, availability is subject-only (topic is for context only)
          const hasAvailability = (isForeignLanguages || isComputerScience)
            ? hasTutorAvailableForSubject(bookingState.service, bookingState.subject, bookingState.topic)
            : hasTutorAvailableForSubject(bookingState.service, bookingState.subject);
          
          return hasAvailability;
        }
        // For test prep, subject is required AND tutor must be available
        if (bookingState.service === 'test-prep') {
          const hasSubject = bookingState.subject !== null;
          const hasAvailability = bookingState.subject !== null && hasTutorAvailableForSubject(bookingState.service, bookingState.subject);
          return hasSubject && hasAvailability;
        }
        // For counseling, school is required AND must have at least one provider available (fallback to general counselors allowed)
        if (bookingState.service === 'counseling') {
          return bookingState.school !== null && hasProviderForSchool(bookingState.school, bookingState.service);
        }
        // For virtual tours, school is required AND must have at least one provider available (strict, no fallback)
        if (bookingState.service === 'virtual-tour') {
          return bookingState.school !== null && hasProviderForSchool(bookingState.school, bookingState.service);
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
        return <Step3ChooseSubjectOrSchool bookingState={bookingState} updateBookingState={updateBookingState} />;
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
            onClick={() => updateBookingState({ service: service.id, plan: null, subject: null, topic: null, school: null, selectedSessions: [] })}
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
            price: '$69',
          },
          {
            id: 'tutoring-monthly',
            title: 'Monthly Tutoring Plan',
            details: '4 sessions per month',
            price: '$249',
          },
        ];
      case 'test-prep':
        return [
          {
            id: 'test-prep-single',
            title: 'Single Test Prep Session',
            details: '1 hour session',
            price: '$149',
          },
          {
            id: 'test-prep-monthly',
            title: 'Monthly Test Prep Bundle',
            details: '4 sessions per month',
            price: '$499',
          },
        ];
      case 'counseling':
        return [
          {
            id: 'counseling-30min',
            title: '30 Minute Counseling Session',
            details: '30 minutes',
            price: '$49',
          },
          {
            id: 'counseling-60min',
            title: '60 Minute Counseling Session',
            details: '60 minutes',
            price: '$89',
          },
          {
            id: 'counseling-monthly',
            title: 'Monthly Counseling Plan',
            details: '2 sessions per month',
            price: '$159',
          },
        ];
      case 'virtual-tour':
        return [
          {
            id: 'virtual-tour-single',
            title: 'Virtual College Tour',
            details: 'Live guided tour with a current student',
            price: '$124',
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
}: {
  bookingState: BookingState;
  updateBookingState: (updates: Partial<BookingState>) => void;
}) {
  // Initialize search query with selected school display name if it exists
  const [searchQuery, setSearchQuery] = useState(bookingState.school?.displayName || '');
  const [isConfirmed, setIsConfirmed] = useState(!!bookingState.school);
  const [recentSchools, setRecentSchools] = useState<string[]>(() => {
    // Load recent schools from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ivyway_recent_schools');
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
  
  // Check if selected school has providers available (for virtual tours and counseling)
  const hasProviderAvailable = (isVirtualTour || bookingState.service === 'counseling') && bookingState.school 
    ? hasProviderForSchool(bookingState.school, bookingState.service!)
    : true; // Always true for services that don't require school matching
  
  // Check if tutor is available for selected subject/test (for Tutoring and Test Prep only)
  // For Foreign Languages and Computer Science, availability requires topic to be selected
  // For other subjects, availability is checked by subject only (topic is for context)
  const hasTutorAvailable = (isTutoring || isTestPrep) && bookingState.subject
    ? (() => {
        const isForeignLanguages = normalizeSubjectName(bookingState.subject!) === 'foreign languages';
        const isComputerScience = normalizeSubjectName(bookingState.subject!) === 'computer science';
        // For Foreign Languages and Computer Science, need topic for availability check
        // For other subjects, subject-only check (topic ignored for availability)
        if ((isForeignLanguages || isComputerScience) && isTutoring) {
          return bookingState.topic 
            ? hasTutorAvailableForSubject(bookingState.service, bookingState.subject, bookingState.topic)
            : false; // Foreign Languages and Computer Science require topic to check availability
        }
        return hasTutorAvailableForSubject(bookingState.service, bookingState.subject);
      })()
    : true; // Always true if no subject selected yet or not tutoring/test-prep

  // Sync confirmation state and search query when bookingState.school changes
  useEffect(() => {
    if (bookingState.school) {
      setIsConfirmed(true);
      setSearchQuery(bookingState.school.displayName);
    } else {
      setIsConfirmed(false);
    }
  }, [bookingState.school]);

  const handleSubjectChange = (subject: string | null) => {
    // When subject changes, clear the topic
    updateBookingState({ subject, topic: null });
  };

  // Save school to recent selections (store display name)
  const saveRecentSchool = (school: School) => {
    if (!school) return;
    const displayName = school.displayName;
    setRecentSchools((prev) => {
      const updated = [displayName, ...prev.filter((s) => normalizeSchoolName(s) !== school.normalizedName)].slice(0, 5); // Keep last 5
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ivyway_recent_schools', JSON.stringify(updated));
        } catch {
          // Ignore localStorage errors
        }
      }
      return updated;
    });
  };

  // Confirm school selection - locks it in
  const confirmSchool = (schoolName: string) => {
    const trimmed = schoolName.trim();
    if (trimmed) {
      const school = createSchool(trimmed);
      if (school) {
        updateBookingState({ school });
        saveRecentSchool(school);
        setIsConfirmed(true);
        setShowSuggestions(false);
      }
    }
  };

  // Handle Enter key to confirm
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && !isConfirmed) {
      e.preventDefault();
      confirmSchool(searchQuery);
    }
  };

  // Get suggestions based on recent schools and current query (case-insensitive, partial matching)
  const getSuggestions = (): string[] => {
    if (!searchQuery.trim()) {
      return recentSchools;
    }
    const normalizedQuery = normalizeSchoolName(searchQuery);
    // Show recent schools that match the query (partial, case-insensitive)
    const matchingRecent = recentSchools.filter((school) => {
      const normalizedSchool = normalizeSchoolName(school);
      return normalizedSchool.includes(normalizedQuery) || normalizedQuery.includes(normalizedSchool);
    });
    // If current query doesn't match any recent, show it as an option
    const currentQueryNormalized = normalizeSchoolName(searchQuery.trim());
    if (!matchingRecent.some((s) => normalizeSchoolName(s) === currentQueryNormalized)) {
      return [searchQuery.trim(), ...matchingRecent].slice(0, 5);
    }
    return matchingRecent.slice(0, 5);
  };

  // Handle input change - allow editing if not confirmed
  const handleInputChange = (value: string) => {
    if (isConfirmed) {
      // If confirmed, allow clearing to start over
      if (value === '') {
        updateBookingState({ school: null });
        setIsConfirmed(false);
        setSearchQuery('');
      } else {
        // Keep the confirmed value, but allow user to clear it
        return;
      }
    } else {
      setSearchQuery(value);
      setShowSuggestions(true);
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
              className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none ${
                (isTutoring || isTestPrep) && bookingState.subject && !hasTutorAvailable
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-300'
              }`}
            >
              <option value="">Select a subject...</option>
              {(bookingState.service === 'tutoring' ? TUTORING_SUBJECTS : TEST_PREP_SUBJECTS).map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
            
            {/* Error message when no tutors available */}
            {/* For Foreign Languages and Computer Science, only show error after topic is selected */}
            {(isTutoring || isTestPrep) && bookingState.subject && (() => {
              const isForeignLanguages = normalizeSubjectName(bookingState.subject!) === 'foreign languages';
              const isComputerScience = normalizeSubjectName(bookingState.subject!) === 'computer science';
              // For Foreign Languages and Computer Science, need topic selected to check availability
              // For other subjects, check availability immediately after subject selection
              const shouldShowError = (isForeignLanguages || isComputerScience)
                ? bookingState.topic !== null && !hasTutorAvailable
                : !hasTutorAvailable;
              return shouldShowError;
            })() && (
              <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-amber-900">
                    {(() => {
                      const normalizedSubject = normalizeSubjectName(bookingState.subject!);
                      if (normalizedSubject === 'foreign languages') {
                        return "Whoops, looks like we don't have any tutors available for this language right now. Try another.";
                      }
                      if (normalizedSubject === 'computer science') {
                        return "Whoops, looks like we don't have any tutors available for this Computer Science topic right now. Try another.";
                      }
                      return "Whoops, looks like we don't have any tutors available for this subject right now. Try another.";
                    })()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Topic Selection - Only for Tutoring, and only after subject is selected */}
          {isTutoring && bookingState.subject && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Select a topic</label>
              <select
                value={bookingState.topic || ''}
                onChange={(e) => updateBookingState({ topic: e.target.value || null })}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none"
              >
                <option value="">Select a topic...</option>
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              <p className="text-sm text-gray-500">
                Please select a specific topic to continue
              </p>
            </div>
          )}

          {/* Summary for Tutoring */}
          {isTutoring && bookingState.subject && bookingState.topic && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[#0088CB] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Selected:</p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{bookingState.subject}</span>
                    {' → '}
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
                placeholder={isConfirmed ? "School confirmed - clear to change" : "Type any college or university name (e.g., Harvard, Oxford)..."}
                value={isConfirmed ? bookingState.school?.displayName || '' : searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (!isConfirmed) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicks
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                readOnly={isConfirmed}
                className={`w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none transition-colors ${
                  isConfirmed
                    ? 'border-[#0088CB] bg-blue-50 text-gray-900 cursor-default'
                    : 'border-gray-300 bg-white'
                }`}
              />
              {!isConfirmed && searchQuery.trim() && (
                <button
                  onClick={() => confirmSchool(searchQuery)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#0088CB] text-white rounded-md text-sm font-medium hover:bg-[#0077B3] transition-colors"
                >
                  Confirm
                </button>
              )}
              {isConfirmed && (
                <button
                  onClick={() => {
                    updateBookingState({ school: null });
                    setSearchQuery('');
                    setIsConfirmed(false);
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
                : 'Type any college or university name (partial names work). Press Enter or click Confirm to select.'}
            </p>
            
            {/* Error message for Virtual College Tours when no providers available */}
            {isVirtualTour && isConfirmed && bookingState.school && !hasProviderAvailable && (
              <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-amber-900">
                    Whoops, looks like we don't have any counselors active at this school. Try another.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions Dropdown - Show recent selections and current query (only when not confirmed) */}
          {!isConfirmed && showSuggestions && (searchQuery.trim() || recentSchools.length > 0) && (
            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
              {getSuggestions().map((school, index) => {
                const normalizedSchool = normalizeSchoolName(school);
                const normalizedQuery = normalizeSchoolName(searchQuery.trim());
                const isCurrentQuery = normalizedSchool === normalizedQuery;
                const isRecent = recentSchools.some((s) => normalizeSchoolName(s) === normalizedSchool) && !isCurrentQuery;
                return (
                  <button
                    key={`${school}-${index}`}
                    onClick={() => confirmSchool(school)}
                    className="w-full p-3 rounded-md text-left transition-all hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{school}</span>
                        {isRecent && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Recent</span>
                        )}
                        {isCurrentQuery && searchQuery.trim() && (
                          <span className="text-xs text-[#0088CB] bg-blue-50 px-2 py-0.5 rounded">Press Enter</span>
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

          {/* Selected School Summary - Show confirmed school */}
          {isConfirmed && bookingState.school && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              isVirtualTour && !hasProviderAvailable
                ? 'bg-amber-50 border-amber-300'
                : 'bg-blue-50 border-[#0088CB]'
            }`}>
              <div className="flex items-start gap-2">
                {isVirtualTour && !hasProviderAvailable ? (
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-[#0088CB] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Confirmed School:</p>
                  <p className="text-sm text-gray-700 font-semibold mt-1">{bookingState.school.displayName}</p>
                  {isVirtualTour && !hasProviderAvailable ? (
                    <p className="text-xs text-amber-700 mt-1">No active counselors available at this school</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">You can proceed to the next step</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    updateBookingState({ school: null });
                    setSearchQuery('');
                    setIsConfirmed(false);
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

  // Placeholder time slots
  const timeSlots = ['10:00 AM', '1:00 PM', '4:00 PM'];

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const requiredSessions = getRequiredSessionsCount(bookingState.plan);
  const selectedCount = bookingState.selectedSessions.length;

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

  // Check if a date+time combination is already selected
  const isTimeSlotSelected = (day: number, time: string): boolean => {
    const date = new Date(year, month, day);
    return bookingState.selectedSessions.some(session => {
      return (
        session.date.getDate() === date.getDate() &&
        session.date.getMonth() === date.getMonth() &&
        session.date.getFullYear() === date.getFullYear() &&
        session.time === time
      );
    });
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
  };

  const handleTimeSlotClick = (time: string) => {
    if (!selectedDate) return;

    // Check if this date+time is already selected
    const existingIndex = bookingState.selectedSessions.findIndex(session => {
      return (
        session.date.getDate() === selectedDate.getDate() &&
        session.date.getMonth() === selectedDate.getMonth() &&
        session.date.getFullYear() === selectedDate.getFullYear() &&
        session.time === time
      );
    });

    if (existingIndex !== -1) {
      // Remove if already selected
      const updatedSessions = bookingState.selectedSessions.filter((_, index) => index !== existingIndex);
      updateBookingState({ selectedSessions: updatedSessions });
    } else {
      // Add if not at limit and not already selected
      if (selectedCount < requiredSessions) {
        const newSession: SelectedSession = {
          date: new Date(selectedDate),
          time,
          displayString: formatDateString(selectedDate, time),
        };
        const updatedSessions = [...bookingState.selectedSessions, newSession];
        updateBookingState({ selectedSessions: updatedSessions });
      }
    }
  };

  const handleRemoveSession = (index: number) => {
    const updatedSessions = bookingState.selectedSessions.filter((_, i) => i !== index);
    updateBookingState({ selectedSessions: updatedSessions });
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

  // Get helper text based on plan
  const getHelperText = (): string => {
    if (requiredSessions === 1) {
      return 'Select 1 session time';
    } else if (requiredSessions === 2) {
      return 'Select 2 session times for your counseling plan';
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
        <h2 className="text-2xl font-semibold text-gray-900">Choose a Time</h2>
        <p className="mt-1 text-sm text-gray-600">{getHelperText()}</p>
        {/* Session Selection Progress Counter */}
        {shouldShowCounter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Selected Sessions:</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {timeSlots.map((time) => {
              const isSelectedTime = isTimeSlotSelected(selectedDate.getDate(), time);
              const isDisabled = selectedCount >= requiredSessions && !isSelectedTime;

              return (
                <button
                  key={time}
                  onClick={() => handleTimeSlotClick(time)}
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
                    <span className="font-medium text-gray-900">{time}</span>
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
  // Helper function to check if a provider's school matches the selected school
  const providerSchoolMatches = (providerSchool: string, selectedSchool: School): boolean => {
    if (!selectedSchool) return false;
    const providerSchoolNormalized = normalizeSchoolName(providerSchool);
    return providerSchoolNormalized === selectedSchool.normalizedName;
  };

  // STRICT PROVIDER FILTERING: Enforce role-based matching with no cross-subject/service leakage
  let matchedProviders: typeof MOCK_PROVIDERS = [];
  let generalProviders: typeof MOCK_PROVIDERS = [];

  if (bookingState.service === 'tutoring') {
    // TUTORING: Only Tutors with exact subject match
    if (!bookingState.subject) {
      matchedProviders = [];
    } else {
      const normalizedSubject = normalizeSubjectName(bookingState.subject);
      const isForeignLanguages = normalizedSubject === 'foreign languages';
      const isComputerScience = normalizedSubject === 'computer science';
      
      if (isForeignLanguages) {
        // Foreign Languages: STRICT matching by subject AND topic (language)
        if (bookingState.topic) {
          const normalizedTopic = normalizeSubjectName(bookingState.topic);
          matchedProviders = MOCK_PROVIDERS.filter((provider) => {
            // Must be a Tutor
            if (provider.role !== 'Tutor') return false;
            // Must teach Foreign Languages
            if (normalizeSubjectName(provider.subject) !== 'foreign languages') return false;
            // Must teach the specific language
            if (!provider.languages || provider.languages.length === 0) return false;
            return provider.languages.some((lang) => normalizeSubjectName(lang) === normalizedTopic);
          });
        } else {
          matchedProviders = [];
        }
      } else if (isComputerScience) {
        // Computer Science: STRICT matching by subject AND topic
        if (bookingState.topic) {
          const normalizedTopic = normalizeSubjectName(bookingState.topic);
          matchedProviders = MOCK_PROVIDERS.filter((provider) => {
            // Must be a Tutor
            if (provider.role !== 'Tutor') return false;
            // Must teach Computer Science
            if (normalizeSubjectName(provider.subject) !== 'computer science') return false;
            // Must teach the specific CS topic
            if (!provider.topics || provider.topics.length === 0) return false;
            return provider.topics.some((csTopic) => normalizeSubjectName(csTopic) === normalizedTopic);
          });
        } else {
          matchedProviders = [];
        }
      } else {
        // Math, Science, History, English: STRICT subject-only matching (topic is for context only)
        matchedProviders = MOCK_PROVIDERS.filter((provider) => {
          // Must be a Tutor
          if (provider.role !== 'Tutor') return false;
          // Exact subject match (case-insensitive)
          const providerSubjectNormalized = normalizeSubjectName(provider.subject);
          return providerSubjectNormalized === normalizedSubject;
        });
      }
    }
  } else if (bookingState.service === 'test-prep') {
    // TEST PREP: Only Tutors with exact test match
    if (!bookingState.subject) {
      matchedProviders = [];
    } else {
      const normalizedSubject = normalizeSubjectName(bookingState.subject);
      matchedProviders = MOCK_PROVIDERS.filter((provider) => {
        // Must be a Tutor
        if (provider.role !== 'Tutor') return false;
        // Exact test match (case-insensitive)
        const providerSubjectNormalized = normalizeSubjectName(provider.subject);
        return providerSubjectNormalized === normalizedSubject;
      });
    }
  } else if (bookingState.service === 'counseling') {
    // COLLEGE COUNSELING: Only Counselors tagged with the selected school (with fallback to general counselors)
    if (!bookingState.school) {
      matchedProviders = [];
    } else {
      // First, find counselors tagged with the selected school
      matchedProviders = MOCK_PROVIDERS.filter((provider) => {
        // Must be a Counselor
        if (provider.role !== 'Counselor') return false;
        // Must be tagged for college counseling
        if (normalizeSubjectName(provider.subject) !== 'college counseling') return false;
        // Check if provider is tagged with this school
        if (!provider.schoolTags || provider.schoolTags.length === 0) return false;
        return provider.schoolTags.some((tag) => {
          return normalizeSchoolName(tag) === bookingState.school!.normalizedName;
        });
      });

      // If no school-specific matches, show general counselors (fallback)
      if (matchedProviders.length === 0) {
        generalProviders = MOCK_PROVIDERS.filter((provider) => {
          // Must be a Counselor
          if (provider.role !== 'Counselor') return false;
          // Must be tagged for college counseling
          if (normalizeSubjectName(provider.subject) !== 'college counseling') return false;
          // General counselor (no specific school tags)
          return !provider.schoolTags || provider.schoolTags.length === 0;
        });
      }
    }
  } else if (bookingState.service === 'virtual-tour') {
    // VIRTUAL COLLEGE TOURS: Only providers tagged with the selected school (STRICT, no fallback)
    if (!bookingState.school) {
      matchedProviders = [];
    } else {
      matchedProviders = MOCK_PROVIDERS.filter((provider) => {
        // Must be a Counselor (virtual tour guides are counselors)
        if (provider.role !== 'Counselor') return false;
        // Must be tagged for virtual tours
        if (normalizeSubjectName(provider.subject) !== 'virtual tour') return false;
        // Must be tagged with this school (STRICT matching, no fallback)
        if (!provider.schoolTags || provider.schoolTags.length === 0) return false;
        return provider.schoolTags.some((tag) => {
          return normalizeSchoolName(tag) === bookingState.school!.normalizedName;
        });
      });
    }
  } else {
    // Unknown service: show no providers
    matchedProviders = [];
  }

  const hasNoMatches = matchedProviders.length === 0 && generalProviders.length === 0;
  const hasNoSchoolMatches = (bookingState.service === 'counseling' || bookingState.service === 'virtual-tour') &&
    bookingState.school &&
    matchedProviders.length === 0;

  const renderProviderCard = (provider: typeof MOCK_PROVIDERS[0]) => (
    <button
      key={provider.id}
      onClick={() => updateBookingState({ provider: provider.id })}
      className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
        bookingState.provider === provider.id
          ? 'border-[#0088CB] bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-700">
              {provider.name.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
            <p className="mt-1 text-sm text-gray-600">
              {bookingState.service === 'tutoring' || bookingState.service === 'test-prep'
                ? provider.subject
                : provider.school}
            </p>
            <div className="mt-2 flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">{provider.rating}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {bookingState.provider === provider.id && (
            <svg className="w-6 h-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              bookingState.provider === provider.id
                ? 'bg-[#0088CB] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Select
          </span>
        </div>
      </div>
    </button>
  );

  // Determine error message based on service type
  const getErrorMessage = (): string => {
    if (bookingState.service === 'tutoring') {
      if (bookingState.subject) {
        const normalizedSubject = normalizeSubjectName(bookingState.subject);
        if (normalizedSubject === 'foreign languages') {
          return "Whoops, looks like we don't have any tutors available for this language right now. Try another.";
        }
        if (normalizedSubject === 'computer science') {
          return "Whoops, looks like we don't have any tutors available for this Computer Science topic right now. Try another.";
        }
        return `Whoops, looks like we don't have any tutors available for ${bookingState.subject} right now. Try another subject.`;
      }
      return "Please select a subject to see available tutors.";
    }
    if (bookingState.service === 'test-prep') {
      if (bookingState.subject) {
        return `Whoops, looks like we don't have any tutors available for ${bookingState.subject} right now. Try another test.`;
      }
      return "Please select a test to see available tutors.";
    }
    if (bookingState.service === 'counseling') {
      if (bookingState.school) {
        return "Whoops, looks like we don't have any counselors at this school. Try another school.";
      }
      return "Please select a school to see available counselors.";
    }
    if (bookingState.service === 'virtual-tour') {
      if (bookingState.school) {
        return "Whoops, looks like we don't have any tour guides available for this school. Try another school.";
      }
      return "Please select a school to see available tour guides.";
    }
    return "No providers available for this service.";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Select a Provider</h2>
        <p className="mt-1 text-sm text-gray-600">Choose your preferred tutor or counselor</p>
      </div>

      {/* No matches at all - show error message */}
      {hasNoMatches ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-amber-900">
              {getErrorMessage()}
            </p>
          </div>
        </div>
      ) : hasNoSchoolMatches && generalProviders.length > 0 ? (
        /* Counseling: No school-specific matches, show general counselors (fallback) */
        <div className="space-y-6">
          {/* Friendly message */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-amber-900">
                Whoops! We currently don't have any counselors at this school.
              </p>
            </div>
          </div>

          {/* General counselors section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Available counselors for general college guidance</h3>
            <div className="space-y-4">
              {generalProviders.map(renderProviderCard)}
            </div>
          </div>
        </div>
      ) : (
        /* Regular provider list - matched providers */
        <div className="space-y-4">
          {matchedProviders.length > 0 ? (
            matchedProviders.map(renderProviderCard)
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-amber-900">
                  {getErrorMessage()}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
