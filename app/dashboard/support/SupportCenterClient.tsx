'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Role = 'student' | 'provider';

type FAQItem = {
  question: string;
  answer: string;
};

function SupportFAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
              aria-expanded={isOpen}
            >
              <span className="text-sm sm:text-base font-semibold text-gray-900">{item.question}</span>
              <svg
                className={`h-5 w-5 flex-shrink-0 text-[#0088CB] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm text-gray-600 leading-6">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SupportCenterClient(props: {
  role: Role;
}) {
  const { role } = props;

  const faqItems = useMemo<FAQItem[]>(() => {
    const common: FAQItem[] = [
      {
        question: 'How do I book a session?',
        answer:
          'Go to your dashboard and click “Book”. Choose a provider and time, then complete payment to confirm your session.',
      },
      {
        question: 'How do I join my session?',
        answer:
          'Open your upcoming session from the Sessions page and click “Join” to enter the Zoom meeting.',
      },
      {
        question: 'What happens if someone doesn’t show up?',
        answer:
          'If one party doesn’t join, the session can be marked as a no‑show. If you think something was recorded incorrectly, submit a request below and we’ll review it.',
      },
      {
        question: 'How do payments work?',
        answer:
          'Payments are handled securely through Stripe. Your session is confirmed only after payment succeeds.',
      },
      {
        question: 'How do refunds or credits work?',
        answer:
          'Refunds/credits depend on timing and the session’s status. If you believe you’re eligible, submit a support request with the session details.',
      },
      {
        question: 'How do I contact support?',
        answer:
          'Submit the form below and our team will respond as soon as possible.',
      },
    ];

    const studentOnly: FAQItem[] = [
      {
        question: 'How do I reschedule?',
        answer:
          'From your dashboard, open the session and reschedule/cancel at least 24 hours in advance when available. If you’re within 24 hours or can’t reschedule, contact support.',
      },
      {
        question: 'How do bundles work?',
        answer:
          'Bundles give you a set number of sessions at a package rate. Your remaining sessions are applied as you book. If you’re unsure what’s included, contact support.',
      },
      {
        question: 'How do I leave a review?',
        answer:
          'After a session is completed, you can leave a rating and optional review from your dashboard.',
      },
    ];

    const providerOnly: FAQItem[] = [
      {
        question: 'When do I get paid?',
        answer:
          'Earnings accrue as sessions are completed. Payout timing depends on approval/withdrawal status shown in your Earnings area.',
      },
      {
        question: 'What happens if a student no-shows?',
        answer:
          'No‑show outcomes depend on the session status. If you believe a no‑show wasn’t recorded correctly, submit a ticket with the session ID and what happened.',
      },
      {
        question: 'How do withdrawals work?',
        answer:
          'Go to Earnings → Withdraw to request a payout of available earnings. Pending withdrawals reduce your available balance until processed.',
      },
      {
        question: 'How do ratings affect me?',
        answer:
          'Ratings help students choose providers and can impact visibility over time. If you suspect an inaccurate review, contact support with details.',
      },
    ];

    return role === 'provider' ? [...common, ...providerOnly] : [...common, ...studentOnly];
  }, [role]);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('message', message);

      const resp = await fetch('/api/support-ticket', {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        setError('Unable to send message.');
        return;
      }

      setSubject('');
      setMessage('');
      setSuccess('Your request has been submitted. Our team will respond shortly.');
    } catch {
      setError('Unable to send message.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Support</h1>
            <p className="mt-2 text-sm text-gray-600">Need help? We’ve got you covered.</p>
          </div>
          <Link
            href="/dashboard/support/tickets"
            className="shrink-0 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            My Support Tickets
          </Link>
        </div>
      </div>

      {/* FAQ Section (FIRST) */}
      <section className="rounded-xl bg-white shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
        <p className="mt-1 text-sm text-gray-600">Find quick answers before contacting support.</p>

        <div className="mt-5">
          <SupportFAQAccordion items={faqItems} />
        </div>
      </section>

      {/* Contact Support Section (SECOND — AT THE BOTTOM) */}
      <section className="rounded-xl bg-white shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Still need help? Contact Support</h2>

        <form className="mt-5 space-y-4" onSubmit={submitTicket}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What can we help with?"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Describe the issue and include any relevant details (session ID, time, screenshots, etc.)"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !message.trim()}
              className="px-5 py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


