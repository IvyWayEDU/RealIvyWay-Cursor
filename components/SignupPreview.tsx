'use client';

import { useState } from 'react';

export default function SignupPreview() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      return;
    }

    setIsSubmitting(true);
    
    // Client-side only - just store in localStorage for now
    // In production, this would send to a backend waitlist API
    try {
      const waitlist = JSON.parse(localStorage.getItem('ivyway_waitlist') || '[]');
      if (!waitlist.includes(email.toLowerCase())) {
        waitlist.push(email.toLowerCase());
        localStorage.setItem('ivyway_waitlist', JSON.stringify(waitlist));
      }
      
      setSubmitted(true);
      setEmail('');
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    } catch (error) {
      console.error('Error saving to waitlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="create-account" className="border-t border-gray-200 bg-white py-32">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
            Join the Waitlist
          </h2>
          <p className="mt-4 text-xl leading-8 text-gray-600">
            Be the first to know when we launch new features
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md bg-green-50 p-4 border border-green-200 text-center">
            <p className="text-sm font-medium text-green-800">
              Thanks! You're on the list. We'll be in touch soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                type="email"
                id="waitlist-email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-4 py-3 text-black placeholder-gray-400 focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-0"
                placeholder="Enter your email address"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-[#0088CB] px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Joining...' : 'Join Waitlist'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Ready to get started?{' '}
            <a
              href="/auth/register"
              className="font-medium text-[#0088CB] hover:underline"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
