'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/auth/types';
import { saveOnboardingProgress, completeOnboarding } from '@/lib/auth/onboarding';
import OnboardingStep1Photo from './OnboardingStep1Photo';
import OnboardingStep2ProviderType from './OnboardingStep2ProviderType';
import OnboardingStep3Schools from './OnboardingStep3Schools';
import OnboardingStep3Subjects from './OnboardingStep3Subjects';
import OnboardingStep4Availability from './OnboardingStep4Availability';
import OnboardingStep5Review from './OnboardingStep5Review';

interface OnboardingProviderClientProps {
  initialUser: User | null;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export default function OnboardingProviderClient({ initialUser }: OnboardingProviderClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [step3SubStep, setStep3SubStep] = useState<'schools' | 'subjects' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onboarding data state
  const [onboardingData, setOnboardingData] = useState({
    profilePhotoUrl: initialUser?.profilePhotoUrl ?? undefined,
    profilePhotoSkipped: initialUser?.profilePhotoSkipped || false,
    isTutor: initialUser?.isTutor ?? (initialUser?.roles.includes('tutor') || false),
    isCounselor: initialUser?.isCounselor ?? (initialUser?.roles.includes('counselor') || false),
    schoolIds: initialUser?.schoolIds || [],
    schoolNames: initialUser?.schoolNames || [],
    subjects: initialUser?.subjects || [],
  });

  // Determine which step 3 to show
  const needsSchools = onboardingData.isCounselor;
  const needsSubjects = onboardingData.isTutor;
  const needsBoth = needsSchools && needsSubjects;

  // Calculate total steps
  const totalSteps = 2 + (needsBoth ? 2 : (needsSchools || needsSubjects ? 1 : 0)) + 2; // Step 1, 2, 3(s), 4, 5

  const handleNext = async () => {
    setError(null);
    
    // Validate current step before proceeding
    if (currentStep === 2) {
      if (!onboardingData.isTutor && !onboardingData.isCounselor) {
        setError('Please select at least one provider type (Tutor or Counselor)');
        return;
      }
    } else if (currentStep === 3) {
      // Validate step 3 based on substep
      if (step3SubStep === 'schools') {
        if (needsSchools && (!onboardingData.schoolIds || onboardingData.schoolIds.length === 0)) {
          setError('Please add at least one school');
          return;
        }
      } else if (step3SubStep === 'subjects') {
        if (needsSubjects && (!onboardingData.subjects || onboardingData.subjects.length === 0)) {
          setError('Please add at least one subject');
          return;
        }
        // If both are needed, also validate schools before moving to step 4
        if (needsBoth && (!onboardingData.schoolIds || onboardingData.schoolIds.length === 0)) {
          setError('Please add at least one school');
          return;
        }
      }
    }

    // Save progress
    await saveOnboardingProgress(onboardingData);

    // Determine next step
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Step 3 depends on selection
      if (needsBoth) {
        setCurrentStep(3);
        setStep3SubStep('schools'); // Schools first
      } else if (needsSchools) {
        setCurrentStep(3);
        setStep3SubStep('schools');
      } else if (needsSubjects) {
        setCurrentStep(3);
        setStep3SubStep('subjects');
      } else {
        setCurrentStep(4); // Skip to availability
        setStep3SubStep(null);
      }
    } else if (currentStep === 3) {
      // If both are needed and we just did schools, go to subjects
      if (needsBoth && step3SubStep === 'schools') {
        setStep3SubStep('subjects'); // Stay on step 3 but show subjects
      } else {
        setCurrentStep(4); // Go to availability
        setStep3SubStep(null);
      }
    } else if (currentStep === 4) {
      setCurrentStep(5); // Review
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      // If showing subjects and both are needed, go back to schools
      if (needsBoth && step3SubStep === 'subjects') {
        setStep3SubStep('schools'); // Stay on step 3 but show schools
      } else {
        setCurrentStep(2);
        setStep3SubStep(null);
      }
    } else if (currentStep === 4) {
      // Go back to step 3 (last conditional step)
      if (needsBoth) {
        setStep3SubStep('subjects'); // Go back to subjects first
      } else if (needsSubjects) {
        setStep3SubStep('subjects');
      } else if (needsSchools) {
        setStep3SubStep('schools');
      }
      setCurrentStep(3);
    } else if (currentStep === 5) {
      setCurrentStep(4);
    }
  };

  const handleComplete = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Final validation
      if (onboardingData.isCounselor && (!onboardingData.schoolIds || onboardingData.schoolIds.length === 0)) {
        setError('Schools are required for counselors');
        setIsSubmitting(false);
        return;
      }

      if (onboardingData.isTutor && (!onboardingData.subjects || onboardingData.subjects.length === 0)) {
        setError('Subjects are required for tutors');
        setIsSubmitting(false);
        return;
      }

      // Save final progress
      await saveOnboardingProgress(onboardingData);

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

  // Determine which step 3 component to render
  const renderStep3 = () => {
    if (step3SubStep === 'schools') {
      return (
        <OnboardingStep3Schools
          schoolIds={onboardingData.schoolIds || []}
          schoolNames={onboardingData.schoolNames || []}
          onUpdate={(schoolIds, schoolNames) => updateData({ schoolIds, schoolNames })}
        />
      );
    } else if (step3SubStep === 'subjects') {
      return (
        <OnboardingStep3Subjects
          subjects={onboardingData.subjects || []}
          onUpdate={(subjects) => updateData({ subjects })}
        />
      );
    }
    return null;
  };

  // Calculate progress percentage
  const getProgress = () => {
    if (currentStep === 1) return 20;
    if (currentStep === 2) return 40;
    if (currentStep === 3) return needsBoth ? 60 : 60;
    if (currentStep === 4) return 80;
    if (currentStep === 5) return 100;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">
              Step {currentStep} of {totalSteps}
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
          {currentStep === 1 && (
            <OnboardingStep1Photo
              profilePhotoUrl={onboardingData.profilePhotoUrl}
              profilePhotoSkipped={onboardingData.profilePhotoSkipped}
              onUpdate={(updates) => updateData(updates)}
              onSkip={() => {
                // Auto-advance to next step when skipping
                handleNext();
              }}
            />
          )}

          {currentStep === 2 && (
            <OnboardingStep2ProviderType
              isTutor={onboardingData.isTutor}
              isCounselor={onboardingData.isCounselor}
              onUpdate={(updates) => updateData(updates)}
            />
          )}

          {currentStep === 3 && renderStep3()}

          {currentStep === 4 && (
            <OnboardingStep4Availability />
          )}

          {currentStep === 5 && (
            <OnboardingStep5Review
              onboardingData={onboardingData}
              onComplete={handleComplete}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0088CB] rounded-md hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB]"
            >
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

