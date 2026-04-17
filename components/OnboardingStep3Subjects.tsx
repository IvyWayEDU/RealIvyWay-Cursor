'use client';

import { useState } from 'react';

interface OnboardingStep3SubjectsProps {
  subjects: string[];
  onUpdate: (subjects: string[]) => void;
}

// High-level subjects only (topics are chosen by students later)
const COMMON_SUBJECTS = [
  'Math',
  'Science',
  'English',
  'History',
  'Languages',
  'Computer Science',
];

export default function OnboardingStep3Subjects({
  subjects,
  onUpdate,
}: OnboardingStep3SubjectsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const uniqueSubjects = Array.from(new Set(subjects));

  const filteredSubjects = COMMON_SUBJECTS.filter((subject) =>
    subject.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter((subject) => !uniqueSubjects.includes(subject));

  const handleAddSubject = (subject: string) => {
    if (!subjects.includes(subject)) {
      onUpdate([...subjects, subject]);
      setSearchTerm('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveSubject = (subject: string) => {
    onUpdate(subjects.filter((s) => s !== subject));
  };

  const handleCustomSubject = () => {
    const trimmed = searchTerm.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      onUpdate([...subjects, trimmed]);
      setSearchTerm('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Subjects</h2>
        <p className="mt-2 text-sm text-gray-600">
          What subjects would you like to tutor? You can add multiple subjects.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search for a subject or enter a custom subject"
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none"
        />
        {searchTerm && (
          <div className="absolute right-2 top-2">
            <button
              type="button"
              onClick={handleCustomSubject}
              className="px-3 py-1.5 text-sm font-medium text-white bg-[#0088CB] rounded-md hover:bg-[#0077B3]"
            >
              Add
            </button>
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSubjects.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredSubjects.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => handleAddSubject(subject)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {subject}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Common Subjects */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Quick Add:</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_SUBJECTS.slice(0, 8).map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => handleAddSubject(subject)}
              disabled={subjects.includes(subject)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                subjects.includes(subject)
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#0088CB] hover:text-[#0088CB]'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Subjects */}
      {uniqueSubjects.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Subjects:</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueSubjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0088CB] text-white"
              >
                {subject}
                <button
                  type="button"
                  onClick={() => handleRemoveSubject(subject)}
                  className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#0077B3] focus:outline-none"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {uniqueSubjects.length === 0 && (
        <p className="text-sm text-red-600">
          Please add at least one subject to continue.
        </p>
      )}
    </div>
  );
}

