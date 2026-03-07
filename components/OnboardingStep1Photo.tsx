'use client';

import { useState, useRef } from 'react';

interface OnboardingStep1PhotoProps {
  profilePhotoUrl?: string;
  profilePhotoSkipped: boolean;
  onUpdate: (updates: { profilePhotoUrl?: string; profilePhotoSkipped: boolean }) => void;
  onSkip?: () => void;
}

export default function OnboardingStep1Photo({
  profilePhotoUrl,
  profilePhotoSkipped,
  onUpdate,
  onSkip,
}: OnboardingStep1PhotoProps) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(profilePhotoUrl);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoUrl(result);
        onUpdate({ profilePhotoUrl: result, profilePhotoSkipped: false });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
      setIsUploading(false);
    }
  };

  const handleSkip = () => {
    setPhotoUrl(undefined);
    onUpdate({ profilePhotoUrl: undefined, profilePhotoSkipped: true });
    // Trigger skip callback if provided (for auto-advance)
    if (onSkip) {
      onSkip();
    }
  };

  const handleRemove = () => {
    setPhotoUrl(undefined);
    onUpdate({ profilePhotoUrl: undefined, profilePhotoSkipped: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile Photo</h2>
        <p className="mt-2 text-sm text-gray-600">
          Add a profile photo to help students recognize you. You can skip this step for now.
        </p>
      </div>

      <div className="flex flex-col items-center space-y-4">
        {/* Avatar Display */}
        <div className="relative">
          <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-300">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                className="h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            )}
          </div>
          {photoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex flex-col items-center space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] cursor-pointer ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {photoUrl ? 'Change Photo' : 'Upload Photo'}
              </>
            )}
          </label>

          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

