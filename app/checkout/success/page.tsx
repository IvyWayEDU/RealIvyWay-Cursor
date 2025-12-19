import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex justify-center items-center py-12 px-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Payment Successful
        </h1>
        
        <p className="text-gray-600 mb-8">
          Your payment has been processed successfully. Thank you for your purchase!
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
