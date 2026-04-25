import Link from 'next/link';

type TocItem = {
  href: `#${string}`;
  label: string;
};

export default function LegalPageLayout({
  title,
  description,
  lastUpdated,
  toc,
  children,
}: {
  title: string;
  description?: string;
  lastUpdated?: string;
  toc?: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 text-base leading-7 text-gray-600 sm:text-lg">
                {description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold text-gray-900">Note:</span> This
                page is provided for general informational purposes and is not
                legal advice. Policies may be updated from time to time.
              </p>
              {lastUpdated ? (
                <p className="shrink-0">
                  <span className="font-semibold text-gray-900">
                    Last updated:
                  </span>{' '}
                  {lastUpdated}
                </p>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Questions? Contact{' '}
              <a
                className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
                href="mailto:support@ivyway.com"
              >
                support@ivyway.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            {toc && toc.length > 0 ? (
              <nav
                aria-label="On this page"
                className="rounded-xl border border-gray-200 bg-gray-50 p-5"
              >
                <h2 className="text-sm font-semibold text-gray-900">
                  On this page
                </h2>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {toc.map(item => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm font-medium text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <article className="mt-10 space-y-10 text-base leading-7 text-gray-700">
              {children}
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}

