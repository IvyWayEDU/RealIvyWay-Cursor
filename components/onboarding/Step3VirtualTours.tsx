'use client';

interface Step3VirtualToursProps {
  offersVirtualTours: boolean | null;
  onUpdate: (offersVirtualTours: boolean) => void;
}

export default function Step3VirtualTours({
  offersVirtualTours,
  onUpdate,
}: Step3VirtualToursProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Are you available for virtual campus tours?</h2>
        <p className="mt-2 text-sm text-gray-500">
          Only applies if you currently live on or near campus
        </p>
      </div>

      <div className="space-y-4">
        <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center h-5">
            <input
              type="radio"
              name="virtualTours"
              checked={offersVirtualTours === true}
              onChange={() => onUpdate(true)}
              className="h-5 w-5 text-[#0088CB] focus:ring-[#0088CB] border-gray-300"
            />
          </div>
          <div className="ml-3 flex-1">
            <span className="text-lg font-semibold text-gray-900">Yes</span>
            <p className="mt-1 text-sm text-gray-600">
              I can provide virtual campus tours
            </p>
          </div>
          {offersVirtualTours === true && (
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

        <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center h-5">
            <input
              type="radio"
              name="virtualTours"
              checked={offersVirtualTours === false}
              onChange={() => onUpdate(false)}
              className="h-5 w-5 text-[#0088CB] focus:ring-[#0088CB] border-gray-300"
            />
          </div>
          <div className="ml-3 flex-1">
            <span className="text-lg font-semibold text-gray-900">No</span>
            <p className="mt-1 text-sm text-gray-600">
              I'm not available for virtual campus tours
            </p>
          </div>
          {offersVirtualTours === false && (
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
    </div>
  );
}


