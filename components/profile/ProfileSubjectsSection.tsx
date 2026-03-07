'use client';

import OnboardingStep3Subjects from '@/components/OnboardingStep3Subjects';

interface ProfileSubjectsSectionProps {
  subjects: string[];
  onUpdate: (subjects: string[]) => void;
}

export default function ProfileSubjectsSection({
  subjects,
  onUpdate,
}: ProfileSubjectsSectionProps) {
  return <OnboardingStep3Subjects subjects={subjects} onUpdate={onUpdate} />;
}



