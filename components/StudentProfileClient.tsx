'use client';

import { useRef, useState } from 'react';
import type { User } from '@/lib/auth/types';

interface StudentProfileClientProps {
  initialUser: User;
}

export default function StudentProfileClient({ initialUser }: StudentProfileClientProps) {
  const [name, setName] = useState(initialUser.name || '');
  const [email, setEmail] = useState(initialUser.email || '');
  const [phoneNumber, setPhoneNumber] = useState((initialUser as any).phoneNumber || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    (initialUser as any).profilePhotoUrl || (initialUser as any).profileImageUrl || ''
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfilePhotoUrl(result);
      };
      reader.readAsDataURL(file);
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phoneNumber,
          profilePhotoUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save profile');
      }

      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
          <p className="mt-1 text-sm text-gray-500">Update your profile details.</p>
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
              <p className={`text-sm ${saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {saveMessage.text}
              </p>
            </div>
          )}

          {/* Profile Photo */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="h-20 w-20 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200">
                  <span className="text-gray-600 text-lg font-semibold">
                    {(name?.trim()?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Change photo
              </button>
              <p className="text-xs text-gray-500">PNG/JPG up to 5MB</p>
            </div>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-[#0088CB]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save / Update'}
            </button>
          </div>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-xl shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-2">Billing & Payments</h2>
        <p className="text-sm text-gray-600 mb-4">
          Manage your payment methods, subscriptions, and receipts.
        </p>

        {billingError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-200">
            <p className="text-sm text-red-800">{billingError}</p>
          </div>
        )}

        <button
          onClick={async () => {
            setBillingLoading(true);
            setBillingError(null);
            try {
              const res = await fetch('/api/stripe/billing-portal', { method: 'POST' });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(data?.error || 'Failed to open billing portal');
              }
              if (!data?.url) {
                throw new Error('Missing billing portal URL');
              }
              window.location.href = data.url;
            } catch (e) {
              setBillingError(e instanceof Error ? e.message : 'Failed to open billing portal');
            } finally {
              setBillingLoading(false);
            }
          }}
          disabled={billingLoading}
          className="bg-[#0088cb] text-white px-5 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {billingLoading ? 'Opening…' : 'Manage Billing'}
        </button>
      </div>
    </>
  );
}



