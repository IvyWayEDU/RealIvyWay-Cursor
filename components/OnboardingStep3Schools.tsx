'use client';

import { useState } from 'react';
import { SCHOOLS, School, searchSchools } from '@/data/schools';

interface OnboardingStep3SchoolsProps {
  schoolIds: string[];
  schoolNames: string[];
  onUpdate: (schoolIds: string[], schoolNames: string[]) => void;
}

export default function OnboardingStep3Schools({
  schoolIds = [],
  schoolNames = [],
  onUpdate,
}: OnboardingStep3SchoolsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get selected schools from schoolIds
  const selectedSchools = schoolIds
    .map(id => SCHOOLS.find(s => s.id === id))
    .filter((s): s is School => s !== undefined);

  // Get filtered schools from the shared catalog
  const filteredSchools = searchTerm.trim()
    ? searchSchools(searchTerm).filter(school => !schoolIds.includes(school.id))
    : SCHOOLS.filter(school => !schoolIds.includes(school.id));

  const handleAddSchool = (school: School) => {
    if (!schoolIds.includes(school.id)) {
      const newSchoolIds = [...schoolIds, school.id];
      const newSchoolNames = newSchoolIds.map(id => {
        const s = SCHOOLS.find(ss => ss.id === id);
        return s?.name || '';
      }).filter(Boolean);
      onUpdate(newSchoolIds, newSchoolNames);
      setSearchTerm('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveSchool = (schoolId: string) => {
    const newSchoolIds = schoolIds.filter(id => id !== schoolId);
    const newSchoolNames = newSchoolIds.map(id => {
      const s = SCHOOLS.find(ss => ss.id === id);
      return s?.name || '';
    }).filter(Boolean);
    onUpdate(newSchoolIds, newSchoolNames);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">College / School</h2>
        <p className="mt-2 text-sm text-gray-600">
          Which college or school do you attend or represent? You can add multiple schools.
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
          placeholder="Search for a school (e.g., Harvard, Stanford, University of Michigan)"
          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB] outline-none"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSchools.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredSchools.map((school) => (
              <button
                key={school.id}
                type="button"
                onClick={() => handleAddSchool(school)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {school.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Schools */}
      {selectedSchools.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Schools:</h3>
          <div className="flex flex-wrap gap-2">
            {selectedSchools.map((school) => (
              <span
                key={school.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0088CB] text-white"
              >
                {school.name}
                <button
                  type="button"
                  onClick={() => handleRemoveSchool(school.id)}
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

      {selectedSchools.length === 0 && (
        <p className="text-sm text-amber-600">
          Please add at least one school to continue.
        </p>
      )}
    </div>
  );
}

