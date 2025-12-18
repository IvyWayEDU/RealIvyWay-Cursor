'use client';

import { useState } from 'react';

type ServiceType = 'Tutoring Services' | 'Test Prep' | 'College Counseling' | 'Virtual Tours' | 'IvyWay AI';

interface PricingCard {
  service: ServiceType;
  title: string;
  price: string;
  description?: string;
  badge?: 'Most Popular' | 'Best Value';
  features?: string[];
  buttonText?: string;
  yearlyPrice?: string;
}

const pricingData: PricingCard[] = [
  // Tutoring Services
  {
    service: 'Tutoring Services',
    title: 'Single Tutoring Session',
    price: '$69',
    description: '1 hour session',
  },
  {
    service: 'Tutoring Services',
    title: 'Monthly Tutoring Package',
    price: '$249',
    description: '4 sessions per month',
  },
  // Test Prep
  {
    service: 'Test Prep',
    title: 'Single Test Prep Session',
    price: '$149',
    description: '1 hour session',
  },
  {
    service: 'Test Prep',
    title: 'Monthly Test Prep Bundle',
    price: '$499',
    description: '4 sessions per month',
  },
  // College Counseling
  {
    service: 'College Counseling',
    title: '30 Minute Counseling Session',
    price: '$49',
    description: 'One on one guidance',
  },
  {
    service: 'College Counseling',
    title: '60 Minute Counseling Session',
    price: '$89',
    description: 'In depth counseling',
  },
  {
    service: 'College Counseling',
    title: 'Monthly Counseling Plan',
    price: '$159',
    description: '2 sessions per month',
  },
  // Virtual Tours
  {
    service: 'Virtual Tours',
    title: 'Single Virtual College Tour',
    price: '$124',
    description: 'Live guided tour with a current student',
  },
  // IvyWay AI
  {
    service: 'IvyWay AI',
    title: 'Free',
    price: '$0',
    description: 'Try IvyWay AI with limited access to core features.',
    features: [
      'Problem Solving Camera: Limited daily use',
      'Flash Cards: Limited daily use',
      'Quiz Maker: Limited daily use',
    ],
    buttonText: 'Get Started Free',
  },
  {
    service: 'IvyWay AI',
    title: 'Basic',
    price: '$14.99 / month',
    description: 'Perfect for regular homework and studying.',
    badge: 'Most Popular',
    features: [
      'Problem Solving Camera: High monthly usage',
      'Flash Cards: Unlimited',
      'Quiz Maker: Unlimited',
    ],
    buttonText: 'Upgrade to Basic',
  },
  {
    service: 'IvyWay AI',
    title: 'Pro',
    price: '$29.99 / month',
    yearlyPrice: '$249.99 / year',
    description: 'Unlimited help for heavy daily users.',
    badge: 'Best Value',
    features: [
      'Problem Solving Camera: Unlimited',
      'Flash Cards: Unlimited',
      'Quiz Maker: Unlimited',
      'Faster responses',
      'More detailed step by step explanations',
      'Longer quizzes',
    ],
    buttonText: 'Upgrade to Pro',
  },
];

export default function PricingSection() {
  const [selectedService, setSelectedService] = useState<ServiceType>('Tutoring Services');

  const services: ServiceType[] = [
    'Tutoring Services',
    'Test Prep',
    'College Counseling',
    'Virtual Tours',
    'IvyWay AI',
  ];

  const filteredPricing = pricingData.filter((card) => card.service === selectedService);

  return (
    <div id="pricing" className="border-t border-gray-200 bg-white py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
            Transparent Pricing Options
          </h2>
          <p className="mt-4 text-xl leading-8 text-gray-500">
            Choose the plan that works best for your educational goals and budget
          </p>
        </div>

        {/* Service Selector */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {services.map((service) => (
            <button
              key={service}
              onClick={() => setSelectedService(service)}
              className={`rounded-full px-6 py-2.5 text-base font-semibold transition-colors ${
                selectedService === service
                  ? 'bg-[#0088CB] text-white'
                  : 'bg-white text-black ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
              }`}
            >
              {service}
            </button>
          ))}
        </div>

        {/* Pricing Cards */}
        <div
          className={`mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none ${
            selectedService === 'IvyWay AI' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
          }`}
        >
          {filteredPricing.map((card, index) => (
            <div
              key={`${card.service}-${index}`}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold leading-7 text-black">{card.title}</h3>
                {card.badge && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      card.badge === 'Most Popular'
                        ? 'bg-[#0088CB] text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold tracking-tight text-black">{card.price}</span>
                {card.yearlyPrice && (
                  <div className="mt-1 text-base font-medium text-gray-600">{card.yearlyPrice}</div>
                )}
              </div>
              {card.description && (
                <p className="mt-4 text-base leading-7 text-gray-600">{card.description}</p>
              )}
              {card.features && (
                <ul className="mt-6 space-y-3">
                  {card.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <svg
                        className="mr-2 h-5 w-5 flex-shrink-0 text-[#0088CB]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-base leading-7 text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-8 rounded-md bg-[#0088CB] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
              >
                {card.buttonText || 'Book Now'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

