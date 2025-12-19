'use client';

import { Elements } from '@stripe/react-stripe-js';
import { PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function CheckoutPage() {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex justify-center py-12 px-4">
      <div className="w-full max-w-xl bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-6">Checkout</h1>

        <Elements stripe={stripePromise}>
          <PaymentElement />
        </Elements>

        <button className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-medium">
          Pay
        </button>
      </div>
    </div>
  );
}
