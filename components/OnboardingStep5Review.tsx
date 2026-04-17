'use client';

interface OnboardingStep5ReviewProps {
  onboardingData: {
    profilePhotoUrl?: string;
    profilePhotoSkipped: boolean;
    isTutor: boolean;
    isCounselor: boolean;
    schools?: string[]; // Legacy: kept for backward compatibility
    schoolIds?: string[];
    schoolNames?: string[];
    subjects?: string[];
  };
  onComplete: () => void;
  isSubmitting: boolean;
}

export default function OnboardingStep5Review({
  onboardingData,
  onComplete,
  isSubmitting,
}: OnboardingStep5ReviewProps) {
  const uniqueSubjects = Array.from(new Set(onboardingData.subjects ?? []));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review & Complete</h2>
        <p className="mt-2 text-sm text-gray-600">
          Please review your information before completing setup.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Photo */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Profile Photo</h3>
          {onboardingData.profilePhotoUrl ? (
            <div className="flex items-center space-x-3">
              <img
                src={onboardingData.profilePhotoUrl}
                alt="Profile"
                className="h-12 w-12 rounded-full object-cover"
              />
              <span className="text-sm text-gray-600">Photo uploaded</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">Skipped</span>
          )}
        </div>

        {/* Provider Type */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Provider Type</h3>
          <div className="flex flex-wrap gap-2">
            {onboardingData.isTutor && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Tutor
              </span>
            )}
            {onboardingData.isCounselor && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Counselor
              </span>
            )}
          </div>
        </div>

        {/* Schools (if counselor) */}
        {onboardingData.isCounselor && (
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Schools</h3>
            {onboardingData.schoolNames && onboardingData.schoolNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {onboardingData.schoolNames.map((schoolName, index) => (
                  <span
                    key={onboardingData.schoolIds?.[index] || schoolName}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                  >
                    {schoolName}
                  </span>
                ))}
              </div>
            ) : onboardingData.schools && onboardingData.schools.length > 0 ? (
              // Legacy fallback
              <div className="flex flex-wrap gap-2">
                {onboardingData.schools.map((school) => (
                  <span
                    key={school}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                  >
                    {school}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-red-600">No schools added</span>
            )}
          </div>
        )}

        {/* Subjects (if tutor) */}
        {onboardingData.isTutor && (
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Subjects</h3>
            {uniqueSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {uniqueSubjects.map((subject) => (
                  <span
                    key={subject}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-red-600">No subjects added</span>
            )}
          </div>
        )}

        {/* Availability */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Availability</h3>
          <p className="text-sm text-gray-600">
            Your availability has been saved. You can update it anytime from your dashboard.
          </p>
        </div>
      </div>

      {/* Complete Button */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onComplete}
          disabled={isSubmitting}
          className="w-full px-4 py-3 text-base font-medium text-white bg-[#0088CB] rounded-md hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Completing Setup...
            </span>
          ) : (
            'Finish Setup'
          )}
        </button>
      </div>
    </div>
  );
}

