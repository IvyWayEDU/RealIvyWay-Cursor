'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignupPreview() {
  const [selectedRoleCard, setSelectedRoleCard] = useState<'student' | 'tutor-counselor' | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<{
    student: boolean;
    tutor: boolean;
    counselor: boolean;
  }>({
    student: false,
    tutor: false,
    counselor: false,
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const handleRoleCardClick = (role: 'student' | 'tutor-counselor') => {
    setSelectedRoleCard(role);
    if (role === 'student') {
      setSelectedRoles({ student: true, tutor: false, counselor: false });
    } else {
      setSelectedRoles({ student: false, tutor: true, counselor: false });
    }
  };

  const handleRoleCheckboxChange = (role: 'student' | 'tutor' | 'counselor') => {
    setSelectedRoles(prev => ({
      ...prev,
      [role]: !prev[role],
    }));
    // Clear error when user selects a role
    if (roleError) {
      setRoleError(null);
    }
  };

  return (
    <div id="create-account" className="border-t border-gray-200 bg-white py-32">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
            Create your account
          </h2>
          <p className="mt-4 text-xl leading-8 text-gray-600">
            Choose your role and get started in minutes
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleRoleCardClick('student')}
            className={`rounded-lg border-2 p-6 text-left transition-all ${
              selectedRoleCard === 'student'
                ? 'border-[#0088CB] bg-[#0088CB]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <h3 className="text-lg font-semibold text-black">Student</h3>
          </button>
          <button
            type="button"
            onClick={() => handleRoleCardClick('tutor-counselor')}
            className={`rounded-lg border-2 p-6 text-left transition-all ${
              selectedRoleCard === 'tutor-counselor'
                ? 'border-[#0088CB] bg-[#0088CB]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <h3 className="text-lg font-semibold text-black">Tutor / Counselor</h3>
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-black mb-2">
              Full Name <span className="text-[#0088CB]">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-black placeholder-gray-400 focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-0"
              placeholder="Enter your full name"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
              Email <span className="text-[#0088CB]">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-black placeholder-gray-400 focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-0"
              placeholder="Enter your email"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
              Password <span className="text-[#0088CB]">*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-black placeholder-gray-400 focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-0"
              placeholder="Create a password"
            />
          </div>

          {/* Role Field with Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-black mb-3">
              Role <span className="text-[#0088CB]">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedRoles.student}
                  onChange={() => handleRoleCheckboxChange('student')}
                  className="h-4 w-4 rounded border-gray-300 text-[#0088CB] focus:ring-[#0088CB]"
                />
                <span className="ml-3 text-base text-black">Student</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedRoles.tutor}
                  onChange={() => handleRoleCheckboxChange('tutor')}
                  className="h-4 w-4 rounded border-gray-300 text-[#0088CB] focus:ring-[#0088CB]"
                />
                <span className="ml-3 text-base text-black">Tutor</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedRoles.counselor}
                  onChange={() => handleRoleCheckboxChange('counselor')}
                  className="h-4 w-4 rounded border-gray-300 text-[#0088CB] focus:ring-[#0088CB]"
                />
                <span className="ml-3 text-base text-black">Counselor</span>
              </label>
            </div>
          </div>
        </div>

        {/* Terms & Privacy Agreement */}
        <div className="mt-8">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={() => setAgreedToTerms(!agreedToTerms)}
              className="mt-1 h-4 w-4 rounded-full border-gray-300 text-[#0088CB] focus:ring-[#0088CB]"
            />
            <span className="ml-3 text-sm text-black">
              I agree to the{' '}
              <Link href="/terms" className="text-[#0088CB] hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-[#0088CB] hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>

        {/* Role Selection Error */}
        {roleError && (
          <div className="mt-4 rounded-md bg-red-50 p-3 border border-red-200">
            <p className="text-sm text-red-800">{roleError}</p>
          </div>
        )}

        {/* Create Account Button */}
        <button
          type="button"
          onClick={() => {
            const hasRole = selectedRoles.student || selectedRoles.tutor || selectedRoles.counselor;
            if (!hasRole) {
              setRoleError('Please select at least one role (Student, Tutor, Counselor, or Provider)');
              return;
            }
            setRoleError(null);
            // Handle account creation logic here
          }}
          className="mt-8 w-full rounded-md bg-[#0088CB] px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] transition-colors"
        >
          Create Account
        </button>

        {/* Divider */}
        <div className="mt-6 flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">Or continue with</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Social Sign-In Options */}
        <div className="mt-6 space-y-4">
          <button
            type="button"
            className="w-full rounded-md border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-black shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button
            type="button"
            className="w-full rounded-md border border-gray-300 bg-white px-6 py-3.5 text-base font-medium text-black shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300 transition-colors flex items-center justify-center gap-3"
          >
            <img
              src="/apple-logo.svg"
              alt="Apple"
              className="h-5 w-5"
            />
            Continue with Apple ID
          </button>
        </div>
      </div>
    </div>
  );
}

