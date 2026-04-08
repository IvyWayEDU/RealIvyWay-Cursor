/**
 * Student Dashboard
 * 
 * Clean UI-only layout with placeholder sections.
 * No booking logic, payments, AI, or API calls.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import CompletedSessionsSection from '@/components/CompletedSessionsSection';
import ConfirmedSessionsSection from '@/components/ConfirmedSessionsSection';
import AIProblemSolver from '@/components/AIProblemSolver';
import MessagesSection from '@/components/MessagesSection';
import IvyWayAICard from '@/components/IvyWayAICard';
import ReferralEarningsSection from '@/components/ReferralEarningsSection';
import { getSession } from '@/lib/auth/session';

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  const isStudent = session.roles.includes('student');
  if (!isStudent) {
    redirect('/dashboard/provider');
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your sessions and track your progress.
          </p>
        </div>
        <Link
          href="/dashboard/book"
          className="px-6 py-2.5 bg-[#0088CB] text-white font-medium rounded-md hover:bg-[#0077B3] transition-colors"
        >
          Book a new session
        </Link>
      </div>

      <IvyWayAICard
        entryPoint="student_dashboard"
        description="Get instant help with studying, flashcards, quizzes, and step by step explanations."
      />

      {/* Upcoming Sessions Section */}
      <ConfirmedSessionsSection />

      {/* Completed Sessions and AI Problem Solver - 50/50 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completed Sessions Section - 50% width */}
        <div className="lg:col-span-1">
          <CompletedSessionsSection
            limit={3}
            showViewMore
            viewMoreHref="/dashboard/student/sessions"
          />
        </div>

        {/* AI Problem Solver and Messages - 50% width, stacked */}
        <div className="lg:col-span-1 space-y-6">
          <AIProblemSolver />
          <MessagesSection
            userId={session.userId}
            subtitle="Chat with your tutors and counselors"
            emptySubtitle="Start a conversation with your tutor or counselor"
          />
        </div>
      </div>

      <ReferralEarningsSection userId={session.userId} />

    </div>
  );
}
