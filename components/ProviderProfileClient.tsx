'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User } from '@/lib/auth/types';
import { normalizeSubjectId } from '@/lib/models/subjects';
import { LANGUAGE_TUTORING_OPTIONS, normalizeLanguageTutoringLabel } from '@/lib/models/languageTutoring';

interface ProviderProfileClientProps {
  initialUser: User;
}

// Academic subjects only (Test Prep is selected via Services UX, but stored as subject "test_prep").
const COMMON_SUBJECT_KEYS = ['math', 'english', 'science', 'history', 'languages', 'computer_science'] as const;
type SubjectKey = (typeof COMMON_SUBJECT_KEYS)[number];

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Math',
  english: 'English',
  science: 'Science',
  history: 'History',
  languages: 'Languages',
  computer_science: 'Computer Science',
  test_prep: 'Test Prep',
};

const normalizeProviderServiceTypeForSave = (input: unknown): string => {
  const raw = typeof input === 'string' ? input : String(input ?? '');
  const v = raw.trim().toLowerCase();
  if (!v) return '';
  const underscored = v.replace(/[\s-]+/g, '_');

  // Consistency rule: Test Prep is a SUBJECT, not a provider service.
  // Keep backward compatibility by mapping legacy test_prep -> tutoring.
  if (underscored === 'test_prep' || underscored === 'testprep') return 'tutoring';
  if (underscored === 'virtual_tour' || underscored === 'virtual_tours' || underscored === 'virtualtour' || underscored === 'virtualtours')
    return 'virtual_tour';
  if (underscored === 'counseling' || underscored === 'college_counseling') return 'college_counseling';
  if (underscored === 'tutor' || underscored === 'tutoring') return 'tutoring';

  return underscored;
};

type DbSchool = { id: string; name: string };

export default function ProviderProfileClient({ initialUser }: ProviderProfileClientProps) {
  const [name, setName] = useState(initialUser.name || '');
  const [email, setEmail] = useState(initialUser.email || '');
  const [phoneNumber, setPhoneNumber] = useState((initialUser as any).phoneNumber || '');
  const [originalEmail, setOriginalEmail] = useState(initialUser.email || '');
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState((initialUser as any).phoneNumber || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    (initialUser as any).profilePhotoUrl || (initialUser as any).profileImageUrl || ''
  );
  const initialServicesRaw: unknown = (initialUser as any).services ?? (initialUser as any).serviceTypes ?? [];
  const [services, setServices] = useState<string[]>(
    Array.isArray(initialServicesRaw)
      ? Array.from(
          new Set(
            initialServicesRaw.map(normalizeProviderServiceTypeForSave).filter(Boolean)
          )
        )
      : []
  );
  const [schoolId, setSchoolId] = useState<string>(
    (typeof (initialUser as any).school_id === 'string' && (initialUser as any).school_id.trim()
      ? (initialUser as any).school_id.trim()
      : Array.isArray((initialUser as any).schoolIds) && (initialUser as any).schoolIds.length > 0
        ? String((initialUser as any).schoolIds[0] || '')
        : '') || ''
  );
  const [schoolName, setSchoolName] = useState<string>(
    (typeof (initialUser as any).school_name === 'string' && (initialUser as any).school_name.trim()
      ? (initialUser as any).school_name.trim()
      : Array.isArray((initialUser as any).schoolNames) && (initialUser as any).schoolNames.length > 0
        ? String((initialUser as any).schoolNames[0] || '')
        : '') || ''
  );
  const [schoolQuery, setSchoolQuery] = useState<string>(
    (typeof (initialUser as any).school_name === 'string' && (initialUser as any).school_name.trim()
      ? (initialUser as any).school_name.trim()
      : Array.isArray((initialUser as any).schoolNames) && (initialUser as any).schoolNames.length > 0
        ? String((initialUser as any).schoolNames[0] || '')
        : (typeof (initialUser as any).school === 'string' && (initialUser as any).school.trim()
          ? (initialUser as any).school.trim()
          : '')) || ''
  );
  const [schools, setSchools] = useState<DbSchool[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<DbSchool | null>(null);
  const schoolInputRef = useRef<HTMLInputElement>(null);
  const schoolSuggestionsRef = useRef<HTMLDivElement>(null);
  const [subjects, setSubjects] = useState<string[]>(
    Array.isArray((initialUser as any).subjects)
      ? Array.from(
          new Set(
            ((initialUser as any).subjects as any[])
              .map((s) => normalizeSubjectId(typeof s === 'string' ? s : String(s ?? '')))
              .filter((s): s is string => !!s)
          )
        )
      : []
  );
  const initialLanguagesRaw: unknown = (initialUser as any).languages ?? (initialUser as any).tutoringLanguages ?? [];
  const [languages, setLanguages] = useState<string[]>(
    Array.isArray(initialLanguagesRaw)
      ? Array.from(
          new Set(
            (initialLanguagesRaw as any[])
              .map((v) => String(v ?? '').trim())
              .filter(Boolean)
          )
        )
      : []
  );
  const [otherLanguage, setOtherLanguage] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 2FA verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(null);
  const [pendingPhoneChange, setPendingPhoneChange] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  
  // Determine if email/phone can be edited
  const canEditEmail = !!phoneNumber;
  const canEditPhone = !!email;

  const hasService = (key: string) => services.includes(key);
  const isTutor = hasService('tutoring');
  const hasTestPrepSubject = Array.isArray(subjects) && subjects.includes('test_prep');
  const academicSubjects = Array.isArray(subjects) ? subjects.filter((s) => s !== 'test_prep') : [];
  const hasLanguagesSubject = Array.isArray(subjects) && subjects.includes('languages');

  // Keep dependent fields consistent with enabled services.
  useEffect(() => {
    if (!isTutor) {
      setSubjects([]);
    }
  }, [isTutor]);

  // If Languages subject is removed, clear language list (prevents stale matches).
  useEffect(() => {
    if (!hasLanguagesSubject) {
      setLanguages([]);
      setOtherLanguage('');
    }
  }, [hasLanguagesSubject]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/schools', { method: 'GET' });
        if (!res.ok) return;
        const json = (await res.json()) as any;
        const list: DbSchool[] = Array.isArray(json?.schools) ? json.schools : [];
        const cleaned = list
          .map((s) => ({ id: String(s?.id ?? '').trim(), name: String(s?.name ?? '').trim() }))
          .filter((s) => s.id && s.name);
        if (!cancelled) setSchools(cleaned);
      } catch {
        // Non-blocking: free typing still works without suggestions.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep local "selected" state in sync with persisted values.
  useEffect(() => {
    const sid = typeof schoolId === 'string' ? schoolId.trim() : '';
    const sname = typeof schoolName === 'string' ? schoolName.trim() : '';
    if (!sid && !sname) {
      setSelectedSchool(null);
      return;
    }
    if (sid) {
      const match = schools.find((s) => s.id === sid) || null;
      setSelectedSchool(match);
      // Backfill display name for legacy records that stored only the FK.
      if (match && !sname) {
        setSchoolName(match.name);
        setSchoolQuery((prev) => (prev && prev.trim() ? prev : match.name));
      }
    } else {
      setSelectedSchool(null);
    }
  }, [schoolId, schoolName, schools]);

  // Close school suggestions when clicking outside.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        schoolSuggestionsRef.current &&
        !schoolSuggestionsRef.current.contains(event.target as Node) &&
        schoolInputRef.current &&
        !schoolInputRef.current.contains(event.target as Node)
      ) {
        setShowSchoolSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSchools = (() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return [];
    return schools
      .filter((s) => s.name.toLowerCase().includes(q))
      .filter((s) => s.id !== schoolId)
      .slice(0, 25);
  })();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    try {
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfilePhotoUrl(result);
        handleSave({ profilePhotoUrl: result });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setSaveMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' });
    }
  };

  // Send verification code
  const sendVerificationCode = async (type: 'email' | 'phone', value: string) => {
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      const response = await fetch('/api/profile/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send verification code');
      }

      setVerificationSent(true);
      setVerificationCode('');
    } catch (error) {
      console.error('Error sending verification code:', error);
      setVerificationError(error instanceof Error ? error.message : 'Failed to send verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  // Verify code and apply change
  const verifyAndApplyChange = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const response = await fetch('/api/profile/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: verificationCode,
          type: pendingEmailChange ? 'email' : 'phone',
          newValue: pendingEmailChange || pendingPhoneChange,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      // Apply the change
      if (pendingEmailChange) {
        setEmail(pendingEmailChange);
        setOriginalEmail(pendingEmailChange);
        setPendingEmailChange(null);
      }
      if (pendingPhoneChange) {
        setPhoneNumber(pendingPhoneChange);
        setOriginalPhoneNumber(pendingPhoneChange);
        setPendingPhoneChange(null);
      }

      // Reset verification state
      setVerificationCode('');
      setVerificationSent(false);
      setVerificationError(null);
    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle email change attempt
  const handleEmailChange = async (newEmail: string) => {
    if (newEmail === originalEmail) {
      setEmail(newEmail);
      setPendingEmailChange(null);
      return;
    }

    if (!phoneNumber) {
      setVerificationError('Phone number must be set before changing email');
      setEmail(originalEmail);
      return;
    }

    setEmail(newEmail);
    setPendingEmailChange(newEmail);
    setVerificationSent(false);
    setVerificationCode('');
    setVerificationError(null);
    
    // Automatically send verification code
    await sendVerificationCode('email', newEmail);
  };

  // Handle phone change attempt
  const handlePhoneChange = async (newPhone: string) => {
    if (newPhone === originalPhoneNumber) {
      setPhoneNumber(newPhone);
      setPendingPhoneChange(null);
      return;
    }

    if (!email) {
      setVerificationError('Email must be set before changing phone number');
      setPhoneNumber(originalPhoneNumber);
      return;
    }

    setPhoneNumber(newPhone);
    setPendingPhoneChange(newPhone);
    setVerificationSent(false);
    setVerificationCode('');
    setVerificationError(null);
    
    // Automatically send verification code
    await sendVerificationCode('phone', newPhone);
  };

  const isProbablyReactEvent = (value: unknown): value is { preventDefault: () => void } => {
    if (!value || typeof value !== 'object') return false;
    const v = value as any;
    return typeof v.preventDefault === 'function' && ('currentTarget' in v || 'target' in v);
  };

  const handleSave = async (overrides: Record<string, any> = {}) => {
    setSaving(true);
    setSaveMessage(null);

    // Check if there are pending changes that need verification
    if (pendingEmailChange || pendingPhoneChange) {
      setSaveMessage({
        type: 'error',
        text: 'Please verify your email or phone number change before saving',
      });
      setSaving(false);
      return;
    }

    try {
      const safeOverrides = isProbablyReactEvent(overrides) ? {} : overrides;

      // Validate service rules (client-side fast feedback; server also enforces).
      const normalizedServices = Array.from(new Set((services || []).map(normalizeProviderServiceTypeForSave).filter(Boolean)));

      // Persist provider school identity using onboarding logic (DB-backed, supports free typing + clearing).
      const trimmedSchoolName = schoolQuery.trim();
      const schoolRes = await fetch('/api/onboarding/provider-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName: trimmedSchoolName }),
      });
      if (!schoolRes.ok) {
        const j = await schoolRes.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to save school');
      }
      const schoolJson = (await schoolRes.json()) as any;
      const nextSchoolId = typeof schoolJson?.schoolId === 'string' ? schoolJson.schoolId : '';
      const nextSchoolName = typeof schoolJson?.schoolName === 'string' ? schoolJson.schoolName : '';
      setSchoolId(nextSchoolId);
      setSchoolName(nextSchoolName);
      setSchoolQuery(nextSchoolName || '');
      setSelectedSchool(nextSchoolId ? schools.find((s) => s.id === nextSchoolId) || null : null);
      setShowSchoolSuggestions(false);

      const updateData: any = {
        name,
        email,
        phoneNumber,
        profilePhotoUrl,
        services: normalizedServices,
        offersVirtualTours: normalizedServices.includes('virtual_tour'),
        subjects,
        // Only persist when Languages is selected; otherwise clear to prevent booking mismatches.
        languages: hasLanguagesSubject ? languages : [],
      };

      // Allow callers (e.g. photo upload) to override specific fields without duplicating save logic.
      Object.assign(updateData, safeOverrides);

      console.log('Saving provider profile:', updateData);

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Update original values
      setOriginalEmail(email);
      setOriginalPhoneNumber(phoneNumber);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleService = (serviceKey: string, checked: boolean) => {
    const key = normalizeProviderServiceTypeForSave(serviceKey);
    if (!key) return;

    setServices((prev) => {
      const set = new Set((prev || []).map(normalizeProviderServiceTypeForSave).filter(Boolean));
      if (checked) set.add(key);
      else set.delete(key);
      return Array.from(set);
    });
  };

  const toggleTestPrep = (checked: boolean) => {
    // Test Prep is a SUBJECT, not a provider service.
    // UX: expose it under Services, but persist as subject "test_prep" and ensure tutoring is enabled.
    setSubjects((prev) => {
      const set = new Set(Array.isArray(prev) ? prev : []);
      if (checked) set.add('test_prep');
      else set.delete('test_prep');
      return Array.from(set);
    });
    if (checked && !hasService('tutoring')) {
      toggleService('tutoring', true);
    }
  };

  const handleSelectSchool = (school: DbSchool) => {
    setSelectedSchool(school);
    setSchoolId(school.id);
    setSchoolName(school.name);
    setSchoolQuery(school.name);
    setShowSchoolSuggestions(false);
  };

  const clearSchool = () => {
    setSelectedSchool(null);
    setSchoolId('');
    setSchoolName('');
    setSchoolQuery('');
    setShowSchoolSuggestions(false);
  };

  const handleAddSubject = (subject: string) => {
    if (!subjects.includes(subject)) {
      const newSubjects = [...subjects, subject];
      setSubjects(newSubjects);
    }
  };

  const handleRemoveSubject = (subject: string) => {
    const newSubjects = subjects.filter(s => s !== subject);
    setSubjects(newSubjects);
  };

  const toggleLanguage = (label: string, checked: boolean) => {
    const cleaned = String(label || '').trim();
    if (!cleaned) return;
    setLanguages((prev) => {
      const existing = Array.isArray(prev) ? prev : [];
      const next = new Map<string, string>();
      for (const v of existing) {
        const t = String(v ?? '').trim();
        if (!t) continue;
        next.set(normalizeLanguageTutoringLabel(t), t);
      }
      if (checked) {
        next.set(normalizeLanguageTutoringLabel(cleaned), cleaned);
      } else {
        next.delete(normalizeLanguageTutoringLabel(cleaned));
      }
      return Array.from(next.values());
    });
  };

  const addOtherLanguage = () => {
    const raw = otherLanguage.trim();
    if (!raw) return;
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setLanguages((prev) => {
      const next = new Map<string, string>();
      for (const v of prev || []) {
        const t = String(v ?? '').trim();
        if (!t) continue;
        next.set(normalizeLanguageTutoringLabel(t), t);
      }
      for (const p of parts) {
        next.set(normalizeLanguageTutoringLabel(p), p);
      }
      return Array.from(next.values());
    });
    setOtherLanguage('');
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
        <p className="mt-1 text-sm text-gray-500">
          Update your profile details and preferences.
        </p>
        <div className="mt-4">
          <Link
            href="/change-password"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Change Password
          </Link>
        </div>
      </div>
      <div className="p-6 space-y-8">
        {saveMessage && (
          <div
            className={`rounded-md p-4 ${
              saveMessage.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {saveMessage.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${
                    saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {saveMessage.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Picture */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-300">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
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
          </div>
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
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] cursor-pointer"
          >
            Change profile picture
          </label>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              disabled={!canEditEmail}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2 ${
                !canEditEmail ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
              }`}
            />
            {!canEditEmail && (
              <p className="mt-1 text-xs text-gray-500">
                Phone number must be set before you can change your email
              </p>
            )}
            {pendingEmailChange && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Verification required to change email
                </p>
                <p className="text-xs text-blue-700 mb-3">
                  A verification code has been sent to your phone number. Please enter it below to confirm the email change.
                </p>
                {verificationSent && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="verification-code" className="block text-sm font-medium text-blue-900 mb-1">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        id="verification-code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="block w-full rounded-md border-blue-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={verifyAndApplyChange}
                        disabled={isVerifying || !verificationCode.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isVerifying ? 'Verifying...' : 'Verify & Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingEmailChange(null);
                          setEmail(originalEmail);
                          setVerificationSent(false);
                          setVerificationCode('');
                          setVerificationError(null);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB]"
                      >
                        Cancel
                      </button>
                    </div>
                    {verificationError && (
                      <p className="text-xs text-red-600">{verificationError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={!canEditPhone}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2 ${
                !canEditPhone ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
              }`}
            />
            {!canEditPhone && (
              <p className="mt-1 text-xs text-gray-500">
                Email must be set before you can change your phone number
              </p>
            )}
            {pendingPhoneChange && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Verification required to change phone number
                </p>
                <p className="text-xs text-blue-700 mb-3">
                  A verification code has been sent to your email. Please enter it below to confirm the phone number change.
                </p>
                {verificationSent && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="verification-code-phone" className="block text-sm font-medium text-blue-900 mb-1">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        id="verification-code-phone"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="block w-full rounded-md border-blue-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={verifyAndApplyChange}
                        disabled={isVerifying || !verificationCode.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isVerifying ? 'Verifying...' : 'Verify & Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPhoneChange(null);
                          setPhoneNumber(originalPhoneNumber);
                          setVerificationSent(false);
                          setVerificationCode('');
                          setVerificationError(null);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB]"
                      >
                        Cancel
                      </button>
                    </div>
                    {verificationError && (
                      <p className="text-xs text-red-600">{verificationError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* College / University (optional, always available) */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="school" className="block text-sm font-medium text-gray-700">
                College / University
              </label>
              {(schoolQuery.trim() || schoolId || schoolName) && (
                <button
                  type="button"
                  onClick={clearSchool}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <input
                ref={schoolInputRef}
                type="text"
                id="school"
                value={schoolQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setSchoolQuery(v);
                  setShowSchoolSuggestions(true);
                  setSelectedSchool(null);
                  const trimmed = v.trim();
                  setSchoolId('');
                  setSchoolName(trimmed);
                }}
                onFocus={() => {
                  if (schoolQuery.trim() || filteredSchools.length > 0) setShowSchoolSuggestions(true);
                }}
                onBlur={() => {
                  const trimmed = schoolQuery.trim();
                  if (!trimmed) {
                    setSelectedSchool(null);
                    setSchoolId('');
                    setSchoolName('');
                    setSchoolQuery('');
                    return;
                  }
                  // Free-typed values are allowed; no need to pick a dropdown item.
                  if (!selectedSchool) {
                    setSchoolId('');
                    setSchoolName(trimmed);
                    setSchoolQuery(trimmed);
                  }
                }}
                placeholder="Start typing to search or enter your school"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2"
              />
              {showSchoolSuggestions && filteredSchools.length > 0 && (
                <div
                  ref={schoolSuggestionsRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                >
                  {filteredSchools.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onMouseDown={(e) => {
                        // Prevent blur-before-click on the input.
                        e.preventDefault();
                      }}
                      onClick={() => handleSelectSchool(school)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    >
                      {school.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!!schoolQuery.trim() && !selectedSchool && (
              <p className="mt-2 text-xs text-gray-500">
                Using: <span className="font-medium">{schoolQuery.trim()}</span>
              </p>
            )}
            {!!selectedSchool && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: <span className="font-medium">{selectedSchool.name}</span>
              </p>
            )}
            {!schoolQuery.trim() && (
              <p className="mt-2 text-xs text-gray-500">Optional. You can add or update this anytime.</p>
            )}
          </div>
        </div>

        {/* Services */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Services</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasService('tutoring')}
                onChange={(e) => toggleService('tutoring', e.target.checked)}
                className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Tutoring</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasTestPrepSubject}
                onChange={(e) => toggleTestPrep(e.target.checked)}
                className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Test Prep</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasService('college_counseling')}
                onChange={(e) => toggleService('college_counseling', e.target.checked)}
                className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">College Counseling</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={hasService('virtual_tour')}
                onChange={(e) => toggleService('virtual_tour', e.target.checked)}
                className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Virtual Tours</span>
            </label>
          </div>
        </div>

        {/* Subjects (if Tutoring) */}
        {isTutor && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Subjects</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SUBJECT_KEYS.map((subjectKey) => (
                <button
                  key={subjectKey}
                  type="button"
                  onClick={() => {
                    if (subjects.includes(subjectKey)) {
                      handleRemoveSubject(subjectKey);
                    } else {
                      handleAddSubject(subjectKey);
                    }
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                    subjects.includes(subjectKey)
                      ? 'bg-[#0088CB] text-white border-[#0088CB]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#0088CB] hover:text-[#0088CB]'
                  }`}
                >
                  {SUBJECT_LABELS[subjectKey] ?? subjectKey}
                </button>
              ))}
            </div>
            {academicSubjects.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">Selected subjects:</p>
                <div className="flex flex-wrap gap-2">
                  {academicSubjects.map((subject) => (
                    <span
                      key={subject}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0088CB] text-white"
                    >
                      {SUBJECT_LABELS[subject] ?? subject}
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
          </div>
        )}

        {/* Languages (only if "Languages" subject selected) */}
        {isTutor && hasLanguagesSubject && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Languages you teach</label>
              <p className="mt-1 text-xs text-gray-500">
                Students select a specific language. Choose the languages you can tutor so you’ll appear in the right results.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LANGUAGE_TUTORING_OPTIONS.map((lang) => {
                const selected = (languages || []).some((l) => normalizeLanguageTutoringLabel(l) === normalizeLanguageTutoringLabel(lang));
                return (
                  <label key={lang} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => toggleLanguage(lang, e.target.checked)}
                      className="h-4 w-4 text-[#0088CB] focus:ring-[#0088CB] border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{lang}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={otherLanguage}
                onChange={(e) => setOtherLanguage(e.target.value)}
                placeholder="Other language (optional). You can add multiple separated by commas."
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#0088CB] focus:ring-[#0088CB] sm:text-sm px-4 py-2"
              />
              <button
                type="button"
                onClick={addOtherLanguage}
                disabled={!otherLanguage.trim()}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            {languages.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Selected languages:</p>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0088CB] text-white"
                    >
                      {lang}
                      <button
                        type="button"
                        onClick={() => toggleLanguage(lang, false)}
                        className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#0077B3] focus:outline-none"
                        aria-label={`Remove ${lang}`}
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
          </div>
        )}

        {/* Save Changes Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0088CB] hover:bg-[#0077B3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0088CB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

