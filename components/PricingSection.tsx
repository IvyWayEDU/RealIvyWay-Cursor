import { PRICING_CATALOG, formatUsdFromCents } from '@/lib/pricing/catalog';
import Link from 'next/link';

type Badge = 'Most Popular' | 'Best Value';

type PricingPlan = {
  title: string;
  price: string;
  description?: string;
  badge?: Badge;
  yearlyPrice?: string;
  features: string[];
  cta: { label: string; href: string };
};

function CheckIcon() {
  return (
    <svg
      className="mr-2 h-5 w-5 flex-shrink-0 text-[#0088CB]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold leading-7 text-black">{plan.title}</h3>
        {plan.badge && (
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
              plan.badge === 'Most Popular' ? 'bg-[#0088CB] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {plan.badge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <span className="text-4xl font-bold tracking-tight text-black">{plan.price}</span>
        {plan.yearlyPrice && <div className="mt-1 text-base font-medium text-gray-600">{plan.yearlyPrice}</div>}
      </div>
      {plan.description && <p className="mt-4 text-base leading-7 text-gray-600">{plan.description}</p>}

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start">
            <CheckIcon />
            <span className="text-base leading-7 text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.cta.href}
        className="mt-8 inline-flex items-center justify-center rounded-md bg-[#0088CB] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
      >
        {plan.cta.label}
      </Link>
    </div>
  );
}

function PricingSectionBlock({
  id,
  title,
  plans,
  columns = 2,
}: {
  id: string;
  title: string;
  plans: PricingPlan[];
  columns?: 2 | 3;
}) {
  return (
    <section id={id} className="border-t border-gray-200 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{title}</h2>
        </div>
        <div
          className={`mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none ${
            columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
          }`}
        >
          {plans.map((plan) => (
            <PricingCard key={plan.title} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PricingSection() {
  const tutoringPlans: PricingPlan[] = [
    {
      title: 'Single Tutoring Session',
      price: formatUsdFromCents(PRICING_CATALOG.tutoring_single.purchase_price_cents),
      description: '1 hour session',
      features: [
        '1:1 tutoring (60 minutes)',
        'Personalized learning plan',
        'Flexible scheduling',
        'Session notes & next steps',
      ],
      cta: { label: 'Book a Session', href: '/checkout' },
    },
    {
      title: 'Monthly Tutoring Package',
      price: formatUsdFromCents(PRICING_CATALOG.tutoring_monthly.purchase_price_cents),
      description: '4 sessions per month',
      badge: 'Best Value',
      features: [
        '4 tutoring sessions per month',
        'Better value vs. single sessions',
        'Priority scheduling',
        'Consistent weekly progress',
      ],
      cta: { label: 'Get Started', href: '/checkout' },
    },
  ];

  const testPrepPlans: PricingPlan[] = [
    {
      title: 'Single Test Prep Session',
      price: formatUsdFromCents(PRICING_CATALOG.test_prep_single.purchase_price_cents),
      description: '1 hour session',
      features: [
        'Targeted strategy + practice',
        'Homework + pacing support',
        'Personalized study focus',
        'Flexible scheduling',
      ],
      cta: { label: 'Book a Session', href: '/checkout' },
    },
    {
      title: 'Monthly Test Prep Bundle',
      price: formatUsdFromCents(PRICING_CATALOG.test_prep_monthly.purchase_price_cents),
      description: '4 sessions per month',
      badge: 'Most Popular',
      features: [
        '4 test prep sessions per month',
        'Weekly momentum & accountability',
        'Personalized plan by exam date',
        'Better value vs. single sessions',
      ],
      cta: { label: 'Get Started', href: '/checkout' },
    },
  ];

  const collegePlans: PricingPlan[] = [
    {
      title: 'College Counseling',
      price: formatUsdFromCents(PRICING_CATALOG.counseling_single.purchase_price_cents),
      description: 'One-on-one guidance',
      features: [
        'Application strategy & planning',
        'Essay brainstorming & review',
        'College list building',
        'Actionable next steps',
      ],
      cta: { label: 'Book a Session', href: '/checkout' },
    },
    {
      title: 'Monthly Counseling Plan',
      price: formatUsdFromCents(PRICING_CATALOG.counseling_monthly.purchase_price_cents),
      description: '4 sessions per month',
      badge: 'Most Popular',
      features: [
        '4 counseling sessions per month',
        'Ongoing support through deadlines',
        'Essay + application iteration',
        'Priority scheduling',
      ],
      cta: { label: 'Get Started', href: '/checkout' },
    },
    {
      title: 'Virtual College Tour',
      price: formatUsdFromCents(PRICING_CATALOG.virtual_tour_single.purchase_price_cents),
      description: 'Live guided tour with a current student',
      features: [
        'Live campus walkthrough',
        'Student Q&A on academics and life',
        'Real insights, not marketing',
        'Great for college-fit decisions',
      ],
      cta: { label: 'Book a Session', href: '/checkout' },
    },
  ];

  const aiPlans: PricingPlan[] = [
    {
      title: 'Free',
      price: '$0',
      description: 'Try IvyWay AI with limited access to core features.',
      features: [
        'Problem Solving Camera: Limited daily use',
        'Flash Cards: Limited daily use',
        'Quiz Maker: Limited daily use',
      ],
      cta: { label: 'Get Started', href: '/auth/register' },
    },
    {
      title: 'Basic',
      price: `${formatUsdFromCents(PRICING_CATALOG.ivyway_ai_basic_monthly.purchase_price_cents)} / month`,
      description: 'Perfect for regular homework and studying.',
      badge: 'Most Popular',
      features: [
        'Problem Solving Camera: High monthly usage',
        'Flash Cards: Unlimited',
        'Quiz Maker: Unlimited',
      ],
      cta: { label: 'Get Started', href: '/auth/register' },
    },
    {
      title: 'Pro',
      price: `${formatUsdFromCents(PRICING_CATALOG.ivyway_ai_pro_monthly.purchase_price_cents)} / month`,
      yearlyPrice: `${formatUsdFromCents(PRICING_CATALOG.ivyway_ai_pro_yearly.purchase_price_cents)} / year`,
      description: 'Unlimited help for heavy daily users.',
      badge: 'Best Value',
      features: [
        'Problem Solving Camera: Unlimited',
        'Flash Cards: Unlimited',
        'Quiz Maker: Unlimited',
        'Faster responses',
        'More detailed step-by-step explanations',
        'Longer quizzes',
      ],
      cta: { label: 'Get Started', href: '/auth/register' },
    },
  ];

  return (
    <div className="bg-white">
      <PricingSectionBlock id="tutoring-plans" title="Tutoring Plans" plans={tutoringPlans} columns={2} />
      <PricingSectionBlock id="test-prep-plans" title="Test Prep Plans" plans={testPrepPlans} columns={2} />
      <PricingSectionBlock id="college-counseling" title="College Counseling" plans={collegePlans} columns={3} />
      <PricingSectionBlock id="ai-tools" title="AI / Platform Tools" plans={aiPlans} columns={3} />
    </div>
  );
}

