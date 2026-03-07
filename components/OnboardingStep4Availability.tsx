'use client';

import AvailabilitySection from './AvailabilitySection';

export default function OnboardingStep4Availability() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Set Your Availability</h2>
        <p className="mt-2 text-sm text-gray-600">
          Set your weekly availability. At least one availability block is required.
        </p>
      </div>

      <div className="mt-6">
        <AvailabilitySection />
      </div>
    </div>
  );
}



