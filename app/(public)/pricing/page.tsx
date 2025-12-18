export default function Pricing() {
  const plans = [
    {
      name: 'Student',
      description: 'Perfect for individual learners',
      price: 'Free',
      features: [
        'Access to course catalog',
        'Basic progress tracking',
        'Community support',
        'Limited resources',
      ],
    },
    {
      name: 'Student Plus',
      description: 'Enhanced learning experience',
      price: '$9.99',
      period: '/month',
      features: [
        'All Student features',
        'Advanced analytics',
        'Priority support',
        'Unlimited resources',
        'Certificates of completion',
      ],
    },
    {
      name: 'Provider',
      description: 'For education providers',
      price: 'Custom',
      features: [
        'Course management tools',
        'Student analytics',
        'Marketing support',
        'Revenue sharing',
        'Dedicated account manager',
      ],
    },
  ];

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Choose the right plan for you
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
          Select a plan that fits your learning or teaching needs. All plans include our core features.
        </p>
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-8 ring-1 ring-gray-200 ${
                index === 1 ? 'lg:z-10 lg:rounded-b-none lg:ring-2 lg:ring-indigo-600' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-x-4">
                <h3 className="text-lg font-semibold leading-8 text-gray-900">
                  {plan.name}
                </h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm font-semibold leading-6 text-gray-600">
                    {plan.period}
                  </span>
                )}
              </p>
              <a
                href="/auth/signup"
                className={`mt-6 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 ${
                  index === 1
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                Get started
              </a>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <svg
                      className="h-6 w-5 flex-none text-indigo-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

