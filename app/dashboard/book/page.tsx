import BookingFlowClient from '@/components/BookingFlowClient';
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount';

/**
 * Student Booking Page
 * 
 * Multi-step booking flow for students to book sessions.
 */
export default function BookPage() {
  return (
    <>
      <TrackEventOnMount name="booking_session_start" params={{ page: '/dashboard/book' }} />
      <BookingFlowClient />
    </>
  );
}

