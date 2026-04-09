'use client';

import { useState, useRef, useEffect } from 'react';
import { SCHOOLS, School, searchSchools } from '@/data/schools';
import { normalizeSchoolName } from '@/lib/models/normalizeSchoolName';

interface Step2BCollegeSchoolProps {
  schoolId: string | null;
  schoolName: string | null;
  onUpdate: (schoolId: string | null, schoolName: string | null) => void;
}

export default function Step2BCollegeSchool({
  schoolId,
  schoolName,
  onUpdate,
}: Step2BCollegeSchoolProps) {
  const [searchQuery, setSearchQuery] = useState(schoolName || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(
    schoolId ? SCHOOLS.find(s => s.id === schoolId) || null : null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Update search query when selected school changes
  useEffect(() => {
    if (selectedSchool) {
      setSearchQuery(selectedSchool.name);
    }
  }, [selectedSchool]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSchools = searchQuery.trim()
    ? searchSchools(searchQuery)
    : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(true);
    
    // Clear selection if user is typing
    if (selectedSchool && value !== selectedSchool.name) {
      setSelectedSchool(null);
    }

    const trimmed = value.trim();
    onUpdate(null, trimmed ? trimmed : null);
  };

  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    setSearchQuery(school.name);
    setShowSuggestions(false);
    onUpdate(school.id, school.name);
  };

  const handleInputFocus = () => {
    if (searchQuery.trim() || filteredSchools.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchQuery('');
      setSelectedSchool(null);
      onUpdate(null, null);
      return;
    }

    // If they didn't pick a dropdown item, normalize the free-text value.
    if (!selectedSchool) {
      const normalized = normalizeSchoolName(trimmed);
      setSearchQuery(normalized);

      // If their normalized name exactly matches a known school, auto-link to its ID
      // (still suggestion-only; free text remains valid regardless).
      const matched =
        SCHOOLS.find((s) => s.name.toLowerCase() === normalized.toLowerCase()) || null;
      if (matched) {
        setSelectedSchool(matched);
        onUpdate(matched.id, matched.name);
      } else {
        onUpdate(null, normalized);
      }
    }
  };

  const handleSkip = () => {
    setSearchQuery('');
    setSelectedSchool(null);
    setShowSuggestions(false);
    onUpdate(null, null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Which college or university do you attend or have attended?</h2>
        <p className="mt-2 text-sm text-gray-600">
          Start typing to search, enter your school manually, or skip for now.
        </p>
      </div>

      <div className="relative">
        <label htmlFor="school" className="block text-sm font-medium text-gray-700 mb-2">
          School Name
        </label>
        <input
          ref={inputRef}
          type="text"
          id="school"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search for a school (e.g., Harvard, Stanford, University of Michigan)"
          className="w-full px-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
        />
        <p className="mt-2 text-xs text-gray-500">
          Start typing to search or enter your school manually
        </p>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSchools.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {filteredSchools.map((school) => (
              <button
                key={school.id}
                type="button"
                onClick={() => handleSelectSchool(school)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {school.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {!!searchQuery.trim() && !selectedSchool && (
            <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
              <p className="text-sm text-blue-800">
                Using: <span className="font-medium">{searchQuery.trim()}</span>
              </p>
            </div>
          )}

          {!!selectedSchool && (
        <div className="rounded-md bg-green-50 p-3 border border-green-200">
          <p className="text-sm text-green-800">
            Selected: <span className="font-medium">{selectedSchool.name}</span>
          </p>
        </div>
      )}
        </div>

        <div className="shrink-0 text-right">
          <button
            type="button"
            onClick={handleSkip}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Skip for now
          </button>
          <p className="mt-2 text-xs text-gray-500">You can add this later in your profile</p>
        </div>
      </div>
    </div>
  );
}

