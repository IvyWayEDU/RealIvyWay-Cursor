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
    <section id="create-account" className="border-t border-gray-200 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12 items-start">
          <div className="lg:col-span-6">
            <p className="text-sm font-semibold text-[#5bbcff]">Final step</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start with IvyWay.
            </h2>
            <p className="mt-4 text-lg leading-8 text-white/80">
              Join the waitlist for new features, or create an account to book tutoring and counseling.
            </p>
          </div>

          <div className="lg:col-span-6">
            {submitted ? (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                <p className="text-sm font-semibold text-white">You’re on the list.</p>
                <p className="mt-1 text-sm text-white/75">We’ll reach out with updates and early access.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
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
                  className="w-full flex-1 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/45 focus:border-[#0088CB] focus:outline-none focus:ring-2 focus:ring-[#0088CB]/40"
                  placeholder="Email address"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-md bg-[#0088CB] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Joining...' : 'Join waitlist'}
                </button>
              </form>
            )}

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-gray-950 hover:bg-white/90 transition-colors"
              >
                Book a Session
              </a>
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/10 transition-colors"
              >
                Find Your Mentor
              </a>
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/10 transition-colors"
              >
                Join as a Tutor
              </a>
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-md bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/10 transition-colors"
              >
                Start with IvyWay AI
              </a>
            </div>

            <p className="mt-6 text-sm text-white/70">
              Already have an account?{' '}
              <a href="/auth/login" className="font-semibold text-white hover:underline">
                Log in
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
