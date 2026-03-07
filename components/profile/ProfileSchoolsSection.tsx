'use client';

import { useState, useEffect } from 'react';
import { SCHOOLS, School, searchSchools } from '@/data/schools';

interface ProfileSchoolsSectionProps {
  schoolIds?: string[];
  schoolNames?: string[];
  schools?: string[]; // Legacy: for backward compatibility
  onUpdate: (schoolIds: string[], schoolNames: string[]) => void;
}

export default function ProfileSchoolsSection({
  schoolIds: initialSchoolIds = [],
  schoolNames: initialSchoolNames = [],
  schools: legacySchools = [], // Legacy support
  onUpdate,
}: ProfileSchoolsSectionProps) {
  // Use schoolIds if available, otherwise fall back to legacy schools
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>(() => {
    if (initialSchoolIds.length > 0) {
      return initialSchoolIds;
    }
    // Legacy schools should be migrated automatically by profile.ts
    // But if they exist here, we'll let the migration happen on save
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasLegacySchools, setHasLegacySchools] = useState(false);

  // Check if user has legacy schools (schoolNames but no schoolIds)
  useEffect(() => {
    const hasLegacy = (legacySchools.length > 0 && initialSchoolIds.length === 0) ||
                     (initialSchoolNames.length > 0 && initialSchoolIds.length === 0);
    setHasLegacySchools(hasLegacy);
  }, [legacySchools, initialSchoolIds, initialSchoolNames]);

  // Get selected schools for display
  const selectedSchools = selectedSchoolIds
    .map(id => SCHOOLS.find(s => s.id === id))
    .filter((s): s is School => s !== undefined);

  // Get filtered suggestions
  const filteredSchools = searchQuery.trim()
    ? searchSchools(searchQuery).filter(school => !selectedSchoolIds.includes(school.id))
    : SCHOOLS.filter(school => !selectedSchoolIds.includes(school.id));

  const handleAddSchool = (school: School) => {
    if (!selectedSchoolIds.includes(school.id)) {
      const newSchoolIds = [...selectedSchoolIds, school.id];
      const newSchoolNames = newSchoolIds.map(id => {
        const s = SCHOOLS.find(ss => ss.id === id);
        return s?.name || '';
      }).filter(Boolean);
      setSelectedSchoolIds(newSchoolIds);
      onUpdate(newSchoolIds, newSchoolNames);
      setSearchQuery('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveSchool = (schoolId: string) => {
    const newSchoolIds = selectedSchoolIds.filter(id => id !== schoolId);
    const newSchoolNames = newSchoolIds.map(id => {
      const s = SCHOOLS.find(ss => ss.id === id);
      return s?.name || '';
    }).filter(Boolean);
    setSelectedSchoolIds(newSchoolIds);
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

      {/* Backward compatibility warning */}
      {hasLegacySchools && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-900">Please reselect your school</p>
              <p className="mt-1 text-sm text-amber-700">
                Your school information needs to be updated. Please select your school(s) from the dropdown below to continue appearing in search results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search for a school (e.g., Harvard, Stanford)"
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
