'use client';

interface Step1ServiceSelectionProps {
  services: string[];
  onUpdate: (services: string[]) => void;
}

export default function Step1ServiceSelection({
  services,
  onUpdate,
}: Step1ServiceSelectionProps) {
  const handleToggle = (service: 'tutoring' | 'college_counseling') => {
    if (services.includes(service)) {
      onUpdate(services.filter(s => s !== service));
    } else {
      onUpdate([...services, service]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">What services do you want to offer?</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select all that apply. You can offer multiple services.
        </p>
      </div>

      <div className="space-y-4">
        {/* Tutoring Option */}
        <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              checked={services.includes('tutoring')}
              onChange={() => handleToggle('tutoring')}
              className="h-5 w-5 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <svg
                className="h-6 w-6 text-[#0088CB] mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span className="text-lg font-semibold text-gray-900">Tutoring</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Provide one-on-one tutoring sessions in subjects you excel at
            </p>
          </div>
          {services.includes('tutoring') && (
            <div className="absolute top-2 right-2">
              <svg className="h-5 w-5 text-[#0088CB]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </label>

        {/* College Counseling Option */}
        <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              checked={services.includes('college_counseling')}
              onChange={() => handleToggle('college_counseling')}
              className="h-5 w-5 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <svg
                className="h-6 w-6 text-[#0088CB] mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span className="text-lg font-semibold text-gray-900">College Counseling</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Provide college counseling and guidance to help students with applications and planning
            </p>
          </div>
          {services.includes('college_counseling') && (
            <div className="absolute top-2 right-2">
              <svg className="h-5 w-5 text-[#0088CB]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </label>
      </div>

      {services.length === 0 && (
        <p className="text-sm text-red-600 mt-2">
          Please select at least one service to continue.
        </p>
      )}
    </div>
  );
}


