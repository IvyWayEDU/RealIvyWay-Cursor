'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/auth/types';
import { saveOnboardingProgress, completeOnboarding } from '@/lib/auth/onboarding';
import Step1ServiceSelection from './onboarding/Step1ServiceSelection';
import Step2ATutoringSubjects from './onboarding/Step2ATutoringSubjects';
import Step2BCollegeSchool from './onboarding/Step2BCollegeSchool';
import Step3VirtualTours from './onboarding/Step3VirtualTours';
import Step4ProfilePhoto from './onboarding/Step4ProfilePhoto';

interface ProviderOnboardingClientProps {
  initialUser: User | null;
}

type OnboardingStep = 'service-selection' | 'subjects' | 'school' | 'virtual-tours' | 'photo';

export default function ProviderOnboardingClient({ initialUser }: ProviderOnboardingClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('service-selection');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onboarding data state
  const [onboardingData, setOnboardingData] = useState({
    services: (initialUser as any)?.services || [],
    subjects: initialUser?.subjects || [],
    schoolId: (initialUser as any)?.schoolId || (initialUser as any)?.school_id || (initialUser as any)?.schoolIds?.[0] || null,
    schoolName:
      (initialUser as any)?.schoolName ||
      (initialUser as any)?.school_name ||
      (initialUser as any)?.schoolNames?.[0] ||
      (initialUser as any)?.school ||
      null,
    offersVirtualTours: (initialUser as any)?.offersVirtualTours ?? null,
    profileImageUrl: (initialUser as any)?.profileImageUrl || null,
  });

  // Determine which steps are needed
  const hasTutoring = onboardingData.services.includes('tutoring');
  const hasCounseling = onboardingData.services.includes('college_counseling');
  const needsSubjects = hasTutoring;
  const needsSchool = hasCounseling;
  const needsVirtualTours = hasCounseling;

  // Calculate total steps and current step number
  const getStepNumber = (): number => {
    const steps: OnboardingStep[] = ['service-selection'];
    if (needsSubjects) steps.push('subjects');
    if (needsSchool) steps.push('school');
    if (needsVirtualTours) steps.push('virtual-tours');
    steps.push('photo');
    return steps.indexOf(currentStep) + 1;
  };

  const getTotalSteps = (): number => {
    let count = 1; // service-selection
    if (needsSubjects) count++;
    if (needsSchool) count++;
    if (needsVirtualTours) count++;
    count++; // photo
    return count;
  };

  // Determine next step based on current step and selections
  const getNextStep = (): OnboardingStep | 'complete' => {
    if (currentStep === 'service-selection') {
      // Order: school → subjects → virtual-tours → photo
      if (needsSchool) return 'school';
      if (needsSubjects) return 'subjects';
      return 'photo';
    }
    if (currentStep === 'school') {
      if (needsSubjects) return 'subjects';
      if (needsVirtualTours) return 'virtual-tours';
      return 'photo';
    }
    if (currentStep === 'subjects') {
      if (needsVirtualTours) return 'virtual-tours';
      return 'photo';
    }
    if (currentStep === 'virtual-tours') {
      return 'photo';
    }
    if (currentStep === 'photo') {
      return 'complete';
    }
    return 'photo';
  };

  // Determine previous step
  const getPreviousStep = (): OnboardingStep | null => {
    if (currentStep === 'service-selection') return null;
    if (currentStep === 'school') return 'service-selection';
    if (currentStep === 'subjects') {
      if (needsSchool) return 'school';
      return 'service-selection';
    }
    if (currentStep === 'virtual-tours') {
      if (needsSubjects) return 'subjects';
      if (needsSchool) return 'school';
      return 'service-selection';
    }
    if (currentStep === 'photo') {
      if (needsVirtualTours) return 'virtual-tours';
      if (needsSubjects) return 'subjects';
      if (needsSchool) return 'school';
      return 'service-selection';
    }
    return null;
  };

  // Save progress after each step
  const saveProgress = async () => {
    try {
      await saveOnboardingProgress({
        services: onboardingData.services,
        subjects: onboardingData.subjects,
        schoolId: onboardingData.schoolId,
        schoolName: onboardingData.schoolName,
        offersVirtualTours: onboardingData.offersVirtualTours,
        profileImageUrl: onboardingData.profileImageUrl,
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Auto-save on data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep !== 'service-selection' || onboardingData.services.length > 0) {
        saveProgress();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [onboardingData]);

  const handleNext = async () => {
    setError(null);

    // Validate current step
    if (currentStep === 'service-selection') {
      if (onboardingData.services.length === 0) {
        setError('Please select at least one service to continue.');
        return;
      }
    } else if (currentStep === 'subjects') {
      if (onboardingData.subjects.length === 0) {
        setError('Please select at least one subject to continue.');
        return;
      }
    } else if (currentStep === 'virtual-tours') {
      if (onboardingData.offersVirtualTours === null) {
        setError('Please select an option to continue.');
        return;
      }
    }

    // School step submission: resolve/insert into `schools`, then persist provider.school_id (or NULL if skipped).
    if (currentStep === 'school') {
      try {
        const res = await fetch('/api/onboarding/provider-school', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolName: onboardingData.schoolName }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || 'Failed to save school');
        }
        const j = (await res.json()) as any;
        updateData({
          schoolId: typeof j?.schoolId === 'string' ? j.schoolId : null,
          schoolName: typeof j?.schoolName === 'string' ? j.schoolName : null,
        });
      } catch (e) {
        console.error('[onboarding] failed to submit school', e);
        setError(e instanceof Error ? e.message : 'Failed to save school');
        return;
      }
    }

    // Save progress
    await saveProgress();

    // Move to next step
    const nextStep = getNextStep();
    if (nextStep === 'complete') {
      await handleComplete();
    } else {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    setError(null);
    const prevStep = getPreviousStep();
    if (prevStep) {
      setCurrentStep(prevStep);
    }
  };

  const handleComplete = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Final validation
      if (onboardingData.services.length === 0) {
        setError('Please select at least one service.');
        setIsSubmitting(false);
        return;
      }

      if (needsSubjects && onboardingData.subjects.length === 0) {
        setError('Subjects are required for tutoring.');
        setIsSubmitting(false);
        return;
      }

      if (needsVirtualTours && onboardingData.offersVirtualTours === null) {
        setError('Please answer the virtual tours question.');
        setIsSubmitting(false);
        return;
      }

      // Ensure school is persisted before completing onboarding (covers users who jump around steps).
      if (needsSchool) {
        const res = await fetch('/api/onboarding/provider-school', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolName: onboardingData.schoolName }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j?.error || 'Failed to save school');
          setIsSubmitting(false);
          return;
        }
        const j = (await res.json()) as any;
        updateData({
          schoolId: typeof j?.schoolId === 'string' ? j.schoolId : null,
          schoolName: typeof j?.schoolName === 'string' ? j.schoolName : null,
        });
      }

      // Save final progress
      await saveProgress();

      // Complete onboarding
      const result = await completeOnboarding();
      if (!result.success) {
        setError(result.error || 'Failed to complete onboarding');
        setIsSubmitting(false);
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard/provider');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const updateData = (updates: Partial<typeof onboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...updates }));
  };

  // Calculate progress percentage
  const getProgress = () => {
    const current = getStepNumber();
    const total = getTotalSteps();
    return Math.round((current / total) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">
              Step {getStepNumber()} of {getTotalSteps()}
            </h2>
            <span className="text-sm font-medium text-gray-700">{getProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#0088CB] h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {currentStep === 'service-selection' && (
            <Step1ServiceSelection
              services={onboardingData.services}
              onUpdate={(services) => updateData({ services })}
            />
          )}

          {currentStep === 'subjects' && (
            <Step2ATutoringSubjects
              subjects={onboardingData.subjects}
              onUpdate={(subjects) => updateData({ subjects })}
            />
          )}

          {currentStep === 'school' && (
            <Step2BCollegeSchool
              schoolId={onboardingData.schoolId}
              schoolName={onboardingData.schoolName}
              onUpdate={(schoolId, schoolName) => updateData({ schoolId, schoolName })}
            />
          )}

          {currentStep === 'virtual-tours' && (
            <Step3VirtualTours
              offersVirtualTours={onboardingData.offersVirtualTours}
              onUpdate={(offersVirtualTours) => updateData({ offersVirtualTours })}
            />
          )}

          {currentStep === 'photo' && (
            <Step4ProfilePhoto
              profileImageUrl={onboardingData.profileImageUrl || undefined}
              onUpdate={(profileImageUrl) => updateData({ profileImageUrl })}
              onSkip={handleNext}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={getPreviousStep() === null}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep !== 'photo' ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0088CB] rounded-md hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0088CB] rounded-md hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Completing...' : 'Complete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

